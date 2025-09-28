import { useMemo, useState, useEffect } from 'react'
import './App.css'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

function App() {
  const [file, setFile] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filterHpi, setFilterHpi] = useState('All')
  const [filterCd, setFilterCd] = useState('All')

  // Fix default Leaflet marker icons when bundling with Vite
  useEffect(() => {
    const defaultIcon = L.icon({
      iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString(),
      iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString(),
      shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString(),
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    })
    L.Marker.prototype.options.icon = defaultIcon
  }, [])

  const handleFileChange = (e) => {
    setFile(e.target.files?.[0] ?? null)
    setError('')
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a CSV, JSON, or PDF file.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file, file.name)

      const res = await fetch('/api/v1/upload-and-calculate/', {
        method: 'POST',
        body: form,
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail?.detail || `Upload failed (${res.status})`)
      }

      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Unexpected error while uploading file.')
    } finally {
      setLoading(false)
    }
  }

  const handleSampleUpload = async () => {
    setLoading(true)
    setError('')
    try {
      const csv = [
        'latitude,longitude,arsenic,cadmium,lead,zinc',
        '28.7,77.1,15.0,4.0,12.0,5500',
        '19.0,72.8,5.0,1.0,4.0,2000'
      ].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const form = new FormData()
      form.append('file', blob, 'sample.csv')
      const res = await fetch('/api/v1/upload-and-calculate/', { method: 'POST', body: form })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        throw new Error(detail?.detail || `Upload failed (${res.status})`)
      }
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'Unexpected error while uploading sample data.')
    } finally {
      setLoading(false)
    }
  }

  const clearResults = () => {
    setResults([])
    setFile(null)
    setError('')
    setFilterHpi('All')
    setFilterCd('All')
  }

  const filteredResults = useMemo(() => {
    return results.filter((s) => {
      const hpiOk = filterHpi === 'All' || s.result?.hpi_category === filterHpi
      const cdOk = filterCd === 'All' || s.result?.cd_category === filterCd
      return hpiOk && cdOk
    })
  }, [results, filterHpi, filterCd])

  const stats = useMemo(() => {
    const total = results.length
    const avgHpi = total ? (results.reduce((acc, s) => acc + (s.result?.heavy_metal_pollution_index ?? 0), 0) / total) : 0
    const avgCd = total ? (results.reduce((acc, s) => acc + (s.result?.degree_of_contamination ?? 0), 0) / total) : 0
    const hpiCounts = {
      Low: results.filter((s) => s.result?.hpi_category === 'Low pollution').length,
      Moderate: results.filter((s) => s.result?.hpi_category === 'Moderate pollution').length,
      High: results.filter((s) => s.result?.hpi_category === 'High pollution').length,
    }
    const cdCounts = {
      Low: results.filter((s) => s.result?.cd_category === 'Low degree of contamination').length,
      Moderate: results.filter((s) => s.result?.cd_category === 'Moderate degree of contamination').length,
      High: results.filter((s) => s.result?.cd_category === 'High degree of contamination').length,
    }
    return { total, avgHpi, avgCd, hpiCounts, cdCounts }
  }, [results])

  const exportCsv = () => {
    if (!results.length) return
    const headers = [
      'id','latitude','longitude','arsenic','cadmium','lead','zinc',
      'heavy_metal_pollution_index','hpi_category','degree_of_contamination','cd_category'
    ]
    const rows = results.map((s) => ([
      s.id ?? '', s.latitude, s.longitude, s.arsenic, s.cadmium, s.lead, s.zinc,
      s.result?.heavy_metal_pollution_index ?? '', s.result?.hpi_category ?? '',
      s.result?.degree_of_contamination ?? '', s.result?.cd_category ?? ''
    ]))
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hmpi_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const positions = results.map((s) => ({ latitude: s.latitude, longitude: s.longitude, data: s }))
  const defaultCenter = [20.5937, 78.9629] // Center of India
  const startCenter = positions.length ? [positions[0].latitude, positions[0].longitude] : defaultCenter

  const FitBounds = ({ pts }) => {
    const map = useMap()
    useEffect(() => {
      if (pts && pts.length > 0) {
        const bounds = L.latLngBounds(pts.map((p) => [p.latitude, p.longitude]))
        map.fitBounds(bounds, { padding: [20, 20] })
      }
    }, [pts, map])
    return null
  }

  return (
    <div className="container">
      <h1>Heavy Metal Pollution Indices</h1>
      <p className="subtitle">Automated HMPI calculations with geo-mapped results and quality categorization.</p>

      <div className="upload-card">
        <input
          type="file"
          accept=".csv,.json,.pdf"
          onChange={handleFileChange}
        />
        <button onClick={handleUpload} disabled={loading}>
          {loading ? 'Processing…' : 'Upload & Calculate'}
        </button>
        <button onClick={handleSampleUpload} disabled={loading}>
          {loading ? 'Processing…' : 'Try Sample Data'}
        </button>
        <button onClick={clearResults} disabled={loading || results.length === 0}>Clear</button>
        {error && <p className="error">{error}</p>}
      </div>

      {results.length > 0 && (
        <div className="results">
          <h2>Results</h2>
          <div className="controls">
            <div>
              <label>HPI Category: </label>
              <select value={filterHpi} onChange={(e) => setFilterHpi(e.target.value)}>
                <option>All</option>
                <option value="Low pollution">Low pollution</option>
                <option value="Moderate pollution">Moderate pollution</option>
                <option value="High pollution">High pollution</option>
              </select>
            </div>
            <div>
              <label>Cd Category: </label>
              <select value={filterCd} onChange={(e) => setFilterCd(e.target.value)}>
                <option>All</option>
                <option value="Low degree of contamination">Low degree of contamination</option>
                <option value="Moderate degree of contamination">Moderate degree of contamination</option>
                <option value="High degree of contamination">High degree of contamination</option>
              </select>
            </div>
            <div className="spacer" />
            <button onClick={exportCsv}>Export CSV</button>
          </div>
          <div className="stats">
            <div className="stat"><div className="label">Total Samples</div><div className="value">{stats.total}</div></div>
            <div className="stat"><div className="label">Avg HPI</div><div className="value">{stats.avgHpi.toFixed(2)}</div></div>
            <div className="stat"><div className="label">Avg Cd</div><div className="value">{stats.avgCd.toFixed(2)}</div></div>
            <div className="stat"><div className="label">HPI: L / M / H</div><div className="value">{stats.hpiCounts.Low} / {stats.hpiCounts.Moderate} / {stats.hpiCounts.High}</div></div>
            <div className="stat"><div className="label">Cd: L / M / H</div><div className="value">{stats.cdCounts.Low} / {stats.cdCounts.Moderate} / {stats.cdCounts.High}</div></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Latitude</th>
                  <th>Longitude</th>
                  <th>Arsenic</th>
                  <th>Cadmium</th>
                  <th>Lead</th>
                  <th>Zinc</th>
                  <th>HPI</th>
                  <th>HPI Category</th>
                  <th>Cd</th>
                  <th>Cd Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((s) => (
                  <tr key={s.id ?? `${s.latitude}-${s.longitude}`}>
                    <td>{s.latitude}</td>
                    <td>{s.longitude}</td>
                    <td>{s.arsenic}</td>
                    <td>{s.cadmium}</td>
                    <td>{s.lead}</td>
                    <td>{s.zinc}</td>
                    <td>{s.result?.heavy_metal_pollution_index}</td>
                    <td>{s.result?.hpi_category}</td>
                    <td>{s.result?.degree_of_contamination}</td>
                    <td>{s.result?.cd_category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MapContainer className="map" center={startCenter} zoom={6} scrollWheelZoom>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            <FitBounds pts={filteredResults.map((s) => ({ latitude: s.latitude, longitude: s.longitude }))} />
            {filteredResults.map((s) => (
              <Marker key={s.id ?? `${s.latitude}-${s.longitude}`} position={[s.latitude, s.longitude]}>
                <Popup>
                  <div>
                    <strong>Location</strong>: {s.latitude}, {s.longitude}<br />
                    <strong>Arsenic</strong>: {s.arsenic}<br />
                    <strong>Cadmium</strong>: {s.cadmium}<br />
                    <strong>Lead</strong>: {s.lead}<br />
                    <strong>Zinc</strong>: {s.zinc}<br />
                    <strong>HPI</strong>: {s.result?.heavy_metal_pollution_index} ({s.result?.hpi_category})<br />
                    <strong>Cd</strong>: {s.result?.degree_of_contamination} ({s.result?.cd_category})
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  )
}

export default App
