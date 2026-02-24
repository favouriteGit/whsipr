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
    catch { setError('Something went wrong.'); setLoading(false) }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setLoading(true); setError('')
    try {
      const b = await getBoardByCode(code)
      if (!b) { setError('Board not found. Check the code.'); setLoading(false); return }
      router.push(`/board/${b.code}`)
    } catch { setError('Something went wrong.'); setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{ height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 900, fontSize: '16px', color: '#fff' }}>w</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.01em' }}>whispr</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => setView('join')} style={{ padding: '6px 14px', fontSize: '13px' }}>Join board</button>
          <button className="btn-primary" onClick={() => setView('create')} style={{ padding: '6px 14px', fontSize: '13px' }}>Create board</button>
        </div>
      </nav>

      {/* Home view */}
      {view === 'home' && (
        <div className="anim-fade" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>

          {/* Pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 14px', background: 'var(--accent-3)', border: '1px solid var(--accent-2)', borderRadius: '99px', marginBottom: '32px' }}>
            <span className="anim-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'block' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', letterSpacing: '0.04em' }}>LIVE · ANONYMOUS · FREE</span>
          </div>

          <h1 style={{ fontSize: 'clamp(36px,6vw,72px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.03em', marginBottom: '20px', maxWidth: '700px' }}>
            Every confession,<br />
            <span style={{ color: 'var(--text-3)' }}>seen by everyone.</span>
          </h1>

          <p style={{ fontSize: '16px', color: 'var(--text-2)', lineHeight: 1.65, maxWidth: '400px', marginBottom: '40px' }}>
            A shared anonymous board for your group. No gatekeeping, no screenshots — everyone sees everything in real time.
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '72px' }}>
            <button className="btn-primary" onClick={() => setView('create')} style={{ padding: '12px 28px', fontSize: '15px' }}>
              Create a board →
            </button>
            <button className="btn-secondary" onClick={() => setView('join')} style={{ padding: '12px 28px', fontSize: '15px' }}>
              Join with code
            </button>
          </div>

          {/* Features */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1px', background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', overflow: 'hidden', maxWidth: '700px', width: '100%' }}>
            {[
              { title: 'Fully anonymous', desc: 'No accounts. No traces.', icon: '🔒' },
              { title: 'Real-time', desc: 'Posts appear instantly.', icon: '⚡' },
              { title: 'Replies', desc: 'Respond anonymously.', icon: '💬' },
              { title: 'Share cards', desc: 'Post to social media.', icon: '↗' },
            ].map(f => (
              <div key={f.title} style={{ background: 'var(--bg-1)', padding: '22px 20px' }}>
                <div style={{ fontSize: '20px', marginBottom: '8px' }}>{f.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{f.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create / Join */}
      {(view === 'create' || view === 'join') && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
          <div className="anim-up" style={{ width: '100%', maxWidth: '380px' }}>
            <button onClick={() => { setView('home'); setError('') }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: "'Plus Jakarta Sans', sans-serif", padding: 0 }}>
              ← Back
            </button>
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ width: '40px', height: '40px', background: 'var(--accent-3)', border: '1px solid var(--accent-2)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '18px' }}>
                {view === 'create' ? '✦' : '→'}
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>
                {view === 'create' ? 'Create a board' : 'Join a board'}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '22px' }}>
                {view === 'create' ? 'Name it, share the code, let confessions begin.' : 'Enter the code your group shared with you.'}
              </p>
              <form onSubmit={view === 'create' ? handleCreate : handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: '6px' }}>
                    {view === 'create' ? 'Board name' : 'Invite code'}
                  </label>
                  {view === 'create'
                    ? <input className="input" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="e.g. SSCE Class of '25" maxLength={40} autoFocus />
                    : <input className="input" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="e.g. W3IR-X9PK" maxLength={9} autoFocus
                             style={{ fontFamily: "'SF Mono', monospace", letterSpacing: '0.15em', textTransform: 'uppercase' }} />
                  }
                </div>
                {error && <p style={{ fontSize: '13px', color: 'var(--red)', fontWeight: 500 }}>{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', opacity: loading ? 0.6 : 1, padding: '10px' }}>
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
