import React, { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

/* ═══════════════════════════════════════════
   Color Helpers
   ═══════════════════════════════════════════ */
function getCategoryColor(category) {
  if (!category) return '#64748b'
  const lower = category.toLowerCase()
  if (lower.includes('low')) return '#22c55e'
  if (lower.includes('moderate') || lower.includes('medium')) return '#fbbf24'
  if (lower.includes('high') || lower.includes('critical') || lower.includes('severe')) return '#f43f5e'
  return '#60a5fa'
}

function getCategoryLabel(category) {
  if (!category) return 'Unknown'
  const lower = category.toLowerCase()
  if (lower.includes('low')) return 'Low'
  if (lower.includes('moderate') || lower.includes('medium')) return 'Moderate'
  if (lower.includes('high') || lower.includes('critical') || lower.includes('severe')) return 'High'
  return category
}

/* ═══════════════════════════════════════════
   Legend Component
   ═══════════════════════════════════════════ */
function MapLegend() {
  const items = [
    { color: '#22c55e', label: 'Low Pollution' },
    { color: '#fbbf24', label: 'Moderate Pollution' },
    { color: '#f43f5e', label: 'High Pollution' },
  ]

  return (
    <div
      className="absolute bottom-6 left-6 z-[1000] glass-card p-4"
      style={{
        background: 'var(--glass-bg-strong)',
        minWidth: '180px',
      }}
    >
      <h3
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-text-400)' }}
      >
        Legend
      </h3>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: item.color, boxShadow: `0 0 6px ${item.color}40` }}
            />
            <span className="text-xs" style={{ color: 'var(--color-text-300)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div
        className="mt-3 pt-3 text-xs flex items-center gap-2"
        style={{ borderTop: '1px solid var(--glass-border)', color: 'var(--color-text-500)' }}
      >
        <span className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{ borderColor: 'var(--color-text-500)', opacity: 0.5 }} />
        Filled = Samples, Ring = Predictions
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Stats Overlay
   ═══════════════════════════════════════════ */
function MapStats({ sampleCount, predCount }) {
  return (
    <div
      className="absolute top-4 right-4 z-[1000] glass-card px-4 py-3"
      style={{ background: 'var(--glass-bg-strong)' }}
    >
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: 'var(--color-cyan-400)' }}
          />
          <span style={{ color: 'var(--color-text-300)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>{sampleCount}</span> samples
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full border-2"
            style={{ borderColor: 'var(--color-warning-400)' }}
          />
          <span style={{ color: 'var(--color-text-300)' }}>
            <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>{predCount}</span> predictions
          </span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Popup Content
   ═══════════════════════════════════════════ */
function SamplePopup({ sample }) {
  const cat = sample.result?.hpi_category || 'Unknown'
  const color = getCategoryColor(cat)

  return (
    <div style={{ fontFamily: 'var(--font-sans)', minWidth: '200px' }}>
      <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-semibold uppercase" style={{ color: color }}>
          {getCategoryLabel(cat)} Risk
        </span>
      </div>
      <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-300)' }}>
        <div className="flex justify-between">
          <span>HPI</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {sample.result?.heavy_metal_pollution_index != null
              ? Number(sample.result.heavy_metal_pollution_index).toFixed(2)
              : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Cd Index</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {sample.result?.degree_of_contamination != null
              ? Number(sample.result.degree_of_contamination).toFixed(2)
              : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Location</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {Number(sample.latitude).toFixed(4)}, {Number(sample.longitude).toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  )
}

function PredPopup({ pred }) {
  const cat = pred.risk_category || 'Unknown'
  const color = getCategoryColor(cat)

  return (
    <div style={{ fontFamily: 'var(--font-sans)', minWidth: '180px' }}>
      <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: '1px solid var(--glass-border)' }}>
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <span className="text-xs font-semibold uppercase" style={{ color: color }}>
          Prediction — {getCategoryLabel(cat)}
        </span>
      </div>
      <div className="space-y-1 text-xs" style={{ color: 'var(--color-text-300)' }}>
        <div className="flex justify-between">
          <span>Risk Score</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {pred.risk_score != null ? Number(pred.risk_score).toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Location</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {Number(pred.latitude).toFixed(4)}, {Number(pred.longitude).toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   MapView Component
   ═══════════════════════════════════════════ */
export default function MapView({ samples = [], preds = [] }) {
  const center = useMemo(() => {
    if (samples.length > 0) return [samples[0].latitude, samples[0].longitude]
    if (preds.length > 0) return [preds[0].latitude, preds[0].longitude]
    return [19.0, 73.0]
  }, [samples, preds])

  return (
    <div className="relative" style={{ height: 'calc(100vh - 64px)' }}>
      <MapContainer
        center={center}
        zoom={8}
        style={{ height: '100%', width: '100%', borderRadius: 0 }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Sample Markers */}
        {samples.map((s, i) => {
          const cat = s.result?.hpi_category || ''
          const color = getCategoryColor(cat)
          return (
            <CircleMarker
              key={`s-${s.id || i}`}
              center={[s.latitude, s.longitude]}
              radius={7}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.6,
                weight: 2,
                opacity: 0.9,
              }}
            >
              <Popup>
                <SamplePopup sample={s} />
              </Popup>
            </CircleMarker>
          )
        })}

        {/* Prediction Markers — ring-style (lower fill opacity) */}
        {preds.map((p, i) => {
          const cat = p.risk_category || ''
          const color = getCategoryColor(cat)
          return (
            <CircleMarker
              key={`p-${i}`}
              center={[p.latitude, p.longitude]}
              radius={8}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 2.5,
                opacity: 0.9,
                dashArray: '4 3',
              }}
            >
              <Popup>
                <PredPopup pred={p} />
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>

      {/* Overlays */}
      <MapLegend />
      <MapStats sampleCount={samples.length} predCount={preds.length} />
    </div>
  )
}