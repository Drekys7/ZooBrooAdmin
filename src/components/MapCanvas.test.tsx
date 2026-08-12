import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MapCategory, MapEvent, MapItem } from '../domain/models';
import {
  canDragMarker,
  denormalizePosition,
  latLngToPosition,
  MapCanvas,
  markerIconAnchor,
  markerShadowColor,
  markerVisualMetrics,
  imageMaskRadiusToCssRadius,
  normalizePoint,
  positionToLatLng,
  resolveMarkerIconUrl,
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
      recurrence: { frequency: 'weekly', interval: 1, weekdays: ['saturday'], monthDays: [], endsOn: null }, visible: true,
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
    const { container } = render(
      <MapCanvas
        backgroundUrl={null}
        backgroundWidth={1}
        backgroundHeight={1}
        backgroundColor="#B8D8C0"
        items={[]}
        categories={[]}
        onBackgroundColorChange={onBackgroundColorChange}
      />,
    );

    expect(container.querySelector('.map-canvas')).toHaveStyle({
      backgroundColor: '#B8D8C0',
    });
    expect(container.querySelector('[data-testid="map-canvas"]')).toHaveStyle({
      backgroundColor: '#B8D8C0',
    });

    const colorInput = container.querySelector(
      'input[aria-label="Hintergrundfarbe der Karte"]',
    );
    expect(colorInput).toBeInstanceOf(HTMLInputElement);
    fireEvent.change(colorInput!, {
      target: { value: '#a1b2c3' },
    });
    expect(onBackgroundColorChange).toHaveBeenCalledWith('#a1b2c3');
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
  })

  it('uses the built-in category symbol instead of an item title initial', () => {
    expect(resolveMarkerIconUrl(null, 'custom')).toMatch(/^data:image\/svg\+xml,/)
    expect(resolveMarkerIconUrl('/uploaded-symbol.png', 'custom')).toBe('/uploaded-symbol.png')
  })
});
