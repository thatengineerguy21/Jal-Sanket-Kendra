import React, { useEffect, useState } from 'react'
import { Link, Routes, Route, useNavigate } from 'react-router-dom'
import DataView from './pages/DataView.jsx'
import MapView from './pages/MapView.jsx'
import PredictView from './pages/PredictView.jsx'

const API_BASE = '/api/v1'

function NavBar() {
  const nav = useNavigate()
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-900 text-slate-200 shadow-md">
      <div className="text-lg font-bold tracking-wide text-cyan-400">
        Heavy Metal Pollution Dashboard
      </div>
      <nav className="flex items-center gap-6">
        <Link to="/data" className="hover:text-cyan-300 transition">
          Data
        </Link>
        <Link to="/map" className="hover:text-cyan-300 transition">
          Map
        </Link>
        <Link to="/predict" className="hover:text-cyan-300 transition">
          Predict
        </Link>
        <button
          className="px-3 py-1 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
          onClick={() => nav('/')}
        >
          Home
        </button>
      </nav>
    </header>
  )
}

export default function App() {
  const [samples, setSamples] = useState([])
  const [preds, setPreds] = useState([])
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    fetch(`${API_BASE}/indices/`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {})
  }, [samples])

  return (
    <div className="min-h-screen text-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <NavBar />
      <main className="grid grid-cols-1 lg:grid-cols-[420px,1fr]">
        <section className="bg-slate-900/80 backdrop-blur border-r border-slate-700 p-6">
          <h2 className="text-cyan-300 font-semibold mb-3">Indices Summary</h2>
          {summary ? (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="bg-slate-800 p-4 rounded shadow-sm hover:shadow-md transition">
                Count: <b>{summary.count}</b>
              </div>
              <div className="bg-slate-800 p-4 rounded shadow-sm hover:shadow-md transition">
                Avg HPI: <b>{summary.avg_hpi}</b>
              </div>
              <div className="bg-slate-800 p-4 rounded shadow-sm hover:shadow-md transition">
                Avg Cd: <b>{summary.avg_cd}</b>
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-sm">No indices yet.</div>
          )}
        </section>
        <section className="min-h-[calc(100vh-56px)] p-4">
          <Routes>
            <Route
              path="/"
              element={<DataView samples={samples} setSamples={setSamples} />}
            />
            <Route
              path="/data"
              element={<DataView samples={samples} setSamples={setSamples} />}
            />
            <Route path="/map" element={<MapView samples={samples} preds={preds} />} />
            <Route
              path="/predict"
              element={<PredictView preds={preds} setPreds={setPreds} />}
            />
          </Routes>
        </section>
      </main>
    </div>
  )
}
