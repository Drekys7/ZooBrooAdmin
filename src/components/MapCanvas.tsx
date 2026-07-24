import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { MapCategory, MapItem } from '../domain/models';
import 'leaflet/dist/leaflet.css';
import './map-canvas.css';

export interface NormalizedPosition {
  x: number;
  y: number;
}

export interface ImagePoint {
  x: number;
  y: number;
}

export interface MapCanvasProps {
  backgroundUrl: string | null;
  backgroundWidth: number;
  backgroundHeight: number;
  items: readonly MapItem[];
  categories: readonly MapCategory[];
  selectedItemId?: string | null;
  addMode?: boolean;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  getItemIconUrl?: (item: MapItem, category: MapCategory | undefined) => string | null | undefined;
  onSelect?: (itemId: string | null) => void;
  onAdd?: (position: NormalizedPosition) => void;
  onMove?: (itemId: string, position: NormalizedPosition) => void;
  onDragPreview?: (itemId: string, position: NormalizedPosition) => void;
}

const DEFAULT_MARKER_COLOR = '#315f4b';
const DEFAULT_DIMENSION = 1;

export function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function assertDimensions(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Map dimensions must be finite positive numbers.');
  }
}

/** Converts top-left-origin image pixels to resolution-independent coordinates. */
export function normalizePoint(point: ImagePoint, width: number, height: number): NormalizedPosition {
  assertDimensions(width, height);
  return {
    x: clampNormalized(point.x / width),
    y: clampNormalized(point.y / height),
  };
}

/** Converts resolution-independent coordinates to top-left-origin image pixels. */
export function denormalizePosition(
  position: NormalizedPosition,
  width: number,
  height: number,
): ImagePoint {
  assertDimensions(width, height);
  return {
    x: clampNormalized(position.x) * width,
    y: clampNormalized(position.y) * height,
  };
}

/** Leaflet's Simple CRS has its origin at the bottom-left; image data uses top-left. */
export function positionToLatLng(
  position: NormalizedPosition,
  width: number,
  height: number,
): L.LatLngLiteral {
  const point = denormalizePosition(position, width, height);
  return { lat: height - point.y, lng: point.x };
}

export function latLngToPosition(
  latLng: Pick<L.LatLngLiteral, 'lat' | 'lng'>,
  width: number,
  height: number,
): NormalizedPosition {
  return normalizePoint({ x: latLng.lng, y: height - latLng.lat }, width, height);
}

function safeDimension(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_DIMENSION;
}

