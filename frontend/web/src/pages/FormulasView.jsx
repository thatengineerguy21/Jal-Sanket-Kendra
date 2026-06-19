import React, { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════
   KaTeX CDN Configuration
   ═══════════════════════════════════════════ */
const KATEX_VERSION = '0.16.11'
const KATEX_CSS = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.css`
const KATEX_JS = `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist/katex.min.js`

/* ═══════════════════════════════════════════
   Color Map — matches QuickCalcView
   ═══════════════════════════════════════════ */
const COLOR_MAP = {
  teal:    { bg: 'rgba(20, 184, 166, 0.08)',  border: 'rgba(20, 184, 166, 0.2)',  text: 'var(--color-primary-400)',  glow: 'rgba(20, 184, 166, 0.15)', solid: '#14b8a6' },
  blue:    { bg: 'rgba(59, 130, 246, 0.08)',   border: 'rgba(59, 130, 246, 0.2)',  text: 'var(--color-info-400)',     glow: 'rgba(59, 130, 246, 0.15)', solid: '#3b82f6' },
  amber:   { bg: 'rgba(251, 191, 36, 0.08)',   border: 'rgba(251, 191, 36, 0.2)',  text: 'var(--color-warning-400)',  glow: 'rgba(251, 191, 36, 0.15)', solid: '#fbbf24' },
  purple:  { bg: 'rgba(168, 85, 247, 0.08)',   border: 'rgba(168, 85, 247, 0.2)',  text: '#c084fc',                  glow: 'rgba(168, 85, 247, 0.15)', solid: '#a855f7' },
  rose:    { bg: 'rgba(244, 63, 94, 0.08)',    border: 'rgba(244, 63, 94, 0.2)',   text: 'var(--color-danger-400)',   glow: 'rgba(244, 63, 94, 0.15)',  solid: '#f43f5e' },
  emerald: { bg: 'rgba(34, 197, 94, 0.08)',    border: 'rgba(34, 197, 94, 0.2)',   text: 'var(--color-success-400)',  glow: 'rgba(34, 197, 94, 0.15)',  solid: '#22c55e' },
}

/* ═══════════════════════════════════════════
   Index Definitions
   ═══════════════════════════════════════════ */
const INDICES = [
  {
    id: 'hpi',
    key: 'HPI',
    title: 'Heavy Metal Pollution Index',
    color: 'teal',
    description: 'Evaluates overall water quality by weighting each metal\'s deviation from its ideal-to-permissible range. Developed by Mohan et al., it assigns higher importance to metals with stricter permissible limits.',
    formulas: [
      { label: 'Unit Weightage', tex: 'W_i = \\dfrac{1}{S_i}' },
      { label: 'Sub-index (standard)', tex: 'Q_i = 100 \\times \\dfrac{O_i - I_i}{S_i - I_i} \\quad \\text{when } S_i \\neq I_i, \\; \\text{clamped} \\geq 0' },
      { label: 'Sub-index (fallback)', tex: 'Q_i = 100 \\times \\max\\!\\left(0,\\; \\dfrac{O_i}{S_i} - 1\\right) \\quad \\text{when } S_i = I_i' },
      { label: 'HPI', tex: '\\text{HPI} = \\dfrac{\\displaystyle\\sum_{i=1}^{n} W_i \\cdot Q_i}{\\displaystyle\\sum_{i=1}^{n} W_i}' },
    ],
    classification: [
      { range: '< 25', level: 'Excellent', color: '#4ade80' },
      { range: '25 – 50', level: 'Good', color: '#22d3ee' },
      { range: '50 – 75', level: 'Poor', color: '#fbbf24' },
      { range: '75 – 100', level: 'Very Poor', color: '#fb923c' },
      { range: '> 100', level: 'Unsuitable', color: '#f43f5e' },
    ],
  },
  {
    id: 'cd',
    key: 'CD',
    title: 'Contamination Index',
    subtitle: 'Degree of Contamination',
    color: 'amber',
    description: 'Sums the excess contamination factor for each metal above its permissible limit. A value of zero indicates all metals are within safe limits.',
    formulas: [
      { label: 'CD', tex: '\\text{CD} = \\sum_{i=1}^{n} \\max\\!\\left(\\dfrac{O_i}{S_i} - 1,\\; 0\\right)' },
    ],
    classification: [
      { range: '< 1', level: 'Low', color: '#4ade80' },
      { range: '1 – 3', level: 'Moderate', color: '#fbbf24' },
      { range: '> 3', level: 'High', color: '#f43f5e' },
    ],
  },
  {
    id: 'hei',
    key: 'HEI',
    title: 'Heavy Metal Evaluation Index',
    color: 'blue',
    description: 'A straightforward summation of each metal\'s ratio to its permissible limit. Unlike CD, it does not subtract 1, capturing the total metal burden relative to safe thresholds.',
    formulas: [
      { label: 'HEI', tex: '\\text{HEI} = \\sum_{i=1}^{n} \\dfrac{O_i}{S_i}' },
    ],
    classification: null,
  },
  {
    id: 'ehci',
    key: 'EHCI',
    title: 'Entropy-Based Heavy Metal Contamination Index',
    color: 'purple',
    description: 'Uses information entropy to derive objective weights for each metal, reducing subjective bias. Metals with more variable concentrations across samples receive higher weights.',
    formulas: [
      { label: 'Sub-index', tex: 'Q_i = 100 \\times \\dfrac{O_i - I_i}{S_i - I_i}' },
      { label: 'EHCI', tex: '\\text{EHCI} = \\sum_{i=1}^{n} w_i \\cdot Q_i' },
    ],
    note: 'Metals where S_i = I_i (No Relaxation) are excluded from the calculation.',
    weights: {
      title: 'Entropy-Derived Weights',
      data: [
        { metal: 'As', name: 'Arsenic', weight: 0.179 },
        { metal: 'Hg', name: 'Mercury', weight: 0.179 },
        { metal: 'Cd', name: 'Cadmium', weight: 0.143 },
        { metal: 'Pb', name: 'Lead', weight: 0.125 },
        { metal: 'Ni', name: 'Nickel', weight: 0.107 },
        { metal: 'Cr', name: 'Chromium', weight: 0.089 },
        { metal: 'Cu', name: 'Copper', weight: 0.054 },
        { metal: 'U', name: 'Uranium', weight: 0.054 },
        { metal: 'Mn', name: 'Manganese', weight: 0.036 },
        { metal: 'Zn', name: 'Zinc', weight: 0.018 },
        { metal: 'Fe', name: 'Iron', weight: 0.018 },
      ],
    },
  },
  {
    id: 'hmi',
    key: 'HMI',
    title: 'Heavy Metal Index',
    subtitle: 'Toxicity-Weighted',
    color: 'rose',
    description: 'Weights each metal by its relative toxicity to human health, giving greater influence to highly toxic metals like Arsenic and Mercury.',
    formulas: [
      { label: 'HMI', tex: '\\text{HMI} = \\sum_{i=1}^{n} W_i \\times \\dfrac{O_i}{S_i}' },
    ],
    weights: {
      title: 'Toxicity Weights',
      data: [
        { metal: 'As', name: 'Arsenic', weight: 0.17 },
        { metal: 'Hg', name: 'Mercury', weight: 0.17 },
        { metal: 'Cd', name: 'Cadmium', weight: 0.14 },
        { metal: 'Pb', name: 'Lead', weight: 0.13 },
        { metal: 'Ni', name: 'Nickel', weight: 0.10 },
        { metal: 'Cr', name: 'Chromium', weight: 0.08 },
        { metal: 'Cu', name: 'Copper', weight: 0.06 },
        { metal: 'U', name: 'Uranium', weight: 0.05 },
        { metal: 'Mn', name: 'Manganese', weight: 0.04 },
        { metal: 'Zn', name: 'Zinc', weight: 0.03 },
        { metal: 'Fe', name: 'Iron', weight: 0.03 },
      ],
    },
  },
  {
    id: 'pmi',
    key: 'PMI',
    title: 'PCA-Based Metal Index',
    color: 'emerald',
    description: 'Applies Principal Component Analysis factor scores to weight metals based on their statistical co-occurrence patterns, then normalizes to a 0–1 scale.',
    formulas: [
      { label: 'Raw Score', tex: '\\text{NSPMI} = \\sum_{i=1}^{n} f_i \\times \\dfrac{O_i}{V_t}' },
      { label: 'Normalized PMI', tex: '\\text{PMI} = \\dfrac{\\text{NSPMI} - \\text{NSPMI}_{\\min}}{\\text{NSPMI}_{\\max} - \\text{NSPMI}_{\\min}} \\;,\\quad \\text{clamped} \\geq 0' },
      { label: 'Bounds', tex: '\\text{NSPMI}_{\\min} = 0.03 \\;,\\quad \\text{NSPMI}_{\\max} = 0.16' },
    ],
    weights: {
      title: 'PCA Factor Scores',
      data: [
        { metal: 'As', name: 'Arsenic', weight: 0.16 },
        { metal: 'Hg', name: 'Mercury', weight: 0.16 },
        { metal: 'Cd', name: 'Cadmium', weight: 0.13 },
        { metal: 'Pb', name: 'Lead', weight: 0.12 },
        { metal: 'Ni', name: 'Nickel', weight: 0.10 },
        { metal: 'Cr', name: 'Chromium', weight: 0.09 },
        { metal: 'Cu', name: 'Copper', weight: 0.07 },
        { metal: 'U', name: 'Uranium', weight: 0.06 },
        { metal: 'Mn', name: 'Manganese', weight: 0.05 },
        { metal: 'Zn', name: 'Zinc', weight: 0.03 },
        { metal: 'Fe', name: 'Iron', weight: 0.03 },
      ],
    },
  },
]

/* Hotspot risk section */
const HOTSPOT_CLASSIFICATION = [
  { range: '< 25', level: 'Low Risk', color: '#4ade80' },
  { range: '25 – 50', level: 'Moderate Risk', color: '#fbbf24' },
  { range: '50 – 75', level: 'High Risk', color: '#fb923c' },
  { range: '≥ 75', level: 'Critical Risk', color: '#f43f5e' },
]

/* Variable glossary */
const GLOSSARY = [
  { symbol: 'O_i', desc: 'Observed metal concentration (mg/L)' },
  { symbol: 'S_i', desc: 'Permissible limit — Maximum Permissible Limit from BIS/WHO' },
  { symbol: 'I_i', desc: 'Ideal/desirable limit — Acceptable Limit' },
  { symbol: 'W_i', desc: 'Unit weightage = 1/Sᵢ' },
  { symbol: 'w_i', desc: 'Entropy-derived weight for each metal' },
  { symbol: 'Q_i', desc: 'Sub-index quality rating for individual metal' },
  { symbol: 'f_i', desc: 'PCA factor score for each metal' },
  { symbol: 'V_t', desc: 'Total metal concentration = Σ Oᵢ' },
  { symbol: 'RFD', desc: 'Reference Dose (mg/kg/day) for health risk' },
]

/* TOC entries */
const TOC_ITEMS = [
  ...INDICES.map((idx) => ({ id: idx.id, label: idx.key, title: idx.title })),
  { id: 'hotspot', label: 'Hotspot', title: 'Hotspot Risk Prediction' },
  { id: 'glossary', label: 'Glossary', title: 'Variable Glossary' },
]

/* ═══════════════════════════════════════════
   Inline SVG Icons
   ═══════════════════════════════════════════ */
const BookIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
  </svg>
)

const FunctionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 20c1.1 0 2-.9 2-2V6c0-1.1.9-2 2-2h2"/><path d="M4 12h8"/><path d="M14 6l4 6-4 6"/>
  </svg>
)

const TableIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
  </svg>
)

const AlertTriangleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)

const ListIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)

const MapPinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
)

/* ═══════════════════════════════════════════
   Formula Component — renders LaTeX via KaTeX
   ═══════════════════════════════════════════ */
function Formula({ tex, displayMode = true }) {
  const [html, setHtml] = useState('')

  useEffect(() => {
    if (window.katex) {
      try {
        const rendered = window.katex.renderToString(tex, {
          throwOnError: false,
          displayMode,
          trust: true,
        })
        setHtml(rendered)
      } catch {
        setHtml(`<span style="color:var(--color-danger-400)">${tex}</span>`)
      }
    }
  }, [tex, displayMode])

  if (!html) {
    return (
      <span style={{ color: 'var(--color-text-400)', fontStyle: 'italic', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
        {tex}
      </span>
    )
  }

  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

/* ═══════════════════════════════════════════
   Classification Table Sub-Component
   ═══════════════════════════════════════════ */
function ClassificationTable({ data, accentColor }) {
  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <span style={{ color: accentColor }}><TableIcon /></span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Classification
        </span>
      </div>
      <div style={{
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--glass-border)',
        overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-850)' }}>
              <th style={{
                padding: 'var(--space-2) var(--space-4)',
                textAlign: 'left',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-400)',
                borderBottom: '1px solid var(--glass-border)',
              }}>Range</th>
              <th style={{
                padding: 'var(--space-2) var(--space-4)',
                textAlign: 'left',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-text-400)',
                borderBottom: '1px solid var(--glass-border)',
              }}>Classification</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                style={{
                  borderBottom: i < data.length - 1 ? '1px solid rgba(148, 163, 184, 0.06)' : 'none',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.06)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <td style={{
                  padding: 'var(--space-2) var(--space-4)',
                  color: 'var(--color-text-200)',
                  fontFamily: 'var(--font-sans)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{row.range}</td>
                <td style={{
                  padding: 'var(--space-2) var(--space-4)',
                }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                  }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: row.color,
                      flexShrink: 0,
                    }} />
                    <span style={{ color: row.color }}>{row.level}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Weights Table Sub-Component
   ═══════════════════════════════════════════ */
function WeightsTable({ title, data, accentColor }) {
  return (
    <div style={{ marginTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <span style={{ color: accentColor }}><ListIcon /></span>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 'var(--space-2)',
      }}>
        {data.map((item) => (
          <div
            key={item.metal}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px var(--space-3)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-800)',
              border: '1px solid rgba(148, 163, 184, 0.06)',
              transition: 'border-color 200ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = accentColor }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.06)' }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--color-text-100)',
              }}>{item.metal}</span>
              <span style={{
                fontSize: '0.65rem',
                color: 'var(--color-text-500)',
              }}>{item.name}</span>
            </div>
            <span style={{
              fontVariantNumeric: 'tabular-nums',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: accentColor,
            }}>{item.weight.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════
   Index Card Sub-Component
   ═══════════════════════════════════════════ */
function IndexCard({ index, katexReady }) {
  const c = COLOR_MAP[index.color]

  return (
    <section
      id={index.id}
      className="glass-card"
      style={{
        padding: 'var(--space-6)',
        borderColor: c.border,
        scrollMarginTop: '6rem',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        {/* Accent icon badge */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-lg)',
          background: c.bg,
          border: `1px solid ${c.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: c.text,
          boxShadow: `0 0 16px ${c.glow}`,
        }}>
          <FunctionIcon />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <h2 style={{
              margin: 0,
              fontSize: 'var(--text-xl)',
              fontWeight: 700,
              color: 'var(--color-text-50)',
              lineHeight: 'var(--leading-tight)',
            }}>
              {index.title}
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: c.bg,
              color: c.text,
              border: `1px solid ${c.border}`,
            }}>
              {index.key}
            </span>
          </div>
          {index.subtitle && (
            <span style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              color: 'var(--color-text-500)',
              marginTop: '2px',
              display: 'block',
            }}>
              {index.subtitle}
            </span>
          )}
          <p style={{
            margin: 'var(--space-2) 0 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-300)',
            lineHeight: 'var(--leading-relaxed)',
          }}>
            {index.description}
          </p>
        </div>
      </div>

      {/* Formulas — inset box */}
      <div style={{
        background: 'var(--color-bg-900)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--glass-border)',
        padding: 'var(--space-4) var(--space-5)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
      }}>
        {index.formulas.map((f, i) => (
          <div key={i}>
            <div style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: 'var(--color-text-500)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 'var(--space-1)',
            }}>
              {f.label}
            </div>
            <div style={{
              overflowX: 'auto',
              padding: 'var(--space-2) 0',
              fontSize: '1.05rem',
              color: 'var(--color-text-100)',
            }}>
              {katexReady ? (
                <Formula tex={f.tex} displayMode />
              ) : (
                <span style={{ color: 'var(--color-text-400)', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                  Loading formula…
                </span>
              )}
            </div>
            {i < index.formulas.length - 1 && (
              <div style={{ borderTop: '1px solid rgba(148, 163, 184, 0.06)', marginTop: 'var(--space-2)' }} />
            )}
          </div>
        ))}
      </div>

      {/* Note */}
      {index.note && (
        <div style={{
          marginTop: 'var(--space-3)',
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(251, 191, 36, 0.06)',
          border: '1px solid rgba(251, 191, 36, 0.12)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-warning-400)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}>
          <AlertTriangleIcon />
          <span>{index.note}</span>
        </div>
      )}

      {/* Classification table */}
      {index.classification && (
        <ClassificationTable data={index.classification} accentColor={c.text} />
      )}

      {/* Weights table */}
      {index.weights && (
        <WeightsTable
          title={index.weights.title}
          data={index.weights.data}
          accentColor={c.text}
        />
      )}
    </section>
  )
}

