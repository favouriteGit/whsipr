'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  toggleReaction, getMyReactions, getSessionId, getAnon, timeAgo,
  MOOD_COLORS, MOOD_LABELS, MOODS, type Board, type Confession
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
      const [c, r] = await Promise.all([getConfessions(b.id), getMyReactions(b.id, sessionId)])
      setConfessions(c); setMyReactions(r)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }, [code, sessionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!board) return
    const channel = supabase.channel(`board:${board.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confessions', filter: `board_id=eq.${board.id}` },
        async () => { const c = await getConfessions(board.id); setConfessions(c) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' },
        async () => { const c = await getConfessions(board.id); setConfessions(c) })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'confessions' },
        async () => { const c = await getConfessions(board.id); setConfessions(c) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [board])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000)
  }

  async function handleReaction(confessionId: string, emoji: string) {
    const key = `${confessionId}_${emoji}`
    const wasReacted = myReactions.has(key)
    setMyReactions(prev => { const n = new Set(prev); wasReacted ? n.delete(key) : n.add(key); return n })
    setConfessions(prev => prev.map(c => {
      if (c.id !== confessionId) return c
      const r = { ...c.reactions }
      if (wasReacted) { r[emoji] = Math.max(0, (r[emoji]||0)-1); if (!r[emoji]) delete r[emoji] }
      else r[emoji] = (r[emoji]||0)+1
      return { ...c, reactions: r }
    }))
    await toggleReaction(confessionId, emoji, sessionId, wasReacted)
  }

  function copyLink() {
    navigator.clipboard?.writeText(`${window.location.origin}/board/${code}`)
    showToast('Link copied!')
  }

  const visible = confessions
    .filter(c => filter === 'all' || c.mood === filter)
    .sort((a, b) => {
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'mostReacted') return Object.values(b.reactions).reduce((s,v)=>s+v,0) - Object.values(a.reactions).reduce((s,v)=>s+v,0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalReactions = confessions.reduce((s,c) => s + Object.values(c.reactions).reduce((r,v)=>r+v,0), 0)
  const moodCount = confessions.reduce<Record<string,number>>((acc,c) => { acc[c.mood]=(acc[c.mood]||0)+1; return acc }, {})
  const topMood = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '20px', height: '20px', border: '2px solid var(--border)', borderTopColor: 'var(--text-secondary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Loading board...</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <span style={{ fontSize: '40px', opacity: 0.2 }}>🤫</span>
      <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-secondary)' }}>Board not found</h1>
      <a href="/" style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>← Go home</a>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/" style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 900, fontSize: '17px', color: 'var(--text)', textDecoration: 'none' }}>whispr</a>
          <span style={{ color: 'var(--border-focus)', fontSize: '16px' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{board?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-secondary" onClick={() => setShowInviteModal(true)} style={{ padding: '6px 12px', fontSize: '12px' }}>
            Invite ↗
          </button>
          <button className="btn-primary" onClick={() => setShowConfessModal(true)} style={{ fontSize: '12px', padding: '6px 14px' }}>
            + Confess
          </button>
        </div>
      </header>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { value: confessions.length, label: 'Total', color: 'var(--text)' },
            { value: confessions.filter(c => Date.now()-new Date(c.created_at).getTime()<86400000).length, label: 'Today', color: 'var(--green)' },
            { value: totalReactions, label: 'Reactions', color: 'var(--text)' },
            { value: topMood?.[0] || '—', label: 'Top mood', color: 'var(--text)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
          {[{ key: 'all', label: 'All' }, ...MOODS.map(m => ({ key: m.emoji, label: `${m.emoji} ${m.label}` }))].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif',
                      background: filter === f.key ? 'var(--bg-elevated)' : 'transparent',
                      border: `1px solid ${filter === f.key ? 'var(--border-focus)' : 'transparent'}`,
                      color: filter === f.key ? 'var(--text)' : 'var(--text-tertiary)',
                    }}>
              {f.label}
            </button>
          ))}
          <select value={sort} onChange={e => setSort(e.target.value)}
                  style={{ marginLeft: 'auto', background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', fontSize: '12px', outline: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', appearance: 'none', paddingRight: '24px' }}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="mostReacted">Most reacted</option>
          </select>
        </div>

        {/* Count */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>{visible.length}</span> confession{visible.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Masonry grid */}
        {visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px', opacity: 0.15 }}>🤫</div>
            <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Nothing here yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Be the first to confess.</p>
          </div>
        ) : (
          <div style={{ columns: 'auto', columnWidth: '280px', columnGap: '12px' }}>
            {visible.map((c, i) => (
              <ConfessionCard key={c.id} confession={c} index={i}
                myReactions={myReactions} onReact={handleReaction}
                onShare={() => setSharingConfession(c)} onReply={() => setReplyingTo(c)} sessionId={sessionId} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showConfessModal && (
        <ConfessModal boardId={board!.id}
          onClose={() => setShowConfessModal(false)}
          onSuccess={() => { setShowConfessModal(false); showToast('Posted anonymously') }}
          onError={() => showToast('Something went wrong', 'error')} />
      )}

      {showInviteModal && (
        <Modal onClose={() => setShowInviteModal(false)}>
          <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>Invite members</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Share this code or link with your group.</p>

          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px', textAlign: 'center', marginBottom: '16px' }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '28px', fontWeight: 500, letterSpacing: '0.2em', color: 'var(--text)' }}>{code}</span>
          </div>

          <div style={{ display: 'flex', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <span style={{ flex: 1, padding: '10px 12px', fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: "'Geist Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={copyLink} style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 500, background: 'var(--bg-elevated)', border: 'none', borderLeft: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Copy
            </button>
          </div>
        </Modal>
      )}

      {replyingTo && <RepliesThread confession={replyingTo} onClose={() => setReplyingTo(null)} />}
      {sharingConfession && <ShareCard confession={sharingConfession} boardName={board?.name||'whispr'} onClose={() => setSharingConfession(null)} />}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--border-focus)', borderRadius: '8px', fontSize: '13px', animation: 'slideUp 0.2s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <span style={{ color: toast.type === 'success' ? 'var(--green)' : 'var(--red)' }}>
            {toast.type === 'success' ? '✓' : '✕'}
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
  const color = MOOD_COLORS[c.mood] || '#666'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const topReactions = Object.entries(c.reactions).sort((a,b)=>b[1]-a[1]).slice(0,3)
  const [showPicker, setShowPicker] = useState(false)

  return (
    <div className="card animate-card-in" style={{ marginBottom: '12px', padding: '16px', breakInside: 'avoid', animationDelay: `${index*0.03}s`, position: 'relative', overflow: 'hidden' }}>

      {/* Mood color top bar */}
      <div style={{ position: 'absolute', top: 0, left: '16px', right: '16px', height: '2px', background: color, borderRadius: '0 0 2px 2px', opacity: 0.6 }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: `${anon.color}18`, border: `1px solid ${anon.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: anon.color, fontFamily: "'Geist Mono', monospace" }}>
            {anon.letter}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: "'Geist Mono', monospace" }}>
            Anon #{anon.number}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="badge" style={{ color, borderColor: `${color}30`, background: `${color}10`, fontSize: '10px' }}>
            {c.mood} {moodLabel}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: "'Geist Mono', monospace" }}>
            {timeAgo(c.created_at)}
          </span>
        </div>
      </div>

      {/* Text */}
      <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text)', marginBottom: '14px', fontWeight: c.text.length > 100 ? 400 : 500 }}>
        {c.text}
      </p>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
        {topReactions.map(([emoji, count]) => {
          const key = `${c.id}_${emoji}`
          const reacted = myReactions.has(key)
          return (
            <button key={emoji} onClick={() => onReact(c.id, emoji)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s', background: reacted ? 'rgba(255,255,255,0.08)' : 'transparent', border: `1px solid ${reacted ? 'var(--border-focus)' : 'transparent'}`, color: reacted ? 'var(--text)' : 'var(--text-tertiary)' }}>
              {emoji} <span>{count}</span>
            </button>
          )
        })}

        <div style={{ position: 'relative' }}>
          <button className="btn-ghost" onClick={() => setShowPicker(p => !p)} style={{ padding: '3px 8px', fontSize: '11px' }}>
            + React
          </button>
          {showPicker && (
            <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px', padding: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border-focus)', borderRadius: '10px', display: 'flex', flexWrap: 'wrap', gap: '2px', width: '176px', zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
              {REACTION_EMOJIS.map(emoji => (
                <button key={emoji} onClick={() => { onReact(c.id, emoji); setShowPicker(false) }}
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', border: 'none', background: 'transparent', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          <button className="btn-ghost" onClick={onReply} style={{ padding: '3px 8px', fontSize: '11px' }}>
            💬 Reply
          </button>
          <button className="btn-ghost" onClick={onShare} style={{ padding: '3px 8px', fontSize: '11px' }}>
            ↗ Share
          </button>
        </div>
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
      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '4px' }}>Confess anonymously</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>No one can trace this back to you.</p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Your confession</label>
          <textarea className="textarea" value={text} onChange={e => setText(e.target.value)}
                    placeholder="I have a confession..." maxLength={500} autoFocus />
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', fontFamily: "'Geist Mono', monospace" }}>
            {text.length} / 500
          </div>
        </div>

        <div>
          <label className="label" style={{ display: 'block', marginBottom: '8px' }}>Mood</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            {MOODS.map(m => (
              <button key={m.emoji} type="button" onClick={() => setMood(m.emoji)}
                      style={{ padding: '8px 4px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '18px', transition: 'all 0.15s', background: mood === m.emoji ? 'var(--bg-hover)' : 'var(--bg-subtle)', border: `1px solid ${mood === m.emoji ? 'var(--border-focus)' : 'var(--border)'}` }}>
                {m.emoji}
                <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.03em' }}>{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button type="submit" disabled={loading || !text.trim()} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', opacity: loading || !text.trim() ? 0.5 : 1 }}>
          {loading ? 'Posting...' : 'Post anonymously'}
        </button>
      </form>
    </Modal>
  )
}

// ── Modal Shell ────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
         style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.15s ease' }}>
      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-focus)', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '24px', position: 'relative', animation: 'slideUp 0.2s ease', boxShadow: '0 24px 60px rgba(0,0,0,0.6)' }}>
        <button onClick={onClose}
                style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px', borderRadius: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}