import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { CalendarClock, LocateFixed, Minus, Monitor, Palette, Plus, Settings2, Smartphone, X } from 'lucide-react';
import {
  DEFAULT_MAP_SETTINGS,
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
  type MapEvent,
  type MapFact,
  type MapItem,
  type MapSettings,
  type MarkerStyle,
} from '../domain/models';
import { AVAILABLE_LOCALES, localizeCategory, localizeEvent, localizeItem, localeName, translationCompletion } from '../domain/localization';
import { getCategoryIconUrl } from './CategoryIcon';
import { PhoneClientPreview } from './PhoneClientPreview';
import { nextVisibleEventOccurrence, PhoneEventPanel } from './PhoneEventPanel';
import { PhoneMapSearch } from './PhoneMapSearch';
import { visitorCopy } from './visitor-i18n';
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
  mapSettings?: MapSettings;
  items: readonly MapItem[];
  categories: readonly MapCategory[];
  events?: readonly MapEvent[];
  defaultLocale?: string;
  enabledLocales?: readonly string[];
  selectedItemId?: string | null;
  addMode?: boolean;
  disabled?: boolean;
  focusRequest?: MapFocusRequest | null;
  phonePreviewRequest?: number;
  className?: string;
  ariaLabel?: string;
  getItemIconUrl?: (item: MapItem, category: MapCategory | undefined) => string | null | undefined;
  getItemImageUrl?: (item: MapItem) => string | null | undefined;
  getItemImageUrls?: (item: MapItem) => string[];
  getFactIconUrl?: (fact: MapFact, item: MapItem) => string | null | undefined;
  onSelect?: (itemId: string | null) => void;
  onAdd?: (position: NormalizedPosition) => void;
  onMove?: (itemId: string, position: NormalizedPosition) => void;
  onDragPreview?: (itemId: string, position: NormalizedPosition) => void;
  onBackgroundColorChange?: (color: string) => void;
  onMapSettingsChange?: (patch: Partial<MapSettings>) => void;
  onLanguagesChange?: (defaultLocale: string, enabledLocales: string[]) => void;
  onSettingsEditStart?: () => void;
  onSettingsEditEnd?: () => void;
}

const DEFAULT_MARKER_COLOR = '#315f4b';
const DEFAULT_DIMENSION = 1;
const DEFAULT_VIEW_SETTINGS: MapSettings = { ...DEFAULT_MAP_SETTINGS };

export function mapViewSettingsForMode(phonePreview: boolean, settings: MapSettings): MapSettings {
  return phonePreview ? settings : DEFAULT_VIEW_SETTINGS;
}

export function zoomLimitsForFit(fitZoom: number, settings: Pick<MapSettings, 'minZoomScale' | 'maxZoomScale'>): { minZoom: number; maxZoom: number } {
  const minZoom = fitZoom + Math.log2(settings.minZoomScale);
  const maxZoom = fitZoom + Math.log2(settings.maxZoomScale);
  return { minZoom, maxZoom: Math.max(minZoom, maxZoom) };
}

export function relativeZoomScale(zoom: number, fitZoom: number): number {
  return 2 ** (zoom - fitZoom);
}

export function zoomForRelativeScale(fitZoom: number, scale: number): number {
  return fitZoom + Math.log2(scale);
}

export function unconstrainedFitZoom(
  map: L.Map,
  imageBounds: L.LatLngBounds,
  padding: [number, number],
): number {
  const currentZoom = map.getZoom();
  const referenceZoom = Number.isFinite(currentZoom) ? currentZoom : 0;
  const projectedBounds = L.bounds(
    map.project(imageBounds.getNorthWest(), referenceZoom),
    map.project(imageBounds.getSouthEast(), referenceZoom),
  );
  const boundsSize = projectedBounds.getSize();
  const viewportSize = map.getSize().subtract(L.point(padding[0], padding[1]));
  if (boundsSize.x <= 0 || boundsSize.y <= 0 || viewportSize.x <= 0 || viewportSize.y <= 0) {
    return referenceZoom;
  }
  const scale = Math.min(viewportSize.x / boundsSize.x, viewportSize.y / boundsSize.y);
  return map.getScaleZoom(scale, referenceZoom);
}

export function navigationLimitPoints(
  width: number,
  height: number,
  settings: Pick<MapSettings, 'navigationPaddingX' | 'navigationPaddingY'>,
): { southWest: [number, number]; northEast: [number, number] } {
  const horizontal = width * settings.navigationPaddingX;
  const vertical = height * settings.navigationPaddingY;
  return {
    southWest: [-vertical, -horizontal],
    northEast: [height + vertical, width + horizontal],
  };
}

export function navigationPreviewPoint(
  width: number,
  height: number,
  settings: Pick<MapSettings, 'navigationPaddingX' | 'navigationPaddingY'>,
  axis: 'horizontal' | 'vertical',
): { lat: number; lng: number } {
  const limits = navigationLimitPoints(width, height, settings);
  return axis === 'horizontal'
    ? { lat: height / 2, lng: limits.northEast[1] }
    : { lat: limits.northEast[0], lng: width / 2 };
}

