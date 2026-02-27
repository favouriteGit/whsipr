'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  toggleReaction, getMyReactions, getSessionId, getAnon, timeAgo,
  MOOD_LABELS, MOODS, verifyBoardPassword, getBoardAccess, setBoardAccess,
  type Board, type Confession
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
  const [isExpired, setIsExpired]   = useState(false)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [showConfess, setShowConfess] = useState(false)
  const [showInvite, setShowInvite]   = useState(false)
  const [sharing, setSharing]       = useState<Confession | null>(null)
  const [replying, setReplying]     = useState<Confession | null>(null)
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null)
  const [mobileSheet, setMobileSheet] = useState(false)
  const [showIntro, setShowIntro]     = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('whispr_theme') === 'dark'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('whispr_theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  /* ── Show stories intro to first-time visitors joining via invite link ── */
  useEffect(() => {
    const seen = localStorage.getItem('whispr_intro_seen')
    if (!seen) setShowIntro(true)
  }, [])

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
      if (b.expires_at && new Date(b.expires_at).getTime() < Date.now()) {
        setIsExpired(true); setLoading(false); return
      }
      // Check password gate
      if (b.has_password && !getBoardAccess(b.id)) {
        setNeedsPassword(true); setLoading(false); return
      }
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
      if (diff <= 0) { setTimeLeft('EXPIRED'); setIsExpired(true); return }
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
  // Apply dark mode to document
  useEffect(() => { document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light") }, [darkMode])

  /* ── Sidebar content shared between desktop + mobile ── */
  const SidebarContent = ({ onClose, isMobile }: { onClose?: () => void; isMobile?: boolean }) => (
    <>
      {/* Invite button — only shown inside mobile sheet */}
      {isMobile && (
        <>
          <button onClick={() => { setShowInvite(true); onClose?.() }}
                  style={{ width: '100%', padding: '10px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, letterSpacing: '0.08em', marginBottom: '12px' }}>
            INVITE MEMBERS ↗
          </button>
          <div className="dash-line" style={{ marginBottom: '14px' }} />
        </>
      )}
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

  if (isExpired) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '340px' }}>
        <div className="receipt receipt-torn-top receipt-torn-bottom" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '4px' }}>WHISPR</div>
          <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.08em', marginBottom: '16px' }}>ANONYMOUS CONFESSIONS CO.</div>

          <div className="dash-line" style={{ margin: '12px 0' }} />

          <div style={{ fontSize: '40px', marginBottom: '8px' }}>🧾</div>
          <p style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.15em', marginBottom: '4px' }}>BOARD EXPIRED</p>
          <p style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.06em', lineHeight: 1.7, marginBottom: '16px' }}>
            THIS BOARD HAS REACHED ITS EXPIRY DATE.<br />ALL CONFESSIONS HAVE BEEN PERMANENTLY DELETED.
          </p>

          <div className="dash-line" style={{ margin: '12px 0' }} />

          <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-3)' }}>BOARD</span>
              <span style={{ fontWeight: 600 }}>{board?.name?.toUpperCase() || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-3)' }}>CODE</span>
              <span style={{ fontWeight: 600, letterSpacing: '0.1em' }}>{code}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-3)' }}>STATUS</span>
              <span style={{ fontWeight: 700, color: '#cc0000' }}>VOID</span>
            </div>
          </div>

          <div className="dash-line" style={{ margin: '12px 0' }} />

          <a href="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '11px', marginBottom: '12px' }}>
            OPEN NEW BOARD
          </a>

          <div style={{ fontSize: '10px', color: 'var(--ink-4)', lineHeight: 1.8, letterSpacing: '0.06em' }}>
            <div>** THIS RECEIPT IS VOID **</div>
            <div style={{ marginTop: '6px', letterSpacing: '0.15em' }}>|||||| ||| || |||| ||| | ||||</div>
          </div>
        </div>
      </div>
    </div>
  )

  if (needsPassword) return (
    <PasswordGate board={board!} onSuccess={() => { setNeedsPassword(false); load() }} />
  )

  /* ── Board intro: inline stories — no iframe, no external file ── */
  if (showIntro) return <WhisprIntro onDone={() => { localStorage.setItem('whispr_intro_seen','1'); setShowIntro(false) }} />

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '0 16px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          {/* Left side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileSheet(true)} id="mobile-menu-btn"
                    style={{ background: 'none', border: '1px solid rgba(245,242,235,0.2)', color: 'rgba(245,242,235,0.6)', padding: '5px 8px', fontSize: '12px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', display: 'none', flexShrink: 0 }}>☰</button>

            {/* Logo — always visible */}
            <a href="/" style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: '15px', color: 'var(--paper)', textDecoration: 'none', letterSpacing: '0.1em', flexShrink: 0 }}>WHISPR</a>

            {/* Separator + board name — hidden on mobile */}
            <span className="hdr-desktop" style={{ color: 'rgba(245,242,235,0.25)' }}>|</span>
            <div className="hdr-desktop" style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              <span className="anim-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(245,242,235,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{board?.name.toUpperCase()}</span>
            </div>

            {/* Presence pill — hidden on mobile */}
            <div className="hdr-desktop" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', padding: '3px 8px', flexShrink: 0 }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80', display: 'block' }} />
              <span style={{ fontSize: '10px', color: 'rgba(74,222,128,0.9)', letterSpacing: '0.06em', fontWeight: 600 }}>{presence} ONLINE</span>
            </div>

            {/* Receipt counter — hidden on mobile */}
            <div className="hdr-desktop" style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(245,242,235,0.06)', border: '1px solid rgba(245,242,235,0.12)', padding: '3px 8px', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', color: 'rgba(245,242,235,0.35)', letterSpacing: '0.06em' }}>RCP</span>
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: newBadge ? '#4ade80' : 'rgba(245,242,235,0.75)', transition: 'color 0.4s' }}>#{String(liveCount).padStart(4,'0')}</span>
            </div>
          </div>

          {/* Right side */}
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
            {/* Dark mode toggle — always visible */}
            <button onClick={() => setDarkMode(d => !d)}
                    style={{ background: 'transparent', border: '1px solid rgba(245,242,235,0.2)', color: 'rgba(245,242,235,0.6)', padding: '5px 8px', fontSize: '13px', cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                    title={darkMode ? 'Light mode' : 'Dark mode'}>
              {darkMode ? '☀' : '◑'}
            </button>
            {/* Invite — hidden on mobile */}
            <button onClick={() => setShowInvite(true)} className="hdr-desktop"
                    style={{ background: 'transparent', border: '1px solid rgba(245,242,235,0.25)', color: 'rgba(245,242,235,0.65)', padding: '6px 10px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', letterSpacing: '0.06em' }}>INVITE</button>
            {/* Post — hidden on mobile (FAB handles it) */}
            <button onClick={() => setShowConfess(true)} className="hdr-desktop"
                    style={{ background: 'var(--paper)', border: 'none', color: 'var(--ink)', padding: '6px 12px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em' }}>+ POST</button>
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
              <SidebarContent onClose={() => setMobileSheet(false)} isMobile={true} />
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
          .hdr-desktop { display: none !important; }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
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

        {/* Image or Video */}
        {c.image_url && (
          <div className="img-wrapper" style={{ marginBottom: '12px', border: '1px solid var(--ink-5)' }}>
            {c.image_url.match(/\.(mp4|mov|webm|ogg)(\?|$)/i) ? (
              <video src={c.image_url} controls playsInline
                     style={{ width: '100%', display: 'block', maxHeight: '280px', background: '#000' }}
                     onContextMenu={e => e.preventDefault()} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.image_url} alt="attached" className="no-save"
                   style={{ width: '100%', display: 'block', filter: 'grayscale(25%)' }}
                   onContextMenu={e => e.preventDefault()} draggable={false} />
            )}
            <div style={{ position: 'absolute', inset: 0, cursor: 'default', pointerEvents: 'none' }} />
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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadStage, setUploadStage] = useState<'idle' | 'reading' | 'uploading' | 'posting'>('idle')
  const fileRef                     = useRef<HTMLInputElement>(null)

  function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) { alert('FILE TOO LARGE — MAX 50MB'); return }
    setImage(file)
    setUploadStage('reading')
    setUploadProgress(0)
    const reader = new FileReader()
    reader.onprogress = (ev) => { if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 40)) }
    reader.onload = ev => { setImagePreview(ev.target?.result as string); setUploadProgress(100); setUploadStage('idle') }
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || loading) return
    setLoading(true)
    try {
      let imageUrl: string | undefined
      if (image) {
        setUploadStage('uploading')
        setUploadProgress(10)
        const ext  = image.name.split('.').pop()
        const path = `${crypto.randomUUID()}.${ext}`
        // Simulate progress while uploading
        const progressInterval = setInterval(() => {
          setUploadProgress(p => p < 85 ? p + 8 : p)
        }, 200)
        const { error: upErr } = await supabase.storage.from('confession-images').upload(path, image, { contentType: image.type })
        clearInterval(progressInterval)
        setUploadProgress(95)
        if (!upErr) {
          const { data } = supabase.storage.from('confession-images').getPublicUrl(path)
          imageUrl = data.publicUrl
        }
      }
      setUploadStage('posting')
      setUploadProgress(100)
      await postConfession(boardId, text.trim(), mood, imageUrl)
      onSuccess()
    } catch { onError(); setLoading(false); setUploadStage('idle'); setUploadProgress(0) }
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
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>ATTACH IMAGE OR VIDEO (OPTIONAL)</label>
          <input ref={fileRef} type="file" accept="image/*,video/*" onChange={pickImage} style={{ display: 'none' }} />
          {/* Upload progress bar */}
          {uploadStage !== 'idle' && uploadProgress < 100 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '4px', letterSpacing: '0.05em' }}>
                <span>{uploadStage === 'reading' ? 'READING FILE...' : uploadStage === 'uploading' ? 'UPLOADING...' : 'POSTING...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: '6px', background: 'var(--paper-3)', border: '1px solid var(--ink-5)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${uploadProgress}%`, background: 'var(--ink)', transition: 'width 0.2s ease' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${uploadProgress}%`, backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.15) 3px, rgba(255,255,255,0.15) 6px)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          )}

          {imagePreview && image ? (
            <div style={{ position: 'relative', border: '1px solid var(--ink-4)' }}>
              {image.type.startsWith('video/') ? (
                <video src={imagePreview} controls style={{ width: '100%', maxHeight: '160px', display: 'block', background: '#000' }} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', display: 'block', filter: 'grayscale(20%)' }} />
              )}
              <button type="button" onClick={() => { setImage(null); setImagePreview(null); setUploadProgress(0); setUploadStage('idle') }}
                      style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', padding: '3px 8px', fontSize: '10px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer' }}>✕</button>
              <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(26,26,24,0.75)', color: '#fff', padding: '2px 7px', fontSize: '9px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em' }}>
                {image.type.startsWith('video/') ? '▶ ' : ''}{image.size > 1024 * 1024 ? (image.size / 1024 / 1024).toFixed(1) + 'MB' : (image.size / 1024).toFixed(0) + 'KB'}
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ width: '100%', padding: '14px', border: '1px dashed var(--ink-4)', background: 'transparent', color: 'var(--ink-3)', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', letterSpacing: '0.05em' }}>
              + ATTACH IMAGE OR VIDEO (MAX 50MB)
            </button>
          )}

          {/* Upload / post progress bar */}
          {(uploadStage === 'uploading' || uploadStage === 'posting') && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--ink-3)', letterSpacing: '0.06em', marginBottom: '4px' }}>
                <span>{uploadStage === 'uploading' ? 'UPLOADING IMAGE...' : 'POSTING...'}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--ink-5)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', background: 'var(--ink)', width: `${uploadProgress}%`, transition: 'width 0.25s ease' }} />
                {/* Animated shimmer */}
                <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', animation: 'shimmer 1s ease infinite' }} />
              </div>
              <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{ flex: 1, height: '2px', background: i < Math.floor(uploadProgress / 5) ? 'var(--ink)' : 'var(--ink-5)', transition: 'background 0.1s' }} />
                ))}
              </div>
            </div>
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
          {loading
            ? uploadStage === 'uploading' ? `UPLOADING... ${uploadProgress}%`
            : uploadStage === 'posting' ? 'POSTING...'
            : 'PROCESSING...'
            : 'ISSUE RECEIPT'}
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

