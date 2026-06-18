import React, { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useToast } from '../App.jsx'

const API = (path) => new URL(path, window.location.origin).toString()

/* ═══════════════════════════════════════════
   SVG Icons
   ═══════════════════════════════════════════ */
const icons = {
  upload: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/>
    </svg>
  ),
  clear: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  ),
  csv: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  pdf: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  empty: (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  predict: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
}

/* ═══════════════════════════════════════════
   Risk Badge
   ═══════════════════════════════════════════ */
function RiskBadge({ category }) {
  if (!category) return <span style={{ color: 'var(--color-text-500)' }}>—</span>

  const lower = category.toLowerCase()
  let badgeClass = 'badge-info'
  if (lower.includes('low')) badgeClass = 'badge-low'
  else if (lower.includes('moderate') || lower.includes('medium')) badgeClass = 'badge-moderate'
  else if (lower.includes('high') || lower.includes('critical') || lower.includes('severe')) badgeClass = 'badge-high'

  return (
    <span className={`badge ${badgeClass}`}>
      <span className="badge-dot" />
      {category}
    </span>
  )
}

/* ═══════════════════════════════════════════
   PredictView Component
   ═══════════════════════════════════════════ */
export default function PredictView({ preds, setPreds }) {
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const addToast = useToast()

  const processUpload = async (file) => {
    if (!file) {
      addToast('Please select a CSV or JSON file.', 'error')
      return
    }
    const fd = new FormData()
    fd.append('file', file, file.name)
    setBusy(true)
    try {
      const res = await fetch(API('/api/v1/predict-hotspots/'), {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setPreds(data)
      addToast(`Predicted ${data.length} hotspots`, 'success')
    } catch (err) {
      addToast(String(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const upload = async (e) => {
    e.preventDefault()
    const f = fileRef.current?.files?.[0]
    await processUpload(f)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) processUpload(file)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const exportCSV = () => {
    if (!preds?.length) { addToast('No predictions to export', 'info'); return }
    const rows = preds.map((p) => ({
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
    addToast('CSV exported successfully', 'success')
  }

  const exportPDF = () => {
    if (!preds?.length) { addToast('No predictions to export', 'info'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Hotspot Predictions — Jal Sanket Kendra', 14, 14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)
    const head = [['Latitude', 'Longitude', 'Risk Score', 'Risk Category']]
    const body = preds.map((p) => [
      p.latitude,
      p.longitude,
      p.risk_score,
      p.risk_category,
    ])
    autoTable(doc, {
      head,
      body,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 245, 250] },
    })
    doc.save('hotspot_predictions.pdf')
    addToast('PDF exported successfully', 'success')
  }

  const formatNum = (v) => (v != null && !isNaN(v) ? Number(v).toFixed(4) : '—')
  const formatScore = (v) => (v != null && !isNaN(v) ? Number(v).toFixed(2) : '—')

  // Stats
  const highCount = (preds || []).filter((p) => {
    const c = (p.risk_category || '').toLowerCase()
    return c.includes('high') || c.includes('critical') || c.includes('severe')
  }).length

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-50)' }}>
          Hotspot Prediction
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-400)' }}>
          Upload water quality data to predict contamination hotspots using ML models
        </p>
      </div>

      {/* ── Quick Stats ── */}
      {preds?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          <div className="glass-card p-4 flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-cyan-400)' }}
            >
              {icons.predict}
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>Total Predictions</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text-50)' }}>{preds.length}</p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(244, 63, 94, 0.1)', color: 'var(--color-danger-400)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>High Risk Areas</p>
              <p className="text-xl font-bold" style={{ color: highCount > 0 ? 'var(--color-danger-400)' : 'var(--color-text-50)' }}>
                {highCount}
              </p>
            </div>
          </div>
          <div className="glass-card p-4 flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--color-success-400)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>Safe Areas</p>
              <p className="text-xl font-bold" style={{ color: 'var(--color-text-50)' }}>
                {preds.length - highCount}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Upload Zone ── */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload prediction data file"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
      >
        <form onSubmit={upload} onClick={(e) => e.stopPropagation()}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            className="hidden"
            aria-label="Choose prediction file"
            onChange={(e) => {
              if (e.target.files?.[0]) processUpload(e.target.files[0])
            }}
          />
        </form>
        <div className="flex flex-col items-center gap-3">
          <div style={{ color: dragOver ? 'var(--color-primary-400)' : 'var(--color-text-500)' }}>
            {icons.upload}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-300)' }}>
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" /> Running predictions...
                </span>
              ) : (
                <>
                  <span style={{ color: 'var(--color-primary-400)' }}>Click to upload</span>
                  {' '}or drag and drop
                </>
              )}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-500)' }}>
              CSV or JSON files with location and water quality data
            </p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-danger"
          onClick={() => { setPreds([]); addToast('Predictions cleared', 'info') }}
          aria-label="Clear predictions"
        >
          {icons.clear}
          <span>Clear</span>
        </button>
        <button
          className="btn btn-secondary"
          onClick={exportCSV}
          aria-label="Export as CSV"
        >
          {icons.csv}
          <span>Export CSV</span>
        </button>
        <button
          className="btn btn-secondary"
          onClick={exportPDF}
          aria-label="Export as PDF"
        >
          {icons.pdf}
          <span>Export PDF</span>
        </button>
        <span className="ml-auto text-xs" style={{ color: 'var(--color-text-500)' }}>
          {preds?.length || 0} predictions
        </span>
      </div>

      {/* ── Data Table ── */}
      <div className="data-table-wrapper overflow-auto" style={{ maxHeight: '55vh' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th title="Latitude coordinate">Latitude</th>
              <th title="Longitude coordinate">Longitude</th>
              <th title="ML-predicted risk score">Risk Score</th>
              <th title="Risk severity classification">Risk Category</th>
            </tr>
          </thead>
          <tbody>
            {(!preds || preds.length === 0) ? (
              <tr>
                <td colSpan={4} className="text-center" style={{ padding: 'var(--space-12) var(--space-4)' }}>
                  <div className="flex flex-col items-center gap-3">
                    {icons.empty}
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-400)' }}>
                      No predictions yet
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>
                      Upload a CSV or JSON file to predict contamination hotspots
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              preds.map((p, i) => (
                <tr key={i}>
                  <td className="font-mono-nums">{formatNum(p.latitude)}</td>
                  <td className="font-mono-nums">{formatNum(p.longitude)}</td>
                  <td className="font-mono-nums" style={{ fontWeight: 600 }}>{formatScore(p.risk_score)}</td>
                  <td><RiskBadge category={p.risk_category} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