export function clampFocusCenter(
  map: Pick<L.Map, 'project' | 'unproject' | 'getSize'>,
  target: L.LatLngExpression,
  zoom: number,
  bounds: L.LatLngBounds,
): L.LatLng {
  const targetPoint = map.project(L.latLng(target), zoom)
  const northWest = map.project(bounds.getNorthWest(), zoom)
  const southEast = map.project(bounds.getSouthEast(), zoom)
  const min = L.point(Math.min(northWest.x, southEast.x), Math.min(northWest.y, southEast.y))
  const max = L.point(Math.max(northWest.x, southEast.x), Math.max(northWest.y, southEast.y))
  const halfViewport = map.getSize().divideBy(2)

  const clampAxis = (value: number, lower: number, upper: number) => (
    lower <= upper ? Math.min(upper, Math.max(lower, value)) : (lower + upper) / 2
  )

  return map.unproject(L.point(
    clampAxis(targetPoint.x, min.x + halfViewport.x, max.x - halfViewport.x),
    clampAxis(targetPoint.y, min.y + halfViewport.y, max.y - halfViewport.y),
  ), zoom)
}

export function quickPreviewWouldCoverPoint(
  point: Pick<L.Point, 'y'>,
  viewport: Pick<L.Point, 'y'>,
): boolean {
  const quickPreviewTop = viewport.y - 29 - 132
  const markerClearance = 36
  return point.y + markerClearance >= quickPreviewTop
}

function applyMapViewSettings(
  map: L.Map,
  imageBounds: L.LatLngBounds,
  width: number,
  height: number,
  settings: MapSettings,
  padding: [number, number],
): void {
  const limits = navigationLimitPoints(width, height, settings);
  map.setMaxBounds(L.latLngBounds(limits.southWest, limits.northEast));
  const fitZoom = unconstrainedFitZoom(map, imageBounds, padding);
  const { minZoom, maxZoom } = zoomLimitsForFit(fitZoom, settings);
  map.setMinZoom(minZoom);
  map.setMaxZoom(maxZoom);
  const currentZoom = map.getZoom();
  if (Number.isFinite(currentZoom) && (currentZoom < minZoom || currentZoom > maxZoom)) {
    map.setZoom(Math.min(maxZoom, Math.max(minZoom, currentZoom)), { animate: false });
  }
}

type MapSettingsPreview = 'minZoom' | 'maxZoom' | 'horizontal' | 'vertical';

export function previewMapSetting(
  map: L.Map,
  imageBounds: L.LatLngBounds,
  width: number,
  height: number,
  settings: MapSettings,
  padding: [number, number],
  preview: MapSettingsPreview,
): void {
  applyMapViewSettings(map, imageBounds, width, height, settings, padding);
  const fitZoom = unconstrainedFitZoom(map, imageBounds, padding);
  const { minZoom, maxZoom } = zoomLimitsForFit(fitZoom, settings);

  if (preview === 'minZoom' || preview === 'maxZoom') {
    map.setView(imageBounds.getCenter(), preview === 'minZoom' ? minZoom : maxZoom, { animate: false });
    return;
  }

  const previewZoom = Math.min(maxZoom, Math.max(minZoom, fitZoom));
  const target = navigationPreviewPoint(width, height, settings, preview);
  map.setView([target.lat, target.lng], previewZoom, { animate: false });
}

