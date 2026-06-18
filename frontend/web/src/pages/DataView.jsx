import React, { useEffect, useRef, useState, useCallback } from 'react'
import Papa from 'papaparse'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useToast } from '../App.jsx'

const API = (path) => new URL(path, window.location.origin).toString()

/* ═══════════════════════════════════════════
   SVG Icons
   ═══════════════════════════════════════════ */
const icons = {
  samples: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  hpi: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  cd: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
  dragFile: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/><polyline points="16 16 12 12 8 16"/>
    </svg>
  ),
}

/* ═══════════════════════════════════════════
   Category Badge
   ═══════════════════════════════════════════ */
function CategoryBadge({ category }) {
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
   Stat Card
   ═══════════════════════════════════════════ */
function StatCard({ icon, label, value, subtitle, color }) {
  const colorMap = {
    cyan: { bg: 'rgba(6, 182, 212, 0.08)', border: 'rgba(6, 182, 212, 0.2)', text: 'var(--color-cyan-400)' },
    amber: { bg: 'rgba(251, 191, 36, 0.08)', border: 'rgba(251, 191, 36, 0.2)', text: 'var(--color-warning-400)' },
    teal: { bg: 'rgba(20, 184, 166, 0.08)', border: 'rgba(20, 184, 166, 0.2)', text: 'var(--color-primary-400)' },
  }
  const c = colorMap[color] || colorMap.cyan

  return (
    <div
      className="glass-card glass-card-interactive p-5 flex items-start gap-4"
      style={{ borderColor: c.border }}
    >
      <div
        className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
        style={{ background: c.bg, color: c.text }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-500)' }}>
          {label}
        </p>
        <p className="text-2xl font-bold font-mono-nums" style={{ color: 'var(--color-text-50)', lineHeight: 1.2 }}>
          {value ?? '—'}
        </p>
        {subtitle && (
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-400)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Column Definitions
   ═══════════════════════════════════════════ */
const COLUMNS = [
  { key: 'latitude', label: 'Lat', tip: 'Latitude coordinate' },
  { key: 'longitude', label: 'Lng', tip: 'Longitude coordinate' },
  { key: 'arsenic', label: 'As', tip: 'Arsenic (μg/L)' },
  { key: 'cadmium', label: 'Cd', tip: 'Cadmium (μg/L)' },
  { key: 'lead', label: 'Pb', tip: 'Lead (μg/L)' },
  { key: 'zinc', label: 'Zn', tip: 'Zinc (μg/L)' },
  { key: 'hpi', label: 'HPI', tip: 'Heavy Metal Pollution Index' },
  { key: 'hpi_cat', label: 'HPI Category', tip: 'Pollution severity level' },
  { key: 'cd_val', label: 'Cd Index', tip: 'Degree of Contamination' },
  { key: 'cd_cat', label: 'Cd Category', tip: 'Contamination severity' },
]

/* ═══════════════════════════════════════════
   DataView Component
   ═══════════════════════════════════════════ */
export default function DataView({ samples, setSamples, summary }) {
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const addToast = useToast()

  const load = async () => {
    try {
      const res = await fetch(API('/api/v1/datasets/'))
      const data = await res.json()
      setSamples(data)
    } catch (e) {
      addToast('Failed to load datasets', 'error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const processUpload = async (file) => {
    if (!file) {
      addToast('Please select a CSV, JSON, PDF, or Excel file.', 'error')
      return
    }
    const fd = new FormData()
    fd.append('file', file, file.name)
    setBusy(true)
    try {
      const res = await fetch(API('/api/v1/upload-and-calculate/'), {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSamples(data)
      addToast(`Successfully processed ${data.length} samples`, 'success')
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
    if (!samples?.length) { addToast('No data to export', 'info'); return }
    const rows = samples.map((s) => ({
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
    addToast('CSV exported successfully', 'success')
  }

  const exportPDF = () => {
    if (!samples?.length) { addToast('No data to export', 'info'); return }
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Water Quality Report — Jal Sanket Kendra', 14, 14)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)
    const head = [['Lat', 'Lng', 'As', 'Cd', 'Pb', 'Zn', 'HPI', 'HPI Cat', 'Cd Index', 'Cd Cat']]
    const body = samples.map((s) => [
      s.latitude, s.longitude, s.arsenic, s.cadmium, s.lead, s.zinc,
      s.result?.heavy_metal_pollution_index,
      s.result?.hpi_category,
      s.result?.degree_of_contamination,
      s.result?.cd_category,
    ])
    autoTable(doc, {
      head,
      body,
      startY: 28,
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 245, 250] },
    })
    doc.save('water_samples.pdf')
    addToast('PDF exported successfully', 'success')
  }

  const formatNum = (v) => (v != null && !isNaN(v) ? Number(v).toFixed(2) : '—')

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-50)' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-400)' }}>
          Water quality monitoring &amp; heavy metal pollution analysis
        </p>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
        <StatCard
          icon={icons.samples}
          label="Total Samples"
          value={summary?.count ?? 0}
          subtitle="Collected data points"
          color="cyan"
        />
        <StatCard
          icon={icons.hpi}
          label="Avg HPI"
          value={summary?.avg_hpi != null ? Number(summary.avg_hpi).toFixed(2) : '—'}
          subtitle="Heavy Metal Pollution Index"
          color="amber"
        />
        <StatCard
          icon={icons.cd}
          label="Avg Cd Index"
          value={summary?.avg_cd != null ? Number(summary.avg_cd).toFixed(2) : '—'}
          subtitle="Degree of Contamination"
          color="teal"
        />
      </div>

      {/* ── Upload Zone ── */}
      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload data file"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
      >
        <form onSubmit={upload} onClick={(e) => e.stopPropagation()}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.pdf,.xlsx,.xls"
            className="hidden"
            aria-label="Choose file to upload"
            onChange={(e) => {
              if (e.target.files?.[0]) processUpload(e.target.files[0])
            }}
          />
        </form>
        <div className="flex flex-col items-center gap-3">
          <div style={{ color: dragOver ? 'var(--color-primary-400)' : 'var(--color-text-500)' }}>
            {icons.dragFile}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-300)' }}>
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" /> Processing...
                </span>
              ) : (
                <>
                  <span style={{ color: 'var(--color-primary-400)' }}>Click to upload</span>
                  {' '}or drag and drop
                </>
              )}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-500)' }}>
              CSV, JSON, PDF, Excel files supported
            </p>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-secondary"
          onClick={load}
          aria-label="Refresh data"
        >
          {icons.refresh}
          <span>Refresh</span>
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
          {samples?.length || 0} records
        </span>
      </div>

      {/* ── Data Table ── */}
      <div className="data-table-wrapper overflow-auto" style={{ maxHeight: '60vh' }}>
        <table className="data-table">
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} title={col.tip}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(!samples || samples.length === 0) ? (
              <tr>
                <td colSpan={COLUMNS.length} className="text-center" style={{ padding: 'var(--space-12) var(--space-4)' }}>
                  <div className="flex flex-col items-center gap-3">
                    {icons.empty}
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-400)' }}>
                      No data available
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>
                      Upload a file to get started with water quality analysis
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              samples.map((s, i) => (
                <tr key={s.id || i}>
                  <td className="font-mono-nums">{formatNum(s.latitude)}</td>
                  <td className="font-mono-nums">{formatNum(s.longitude)}</td>
                  <td className="font-mono-nums">{formatNum(s.arsenic)}</td>
                  <td className="font-mono-nums">{formatNum(s.cadmium)}</td>
                  <td className="font-mono-nums">{formatNum(s.lead)}</td>
                  <td className="font-mono-nums">{formatNum(s.zinc)}</td>
                  <td className="font-mono-nums" style={{ fontWeight: 600 }}>
                    {formatNum(s.result?.heavy_metal_pollution_index)}
                  </td>
                  <td><CategoryBadge category={s.result?.hpi_category} /></td>
                  <td className="font-mono-nums" style={{ fontWeight: 600 }}>
                    {formatNum(s.result?.degree_of_contamination)}
                  </td>
                  <td><CategoryBadge category={s.result?.cd_category} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
