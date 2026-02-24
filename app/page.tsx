'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBoard, getBoardByCode } from '@/lib/supabase'

export default function HomePage() {
  const router = useRouter()
  const [view, setView] = useState<'home' | 'create' | 'join'>('home')
  const [boardName, setBoardName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!boardName.trim()) return
    setLoading(true); setError('')
    try { const b = await createBoard(boardName.trim()); router.push(`/board/${b.code}`) }
    catch { setError('ERROR: COULD NOT PROCESS'); setLoading(false) }
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

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-')
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px' }}>

      {view === 'home' && (
        <div style={{ width: '100%', maxWidth: '360px', animation: 'feedIn 0.4s ease' }}>
          {/* Main receipt */}
          <div className="receipt receipt-torn-top receipt-torn-bottom" style={{ padding: '28px 24px' }}>

            {/* Store header */}
            <div className="thermal-center" style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '0.15em' }}>WHISPR</div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.1em', marginTop: '2px' }}>ANONYMOUS CONFESSIONS CO.</div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.05em' }}>EST. 2025 · whispr.name.ng</div>
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            {/* Receipt details */}
            <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '12px' }}>
              {[
                ['DATE', dateStr],
                ['TIME', timeStr],
                ['TERMINAL', 'WEB-01'],
                ['CASHIER', 'ANONYMOUS'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                  <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            {/* "Items" */}
            <div style={{ fontSize: '11px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '12px' }}>
                <span>ITEM</span><span>QTY</span>
              </div>
              {[
                ['ANONYMOUS POST', '∞'],
                ['REAL-TIME SYNC', '1'],
                ['REPLY THREADS', '1'],
                ['IMAGE ATTACH', '1'],
                ['SOCIAL SHARE', '5'],
              ].map(([item, qty]) => (
                <div key={item} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item}</span>
                  <span style={{ fontWeight: 600 }}>{qty}</span>
                </div>
              ))}
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--ink-3)' }}>SUBTOTAL</span>
              <span>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--ink-3)' }}>ANONYMITY TAX</span>
              <span>$0.00</span>
            </div>
            <div className="dash-line" style={{ margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700 }}>
              <span>TOTAL</span>
              <span>$0.00</span>
            </div>

            <div className="dash-line" style={{ margin: '16px 0' }} />

            {/* CTA buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <button className="btn-primary" onClick={() => setView('create')} style={{ width: '100%', padding: '11px' }}>
                [01] CREATE A BOARD
              </button>
              <button className="btn-secondary" onClick={() => setView('join')} style={{ width: '100%', padding: '11px' }}>
                [02] JOIN WITH CODE
              </button>
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            {/* Footer */}
            <div className="thermal-center" style={{ fontSize: '10px', color: 'var(--ink-3)', lineHeight: 1.8 }}>
              <div>** KEEP THIS RECEIPT **</div>
              <div>THANK YOU FOR YOUR CONFESSION</div>
              <div style={{ marginTop: '6px', letterSpacing: '0.15em' }}>|||||| ||| || |||| ||| | ||||</div>
              <div style={{ marginTop: '4px', fontSize: '9px' }}>TXN#WSPRNG-{Math.floor(Math.random()*999999).toString().padStart(6,'0')}</div>
            </div>
          </div>
        </div>
      )}

      {(view === 'create' || view === 'join') && (
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <button onClick={() => { setView('home'); setError('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", marginBottom: '16px', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ← BACK
          </button>

          <div className="receipt" style={{ padding: '24px' }}>
            <div className="thermal-center" style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.15em' }}>
                {view === 'create' ? 'NEW BOARD' : 'JOIN BOARD'}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '2px' }}>
                {view === 'create' ? 'REGISTER NEW CONFESSION BOARD' : 'ACCESS EXISTING BOARD'}
              </div>
            </div>

            <div className="dash-line" style={{ margin: '12px 0' }} />

            <form onSubmit={view === 'create' ? handleCreate : handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="label" style={{ display: 'block', marginBottom: '6px' }}>
                  {view === 'create' ? 'BOARD NAME' : 'INVITE CODE'}
                </label>
                {view === 'create'
                  ? <input className="input" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="e.g. SSCE CLASS OF 25" maxLength={40} autoFocus />
                  : <input className="input" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="e.g. W3IR-X9PK" maxLength={9} autoFocus style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }} />
                }
              </div>
              {error && (
                <p style={{ fontSize: '11px', color: '#cc0000', fontWeight: 600, letterSpacing: '0.05em', border: '1px solid #cc0000', padding: '6px 10px' }}>{error}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'PROCESSING...' : view === 'create' ? 'OPEN REGISTER' : 'ENTER BOARD'}
              </button>
            </form>

            <div className="dash-line" style={{ margin: '16px 0' }} />
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