interface MapSettingsSliderProps {
  label: string;
  description: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  manualInput?: boolean;
  onChange: (value: number) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

function MapSettingsSlider({ label, description, value, displayValue, min, max, step, manualInput = false, onChange, onEditStart, onEditEnd }: MapSettingsSliderProps) {
  const [draftValue, setDraftValue] = useState(String(value));
  const manualEditingRef = useRef(false);

  useEffect(() => {
    if (!manualEditingRef.current) setDraftValue(String(value));
  }, [value]);

  const startManualEdit = () => {
    manualEditingRef.current = true;
    setDraftValue(String(value));
    onEditStart?.();
  };

  const finishManualEdit = () => {
    const parsedValue = Number(draftValue);
    const nextValue = Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : value;
    manualEditingRef.current = false;
    setDraftValue(String(nextValue));
    if (nextValue !== value) onChange(nextValue);
    onEditEnd?.();
  };

  return (
    <label className="map-global-settings__slider">
      <span>
        <strong>{label}</strong>
        {manualInput ? (
          <span className="map-global-settings__manual-value">
            <input
              type="number"
              aria-label={`${label}: Prozentwert`}
              step="any"
              value={draftValue}
              onFocus={startManualEdit}
              onChange={(event) => setDraftValue(event.target.value)}
              onBlur={finishManualEdit}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                event.currentTarget.blur();
              }}
            />
            <span>%</span>
          </span>
        ) : <output>{displayValue}</output>}
      </span>
      <small>{description}</small>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerDown={onEditStart}
        onPointerUp={onEditEnd}
        onPointerCancel={onEditEnd}
        onKeyDown={onEditStart}
        onKeyUp={onEditEnd}
      />
    </label>
  );
}

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
  phonePreview = false,
): boolean {
  return !disabled && !phonePreview && itemId === selectedItemId;
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

const PHONE_PREVIEW_MARKER_SCALE = 1

export function markerIconAnchor(
  markerStyle: MarkerStyle,
  iconWidth: number,
  iconHeight: number,
): [number, number] {
  return markerStyle === 'pin'
    ? [iconWidth / 2, iconHeight]
    : [iconWidth / 2, iconHeight / 2]
}

export function markerTooltipAnchor(markerStyle: MarkerStyle, iconHeight: number): [number, number] {
  return [0, markerStyle === 'pin' ? -iconHeight : -(iconHeight / 2)]
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

export function mapBackgroundEffectsEnabled(
  settings: Pick<MapSettings, 'mapOutlineEnabled'>,
): boolean {
  return settings.mapOutlineEnabled
}

export function mapBackgroundClassName(
  settings: Pick<MapSettings, 'mapOutlineEnabled'>,
): string {
  return `map-canvas__background${mapBackgroundEffectsEnabled(settings) ? ' has-alpha-effects' : ''}`
}

export function scaledMapEffectValue(value: number, zoomScale: number): number {
  const safeScale = Number.isFinite(zoomScale) && zoomScale > 0 ? zoomScale : 1
  return value * safeScale
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
  phonePreview = false,
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
  const previewScale = phonePreview ? PHONE_PREVIEW_MARKER_SCALE : 1
  const { bodyWidth, bodyHeight, iconWidth, iconHeight } = markerVisualMetrics(markerStyle, iconScale * previewScale)
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
    tooltipAnchor: markerTooltipAnchor(markerStyle, iconHeight),
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
  mapSettings = DEFAULT_VIEW_SETTINGS,
  items: sourceItems,
  categories: sourceCategories,
  events: sourceEvents = [],
  defaultLocale = 'de',
  enabledLocales = ['de'],
  selectedItemId = null,
  addMode = false,
  disabled = false,
  focusRequest = null,
  phonePreviewRequest = 0,
  className,
  ariaLabel = 'Interaktive Zoo-Karte',
  getItemIconUrl,
  getItemImageUrl,
  getItemImageUrls,
  getFactIconUrl,
  onSelect,
  onAdd,
  onMove,
  onDragPreview,
  onBackgroundColorChange,
  onMapSettingsChange,
  onLanguagesChange,
  onSettingsEditStart,
  onSettingsEditEnd,
}: MapCanvasProps) {
  const [phonePreview, setPhonePreview] = useState(false);
  const [clientPreviewItemId, setClientPreviewItemId] = useState<string | null>(null);
  const [clientDetailsOpen, setClientDetailsOpen] = useState(false);
  const [clientEventsOpen, setClientEventsOpen] = useState(false);
  const [eventClock, setEventClock] = useState(() => new Date());
  const [globalSettingsOpen, setGlobalSettingsOpen] = useState(false);
  const [visitorLocale, setVisitorLocale] = useState(defaultLocale);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [hiddenVisitorCategoryIds, setHiddenVisitorCategoryIds] = useState<Set<string>>(() => new Set());
  const [mapEffectZoomScale, setMapEffectZoomScale] = useState(() => mapSettings.minZoomScale);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const globalSettingsRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const boundsRef = useRef<L.LatLngBounds | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const markerSignaturesRef = useRef(new Map<string, string>());
  const navigationPreviewOriginRef = useRef<{ center: L.LatLng; zoom: number } | null>(null);
  const viewportTransitionRef = useRef<{ center: L.LatLng; zoomScale: number } | null>(null);
  const settingsPreviewRef = useRef<MapSettingsPreview | null>(null);
  const mapEffectZoomRef = useRef<number | null>(null);
  const visitorLocaleInitializedRef = useRef(false);
  const renderLocale = phonePreview ? visitorLocale : defaultLocale;
  const categories = useMemo(() => sourceCategories.map((category) => localizeCategory(category, renderLocale, defaultLocale)), [defaultLocale, renderLocale, sourceCategories]);
  const items = useMemo(() => sourceItems.map((item) => localizeItem(item, renderLocale, defaultLocale)), [defaultLocale, renderLocale, sourceItems]);
  const events = useMemo(() => sourceEvents.map((event) => localizeEvent(event, renderLocale, defaultLocale)), [defaultLocale, renderLocale, sourceEvents]);
  const clientCopy = visitorCopy(visitorLocale);

  useEffect(() => {
    if (!visitorLocaleInitializedRef.current) {
      visitorLocaleInitializedRef.current = true;
      const queryLocale = new URLSearchParams(window.location.search).get('lang');
      const saved = window.localStorage.getItem('zooweb-map-locale');
      const browserLocale = navigator.language.split('-')[0];
      const detected = [queryLocale, saved, browserLocale, defaultLocale].find((locale) => locale && enabledLocales.includes(locale));
      if (detected) setVisitorLocale(detected);
      return;
    }
    if (!enabledLocales.includes(visitorLocale)) setVisitorLocale(defaultLocale);
  }, [defaultLocale, enabledLocales, visitorLocale]);

  const chooseVisitorLocale = (locale: string) => {
    setVisitorLocale(locale);
    window.localStorage.setItem('zooweb-map-locale', locale);
    setLanguageMenuOpen(false);
  };

  const syncMapEffectZoomScale = () => {
    const map = mapRef.current
    if (!map) return
    const nextZoom = map.getZoom()
    const previousZoom = mapEffectZoomRef.current
    mapEffectZoomRef.current = nextZoom
    if (previousZoom === null || !Number.isFinite(previousZoom) || !Number.isFinite(nextZoom)) return
    const zoomDeltaScale = 2 ** (nextZoom - previousZoom)
    setMapEffectZoomScale((currentScale) => (
      Math.abs(zoomDeltaScale - 1) < 0.001 ? currentScale : currentScale * zoomDeltaScale
    ))
  }

  const captureViewportTransition = () => {
    const map = mapRef.current;
    const bounds = boundsRef.current;
    if (!map || !bounds) return;
    const currentZoom = map.getZoom();
    if (!Number.isFinite(currentZoom)) {
      viewportTransitionRef.current = null;
      return;
    }
    const fitZoom = unconstrainedFitZoom(map, bounds, phonePreview ? [14, 14] : [30, 30]);
    viewportTransitionRef.current = {
      center: map.getCenter(),
      zoomScale: relativeZoomScale(currentZoom, fitZoom),
    };
  };

  useEffect(() => {
    if (phonePreviewRequest <= 0) return;
    if (!phonePreview) captureViewportTransition();
    setPhonePreview(true);
    setClientPreviewItemId(null);
    setClientDetailsOpen(false);
    setClientEventsOpen(true);
    setEventClock(new Date());
  }, [phonePreviewRequest]);
  const draggingItemRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onSelect, onAdd, onMove, onDragPreview });
  const stateRef = useRef({
    addMode,
    disabled,
    phonePreview,
    hasBackground: Boolean(backgroundUrl),
    width: safeDimension(backgroundWidth),
    height: safeDimension(backgroundHeight),
    mapSettings,
  });

  callbacksRef.current = { onSelect, onAdd, onMove, onDragPreview };
  stateRef.current = {
    addMode,
    disabled,
    phonePreview,
    hasBackground: Boolean(backgroundUrl),
    width: safeDimension(backgroundWidth),
    height: safeDimension(backgroundHeight),
    mapSettings,
  };

  useEffect(() => {
    if (!globalSettingsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!globalSettingsRef.current?.contains(event.target as Node)) setGlobalSettingsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGlobalSettingsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [globalSettingsOpen]);

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
      minZoom: -10,
      maxZoom: 10,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 90,
      // Keep navigation limits resistant but elastic so the map gently returns
      // to the allowed area instead of stopping abruptly at the boundary.
      maxBoundsViscosity: 0.65,
    });
    mapRef.current = map;

    map.on('click', (event: L.LeafletMouseEvent) => {
      const current = stateRef.current;
      if (current.phonePreview) {
        setClientPreviewItemId(null);
        setClientDetailsOpen(false);
        setClientEventsOpen(false);
        return;
      }
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
    map.on('zoomend resize', syncMapEffectZoomScale)

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            map.invalidateSize({ pan: false });
            const bounds = boundsRef.current;
            const current = stateRef.current;
            if (bounds) {
              applyMapViewSettings(
                map,
                bounds,
                current.width,
                current.height,
                mapViewSettingsForMode(current.phonePreview, current.mapSettings),
                current.phonePreview ? [14, 14] : [30, 30],
              );
            }
          });
    resizeObserver?.observe(container);

    return () => {
      map.off('zoomend resize', syncMapEffectZoomScale)
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
    const current = stateRef.current;
    applyMapViewSettings(
      map,
      bounds,
      width,
      height,
      mapViewSettingsForMode(current.phonePreview, current.mapSettings),
      current.phonePreview ? [14, 14] : [30, 30],
    );

    if (backgroundUrl) {
      overlayRef.current = L.imageOverlay(backgroundUrl, bounds, {
        interactive: false,
        className: mapBackgroundClassName(current.mapSettings),
      }).addTo(map);
    }

    const frame = requestAnimationFrame(() => {
      map.invalidateSize({ pan: false });
      const next = stateRef.current;
      applyMapViewSettings(
        map,
        bounds,
        width,
        height,
        mapViewSettingsForMode(next.phonePreview, next.mapSettings),
        next.phonePreview ? [14, 14] : [30, 30],
      );
      map.fitBounds(bounds, { animate: false, padding: next.phonePreview ? [14, 14] : [30, 30] });
      mapEffectZoomRef.current = map.getZoom()
      setMapEffectZoomScale(next.mapSettings.minZoomScale)
    });
    return () => cancelAnimationFrame(frame);
  }, [backgroundHeight, backgroundUrl, backgroundWidth]);

  useEffect(() => {
    const backgroundElement = overlayRef.current?.getElement()
    if (!backgroundElement) return
    backgroundElement.classList.toggle(
      'has-alpha-effects',
      mapBackgroundEffectsEnabled(mapSettings),
    )
  }, [
    backgroundHeight,
    backgroundUrl,
    backgroundWidth,
    mapSettings.mapOutlineEnabled,
  ])

  useEffect(() => {
    const map = mapRef.current;
    const bounds = boundsRef.current;
    if (!map || !bounds) return;
    map.invalidateSize({ pan: false });
    applyMapViewSettings(
      map,
      bounds,
      safeDimension(backgroundWidth),
      safeDimension(backgroundHeight),
      mapViewSettingsForMode(phonePreview, mapSettings),
      phonePreview ? [14, 14] : [30, 30],
    );
    const settingsPreview = settingsPreviewRef.current;
    if (phonePreview && settingsPreview) {
      previewMapSetting(
        map,
        bounds,
        safeDimension(backgroundWidth),
        safeDimension(backgroundHeight),
        mapSettings,
        [14, 14],
        settingsPreview,
      );
    }
  }, [backgroundHeight, backgroundWidth, mapSettings, phonePreview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const width = safeDimension(backgroundWidth);
    const height = safeDimension(backgroundHeight);
    const renderedItemIds = new Set<string>();

    for (const item of items) {
      const category = categoriesById.get(item.categoryId);
      if (!item.visible || (category && !category.visible) || (phonePreview && hiddenVisitorCategoryIds.has(item.categoryId))) continue;
      renderedItemIds.add(item.id);

      const iconUrl = getItemIconUrl?.(item, category);
      const isSelected = !phonePreview && item.id === selectedItemId;
      const isDraggable = canDragMarker(item.id, selectedItemId, disabled, phonePreview);
      const signature = [
        item.title,
        item.iconAssetId ?? '',
        item.colorOverride ?? '',
        JSON.stringify(item.markerOverrides ?? null),
        categorySignature(category),
        iconUrl ?? '',
        isSelected ? 'selected' : '',
        phonePreview ? 'phone-preview' : 'desktop',
      ].join('|');

      let marker = markersRef.current.get(item.id);
      if (!marker) {
        marker = L.marker(positionToLatLng(item.position, width, height), {
          draggable: isDraggable,
          keyboard: true,
          riseOnHover: true,
          title: item.title,
          alt: item.title,
          icon: createMarkerIcon(item, category, isSelected, iconUrl, phonePreview),
        })
          .bindTooltip(createTooltipContent(item.title), {
            className: 'map-canvas__point-tooltip',
            direction: 'top',
            offset: [0, 0],
            opacity: 0.92,
          })
          .addTo(map);

        marker.on('click', () => {
          if (stateRef.current.phonePreview) {
            callbacksRef.current.onSelect?.(item.id);
            setClientPreviewItemId(item.id);
            setClientDetailsOpen(false);
            setClientEventsOpen(false);
            return;
          }
          callbacksRef.current.onSelect?.(item.id);
        });
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
        marker.setIcon(createMarkerIcon(item, category, isSelected, iconUrl, phonePreview));
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
    hiddenVisitorCategoryIds,
    items,
    phonePreview,
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

  useEffect(() => {
    mapEffectZoomRef.current = null
    setMapEffectZoomScale(mapSettings.minZoomScale)
    const frame = requestAnimationFrame(() => {
      const map = mapRef.current;
      const bounds = boundsRef.current;
      if (!map) return;
      map.invalidateSize({ pan: false });
      if (bounds) {
        applyMapViewSettings(
          map,
          bounds,
          safeDimension(backgroundWidth),
          safeDimension(backgroundHeight),
          mapViewSettingsForMode(phonePreview, mapSettings),
          phonePreview ? [14, 14] : [30, 30],
        );
        const settingsPreview = settingsPreviewRef.current;
        const transition = viewportTransitionRef.current;
        if (phonePreview && settingsPreview) {
          previewMapSetting(
            map,
            bounds,
            safeDimension(backgroundWidth),
            safeDimension(backgroundHeight),
            mapSettings,
            [14, 14],
            settingsPreview,
          );
          viewportTransitionRef.current = null;
        } else if (transition) {
          const fitZoom = unconstrainedFitZoom(map, bounds, phonePreview ? [14, 14] : [30, 30]);
          const targetZoom = zoomForRelativeScale(fitZoom, transition.zoomScale);
          map.setView(
            transition.center,
            Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), targetZoom)),
            { animate: false },
          );
          viewportTransitionRef.current = null;
        } else {
          map.fitBounds(bounds, {
            animate: false,
            padding: phonePreview ? [14, 14] : [30, 30],
          });
        }
        mapEffectZoomRef.current = map.getZoom()
        setMapEffectZoomScale(mapSettings.minZoomScale)
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [backgroundHeight, backgroundWidth, phonePreview]);

  useEffect(() => {
    if (phonePreview) return;
    setClientPreviewItemId(null);
    setClientDetailsOpen(false);
    setClientEventsOpen(false);
  }, [phonePreview]);

  useEffect(() => {
    if (!phonePreview) return;
    setEventClock(new Date());
    const timer = window.setInterval(() => setEventClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [phonePreview]);

  const resetView = () => {
    const map = mapRef.current;
    const bounds = boundsRef.current;
    if (map && bounds) map.fitBounds(bounds, { animate: true, padding: phonePreview ? [14, 14] : [30, 30] });
  };

  const updateMapSettingWithPreview = (
    patch: Partial<MapSettings>,
    preview: MapSettingsPreview,
  ) => {
    settingsPreviewRef.current = preview;
    const nextSettings = { ...mapSettings, ...patch };
    onMapSettingsChange?.(patch);

    if (!phonePreview) {
      viewportTransitionRef.current = null;
      setPhonePreview(true);
      return;
    }

    const map = mapRef.current;
    const bounds = boundsRef.current;
    if (!map || !bounds) return;
    previewMapSetting(
      map,
      bounds,
      safeDimension(backgroundWidth),
      safeDimension(backgroundHeight),
      nextSettings,
      [14, 14],
      preview,
    );
  };

  const beginMapSettingsEdit = (preview: MapSettingsPreview) => {
    settingsPreviewRef.current = preview;
    if (!phonePreview) {
      viewportTransitionRef.current = null;
      setPhonePreview(true);
    }
    onSettingsEditStart?.();
  };

  const endMapSettingsEdit = () => {
    settingsPreviewRef.current = null;
    onSettingsEditEnd?.();
  };

  const beginNavigationSettingsEdit = (preview: 'horizontal' | 'vertical') => {
    settingsPreviewRef.current = preview;
    const map = mapRef.current;
    const currentZoom = map?.getZoom();
    if (phonePreview && map && Number.isFinite(currentZoom) && !navigationPreviewOriginRef.current) {
      navigationPreviewOriginRef.current = {
        center: map.getCenter(),
        zoom: currentZoom!,
      };
    }
    if (!phonePreview) {
      viewportTransitionRef.current = null;
      navigationPreviewOriginRef.current = null;
      setPhonePreview(true);
    }
    onSettingsEditStart?.();
  };

  const endNavigationSettingsEdit = () => {
    settingsPreviewRef.current = null;
    const map = mapRef.current;
    const origin = navigationPreviewOriginRef.current;
    navigationPreviewOriginRef.current = null;

    if (map && origin) {
      const restoredZoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), origin.zoom));
      map.setView(origin.center, restoredZoom, { animate: false });
    }
    onSettingsEditEnd?.();
  };

  const rootClassName = [
    'map-canvas',
    addMode ? 'is-adding' : '',
    disabled ? 'is-disabled' : '',
    phonePreview ? 'is-phone-preview' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const clientPreviewItem = phonePreview
    ? items.find((item) => item.id === clientPreviewItemId) ?? null
    : null;
  const clientPreviewCategory = clientPreviewItem
    ? categoriesById.get(clientPreviewItem.categoryId)
    : undefined;
  const clientPreviewIconUrl = clientPreviewItem
    ? resolveMarkerIconUrl(
        getItemIconUrl?.(clientPreviewItem, clientPreviewCategory),
        clientPreviewCategory?.type ?? clientPreviewItem.type,
      )
    : null;

  useEffect(() => {
    if (!clientPreviewItem || !hiddenVisitorCategoryIds.has(clientPreviewItem.categoryId)) return
    setClientPreviewItemId(null)
    setClientDetailsOpen(false)
  }, [clientPreviewItem, hiddenVisitorCategoryIds])

  const nextEventOccurrence = useMemo(
    () => nextVisibleEventOccurrence(events, eventClock),
    [eventClock, events],
  );

  const focusClientItem = (itemId: string, suppressCoveredPreview = false) => {
    const item = items.find((candidate) => candidate.id === itemId);
    const map = mapRef.current;
    if (!item || !map) return;

    const target = positionToLatLng(
      item.position,
      safeDimension(backgroundWidth),
      safeDimension(backgroundHeight),
    );
    const fitZoom = boundsRef.current ? map.getBoundsZoom(boundsRef.current) : map.getZoom();
    const destinationZoom = Math.min(map.getMaxZoom(), Math.max(map.getZoom(), fitZoom + 1.35));
    const limits = navigationLimitPoints(
      safeDimension(backgroundWidth),
      safeDimension(backgroundHeight),
      mapViewSettingsForMode(phonePreview, mapSettings),
    );
    const destination = clampFocusCenter(
      map,
      target,
      destinationZoom,
      L.latLngBounds(limits.southWest, limits.northEast),
    );
    const targetScreenPoint = map.project(target, destinationZoom)
      .subtract(map.project(destination, destinationZoom))
      .add(map.getSize().divideBy(2));
    map.flyTo(destination, destinationZoom, { animate: true, duration: 0.55, easeLinearity: 0.25 });
    callbacksRef.current.onSelect?.(item.id);
    setClientEventsOpen(false);
    setClientPreviewItemId(suppressCoveredPreview && quickPreviewWouldCoverPoint(targetScreenPoint, map.getSize()) ? null : item.id);
    setClientDetailsOpen(false);
  };

  return (
    <section
      className={rootClassName}
      aria-label={ariaLabel}
      style={{ backgroundColor: phonePreview ? '#D9DFDC' : backgroundColor }}
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
            id="map-canvas-background-alpha-effects"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={scaledMapEffectValue(mapSettings.mapOutlineWidth, mapEffectZoomScale)}
              result="mapExpandedAlpha"
            />
            <feComposite
              in="mapExpandedAlpha"
              in2="SourceAlpha"
              operator="out"
              result="mapOutlineAlpha"
            />
            <feFlood floodColor={mapSettings.mapOutlineColor} result="mapOutlineColor" />
            <feComposite
              in="mapOutlineColor"
              in2="mapOutlineAlpha"
              operator="in"
              result="mapOutline"
            />
            <feMerge>
              {mapSettings.mapOutlineEnabled ? <feMergeNode in="mapOutline" /> : null}
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
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

      <div className="map-canvas__viewport-shell" data-testid="map-viewport-shell">
        <div
          ref={containerRef}
          className="map-canvas__leaflet"
          data-testid="map-canvas"
          style={{ backgroundColor }}
        />

        {phonePreview ? (
            <>
            <span className="map-canvas__phone-island" aria-hidden="true" />
            <span className="map-canvas__phone-home-indicator" aria-hidden="true" />
            {!clientDetailsOpen && !clientEventsOpen ? (
              <>
                <PhoneMapSearch
                  items={items}
                  categories={categories}
                  locale={visitorLocale}
                  enabledLocales={enabledLocales}
                  languageMenuOpen={languageMenuOpen}
                  hiddenCategoryIds={hiddenVisitorCategoryIds}
                  getLocaleName={localeName}
                  getItemIconUrl={(item, category) => resolveMarkerIconUrl(getItemIconUrl?.(item, category), category?.type ?? item.type)}
                  onLanguageMenuOpenChange={setLanguageMenuOpen}
                  onChooseLocale={chooseVisitorLocale}
                  onToggleCategory={(categoryId) => setHiddenVisitorCategoryIds((current) => {
                    const next = new Set(current)
                    if (next.has(categoryId)) next.delete(categoryId)
                    else next.add(categoryId)
                    return next
                  })}
                  onChooseItem={(itemId) => focusClientItem(itemId, true)}
                />
              </>
            ) : null}
            <button
              type="button"
              className={`map-client-events__toggle${clientPreviewItem ? ' is-raised' : ''}`}
              aria-label={visitorLocale === 'de' ? 'Veranstaltungen anzeigen' : clientCopy.events}
              title={nextEventOccurrence ? `${clientCopy.nextEvent}: ${nextEventOccurrence.time}` : clientCopy.programme}
              aria-expanded={clientEventsOpen}
              onClick={() => {
                setClientPreviewItemId(null);
                setClientDetailsOpen(false);
                setClientEventsOpen(true);
              }}
            >
              <CalendarClock size={21} strokeWidth={1.8} aria-hidden="true" />
              {nextEventOccurrence ? (
                <span
                  aria-hidden="true"
                  title={`${nextEventOccurrence.time} · ${nextEventOccurrence.event.title}`}
                >
                  <strong>{nextEventOccurrence.time}</strong>
                  <small>{nextEventOccurrence.event.title}</small>
                </span>
              ) : null}
            </button>
            <button
              type="button"
              className={`map-client-location__toggle${clientPreviewItem ? ' is-raised' : ''}`}
              aria-label={clientCopy.myLocation}
              title={clientCopy.myLocation}
              onClick={() => {}}
            >
              <LocateFixed size={21} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </>
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

        {clientPreviewItem && clientPreviewIconUrl ? (
          <PhoneClientPreview
            key={`${clientPreviewItem.id}:${(clientPreviewItem.imageAssetIds?.length ? clientPreviewItem.imageAssetIds : clientPreviewItem.imageAssetId ? [clientPreviewItem.imageAssetId] : []).join(',')}`}
            item={clientPreviewItem}
            category={clientPreviewCategory}
            imageUrl={getItemImageUrl?.(clientPreviewItem)}
            imageUrls={getItemImageUrls?.(clientPreviewItem)}
            iconUrl={clientPreviewIconUrl}
            expanded={clientDetailsOpen}
            locale={visitorLocale}
            getFactIconUrl={getFactIconUrl}
            onExpand={() => setClientDetailsOpen(true)}
            onClose={() => {
              setClientPreviewItemId(null)
              setClientDetailsOpen(false)
            }}
          />
        ) : null}

        {phonePreview && clientEventsOpen ? (
          <PhoneEventPanel
            events={events}
            items={items}
            now={eventClock}
            locale={visitorLocale}
            onFocusItem={focusClientItem}
            onClose={() => setClientEventsOpen(false)}
          />
        ) : null}
      </div>

      <button
        type="button"
        className="map-canvas__preview-toggle"
        aria-label={phonePreview ? 'Desktopansicht anzeigen' : 'Handy-Vorschau anzeigen'}
        title={phonePreview ? 'Desktopansicht anzeigen' : 'Handy-Vorschau anzeigen'}
        aria-pressed={phonePreview}
        onClick={() => {
          settingsPreviewRef.current = null;
          navigationPreviewOriginRef.current = null;
          captureViewportTransition();
          setPhonePreview((active) => !active);
        }}
      >
        {phonePreview ? (
          <Monitor size={19} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <Smartphone size={19} strokeWidth={1.8} aria-hidden="true" />
        )}
      </button>

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

      <div className="map-global-settings" ref={globalSettingsRef}>
        {globalSettingsOpen ? (
          <section className="map-global-settings__panel" role="dialog" aria-labelledby="map-global-settings-title">
            <header>
              <div><span>Globale Konfiguration</span><h2 id="map-global-settings-title">Karteneinstellungen</h2></div>
              <button type="button" aria-label="Globale Einstellungen schließen" onClick={() => setGlobalSettingsOpen(false)}><X size={16} /></button>
            </header>

            <div className="map-global-settings__section">
              <strong>Sprachen</strong>
              <p>Die Hauptsprache wird verwendet, wenn eine Übersetzung fehlt.</p>
              <label className="field map-global-settings__locale-select"><span>Hauptsprache</span><select value={defaultLocale} onChange={(event) => onLanguagesChange?.(event.target.value, [...enabledLocales])}>{enabledLocales.map((locale) => <option key={locale} value={locale}>{locale.toUpperCase()} · {localeName(locale)}</option>)}</select></label>
              <div className="map-global-settings__locales">
                {AVAILABLE_LOCALES.map((locale) => {
                  const checked = enabledLocales.includes(locale.code)
                  const progress = translationCompletion(locale.code, defaultLocale, sourceCategories, sourceItems, sourceEvents)
                  return <label key={locale.code}><input type="checkbox" checked={checked} disabled={locale.code === defaultLocale} onChange={(event) => {
                    const next = event.target.checked ? [...enabledLocales, locale.code] : enabledLocales.filter((code) => code !== locale.code)
                    onLanguagesChange?.(defaultLocale, next)
                  }} /><span><strong>{locale.nativeLabel}</strong><small>{locale.code.toUpperCase()} · {progress}%</small></span></label>
                })}
              </div>
            </div>

            <div className="map-global-settings__section">
              <strong>Darstellung</strong>
              <label className="map-global-settings__color">
                <span><Palette size={15} />Hintergrundfarbe</span>
                <div>
                  <input
                    type="color"
                    value={backgroundColor}
                    aria-label="Hintergrundfarbe der Karte"
                    onFocus={onSettingsEditStart}
                    onBlur={onSettingsEditEnd}
                    onChange={(event) => onBackgroundColorChange?.(event.target.value)}
                  />
                  <code>{backgroundColor.toUpperCase()}</code>
                </div>
              </label>
            </div>

            <div className="map-global-settings__section">
              <strong>Kartenform</strong>
              <p>Die Kontur folgt dem Alphakanal der Kartengrafik – auch bei unregelmäßigen PNG-Formen.</p>

              <label className="switch-row map-global-settings__switch">
                <span>
                  <strong>Kartenkontur anzeigen</strong>
                  <small>Zeichnet die Außenlinie um alle sichtbaren Bereiche</small>
                </span>
                <input
                  type="checkbox"
                  checked={mapSettings.mapOutlineEnabled}
                  onChange={(event) => onMapSettingsChange?.({ mapOutlineEnabled: event.target.checked })}
                />
                <i />
              </label>
              <MapSettingsSlider
                label="Konturstärke der Karte"
                description="Breite in der Gesamtansicht; zoomt zusammen mit der Karte"
                value={mapSettings.mapOutlineWidth}
                displayValue={`${mapSettings.mapOutlineWidth}px`}
                min={0.5}
                max={30}
                step={0.5}
                onChange={(value) => onMapSettingsChange?.({ mapOutlineWidth: value })}
                onEditStart={onSettingsEditStart}
                onEditEnd={onSettingsEditEnd}
              />
              <label className="map-global-settings__color">
                <span><Palette size={15} />Konturfarbe</span>
                <div>
                  <input
                    type="color"
                    value={mapSettings.mapOutlineColor}
                    aria-label="Konturfarbe der Karte"
                    onFocus={onSettingsEditStart}
                    onBlur={onSettingsEditEnd}
                    onChange={(event) => onMapSettingsChange?.({ mapOutlineColor: event.target.value })}
                  />
                  <code>{mapSettings.mapOutlineColor.toUpperCase()}</code>
                </div>
              </label>
            </div>

            <div className="map-global-settings__section">
              <strong>Zoomgrenzen</strong>
              <p>Gilt für den Telefon-Simulator und die Besucheransicht.</p>
              <MapSettingsSlider
                label="Maximale Vergrößerung"
                description="Größte Ansicht relativ zur Gesamtansicht"
                value={Math.round(mapSettings.maxZoomScale * 100)}
                displayValue={`${Math.round(mapSettings.maxZoomScale * 100)}%`}
                min={100}
                max={1500}
                step={25}
                manualInput
                onChange={(value) => updateMapSettingWithPreview({ maxZoomScale: value / 100 }, 'maxZoom')}
                onEditStart={() => beginMapSettingsEdit('maxZoom')}
                onEditEnd={endMapSettingsEdit}
              />
              <MapSettingsSlider
                label="Maximale Verkleinerung"
                description="Mindestgröße der Karte in der kleinsten Ansicht"
                value={Math.round(mapSettings.minZoomScale * 100)}
                displayValue={`${Math.round(mapSettings.minZoomScale * 100)}%`}
                min={25}
                max={200}
                step={5}
                manualInput
                onChange={(value) => updateMapSettingWithPreview({ minZoomScale: value / 100 }, 'minZoom')}
                onEditStart={() => beginMapSettingsEdit('minZoom')}
                onEditEnd={endMapSettingsEdit}
              />
            </div>

            <div className="map-global-settings__section">
              <strong>Navigationsgrenzen</strong>
              <p>Gilt für den Telefon-Simulator; erlaubter Bereich außerhalb der Kartenränder.</p>
              <MapSettingsSlider
                label="Horizontaler Rand"
                description="Zusätzlicher Bewegungsraum links und rechts"
                value={Math.round(mapSettings.navigationPaddingX * 100)}
                displayValue={`${Math.round(mapSettings.navigationPaddingX * 100)}%`}
                min={0}
                max={100}
                step={5}
                onChange={(value) => updateMapSettingWithPreview({ navigationPaddingX: value / 100 }, 'horizontal')}
                onEditStart={() => beginNavigationSettingsEdit('horizontal')}
                onEditEnd={endNavigationSettingsEdit}
              />
              <MapSettingsSlider
                label="Vertikaler Rand"
                description="Zusätzlicher Bewegungsraum oben und unten"
                value={Math.round(mapSettings.navigationPaddingY * 100)}
                displayValue={`${Math.round(mapSettings.navigationPaddingY * 100)}%`}
                min={0}
                max={100}
                step={5}
                onChange={(value) => updateMapSettingWithPreview({ navigationPaddingY: value / 100 }, 'vertical')}
                onEditStart={() => beginNavigationSettingsEdit('vertical')}
                onEditEnd={endNavigationSettingsEdit}
              />
            </div>
          </section>
        ) : null}

        <button
          type="button"
          className="map-global-settings__toggle"
          aria-label="Globale Einstellungen öffnen"
          aria-expanded={globalSettingsOpen}
          onClick={() => setGlobalSettingsOpen((current) => !current)}
        >
          <Settings2 size={17} strokeWidth={1.8} aria-hidden="true" />
          <span>Globale Einstellungen</span>
        </button>
      </div>

      {addMode && backgroundUrl ? (
        <div className="map-canvas__mode-hint" aria-live="polite">
          Klicken Sie auf die Karte, um einen Punkt hinzuzufügen
        </div>
      ) : null}

    </section>
  );
}
