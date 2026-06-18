import React, { useState, useEffect } from 'react'
import { useToast } from '../App.jsx'

const API = (path) => new URL(path, window.location.origin).toString()

/* ═══════════════════════════════════════════
   SVG Icons
   ═══════════════════════════════════════════ */
const icons = {
  bell: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  email: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
    </svg>
  ),
  sms: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  save: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  ),
  send: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
}

/* ═══════════════════════════════════════════
   AlertsView Component
   ═══════════════════════════════════════════ */
export default function AlertsView() {
  const addToast = useToast()

  // Threshold config
  const [hpiThreshold, setHpiThreshold] = useState('')
  const [cdThreshold, setCdThreshold] = useState('')
  const [configLoading, setConfigLoading] = useState(true)
  const [configSaving, setConfigSaving] = useState(false)

  // Alert sending
  const [emailRecipients, setEmailRecipients] = useState('')
  const [smsRecipients, setSmsRecipients] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [sendingSms, setSendingSms] = useState(false)

  // Load current config
  useEffect(() => {
    fetch(API('/api/v1/alerts/config'))
      .then((r) => r.json())
      .then((data) => {
        setHpiThreshold(data.hpi_threshold ?? '')
        setCdThreshold(data.cd_threshold ?? '')
        setConfigLoading(false)
      })
      .catch(() => {
        setConfigLoading(false)
      })
  }, [])

  // Save threshold config
  const saveConfig = async () => {
    setConfigSaving(true)
    try {
      const res = await fetch(API('/api/v1/alerts/config'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hpi_threshold: Number(hpiThreshold),
          cd_threshold: Number(cdThreshold),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      addToast('Alert thresholds saved successfully', 'success')
    } catch (err) {
      addToast(`Failed to save config: ${err.message}`, 'error')
    } finally {
      setConfigSaving(false)
    }
  }

  // Send alerts
  const sendAlert = async (channel) => {
    const isSms = channel === 'sms'
    const recipients = isSms ? smsRecipients : emailRecipients
    if (!recipients.trim()) {
      addToast(`Please enter ${isSms ? 'phone numbers' : 'email addresses'}`, 'error')
      return
    }

    isSms ? setSendingSms(true) : setSendingEmail(true)
    try {
      const res = await fetch(API('/api/v1/alerts/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          recipients: recipients.split(',').map((r) => r.trim()).filter(Boolean),
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      addToast(`${isSms ? 'SMS' : 'Email'} alerts sent successfully!`, 'success')
    } catch (err) {
      addToast(`Failed to send ${channel} alert: ${err.message}`, 'error')
    } finally {
      isSms ? setSendingSms(false) : setSendingEmail(false)
    }
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* ── Page Header ── */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-50)' }}>
          Alert Configuration
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-400)' }}>
          Configure pollution thresholds and send notifications when limits are exceeded
        </p>
      </div>

      {/* ── Threshold Configuration ── */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--color-warning-400)' }}
          >
            {icons.settings}
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-100)' }}>
              Threshold Settings
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>
              Set the pollution index thresholds that trigger alerts
            </p>
          </div>
        </div>

        {configLoading ? (
          <div className="space-y-3">
            <div className="skeleton h-10 w-full" />
            <div className="skeleton h-10 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="hpi-threshold"
                className="block text-xs font-medium mb-2 uppercase tracking-wider"
                style={{ color: 'var(--color-text-400)' }}
              >
                HPI Threshold
              </label>
              <input
                id="hpi-threshold"
                type="number"
                step="any"
                className="input"
                placeholder="e.g., 100"
                value={hpiThreshold}
                onChange={(e) => setHpiThreshold(e.target.value)}
                aria-label="Heavy Metal Pollution Index threshold"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-500)' }}>
                Alert when HPI exceeds this value
              </p>
            </div>
            <div>
              <label
                htmlFor="cd-threshold"
                className="block text-xs font-medium mb-2 uppercase tracking-wider"
                style={{ color: 'var(--color-text-400)' }}
              >
                Cd Index Threshold
              </label>
              <input
                id="cd-threshold"
                type="number"
                step="any"
                className="input"
                placeholder="e.g., 3.0"
                value={cdThreshold}
                onChange={(e) => setCdThreshold(e.target.value)}
                aria-label="Degree of contamination threshold"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-500)' }}>
                Alert when Cd index exceeds this value
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            className="btn btn-primary"
            onClick={saveConfig}
            disabled={configSaving || configLoading}
            aria-label="Save threshold configuration"
          >
            {configSaving ? <span className="spinner" /> : icons.save}
            <span>{configSaving ? 'Saving...' : 'Save Thresholds'}</span>
          </button>
        </div>
      </section>

      {/* ── Send Alerts ── */}
      <section className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-primary-400)' }}
          >
            {icons.bell}
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-100)' }}>
              Send Notifications
            </h2>
            <p className="text-xs" style={{ color: 'var(--color-text-500)' }}>
              Manually trigger alerts to notify stakeholders about current water quality status
            </p>
          </div>
        </div>

        {/* Email Section */}
        <div
          className="p-4 rounded-xl space-y-3"
          style={{
            background: 'rgba(96, 165, 250, 0.04)',
            border: '1px solid rgba(96, 165, 250, 0.12)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--color-info-400)' }}>{icons.email}</span>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-info-400)' }}>
              Email Alerts
            </h3>
          </div>
          <div>
            <label
              htmlFor="email-recipients"
              className="block text-xs font-medium mb-2"
              style={{ color: 'var(--color-text-400)' }}
            >
              Recipients (comma-separated)
            </label>
            <input
              id="email-recipients"
              type="text"
              className="input"
              placeholder="admin@example.com, team@example.com"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              aria-label="Email recipients"
            />
          </div>
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => sendAlert('email')}
              disabled={sendingEmail}
              aria-label="Send email alerts"
            >
              {sendingEmail ? <span className="spinner" /> : icons.send}
              <span>{sendingEmail ? 'Sending...' : 'Send Email Alert'}</span>
            </button>
          </div>
        </div>

        {/* SMS Section */}
        <div
          className="p-4 rounded-xl space-y-3"
          style={{
            background: 'rgba(34, 197, 94, 0.04)',
            border: '1px solid rgba(34, 197, 94, 0.12)',
          }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--color-success-400)' }}>{icons.sms}</span>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-success-400)' }}>
              SMS Alerts
            </h3>
          </div>
          <div>
            <label
              htmlFor="sms-recipients"
              className="block text-xs font-medium mb-2"
              style={{ color: 'var(--color-text-400)' }}
            >
              Phone Numbers (comma-separated)
            </label>
            <input
              id="sms-recipients"
              type="text"
              className="input"
              placeholder="+91 98765 43210, +91 12345 67890"
              value={smsRecipients}
              onChange={(e) => setSmsRecipients(e.target.value)}
              aria-label="SMS recipients phone numbers"
            />
          </div>
          <div className="flex justify-end">
            <button
              className="btn btn-primary"
              onClick={() => sendAlert('sms')}
              disabled={sendingSms}
              aria-label="Send SMS alerts"
            >
              {sendingSms ? <span className="spinner" /> : icons.send}
              <span>{sendingSms ? 'Sending...' : 'Send SMS Alert'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
