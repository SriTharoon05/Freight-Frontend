import React, { useEffect, useRef, useState } from 'react';
import type { Json } from './types';

let assets: Promise<void> | undefined;
function loadAssets() {
  if (!assets) assets = (async () => {
    for (const name of ['leaflet.css', 'trip.css']) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/v1/demo/assets/' + name; document.head.append(link);
    }
    for (const name of ['leaflet.js', 'trip-map.js']) await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script'); script.src = '/v1/demo/assets/' + name;
      script.onload = () => resolve(); script.onerror = () => reject(new Error('Map could not load')); document.head.append(script);
    });
  })().catch(error => { assets = undefined; throw error; });
  return assets;
}

export function TripMap({ point, tileURL }: { point?: Json; tileURL?: string }) {
  const element = useRef<HTMLDivElement>(null), map = useRef<any>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadAssets().then(() => {
      if (active && element.current) { map.current = new (window as any).FreightTripMap(element.current); setReady(true); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; map.current?.destroy(); map.current = null; };
  }, []);
  useEffect(() => { map.current?.update(point ? [point] : [], null, tileURL); }, [point, tileURL, ready]);
  return <div style={{ width: '100%' }}>
    <div ref={element} className="trip-map" aria-label="Driver location map" style={{ height: 260, width: '100%' }} />
    <p style={{ fontSize: 13 }}>{point ? `Near ${point.area?.name || 'the reported location'} · GPS accuracy ±${Math.round(point.accuracy)} m` : "Waiting for the driver's first GPS fix."}</p>
    {failed && <p role="status">Map unavailable. Use the Google Maps link.</p>}
    {point && <a href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`} target="_blank" rel="noopener noreferrer">Open driver location in Google Maps ↗</a>}
    <small style={{ display: 'block', marginTop: 8 }}>Approximate locality from GeoNames. The map shows the last received GPS fix.</small>
  </div>;
}
