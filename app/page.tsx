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
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Aurora background */}
      <div className="aurora-bg" />
      <div className="aurora-orb" />
      <div className="noise-overlay" />

      <div className="app-content w-full max-w-md">
        {view === 'home' && (
          <div className="flex flex-col items-center text-center" style={{ animation: 'fadeIn 0.6s ease' }}>

            {/* Logo pill */}
            <div className="glass rounded-full px-5 py-2 mb-10 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)] live-dot" />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
                WHISPR
              </span>
            </div>

            {/* Hero */}
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(52px,10vw,96px)', fontWeight: 900, lineHeight: 0.95, marginBottom: '24px' }}>
              <span style={{ display: 'block', color: 'var(--text)' }}>No more</span>
              <span style={{ display: 'block', fontStyle: 'italic', background: 'linear-gradient(135deg, #c2ff47, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                secrets
              </span>
            </h1>

            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '15px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.7, marginBottom: '48px' }}>
              Anonymous confessions posted publicly to your group. No gatekeeping. No selective screenshots.
            </p>

            <div className="flex gap-3 flex-wrap justify-center">
              <button className="btn-accent" onClick={() => setView('create')}>
                ✦ Create a Board
              </button>
              <button className="btn-ghost" onClick={() => setView('join')}>
                Join with Code
              </button>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 justify-center mt-12">
              {['🔒 Fully anonymous', '⚡ Real-time', '💬 Replies', '↗ Share cards'].map(f => (
                <span key={f} className="glass rounded-full px-4 py-1.5"
                      style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.03em' }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {(view === 'create' || view === 'join') && (
          <div style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
            <button onClick={() => { setView('home'); setError('') }}
                    style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--text-dim)', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer' }}
                    className="hover:text-[var(--text-muted)] transition-colors">
              ← back
            </button>

            <div className="glass-modal rounded-3xl p-8">
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: view === 'create' ? 'var(--accent)' : 'var(--text-muted)', marginBottom: '12px' }}>
                {view === 'create' ? '✦ NEW BOARD' : '→ JOIN'}
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontWeight: 700, marginBottom: '8px' }}>
                {view === 'create' ? 'Create your board' : 'Join a board'}
              </h2>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '28px' }}>
                {view === 'create'
                  ? 'Give your group a name. Share the invite code. Watch confessions roll in.'
                  : 'Enter the invite code shared by your group to access the board.'}
              </p>

              <form onSubmit={view === 'create' ? handleCreate : handleJoin} className="flex flex-col gap-4">
                <div>
                  <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>
                    {view === 'create' ? 'Board Name' : 'Invite Code'}
                  </label>
                  {view === 'create' ? (
                    <input className="form-input" value={boardName} onChange={e => setBoardName(e.target.value)}
                           placeholder="e.g. SSCE Class of '25" maxLength={40} autoFocus />
                  ) : (
                    <input className="form-input" value={joinCode}
                           onChange={e => setJoinCode(e.target.value)}
                           placeholder="e.g. W3IR-X9PK" maxLength={9} autoFocus
                           style={{ fontFamily: "'DM Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase' }} />
                  )}
                </div>

                {error && (
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: '#f87171' }}>{error}</p>
                )}

                <button type="submit" disabled={loading} className="btn-accent w-full mt-2"
                        style={{ borderRadius: '14px', clipPath: 'none' }}>
                  {loading ? 'Loading...' : view === 'create' ? 'Create Board →' : 'Enter Board →'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