/* ═══════════════════════════════════════════
   FormulasView — Main Page Component
   ═══════════════════════════════════════════ */
export default function FormulasView() {
  const [katexReady, setKatexReady] = useState(false)
  const [activeSection, setActiveSection] = useState(TOC_ITEMS[0].id)
  const observerRef = useRef(null)

  /* ── Load KaTeX from CDN ── */
  useEffect(() => {
    // Already loaded?
    if (window.katex) {
      setKatexReady(true)
      return
    }

    // Load CSS
    if (!document.querySelector(`link[href="${KATEX_CSS}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = KATEX_CSS
      link.crossOrigin = 'anonymous'
      document.head.appendChild(link)
    }

    // Load JS
    if (!document.querySelector(`script[src="${KATEX_JS}"]`)) {
      const script = document.createElement('script')
      script.src = KATEX_JS
      script.crossOrigin = 'anonymous'
      script.onload = () => setKatexReady(true)
      script.onerror = () => console.error('Failed to load KaTeX')
      document.head.appendChild(script)
    } else {
      // Script tag exists but maybe still loading
      const check = setInterval(() => {
        if (window.katex) {
          setKatexReady(true)
          clearInterval(check)
        }
      }, 100)
      return () => clearInterval(check)
    }
  }, [])

  /* ── Intersection Observer for TOC highlighting ── */
  useEffect(() => {
    const sectionIds = TOC_ITEMS.map((t) => t.id)
    const elements = sectionIds.map((id) => document.getElementById(id)).filter(Boolean)

    if (elements.length === 0) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id)
        }
      },
      {
        rootMargin: '-100px 0px -50% 0px',
        threshold: 0,
      }
    )

    elements.forEach((el) => observerRef.current.observe(el))

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [katexReady])

  /* ── Smooth scroll handler ── */
  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveSection(id)
    }
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Hero Section ── */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-cyan-500))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            boxShadow: 'var(--shadow-glow-primary)',
            flexShrink: 0,
          }}>
            <BookIcon />
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 'var(--text-3xl)',
              fontWeight: 800,
              color: 'var(--color-text-50)',
              lineHeight: 'var(--leading-tight)',
              letterSpacing: '-0.02em',
            }}>
              Formulas & Methodology
            </h1>
            <p style={{
              margin: '4px 0 0',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-400)',
              lineHeight: 'var(--leading-normal)',
            }}>
              Complete mathematical reference for all water quality indices computed by Jal Sanket Kendra
            </p>
          </div>
        </div>
        {/* Decorative separator */}
        <div style={{
          height: '2px',
          background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-cyan-500), transparent)',
          borderRadius: 'var(--radius-full)',
          marginTop: 'var(--space-4)',
        }} />
      </div>

      {/* ── Layout: TOC + Content ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: 'var(--space-6)',
      }}>
        {/* ── Mobile / Horizontal TOC ── */}
        <nav
          aria-label="Table of contents"
          style={{
            position: 'sticky',
            top: '64px',
            zIndex: 20,
            background: 'var(--glass-bg-strong)',
            backdropFilter: `blur(var(--glass-blur-strong))`,
            WebkitBackdropFilter: `blur(var(--glass-blur-strong))`,
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--glass-border)',
            padding: 'var(--space-2) var(--space-3)',
            overflowX: 'auto',
            display: 'flex',
            gap: 'var(--space-1)',
            scrollbarWidth: 'none',
          }}
        >
          {TOC_ITEMS.map((item) => {
            const isActive = activeSection === item.id
            const indexDef = INDICES.find((idx) => idx.id === item.id)
            const itemColor = indexDef ? COLOR_MAP[indexDef.color] : null

            return (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                title={item.title}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: isActive
                    ? (itemColor ? itemColor.bg : 'rgba(20, 184, 166, 0.1)')
                    : 'transparent',
                  color: isActive
                    ? (itemColor ? itemColor.text : 'var(--color-primary-400)')
                    : 'var(--color-text-400)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: isActive ? 700 : 500,
                  fontFamily: 'var(--font-sans)',
                  cursor: 'pointer',
                  transition: 'var(--transition-base)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                  ...(isActive && itemColor ? { boxShadow: `0 0 8px ${itemColor.glow}` } : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-200)'
                    e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--color-text-400)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* ── Content ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }} className="stagger-children">
          {/* Index Cards */}
          {INDICES.map((index) => (
            <IndexCard key={index.id} index={index} katexReady={katexReady} />
          ))}

          {/* ── Hotspot Risk Prediction ── */}
          <section
            id="hotspot"
            className="glass-card"
            style={{
              padding: 'var(--space-6)',
              scrollMarginTop: '6rem',
              borderColor: 'rgba(251, 191, 36, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251, 191, 36, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--color-warning-400)',
                boxShadow: '0 0 16px rgba(251, 191, 36, 0.15)',
              }}>
                <MapPinIcon />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <h2 style={{
                    margin: 0,
                    fontSize: 'var(--text-xl)',
                    fontWeight: 700,
                    color: 'var(--color-text-50)',
                    lineHeight: 'var(--leading-tight)',
                  }}>
                    Hotspot Risk Prediction
                  </h2>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    background: 'rgba(251, 191, 36, 0.08)',
                    color: 'var(--color-warning-400)',
                    border: '1px solid rgba(251, 191, 36, 0.2)',
                  }}>
                    HMPI
                  </span>
                </div>
                <p style={{
                  margin: 'var(--space-2) 0 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-300)',
                  lineHeight: 'var(--leading-relaxed)',
                }}>
                  Uses the Heavy Metal Pollution Index (HMPI) computed against BIS drinking water standards to classify geographic locations into risk tiers for contamination hotspot mapping.
                </p>
              </div>
            </div>

            {/* Formula inset */}
            <div style={{
              background: 'var(--color-bg-900)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--glass-border)',
              padding: 'var(--space-4) var(--space-5)',
            }}>
              <div style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--color-text-500)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 'var(--space-1)',
              }}>
                Risk Assessment
              </div>
              <div style={{
                overflowX: 'auto',
                padding: 'var(--space-2) 0',
                fontSize: '1.05rem',
                color: 'var(--color-text-100)',
              }}>
                {katexReady ? (
                  <Formula tex={'\\text{Risk Level} = f(\\text{HMPI}_{\\text{BIS}})'} displayMode />
                ) : (
                  <span style={{ color: 'var(--color-text-400)', fontFamily: 'monospace', fontSize: 'var(--text-sm)' }}>
                    Loading formula…
                  </span>
                )}
              </div>
            </div>

            <ClassificationTable data={HOTSPOT_CLASSIFICATION} accentColor="var(--color-warning-400)" />
          </section>

          {/* ── Variable Glossary ── */}
          <section
            id="glossary"
            className="glass-card"
            style={{
              padding: 'var(--space-6)',
              scrollMarginTop: '6rem',
              borderColor: 'rgba(34, 211, 238, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(34, 211, 238, 0.08)',
                border: '1px solid rgba(34, 211, 238, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: 'var(--color-cyan-400)',
                boxShadow: '0 0 16px rgba(34, 211, 238, 0.15)',
              }}>
                <BookIcon />
              </div>
              <div>
                <h2 style={{
                  margin: 0,
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  color: 'var(--color-text-50)',
                  lineHeight: 'var(--leading-tight)',
                }}>
                  Variable Glossary
                </h2>
                <p style={{
                  margin: 'var(--space-1) 0 0',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-400)',
                }}>
                  Definitions for all symbols used across the indices
                </p>
              </div>
            </div>

            <div style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--glass-border)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-850)' }}>
                    <th style={{
                      padding: 'var(--space-3) var(--space-4)',
                      textAlign: 'left',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-cyan-300)',
                      borderBottom: '1px solid var(--glass-border)',
                      width: '120px',
                    }}>Symbol</th>
                    <th style={{
                      padding: 'var(--space-3) var(--space-4)',
                      textAlign: 'left',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--color-cyan-300)',
                      borderBottom: '1px solid var(--glass-border)',
                    }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {GLOSSARY.map((entry, i) => (
                    <tr
                      key={i}
                      style={{
                        borderBottom: i < GLOSSARY.length - 1 ? '1px solid rgba(148, 163, 184, 0.06)' : 'none',
                        transition: 'background-color 150ms ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.06)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <td style={{
                        padding: 'var(--space-3) var(--space-4)',
                        color: 'var(--color-text-100)',
                        verticalAlign: 'top',
                      }}>
                        {katexReady ? (
                          <Formula tex={entry.symbol} displayMode={false} />
                        ) : (
                          <span style={{ fontFamily: 'monospace' }}>{entry.symbol}</span>
                        )}
                      </td>
                      <td style={{
                        padding: 'var(--space-3) var(--space-4)',
                        color: 'var(--color-text-300)',
                        lineHeight: 'var(--leading-relaxed)',
                      }}>
                        {entry.desc}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
