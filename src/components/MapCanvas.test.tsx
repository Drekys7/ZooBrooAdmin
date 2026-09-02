import { fireEvent, render, screen, within } from '@testing-library/react';
import L from 'leaflet';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_MAP_SETTINGS, type MapCategory, type MapEvent, type MapItem } from '../domain/models';
import {
  canDragMarker,
  denormalizePosition,
  latLngToPosition,
  MapCanvas,
  markerIconAnchor,
  markerTooltipAnchor,
  markerShadowColor,
  markerVisualMetrics,
  mapBackgroundEffectsEnabled,
  mapBackgroundClassName,
  mapViewSettingsForMode,
  navigationLimitPoints,
  navigationPreviewPoint,
  imageMaskRadiusToCssRadius,
  normalizePoint,
  positionToLatLng,
  previewMapSetting,
  relativeZoomScale,
  resolveMarkerIconUrl,
  scaledMapEffectValue,
  unconstrainedFitZoom,
  zoomForRelativeScale,
  zoomLimitsForFit,
} from './MapCanvas';

describe('MapCanvas coordinate helpers', () => {
  it('round-trips normalized positions through image pixel coordinates', () => {
    const position = { x: 0.375, y: 0.625 };
    const point = denormalizePosition(position, 2400, 1200);

    expect(point).toEqual({ x: 900, y: 750 });
    expect(normalizePoint(point, 2400, 1200)).toEqual(position);
  });

  it('uses a top-left origin while mapping to Leaflet Simple CRS', () => {
    const topLeft = positionToLatLng({ x: 0, y: 0 }, 1600, 900);
    const bottomRight = positionToLatLng({ x: 1, y: 1 }, 1600, 900);

    expect(topLeft).toEqual({ lat: 900, lng: 0 });
    expect(bottomRight).toEqual({ lat: 0, lng: 1600 });
    expect(latLngToPosition({ lat: 675, lng: 400 }, 1600, 900)).toEqual({ x: 0.25, y: 0.25 });
  });

  it('clamps coordinates dragged beyond the background bounds', () => {
    expect(normalizePoint({ x: -20, y: 1200 }, 1000, 1000)).toEqual({ x: 0, y: 1 });
  });

  it('derives zoom and navigation limits relative to the fitted map', () => {
    const configuredSettings = { ...DEFAULT_MAP_SETTINGS, minZoomScale: 2, maxZoomScale: 15, navigationPaddingX: 0.1, navigationPaddingY: 0.2 }
    expect(mapViewSettingsForMode(true, configuredSettings)).toBe(configuredSettings)
    expect(mapViewSettingsForMode(false, configuredSettings)).toEqual({
      minZoomScale: 0.5,
      maxZoomScale: 4,
      navigationPaddingX: 0.45,
      navigationPaddingY: 0.45,
      mapOutlineEnabled: false,
      mapOutlineWidth: 4,
      mapOutlineColor: '#FFFFFF',
    })
    expect(zoomLimitsForFit(-2, { minZoomScale: 0.5, maxZoomScale: 4 })).toEqual({ minZoom: -3, maxZoom: 0 })
    expect(navigationLimitPoints(1000, 500, { navigationPaddingX: 0.2, navigationPaddingY: 0.4 })).toEqual({
      southWest: [-200, -200],
      northEast: [700, 1200],
    })
    expect(navigationPreviewPoint(1000, 500, { navigationPaddingX: 0.2, navigationPaddingY: 0.4 }, 'horizontal')).toEqual({
      lat: 250,
      lng: 1200,
    })
    expect(navigationPreviewPoint(1000, 500, { navigationPaddingX: 0.2, navigationPaddingY: 0.4 }, 'vertical')).toEqual({
      lat: 700,
      lng: 500,
    })
    expect(relativeZoomScale(1, -1)).toBe(4)
    expect(zoomForRelativeScale(-1, 4)).toBe(1)
  })

  it('moves the live preview to the edited zoom and navigation limits', () => {
    const settings = { ...DEFAULT_MAP_SETTINGS, navigationPaddingX: 0.2, navigationPaddingY: 0.4 }
    const imageBounds = L.latLngBounds([0, 0], [500, 1000])
    const createMap = (currentZoom = -2) => ({
      setMaxBounds: vi.fn(),
      project: vi.fn((point: L.LatLng, zoom: number) => L.point(point.lng * (2 ** zoom), point.lat * (2 ** zoom))),
      getSize: vi.fn(() => L.point(280, 155)),
      getScaleZoom: vi.fn((scale: number, zoom: number) => zoom + Math.log2(scale)),
      setMinZoom: vi.fn(),
      setMaxZoom: vi.fn(),
      getZoom: vi.fn(() => currentZoom),
      setZoom: vi.fn(),
      setView: vi.fn(),
    }) as unknown as L.Map

    const minZoomMap = createMap()
    previewMapSetting(minZoomMap, imageBounds, 1000, 500, settings, [30, 30], 'minZoom')
    expect(minZoomMap.setView).toHaveBeenLastCalledWith(imageBounds.getCenter(), -3, { animate: false })

    const maxZoomMap = createMap()
    previewMapSetting(maxZoomMap, imageBounds, 1000, 500, settings, [30, 30], 'maxZoom')
    expect(maxZoomMap.setView).toHaveBeenLastCalledWith(imageBounds.getCenter(), 0, { animate: false })

    const horizontalMap = createMap(2)
    expect(unconstrainedFitZoom(horizontalMap, imageBounds, [30, 30])).toBeCloseTo(-2)
    previewMapSetting(horizontalMap, imageBounds, 1000, 500, settings, [30, 30], 'horizontal')
    expect(horizontalMap.setView).toHaveBeenLastCalledWith([250, 1200], -2, { animate: false })

    const verticalMap = createMap(2)
    previewMapSetting(verticalMap, imageBounds, 1000, 500, settings, [30, 30], 'vertical')
    expect(verticalMap.setView).toHaveBeenLastCalledWith([700, 500], -2, { animate: false })
  })
});

