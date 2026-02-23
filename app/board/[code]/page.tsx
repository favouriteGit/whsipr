'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  toggleReaction, getMyReactions,
  getSessionId, getAnon, timeAgo, MOOD_COLORS, MOOD_LABELS, MOODS,
  type Board, type Confession
} from '@/lib/supabase'
import ShareCard from '@/components/ShareCard'
import RepliesThread from '@/components/RepliesThread'

const REACTION_EMOJIS = ['❤️', '💀', '😭', '😂', '🫂', '🔥', '😱', '👀', '🤯', '🫡']

export default function BoardPage() {
  const { code } = useParams() as { code: string }
  const [board, setBoard] = useState<Board | null>(null)
  const [confessions, setConfessions] = useState<Confession[]>([])
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showConfessModal, setShowConfessModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [sharingConfession, setSharingConfession] = useState<Confession | null>(null)
  const [replyingTo, setReplyingTo] = useState<Confession | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const sessionId = typeof window !== 'undefined' ? getSessionId() : ''

  const load = useCallback(async () => {
    try {
      const b = await getBoardByCode(code)
      if (!b) { setNotFound(true); setLoading(false); return }
      setBoard(b)
      const c = await getConfessions(b.id)
      setConfessions(c)
      const r = await getMyReactions(b.id, sessionId)
      setMyReactions(r)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }, [code, sessionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!board) return
    const channel = supabase.channel(`board:${board.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confessions', filter: `board_id=eq.${board.id}` }, async () => {
        const c = await getConfessions(board.id); setConfessions(c)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, async () => {
        const c = await getConfessions(board.id); setConfessions(c)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'confessions' }, async () => {
        const c = await getConfessions(board.id); setConfessions(c)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [board])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  async function handleReaction(confessionId: string, emoji: string) {
    const key = `${confessionId}_${emoji}`
    const wasReacted = myReactions.has(key)
    setMyReactions(prev => { const next = new Set(prev); wasReacted ? next.delete(key) : next.add(key); return next })
    setConfessions(prev => prev.map(c => {
      if (c.id !== confessionId) return c
      const r = { ...c.reactions }
      if (wasReacted) { r[emoji] = Math.max(0, (r[emoji] || 0) - 1); if (r[emoji] === 0) delete r[emoji] }
      else { r[emoji] = (r[emoji] || 0) + 1 }
      return { ...c, reactions: r }
    }))
    await toggleReaction(confessionId, emoji, sessionId, wasReacted)
  }

  function copyLink() {
    const url = `${window.location.origin}/board/${code}`
    navigator.clipboard?.writeText(url)
    showToast('Link copied!')
  }

  const visible = confessions
    .filter(c => filter === 'all' || c.mood === filter)
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'mostReacted') {
        return Object.values(b.reactions).reduce((s,v)=>s+v,0) - Object.values(a.reactions).reduce((s,v)=>s+v,0)
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalReactions = confessions.reduce((s, c) => s + Object.values(c.reactions).reduce((r,v)=>r+v,0), 0)
  const moodCount = confessions.reduce<Record<string,number>>((acc, c) => { acc[c.mood]=(acc[c.mood]||0)+1; return acc }, {})
  const topMood = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="aurora-bg" /><div className="aurora-orb" /><div className="noise-overlay" />
      <div className="app-content flex flex-col items-center gap-4">
        <div className="glass rounded-full w-12 h-12 flex items-center justify-center" style={{ animation: 'glowPulse 2s infinite' }}>
          <span style={{ fontSize: '20px' }}>🤫</span>
        </div>
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--text-dim)' }}>loading board...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="aurora-bg" /><div className="aurora-orb" /><div className="noise-overlay" />
      <div className="app-content text-center">
        <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.3 }}>🤫</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '12px' }}>Board not found</h1>
        <a href="/" style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--text-dim)' }} className="hover:text-[var(--text-muted)] transition-colors">← go home</a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen">
      <div className="aurora-bg" /><div className="aurora-orb" /><div className="noise-overlay" />

      {/* Ticker */}
      <div className="app-content overflow-hidden whitespace-nowrap py-2 px-0"
           style={{ background: 'linear-gradient(90deg, var(--accent), #7fff00)', borderBottom: '1px solid rgba(194,255,71,0.2)' }}>
        <span className="animate-ticker inline-block"
              style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 600, letterSpacing: '0.15em', color: '#06060f' }}>
          {Array(6).fill('✦ NO SCREENSHOTS &nbsp;&nbsp; ✦ FULLY ANONYMOUS &nbsp;&nbsp; ✦ REAL-TIME &nbsp;&nbsp; ✦ SPEAK FREELY &nbsp;&nbsp;').join('')}
        </span>
      </div>

      {/* Header */}
      <header className="app-content sticky top-0 z-50 px-6 h-16 flex items-center justify-between"
              style={{ background: 'rgba(6,6,18,0.7)', backdropFilter: 'blur(24px)', borderBottom: '1px solid var(--glass-border)' }}>
        <div className="flex items-center gap-3">
          <a href="/" style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontWeight: 900, fontStyle: 'italic', color: 'var(--text)' }}>
            whispr
          </a>
          <div className="glass rounded-full flex items-center gap-2 px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: '#22c55e', color: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--text-muted)' }}>{board?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInviteModal(true)}
                  className="glass rounded-full w-9 h-9 flex items-center justify-center text-sm transition-all hover:scale-105"
                  style={{ color: 'var(--text-muted)' }}>
            ↗
          </button>
          <button onClick={() => setShowConfessModal(true)} className="btn-accent py-2 px-5 text-[11px]">
            ✦ Confess
          </button>
        </div>
      </header>

      <div className="app-content max-w-[1280px] mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { value: confessions.length, label: 'Confessions', color: 'var(--purple)' },
            { value: confessions.filter(c => Date.now()-new Date(c.created_at).getTime()<86400000).length, label: 'Today', color: 'var(--cyan)' },
            { value: totalReactions, label: 'Reactions', color: 'var(--pink)' },
            { value: topMood?.[0] || '—', label: 'Top Mood', color: 'var(--accent)' },
          ].map(s => (
            <div key={s.label} className="glass rounded-2xl p-4 flex flex-col gap-1">
              <span style={{ fontSize: '24px', fontWeight: 800, color: s.color, fontFamily: "'Plus Jakarta Sans', sans-serif", lineHeight: 1 }}>{s.value}</span>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[{ key: 'all', label: 'All' }, ...MOODS.map(m => ({ key: m.emoji, label: `${m.emoji} ${m.label}` }))].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    className="rounded-full px-4 py-2 transition-all whitespace-nowrap text-xs font-semibold"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      background: filter === f.key ? 'rgba(139,92,246,0.2)' : 'var(--glass)',
                      border: `1px solid ${filter === f.key ? 'rgba(139,92,246,0.5)' : 'var(--glass-border)'}`,
                      color: filter === f.key ? '#c4b5fd' : 'var(--text-muted)',
                      backdropFilter: 'blur(12px)',
                      boxShadow: filter === f.key ? '0 0 16px rgba(139,92,246,0.2)' : 'none',
                    }}>
              {f.label}
            </button>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value)}
                  className="ml-auto rounded-full px-4 py-2 text-xs outline-none cursor-pointer"
                  style={{ fontFamily: "'DM Mono', monospace", background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', backdropFilter: 'blur(12px)', appearance: 'none', minWidth: '130px' }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="mostReacted">Most reacted</option>
          </select>
        </div>

        {/* Board count */}
        <div className="mb-5 flex items-baseline gap-2">
          <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{visible.length}</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '14px' }}>confessions</span>
        </div>

        {/* Masonry grid */}
        {visible.length === 0 ? (
          <div className="text-center py-24">
            <div style={{ fontSize: '56px', marginBottom: '20px', opacity: 0.2 }}>🤫</div>
            <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '24px', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '10px' }}>The board is silent...</h3>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '12px', color: 'var(--text-dim)' }}>No confessions here yet. Be the first to speak.</p>
          </div>
        ) : (
          <div style={{ columns: 'auto', columnWidth: '300px', columnGap: '16px' }}>
            {visible.map((c, i) => (
              <ConfessionCard
                key={c.id} confession={c} index={i}
                myReactions={myReactions}
                onReact={handleReaction}
                onShare={() => setSharingConfession(c)}
                onReply={() => setReplyingTo(c)}
                sessionId={sessionId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confess Modal */}
      {showConfessModal && (
        <ConfessModal boardId={board!.id}
          onClose={() => setShowConfessModal(false)}
          onSuccess={() => { setShowConfessModal(false); showToast('Confession posted ✦') }}
          onError={() => showToast('Something went wrong', 'error')} />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: '12px' }}>→ INVITE</div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>Invite members</h2>
          <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '24px' }}>
            Share this code or link. Anyone can view and post confessions anonymously.
          </p>
          <div className="rounded-2xl p-6 mb-4 text-center" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '36px', letterSpacing: '0.3em', color: 'var(--accent)', fontWeight: 500 }}>{code}</span>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
            <span className="flex-1 px-4 py-3" style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={copyLink} className="px-4 py-3 text-xs font-semibold transition-all hover:text-[var(--accent)]"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'rgba(255,255,255,0.04)', borderLeft: '1px solid var(--glass-border)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Copy
            </button>
          </div>
        </Modal>
      )}

      {/* Replies */}
      {replyingTo && <RepliesThread confession={replyingTo} onClose={() => setReplyingTo(null)} />}

      {/* Share */}
      {sharingConfession && <ShareCard confession={sharingConfession} boardName={board?.name || 'whispr'} onClose={() => setSharingConfession(null)} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[200] glass-modal rounded-2xl flex items-center gap-3 px-5 py-3"
             style={{ animation: 'slideUp 0.3s cubic-bezier(0.16,1,0.3,1)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px' }}>
          <span style={{ color: toast.type === 'success' ? 'var(--accent)' : '#f87171' }}>
            {toast.type === 'success' ? '✦' : '✕'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Confession Card ────────────────────────────────────────
function ConfessionCard({ confession: c, index, myReactions, onReact, onShare, onReply }: {
  confession: Confession; index: number; myReactions: Set<string>
  onReact: (id: string, emoji: string) => void
  onShare: () => void; onReply: () => void; sessionId: string
}) {
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#888'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const isFeatured = c.text.length > 180
  const topReactions = Object.entries(c.reactions).sort((a,b)=>b[1]-a[1]).slice(0,3)
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="break-inside-avoid mb-4 glass rounded-2xl p-5 relative cursor-default animate-card-in"
         style={{ animationDelay: `${index * 0.04}s`, overflow: 'hidden' }}>

      {/* Mood glow top edge */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.7 }} />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
               style={{ background: `${anon.color}20`, border: `1px solid ${anon.color}40`, color: anon.color, fontFamily: "'DM Mono', monospace" }}>
            {anon.letter}
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--text-dim)' }}>Anon #{anon.number}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2.5 py-0.5 text-[10px]"
                style={{ fontFamily: "'DM Mono', monospace", background: `${color}15`, color, border: `1px solid ${color}30` }}>
            {c.mood} {moodLabel}
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--text-dim)' }}>{timeAgo(c.created_at)}</span>
        </div>
      </div>

      {/* Text */}
      <p style={{
        fontFamily: isFeatured ? "'Playfair Display', serif" : "'Plus Jakarta Sans', sans-serif",
        fontSize: isFeatured ? '17px' : '14px',
        fontStyle: isFeatured ? 'italic' : 'normal',
        lineHeight: 1.7,
        color: 'var(--text)',
        marginBottom: '16px',
        fontWeight: isFeatured ? 400 : 400,
      }}>
        {c.text}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {topReactions.map(([emoji, count]) => {
          const key = `${c.id}_${emoji}`
          const reacted = myReactions.has(key)
          return (
            <button key={emoji} onClick={() => onReact(c.id, emoji)}
                    className="rounded-full px-2.5 py-1 text-xs flex items-center gap-1 transition-all"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      background: reacted ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${reacted ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                      color: reacted ? '#c4b5fd' : 'var(--text-muted)',
                      transform: reacted ? 'scale(1.05)' : 'scale(1)',
                    }}>
              {emoji} <span>{count}</span>
            </button>
          )
        })}

        {/* React picker */}
        <div className="relative">
          <button onClick={() => setShowPicker(p => !p)}
                  className="rounded-full px-2.5 py-1 text-xs transition-all"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)' }}>
            + React
          </button>
          {showPicker && (
            <div className="absolute bottom-full left-0 mb-2 p-2 rounded-2xl z-10 flex flex-wrap gap-1 w-[180px]"
                 style={{ background: 'rgba(10,8,30,0.95)', backdropFilter: 'blur(24px)', border: '1px solid var(--glass-border)', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' }}>
              {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReact(c.id, emoji); setShowPicker(false) }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-base transition-all hover:scale-110"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={onReply}
                className="rounded-full px-2.5 py-1 text-xs transition-all ml-auto"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-dim)' }}>
          💬 Reply
        </button>
        <button onClick={onShare}
                className="rounded-full px-2.5 py-1 text-xs transition-all"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: 'rgba(194,255,71,0.08)', border: '1px solid rgba(194,255,71,0.2)', color: 'var(--accent)' }}>
          ↗ Share
        </button>
      </div>
    </div>
  )
}

// ── Confess Modal ──────────────────────────────────────────
function ConfessModal({ boardId, onClose, onSuccess, onError }: {
  boardId: string; onClose: () => void; onSuccess: () => void; onError: () => void
}) {
  const [text, setText] = useState('')
  const [mood, setMood] = useState('😶')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || loading) return
    setLoading(true)
    try { await postConfession(boardId, text.trim(), mood); onSuccess() }
    catch { onError(); setLoading(false) }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.2em', color: 'var(--accent)', marginBottom: '12px' }}>✦ CONFESS</div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '26px', fontWeight: 700, marginBottom: '6px' }}>Speak your truth</h2>
      <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: '24px' }}>
        Your confession is anonymous. No one can trace it back to you.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>
            Your confession
          </label>
          <textarea className="form-textarea" value={text} onChange={e => setText(e.target.value)}
                    placeholder="I have a confession..." maxLength={500} autoFocus />
          <div style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
            {text.length} / 500
          </div>
        </div>
        <div>
          <label style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', display: 'block', marginBottom: '8px' }}>
            Mood
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map(m => (
              <button key={m.emoji} type="button" onClick={() => setMood(m.emoji)}
                      className="py-2.5 rounded-xl flex flex-col items-center gap-1 transition-all text-lg"
                      style={{
                        background: mood === m.emoji ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${mood === m.emoji ? 'rgba(139,92,246,0.5)' : 'var(--glass-border)'}`,
                        boxShadow: mood === m.emoji ? '0 0 16px rgba(139,92,246,0.2)' : 'none',
                      }}>
                {m.emoji}
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '9px', color: mood === m.emoji ? '#c4b5fd' : 'var(--text-dim)', letterSpacing: '0.05em' }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading || !text.trim()} className="btn-accent w-full mt-1"
                style={{ borderRadius: '14px', clipPath: 'none', opacity: loading || !text.trim() ? 0.4 : 1 }}>
          {loading ? 'Posting...' : 'Post Anonymously ✦'}
        </button>
      </form>
    </Modal>
  )
}

// ── Modal Shell ────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
         style={{ background: 'rgba(4,4,18,0.85)', backdropFilter: 'blur(16px)', animation: 'fadeIn 0.2s ease' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="glass-modal rounded-3xl w-full max-w-[460px] p-8 relative"
           style={{ animation: 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
        <button onClick={onClose}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full transition-all"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}
