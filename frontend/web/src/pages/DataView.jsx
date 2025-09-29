import React, { useEffect, useRef, useState } from 'react'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API = (path) => new URL(path, window.location.origin).toString()

export default function DataView({ samples, setSamples }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)

  const load = async () => {
    try {
      const res = await fetch(API('/api/v1/datasets/'))
      const data = await res.json()
      setSamples(data)
    } catch (e) {}
  }

  useEffect(() => {
    load()
  }, [])

  const upload = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    const f = fileRef.current?.files?.[0]
    if (!f) {
      setError('Select a CSV/JSON/PDF/Excel file.')
      return
    }
    const fd = new FormData()
    fd.append('file', f, f.name)
    setBusy(true)
    try {
      const res = await fetch(API('/api/v1/upload-and-calculate/'), {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSamples(data)
      setMessage(`Processed ${data.length} samples`)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const exportCSV = () => {
    const rows = (samples || []).map((s) => ({
      latitude: s.latitude,
      longitude: s.longitude,
      arsenic: s.arsenic,
      cadmium: s.cadmium,
      lead: s.lead,
      zinc: s.zinc,
      HPI: s.result?.heavy_metal_pollution_index,
      HPI_Category: s.result?.hpi_category,
      Cd: s.result?.degree_of_contamination,
      Cd_Category: s.result?.cd_category,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'water_samples.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.text('Water Samples Report', 14, 14)
    const head = [['Latitude','Longitude','As','Cd','Pb','Zn','HPI','HPI Cat','Cd','Cd Cat']]
    const body = (samples || []).map((s) => [
      s.latitude,
      s.longitude,
      s.arsenic,
      s.cadmium,
      s.lead,
      s.zinc,
      s.result?.heavy_metal_pollution_index,
      s.result?.hpi_category,
      s.result?.degree_of_contamination,
      s.result?.cd_category,
    ])
    autoTable(doc, { head, body, startY: 20 })
    doc.save('water_samples.pdf')
  }

  return (
    <div>
      <h2 className="text-cyan-300 font-semibold mb-3">Data</h2>
      <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.pdf,.xlsx,.xls"
          className="block w-fit text-sm text-slate-300
            file:mr-3 file:px-4 file:py-2
            file:rounded-md file:border-0
            file:bg-cyan-600 file:text-white
            hover:file:bg-cyan-500"
        />
        <button
          className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium"
          disabled={busy}
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={exportCSV}
          className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600"
        >
          Export CSV
        </button>
        <button
          type="button"
          onClick={exportPDF}
          className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600"
        >
          Export PDF
        </button>
      </form>

      {error && <div className="text-red-300 text-sm mt-2">{error}</div>}
      {message && <div className="text-green-300 text-sm mt-2">{message}</div>}

      <div className="mt-6 overflow-auto rounded-lg shadow-lg border border-slate-700">
        <table className="min-w-full text-sm text-slate-200">
          <thead className="bg-slate-800 text-cyan-300 uppercase text-xs tracking-wide">
            <tr>
              {['Lat','Lng','As','Cd','Pb','Zn','HPI','HPI Cat','Cd','Cd Cat'].map((h) => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(samples || []).map((s, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800'}>
                <td className="px-4 py-2">{s.latitude}</td>
                <td className="px-4 py-2">{s.longitude}</td>
                <td className="px-4 py-2">{s.arsenic}</td>
                <td className="px-4 py-2">{s.cadmium}</td>
                <td className="px-4 py-2">{s.lead}</td>
                <td className="px-4 py-2">{s.zinc}</td>
                <td className="px-4 py-2">{s.result?.heavy_metal_pollution_index}</td>
                <td className="px-4 py-2">{s.result?.hpi_category}</td>
                <td className="px-4 py-2">{s.result?.degree_of_contamination}</td>
                <td className="px-4 py-2">{s.result?.cd_category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