/* ── Password Gate ── */
function PasswordGate({ board, onSuccess }: { board: Board; onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState('')
  const [checking, setChecking] = useState(false)
  const attempts                = useRef(0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password.trim() || checking) return
    setChecking(true); setError('')
    const ok = await verifyBoardPassword(board.id, password.trim())
    if (ok) {
      setBoardAccess(board.id)
      onSuccess()
    } else {
      attempts.current += 1
      setError(attempts.current >= 3 ? 'ERROR: WRONG PASSWORD — MULTIPLE FAILED ATTEMPTS' : 'ERROR: WRONG PASSWORD')
      setPassword('')
      setChecking(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '340px', animation: 'feedIn 0.3s ease' }}>
        <div className="receipt" style={{ padding: '24px' }}>

          <div className="thermal-center" style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.15em', marginBottom: '4px' }}>WHISPR</div>
            <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>ACCESS RESTRICTED</div>
          </div>

          <div className="dash-line" style={{ margin: '12px 0' }} />

          <div style={{ fontSize: '11px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ color: 'var(--ink-3)' }}>BOARD</span>
              <span style={{ fontWeight: 600 }}>{board.name.toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--ink-3)' }}>STATUS</span>
              <span style={{ fontWeight: 700, color: '#cc0000' }}>🔒 PASSWORD PROTECTED</span>
            </div>
          </div>

          <div className="dash-line" style={{ margin: '12px 0' }} />

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label className="label" style={{ display: 'block', marginBottom: '6px' }}>ENTER PASSWORD</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPass ? 'text' : 'password'}
                       value={password} onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••" autoFocus
                       style={{ paddingRight: '56px', letterSpacing: '0.15em' }} />
                <button type="button" onClick={() => setShowPass(s => !s)}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: '10px', fontFamily: "'IBM Plex Mono',monospace" }}>
                  {showPass ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            {error && (
              <p style={{ fontSize: '10px', color: '#cc0000', fontWeight: 600, border: '1px solid #cc0000', padding: '6px 10px', letterSpacing: '0.04em' }}>{error}</p>
            )}

            <div className="dash-line" />

            <button type="submit" disabled={checking || !password.trim()} className="btn-primary"
                    style={{ width: '100%', padding: '11px', opacity: checking || !password.trim() ? 0.5 : 1 }}>
              {checking ? 'VERIFYING...' : 'ENTER BOARD →'}
            </button>

            <a href="/" style={{ display: 'block', textAlign: 'center', fontSize: '10px', color: 'var(--ink-4)', textDecoration: 'none', letterSpacing: '0.05em', marginTop: '4px' }}>
              ← GO HOME
            </a>
          </form>

          <div className="dash-line" style={{ margin: '14px 0' }} />
          <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.08em' }}>
            CONTACT THE BOARD CREATOR FOR ACCESS
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   WHISPR INTRO — inline WhatsApp-stories component
   No iframe · No external file · Works on any device
   ═══════════════════════════════════════════════════════════════ */
function WhisprIntro({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const rafRef    = useRef<number>(0)
  const acRef     = useRef<AudioContext | null>(null)
  const mgRef     = useRef<GainNode | null>(null)
  const beatRef   = useRef(false)
  const killRef   = useRef(false)
  const [cur, setCur]       = useState(0)
  const [frac, setFrac]     = useState(0)
  const [paused, setPaused] = useState(false)
  const [dir, setDir]       = useState(1)
  const TOTAL = INTRO_SLIDES.length
  const durRef    = useRef(0)
  const startRef  = useRef(0)
  const elapsedRef = useRef(0)
  const fracRef   = useRef(0)
  const curRef    = useRef(0)
  const pausedRef = useRef(false)

  // ── Audio helpers ──
  function ac() {
    if (!acRef.current) {
      acRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      mgRef.current = acRef.current.createGain()
      mgRef.current.gain.value = 0.75
      mgRef.current.connect(acRef.current.destination)
    }
    if (acRef.current.state === 'suspended') acRef.current.resume()
    return acRef.current
  }
  function mg() { return mgRef.current! }

  function kick(t: number) {
    try {
      const c=ac(),o=c.createOscillator(),g=c.createGain()
      o.frequency.setValueAtTime(155,t); o.frequency.exponentialRampToValueAtTime(36,t+0.1)
      g.gain.setValueAtTime(1.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.3)
      o.connect(g); g.connect(mg()); o.start(t); o.stop(t+0.35)
    } catch(e){}
  }
  function snare(t: number) {
    try {
      const c=ac()
      const buf=c.createBuffer(1,Math.floor(c.sampleRate*0.14),c.sampleRate)
      const d=buf.getChannelData(0)
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,1.5)
      const src=c.createBufferSource(),bp=c.createBiquadFilter(),gn=c.createGain()
      bp.type='bandpass'; bp.frequency.value=3000; bp.Q.value=0.7
      gn.gain.setValueAtTime(0.55,t); gn.gain.exponentialRampToValueAtTime(0.001,t+0.14)
      src.buffer=buf; src.connect(bp); bp.connect(gn); gn.connect(mg()); src.start(t); src.stop(t+0.18)
      const o2=c.createOscillator(),g2=c.createGain()
      o2.type='triangle'; o2.frequency.setValueAtTime(195,t); o2.frequency.exponentialRampToValueAtTime(155,t+0.06)
      g2.gain.setValueAtTime(0.22,t); g2.gain.exponentialRampToValueAtTime(0.001,t+0.09)
      o2.connect(g2); g2.connect(mg()); o2.start(t); o2.stop(t+0.1)
    } catch(e){}
  }
  function hat(t: number, vel=0.13, open=false) {
    try {
      const c=ac(),dur=open?0.12:0.03
      const buf=c.createBuffer(1,Math.floor(c.sampleRate*dur),c.sampleRate)
      const d=buf.getChannelData(0)
      for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(open?Math.exp(-i/(c.sampleRate*0.04)):1)
      const src=c.createBufferSource(),hp=c.createBiquadFilter(),g=c.createGain()
      hp.type='highpass'; hp.frequency.value=8500
      g.gain.setValueAtTime(vel,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur)
      src.buffer=buf; src.connect(hp); hp.connect(g); g.connect(mg()); src.start(t); src.stop(t+dur+0.01)
    } catch(e){}
  }
  function bassNote(t: number,freq: number,dur: number) {
    try {
      const c=ac(),o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain()
      o.type='sawtooth'; o.frequency.value=freq
      lp.type='lowpass'; lp.frequency.value=290; lp.Q.value=1.6
      g.gain.setValueAtTime(0.001,t); g.gain.linearRampToValueAtTime(0.7,t+0.008); g.gain.exponentialRampToValueAtTime(0.001,t+dur)
      o.connect(lp); lp.connect(g); g.connect(mg()); o.start(t); o.stop(t+dur+0.02)
    } catch(e){}
  }
  function chordStab(t: number,freqs: number[]) {
    freqs.forEach(f=>{
      try {
        const c=ac(),o=c.createOscillator(),lp=c.createBiquadFilter(),g=c.createGain()
        o.type='sawtooth'; o.frequency.value=f
        lp.type='lowpass'; lp.frequency.value=700; lp.Q.value=1.0
        g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.055,t+0.012); g.gain.exponentialRampToValueAtTime(0.001,t+0.22)
        o.connect(lp); lp.connect(g); g.connect(mg()); o.start(t); o.stop(t+0.25)
      } catch(e){}
    })
  }

  const STEP = 60/82/4
  const BASS_PAT: [number,number,number][] = [
    [0,65.4,1.8],[3,65.4,0.9],[4,73.4,1.2],[6,65.4,0.8],
    [8,77.8,1.8],[11,65.4,0.9],[12,87.3,1.4],[14,65.4,0.8],
    [16,65.4,1.8],[19,65.4,0.9],[20,61.7,1.2],[22,65.4,0.8],
    [24,77.8,1.8],[27,65.4,0.9],[28,87.3,2.2],[30,73.4,0.8],
  ]
  const CHORD_PAT: [number,number[]][] = [
    [4,[196.0,233.1,293.7]],[12,[174.6,207.7,261.6]],
    [20,[155.6,185.0,233.1]],[28,[174.6,207.7,261.6]],
  ]

  function startBeat() {
    if (beatRef.current) return
    beatRef.current = true; killRef.current = false
    const c = ac()
    function sched(t: number, step: number) {
      if (killRef.current) { beatRef.current=false; return }
      const s = step % 32
      if (s===0||s===8) kick(t)
      if (s===4||s===12) snare(t)
      if (s%2===0) hat(t,0.13,false)
      if (s===6||s===14||s===22||s===30) hat(t,0.11,true)
      if (s===2||s===10||s===18||s===26) hat(t,0.04,false)
      BASS_PAT.forEach(b=>{ if(b[0]===s) bassNote(t,b[1],b[2]*STEP) })
      CHORD_PAT.forEach(ch=>{ if(ch[0]===s) chordStab(t,ch[1]) })
      if (Math.random()>0.9) {
        try {
          const c2=ac(),buf=c2.createBuffer(1,Math.floor(c2.sampleRate*0.006),c2.sampleRate)
          const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(c2.sampleRate*0.0015))
          const src=c2.createBufferSource(),g=c2.createGain(); g.gain.value=0.04
          src.buffer=buf; src.connect(g); g.connect(mg()); src.start(t)
        } catch(e){}
      }
      const next = t+STEP
      const delay = Math.max(0,(next-c.currentTime-0.08)*1000)
      setTimeout(()=>sched(next,step+1), delay)
    }
    sched(c.currentTime+0.1, 0)
  }

  function stopAudio() {
    killRef.current=true; beatRef.current=false
    if (acRef.current) { try { acRef.current.suspend() } catch(e){} }
  }

  // ── Progress engine ──
  function runProg(dur: number, startFrac=0) {
    cancelAnimationFrame(rafRef.current)
    durRef.current = dur
    const remaining = dur*(1-startFrac)
    startRef.current = performance.now()
    pausedRef.current = false

    function tick(now: number) {
      if (pausedRef.current) return
      const dt = now - startRef.current
      const f = startFrac + Math.min(dt/remaining,1)*(1-startFrac)
      fracRef.current = f
      setFrac(f)
      if (f>=1) { advanceCur(1) }
      else { rafRef.current = requestAnimationFrame(tick) }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function advanceCur(delta: number) {
    cancelAnimationFrame(rafRef.current)
    const next = curRef.current + delta
    if (next >= TOTAL) { stopAudio(); onDone(); return }
    if (next < 0) return
    curRef.current = next
    setCur(next)
    setDir(delta)
    setFrac(0)
    fracRef.current = 0
    runProg(INTRO_SLIDES[next].dur)
  }

  function pauseProg() {
    if (pausedRef.current) return
    pausedRef.current = true; setPaused(true)
    elapsedRef.current = performance.now() - startRef.current
    cancelAnimationFrame(rafRef.current)
  }

  function resumeProg() {
    if (!pausedRef.current) return
    pausedRef.current = false; setPaused(false)
    const dur = durRef.current
    const elapsed = elapsedRef.current
    const fStart = fracRef.current
    const remaining = dur - elapsed
    startRef.current = performance.now()

    function tick(now: number) {
      if (pausedRef.current) return
      const dt = now - startRef.current
      const f = fStart + Math.min(dt/remaining,1)*(1-fStart)
      fracRef.current = f
      setFrac(f)
      if (f>=1) { advanceCur(1) }
      else { rafRef.current = requestAnimationFrame(tick) }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  // ── Lifecycle ──
  useEffect(() => {
    curRef.current = 0
    runProg(INTRO_SLIDES[0].dur)
    // visibility / page leave
    const onHide = () => { if (document.hidden) stopAudio() }
    const onLeave = () => stopAudio()
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onLeave)
    window.addEventListener('beforeunload', onLeave)
    return () => {
      stopAudio()
      cancelAnimationFrame(rafRef.current)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onLeave)
      window.removeEventListener('beforeunload', onLeave)
    }
  }, [])

  // ── Hold to pause ──
  let holdTimer: ReturnType<typeof setTimeout>
  function onPressStart() { holdTimer = setTimeout(pauseProg, 200) }
  function onPressEnd()   { clearTimeout(holdTimer); if (pausedRef.current) resumeProg() }

  // ── Render ──
  const slide = INTRO_SLIDES[cur]
  const bars = Array.from({length:TOTAL},(_,i)=>({
    done: i < cur, active: i===cur, frac: i===cur ? frac : 0
  }))

  return (
    <div
      onMouseDown={onPressStart} onMouseUp={onPressEnd}
      onTouchStart={onPressStart} onTouchEnd={onPressEnd}
      style={{
        position:'fixed',inset:0,zIndex:9999,background:'#111110',
        fontFamily:"'IBM Plex Mono',monospace",overflow:'hidden',
        userSelect:'none',WebkitTapHighlightColor:'transparent',
      }}
    >
      {/* Grid */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',
        backgroundImage:'linear-gradient(rgba(245,242,235,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(245,242,235,0.025) 1px,transparent 1px)',
        backgroundSize:'28px 28px'}}/>

      {/* Progress bars */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:20,display:'flex',gap:'3px',padding:'10px 14px 0'}}>
        {bars.map((b,i)=>(
          <div key={i} style={{flex:1,height:'2px',background:'rgba(245,242,235,0.22)',borderRadius:'2px',overflow:'hidden'}}>
            <div style={{height:'100%',background:'#f5f2eb',borderRadius:'2px',
              width: b.done?'100%':b.active?`${b.frac*100}%`:'0%',
              transition:'none'}}/>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{position:'absolute',top:20,left:0,right:0,zIndex:20,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px'}}>
        <span style={{fontSize:'13px',fontWeight:700,letterSpacing:'0.2em',color:'#f5f2eb'}}>WHISPR</span>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:'10px',color:'rgba(245,242,235,0.35)',letterSpacing:'0.1em'}}>{cur+1} / {TOTAL}</span>
          <button
            onClick={(e)=>{e.stopPropagation(); onDone(); localStorage.setItem('whispr_intro_seen','1')}}
            style={{background:'none',border:'1px solid rgba(245,242,235,0.18)',color:'rgba(245,242,235,0.5)',padding:'4px 10px',fontFamily:"'IBM Plex Mono',monospace",fontSize:'9px',cursor:'pointer',letterSpacing:'0.1em'}}
          >SKIP ✕</button>
        </div>
      </div>

      {/* Tap zones */}
      <div onClick={()=>advanceCur(-1)} style={{position:'absolute',top:0,bottom:0,left:0,width:'35%',zIndex:15,cursor:'pointer'}}/>
      <div onClick={()=>advanceCur(1)}  style={{position:'absolute',top:0,bottom:0,right:0,width:'35%',zIndex:15,cursor:'pointer'}}/>

      {/* Pause indicator */}
      {paused && (
        <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:30,
          background:'rgba(0,0,0,0.5)',padding:'8px 16px',fontSize:'12px',color:'rgba(245,242,235,0.6)',letterSpacing:'0.12em',pointerEvents:'none'}}>
          ❚❚ PAUSED
        </div>
      )}

      {/* Slide */}
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',padding:'64px 20px 96px',zIndex:10,overflowY:'auto'}}>
        <div style={{width:'100%',maxWidth:'440px',animation: dir>=0?'introR 0.3s ease':'introL 0.3s ease'}} key={cur}>
          <style>{`
            @keyframes introR{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
            @keyframes introL{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
            .ir{background:#f5f2eb;color:#1a1a18;padding:20px 18px;position:relative;box-shadow:0 8px 40px rgba(0,0,0,0.65);}
            .ir .dash{height:1px;margin:10px 0;background:repeating-linear-gradient(to right,#1a1a18 0,#1a1a18 5px,transparent 5px,transparent 10px);}
            .ir .dk{background:#1a1a18;color:#f5f2eb;padding:14px 16px;margin:-20px -18px 14px;text-align:center;}
            .ir .lbl{font-size:10px;color:#6b6b67;}
            .ir .ib{background:#ede9df;border:1px solid #c5c5bf;padding:9px 11px;margin-top:10px;font-size:10px;color:#3d3d3a;line-height:1.85;}
            .chip{display:inline-flex;align-items:center;gap:3px;padding:4px 9px;font-size:11px;border:1px solid;font-family:'IBM Plex Mono',monospace;}
            .ci{background:#1a1a18;color:#f5f2eb;border-color:#1a1a18;}
            .co{color:#6b6b67;border-color:#c5c5bf;}
            .ldot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;animation:lp 2s ease infinite;vertical-align:middle;}
            @keyframes lp{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}50%{box-shadow:0 0 0 6px rgba(34,197,94,0)}}
            .pwdot{width:10px;height:10px;border-radius:50%;border:1.5px solid #9b9b96;display:inline-block;margin:0 3px;transition:all .15s;}
            .pwdot.on{background:#1a1a18;border-color:#1a1a18;}
            .eopt{display:flex;justify-content:space-between;align-items:center;padding:7px 9px;font-size:11px;border:1px solid #c5c5bf;margin-bottom:4px;color:#6b6b67;}
            .eopt.act{border-color:#1a1a18;font-weight:700;color:#1a1a18;}
            .plrow{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;font-size:11px;border:1px solid #c5c5bf;margin-bottom:4px;transition:all .15s;}
            .plrow.sel{background:#1a1a18;color:#f5f2eb;border-color:#1a1a18;}
            .rbub{background:#ede9df;border:1px solid #c5c5bf;padding:8px 10px;margin-bottom:5px;font-size:11px;line-height:1.65;}
            .ftag{font-size:9px;color:rgba(245,242,235,0.28);letter-spacing:0.22em;margin-bottom:14px;text-transform:uppercase;text-align:center;}
          `}</style>
          {slide.render()}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,zIndex:20,padding:'14px 18px 26px',display:'flex',gap:'8px',background:'linear-gradient(transparent,rgba(17,17,16,0.95) 40%)'}}>
        <button onClick={(e)=>{e.stopPropagation();onDone();localStorage.setItem('whispr_intro_seen','1')}}
          style={{flex:1,padding:'12px',background:'#f5f2eb',color:'#111110',border:'none',fontFamily:"'IBM Plex Mono',monospace",fontSize:'12px',fontWeight:700,letterSpacing:'0.1em',cursor:'pointer'}}>
          ENTER BOARD →
        </button>
      </div>

      {/* Beat trigger */}
      <div onClickCapture={()=>startBeat()} onTouchStartCapture={()=>startBeat()} style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none'}}/>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════
   SLIDE DEFINITIONS — pure JSX, no external dependencies
   ════════════════════════════════════════════════════════════ */
