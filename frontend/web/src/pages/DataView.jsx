import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
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
  hei: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  ehci: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  hmi: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  pmi: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
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
  download: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}

/* ═══════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════ */
const REQUIRED_COLUMNS = [
  "village_code", "state", "district", "location", "year",
  "coordinates.coordinates[0]", "coordinates.coordinates[1]",
  "parameters.pH", "parameters.EC", "parameters.CO3", "parameters.HCO3",
  "parameters.Cl", "parameters.F", "parameters.SO4", "parameters.NO3",
  "parameters.PO4", "parameters.total_hardness", "parameters.Ca", "parameters.Mg", 
  "parameters.Na", "parameters.K", "parameters.TDS", "parameters.SiO2",
  "parameters.Fe", "parameters.Mn", "parameters.Zn", "parameters.Cu", 
  "parameters.U", "parameters.As", "parameters.Pb", "parameters.Cd", 
  "parameters.Cr", "parameters.Hg", "parameters.Ni", "source"
]

const COLUMNS = [
  { key: 'location', label: 'Location', tip: 'State / District / Village' },
  { key: 'latitude', label: 'Lat', tip: 'Latitude coordinate' },
  { key: 'longitude', label: 'Lng', tip: 'Longitude coordinate' },
  { key: 'fe', label: 'Fe', tip: 'Iron (mg/L)' },
  { key: 'as', label: 'As', tip: 'Arsenic (mg/L)' },
  { key: 'u', label: 'U', tip: 'Uranium (mg/L)' },
  { key: 'hmpi', label: 'HMPI', tip: 'Heavy Metal Pollution Index' },
  { key: 'hei', label: 'HEI', tip: 'Heavy Metal Evaluation Index' },
  { key: 'pli', label: 'PLI', tip: 'Pollution Load Index' },
]

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
    blue: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', text: 'var(--color-info-400)' },
    purple: { bg: 'rgba(168, 85, 247, 0.08)', border: 'rgba(168, 85, 247, 0.2)', text: '#c084fc' },
    rose: { bg: 'rgba(244, 63, 94, 0.08)', border: 'rgba(244, 63, 94, 0.2)', text: 'var(--color-danger-400)' },
    emerald: { bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)', text: 'var(--color-success-400)' },
  }
  const c = colorMap[color] || colorMap.cyan

  return (
    <div
      className="glass-card glass-card-interactive p-5 flex items-start gap-4 spell-tilt-card spell-glow-card"
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
   DataView Component
   ═══════════════════════════════════════════ */
export default function DataView({ samples, setSamples, summary }) {
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [standard, setStandard] = useState('BIS')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 100

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1
  const visibleSamples = samples || []

  const fileRef = useRef(null)
  const addToast = useToast()

  const load = useCallback(async () => {
    try {
      const offset = (page - 1) * PAGE_SIZE
      const res = await fetch(API(`/api/v1/datasets/?limit=${PAGE_SIZE}&offset=${offset}`))
      if (res.ok) {
        const data = await res.json()
        setSamples(data.items || [])
        setTotal(data.total || 0)
      }
    } catch (e) {
      console.error(e)
    }
  }, [page, setSamples])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (summary?.invalid_count != null) {
      addToast(`Number of invalid records: ${summary.invalid_count}`, summary.invalid_count > 0 ? 'error' : 'info', 15000)
    }
  }, [summary?.invalid_count, addToast])

  const [uploadedFileId, setUploadedFileId] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState('')
  const [taskProgress, setTaskProgress] = useState(0)

  const processUpload = async (file) => {
    if (!file) {
      addToast('Please select a CSV, JSON, PDF, or Excel file.', 'error')
      return
    }
    const fd = new FormData()
    fd.append('file', file, file.name)
    setBusy(true)
    setTaskProgress(0)
    try {
      const res = await fetch(API(`/api/v1/upload/`), {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) {
        const errObj = await res.json()
        throw new Error(errObj.detail || await res.text())
      }
      const data = await res.json()
      addToast(`Parsing started for ${file.name}. Please wait...`, 'info')
      
      // Poll for task completion
      const checkStatus = async () => {
        try {
          const sres = await fetch(API(`/api/v1/tasks/${data.task_id}`));
          if (!sres.ok) throw new Error("Failed to check task status");
          const sdata = await sres.json();
          
          setTaskProgress(sdata.progress || 0);

          if (sdata.status === 'completed') {
            setUploadedFileId(sdata.result.file_id);
            setUploadedFileName(sdata.result.filename || file.name);
            setBusy(false);
            setTaskProgress(0);
            addToast(`File ${sdata.result.filename || file.name} loaded and parsed successfully. Click Calculate to process.`, 'success');
          } else if (sdata.status === 'failed') {
            setBusy(false);
            setTaskProgress(0);
            addToast(`Parsing failed: ${sdata.error_message}`, 'error');
          } else {
            // still pending or processing, poll again faster for responsive progress bar
            setTimeout(checkStatus, 400);
          }
        } catch (err) {
          setBusy(false);
          setTaskProgress(0);
          addToast(String(err), 'error');
        }
      };
      
      setTimeout(checkStatus, 400);
      
    } catch (err) {
      addToast(String(err), 'error')
      setBusy(false)
      setTaskProgress(0)
    }
  }

  const handleCalculate = async () => {
    if (!uploadedFileId) return
    setBusy(true)
    try {
      const res = await fetch(API(`/api/v1/calculate/${uploadedFileId}`), {
        method: 'POST'
      })
      if (!res.ok) {
        const errObj = await res.json()
        throw new Error(errObj.detail || await res.text())
      }
      const data = await res.json()
      addToast(`Calculation successful: ${data.rows_inserted} inserted.`, 'success')
      setUploadedFileId(null)
      setUploadedFileName('')
      await load() // Refresh data table
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

  const downloadTemplate = () => {
    const csv = Papa.unparse([REQUIRED_COLUMNS.reduce((acc, col) => ({ ...acc, [col]: '' }), {})])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cgwb_upload_template.csv'
    a.click()
    URL.revokeObjectURL(url)
    addToast('Template downloaded', 'success')
  }

  const exportCSV = () => {
    if (!samples?.length) { addToast('No data to export', 'info'); return }
    const rows = samples.map((s) => ({
      location: `${s.state || ''} / ${s.district || ''} / ${s.location || ''}`,
      latitude: s.latitude,
      longitude: s.longitude,
      Fe: s.fe ?? s.parameters?.Fe,
      As: s.as_ ?? s.parameters?.As,
      U: s.u ?? s.parameters?.U,
      HMPI: s.hmpi_bis ?? s.standards?.[standard]?.hmpi,
      HEI: s.hei_bis ?? s.standards?.[standard]?.hei,
      PLI: s.pli_bis ?? s.standards?.[standard]?.pli,
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
    const head = [['Location', 'Lat', 'Lng', 'Fe', 'As', 'U', 'HMPI', 'HEI', 'PLI']]
    const body = samples.map((s) => [
      `${s.state || ''} / ${s.district || ''} / ${s.location || ''}`,
      s.latitude || '—',
      s.longitude || '—',
      s.fe ?? s.parameters?.Fe ?? '—',
      s.as_ ?? s.parameters?.As ?? '—',
      s.u ?? s.parameters?.U ?? '—',
      s.hmpi_bis != null ? s.hmpi_bis.toFixed(2) : (s.standards?.[standard]?.hmpi?.toFixed(2) || '—'),
      s.hei_bis != null ? s.hei_bis.toFixed(2) : (s.standards?.[standard]?.hei?.toFixed(2) || '—'),
      s.pli_bis != null ? s.pli_bis.toFixed(2) : (s.standards?.[standard]?.pli?.toFixed(2) || '—'),
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

  const formatNum = (v) => (v != null && !isNaN(v) ? Number(v).toFixed(3) : '—')

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
        <StatCard
          icon={icons.hpi}
          label="Avg HMPI"
          value={summary?.avg_hmpi != null ? Number(summary.avg_hmpi).toFixed(2) : '—'}
          subtitle="Heavy Metal Pollution Index"
          color="teal"
        />
        <StatCard
          icon={icons.hei}
          label="Avg HEI"
          value={summary?.avg_hei != null ? Number(summary.avg_hei).toFixed(2) : '—'}
          subtitle="Heavy Metal Evaluation Index"
          color="blue"
        />
        <StatCard
          icon={icons.cd}
          label="Avg PLI"
          value={summary?.avg_pli != null ? Number(summary.avg_pli).toFixed(2) : '—'}
          subtitle="Pollution Load Index"
          color="amber"
        />
      </div>

      {/* ── Upload & Template Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div
          className={`upload-zone h-full ${dragOver ? 'drag-over' : ''}`}
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
              accept=".csv,.json,.xlsx,.xls,.pdf"
              className="hidden"
              aria-label="Choose file to upload"
              onChange={(e) => {
                if (e.target.files?.[0]) processUpload(e.target.files[0])
              }}
            />
          </form>
          <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[200px]">
            <div style={{ color: dragOver ? 'var(--color-primary-400)' : 'var(--color-text-500)' }}>
              {icons.dragFile}
            </div>
            <div className="text-center w-full px-4">
              {uploadedFileId ? (
                <div className="flex flex-col items-center gap-3 w-full" onClick={(e) => e.stopPropagation()}>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-success-400)' }}>
                    File Ready: {uploadedFileName}
                  </p>
                  <button 
                    className="btn btn-primary w-full max-w-[200px]" 
                    onClick={handleCalculate}
                    disabled={busy}
                  >
                    {busy ? <><span className="spinner" /> Calculating...</> : 'Calculate Data'}
                  </button>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-500)' }}>
                    Click above or upload a different file
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-300)' }}>
                    {busy ? (
                      <span className="flex flex-col items-center gap-2 justify-center w-full">
                        <span className="flex items-center gap-2 justify-center">
                          <span className="spinner" /> {
                            taskProgress === 0 ? 'Uploading File...' :
                            taskProgress < 60 ? 'Parsing & Cleaning Tables...' :
                            taskProgress < 85 ? 'Extracting Parameters...' : 'Finalizing Data...'
                          }
                        </span>
                        {taskProgress > 0 && (
                          <div className="w-full max-w-[200px] h-1.5 bg-gray-800 rounded-full overflow-hidden mt-2 border border-gray-700/50">
                            <div 
                              className="h-full rounded-full transition-all duration-300 ease-out"
                              style={{ 
                                width: `${taskProgress}%`,
                                backgroundColor: 'var(--color-primary-400)'
                              }}
                            />
                          </div>
                        )}
                        {taskProgress > 0 && (
                          <span className="text-xs font-mono" style={{ color: 'var(--color-text-400)' }}>
                            {taskProgress}% complete
                          </span>
                        )}
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* Dataset Structure / Template Preview */}
        <div className="glass-card p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: 'var(--color-text-100)' }}>Dataset Structure</h3>
            <button
              className="btn btn-secondary text-xs py-1"
              onClick={downloadTemplate}
              aria-label="Download Sample CSV"
            >
              {icons.download}
              <span>Download Sample CSV</span>
            </button>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-400)' }}>
            The backend now expects the CGWB format with {REQUIRED_COLUMNS.length} specific columns. 
            Ensure your file contains these exact headers:
          </p>
          <div className="flex-1 overflow-auto p-3 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_COLUMNS.map((col) => (
                <span key={col} className="px-2 py-1 text-[10px] font-mono rounded" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--color-text-300)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '8px',
          padding: '4px',
          marginRight: '8px'
        }}>
          {['BIS', 'WHO'].map(std => (
            <button
              key={std}
              type="button"
              onClick={() => setStandard(std)}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 500,
                cursor: 'pointer',
                background: standard === std ? 'var(--color-primary-500)' : 'transparent',
                color: standard === std ? '#fff' : 'var(--color-text-400)',
                transition: 'all 0.2s',
                border: 'none',
              }}
            >
              {std} Standard
            </button>
          ))}
        </div>
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
          {total || 0} records
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
              visibleSamples.map((s, i) => (
                <tr key={s.id || i} className="spell-stagger-row" style={{ opacity: s.validation_issues?.length > 0 ? 0.6 : 1 }}>
                  <td>
                    <div className="text-xs">
                      <div className="font-medium flex items-center gap-1" style={{ color: 'var(--color-text-100)' }}>
                        {s.location || '—'}
                        {s.validation_issues?.length > 0 && (
                          <span title={s.validation_issues.join(', ')} style={{ color: 'var(--color-danger-400)', cursor: 'help' }}>
                            {icons.alert}
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--color-text-500)' }}>{s.district ? `${s.state}, ${s.district}` : (s.state || '—')}</div>
                    </div>
                  </td>
                  <td className="font-mono-nums">{formatNum(s.latitude)}</td>
                  <td className="font-mono-nums">{formatNum(s.longitude)}</td>
                  <td className="font-mono-nums">{formatNum(s.fe ?? s.parameters?.Fe)}</td>
                  <td className="font-mono-nums">{formatNum(s.as_ ?? s.parameters?.As)}</td>
                  <td className="font-mono-nums">{formatNum(s.u ?? s.parameters?.U)}</td>
                  <td className="font-mono-nums" style={{ fontWeight: 600 }}>
                    {formatNum(s.hmpi_bis ?? s.standards?.[standard]?.hmpi)}
                  </td>
                  <td className="font-mono-nums">{formatNum(s.hei_bis ?? s.standards?.[standard]?.hei)}</td>
                  <td className="font-mono-nums">{formatNum(s.pli_bis ?? s.standards?.[standard]?.pli)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 glass-card text-xs">
          <span style={{ color: 'var(--color-text-400)' }}>
            Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary px-3 py-1"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </button>
            <span style={{ color: 'var(--color-text-100)' }} className="px-2 font-medium">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-secondary px-3 py-1"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
