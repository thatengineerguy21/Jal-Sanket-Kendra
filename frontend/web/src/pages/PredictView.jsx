import React, { useState, useRef } from 'react'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const API = (path) => new URL(path, window.location.origin).toString()

export default function PredictView({ preds, setPreds }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const fileRef = useRef(null)

  const upload = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    const f = fileRef.current?.files?.[0]
    if (!f) {
      setError('Select a CSV/JSON file.')
      return
    }
    const fd = new FormData()
    fd.append('file', f, f.name)
    setBusy(true)
    try {
      const res = await fetch(API('/api/v1/predict-hotspots/'), {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPreds(data)
      setMessage(`Predicted ${data.length} hotspots`)
    } catch (err) {
      setError(String(err))
    } finally {
      setBusy(false)
    }
  }

  const exportCSV = () => {
    const rows = (preds || []).map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      risk_score: p.risk_score,
      risk_category: p.risk_category,
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'hotspot_predictions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.text('Hotspot Predictions', 14, 14)
    const head = [['Latitude', 'Longitude', 'Risk Score', 'Risk Category']]
    const body = (preds || []).map((p) => [
      p.latitude,
      p.longitude,
      p.risk_score,
      p.risk_category,
    ])
    autoTable(doc, { head, body, startY: 20 })
    doc.save('hotspot_predictions.pdf')
  }

  return (
    <div>
      <h2 className="text-cyan-300 font-semibold mb-3">Predict Hotspots</h2>
      <form onSubmit={upload} className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
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
          {busy ? 'Predicting…' : 'Upload'}
        </button>
        <button
          type="button"
          onClick={() => setPreds([])}
          className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600"
        >
          Clear
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

      <div className="mt-6 text-sm text-slate-300 rounded-lg border border-slate-700 divide-y divide-slate-800">
        {(preds || []).slice(0, 10).map((p, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 px-4 py-2">
            <div>{p.latitude}</div>
            <div>{p.longitude}</div>
            <div>{p.risk_score}</div>
            <div>{p.risk_category}</div>
          </div>
        ))}
        {preds?.length === 0 && (
          <div className="px-4 py-3 text-slate-400">No predictions yet.</div>
        )}
      </div>
    </div>
  )
}
