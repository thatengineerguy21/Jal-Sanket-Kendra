import React, { useState } from 'react'
import { useToast } from '../App.jsx'

const API = (path) => new URL(path, window.location.origin).toString()

/* ═══════════════════════════════════════════
   Metal Input Configuration
   ═══════════════════════════════════════════ */
const METALS = [
  { key: 'As', name: 'Arsenic' },
  { key: 'Cd', name: 'Cadmium' },
  { key: 'Pb', name: 'Lead' },
  { key: 'Zn', name: 'Zinc' },
  { key: 'Fe', name: 'Iron' },
  { key: 'Mn', name: 'Manganese' },
  { key: 'Cu', name: 'Copper' },
  { key: 'Cr', name: 'Chromium' },
  { key: 'Ni', name: 'Nickel' },
  { key: 'Hg', name: 'Mercury' },
  { key: 'U',  name: 'Uranium' },
]

/* ═══════════════════════════════════════════
   Index Result Configuration
   ═══════════════════════════════════════════ */
const INDEX_CONFIG = [
  { key: 'HPI',  label: 'Heavy Metal Pollution Index',   color: 'teal' },
  { key: 'HEI',  label: 'Heavy Metal Evaluation Index',  color: 'blue' },
  { key: 'CD',   label: 'Contamination Index',            color: 'amber' },
  { key: 'EHCI', label: 'Enrichment & Health Concern',    color: 'purple' },
  { key: 'HMI',  label: 'Heavy Metal Index',              color: 'rose' },
  { key: 'PMI',  label: 'Pollution Metal Index',           color: 'emerald' },
]

const COLOR_MAP = {
  teal:    { bg: 'rgba(20, 184, 166, 0.08)',  border: 'rgba(20, 184, 166, 0.2)',  text: 'var(--color-primary-400)',  glow: 'rgba(20, 184, 166, 0.15)' },
  blue:    { bg: 'rgba(59, 130, 246, 0.08)',   border: 'rgba(59, 130, 246, 0.2)',  text: 'var(--color-info-400)',     glow: 'rgba(59, 130, 246, 0.15)' },
  amber:   { bg: 'rgba(251, 191, 36, 0.08)',   border: 'rgba(251, 191, 36, 0.2)',  text: 'var(--color-warning-400)',  glow: 'rgba(251, 191, 36, 0.15)' },
  purple:  { bg: 'rgba(168, 85, 247, 0.08)',   border: 'rgba(168, 85, 247, 0.2)',  text: '#c084fc',                  glow: 'rgba(168, 85, 247, 0.15)' },
  rose:    { bg: 'rgba(244, 63, 94, 0.08)',    border: 'rgba(244, 63, 94, 0.2)',   text: 'var(--color-danger-400)',   glow: 'rgba(244, 63, 94, 0.15)' },
  emerald: { bg: 'rgba(34, 197, 94, 0.08)',    border: 'rgba(34, 197, 94, 0.2)',   text: 'var(--color-success-400)',  glow: 'rgba(34, 197, 94, 0.15)' },
}

/* ── Risk badge helper ── */
function getRiskBadge(key, value) {
  if (value == null || isNaN(value)) return null

  let level = 'Low'
  let badgeClass = 'badge-low'

  if (key === 'HPI') {
    if (value > 100) { level = 'High'; badgeClass = 'badge-high' }
    else if (value > 50) { level = 'Moderate'; badgeClass = 'badge-moderate' }
  } else if (key === 'CD' || key === 'HEI') {
    if (value > 3) { level = 'High'; badgeClass = 'badge-high' }
    else if (value > 1) { level = 'Moderate'; badgeClass = 'badge-moderate' }
  } else {
    if (value > 5) { level = 'High'; badgeClass = 'badge-high' }
    else if (value > 2) { level = 'Moderate'; badgeClass = 'badge-moderate' }
  }

  return (
    <span className={`badge ${badgeClass}`} style={{ marginTop: '6px' }}>
      <span className="badge-dot" />
      {level}
    </span>
  )
}

/* ── Inline SVG Icons ── */
const CalcIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="16" y2="18"/>
  </svg>
)

const FlaskIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 3h6v7l5 8a2 2 0 0 1-1.7 3H5.7a2 2 0 0 1-1.7-3l5-8V3z"/><line x1="9" y1="3" x2="15" y2="3"/>
  </svg>
)

/* ═══════════════════════════════════════════
   QuickCalcView Component
   ═══════════════════════════════════════════ */
