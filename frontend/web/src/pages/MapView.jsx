import React, { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

export default function MapView({ samples = [], preds = [] }) {
  const center = useMemo(() => {
    if (samples.length > 0) return [samples[0].latitude, samples[0].longitude]
    if (preds.length > 0) return [preds[0].latitude, preds[0].longitude]
    return [19.0, 73.0]
  }, [samples, preds])

  return (
    <div className="h-[calc(100vh-56px)]">
      <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
        {samples.map((s, i) => {
          const cat = s.result?.hpi_category || ''
          const color = cat.includes('Low') ? '#22c55e' : cat.includes('Moderate') ? '#60a5fa' : '#ef4444'
          return (
            <CircleMarker key={`s-${i}`} center={[s.latitude, s.longitude]} radius={6} pathOptions={{ color, fillColor: color, fillOpacity: 0.7 }}>
              <Popup>
                <div className="text-sm">
                  <div><b>HPI:</b> {s.result?.heavy_metal_pollution_index}</div>
                  <div><b>Cd:</b> {s.result?.degree_of_contamination}</div>
                  <div><b>Category:</b> {cat}</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
        {preds.map((p, i) => {
          const cat = p.risk_category || ''
          const color = cat.includes('Low') ? '#22c55e' : cat.includes('Moderate') ? '#60a5fa' : '#ef4444'
          return (
            <CircleMarker key={`p-${i}`} center={[p.latitude, p.longitude]} radius={6} pathOptions={{ color, fillColor: color, fillOpacity: 0.5 }}>
              <Popup>
                <div className="text-sm">
                  <div><b>Risk:</b> {p.risk_score}</div>
                  <div><b>Category:</b> {cat}</div>
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}