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
    try {
      const board = await createBoard(boardName.trim())
      router.push(`/board/${board.code}`)
    } catch { setError('Something went wrong. Try again.'); setLoading(false) }
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
    } catch { setError('Something went wrong. Try again.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>

      {/* Subtle top gradient */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '400px', background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(255,255,255,0.03) 0%, transparent 100%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: '400px', animation: 'fadeIn 0.4s ease' }}>

        {view === 'home' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>

            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '48px' }}>
              <div style={{ width: '28px', height: '28px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 900, fontSize: '16px', color: 'var(--text)' }}>w</span>
              </div>
              <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>whispr</span>
            </div>

            {/* Hero */}
            <h1 style={{ fontSize: '48px', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: '16px', color: 'var(--text)' }}>
              No more<br />
              <span style={{ color: 'var(--text-tertiary)' }}>secrets.</span>
            </h1>

            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '300px', marginBottom: '40px' }}>
              Anonymous confessions on a shared board. No gatekeeping. No selective screenshots.
            </p>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '48px' }}>
              <button className="btn-primary" onClick={() => setView('create')}>
                Create a board
              </button>
              <button className="btn-secondary" onClick={() => setView('join')}>
                Join with code
              </button>
            </div>

            {/* Feature list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
              {[
                { icon: '🔒', text: 'Fully anonymous — no accounts needed' },
                { icon: '⚡', text: 'Real-time — confessions appear instantly' },
                { icon: '💬', text: 'Replies — respond to confessions' },
                { icon: '↗', text: 'Share — post cards to social media' },
              ].map(f => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'left' }}>
                  <span style={{ fontSize: '14px' }}>{f.icon}</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(view === 'create' || view === 'join') && (
          <div style={{ animation: 'slideUp 0.25s ease' }}>
            <button onClick={() => { setView('home'); setError('') }} className="btn-ghost" style={{ marginBottom: '24px', paddingLeft: 0 }}>
              ← Back
            </button>

            <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '16px', padding: '28px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                {view === 'create' ? 'Create a board' : 'Join a board'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '24px' }}>
                {view === 'create'
                  ? 'Name your board, share the code, watch confessions roll in.'
                  : 'Enter the invite code your group shared with you.'}
              </p>

              <form onSubmit={view === 'create' ? handleCreate : handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: '6px' }}>
                    {view === 'create' ? 'Board name' : 'Invite code'}
                  </label>
                  {view === 'create' ? (
                    <input className="input" value={boardName} onChange={e => setBoardName(e.target.value)}
                           placeholder="e.g. SSCE Class of '25" maxLength={40} autoFocus />
                  ) : (
                    <input className="input" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                           placeholder="e.g. W3IR-X9PK" maxLength={9} autoFocus
                           style={{ fontFamily: "'Geist Mono', monospace", letterSpacing: '0.1em', textTransform: 'uppercase' }} />
                  )}
                </div>
                {error && <p style={{ fontSize: '13px', color: 'var(--red)' }}>{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.6 : 1 }}>
                  {loading ? 'Loading...' : view === 'create' ? 'Create board' : 'Enter board'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}