const INTRO_SLIDES: { dur: number; render: () => React.ReactNode }[] = [
  // 0 — HERO
  { dur:6500, render:()=>(
    <div style={{textAlign:'center',color:'#f5f2eb'}}>
      <div style={{fontSize:'10px',color:'rgba(245,242,235,0.2)',letterSpacing:'0.22em',marginBottom:10}}>ANONYMOUS CONFESSIONS CO.</div>
      <div style={{fontSize:'clamp(52px,14vw,88px)',fontWeight:700,letterSpacing:'0.14em',lineHeight:1}}>WHISPR</div>
      <div style={{fontSize:'10px',color:'rgba(245,242,235,0.3)',letterSpacing:'0.15em',marginTop:8}}>EST. 2025 · whispr.name.ng</div>
      <div style={{marginTop:28,maxWidth:360,textAlign:'left',margin:'28px auto 0'}}>
        <div style={{fontSize:'13px',color:'rgba(245,242,235,0.6)',lineHeight:1.9,marginBottom:12}}>Your group has things they would never say out loud. Confessions. Opinions. Secrets. Tea.</div>
        <div style={{fontSize:'12px',color:'rgba(245,242,235,0.35)',lineHeight:1.9}}>Whispr is a private anonymous confession board. No accounts. No names. No traces. Just your group being honest for once.</div>
      </div>
      <div style={{marginTop:28,fontSize:'9px',color:'rgba(245,242,235,0.18)',letterSpacing:'0.18em'}}>TAP RIGHT TO CONTINUE →</div>
    </div>
  )},

  // 1 — HOW IT WORKS
  { dur:8000, render:()=>(
    <>
      <div className="ftag">HOW IT WORKS</div>
      <div className="ir">
        <div style={{textAlign:'center',marginBottom:12}}><div style={{fontSize:16,fontWeight:700,letterSpacing:'0.1em'}}>3 STEPS</div><div style={{fontSize:10,color:'#6b6b67',marginTop:2}}>THAT IS ALL IT TAKES</div></div>
        <div className="dash"/>
        {[['01','CREATE A BOARD','Name your board. Choose expiry. Add optional password. Get an 8-character invite code instantly. No signup.'],
          ['02','SHARE THE CODE','Send it over WhatsApp, DM, anywhere. Anyone with the code joins as an anonymous ghost.'],
          ['03','CONFESS FREELY','Everyone posts 100% anonymously. React, reply, attach media. Updates live for everyone.']
        ].map(([n,t,d])=>(
          <div key={n} style={{display:'flex',gap:12,alignItems:'flex-start',margin:'12px 0'}}>
            <div style={{fontSize:22,fontWeight:700,color:'#c5c5bf',minWidth:26,lineHeight:1}}>{n}</div>
            <div><div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{t}</div><div style={{fontSize:10,color:'#6b6b67',lineHeight:1.85}}>{d}</div></div>
          </div>
        ))}
        <div className="dash"/>
        <div style={{textAlign:'center',fontSize:10,color:'#6b6b67',lineHeight:1.85}}>NO SIGN UP · NO APP · NO EMAIL · FREE FOREVER</div>
      </div>
    </>
  )},

  // 2 — ANONYMOUS POSTING
  { dur:8500, render:()=>{
    const [typed, setTyped] = useState('')
    const text = 'I told my lecturer I had malaria. I was watching Netflix the whole time.'
    useEffect(()=>{
      let i=0; const iv=setInterval(()=>{ setTyped(text.slice(0,i)); i++; if(i>text.length) clearInterval(iv) },52)
      return ()=>clearInterval(iv)
    },[])
    return (
      <>
        <div className="ftag">FEATURE 01 — ANONYMOUS POSTING</div>
        <div className="ir">
          <div style={{textAlign:'center',marginBottom:10}}>
            <div style={{fontSize:10,color:'#6b6b67',letterSpacing:'0.08em'}}>WHISPR · CONFESSION RECEIPT</div>
            <div style={{fontSize:10,color:'#9b9b96'}}>TXN#7291-A4F2 · BOARD: SS3-CLASS</div>
          </div>
          <div className="dash"/>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#6b6b67',margin:'6px 0'}}>
            <span>ANON: <strong style={{color:'#1a1a18'}}>G247</strong></span><span>MOOD: 😏 PETTY</span><span>JUST NOW</span>
          </div>
          <div className="dash"/>
          <div style={{fontSize:13,lineHeight:1.85,minHeight:52,margin:'10px 0',fontStyle:'italic',color:'#1a1a18'}}>
            {typed}<span style={{display:'inline-block',width:1,height:'1em',background:'#1a1a18',verticalAlign:'middle',animation:'bl 0.7s step-end infinite',marginLeft:1}}/>
            <style>{`@keyframes bl{0%,100%{opacity:1}50%{opacity:0}}`}</style>
          </div>
          <div className="dash"/>
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
            <span className="chip ci">❤️ 4</span><span className="chip co">💀 12</span><span className="chip co">😭 3</span>
            <span className="chip co" style={{marginLeft:'auto'}}>💬 5 REPLIES</span>
          </div>
          <div className="ib"><div style={{fontSize:9,color:'#9b9b96',letterSpacing:'0.08em',marginBottom:4}}>WHY IT IS COMPLETELY SAFE</div>
            No login required · Random alias per session · IP never logged · No device fingerprint · Zero identity data stored anywhere</div>
        </div>
      </>
    )
  }},

  // 3 — REAL-TIME FEED
  { dur:8000, render:()=>{
    const [cnt,setCnt] = useState(41)
    const [posts,setPosts] = useState<string[]>([])
    const ALL = ['"I googled answers during the exam while pretending to think."','"On my way" was sent from my bed.','"I have attended 2 lectures this semester. Both times the wrong room."','"I pretend to be busy so nobody asks me for anything."']
    useEffect(()=>{
      let pi=0,c=41
      const iv=setInterval(()=>{
        c++; setCnt(c)
        if(pi<ALL.length){ setPosts(p=>[ALL[pi],...p]); pi++ }
      },1400)
      return ()=>clearInterval(iv)
    },[])
    return (
      <>
        <div className="ftag">FEATURE 02 — REAL-TIME FEED</div>
        <div className="ir">
          <div className="dk">
            <div style={{fontSize:10,color:'rgba(245,242,235,0.4)',letterSpacing:'0.1em',marginBottom:5}}>RECEIPTS ISSUED — BOARD: SS3</div>
            <div style={{fontSize:52,fontWeight:700,letterSpacing:'0.12em',fontVariantNumeric:'tabular-nums',color: cnt>41?'#4ade80':'inherit',transition:'color 0.3s'}}>{String(cnt).padStart(4,'0')}</div>
            <div style={{fontSize:9,color:'rgba(245,242,235,0.25)',marginTop:3,letterSpacing:'0.08em'}}>UPDATES INSTANTLY · NO REFRESH NEEDED</div>
          </div>
          <div style={{fontSize:10,color:'#6b6b67',paddingBottom:8,borderBottom:'1px dashed #c5c5bf',lineHeight:1.75}}>Powered by Supabase Realtime Websockets. The moment anyone posts, every screen on the board updates — zero delay, no polling.</div>
          <div style={{display:'flex',flexDirection:'column',gap:4,marginTop:8,maxHeight:120,overflow:'hidden'}}>
            {posts.map((p,i)=><div key={i} style={{fontSize:10,lineHeight:1.65,padding:'5px 0',borderBottom:'1px dashed #c5c5bf',color:'#3d3d3a',fontStyle:'italic'}}>{p}</div>)}
          </div>
        </div>
      </>
    )
  }},

  // 4 — LIVE PRESENCE
  { dur:7500, render:()=>{
    const NAMES=['G247','S019','E441','C112','M091']
    const COLORS=['#f59e0b','#8b5cf6','#ef4444','#3b82f6','#22c55e']
    const [online,setOnline] = useState(['G247'])
    useEffect(()=>{
      let ni=1
      const iv=setInterval(()=>{
        setOnline(o=> o.length<5&&ni<NAMES.length ? [...o,NAMES[ni++]] : o.length>2 ? o.slice(1) : o)
      },950)
      return ()=>clearInterval(iv)
    },[])
    return (
      <>
        <div className="ftag">FEATURE 03 — LIVE PRESENCE</div>
        <div className="ir">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div><div style={{fontSize:13,fontWeight:700,marginBottom:2}}>WHO IS IN THE ROOM?</div><div style={{fontSize:10,color:'#6b6b67'}}>LIVE · UPDATES EVERY SECOND</div></div>
            <div style={{textAlign:'right'}}><span className="ldot"/>&nbsp;<span style={{fontSize:20,fontWeight:700}}>{online.length}</span><div style={{fontSize:9,color:'#6b6b67'}}>{online.length===1?'PERSON':'PEOPLE'} ONLINE</div></div>
          </div>
          <div className="dash"/>
          <div style={{display:'flex',flexDirection:'column',gap:4,margin:'8px 0'}}>
            {online.map((n,i)=>(
              <div key={n} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 8px',background:'#ede9df',border:'1px solid #c5c5bf',fontSize:10}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:COLORS[i%5]+'22',border:`1.5px solid ${COLORS[i%5]}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:COLORS[i%5]}}>{n[0]}</div>
                  <span style={{color:'#6b6b67'}}>ANON: {n}</span>
                </div>
                <span style={{color:'#22c55e',fontSize:9}}>● LIVE</span>
              </div>
            ))}
          </div>
          <div className="dash"/>
          <div style={{fontSize:10,color:'#6b6b67',lineHeight:1.9,textAlign:'center'}}>Only a live count is shown — no identities revealed. Tracked via Supabase Realtime Presence channels.</div>
        </div>
      </>
    )
  }},

  // 5 — REACTIONS
  { dur:7500, render:()=>{
    const rxns:[string,number,boolean][] = [['❤️',19,true],['💀',34,true],['😭',8,false],['😂',5,false],['🔥',12,false],['👀',11,false],['🤯',4,false],['🫂',6,false],['😱',3,false],['🫡',1,false]]
    const [counts,setCounts] = useState(rxns.map(()=>0))
    useEffect(()=>{
      const ivs = rxns.map((r,i)=>setTimeout(()=>{
        let n=0; const max=r[1]
        const iv=setInterval(()=>{ n=Math.min(n+Math.ceil(max/6),max); setCounts(c=>{const x=[...c];x[i]=n;return x}); if(n>=max) clearInterval(iv) },55)
      },i*105+150))
      return ()=>ivs.forEach(clearTimeout)
    },[])
    return (
      <>
        <div className="ftag">FEATURE 04 — REACTIONS</div>
        <div className="ir">
          <div style={{fontSize:13,lineHeight:1.85,fontStyle:'italic',color:'#3d3d3a',paddingBottom:10,borderBottom:'1px dashed #c5c5bf',marginBottom:10}}>"My entire friend group knew I liked them for 6 months and nobody told me 💀"</div>
          <div style={{fontSize:10,color:'#6b6b67',marginBottom:8}}>10 REACTION TYPES · ANONYMOUS · ONE PER PERSON</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}}>
            {rxns.map((r,i)=><span key={i} className={`chip ${r[2]?'ci':'co'}`}>{r[0]} {counts[i]}</span>)}
          </div>
          <div className="dash"/>
          <div style={{fontSize:10,color:'#6b6b67',lineHeight:1.9}}>Top 3 shown on card by default. Tap to expand all 10. Counts update live. Tap again to unreact. Nobody knows who reacted.</div>
        </div>
      </>
    )
  }},

  // 6 — REPLY THREADS
  { dur:8500, render:()=>{
    const reps=[{who:'ANON: S019 · 5M AGO',t:"you're not alone in this fr, same thing happened to me"},{who:'ANON: E441 · 3M AGO',t:"been wearing the mask so long it's stuck to my face"},{who:'ANON: C112 · 1M AGO',t:'this hit different. thank you for posting this honestly'}]
    const [shown,setShown] = useState(0)
    useEffect(()=>{
      const ivs=reps.map((_,i)=>setTimeout(()=>setShown(n=>n+1),i*750+300))
      return ()=>ivs.forEach(clearTimeout)
    },[])
    return (
      <>
        <div className="ftag">FEATURE 05 — REPLY THREADS</div>
        <div className="ir">
          <div style={{fontSize:13,lineHeight:1.85,fontStyle:'italic',color:'#1a1a18',paddingBottom:10,borderBottom:'1px dashed #c5c5bf',marginBottom:8}}>"I have been faking being okay for so long I forgot what actually okay feels like"</div>
          <div style={{fontSize:10,color:'#6b6b67',marginBottom:8}}>💬 3 REPLIES · EACH REPLY ALSO FULLY ANONYMOUS</div>
          {reps.slice(0,shown).map((r,i)=>(
            <div key={i} className="rbub"><div style={{fontSize:9,color:'#9b9b96',marginBottom:3}}>{r.who}</div>{r.t}</div>
          ))}
          <div className="dash" style={{marginTop:8}}/>
          <div style={{fontSize:10,color:'#6b6b67',lineHeight:1.9}}>Reply count shown on card before opening. Threads are anonymous and update live for everyone on the board.</div>
        </div>
      </>
    )
  }},

  // 7 — BOARD EXPIRY
  { dur:8000, render:()=>{
    const [secs,setSecs] = useState(86387)
    useEffect(()=>{ const iv=setInterval(()=>setSecs(s=>s-1),80); return ()=>clearInterval(iv) },[])
    const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60
    const fmt=(n:number)=>String(n).padStart(2,'0')
    return (
      <>
        <div className="ftag">FEATURE 07 — BOARD EXPIRY</div>
        <div className="ir">
          <div className="dk">
            <div style={{fontSize:10,color:'rgba(245,242,235,0.4)',letterSpacing:'0.1em',marginBottom:5}}>THIS BOARD SELF-DESTRUCTS IN</div>
            <div style={{fontSize:38,fontWeight:700,letterSpacing:'0.12em',color:'#f59e0b',fontVariantNumeric:'tabular-nums'}}>{fmt(h)}:{fmt(m)}:{fmt(s)}</div>
            <div style={{fontSize:9,color:'rgba(245,242,235,0.25)',marginTop:4,letterSpacing:'0.06em'}}>CONFESSIONS · REPLIES · REACTIONS · MEDIA — ALL WIPED</div>
          </div>
          {[['∞ NEVER EXPIRES','BOARD STAYS FOREVER',false],['⏱ 24 HOURS ✓','AUTO-DELETES AFTER 1 DAY',true],['⏱ 7 DAYS','AUTO-DELETES AFTER 1 WEEK',false],['⏱ 30 DAYS','AUTO-DELETES AFTER 1 MONTH',false]].map(([l,d,a])=>(
            <div key={String(l)} className={`eopt${a?' act':''}`}>{l}<span style={{fontSize:10}}>{d}</span></div>
          ))}
          <div className="dash"/>
          <div style={{fontSize:10,color:'#6b6b67',lineHeight:1.9,textAlign:'center'}}>Set at creation — cannot be changed. A cron job runs every 10 minutes and fully wipes expired boards. Zero trace left.</div>
        </div>
      </>
    )
  }},

  // 8 — PASSWORD
  { dur:9000, render:()=>{
    const [filled,setFilled] = useState(0)
    const [granted,setGranted] = useState(false)
    useEffect(()=>{
      function run() {
        let i=0
        const iv=setInterval(()=>{
          if(i<8){ setFilled(i+1); i++ }
          else {
            clearInterval(iv); setGranted(true)
            setTimeout(()=>{ setFilled(0); setGranted(false); setTimeout(run,400) },2200)
          }
        },160)
      }
      const t=setTimeout(run,600)
      return ()=>clearTimeout(t)
    },[])
    return (
      <>
        <div className="ftag">FEATURE 08 — PASSWORD PROTECTION</div>
        <div className="ir">
          <div style={{textAlign:'center',marginBottom:12}}><div style={{fontSize:24,marginBottom:4}}>🔒</div><div style={{fontSize:14,fontWeight:700,letterSpacing:'0.1em'}}>ACCESS RESTRICTED</div><div style={{fontSize:10,color:'#6b6b67',marginTop:2}}>BOARD: SS3-CLASS · PASSWORD REQUIRED</div></div>
          <div className="dash"/>
          <div style={{fontSize:10,color:'#6b6b67',margin:'8px 0 6px',letterSpacing:'0.06em'}}>ENTER PASSWORD</div>
          <div style={{display:'flex',gap:5,justifyContent:'center',margin:'10px 0'}}>
            {Array.from({length:8},(_,i)=><span key={i} className={`pwdot${i<filled?' on':''}`}/>)}
          </div>
          <div style={{height:14,fontSize:10,color:'#9b9b96',textAlign:'center',marginBottom:4}}>{granted?'✓ PASSWORD VERIFIED':''}</div>
          <div className="dash" style={{margin:'8px 0'}}/>
          <div style={{padding:10,background:granted?'#16a34a':'#1a1a18',color:'#f5f2eb',textAlign:'center',fontSize:12,fontWeight:700,letterSpacing:'0.1em',transition:'background .3s'}}>
            {granted?'ACCESS GRANTED ✓':'ENTER BOARD →'}
          </div>
          <div className="dash" style={{margin:'10px 0'}}/>
          <div style={{fontSize:10,color:'#6b6b67',lineHeight:1.9}}>Password hashed with SHA-256, never stored as plaintext. Optional — boards can be open or locked. Wrong password = denied.</div>
        </div>
      </>
    )
  }},

  // 9 — FULL RECAP
  { dur:10000, render:()=>{
    const items=[['01','ANONYMOUS POSTING','No accounts, random aliases, zero identity data'],['02','REAL-TIME FEED','Posts appear instantly via Supabase websockets'],['03','LIVE PRESENCE','See how many are on the board right now'],['04','10 REACTIONS','Anonymous, counts update live for everyone'],['05','REPLY THREADS','Nested, anonymous, real-time'],['06','IMAGE & VIDEO','50MB max, greyscale, plays inline'],['07','BOARD EXPIRY','24h · 7d · 30d · ∞ — auto-wipes at zero'],['08','PASSWORD LOCK','SHA-256, optional, per-device memory'],['09','SOCIAL SHARE','5 platforms, receipt PNG, one tap'],['10','DARK MODE','Toggle, localStorage, instant'],['11','MOBILE READY','Bottom sheet, FAB, touch optimized']]
    const [shown,setShown]=useState(0)
    useEffect(()=>{
      const ivs=items.map((_,i)=>setTimeout(()=>setShown(n=>n+1),i*180+200))
      return ()=>ivs.forEach(clearTimeout)
    },[])
    return (
      <>
        <div className="ftag">ALL FEATURES — COMPLETE RECEIPT</div>
        <div className="ir">
          <div style={{textAlign:'center',marginBottom:10}}><div style={{fontSize:20,fontWeight:700,letterSpacing:'0.15em'}}>WHISPR</div><div style={{fontSize:10,color:'#6b6b67',letterSpacing:'0.1em',marginTop:2}}>EVERYTHING INCLUDED · $0.00</div></div>
          <div className="dash"/>
          <div style={{margin:'8px 0'}}>
            {items.slice(0,shown).map(([n,t,d])=>(
              <div key={n} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'5px 0',borderBottom:'1px dashed #c5c5bf',fontSize:11}}>
                <div><span style={{color:'#9b9b96',fontSize:9,marginRight:6}}>{n}</span>{t}<div style={{fontSize:9,color:'#9b9b96',marginTop:1}}>{d}</div></div>
                <span style={{color:'#22c55e',fontWeight:700,marginLeft:8}}>✓</span>
              </div>
            ))}
          </div>
          <div className="dash"/>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontWeight:700,margin:'8px 0'}}><span>TOTAL COST</span><span>$0.00</span></div>
          <div style={{textAlign:'center',fontSize:10,color:'#9b9b96',marginTop:8,letterSpacing:'0.15em'}}>|||||| ||| || |||| ||| | ||||</div>
          <div style={{fontSize:9,color:'#9b9b96',textAlign:'center',marginTop:3}}>whispr.name.ng</div>
        </div>
      </>
    )
  }},
]