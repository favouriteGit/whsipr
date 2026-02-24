'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  toggleReaction, getMyReactions, getSessionId, getAnon, timeAgo,
  MOOD_LABELS, MOODS, type Board, type Confession
} from '@/lib/supabase'
import ShareCard from '@/components/ShareCard'
import RepliesThread from '@/components/RepliesThread'

const REACTIONS = ['❤️','💀','😭','😂','🫂','🔥','😱','👀','🤯','🫡']

export default function BoardPage() {
  const { code } = useParams() as { code: string }
  const [board, setBoard]           = useState<Board | null>(null)
  const [confessions, setConfessions] = useState<Confession[]>([])
  const [myReactions, setMyReactions] = useState<Set<string>>(new Set())
  const [filter, setFilter]         = useState('all')
  const [sort, setSort]             = useState('newest')
  const [loading, setLoading]       = useState(true)
  const [notFound, setNotFound]     = useState(false)
  const [showConfess, setShowConfess] = useState(false)
  const [showInvite, setShowInvite]   = useState(false)
  const [sharing, setSharing]       = useState<Confession | null>(null)
  const [replying, setReplying]     = useState<Confession | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [mobileSheet, setMobileSheet] = useState(false)
  const [liveCount, setLiveCount]   = useState(0)
  const [newBadge, setNewBadge]     = useState(false)
  const [presence, setPresence]     = useState(1) // at least the current user
  const [timeLeft, setTimeLeft]     = useState('')
  const sid = typeof window !== 'undefined' ? getSessionId() : ''

  /* ── Load ── */
  const load = useCallback(async () => {
    try {
      const b = await getBoardByCode(code)
      if (!b) { setNotFound(true); setLoading(false); return }
      setBoard(b)
      const [c, r] = await Promise.all([getConfessions(b.id), getMyReactions(b.id, sid)])
      setConfessions(c); setMyReactions(r); setLiveCount(c.length)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
  }, [code, sid])

  useEffect(() => { load() }, [load])

  /* ── Realtime: confessions + reactions ── */
  useEffect(() => {
    if (!board) return
    const ch = supabase.channel(`board:${board.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confessions', filter: `board_id=eq.${board.id}` }, async () => {
        const c = await getConfessions(board.id)
        setConfessions(c); setLiveCount(c.length)
        setNewBadge(true); setTimeout(() => setNewBadge(false), 3000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, async () => setConfessions(await getConfessions(board.id)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'replies' }, async () => setConfessions(await getConfessions(board.id)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'confessions' }, async () => {
        const c = await getConfessions(board.id); setConfessions(c); setLiveCount(c.length)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [board])

  /* ── Presence tracking ── */
  useEffect(() => {
    if (!board) return
    const presenceChannel = supabase.channel(`presence:${board.id}`, { config: { presence: { key: sid } } })
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setPresence(Object.keys(state).length)
      })
      .on('presence', { event: 'join' }, () => {
        const state = presenceChannel.presenceState()
        setPresence(Object.keys(state).length)
      })
      .on('presence', { event: 'leave' }, () => {
        const state = presenceChannel.presenceState()
        setPresence(Math.max(1, Object.keys(state).length))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() })
        }
      })
    return () => { supabase.removeChannel(presenceChannel) }
  }, [board, sid])

  /* ── Expiry countdown ── */
  useEffect(() => {
    if (!board?.expires_at) { setTimeLeft(''); return }
    function tick() {
      const diff = new Date(board!.expires_at!).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('EXPIRED'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(d > 0 ? `${d}D ${h}H ${m}M` : h > 0 ? `${h}H ${m}M` : `${m}M ${s}S`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
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

  const totalR    = confessions.reduce((s,c)=>s+Object.values(c.reactions).reduce((r,v)=>r+v,0),0)
  const moodCount = confessions.reduce<Record<string,number>>((a,c)=>{a[c.mood]=(a[c.mood]||0)+1;return a},{})
  const todayCount = confessions.filter(c=>Date.now()-+new Date(c.created_at)<86400000).length
  const dateStr   = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'-')

  /* ── Sidebar content shared between desktop + mobile ── */
  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      {/* Live receipt counter */}
      <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '12px', marginBottom: '14px', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(245,242,235,0.5)', marginBottom: '4px' }}>RECEIPTS ISSUED</div>
        <div style={{ fontSize: '30px', fontWeight: 700, letterSpacing: '0.1em', lineHeight: 1, position: 'relative', display: 'inline-block' }}>
          {String(liveCount).padStart(4, '0')}
          {newBadge && (
            <span style={{ position: 'absolute', top: '-6px', right: '-30px', background: '#4ade80', color: '#000', fontSize: '8px', fontWeight: 700, padding: '2px 5px', letterSpacing: '0.05em' }}>+NEW</span>
          )}
        </div>

        {/* Expiry */}
        {timeLeft && (
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(245,242,235,0.15)', fontSize: '10px', color: timeLeft === 'EXPIRED' ? '#f87171' : '#fbbf24', letterSpacing: '0.06em' }}>
            ⏱ {timeLeft === 'EXPIRED' ? 'BOARD EXPIRED' : `EXPIRES: ${timeLeft}`}
          </div>
        )}
        {!timeLeft && !board?.expires_at && (
          <div style={{ marginTop: '4px', fontSize: '9px', color: 'rgba(245,242,235,0.25)', letterSpacing: '0.06em' }}>∞ NO EXPIRY</div>
        )}
      </div>

      {/* Presence */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'var(--paper-2)', border: '1px solid var(--ink-5)', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="anim-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>ONLINE NOW</span>
        </div>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '0.08em' }}>
          {presence} {presence === 1 ? 'PERSON' : 'PEOPLE'}
        </span>
      </div>

      {/* Filter */}
      <p className="label" style={{ marginBottom: '8px' }}>FILTER</p>
      <div className="dash-line" style={{ marginBottom: '10px' }} />
      {[{ key: 'all', label: 'ALL POSTS' }, ...MOODS.map(m => ({ key: m.emoji, label: m.label.toUpperCase() }))].map(f => {
        const active = filter === f.key
        const count  = f.key === 'all' ? confessions.length : (moodCount[f.key] || 0)
        return (
          <button key={f.key} onClick={() => { setFilter(f.key); onClose?.() }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '5px 6px', background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--paper)' : 'var(--ink-3)', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.04em', textAlign: 'left', marginBottom: '2px' }}>
            <span>{f.label}</span>
            {count > 0 && <span style={{ opacity: 0.6 }}>{count}</span>}
          </button>
        )
      })}

      <div className="dash-line" style={{ margin: '12px 0' }} />
      <p className="label" style={{ marginBottom: '8px' }}>STATS</p>
      {[['TOTAL', liveCount], ['REACTIONS', totalR], ['TODAY', todayCount]].map(([k,v]) => (
        <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 6px' }}>
          <span style={{ color: 'var(--ink-3)' }}>{k}</span>
          <span style={{ fontWeight: 700 }}>{v}</span>
        </div>
      ))}

      <div className="dash-line" style={{ margin: '12px 0' }} />
      <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--ink-4)', lineHeight: 1.7 }}>
        <div>{dateStr}</div><div>whispr.name.ng</div>
      </div>
    </>
  )

  /* ── Loading / Not found ── */
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <div className="anim-spin" style={{ width: '18px', height: '18px', border: '2px solid var(--ink-5)', borderTopColor: 'var(--ink)', borderRadius: '50%' }} />
      <p style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em' }}>LOADING...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="receipt" style={{ padding: '24px', textAlign: 'center', maxWidth: '280px' }}>
        <p style={{ fontWeight: 700, letterSpacing: '0.1em', marginBottom: '8px' }}>BOARD NOT FOUND</p>
        <div className="dash-line" style={{ margin: '12px 0' }} />
        <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginBottom: '16px' }}>CHECK THE CODE AND TRY AGAIN</p>
        <a href="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '9px' }}>← HOME</a>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '0 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button onClick={() => setMobileSheet(true)} id="mobile-menu-btn"
                    style={{ background: 'none', border: '1px solid rgba(245,242,235,0.2)', color: 'rgba(245,242,235,0.6)', padding: '4px 8px', fontSize: '12px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', display: 'none' }}>☰</button>
            <a href="/" style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: '16px', color: 'var(--paper)', textDecoration: 'none', letterSpacing: '0.1em', flexShrink: 0 }}>WHISPR</a>
            <span style={{ color: 'rgba(245,242,235,0.25)', fontSize: '14px' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span className="anim-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(245,242,235,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{board?.name.toUpperCase()}</span>
            </div>
            {/* Presence pill in header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', padding: '3px 8px', flexShrink: 0 }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80', display: 'block' }} />
              <span style={{ fontSize: '10px', color: 'rgba(74,222,128,0.9)', letterSpacing: '0.06em', fontWeight: 600 }}>{presence} ONLINE</span>
            </div>
            {/* Live receipt counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(245,242,235,0.06)', border: '1px solid rgba(245,242,235,0.12)', padding: '3px 8px', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', color: 'rgba(245,242,235,0.35)', letterSpacing: '0.06em' }}>RCP</span>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: newBadge ? '#4ade80' : 'rgba(245,242,235,0.75)', transition: 'color 0.4s' }}>#{String(liveCount).padStart(4,'0')}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => setShowInvite(true)} style={{ background: 'transparent', border: '1px solid rgba(245,242,235,0.25)', color: 'rgba(245,242,235,0.65)', padding: '6px 12px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', letterSpacing: '0.06em' }}>INVITE</button>
            <button onClick={() => setShowConfess(true)} style={{ background: 'var(--paper)', border: 'none', color: 'var(--ink)', padding: '6px 14px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em' }}>+ POST</button>
          </div>
        </div>
      </header>

      {/* Disclaimer */}
      <div style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--ink-5)', padding: '7px 20px' }}>
        <p style={{ maxWidth: '1100px', margin: '0 auto', fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.04em', textAlign: 'center' }}>
          ⚠ USE FOR BLACKMAIL, HARASSMENT OR ILLEGAL ACTIVITY IS PROHIBITED AND MAY BE REPORTED TO AUTHORITIES.
        </p>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', display: 'flex', gap: '20px' }}>

        {/* Desktop sidebar */}
        <aside id="desktop-sidebar" style={{ width: '190px', flexShrink: 0 }}>
          <div className="receipt" style={{ padding: '14px 12px' }}>
            <SidebarContent />
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
              {visible.length} RECEIPT{visible.length !== 1 ? 'S' : ''} ISSUED
            </p>
            <select value={sort} onChange={e => setSort(e.target.value)} className="input"
                    style={{ width: 'auto', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', appearance: 'none', letterSpacing: '0.05em' }}>
              <option value="newest">NEWEST FIRST</option>
              <option value="oldest">OLDEST FIRST</option>
              <option value="mostReacted">MOST REACTED</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <div className="receipt" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em', marginBottom: '8px' }}>NO RECEIPTS ISSUED</p>
              <div className="dash-line" style={{ margin: '12px auto', width: '60%' }} />
              <p style={{ fontSize: '11px', color: 'var(--ink-4)' }}>BE THE FIRST TO CONFESS</p>
            </div>
          ) : (
            <div style={{ columns: 'auto', columnWidth: '280px', columnGap: '16px' }}>
              {visible.map((c, i) => (
                <ReceiptCard key={c.id} confession={c} index={i} myReactions={myReactions}
                  onReact={react} onShare={() => setSharing(c)} onReply={() => setReplying(c)} sid={sid} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Mobile bottom sheet ── */}
      {mobileSheet && (
        <>
          <div onClick={() => setMobileSheet(false)}
               style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 70, background: 'var(--paper)', border: '2px solid var(--ink)', borderBottom: 'none', animation: 'slideUp 0.25s ease', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--ink-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ink)', color: 'var(--paper)', position: 'sticky', top: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em' }}>MENU</span>
              <button onClick={() => setMobileSheet(false)} style={{ background: 'none', border: 'none', color: 'rgba(245,242,235,0.6)', cursor: 'pointer', fontSize: '12px', fontFamily: "'IBM Plex Mono',monospace" }}>✕ CLOSE</button>
            </div>
            <div style={{ padding: '16px' }}>
              <SidebarContent onClose={() => setMobileSheet(false)} />
            </div>
          </div>
        </>
      )}

      {/* Mobile FAB */}
      <button onClick={() => setShowConfess(true)} id="mobile-fab"
              style={{ position: 'fixed', bottom: '24px', right: '20px', zIndex: 55, background: 'var(--ink)', color: 'var(--paper)', border: '2px solid var(--ink)', padding: '12px 18px', fontSize: '12px', fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '3px 3px 0 rgba(0,0,0,0.3)', display: 'none' }}>
        + POST
      </button>

      {/* ── Modals ── */}
      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <div className="thermal-center" style={{ marginBottom: '14px' }}>
            <p style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.15em' }}>INVITE MEMBERS</p>
            <p style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '4px' }}>SHARE CODE OR LINK</p>
          </div>
          <div className="dash-line" style={{ margin: '12px 0' }} />
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--paper-2)', border: '1px solid var(--ink-5)', marginBottom: '12px' }}>
            <p className="label" style={{ marginBottom: '6px' }}>BOARD CODE</p>
            <span style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '0.3em' }}>{code}</span>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--ink-4)', overflow: 'hidden', marginBottom: '12px' }}>
            <span style={{ flex: 1, padding: '9px 10px', fontSize: '10px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/board/${code}`); notify('COPIED!') }}
                    style={{ padding: '9px 14px', background: 'var(--ink)', border: 'none', color: 'var(--paper)', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em' }}>
              COPY
            </button>
          </div>
          {board?.expires_at && (
            <div style={{ fontSize: '10px', color: 'var(--ink-4)', textAlign: 'center', letterSpacing: '0.04em' }}>
              ⚠ THIS BOARD EXPIRES: {timeLeft}
            </div>
          )}
        </Modal>
      )}

      {showConfess && (
        <ConfessModal boardId={board!.id}
          onClose={() => setShowConfess(false)}
          onSuccess={() => { setShowConfess(false); notify('RECEIPT ISSUED') }}
          onError={() => notify('ERROR: TRY AGAIN', false)} />
      )}

      {replying && <RepliesThread confession={replying} onClose={() => setReplying(null)} />}
      {sharing && <ShareCard confession={sharing} boardName={board?.name || 'WHISPR'} onClose={() => setSharing(null)} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: toast.ok ? 'var(--ink)' : '#cc0000', color: toast.ok ? 'var(--paper)' : '#fff', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', animation: 'slideUp 0.2s ease', boxShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          #desktop-sidebar { display: none !important; }
          #mobile-menu-btn { display: flex !important; }
          #mobile-fab { display: block !important; }
        }
      `}</style>
    </div>
  )
}

/* ── Receipt Card ── */
function ReceiptCard({ confession: c, index, myReactions, onReact, onShare, onReply }: {
  confession: Confession; index: number; myReactions: Set<string>
  onReact: (id: string, e: string) => void; onShare: () => void; onReply: () => void; sid: string
}) {
  const anon            = getAnon(c.anon_seed)
  const moodLabel       = MOOD_LABELS[c.mood] || 'NEUTRAL'
  const [showAllR, setShowAllR] = useState(false)
  const [picker, setPicker]     = useState(false)
  const txnId           = `TXN#${String(c.anon_seed).slice(-4).padStart(4,'0')}-${c.id.slice(-4).toUpperCase()}`
  const allReactions    = Object.entries(c.reactions).sort((a,b)=>b[1]-a[1])
  const shownReactions  = showAllR ? allReactions : allReactions.slice(0, 3)
  const hiddenCount     = allReactions.length - 3
  const totalR          = allReactions.reduce((s,[,v])=>s+v, 0)
  const replyCount      = c.reply_count || 0

  return (
    <div className="receipt anim-feed" style={{ marginBottom: '16px', breakInside: 'avoid', animationDelay: `${index * 0.04}s` }}>
      <div style={{ padding: '14px' }}>

        {/* Receipt header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>WHISPR · ANONYMOUS POST</div>
          <div style={{ fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.04em' }}>{txnId}</div>
        </div>

        <div className="dash-line" style={{ marginBottom: '8px' }} />

        {/* Meta */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '3px' }}>
          <span>ANON: {anon.letter}{anon.number}</span>
          <span>{timeAgo(c.created_at).toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '10px' }}>
          <span>MOOD: {moodLabel.toUpperCase()}</span>
          <span>RXNS: {totalR}</span>
        </div>

        <div className="dash-line" style={{ marginBottom: '10px' }} />

        {/* Text */}
        <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--ink)', marginBottom: c.image_url ? '10px' : '12px', fontFamily: "'IBM Plex Mono',monospace" }}>
          {c.text}
        </p>

        {/* Image */}
        {c.image_url && (
          <div className="img-wrapper" style={{ marginBottom: '12px', border: '1px solid var(--ink-5)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image_url} alt="attached" className="no-save"
                 style={{ width: '100%', display: 'block', filter: 'grayscale(25%)' }}
                 onContextMenu={e => e.preventDefault()} draggable={false} />
            <div style={{ position: 'absolute', inset: 0, cursor: 'default' }} />
          </div>
        )}

        <div className="dash-line" style={{ marginBottom: '10px' }} />

        {/* Reactions — expandable */}
        {allReactions.length > 0 && (
          <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
            {shownReactions.map(([emoji, count]) => {
              const key     = `${c.id}_${emoji}`
              const reacted = myReactions.has(key)
              return (
                <button key={emoji} onClick={() => onReact(c.id, emoji)}
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", background: reacted ? 'var(--ink)' : 'var(--paper-2)', color: reacted ? 'var(--paper)' : 'var(--ink-3)', border: `1px solid ${reacted ? 'var(--ink)' : 'var(--ink-5)'}`, transition: 'all 0.1s' }}>
                  {emoji} <span style={{ fontSize: '10px' }}>{count}</span>
                </button>
              )
            })}
            {!showAllR && hiddenCount > 0 && (
              <button onClick={() => setShowAllR(true)}
                      style={{ padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", background: 'transparent', color: 'var(--ink-4)', border: '1px dashed var(--ink-5)', letterSpacing: '0.04em' }}>
                +{hiddenCount} MORE
              </button>
            )}
            {showAllR && (
              <button onClick={() => setShowAllR(false)}
                      style={{ padding: '4px 8px', fontSize: '10px', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", background: 'transparent', color: 'var(--ink-4)', border: '1px dashed var(--ink-5)', letterSpacing: '0.04em' }}>
                LESS ↑
              </button>
            )}
          </div>
        )}

        {/* Action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <button className="btn-ghost" onClick={() => setPicker(p => !p)} style={{ fontSize: '10px', padding: '3px 7px', letterSpacing: '0.05em' }}>+RXN</button>
            {picker && (
              <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 0, padding: '8px', background: 'var(--paper)', border: '1px solid var(--ink)', display: 'flex', flexWrap: 'wrap', gap: '2px', width: '184px', zIndex: 20, boxShadow: '3px 3px 0 rgba(0,0,0,0.2)' }}>
                {REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => { onReact(c.id, emoji); setPicker(false) }}
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '15px', border: 'none', background: 'transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper-2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px', alignItems: 'center' }}>
            {/* Reply indicator */}
            <button onClick={onReply}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: replyCount > 0 ? 'var(--paper-2)' : 'transparent', border: `1px solid ${replyCount > 0 ? 'var(--ink-4)' : 'transparent'}`, color: replyCount > 0 ? 'var(--ink-2)' : 'var(--ink-3)', cursor: 'pointer', fontSize: '10px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em' }}>
              <span>💬</span>
              {replyCount > 0
                ? <span style={{ fontWeight: 700 }}>{replyCount} {replyCount === 1 ? 'REPLY' : 'REPLIES'}</span>
                : <span>REPLY</span>
              }
            </button>
            <button onClick={onShare}
                    style={{ padding: '3px 8px', background: 'transparent', border: '1px solid transparent', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '10px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--ink-5)'; e.currentTarget.style.color = 'var(--ink-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--ink-3)' }}>
              SHARE
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Confess Modal ── */
function ConfessModal({ boardId, onClose, onSuccess, onError }: { boardId: string; onClose: () => void; onSuccess: () => void; onError: () => void }) {
  const [text, setText]             = useState('')
  const [mood, setMood]             = useState('😶')
  const [image, setImage]           = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const fileRef                     = useRef<HTMLInputElement>(null)

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { alert('IMAGE TOO LARGE — MAX 5MB'); return }
    setImage(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      let imageUrl: string | undefined
      if (image) {
        const ext  = image.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('confession-images').upload(path, image, { contentType: image.type })
        if (!upErr) {
          const { data } = supabase.storage.from('confession-images').getPublicUrl(path)
          imageUrl = data.publicUrl
        }
      }
      await postConfession(boardId, text.trim(), mood, imageUrl)
      onSuccess()
    } catch { onError(); setLoading(false) }
  }

  return (
    <Modal onClose={onClose}>
      <div className="thermal-center" style={{ marginBottom: '14px' }}>
        <p style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.15em' }}>NEW CONFESSION</p>
        <p style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '2px' }}>100% ANONYMOUS · UNTRACEABLE</p>
      </div>
      <div className="dash-line" style={{ margin: '12px 0' }} />
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>CONFESSION TEXT</label>
          <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="ENTER CONFESSION..." maxLength={500} autoFocus />
          <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--ink-4)', marginTop: '3px' }}>{text.length}/500</div>
        </div>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>ATTACH IMAGE (OPTIONAL)</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
          {imagePreview ? (
            <div style={{ position: 'relative', border: '1px solid var(--ink-4)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block', filter: 'grayscale(20%)' }} />
              <button type="button" onClick={() => { setImage(null); setImagePreview(null) }}
                      style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', padding: '3px 8px', fontSize: '10px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ width: '100%', padding: '14px', border: '1px dashed var(--ink-4)', background: 'transparent', color: 'var(--ink-3)', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', letterSpacing: '0.05em' }}>
              + ATTACH IMAGE (MAX 5MB)
            </button>
          )}
        </div>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '8px' }}>MOOD</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px' }}>
            {MOODS.map(m => {
              const active = mood === m.emoji
              return (
                <button key={m.emoji} type="button" onClick={() => setMood(m.emoji)}
                        style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--paper)' : 'var(--ink-3)', border: `1px solid ${active ? 'var(--ink)' : 'var(--ink-5)'}`, transition: 'all 0.1s' }}>
                  <span style={{ fontSize: '16px' }}>{m.emoji}</span>
                  <span style={{ fontSize: '9px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.04em' }}>{m.label.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="dash-line" />
        <p style={{ fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.03em', lineHeight: 1.7, textAlign: 'center' }}>
          BY POSTING YOU CONFIRM THIS IS NOT USED FOR BLACKMAIL, HARASSMENT OR ILLEGAL ACTIVITY.
        </p>
        <button type="submit" disabled={loading || !text.trim()} className="btn-primary"
                style={{ width: '100%', padding: '11px', opacity: loading || !text.trim() ? 0.5 : 1 }}>
          {loading ? 'PROCESSING...' : 'ISSUE RECEIPT'}
        </button>
      </form>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="overlay anim-fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal anim-up" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '16px', fontFamily: "'IBM Plex Mono',monospace" }}>✕</button>
        {children}
      </div>
    </div>
  )
}
