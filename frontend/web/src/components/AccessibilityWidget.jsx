import React, { useState, useRef, useEffect, useCallback } from 'react'

/* ═══════════════════════════════════════════
   Accessibility Widget
   Floating button (bottom-right) → expandable panel
   ═══════════════════════════════════════════ */

const FONT_STEPS = [
  { label: 'A−', size: '14px' },
  { label: 'A',  size: '16px' },
  { label: 'A+', size: '18px' },
]

/* ── Inline SVG Icons ── */
const AccessibilityIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="4.5" r="2.5"/>
    <path d="M12 7v5"/>
    <path d="M8 10h8"/>
    <path d="M9 22l3-9 3 9"/>
  </svg>
)

const ContrastIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor"/>
  </svg>
)

const GrayscaleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/>
  </svg>
)

const InvertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18"/>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <rect x="3" y="3" width="9" height="18" rx="0" fill="currentColor" opacity="0.4"/>
  </svg>
)

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false)
  const [fontIdx, setFontIdx] = useState(1)          // default = 'A' (16px)
  const [highContrast, setHighContrast] = useState(false)
  const [grayscale, setGrayscale] = useState(false)
  const [invert, setInvert] = useState(false)
  const panelRef = useRef(null)

  /* ── Click-outside-to-close ── */
  const handleClickOutside = useCallback((e) => {
    if (panelRef.current && !panelRef.current.contains(e.target)) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, handleClickOutside])

  /* ── Font size ── */
  const changeFontSize = (idx) => {
    const clamped = Math.max(0, Math.min(idx, FONT_STEPS.length - 1))
    setFontIdx(clamped)
    document.documentElement.style.fontSize = FONT_STEPS[clamped].size
  }

  /* ── Body class toggles ── */
  const toggleClass = (cls, setter, current) => {
    const next = !current
    setter(next)
    document.body.classList.toggle(cls, next)
  }

  /* ── Styles ── */
  const fabStyle = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9990,
    width: '52px',
    height: '52px',
    borderRadius: 'var(--radius-full)',
    background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600))',
    color: 'white',
    border: '1px solid var(--color-primary-400)',
    boxShadow: 'var(--shadow-lg), var(--shadow-glow-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'var(--transition-base)',
  }

  const panelStyle = {
    position: 'fixed',
    bottom: '88px',
    right: '24px',
    zIndex: 9991,
    width: '280px',
    background: 'var(--glass-bg-strong)',
    backdropFilter: 'blur(var(--glass-blur-strong))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-strong))',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: 'var(--shadow-xl)',
    padding: '0',
    overflow: 'hidden',
    animation: 'fadeInUp 200ms ease-out both',
  }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--glass-border)',
  }

  const sectionStyle = {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  }

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: 'var(--text-sm)',
    fontWeight: 500,
    color: 'var(--color-text-200)',
  }

  const toggleBtnStyle = (active) => ({
    padding: '6px 14px',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${active ? 'var(--color-primary-500)' : 'var(--color-bg-700)'}`,
    background: active ? 'rgba(20, 184, 166, 0.15)' : 'var(--color-bg-800)',
    color: active ? 'var(--color-primary-300)' : 'var(--color-text-400)',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    fontFamily: 'var(--font-sans)',
  })

  const fontBtnStyle = (isActive) => ({
    flex: 1,
    padding: '6px 0',
    borderRadius: 'var(--radius-md)',
    border: `1px solid ${isActive ? 'var(--color-primary-500)' : 'var(--color-bg-700)'}`,
    background: isActive ? 'rgba(20, 184, 166, 0.15)' : 'var(--color-bg-800)',
    color: isActive ? 'var(--color-primary-300)' : 'var(--color-text-400)',
    fontSize: 'var(--text-sm)',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'var(--transition-base)',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
  })

  return (
    <>
      {/* ── Floating Action Button ── */}
      <button
        style={fabStyle}
        onClick={() => setOpen((v) => !v)}
        aria-label="Accessibility options"
        title="Accessibility options"
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      >
        <AccessibilityIcon />
      </button>

      {/* ── Panel ── */}
      {open && (
        <div ref={panelRef} style={panelStyle} role="dialog" aria-label="Accessibility settings">
          {/* Header */}
          <div style={headerStyle}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text-50)' }}>
              Accessibility
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-text-400)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
              }}
              aria-label="Close accessibility panel"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Controls */}
          <div style={sectionStyle}>
            {/* Font Size */}
            <div>
              <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text-500)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                Font Size
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {FONT_STEPS.map((step, idx) => (
                  <button
                    key={step.label}
                    style={fontBtnStyle(fontIdx === idx)}
                    onClick={() => changeFontSize(idx)}
                    aria-label={`Font size ${step.label}`}
                  >
                    {step.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Separator */}
            <div style={{ borderTop: '1px solid var(--glass-border)' }} />

            {/* High Contrast */}
            <div style={rowStyle}>
              <span style={labelStyle}>
                <ContrastIcon />
                High Contrast
              </span>
              <button
                style={toggleBtnStyle(highContrast)}
                onClick={() => toggleClass('high-contrast', setHighContrast, highContrast)}
                aria-pressed={highContrast}
              >
                {highContrast ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Grayscale */}
            <div style={rowStyle}>
              <span style={labelStyle}>
                <GrayscaleIcon />
                Grayscale
              </span>
              <button
                style={toggleBtnStyle(grayscale)}
                onClick={() => toggleClass('grayscale', setGrayscale, grayscale)}
                aria-pressed={grayscale}
              >
                {grayscale ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Invert Colors */}
            <div style={rowStyle}>
              <span style={labelStyle}>
                <InvertIcon />
                Invert Colors
              </span>
              <button
                style={toggleBtnStyle(invert)}
                onClick={() => toggleClass('invert', setInvert, invert)}
                aria-pressed={invert}
              >
                {invert ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