export default function QuickCalcView() {
  const addToast = useToast()
  const [metals, setMetals] = useState(() => {
    const init = {}
    METALS.forEach((m) => { init[m.key] = '' })
    return init
  })
  const [standard, setStandard] = useState('BIS')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleInput = (key, val) => {
    setMetals((prev) => ({ ...prev, [key]: val }))
  }

  const handleCalculate = async () => {
    // Build numeric metals object, skipping empty fields
    const numericMetals = {}
    for (const m of METALS) {
      const v = metals[m.key]
      if (v !== '' && v != null) {
        const n = parseFloat(v)
        if (isNaN(n) || n < 0) {
          addToast(`Invalid value for ${m.name} (${m.key})`, 'error')
          return
        }
        numericMetals[m.key] = n
      }
    }

    if (Object.keys(numericMetals).length === 0) {
      addToast('Please enter at least one metal concentration', 'error')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(API('/api/v1/quickcalc/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metals: numericMetals, standard }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResults(data.indices)
      addToast('Indices calculated successfully', 'success')
    } catch (err) {
      addToast(`Calculation failed: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    const cleared = {}
    METALS.forEach((m) => { cleared[m.key] = '' })
    setMetals(cleared)
    setResults(null)
  }

  /* ── Styles ── */
  const segmentContainerStyle = {
    display: 'inline-flex',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-bg-700)',
    overflow: 'hidden',
    background: 'var(--color-bg-800)',
  }

  const segmentBtnStyle = (active) => ({
    padding: '8px 24px',
    border: 'none',
    background: active ? 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))' : 'transparent',
    color: active ? 'white' : 'var(--color-text-400)',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    fontFamily: 'var(--font-sans)',
  })

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-50)' }}>
          Quick Calculator
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-400)' }}>
          Enter metal concentrations to instantly compute pollution indices
        </p>
      </div>

      {/* ── Input Section ── */}
      <div
        className="glass-card"
        style={{ padding: 'var(--space-6)' }}
      >
        {/* Standard Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <FlaskIcon />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-200)' }}>
              Reference Standard
            </span>
          </div>
          <div style={segmentContainerStyle}>
            <button
              style={segmentBtnStyle(standard === 'BIS')}
              onClick={() => setStandard('BIS')}
            >
              BIS
            </button>
            <button
              style={segmentBtnStyle(standard === 'WHO')}
              onClick={() => setStandard('WHO')}
            >
              WHO
            </button>
          </div>
        </div>

        {/* Separator */}
        <div style={{ borderTop: '1px solid var(--glass-border)', marginBottom: 'var(--space-5)' }} />

        {/* Metal Input Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {METALS.map((m) => (
            <div key={m.key}>
              <label
                style={{
                  display: 'block',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-400)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {m.key} <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--color-text-500)' }}>— {m.name}</span>
              </label>
              <input
                className="input"
                type="number"
                min="0"
                step="any"
                placeholder="μg/L"
                value={metals[m.key]}
                onChange={(e) => handleInput(m.key, e.target.value)}
                aria-label={`${m.name} concentration`}
              />
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          <button
            className="btn btn-primary"
            onClick={handleCalculate}
            disabled={loading}
            style={{ minWidth: '140px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" />
                Computing…
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalcIcon />
                Calculate
              </span>
            )}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleClear}
            disabled={loading}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* ── Results Section ── */}
      {results && (
        <div>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-text-100)' }}>
            Pollution Index Results
            <span
              className="badge badge-info"
              style={{ marginLeft: '12px', fontSize: 'var(--text-xs)', verticalAlign: 'middle' }}
            >
              <span className="badge-dot" />
              {standard}
            </span>
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 'var(--space-4)',
          }}
            className="stagger-children"
          >
            {INDEX_CONFIG.map((idx) => {
              const c = COLOR_MAP[idx.color]
              const val = results[idx.key.toLowerCase()]

              return (
                <div
                  key={idx.key}
                  className="glass-card glass-card-interactive"
                  style={{
                    padding: 'var(--space-5)',
                    borderColor: c.border,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    {/* Color accent bar */}
                    <div
                      style={{
                        width: '4px',
                        height: '48px',
                        borderRadius: 'var(--radius-full)',
                        background: c.text,
                        flexShrink: 0,
                        marginTop: '2px',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 600,
                          color: 'var(--color-text-500)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '4px',
                        }}
                      >
                        {idx.key}
                      </p>
                      <p
                        className="font-mono-nums"
                        style={{
                          fontSize: 'var(--text-2xl)',
                          fontWeight: 700,
                          color: 'var(--color-text-50)',
                          lineHeight: 1.2,
                        }}
                      >
                        {val != null && !isNaN(val) ? Number(val).toFixed(2) : '—'}
                      </p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-400)', marginTop: '2px' }}>
                        {idx.label}
                      </p>
                      {getRiskBadge(idx.key, val)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
