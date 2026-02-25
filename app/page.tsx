'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBoard, getBoardByCode } from '@/lib/supabase'

const EXPIRY_OPTIONS = [
  { label: '∞  NEVER EXPIRES',  value: null,  desc: 'BOARD STAYS FOREVER' },
  { label: '⏱  24 HOURS',       value: 24,    desc: 'DELETES AFTER 1 DAY' },
  { label: '⏱  7 DAYS',         value: 168,   desc: 'DELETES AFTER 1 WEEK' },
  { label: '⏱  30 DAYS',        value: 720,   desc: 'DELETES AFTER 1 MONTH' },
]

export default function HomePage() {
  const router = useRouter()
  const [view, setView]         = useState<'home' | 'create' | 'join'>('home')
  const [boardName, setBoardName] = useState('')
  const [joinCode, setJoinCode]   = useState('')
  const [expiry, setExpiry]       = useState<number | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [darkMode, setDarkMode]   = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('whispr_theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('whispr_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!boardName.trim()) return
    setLoading(true); setError('')
    try {
      const b = await createBoard(boardName.trim(), expiry)
      router.push(`/board/${b.code}`)
    } catch { setError('ERROR: COULD NOT PROCESS'); setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setLoading(true); setError('')
    try {
      const b = await getBoardByCode(code)
      if (!b) { setError('ERROR: BOARD NOT FOUND'); setLoading(false); return }
      router.push(`/board/${b.code}`)
    } catch { setError('ERROR: COULD NOT PROCESS'); setLoading(false) }
  }

  const now     = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>

      {/* Dark mode toggle — fixed corner */}
      <button onClick={() => setDarkMode(d => !d)}
              style={{ position: 'fixed', top: '16px', right: '16px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', padding: '7px 10px', fontSize: '14px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', zIndex: 50, lineHeight: 1 }}
              title={darkMode ? 'Light mode' : 'Dark mode'}>
        {darkMode ? '☀' : '◑'}
      </button>

      {/* ── HOME ── */}
      {view === 'home' && (
        <div style={{ width: '100%', maxWidth: '360px', animation: 'feedIn 0.4s ease' }}>
          <div className="receipt receipt-torn-top receipt-torn-bottom" style={{ padding: '28px 24px' }}>

            <div className="thermal-center" style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '26px', fontWeight: 700, letterSpacing: '0.15em' }}>WHISPR</div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: '2px' }}>ANONYMOUS CONFESSIONS CO.</div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)' }}>EST. 2025 · whispr.name.ng</div>
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
              {[['DATE', dateStr], ['TIME', timeStr], ['TERMINAL', 'WEB-01'], ['CASHIER', 'ANONYMOUS']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            <div style={{ fontSize: '11px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '12px' }}>
                <span>ITEM</span><span>QTY</span>
              </div>
              {[['ANONYMOUS POST', '∞'], ['REAL-TIME SYNC', '1'], ['REPLY THREADS', '1'], ['IMAGE ATTACH', '1'], ['PRESENCE INDICATOR', '1'], ['SOCIAL SHARE', '5']].map(([item, qty]) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item}</span><span style={{ fontWeight: 600 }}>{qty}</span>
                </div>
              ))}
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
              <span style={{ color: 'var(--ink-3)' }}>SUBTOTAL</span><span>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--ink-3)' }}>ANONYMITY TAX</span><span>$0.00</span>
            </div>
            <div className="dash-line" style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
              <span>TOTAL</span><span>$0.00</span>
            </div>

            <div className="dash-line" style={{ margin: '16px 0' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <button className="btn-primary" onClick={() => setView('create')} style={{ width: '100%', padding: '11px' }}>
                [01] CREATE A BOARD
              </button>
              <button className="btn-secondary" onClick={() => setView('join')} style={{ width: '100%', padding: '11px' }}>
                [02] JOIN WITH CODE
              </button>
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            <div className="thermal-center" style={{ fontSize: '10px', color: 'var(--ink-3)', lineHeight: 1.8 }}>
              <div>** KEEP THIS RECEIPT **</div>
              <div>THANK YOU FOR YOUR CONFESSION</div>
              <div style={{ marginTop: '6px', letterSpacing: '0.15em' }}>|||||| ||| || |||| ||| | ||||</div>
              <div style={{ marginTop: '4px', fontSize: '9px' }}>TXN#WSPRNG-{Math.floor(Math.random() * 999999).toString().padStart(6, '0')}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE ── */}
      {view === 'create' && (
        <div style={{ width: '100%', maxWidth: '380px', animation: 'feedIn 0.3s ease' }}>
          <button onClick={() => { setView('home'); setError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ← BACK
          </button>

          <div className="receipt" style={{ padding: '24px' }}>
            <div className="thermal-center" style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.15em' }}>NEW BOARD</div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '2px' }}>REGISTER NEW CONFESSION BOARD</div>
            </div>
            <div className="dash-line" style={{ margin: '12px 0' }} />

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '6px' }}>BOARD NAME</label>
                <input className="input" value={boardName} onChange={e => setBoardName(e.target.value)}
                       placeholder="e.g. SSCE CLASS OF 25" maxLength={40} autoFocus />
              </div>

              {/* Expiry picker */}
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '8px' }}>BOARD EXPIRY</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {EXPIRY_OPTIONS.map(opt => {
                    const active = expiry === opt.value
                    return (
                      <button key={opt.label} type="button" onClick={() => setExpiry(opt.value)}
                              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--paper)' : 'var(--ink-3)', border: `1px solid ${active ? 'var(--ink)' : 'var(--ink-5)'}`, cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.04em', textAlign: 'left', transition: 'all 0.1s', width: '100%' }}>
                        <span>{opt.label}</span>
                        <span style={{ fontSize: '9px', opacity: 0.6 }}>{opt.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {error && <p style={{ fontSize: '11px', color: '#cc0000', fontWeight: 600, border: '1px solid #cc0000', padding: '6px 10px' }}>{error}</p>}

              <div className="dash-line" />
              <button type="submit" disabled={loading || !boardName.trim()} className="btn-primary"
                      style={{ width: '100%', opacity: loading || !boardName.trim() ? 0.5 : 1, padding: '11px' }}>
                {loading ? 'PROCESSING...' : 'OPEN REGISTER'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── JOIN ── */}
      {view === 'join' && (
        <div style={{ width: '100%', maxWidth: '360px', animation: 'feedIn 0.3s ease' }}>
          <button onClick={() => { setView('home'); setError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ← BACK
          </button>

          <div className="receipt" style={{ padding: '24px' }}>
            <div className="thermal-center" style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.15em' }}>JOIN BOARD</div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '2px' }}>ACCESS EXISTING BOARD</div>
            </div>
            <div className="dash-line" style={{ margin: '12px 0' }} />
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '6px' }}>INVITE CODE</label>
                <input className="input" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                       placeholder="e.g. W3IR-X9PK" maxLength={9} autoFocus
                       style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }} />
              </div>
              {error && <p style={{ fontSize: '11px', color: '#cc0000', fontWeight: 600, border: '1px solid #cc0000', padding: '6px 10px' }}>{error}</p>}
              <div className="dash-line" />
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', opacity: loading ? 0.6 : 1, padding: '11px' }}>
                {loading ? 'PROCESSING...' : 'ENTER BOARD'}
              </button>
            </form>
            <div className="dash-line" style={{ margin: '14px 0' }} />
            <div className="thermal-center" style={{ fontSize: '10px', color: 'var(--ink-4)' }}>
              <div>NO ACCOUNT REQUIRED</div>
              <div>100% ANONYMOUS</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
