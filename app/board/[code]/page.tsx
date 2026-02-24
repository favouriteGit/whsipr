'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  toggleReaction, getMyReactions, getSessionId, getAnon, timeAgo,
  MOOD_COLORS, MOOD_LABELS, MOOD_BG, MOODS, type Board, type Confession
} from '@/lib/supabase'
import ShareCard from '@/components/ShareCard'
import RepliesThread from '@/components/RepliesThread'

const REACTIONS = ['❤️','💀','😭','😂','🫂','🔥','😱','👀','🤯','🫡']

export default function BoardPage() {
  const { code } = useParams() as { code: string }
  const [board, setBoard] = useState<Board | null>(null)
  const [confessions, setConfessions] = useState<Confession[]>([])
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showConfess, setShowConfess] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [sharing, setSharing] = useState<Confession | null>(null)
  const [replying, setReplying] = useState<Confession | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const sid = typeof window !== 'undefined' ? getSessionId() : ''

  const load = useCallback(async () => {
    try {
      const b = await getBoardByCode(code)
      if (!b) { setNotFound(true); setLoading(false); return }
      setBoard(b)
      const [c, r] = await Promise.all([getConfessions(b.id), getMyReactions(b.id, sid)])
      setConfessions(c); setMyReactions(r)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }, [code, sid])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!board) return
    const ch = supabase.channel(`board:${board.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confessions', filter: `board_id=eq.${board.id}` }, async () => setConfessions(await getConfessions(board.id)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, async () => setConfessions(await getConfessions(board.id)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'confessions' }, async () => setConfessions(await getConfessions(board.id)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [board])

  function notify(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  async function react(confessionId: string, emoji: string) {
    const key = `${confessionId}_${emoji}`
    const was = myReactions.has(key)
    setMyReactions(p => { const n = new Set(p); was ? n.delete(key) : n.add(key); return n })
    setConfessions(p => p.map(c => {
      if (c.id !== confessionId) return c
      const r = { ...c.reactions }
      if (was) { r[emoji] = Math.max(0,(r[emoji]||0)-1); if (!r[emoji]) delete r[emoji] }
      else r[emoji] = (r[emoji]||0)+1
      return { ...c, reactions: r }
    }))
    await toggleReaction(confessionId, emoji, sid, was)
  }

  const visible = confessions
    .filter(c => filter === 'all' || c.mood === filter)
    .sort((a, b) => {
      if (sort === 'oldest') return +new Date(a.created_at) - +new Date(b.created_at)
      if (sort === 'mostReacted') return Object.values(b.reactions).reduce((s,v)=>s+v,0) - Object.values(a.reactions).reduce((s,v)=>s+v,0)
      return +new Date(b.created_at) - +new Date(a.created_at)
    })

  const totalR = confessions.reduce((s,c)=>s+Object.values(c.reactions).reduce((r,v)=>r+v,0),0)
  const moodCount = confessions.reduce<Record<string,number>>((a,c)=>{a[c.mood]=(a[c.mood]||0)+1;return a},{})
  const topMood = Object.entries(moodCount).sort((a,b)=>b[1]-a[1])[0]
  const todayCount = confessions.filter(c=>Date.now()-+new Date(c.created_at)<86400000).length

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <div className="anim-spin" style={{ width: '20px', height: '20px', border: '2px solid var(--border-2)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
      <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Loading...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
      <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-2)' }}>Board not found</p>
      <a href="/" style={{ fontSize: '13px', color: 'var(--accent)' }}>← Go home</a>
    </div>
  )

  const SidebarContent = () => (
    <>
      <p className="label" style={{ padding: '0 12px', marginBottom: '8px' }}>Moods</p>
      {[{ key: 'all', label: 'All', color: '' }, ...MOODS.map(m => ({ key: m.emoji, label: m.label, color: MOOD_COLORS[m.emoji] }))].map(f => {
        const active = filter === f.key
        const count = f.key === 'all' ? confessions.length : (moodCount[f.key] || 0)
        return (
          <button key={f.key} onClick={() => { setFilter(f.key); setSidebarOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 'var(--r-md)', background: active ? 'var(--bg-3)' : 'transparent', border: `1px solid ${active ? 'var(--border-2)' : 'transparent'}`, color: active ? 'var(--text)' : 'var(--text-3)', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 400, fontFamily: "'Plus Jakarta Sans',sans-serif", width: '100%', transition: 'all 0.1s', textAlign: 'left' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {f.key !== 'all' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: f.color, display: 'block', flexShrink: 0 }} />}
              {f.key === 'all' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-3)', display: 'block', flexShrink: 0 }} />}
              {f.label}
            </span>
            {count > 0 && <span style={{ fontSize: '11px', color: 'var(--text-4)', background: 'var(--bg-2)', padding: '1px 7px', borderRadius: '99px', border: '1px solid var(--border)', fontFamily: 'monospace' }}>{count}</span>}
          </button>
        )
      })}

      <div style={{ height: '1px', background: 'var(--border)', margin: '16px 0' }} />
      <p className="label" style={{ padding: '0 12px', marginBottom: '12px' }}>Overview</p>
      {[
        { label: 'Confessions', value: confessions.length },
        { label: 'Today', value: todayCount },
        { label: 'Reactions', value: totalR },
        ...(topMood ? [{ label: 'Top mood', value: MOOD_LABELS[topMood[0]] || topMood[0] }] : []),
      ].map(s => (
        <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{s.label}</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)' }}>{s.value}</span>
        </div>
      ))}
    </>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--border)', background: 'rgba(15,15,16,0.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 50, gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {/* Mobile sidebar toggle */}
          <button onClick={() => setSidebarOpen(s => !s)} className="btn-ghost" style={{ padding: '6px', display: 'none' }} id="sidebar-toggle">
            ☰
          </button>
          <a href="/" style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontWeight: 900, fontSize: '18px', color: 'var(--text)', textDecoration: 'none', flexShrink: 0 }}>whispr</a>
          <span style={{ color: 'var(--border-3)', fontSize: '16px' }}>/</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
            <span className="anim-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board?.name}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button className="btn-secondary" onClick={() => setShowInvite(true)} style={{ padding: '6px 12px', fontSize: '12px' }}>Invite ↗</button>
          <button className="btn-primary" onClick={() => setShowConfess(true)} style={{ padding: '7px 14px', fontSize: '13px' }}>+ Confess</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar — desktop */}
        <aside style={{ width: '200px', flexShrink: 0, borderRight: '1px solid var(--border)', padding: '20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', position: 'sticky', top: '52px', height: 'calc(100vh - 52px)' }}>
          <SidebarContent />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.5)' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '240px', height: '100%', background: 'var(--bg-1)', borderRight: '1px solid var(--border)', padding: '20px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Main */}
        <main style={{ flex: 1, padding: '24px 20px', minWidth: 0, overflowY: 'auto' }}>

          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {filter === 'all' ? 'All confessions' : `${MOOD_LABELS[filter] || filter}`}
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{visible.length} post{visible.length !== 1 ? 's' : ''}</p>
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)} className="input" style={{ width: 'auto', padding: '7px 12px', fontSize: '12px', cursor: 'pointer', appearance: 'none' }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="mostReacted">Most reacted</option>
            </select>
          </div>

          {/* Cards */}
          {visible.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <p style={{ fontSize: '32px', opacity: 0.1, marginBottom: '14px' }}>🤫</p>
              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-2)', marginBottom: '6px' }}>Nothing here yet</p>
              <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Be the first to speak your truth.</p>
            </div>
          ) : (
            <div style={{ columns: 'auto', columnWidth: '280px', columnGap: '12px' }}>
              {visible.map((c, i) => (
                <ConfessionCard key={c.id} confession={c} index={i} myReactions={myReactions}
                  onReact={react} onShare={() => setSharing(c)} onReply={() => setReplying(c)} sid={sid} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showConfess && (
        <ConfessModal boardId={board!.id}
          onClose={() => setShowConfess(false)}
          onSuccess={() => { setShowConfess(false); notify('Confession posted') }}
          onError={() => notify('Something went wrong', false)} />
      )}

      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '6px' }}>Invite to {board?.name}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>Share the code or link. Anyone can view and post anonymously.</p>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-lg)', padding: '20px', textAlign: 'center', marginBottom: '14px' }}>
            <p className="label" style={{ marginBottom: '8px' }}>Board code</p>
            <span style={{ fontFamily: 'monospace', fontSize: '28px', fontWeight: 700, letterSpacing: '0.25em', color: 'var(--accent)' }}>{code}</span>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
            <span style={{ flex: 1, padding: '10px 12px', fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/board/${code}`); notify('Copied!') }}
                    style={{ padding: '10px 16px', background: 'var(--bg-2)', border: 'none', borderLeft: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
              Copy
            </button>
          </div>
        </Modal>
      )}

      {replying && <RepliesThread confession={replying} onClose={() => setReplying(null)} />}
      {sharing && <ShareCard confession={sharing} boardName={board?.name || 'whispr'} onClose={() => setSharing(null)} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'var(--bg-2)', border: `1px solid ${toast.ok ? 'var(--border-2)' : 'rgba(239,68,68,0.3)'}`, borderRadius: 'var(--r-lg)', fontSize: '13px', fontWeight: 500, animation: 'slideUp 0.2s ease', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          <span style={{ color: toast.ok ? 'var(--green)' : 'var(--red)' }}>{toast.ok ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
      )}

      {/* Mobile sidebar toggle button — shown via CSS media query workaround */}
      <style>{`
        @media (max-width: 640px) {
          aside { display: none !important; }
          #sidebar-toggle { display: flex !important; }
        }
      `}</style>
    </div>
  )
}

