import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  canDragMarker,
  denormalizePosition,
  latLngToPosition,
  MapCanvas,
  normalizePoint,
  positionToLatLng,
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
  });
});

describe('MapCanvas rendering', () => {
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
});
