import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { LocateFixed, Minus, Palette, Plus } from 'lucide-react';
import {
  categoryIconScale,
  categoryIconContentScale,
  categoryIconBackgroundColor,
  categoryColorizeIcon,
  categoryImageMaskRadius,
  categoryMarkerStyle,
  categoryOutlineColor,
  categoryOutlineEnabled,
  categoryOutlineWidth,
  categoryShadowBlur,
  categoryShadowColor,
  categoryShadowEnabled,
  categoryShadowOpacity,
  type MapCategory,
  type MapItem,
  type MarkerStyle,
} from '../domain/models';
import { getCategoryIconUrl } from './CategoryIcon';
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

export interface MapFocusRequest {
  requestId: number;
  position: NormalizedPosition;
}

export interface MapCanvasProps {
  backgroundUrl: string | null;
  backgroundWidth: number;
  backgroundHeight: number;
  backgroundColor?: string;
  items: readonly MapItem[];
  categories: readonly MapCategory[];
  selectedItemId?: string | null;
  addMode?: boolean;
  disabled?: boolean;
  focusRequest?: MapFocusRequest | null;
  className?: string;
  ariaLabel?: string;
  getItemIconUrl?: (item: MapItem, category: MapCategory | undefined) => string | null | undefined;
  onSelect?: (itemId: string | null) => void;
  onAdd?: (position: NormalizedPosition) => void;
  onMove?: (itemId: string, position: NormalizedPosition) => void;
  onDragPreview?: (itemId: string, position: NormalizedPosition) => void;
  onBackgroundColorChange?: (color: string) => void;
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

export function canDragMarker(
  itemId: string,
  selectedItemId: string | null | undefined,
  disabled: boolean,
): boolean {
  return !disabled && itemId === selectedItemId;
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

export function markerVisualMetrics(markerStyle: MarkerStyle, iconScale: number) {
  const baseWidth = markerStyle === 'image' ? 72.6 : markerStyle === 'pin' ? 52 : 49.5
  const baseHeight = markerStyle === 'pin' ? 68 : baseWidth
  return {
    bodyWidth: baseWidth * iconScale,
    bodyHeight: baseHeight * iconScale,
    iconWidth: baseWidth * iconScale,
    iconHeight: baseHeight * iconScale,
  }
}

export function markerIconAnchor(
  markerStyle: MarkerStyle,
  iconWidth: number,
  iconHeight: number,
): [number, number] {
  return markerStyle === 'pin'
    ? [iconWidth / 2, iconHeight]
    : [iconWidth / 2, iconHeight / 2]
}

export function imageMaskRadiusToCssRadius(value: number): string {
  const normalized = Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100
  return `${normalized / 2}%`
}

export function markerShadowColor(color: string, opacity: number, enabled = true): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color)
  const [red, green, blue] = match
    ? [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)]
    : [0, 0, 0]
  const alpha = enabled ? Math.min(100, Math.max(0, opacity)) / 100 : 0
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function resolveMarkerIconUrl(iconUrl: string | null | undefined, categoryType: string): string {
  return iconUrl ?? getCategoryIconUrl(categoryType)
}

