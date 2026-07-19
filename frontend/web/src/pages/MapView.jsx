import React, { useMemo, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, Tooltip, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { latLngToCell, cellToBoundary } from 'h3-js'

// Polyfill for Leaflet 1.9.4 bug where hover events on Text nodes crash the map
if (typeof window !== 'undefined' && window.Text && !window.Text.prototype.closest) {
  window.Text.prototype.closest = function (s) {
    return this.parentNode ? this.parentNode.closest(s) : null;
  };
}

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

function getHmpiCategory(score) {
  if (score == null) return 'Unknown'
  if (score < 25) return 'Low'
  if (score < 50) return 'Moderate'
  if (score < 75) return 'High'
  return 'Critical'
}

/* ═══════════════════════════════════════════
   Popup Content
   ═══════════════════════════════════════════ */
function SamplePopup({ sample }) {
  const hmpi = sample.standards?.['BIS']?.hmpi
  const hei = sample.standards?.['BIS']?.hei
  const cat = getHmpiCategory(hmpi)
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
        <div className="flex justify-between gap-4 text-right">
          <span>HMPI</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {hmpi != null ? Number(hmpi).toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-right">
          <span>HEI</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {hei != null ? Number(hei).toFixed(2) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-right">
          <span>Coordinates</span>
          <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
            {Number(sample.latitude).toFixed(4)}, {Number(sample.longitude).toFixed(4)}
          </span>
        </div>
        {(sample.location || sample.district || sample.state) && (
          <div className="flex justify-between gap-4 text-right mt-2 border-t pt-2" style={{ borderColor: 'var(--glass-border)' }}>
            <span>Name</span>
            <span className="font-semibold" style={{ color: 'var(--color-text-100)' }}>
              {[sample.location, sample.district, sample.state].filter(Boolean).join(', ')}
            </span>
          </div>
        )}
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

const API = (path) => new URL(path, window.location.origin).toString()

/* ═══════════════════════════════════════════
   Dynamic Layer Wrapper (H3 -> Cluster -> Points)
   ═══════════════════════════════════════════ */
function DynamicMapLayer({ preds }) {
  const [zoom, setZoom] = useState(8)
  const [mapPoints, setMapPoints] = useState([])
  
  const fetchPoints = async (m) => {
    try {
      const bounds = m.getBounds()
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`
      const res = await fetch(API(`/api/v1/datasets/map?bbox=${bbox}`))
      if (res.ok) {
        const data = await res.json()
        setMapPoints(data.points || [])
      }
    } catch (e) {
      console.error(e)
    }
  }

  const map = useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
    moveend: () => fetchPoints(map),
  })

  // Initial fetch on mount
  React.useEffect(() => {
    fetchPoints(map)
  }, [map])

  // Memoize H3 hex calculation
  const macroHexagons = useMemo(() => {
    const hexBins = {}
    mapPoints.forEach(s => {
      if (s.latitude == null || s.longitude == null) return
      // Use resolution 3 instead of 4 for larger hexagons, preventing overlap on massive datasets
      const hex = latLngToCell(s.latitude, s.longitude, 3)
      if (!hexBins[hex]) hexBins[hex] = { count: 0, sumHmpi: 0 }
      hexBins[hex].count++
      hexBins[hex].sumHmpi += (s.hmpi_bis || 0)
    })

    return Object.entries(hexBins).map(([hex, data]) => {
      const avgHmpi = data.sumHmpi / data.count
      const cat = getHmpiCategory(avgHmpi)
      const color = getCategoryColor(cat)
      const boundary = cellToBoundary(hex).map(p => [p[0], p[1]])

      return (
        <Polygon 
          key={hex} 
          positions={boundary} 
          pathOptions={{ fillColor: color, color: color, fillOpacity: 0.6, weight: 1 }}
        >
          <Tooltip direction="center" permanent={false} interactive={false} opacity={1} className="hex-tooltip">
            <div style={{
              background: 'rgba(15, 23, 42, 0.95)',
              color: '#f8fafc',
              padding: '4px 10px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              border: `2px solid ${color}`,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              transform: 'translate(-50%, -50%)',
              whiteSpace: 'nowrap'
            }}>
              [ {data.count} ]
            </div>
          </Tooltip>
        </Polygon>
      )
    })
  }, [mapPoints])

  // Memoize sample marker generation
  const sampleMarkers = useMemo(() => {
    return mapPoints.map((s, i) => {
      const hmpi = s.hmpi_bis
      const cat = hmpi != null ? getHmpiCategory(hmpi) : ''
      const color = getCategoryColor(cat)
      
      // Construct a faux sample object for the existing popup component
      const fauxSample = {
        latitude: s.latitude,
        longitude: s.longitude,
        location: s.location,
        district: s.district,
        state: s.state,
        standards: { BIS: { hmpi: s.hmpi_bis } }
      }

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
            <SamplePopup sample={fauxSample} />
          </Popup>
        </CircleMarker>
      )
    })
  }, [mapPoints])

  // Memoize prediction marker generation
  const predMarkers = useMemo(() => {
    return preds.map((p, i) => {
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
    })
  }, [preds])

  // 1. MACRO ZOOM: H3 Hexagons
  if (zoom < 6) {
    return <>{macroHexagons}</>
  }

  // 2 & 3. MID / CLOSE ZOOM: Marker Clustering -> Points
  return (
    <MarkerClusterGroup chunkedLoading disableClusteringAtZoom={9} maxClusterRadius={60}>
      {sampleMarkers}
      {predMarkers}
    </MarkerClusterGroup>
  )
}

/* ═══════════════════════════════════════════
   MapView Component
   ═══════════════════════════════════════════ */
export default function MapView({ samples = [], preds = [], summary }) {
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

        <DynamicMapLayer preds={preds} />
      </MapContainer>

      {/* Overlays */}
      <MapLegend />
      <MapStats sampleCount={summary?.count || samples.length} predCount={preds.length} />
    </div>
  )
}