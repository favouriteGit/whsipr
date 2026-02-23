'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  deleteConfession, toggleReaction, getMyReactions,
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

  // Load board + confessions
  const load = useCallback(async () => {
    try {
      const b = await getBoardByCode(code)
      if (!b) { setNotFound(true); setLoading(false); return }
      setBoard(b)
      const c = await getConfessions(b.id)
      setConfessions(c)
      const r = await getMyReactions(b.id, sessionId)
      setMyReactions(r)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [code, sessionId])

  useEffect(() => { load() }, [load])

  // Realtime subscription
  useEffect(() => {
    if (!board) return

    const channel = supabase
      .channel(`board:${board.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'confessions',
        filter: `board_id=eq.${board.id}`
      }, async () => {
        // Reload all confessions to get fresh reaction counts
        const c = await getConfessions(board.id)
        setConfessions(c)
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'reactions',
      }, async () => {
        const c = await getConfessions(board.id)
        setConfessions(c)
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'confessions',
      }, async () => {
        const c = await getConfessions(board.id)
        setConfessions(c)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [board])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleReaction(confessionId: string, emoji: string) {
    const key = `${confessionId}_${emoji}`
    const wasReacted = myReactions.has(key)

    // Optimistic update
    setMyReactions(prev => {
      const next = new Set(prev)
      wasReacted ? next.delete(key) : next.add(key)
      return next
    })
    setConfessions(prev => prev.map(c => {
      if (c.id !== confessionId) return c
      const r = { ...c.reactions }
      if (wasReacted) {
        r[emoji] = Math.max(0, (r[emoji] || 0) - 1)
        if (r[emoji] === 0) delete r[emoji]
      } else {
        r[emoji] = (r[emoji] || 0) + 1
      }
      return { ...c, reactions: r }
    }))

    await toggleReaction(confessionId, emoji, sessionId, wasReacted)
  }

  function copyLink() {
    const url = `${window.location.origin}/board/${code}`
    navigator.clipboard?.writeText(url)
    showToast('Link copied!')
  }

  // Filtered + sorted confessions
  const visible = confessions
    .filter(c => filter === 'all' || c.mood === filter)
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'mostReacted') {
        const rA = Object.values(a.reactions).reduce((s, v) => s + v, 0)
        const rB = Object.values(b.reactions).reduce((s, v) => s + v, 0)
        return rB - rA
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalReactions = confessions.reduce((s, c) =>
    s + Object.values(c.reactions).reduce((r, v) => r + v, 0), 0)
  const moodCount = confessions.reduce<Record<string, number>>((acc, c) => {
    acc[c.mood] = (acc[c.mood] || 0) + 1; return acc
  }, {})
  const topMood = Object.entries(moodCount).sort((a, b) => b[1] - a[1])[0]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="font-mono text-sm text-muted animate-pulse">loading board...</div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl opacity-30">🤫</div>
      <h1 className="font-playfair text-3xl italic text-muted">Board not found</h1>
      <a href="/" className="font-mono text-xs text-dim hover:text-muted transition-colors">← go home</a>
    </div>
  )

  return (
    <div className="min-h-screen">
      {/* Ticker */}
      <div className="bg-accent text-bg py-1.5 overflow-hidden whitespace-nowrap">
        <span className="inline-block animate-ticker font-mono text-[11px] tracking-widest font-medium">
          {Array(4).fill('✦ NO SCREENSHOTS NEEDED &nbsp;&nbsp;&nbsp; ✦ EVERY CONFESSION IS PUBLIC &nbsp;&nbsp;&nbsp; ✦ YOUR IDENTITY IS PROTECTED &nbsp;&nbsp;&nbsp; ✦ SPEAK FREELY &nbsp;&nbsp;&nbsp;').join('')}
        </span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 h-[60px] flex items-center justify-between px-6 border-b border-[var(--border)]"
              style={{ background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(16px)' }}>
        <div className="flex items-center gap-4">
          <a href="/" className="font-playfair font-black italic text-xl">whispr</a>
          <div className="flex items-center gap-2 bg-surface2 border border-[var(--border)] px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
            <span className="font-mono text-xs text-muted">{board?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowInviteModal(true)}
                  className="w-9 h-9 flex items-center justify-center bg-surface2 border border-[var(--border)] text-muted hover:text-[var(--text)] hover:border-[var(--border2)] transition-all text-sm">
            ↗
          </button>
          <button onClick={() => setShowConfessModal(true)} className="btn-accent py-2 px-4 text-[11px]">
            ✦ Confess
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="bg-surface border-b border-[var(--border)] px-6 py-3 flex gap-8 overflow-x-auto scrollbar-none">
        {[
          { value: confessions.length, label: 'Confessions' },
          { value: confessions.filter(c => Date.now() - new Date(c.created_at).getTime() < 86400000).length, label: 'Today' },
          { value: totalReactions, label: 'Reactions' },
          { value: topMood ? topMood[0] : '—', label: 'Top Mood' },
        ].map(s => (
          <div key={s.label} className="flex flex-col gap-0.5 whitespace-nowrap shrink-0">
            <span className="font-syne font-black text-xl leading-none">{s.value}</span>
            <span className="font-mono text-[10px] text-dim tracking-widest uppercase">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 py-3 flex items-center gap-2 border-b border-[var(--border)] overflow-x-auto scrollbar-none">
        <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-dim whitespace-nowrap mr-1 shrink-0">Filter:</span>
        {[{ key: 'all', label: 'All' }, ...MOODS.map(m => ({ key: m.emoji, label: `${m.emoji} ${m.label}` }))].map(f => (
          <button key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-3 py-1.5 font-mono text-[11px] border whitespace-nowrap transition-all ${
                    filter === f.key
                      ? 'border-accent text-accent bg-accent-dim'
                      : 'border-[var(--border)] text-muted hover:border-[var(--border2)] hover:text-[var(--text)]'
                  }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Board */}
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <div className="flex items-baseline justify-between mb-7 flex-wrap gap-3">
          <div className="font-playfair italic text-sm text-muted">
            <strong className="not-italic font-syne font-black text-2xl text-[var(--text)] mr-1.5">{visible.length}</strong>
            confessions
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-surface2 border border-[var(--border)] text-muted font-mono text-[11px] px-3 py-1.5 outline-none cursor-pointer"
            style={{ appearance: 'none' }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="mostReacted">Most reacted</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-6 opacity-30">🤫</div>
            <h3 className="font-playfair italic text-2xl text-muted mb-3">The board is silent...</h3>
            <p className="font-mono text-xs text-dim">No confessions here yet. Be the first to speak.</p>
          </div>
        ) : (
          <div style={{ columns: 'auto', columnWidth: '320px', columnGap: '16px' }}>
            {visible.map((c, i) => (
              <ConfessionCard
                key={c.id}
                confession={c}
                index={i}
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
        <ConfessModal
          boardId={board!.id}
          onClose={() => setShowConfessModal(false)}
          onSuccess={() => { setShowConfessModal(false); showToast('Confession posted ✦') }}
          onError={() => showToast('Something went wrong', 'error')}
        />
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)}>
          <div className="font-mono text-xs tracking-[0.2em] text-muted mb-4">→ INVITE</div>
          <h2 className="font-playfair text-3xl font-bold mb-2">Invite members</h2>
          <p className="font-mono text-xs text-muted leading-relaxed mb-6">
            Share this code or link. Anyone with it can view and post confessions anonymously.
          </p>

          <Divider>board code</Divider>
          <div className="text-center py-5">
            <span className="font-mono text-4xl tracking-[0.3em] text-accent font-medium">{code}</span>
          </div>

          <Divider>or share link</Divider>
          <div className="flex mt-4 bg-surface2 border border-[var(--border)]">
            <span className="flex-1 px-4 py-2.5 font-mono text-[11px] text-muted overflow-hidden text-ellipsis whitespace-nowrap">
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={copyLink}
                    className="px-4 py-2.5 font-mono text-[11px] bg-surface3 border-l border-[var(--border)] text-muted hover:text-accent hover:bg-accent-dim transition-all">
              Copy
            </button>
          </div>
        </Modal>
      )}

      {/* Replies Thread Modal */}
      {replyingTo && (
        <RepliesThread
          confession={replyingTo}
          onClose={() => setReplyingTo(null)}
        />
      )}

      {/* Share Card Modal */}
      {sharingConfession && (
        <ShareCard
          confession={sharingConfession}
          boardName={board?.name || 'whispr'}
          onClose={() => setSharingConfession(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-5 py-3 bg-surface border font-mono text-xs clip-corner-sm animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)] ${
          toast.type === 'success' ? 'border-accent text-[var(--text)]' : 'border-[#ff4757] text-[var(--text)]'
        }`}>
          <span className={toast.type === 'success' ? 'text-accent' : 'text-[#ff4757]'}>
            {toast.type === 'success' ? '✦' : '✕'}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Confession Card ────────────────────────────────────────

function ConfessionCard({
  confession: c, index, myReactions, onReact, onShare, onReply
}: {
  confession: Confession
  index: number
  myReactions: Set<string>
  onReact: (id: string, emoji: string) => void
  onShare: () => void
  onReply: () => void
  sessionId: string
}) {
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#888'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const isFeatured = c.text.length > 180

  const topReactions = Object.entries(c.reactions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const [showPicker, setShowPicker] = useState(false)

  return (
    <div
      className={`break-inside-avoid mb-4 p-6 border border-[var(--border)] relative transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border2)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] animate-card-in ${
        isFeatured ? 'bg-gradient-to-br from-surface to-[#0d0d0d] border-[var(--border2)]' : 'bg-surface'
      }`}
      style={{ animationDelay: `${index * 0.04}s` }}>

      {/* Mood strip */}
      <div className="absolute left-0 top-[20%] bottom-[20%] w-[2px]" style={{ background: color }} />

      {/* Decorative quote mark */}
      <div className="absolute top-4 right-4 font-playfair text-[72px] leading-none pointer-events-none select-none"
           style={{ color: 'rgba(255,255,255,0.03)', lineHeight: '0.6' }}>"</div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold border"
               style={{ background: `${anon.color}18`, borderColor: `${anon.color}40`, color: anon.color }}>
            {anon.letter}
          </div>
          <span className="font-mono text-[11px] text-dim">Anon #{anon.number}</span>
        </div>
        <span className="font-mono text-[10px] text-dim">{timeAgo(c.created_at)}</span>
      </div>

      {/* Text */}
      <p className={`font-playfair leading-relaxed mb-5 text-[var(--text)] ${isFeatured ? 'text-[18px] italic' : 'text-[15px]'}`}>
        {c.text}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] flex-wrap gap-2">
        <div className="flex flex-wrap gap-1.5 relative">
          {topReactions.map(([emoji, count]) => {
            const key = `${c.id}_${emoji}`
            const reacted = myReactions.has(key)
            return (
              <button key={emoji}
                      onClick={() => onReact(c.id, emoji)}
                      className={`flex items-center gap-1 px-2.5 py-1 font-mono text-[11px] border transition-all ${
                        reacted
                          ? 'bg-accent-dim border-accent text-accent'
                          : 'bg-surface2 border-[var(--border)] text-muted hover:border-[var(--border2)] hover:text-[var(--text)]'
                      }`}>
                {emoji} <span>{count}</span>
              </button>
            )
          })}
          <div className="relative">
            <button onClick={onReply}
                  className="px-2.5 py-1 font-mono text-[11px] border bg-surface2 border-[var(--border)] text-muted hover:border-[var(--border2)] hover:text-[var(--text)] transition-all flex items-center gap-1">
            💬 Reply
          </button>
              className="px-2.5 py-1 font-mono text-[11px] border bg-surface2 border-[var(--border)] text-muted hover:border-[var(--border2)] hover:text-[var(--text)] transition-all">
              + React
            </button>
            {showPicker && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-surface3 border border-[var(--border2)] flex flex-wrap gap-1 z-10 w-[180px] shadow-xl">
                {REACTION_EMOJIS.map(emoji => (
                  <button key={emoji}
                          onClick={() => { onReact(c.id, emoji); setShowPicker(false) }}
                          className="w-8 h-8 flex items-center justify-center hover:bg-[var(--surface)] rounded text-base transition-colors">
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="font-mono text-[10px] px-2 py-1 border flex items-center gap-2"
              style={{ color, borderColor: `${color}30`, background: `${color}10` }}>
          {c.mood} {moodLabel.toUpperCase()}
          <button onClick={onShare}
                  className="ml-1 opacity-60 hover:opacity-100 transition-opacity"
                  title="Share this confession">
            ↗
          </button>
        </span>
      </div>
    </div>
  )
}

// ── Confess Modal ──────────────────────────────────────────

function ConfessModal({ boardId, onClose, onSuccess, onError }: {
  boardId: string
  onClose: () => void
  onSuccess: () => void
  onError: () => void
}) {
  const [text, setText] = useState('')
  const [mood, setMood] = useState('😶')
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      await postConfession(boardId, text.trim(), mood)
      onSuccess()
    } catch {
      onError()
      setLoading(false)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="font-mono text-xs tracking-[0.2em] text-accent mb-4">✦ CONFESS</div>
      <h2 className="font-playfair text-3xl font-bold mb-2">Speak your truth</h2>
      <p className="font-mono text-xs text-muted leading-relaxed mb-6">
        Your confession is posted anonymously. No one can trace it back to you.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <label className="block font-mono text-xs tracking-widest uppercase text-muted mb-2">Your confession</label>
          <textarea
            className="form-textarea"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="I have a confession..."
            maxLength={500}
            autoFocus
          />
          <div className="text-right font-mono text-[11px] text-dim mt-1">{text.length} / 500</div>
        </div>
        <div>
          <label className="block font-mono text-xs tracking-widest uppercase text-muted mb-2">Mood</label>
          <div className="grid grid-cols-4 gap-2">
            {MOODS.map(m => (
              <button key={m.emoji} type="button"
                      onClick={() => setMood(m.emoji)}
                      className={`py-2 text-lg border flex flex-col items-center gap-0.5 transition-all ${
                        mood === m.emoji
                          ? 'border-accent bg-accent-dim'
                          : 'border-[var(--border)] bg-surface2 text-muted hover:border-[var(--border2)]'
                      }`}>
                {m.emoji}
                <span className="font-mono text-[9px] tracking-wider">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading || !text.trim()}
                className="btn-accent w-full justify-center text-center disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ clipPath: 'none' }}>
          {loading ? 'Posting...' : 'Post Anonymously ✦'}
        </button>
      </form>
    </Modal>
  )
}

// ── Shared Modal Shell ─────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-[fadeIn_0.2s_ease]"
         style={{ background: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(8px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-[var(--border2)] w-full max-w-[460px] p-10 relative animate-slide-up clip-corner-lg">
        <button onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-muted hover:text-[var(--text)] transition-colors text-lg">
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-dim font-mono text-[10px] tracking-[0.2em] uppercase my-2">
      <span className="flex-1 h-px bg-[var(--border)]" />
      {children}
      <span className="flex-1 h-px bg-[var(--border)]" />
    </div>
  )
}
