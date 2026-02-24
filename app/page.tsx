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
    try { const board = await createBoard(boardName.trim()); router.push(`/board/${board.code}`) }
    catch { setError('Something went wrong.'); setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setLoading(true); setError('')
    try {
      const board = await getBoardByCode(code)
      if (!board) { setError('Board not found. Check the code.'); setLoading(false); return }
      router.push(`/board/${board.code}`)
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top nav */}
      <nav style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '26px', height: '26px', background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 900, fontSize: '15px' }}>w</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em' }}>whispr</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-outline" onClick={() => setView('join')} style={{ padding: '7px 14px', fontSize: '13px' }}>Join board</button>
          <button className="btn-amber" onClick={() => setView('create')} style={{ padding: '7px 14px', fontSize: '13px' }}>Create board</button>
        </div>
      </nav>

      {/* Hero */}
      {view === 'home' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', animation: 'fadeIn 0.4s ease' }}>

          {/* Eyebrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px', padding: '6px 14px', background: 'var(--bg-2)', border: '1px solid var(--line-2)', borderRadius: '99px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--amber)', display: 'block', boxShadow: '0 0 6px var(--amber)' }} />
            <span className="mono" style={{ color: 'var(--ink-3)', fontSize: '11px', letterSpacing: '0.08em' }}>ANONYMOUS GROUP CONFESSIONS</span>
          </div>

          {/* Title */}
          <h1 style={{ fontFamily: "'Lora', serif", fontSize: 'clamp(44px, 7vw, 80px)', fontWeight: 600, lineHeight: 1.08, letterSpacing: '-0.03em', textAlign: 'center', maxWidth: '700px', marginBottom: '20px' }}>
            Every secret, posted for<br />
            <span style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>everyone to see.</span>
          </h1>

          <p style={{ fontSize: '16px', color: 'var(--ink-2)', lineHeight: 1.65, textAlign: 'center', maxWidth: '420px', marginBottom: '40px' }}>
            A shared anonymous confession board for your group. No gatekeeping, no screenshots — everyone sees everything.
          </p>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '64px' }}>
            <button className="btn-amber" onClick={() => setView('create')} style={{ padding: '11px 24px', fontSize: '14px' }}>
              Create a board →
            </button>
            <button className="btn-outline" onClick={() => setView('join')} style={{ padding: '11px 24px', fontSize: '14px' }}>
              Join with code
            </button>
          </div>

          {/* Feature row */}
          <div style={{ display: 'flex', gap: '1px', background: 'var(--line)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', maxWidth: '640px', width: '100%' }}>
            {[
              { icon: '🔒', title: 'Fully anonymous', desc: 'No accounts, no traces' },
              { icon: '⚡', title: 'Real-time', desc: 'Confessions appear live' },
              { icon: '💬', title: 'Threaded replies', desc: 'Respond anonymously' },
              { icon: '↗', title: 'Social sharing', desc: 'Share cards to any app' },
            ].map(f => (
              <div key={f.title} style={{ flex: 1, background: 'var(--bg-1)', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '20px' }}>{f.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>{f.title}</span>
                <span style={{ fontSize: '12px', color: 'var(--ink-3)', lineHeight: 1.4 }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Join */}
      {(view === 'create' || view === 'join') && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div style={{ width: '100%', maxWidth: '400px', animation: 'slideUp 0.25s ease' }}>
            <button onClick={() => { setView('home'); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '13px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Bricolage Grotesque', sans-serif", padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ink-2)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink-3)')}>
              ← Back
            </button>

            <div className="whispr-card" style={{ padding: '28px' }}>
              {/* Amber top line */}
              <div style={{ position: 'absolute', top: 0, left: '24px', right: '24px', height: '2px', background: 'linear-gradient(90deg, transparent, var(--amber), transparent)', borderRadius: '0 0 2px 2px' }} />

              <p className="section-label" style={{ marginBottom: '10px' }}>
                {view === 'create' ? '✦ New board' : '→ Join board'}
              </p>
              <h2 style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                {view === 'create' ? 'Create your board' : 'Join a board'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                {view === 'create'
                  ? 'Name it, share the code, let the confessions begin.'
                  : 'Enter the code your group shared with you.'}
              </p>

              <form onSubmit={view === 'create' ? handleCreate : handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="section-label" style={{ display: 'block', marginBottom: '7px' }}>
                    {view === 'create' ? 'Board name' : 'Invite code'}
                  </label>
                  {view === 'create' ? (
                    <input className="field" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="e.g. SSCE Class of '25" maxLength={40} autoFocus />
                  ) : (
                    <input className="field" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="e.g. W3IR-X9PK" maxLength={9} autoFocus
                           style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase' }} />
                  )}
                </div>
                {error && <p style={{ fontSize: '13px', color: 'var(--red)', fontWeight: 500 }}>{error}</p>}
                <button type="submit" disabled={loading} className="btn-amber" style={{ width: '100%', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Loading...' : view === 'create' ? 'Create board' : 'Enter board'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}