function safeMarkerColor(color: string | undefined): string {
  if (!color) return DEFAULT_MARKER_COLOR;
  const normalized = color.trim();
  return /^(#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+-]+\))$/i.test(normalized)
    ? normalized
    : DEFAULT_MARKER_COLOR;
}

function createMarkerIcon(
  item: MapItem,
  category: MapCategory | undefined,
  selected: boolean,
  iconUrl: string | null | undefined,
): L.DivIcon {
  const isAnimal = item.type === 'animal'
  const body = document.createElement('span');
  body.className = `map-canvas__marker ${isAnimal ? 'is-animal' : 'is-poi'}${selected ? ' is-selected' : ''}`;
  body.style.setProperty('--marker-color', safeMarkerColor(category?.color));
  body.setAttribute('aria-hidden', 'true');

  if (iconUrl) {
    if (isAnimal) {
      const image = document.createElement('img');
      image.className = 'map-canvas__marker-image';
      image.src = iconUrl;
      image.alt = '';
      image.draggable = false;
      body.append(image);
    } else {
      const mask = document.createElement('span');
      mask.className = 'map-canvas__marker-mask';
      mask.style.setProperty('-webkit-mask-image', `url(${iconUrl})`);
      mask.style.setProperty('mask-image', `url(${iconUrl})`);
      body.append(mask);
    }
  } else {
    const label = document.createElement('span');
    label.className = 'map-canvas__marker-label';
    label.textContent = item.title.trim().slice(0, 1).toLocaleUpperCase() || '•';
    body.append(label);
  }

  return L.divIcon({
    className: 'map-canvas__marker-icon',
    html: body,
    iconSize: isAnimal ? [72, 78] : [51, 57],
    iconAnchor: isAnimal ? [36, 66] : [26, 51],
    tooltipAnchor: isAnimal ? [0, -60] : [0, -42],
  });
}

function categorySignature(category: MapCategory | undefined): string {
  return category ? `${category.id}:${category.color}:${category.visible}` : 'missing';
}

function createTooltipContent(title: string): HTMLElement {
  const content = document.createElement('span');
  content.textContent = title;
  return content;
}

export function MapCanvas({
  backgroundUrl,
  backgroundWidth,
  backgroundHeight,
  items,
  categories,
  selectedItemId = null,
  addMode = false,
  disabled = false,
  className,
  ariaLabel = 'Interaktive Zoo-Karte',
  getItemIconUrl,
  onSelect,
  onAdd,
  onMove,
  onDragPreview,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const markerSignaturesRef = useRef(new Map<string, string>());
  const draggingItemRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onSelect, onAdd, onMove, onDragPreview });
  const stateRef = useRef({
    addMode,
    disabled,
    hasBackground: Boolean(backgroundUrl),
    width: safeDimension(backgroundWidth),
    height: safeDimension(backgroundHeight),
  });

  callbacksRef.current = { onSelect, onAdd, onMove, onDragPreview };
  stateRef.current = {
    addMode,
    disabled,
    hasBackground: Boolean(backgroundUrl),
    width: safeDimension(backgroundWidth),
    height: safeDimension(backgroundHeight),
  };

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      zoomControl: false,
      attributionControl: false,
      minZoom: -6,
      maxZoom: 5,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      maxBoundsViscosity: 0.72,
    });
    mapRef.current = map;

    map.on('click', (event: L.LeafletMouseEvent) => {
      const current = stateRef.current;
      if (!current.addMode || current.disabled || !current.hasBackground) {
        callbacksRef.current.onSelect?.(null);
        return;
      }

      const isInsideImage =
        event.latlng.lng >= 0 &&
        event.latlng.lng <= current.width &&
        event.latlng.lat >= 0 &&
        event.latlng.lat <= current.height;
      if (!isInsideImage) return;

      callbacksRef.current.onAdd?.(
        latLngToPosition(event.latlng, current.width, current.height),
      );
    });

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            map.invalidateSize({ pan: false });
          });
    resizeObserver?.observe(container);

    return () => {
      resizeObserver?.disconnect();
      markersRef.current.clear();
      markerSignaturesRef.current.clear();
      overlayRef.current = null;
      boundsRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (overlayRef.current) {
      overlayRef.current.removeFrom(map);
      overlayRef.current = null;
    }

    const width = safeDimension(backgroundWidth);
    const height = safeDimension(backgroundHeight);
    const bounds = L.latLngBounds([0, 0], [height, width]);
    boundsRef.current = bounds;
    map.setMaxBounds(bounds.pad(0.45));

    if (backgroundUrl) {
      overlayRef.current = L.imageOverlay(backgroundUrl, bounds, {
        interactive: false,
        className: 'map-canvas__background',
      }).addTo(map);
    }

    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      map.fitBounds(bounds, { animate: false, padding: [30, 30] });
    });
    return () => cancelAnimationFrame(frame);
  }, [backgroundHeight, backgroundUrl, backgroundWidth]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const width = safeDimension(backgroundWidth);
    const height = safeDimension(backgroundHeight);
    const renderedItemIds = new Set<string>();

    for (const item of items) {
      const category = categoriesById.get(item.categoryId);
      if (!item.visible || (category && !category.visible)) continue;
      renderedItemIds.add(item.id);

      const iconUrl = getItemIconUrl?.(item, category);
      const isSelected = item.id === selectedItemId;
      const signature = [
        item.title,
        item.iconAssetId ?? '',
        categorySignature(category),
        iconUrl ?? '',
        isSelected ? 'selected' : '',
      ].join('|');

      let marker = markersRef.current.get(item.id);
      if (!marker) {
        marker = L.marker(positionToLatLng(item.position, width, height), {
          draggable: !disabled,
          keyboard: true,
          riseOnHover: true,
          title: item.title,
          alt: item.title,
          icon: createMarkerIcon(item, category, isSelected, iconUrl),
        })
          .bindTooltip(createTooltipContent(item.title), {
            direction: 'top',
            offset: [0, -6],
            opacity: 0.92,
          })
          .addTo(map);

        marker.on('click', () => callbacksRef.current.onSelect?.(item.id));
        marker.on('dragstart', () => {
          draggingItemRef.current = item.id;
          callbacksRef.current.onSelect?.(item.id);
        });
        marker.on('drag', () => {
          const currentMarker = markersRef.current.get(item.id);
          if (!currentMarker) return;
          const current = stateRef.current;
          const position = latLngToPosition(
            currentMarker.getLatLng(),
            current.width,
            current.height,
          );
          currentMarker.setLatLng(positionToLatLng(position, current.width, current.height));
          callbacksRef.current.onDragPreview?.(item.id, position);
        });
        marker.on('dragend', () => {
          const currentMarker = markersRef.current.get(item.id);
          draggingItemRef.current = null;
          if (!currentMarker) return;
          const current = stateRef.current;
          const position = latLngToPosition(
            currentMarker.getLatLng(),
            current.width,
            current.height,
          );
          currentMarker.setLatLng(positionToLatLng(position, current.width, current.height));
          callbacksRef.current.onMove?.(item.id, position);
        });
        markersRef.current.set(item.id, marker);
      }

      if (markerSignaturesRef.current.get(item.id) !== signature) {
        marker.setIcon(createMarkerIcon(item, category, isSelected, iconUrl));
        marker.setTooltipContent(createTooltipContent(item.title));
        markerSignaturesRef.current.set(item.id, signature);
      }

      marker.setZIndexOffset(isSelected ? 1000 : 0);
      const markerElement = marker.getElement();
      markerElement?.setAttribute('title', item.title);
      markerElement?.setAttribute('aria-label', item.title);
      markerElement?.setAttribute('aria-pressed', String(isSelected));
      if (disabled) marker.dragging?.disable();
      else marker.dragging?.enable();

      if (draggingItemRef.current !== item.id) {
        marker.setLatLng(positionToLatLng(item.position, width, height));
      }
    }

    for (const [itemId, marker] of markersRef.current) {
      if (renderedItemIds.has(itemId)) continue;
      marker.removeFrom(map);
      markersRef.current.delete(itemId);
      markerSignaturesRef.current.delete(itemId);
    }
  }, [
    backgroundHeight,
    backgroundWidth,
    categoriesById,
    disabled,
    getItemIconUrl,
    items,
    selectedItemId,
  ]);

  const resetView = () => {
    const map = mapRef.current;
    const bounds = boundsRef.current;
    if (map && bounds) map.fitBounds(bounds, { animate: true, padding: [30, 30] });
  };

  const rootClassName = [
    'map-canvas',
    addMode ? 'is-adding' : '',
    disabled ? 'is-disabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={rootClassName} aria-label={ariaLabel}>
      <div ref={containerRef} className="map-canvas__leaflet" data-testid="map-canvas" />

      <div className="map-canvas__controls" role="group" aria-label="Kartenzoom">
        <button
          type="button"
          className="map-canvas__control"
          aria-label="Vergrößern"
          title="Vergrößern"
          onClick={() => mapRef.current?.zoomIn(0.5)}
        >
          <Plus size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="map-canvas__control"
          aria-label="Verkleinern"
          title="Verkleinern"
          onClick={() => mapRef.current?.zoomOut(0.5)}
        >
          <Minus size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
        <span className="map-canvas__control-divider" aria-hidden="true" />
        <button
          type="button"
          className="map-canvas__control"
          aria-label="Gesamte Karte anzeigen"
          title="Gesamte Karte anzeigen"
          onClick={resetView}
        >
          <LocateFixed size={17} strokeWidth={1.9} aria-hidden="true" />
        </button>
      </div>

      {addMode && backgroundUrl ? (
        <div className="map-canvas__mode-hint" aria-live="polite">
          Klicken Sie auf die Karte, um einen Punkt hinzuzufügen
        </div>
      ) : null}

      {!backgroundUrl ? (
        <div className="map-canvas__empty" role="status">
          <span className="map-canvas__empty-icon" aria-hidden="true">
            <LocateFixed size={22} strokeWidth={1.6} />
          </span>
          <strong>Noch keine Karte geladen</strong>
          <span>Fügen Sie in der Medienverwaltung ein Hintergrundbild hinzu</span>
        </div>
      ) : null}
    </section>
  );
}
