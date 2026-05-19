import { useRef } from 'react';
import { useRadarMap, type UseRadarMapOptions } from '../hooks/useRadarMap';

/** Hosts the MapLibre canvas and binds it to React state via useRadarMap. */
export function MapView(props: UseRadarMapOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  useRadarMap(containerRef, props);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