// ── Confession Card ───────────────────────────────────────
function ConfessionCard({ confession: c, index, myReactions, onReact, onShare, onReply }: {
  confession: Confession; index: number; myReactions: Set<string>
  onReact: (id: string, e: string) => void; onShare: () => void; onReply: () => void; sid: string
}) {
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#666'
  const bg = MOOD_BG[c.mood] || 'transparent'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const topR = Object.entries(c.reactions).sort((a,b)=>b[1]-a[1]).slice(0,3)
  const [picker, setPicker] = useState(false)
  const long = c.text.length > 150

  return (
    <div className="card anim-card" style={{ marginBottom: '12px', breakInside: 'avoid', animationDelay: `${index * 0.03}s`, overflow: 'visible' }}>

      {/* Mood accent line */}
      <div style={{ height: '3px', background: color, borderRadius: 'var(--r-xl) var(--r-xl) 0 0', opacity: 0.7 }} />

      <div style={{ padding: '16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${anon.color}18`, border: `1.5px solid ${anon.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: anon.color, fontFamily: 'monospace', flexShrink: 0 }}>
              {anon.letter}
            </div>
            <span className="mono" style={{ color: 'var(--text-3)' }}>Anon #{anon.number}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span className="badge" style={{ color, borderColor: `${color}25`, background: bg, fontSize: '10px', padding: '2px 8px' }}>
              {moodLabel}
            </span>
            <span className="mono" style={{ color: 'var(--text-4)', fontSize: '10px' }}>{timeAgo(c.created_at)}</span>
          </div>
        </div>

        {/* Text */}
        <p style={{ fontSize: long ? '15px' : '14px', lineHeight: 1.7, color: 'var(--text)', marginBottom: '14px', fontWeight: long ? 400 : 500 }}>
          {c.text}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          {topR.map(([emoji, count]) => {
            const key = `${c.id}_${emoji}`
            const reacted = myReactions.has(key)
            return (
              <button key={emoji} onClick={() => onReact(c.id, emoji)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 9px', borderRadius: 'var(--r-sm)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all 0.15s', background: reacted ? 'var(--accent-3)' : 'var(--bg-2)', border: `1px solid ${reacted ? 'var(--accent-2)' : 'var(--border)'}`, color: reacted ? 'var(--accent)' : 'var(--text-3)', fontWeight: reacted ? 600 : 400 }}>
                {emoji} <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{count}</span>
              </button>
            )
          })}

          <div style={{ position: 'relative' }}>
            <button className="btn-ghost" onClick={() => setPicker(p => !p)} style={{ fontSize: '11px', padding: '4px 9px' }}>+ React</button>
            {picker && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, padding: '8px', background: 'var(--bg-2)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-lg)', display: 'flex', flexWrap: 'wrap', gap: '2px', width: '184px', zIndex: 20, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}>
                {REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => { onReact(c.id, emoji); setPicker(false) }}
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontSize: '15px', border: 'none', background: 'transparent', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <button className="btn-ghost" onClick={onReply} style={{ fontSize: '11px', padding: '4px 9px' }}>Reply</button>
            <button className="btn-ghost" onClick={onShare} style={{ fontSize: '11px', padding: '4px 9px', color: 'var(--accent)' }}>Share</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Confess Modal ─────────────────────────────────────────
function ConfessModal({ boardId, onClose, onSuccess, onError }: { boardId: string; onClose: () => void; onSuccess: () => void; onError: () => void }) {
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
      <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '4px' }}>Post anonymously</h2>
      <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '20px' }}>No one can trace this back to you.</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>Confession</label>
          <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="I have a confession..." maxLength={500} autoFocus />
          <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-4)', marginTop: '4px', fontFamily: 'monospace' }}>{text.length}/500</div>
        </div>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '8px' }}>Mood</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '6px' }}>
            {MOODS.map(m => {
              const active = mood === m.emoji
              const c = MOOD_COLORS[m.emoji] || '#666'
              return (
                <button key={m.emoji} type="button" onClick={() => setMood(m.emoji)}
                        style={{ padding: '10px 4px', borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', transition: 'all 0.15s', background: active ? `${c}12` : 'var(--bg-2)', border: `1px solid ${active ? `${c}35` : 'var(--border)'}` }}>
                  <span style={{ fontSize: '18px' }}>{m.emoji}</span>
                  <span style={{ fontSize: '9px', color: active ? c : 'var(--text-4)', fontFamily: 'monospace', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <button type="submit" disabled={loading || !text.trim()} className="btn-primary" style={{ width: '100%', padding: '11px', opacity: loading || !text.trim() ? 0.5 : 1 }}>
          {loading ? 'Posting...' : 'Post anonymously'}
        </button>
      </form>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="overlay anim-fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-up">
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px 6px', borderRadius: 'var(--r-sm)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>✕</button>
        {children}
      </div>
    </div>
  )
}
