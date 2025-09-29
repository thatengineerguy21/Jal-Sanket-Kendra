// React via UMD globals provided by index.html
const { useEffect, useMemo, useRef, useState } = React;

const API_BASE = "/api/v1";

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function useIndicesSummary(refreshKey) {
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    fetchJSON(`${API_BASE}/indices/`).then(setSummary).catch(() => setSummary(null));
  }, [refreshKey]);
  return summary;
}

function UploadAndCalculate({ onSamples }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    setError("");
    const file = inputRef.current?.files?.[0];
    if (!file) { setError("Please select a CSV/JSON/PDF/Excel file."); return; }
    const fd = new FormData();
    fd.append("file", file, file.name);
    setBusy(true);
    try {
      const data = await fetchJSON(`${API_BASE}/upload-and-calculate/`, { method: "POST", body: fd });
      setItems(data);
      onSamples(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section">
      <h2>Upload & Calculate</h2>
      <form onSubmit={handleUpload}>
        <input ref={inputRef} className="input" type="file" accept=".csv,.json,.pdf,.xlsx,.xls" />
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Processing..." : "Upload"}</button>
          <button className="btn secondary" type="button" onClick={() => { setItems([]); onSamples([]); }}>Clear</button>
        </div>
      </form>
      {error && <div style={{ color: "#fca5a5", marginTop: 8 }}>Error: {error}</div>}
      <div className="list">
        {items.length > 0 ? (
          <div>
            <div>{items.length} samples processed</div>
            {items.slice(0, 5).map((s, i) => (
              <div key={i}>
                {s.latitude.toFixed(3)}, {s.longitude.toFixed(3)} · HPI {s.result.heavy_metal_pollution_index} <span className={`badge ${s.result.hpi_category.includes("Low")?"low":s.result.hpi_category.includes("Moderate")?"mod":"high"}`}>{s.result.hpi_category}</span>
              </div>
            ))}
            {items.length > 5 && <div>…and {items.length - 5} more</div>}
          </div>
        ) : <div>No uploaded samples yet.</div>}
      </div>
    </div>
  );
}

function PredictHotspots({ onPreds }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState([]);
  const inputRef = useRef(null);

  const handleUpload = async (e) => {
    e.preventDefault();
    setError("");
    const file = inputRef.current?.files?.[0];
    if (!file) { setError("Please select a CSV/JSON file."); return; }
    const fd = new FormData();
    fd.append("file", file, file.name);
    setBusy(true);
    try {
      const data = await fetchJSON(`${API_BASE}/predict-hotspots/`, { method: "POST", body: fd });
      setItems(data);
      onPreds(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section">
      <h2>Predict Hotspots</h2>
      <form onSubmit={handleUpload}>
        <input ref={inputRef} className="input" type="file" accept=".csv,.json" />
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button className="btn" type="submit" disabled={busy}>{busy ? "Predicting..." : "Upload"}</button>
          <button className="btn secondary" type="button" onClick={() => { setItems([]); onPreds([]); }}>Clear</button>
        </div>
      </form>
      {error && <div style={{ color: "#fca5a5", marginTop: 8 }}>Error: {error}</div>}
      <div className="list">
        {items.length > 0 ? (
          <div>
            <div>{items.length} predictions</div>
            {items.slice(0, 5).map((p, i) => (
              <div key={i}>
                {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)} · Risk {p.risk_score} <span className={`badge ${p.risk_category.includes("Low")?"low":p.risk_category.includes("Moderate")?"mod":"high"}`}>{p.risk_category}</span>
              </div>
            ))}
            {items.length > 5 && <div>…and {items.length - 5} more</div>}
          </div>
        ) : <div>No predictions yet.</div>}
      </div>
    </div>
  );
}

function Indices() {
  const [refreshKey, setRefreshKey] = useState(0);
  const summary = useIndicesSummary(refreshKey);
  return (
    <div className="section">
      <h2>Indices Summary</h2>
      {summary ? (
        <div className="grid">
          <div>Count: <b>{summary.count}</b></div>
          <div>Avg HPI: <b>{summary.avg_hpi}</b></div>
          <div>Avg Cd: <b>{summary.avg_cd}</b></div>
          <button className="btn secondary" onClick={() => setRefreshKey((x) => x + 1)}>Refresh</button>
        </div>
      ) : (
        <div className="list">No data yet.</div>
      )}
    </div>
  );
}

function Alerts() {
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetchJSON(`${API_BASE}/alerts/config`).then(setCfg).catch(()=>{}); }, []);
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await fetchJSON(`${API_BASE}/alerts/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
      setMsg("Saved config");
    } catch (err) { setMsg(String(err)); }
    setBusy(false);
  };
  const send = async (channel) => {
    setBusy(true); setMsg("");
    try {
      const res = await fetchJSON(`${API_BASE}/alerts/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, message: "Water quality alert" }) });
      setMsg(`${res.status} via ${res.channel}, recipients: ${res.to || ""}, hotspots: ${res.count}`);
    } catch (err) { setMsg(String(err)); }
    setBusy(false);
  };
  if (!cfg) return (<div className="section"><h2>Alerts</h2><div className="list">Loading config…</div></div>);
  return (
    <div className="section">
      <h2>Alerts</h2>
      <div className="grid">
        <label>HPI Threshold <input className="input" type="number" value={cfg.hpi_threshold} onChange={(e)=>setCfg({...cfg, hpi_threshold: parseFloat(e.target.value)})} /></label>
        <label>Cd Threshold <input className="input" type="number" value={cfg.cd_threshold} onChange={(e)=>setCfg({...cfg, cd_threshold: parseFloat(e.target.value)})} /></label>
        <label>Email recipients <input className="input" type="text" value={cfg.email_recipients} onChange={(e)=>setCfg({...cfg, email_recipients: e.target.value})} /></label>
        <label>SMS recipients <input className="input" type="text" value={cfg.sms_recipients} onChange={(e)=>setCfg({...cfg, sms_recipients: e.target.value})} /></label>
      </div>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button className="btn" onClick={save} disabled={busy}>{busy?"Saving…":"Save Config"}</button>
        <button className="btn secondary" onClick={() => send("email")} disabled={busy}>Send Email</button>
        <button className="btn secondary" onClick={() => send("sms")} disabled={busy}>Send SMS</button>
      </div>
      {msg && <div className="list" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function MapView({ samples, preds }) {
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const predMarkersRef = useRef([]);

  const allPoints = useMemo(() => {
    const s = (samples || []).map((x) => [x.latitude, x.longitude]);
    const p = (preds || []).map((x) => [x.latitude, x.longitude]);
    return [...s, ...p];
  }, [samples, preds]);

  useEffect(() => {
    if (!mapRef.current) {
      const map = L.map("map").setView([19.0, 73.0], 8);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      mapRef.current = map;
    }
  }, []);

  useEffect(() => {
    // Clear previous sample markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    (samples || []).forEach((s) => {
      const cat = s.result?.hpi_category || "";
      const color = cat.includes("Low") ? "#22c55e" : cat.includes("Moderate") ? "#60a5fa" : "#ef4444";
      const m = L.circleMarker([s.latitude, s.longitude], { radius: 6, color, fillColor: color, fillOpacity: 0.7 })
        .bindPopup(`<b>HPI:</b> ${s.result?.heavy_metal_pollution_index}<br/><b>Cd:</b> ${s.result?.degree_of_contamination}<br/><b>Category:</b> ${cat}`)
        .addTo(mapRef.current);
      markersRef.current.push(m);
    });
  }, [samples]);

  useEffect(() => {
    // Clear previous prediction markers
    predMarkersRef.current.forEach((m) => m.remove());
    predMarkersRef.current = [];
    (preds || []).forEach((p) => {
      const cat = p.risk_category || "";
      const color = cat.includes("Low") ? "#22c55e" : cat.includes("Moderate") ? "#60a5fa" : "#ef4444";
      const m = L.circleMarker([p.latitude, p.longitude], { radius: 6, color, fillColor: color, fillOpacity: 0.5, dashArray: "2,4" })
        .bindPopup(`<b>Risk:</b> ${p.risk_score}<br/><b>Category:</b> ${cat}`)
        .addTo(mapRef.current);
      predMarkersRef.current.push(m);
    });
  }, [preds]);

  useEffect(() => {
    // Fit bounds to all points if available
    if (mapRef.current && allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints.map(([lat, lng]) => L.latLng(lat, lng)));
      mapRef.current.fitBounds(bounds.pad(0.2));
    }
  }, [allPoints]);

  return null;
}

function App() {
  const [samples, setSamples] = useState([]);
  const [preds, setPreds] = useState([]);
  return (
    <>
      <UploadAndCalculate onSamples={setSamples} />
      <PredictHotspots onPreds={setPreds} />
      <Indices />
      <Alerts />
      <MapView samples={samples} preds={preds} />
    </>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);