describe('MapCanvas marker interaction', () => {
  it('only allows an already selected marker to be dragged', () => {
    expect(canDragMarker('antelope', null, false)).toBe(false);
    expect(canDragMarker('antelope', 'bear', false)).toBe(false);
    expect(canDragMarker('antelope', 'antelope', false)).toBe(true);
    expect(canDragMarker('antelope', 'antelope', true)).toBe(false);
    expect(canDragMarker('antelope', 'antelope', false, true)).toBe(false);
  });
});

describe('MapCanvas rendering', () => {
  it('converts the category mask percentage to a centered circle radius', () => {
    expect(imageMaskRadiusToCssRadius(100)).toBe('50%')
    expect(imageMaskRadiusToCssRadius(55)).toBe('27.5%')
    expect(imageMaskRadiusToCssRadius(0)).toBe('0%')
  })

  it('converts category shadow settings to a browser color', () => {
    expect(markerShadowColor('#123456', 40)).toBe('rgba(18, 52, 86, 0.4)')
    expect(markerShadowColor('#123456', 40, false)).toBe('rgba(18, 52, 86, 0)')
  })

  it('enables the alpha-aware background filter only for the map outline', () => {
    expect(mapBackgroundEffectsEnabled(DEFAULT_MAP_SETTINGS)).toBe(false)
    expect(mapBackgroundEffectsEnabled({ ...DEFAULT_MAP_SETTINGS, mapOutlineEnabled: true })).toBe(true)
    expect(mapBackgroundClassName(DEFAULT_MAP_SETTINGS)).toBe('map-canvas__background')
    expect(mapBackgroundClassName({ ...DEFAULT_MAP_SETTINGS, mapOutlineEnabled: true })).toBe(
      'map-canvas__background has-alpha-effects',
    )
  })

  it('scales the map outline together with the map zoom', () => {
    expect(scaledMapEffectValue(4, 1)).toBe(4)
    expect(scaledMapEffectValue(4, 2.5)).toBe(10)
    expect(scaledMapEffectValue(16, 0.5)).toBe(8)
  })

  it('builds the map outline from image alpha instead of its rectangular box', () => {
    const { container, unmount } = render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        mapSettings={{ ...DEFAULT_MAP_SETTINGS, mapOutlineEnabled: true }}
        items={[]}
        categories={[]}
      />,
    )

    const filter = container.querySelector('#map-canvas-background-alpha-effects')
    expect(filter?.querySelector('feMorphology')?.getAttribute('in')).toBe('SourceAlpha')
    expect(filter?.querySelector('feComposite[operator="out"]')).toBeInTheDocument()
    unmount()
  })

  it('renders its empty state and map controls without a background', () => {
    render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        items={[]}
        categories={[]}
      />,
    );

    expect(screen.getByTestId('map-canvas')).toBeInTheDocument();
    expect(screen.getByText('Noch keine Karte geladen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vergrößern' })).toBeInTheDocument();
  });

  it('switches between desktop and phone preview modes', () => {
    const { container } = render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        items={[]}
        categories={[]}
      />,
    )

    const renderedMap = within(container)
    const phoneButton = renderedMap.getByRole('button', { name: 'Handy-Vorschau anzeigen' })
    expect(container.querySelector('.map-canvas')).not.toHaveClass('is-phone-preview')

    fireEvent.click(phoneButton)

    expect(container.querySelector('.map-canvas')).toHaveClass('is-phone-preview')
    expect(renderedMap.getByRole('button', { name: 'Veranstaltungen anzeigen' })).toBeInTheDocument()
    fireEvent.click(renderedMap.getByRole('button', { name: 'Veranstaltungen anzeigen' }))
    expect(renderedMap.getByRole('dialog', { name: 'Veranstaltungen' })).toBeInTheDocument()
    fireEvent.click(renderedMap.getByRole('button', { name: 'Veranstaltungen schließen' }))
    expect(renderedMap.getByRole('button', { name: 'Desktopansicht anzeigen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    fireEvent.click(renderedMap.getByRole('button', { name: 'Desktopansicht anzeigen' }))
    expect(container.querySelector('.map-canvas')).not.toHaveClass('is-phone-preview')
  })

  it('opens the phone event preview when requested by the event editor', () => {
    const { container, rerender } = render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        items={[]}
        categories={[]}
        phonePreviewRequest={0}
      />,
    )

    rerender(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        items={[]}
        categories={[]}
        phonePreviewRequest={1}
      />,
    )

    const renderedMap = within(container)
    expect(container.querySelector('.map-canvas')).toHaveClass('is-phone-preview')
    expect(renderedMap.getByRole('dialog', { name: 'Veranstaltungen' })).toBeInTheDocument()
  })

  it('focuses a linked map item from the phone event programme', () => {
    const category: MapCategory = {
      id: 'animals', name: 'Tiere', type: 'animal', color: '#4F8F64', defaultIconAssetId: null, visible: true, sortOrder: 0,
    }
    const item: MapItem = {
      id: 'penguins', categoryId: 'animals', type: 'animal', title: 'Pinguine', subtitle: '', description: '', iconAssetId: null,
      imageAssetId: null, colorOverride: null, markerOverrides: null, position: { x: 0.3, y: 0.4 }, facts: [], visible: true,
      createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T08:00:00.000Z',
    }
    const zooEvent: MapEvent = {
      id: 'feeding', title: 'Pinguinfütterung', description: '', location: 'Pinguinanlage', relatedItemId: item.id,
      startDate: '2099-08-15', startTime: '11:00', endTime: null,
      recurrence: { frequency: 'weekly', interval: 1, weekdays: ['saturday'], monthDays: [], endsOn: null, excludedDates: [] }, visible: true,
      createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T08:00:00.000Z',
    }
    const onSelect = vi.fn()
    const { container } = render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1000}
        backgroundHeight={600}
        items={[item]}
        categories={[category]}
        events={[zooEvent]}
        onSelect={onSelect}
      />,
    )
    const renderedMap = within(container)

    fireEvent.click(renderedMap.getByRole('button', { name: 'Handy-Vorschau anzeigen' }))
    expect(renderedMap.getByRole('button', { name: 'Veranstaltungen anzeigen' })).toHaveTextContent('11:00Pinguinfütterung')
    fireEvent.click(renderedMap.getByRole('button', { name: 'Veranstaltungen anzeigen' }))
    fireEvent.click(renderedMap.getByRole('button', { name: 'Auf der Karte zeigen' }))

    expect(onSelect).toHaveBeenCalledWith('penguins')
    expect(renderedMap.queryByRole('dialog', { name: 'Veranstaltungen' })).not.toBeInTheDocument()
    expect(renderedMap.getByLabelText('Pinguine Vorschau')).toBeInTheDocument()
  })

  it('applies and reports the configured map background color', () => {
    const onBackgroundColorChange = vi.fn();
    const onMapSettingsChange = vi.fn();
    const { container } = render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        backgroundColor="#B8D8C0"
        items={[]}
        categories={[]}
        onBackgroundColorChange={onBackgroundColorChange}
        onMapSettingsChange={onMapSettingsChange}
      />,
    );

    expect(container.querySelector('.map-canvas')).toHaveStyle({
      backgroundColor: '#B8D8C0',
    });
    expect(container.querySelector('[data-testid="map-canvas"]')).toHaveStyle({
      backgroundColor: '#B8D8C0',
    });

    const renderedMap = within(container)
    fireEvent.click(renderedMap.getByRole('button', { name: 'Globale Einstellungen öffnen' }))
    expect(renderedMap.getByRole('dialog', { name: 'Karteneinstellungen' })).toBeInTheDocument()
    const colorInput = container.querySelector('input[aria-label="Hintergrundfarbe der Karte"]');
    expect(colorInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(colorInput!, {
      target: { value: '#a1b2c3' },
    });
    expect(onBackgroundColorChange).toHaveBeenCalledWith('#a1b2c3');
    const horizontalBoundary = renderedMap.getByLabelText('Horizontaler Rand')
    fireEvent.pointerDown(horizontalBoundary)
    expect(container.querySelector('.map-canvas')).toHaveClass('is-phone-preview')
    fireEvent.change(horizontalBoundary, { target: { value: '30' } })
    fireEvent.pointerUp(horizontalBoundary)
    expect(onMapSettingsChange).toHaveBeenCalledWith({ navigationPaddingX: 0.3 })
    fireEvent.click(renderedMap.getByRole('button', { name: 'Desktopansicht anzeigen' }))
    const zoomLimit = renderedMap.getByLabelText('Maximale Vergrößerung')
    fireEvent.pointerDown(zoomLimit)
    expect(container.querySelector('.map-canvas')).toHaveClass('is-phone-preview')
    fireEvent.pointerUp(zoomLimit)
    expect(renderedMap.getByLabelText('Maximale Verkleinerung')).toHaveAttribute('max', '200')
    fireEvent.change(renderedMap.getByLabelText('Maximale Verkleinerung'), { target: { value: '200' } })
    expect(onMapSettingsChange).toHaveBeenCalledWith({ minZoomScale: 2 })
    const manualZoomOut = renderedMap.getByLabelText('Maximale Verkleinerung: Prozentwert')
    fireEvent.focus(manualZoomOut)
    fireEvent.change(manualZoomOut, { target: { value: '275' } })
    fireEvent.blur(manualZoomOut)
    expect(onMapSettingsChange).toHaveBeenCalledWith({ minZoomScale: 2.75 })
    expect(manualZoomOut).not.toHaveAttribute('max')
    expect(renderedMap.getByLabelText('Maximale Vergrößerung')).toHaveAttribute('max', '1500')
    fireEvent.change(renderedMap.getByLabelText('Maximale Vergrößerung'), { target: { value: '1500' } })
    expect(onMapSettingsChange).toHaveBeenCalledWith({ maxZoomScale: 15 })
    const manualZoomIn = renderedMap.getByLabelText('Maximale Vergrößerung: Prozentwert')
    fireEvent.focus(manualZoomIn)
    fireEvent.change(manualZoomIn, { target: { value: '2000' } })
    fireEvent.blur(manualZoomIn)
    expect(onMapSettingsChange).toHaveBeenCalledWith({ maxZoomScale: 20 })
    expect(manualZoomIn).not.toHaveAttribute('max')
  });

  it('scales image, circle and upright pin marker dimensions', () => {
    const imageMetrics = markerVisualMetrics('image', 1.5);
    expect(imageMetrics.bodyWidth).toBeCloseTo(108.9);
    expect(imageMetrics.bodyHeight).toBeCloseTo(108.9);
    expect(imageMetrics.iconWidth).toBeCloseTo(108.9);
    expect(imageMetrics.iconHeight).toBeCloseTo(108.9);
    expect(markerVisualMetrics('circle', 0.5)).toEqual({
      bodyWidth: 24.75,
      bodyHeight: 24.75,
      iconWidth: 24.75,
      iconHeight: 24.75,
    });
    expect(markerVisualMetrics('pin', 2)).toEqual({
      bodyWidth: 104,
      bodyHeight: 136,
      iconWidth: 104,
      iconHeight: 136,
    });
  });

  it('anchors pins at the bottom tip and other markers in the center', () => {
    expect(markerIconAnchor('pin', 52, 68)).toEqual([26, 68])
    expect(markerIconAnchor('circle', 50, 50)).toEqual([25, 25])
    expect(markerIconAnchor('image', 72, 72)).toEqual([36, 36])
    expect(markerTooltipAnchor('pin', 68)).toEqual([0, -68])
    expect(markerTooltipAnchor('circle', 50)).toEqual([0, -25])
    expect(markerTooltipAnchor('image', 72)).toEqual([0, -36])
  })

  it('uses the built-in category symbol instead of an item title initial', () => {
    expect(resolveMarkerIconUrl(null, 'custom')).toMatch(/^data:image\/svg\+xml,/)
    expect(resolveMarkerIconUrl('/uploaded-symbol.png', 'custom')).toBe('/uploaded-symbol.png')
  })
});
