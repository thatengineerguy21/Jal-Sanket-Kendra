import React, { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { Link, Routes, Route, useLocation } from 'react-router-dom'
import DataView from './pages/DataView.jsx'
import MapView from './pages/MapView.jsx'
import PredictView from './pages/PredictView.jsx'
import AlertsView from './pages/AlertsView.jsx'
import QuickCalcView from './pages/QuickCalcView.jsx'
import FormulasView from './pages/FormulasView.jsx'
import AccessibilityWidget from './components/AccessibilityWidget.jsx'
import DesignSpells from './components/DesignSpells.jsx'

const API_BASE = '/api/v1'

/* ═══════════════════════════════════════════
   Toast Context — app-wide notification system
   ═══════════════════════════════════════════ */
const ToastContext = createContext()

export function useToast() {
  return useContext(ToastContext)
}

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, duration)
  }, [])

  const icons = {
    success: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    ),
    error: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    ),
    info: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  }

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} role="alert">
            {icons[t.type]}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ═══════════════════════════════════════════
   SVG Icons
   ═══════════════════════════════════════════ */
const icons = {
  water: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
    </svg>
  ),
  data: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  map: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
    </svg>
  ),
  predict: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  calculator: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="16" y2="18"/>
    </svg>
  ),
  formulas: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
    </svg>
  ),
  menu: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  ),
  close: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
}

/* ═══════════════════════════════════════════
   NavBar Component
   ═══════════════════════════════════════════ */
function NavBar() {
  const location = useLocation()

  const navLinks = [
    { to: '/data', label: 'Dashboard', icon: icons.data },
    { to: '/map', label: 'Map', icon: icons.map },
    { to: '/predict', label: 'Predict', icon: icons.predict },
    { to: '/alerts', label: 'Alerts', icon: icons.alert },
    { to: '/calculator', label: 'Calculator', icon: icons.calculator },
    { to: '/formulas', label: 'Formulas', icon: icons.formulas },
  ]

  const isActive = (path) => {
    if (path === '/data') return location.pathname === '/' || location.pathname === '/data'
    return location.pathname === path
  }

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--glass-bg-strong)',
        backdropFilter: `blur(var(--glass-blur-strong))`,
        WebkitBackdropFilter: `blur(var(--glass-blur-strong))`,
        borderBottom: '1px solid var(--glass-border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Brand */}
          <Link
            to="/"
            className="flex items-center gap-3 group no-underline"
            aria-label="Jal Sanket Kendra — Home"
          >
            <div
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary-500), var(--color-cyan-500))',
                boxShadow: 'var(--shadow-glow-primary)',
                transition: 'var(--transition-base)',
                color: 'white',
              }}
            >
              {icons.water}
            </div>
            <div className="flex flex-col">
              <span
                className="text-lg font-bold tracking-tight"
                style={{ color: 'var(--color-text-50)', lineHeight: '1.2' }}
              >
                Jal Sanket Kendra
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--color-primary-300)', letterSpacing: '0.04em' }}
              >
                जल संकेत केंद्र
              </span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1 spell-magnetic-wrap" aria-label="Main navigation">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="spell-magnetic-item relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium no-underline"
                style={{
                  color: isActive(link.to)
                    ? 'var(--color-primary-300)'
                    : 'var(--color-text-400)',
                  background: isActive(link.to)
                    ? 'rgba(20, 184, 166, 0.1)'
                    : 'transparent',
                  transition: 'var(--transition-base)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive(link.to)) {
                    e.currentTarget.style.color = 'var(--color-text-200)'
                    e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive(link.to)) {
                    e.currentTarget.style.color = 'var(--color-text-400)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
                aria-current={isActive(link.to) ? 'page' : undefined}
              >
                {link.icon}
                {link.label}
                {isActive(link.to) && (
                  <span
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full"
                    style={{ background: 'var(--color-primary-400)' }}
                  />
                )}
              </Link>
            ))}
          </nav>

        </div>
      </div>
    </header>
  )
}

/* ═══════════════════════════════════════════
   Footer Component
   ═══════════════════════════════════════════ */
function Footer() {
  return (
    <footer
      className="mt-auto py-6 px-6 text-center text-xs"
      style={{
        color: 'var(--color-text-500)',
        borderTop: '1px solid var(--glass-border)',
      }}
    >
      <p className="mb-1">
        <span style={{ color: 'var(--color-text-400)' }}>Jal Sanket Kendra</span>{' '}
        — Water Quality Monitoring & Heavy Metal Pollution Index
      </p>
      <p>© {new Date().getFullYear()} All rights reserved.</p>
    </footer>
  )
}

/* ═══════════════════════════════════════════
   App Component
   ═══════════════════════════════════════════ */
export default function App() {
  const [samples, setSamples] = useState([])
  const [preds, setPreds] = useState([])
  const [summary, setSummary] = useState(null)
  const location = useLocation()

  useEffect(() => {
    fetch(`${API_BASE}/indices/`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
  }, [samples])

  // Determine if the current page is the map (full-bleed, no padding)
  const isMapPage = location.pathname === '/map'

  return (
    <ToastProvider>
      <DesignSpells />
      <div className="min-h-screen flex flex-col">
        <NavBar />
        <main className={`flex-1 ${isMapPage ? '' : 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6'}`}>
          <div key={location.pathname} className="animate-fade-in-up">
            <Routes>
              <Route
                path="/"
                element={<DataView samples={samples} setSamples={setSamples} summary={summary} />}
              />
              <Route
                path="/data"
                element={<DataView samples={samples} setSamples={setSamples} summary={summary} />}
              />
              <Route
                path="/map"
                element={<MapView samples={samples} preds={preds} summary={summary} />}
              />
              <Route
                path="/predict"
                element={<PredictView preds={preds} setPreds={setPreds} />}
              />
              <Route
                path="/alerts"
                element={<AlertsView />}
              />
              <Route
                path="/calculator"
                element={<QuickCalcView />}
              />
              <Route
                path="/formulas"
                element={<FormulasView />}
              />
            </Routes>
          </div>
        </main>
        {!isMapPage && <Footer />}
      </div>
      <AccessibilityWidget />
    </ToastProvider>
  )
}
