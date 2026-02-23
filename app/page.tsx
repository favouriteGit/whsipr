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
    setLoading(true)
    setError('')
    try {
      const board = await createBoard(boardName.trim())
      router.push(`/board/${board.code}`)
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setLoading(true)
    setError('')
    try {
      const board = await getBoardByCode(code)
      if (!board) {
        setError('Board not found. Check the code and try again.')
        setLoading(false)
        return
      }
      router.push(`/board/${board.code}`)
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* Glow */}
      <div className="absolute w-[600px] h-[600px] rounded-full pointer-events-none"
           style={{ background: 'radial-gradient(circle, rgba(232,255,71,0.06) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />

      {view === 'home' && (
        <div className="flex flex-col items-center animate-[slideUp_0.4s_ease]">
          {/* Logo mark */}
          <div className="flex items-center gap-3 mb-12">
            <span className="h-px w-10 bg-[var(--border2)]" />
            <span className="font-playfair italic text-xs tracking-[0.3em] text-muted uppercase">whispr</span>
            <span className="h-px w-10 bg-[var(--border2)]" />
          </div>

          {/* Hero */}
          <h1 className="font-playfair font-black text-center leading-none mb-8" style={{ fontSize: 'clamp(64px,12vw,140px)' }}>
            <span className="block text-[var(--text)]">No more</span>
            <span className="block italic" style={{ color: 'transparent', WebkitTextStroke: '1.5px #e8ff47' }}>secrets</span>
          </h1>

          <p className="font-mono text-sm text-muted text-center max-w-sm leading-relaxed mb-14">
            Anonymous confessions, posted publicly to your group board.
            No gatekeeping. No selective screenshots. Just raw truth.
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <button className="btn-accent" onClick={() => setView('create')}>
              ✦ Create a Board
            </button>
            <button className="btn-ghost" onClick={() => setView('join')}>
              Join with Code
            </button>
          </div>

          <div className="mt-10 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            <span className="font-mono text-xs text-dim tracking-widest">your identity is never stored</span>
          </div>
        </div>
      )}

      {view === 'create' && (
        <div className="w-full max-w-md animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
          <button onClick={() => setView('home')} className="font-mono text-xs text-dim mb-8 hover:text-muted transition-colors flex items-center gap-2">
            ← back
          </button>
          <div className="font-mono text-xs tracking-[0.2em] text-accent mb-4">✦ NEW BOARD</div>
          <h2 className="font-playfair text-4xl font-bold mb-2">Create your board</h2>
          <p className="font-mono text-xs text-muted leading-relaxed mb-8">
            Give your group a name. Share the invite code. Watch the confessions roll in.
          </p>

          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-muted mb-2">Board Name</label>
              <input
                className="form-input"
                value={boardName}
                onChange={e => setBoardName(e.target.value)}
                placeholder="e.g. SSCE Class of '25"
                maxLength={40}
                autoFocus
              />
            </div>
            {error && <p className="font-mono text-xs text-[#ff4757]">{error}</p>}
            <button type="submit" disabled={loading} className="btn-accent w-full text-center justify-center mt-2" style={{ clipPath: 'none' }}>
              {loading ? 'Creating...' : 'Create Board →'}
            </button>
          </form>
        </div>
      )}

      {view === 'join' && (
        <div className="w-full max-w-md animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
          <button onClick={() => setView('home')} className="font-mono text-xs text-dim mb-8 hover:text-muted transition-colors flex items-center gap-2">
            ← back
          </button>
          <div className="font-mono text-xs tracking-[0.2em] text-muted mb-4">→ JOIN</div>
          <h2 className="font-playfair text-4xl font-bold mb-2">Join a board</h2>
          <p className="font-mono text-xs text-muted leading-relaxed mb-8">
            Enter the invite code shared by your group to access the confession board.
          </p>

          <form onSubmit={handleJoin} className="flex flex-col gap-4">
            <div>
              <label className="block font-mono text-xs tracking-widest uppercase text-muted mb-2">Invite Code</label>
              <input
                className="form-input font-mono tracking-widest uppercase"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                placeholder="e.g. W3IR-X9PK"
                maxLength={9}
                autoFocus
              />
            </div>
            {error && <p className="font-mono text-xs text-[#ff4757]">{error}</p>}
            <button type="submit" disabled={loading} className="btn-accent w-full text-center justify-center mt-2" style={{ clipPath: 'none' }}>
              {loading ? 'Searching...' : 'Enter Board →'}
            </button>
          </form>
        </div>
      )}
    </main>
  )
}