function markerOutlineFilterId(markerId: string): string {
  let hash = 2166136261
  for (let index = 0; index < markerId.length; index += 1) {
    hash ^= markerId.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `map-canvas-marker-outline-${(hash >>> 0).toString(36)}`
}

function effectiveMarkerCategory(item: MapItem, category: MapCategory | undefined): MapCategory | undefined {
  return category ? {
    ...category,
    ...item.markerOverrides,
    color: item.markerOverrides?.color ?? item.colorOverride ?? category.color,
  } : undefined
}

function createMarkerIcon(
  item: MapItem,
  category: MapCategory | undefined,
  selected: boolean,
  iconUrl: string | null | undefined,
): L.DivIcon {
  const isAnimal = item.type === 'animal'
  const effectiveCategory = effectiveMarkerCategory(item, category)
  const markerStyle: MarkerStyle = effectiveCategory ? categoryMarkerStyle(effectiveCategory) : isAnimal ? 'image' : 'circle'
  const iconScale = effectiveCategory ? categoryIconScale(effectiveCategory) : 1
  const iconContentScale = effectiveCategory ? categoryIconContentScale(effectiveCategory) : 1
  const imageMaskRadius = effectiveCategory ? categoryImageMaskRadius(effectiveCategory) : 100
  const iconBackgroundColor = effectiveCategory ? categoryIconBackgroundColor(effectiveCategory) : '#FFFFFF'
  const colorizeIcon = effectiveCategory ? categoryColorizeIcon(effectiveCategory) : false
  const outlineEnabled = effectiveCategory ? categoryOutlineEnabled(effectiveCategory) : false
  const outlineWidth = effectiveCategory ? categoryOutlineWidth(effectiveCategory) : 2
  const outlineColor = effectiveCategory ? categoryOutlineColor(effectiveCategory) : '#FF0000'
  const shadowEnabled = effectiveCategory ? categoryShadowEnabled(effectiveCategory) : true
  const shadowBlur = effectiveCategory ? categoryShadowBlur(effectiveCategory) : 10
  const shadowOpacity = effectiveCategory ? categoryShadowOpacity(effectiveCategory) : 22
  const shadowColor = effectiveCategory ? categoryShadowColor(effectiveCategory) : '#000000'
  const { bodyWidth, bodyHeight, iconWidth, iconHeight } = markerVisualMetrics(markerStyle, iconScale)
  const body = document.createElement('span');
  body.className = `map-canvas__marker ${isAnimal ? 'is-animal' : 'is-poi'} is-${markerStyle}${colorizeIcon ? ' is-colorized' : ''}${outlineEnabled ? ' has-outline' : ''}${selected ? ' is-selected' : ''}`;
  body.style.setProperty('--marker-color', safeMarkerColor(effectiveCategory?.color));
  body.style.setProperty('--marker-category-color', safeMarkerColor(effectiveCategory?.color));
  body.style.setProperty('--marker-width', `${bodyWidth}px`);
  body.style.setProperty('--marker-height', `${bodyHeight}px`);
  body.style.setProperty('--marker-content-scale', `${iconContentScale}`);
  body.style.setProperty('--marker-image-mask-radius', imageMaskRadiusToCssRadius(imageMaskRadius));
  body.style.setProperty('--marker-background-color', safeMarkerColor(iconBackgroundColor));
  body.style.setProperty('--marker-outline-width', `${outlineWidth}px`);
  body.style.setProperty('--marker-outline-color', safeMarkerColor(outlineColor));
  body.style.setProperty('--marker-shadow-blur', `${shadowBlur}px`);
  body.style.setProperty('--marker-shadow-offset', `${shadowBlur * 0.6}px`);
  body.style.setProperty('--marker-shadow-color', markerShadowColor(shadowColor, shadowOpacity, shadowEnabled));
  if (outlineEnabled && category) {
    body.style.setProperty('--marker-outline-filter', `url("#${markerOutlineFilterId(item.id)}")`);
  }
  body.setAttribute('aria-hidden', 'true');

  let contentHost: HTMLElement = body;
  if (markerStyle === 'pin') {
    const pinBackground = document.createElement('span');
    pinBackground.className = 'map-canvas__pin-background';
    body.append(pinBackground);

    const pinShape = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pinShape.classList.add('map-canvas__pin-shape');
    pinShape.setAttribute('viewBox', '0 0 52 68');
    pinShape.setAttribute('preserveAspectRatio', 'none');
    const pinPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pinPath.setAttribute('d', 'M26 66C22 58 4 43 4 27C4 14.3 13.8 4 26 4S48 14.3 48 27C48 43 30 58 26 66Z');
    pinShape.append(pinPath);
    body.append(pinShape);

    const pinContent = document.createElement('span');
    pinContent.className = 'map-canvas__pin-content';
    body.append(pinContent);
    contentHost = pinContent;
  }

  const resolvedIconUrl = resolveMarkerIconUrl(iconUrl, effectiveCategory?.type ?? item.type)
  if (resolvedIconUrl) {
    if (colorizeIcon) {
      const mask = document.createElement('span');
      mask.className = 'map-canvas__marker-mask is-colorized';
      mask.style.setProperty('-webkit-mask-image', `url("${resolvedIconUrl}")`);
      mask.style.setProperty('mask-image', `url("${resolvedIconUrl}")`);
      if (isAnimal && markerStyle === 'circle') {
        const clip = document.createElement('span');
        clip.className = 'map-canvas__marker-image-clip';
        clip.append(mask);
        body.append(clip);
      } else {
        contentHost.append(mask);
      }
    } else if (isAnimal && item.iconAssetId) {
      const image = document.createElement('img');
      image.className = 'map-canvas__marker-image';
      image.src = resolvedIconUrl;
      image.alt = '';
      image.draggable = false;
      if (markerStyle === 'circle') {
        const clip = document.createElement('span');
        clip.className = 'map-canvas__marker-image-clip';
        clip.append(image);
        body.append(clip);
      } else {
        contentHost.append(image);
      }
    } else {
      const mask = document.createElement('span');
      mask.className = 'map-canvas__marker-mask';
      mask.style.setProperty('-webkit-mask-image', `url("${resolvedIconUrl}")`);
      mask.style.setProperty('mask-image', `url("${resolvedIconUrl}")`);
      contentHost.append(mask);
    }
  }

  return L.divIcon({
    className: 'map-canvas__marker-icon',
    html: body,
    iconSize: [iconWidth, iconHeight],
    iconAnchor: markerIconAnchor(markerStyle, iconWidth, iconHeight),
    tooltipAnchor: [0, -(iconHeight * 0.64)],
  });
}

function categorySignature(category: MapCategory | undefined): string {
  return category ? [
    category.id,
    category.color,
    category.visible,
    categoryMarkerStyle(category),
    categoryIconScale(category),
    categoryIconContentScale(category),
    categoryIconBackgroundColor(category),
    categoryColorizeIcon(category),
    categoryImageMaskRadius(category),
    categoryOutlineEnabled(category),
    categoryOutlineWidth(category),
    categoryOutlineColor(category),
    categoryShadowEnabled(category),
    categoryShadowBlur(category),
    categoryShadowOpacity(category),
    categoryShadowColor(category),
  ].join(':') : 'missing';
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
  backgroundColor = '#DDDDDD',
  items,
  categories,
  selectedItemId = null,
  addMode = false,
  disabled = false,
  focusRequest = null,
  className,
  ariaLabel = 'Interaktive Zoo-Karte',
  getItemIconUrl,
  onSelect,
  onAdd,
  onMove,
  onDragPreview,
  onBackgroundColorChange,
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
      doubleClickZoom: false,
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
      const isDraggable = canDragMarker(item.id, selectedItemId, disabled);
      const signature = [
        item.title,
        item.iconAssetId ?? '',
        item.colorOverride ?? '',
        JSON.stringify(item.markerOverrides ?? null),
        categorySignature(category),
        iconUrl ?? '',
        isSelected ? 'selected' : '',
      ].join('|');

      let marker = markersRef.current.get(item.id);
      if (!marker) {
        marker = L.marker(positionToLatLng(item.position, width, height), {
          draggable: isDraggable,
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
      if (isDraggable) marker.dragging?.enable();
      else marker.dragging?.disable();

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRequest) return;

    map.panTo(
      positionToLatLng(
        focusRequest.position,
        safeDimension(backgroundWidth),
        safeDimension(backgroundHeight),
      ),
      {
        animate: true,
        duration: 0.4,
        easeLinearity: 0.25,
      },
    );
  }, [backgroundHeight, backgroundWidth, focusRequest]);

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
    <section
      className={rootClassName}
      aria-label={ariaLabel}
      style={{ backgroundColor }}
    >
      <svg
        className="map-canvas__filter-definitions"
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <filter
            id="map-canvas-marker-selection-outline"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius="3"
              result="expanded"
            />
            <feFlood floodColor="#f59e0b" result="outlineColor" />
            <feComposite
              in="outlineColor"
              in2="expanded"
              operator="in"
              result="expandedColor"
            />
            <feComposite
              in="expandedColor"
              in2="SourceAlpha"
              operator="out"
              result="outline"
            />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {items.map((item) => {
            const effectiveCategory = effectiveMarkerCategory(item, categoriesById.get(item.categoryId))
            if (!effectiveCategory || !categoryOutlineEnabled(effectiveCategory)) return null
            return (
            <filter
              key={item.id}
              id={markerOutlineFilterId(item.id)}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
              colorInterpolationFilters="sRGB"
            >
              <feMorphology
                in="SourceAlpha"
                operator="dilate"
                radius={categoryOutlineWidth(effectiveCategory)}
                result="expanded"
              />
              <feFlood floodColor={categoryOutlineColor(effectiveCategory)} result="outlineColor" />
              <feComposite
                in="outlineColor"
                in2="expanded"
                operator="in"
                result="expandedColor"
              />
              <feComposite
                in="expandedColor"
                in2="SourceAlpha"
                operator="out"
                result="outline"
              />
              <feMerge>
                <feMergeNode in="outline" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            )
          })}
        </defs>
      </svg>

      <div
        ref={containerRef}
        className="map-canvas__leaflet"
        data-testid="map-canvas"
        style={{ backgroundColor }}
      />

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

      <label className="map-canvas__background-color-control">
        <Palette size={16} strokeWidth={1.8} aria-hidden="true" />
        <span>Hintergrund</span>
        <input
          type="color"
          value={backgroundColor}
          aria-label="Hintergrundfarbe der Karte"
          title="Hintergrundfarbe der Karte"
          onChange={(event) => onBackgroundColorChange?.(event.target.value)}
        />
      </label>

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
