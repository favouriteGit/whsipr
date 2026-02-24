'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  supabase, getBoardByCode, getConfessions, postConfession,
  toggleReaction, getMyReactions, getSessionId, getAnon, timeAgo,
  MOOD_COLORS, MOOD_LABELS, MOODS, type Board, type Confession
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

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <div className="anim-spin" style={{ width: '18px', height: '18px', border: '2px solid var(--ink-5)', borderTopColor: 'var(--ink)', borderRadius: '50%' }} />
      <p style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.1em' }}>LOADING...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
      <div className="receipt" style={{ padding: '24px', textAlign: 'center', maxWidth: '280px' }}>
        <p style={{ fontWeight: 700, fontSize: '13px', letterSpacing: '0.1em', marginBottom: '8px' }}>BOARD NOT FOUND</p>
        <div className="dash-line" style={{ margin: '12px 0' }} />
        <p style={{ fontSize: '11px', color: 'var(--ink-3)', marginBottom: '16px' }}>CHECK THE CODE AND TRY AGAIN</p>
        <a href="/" className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none', padding: '9px' }}>← HOME</a>
      </div>
    </div>
  )

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g,'-')

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Header — receipt-style tape at top */}
      <header style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '0 20px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
            <a href="/" style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700, fontSize: '16px', color: 'var(--paper)', textDecoration: 'none', letterSpacing: '0.1em', flexShrink: 0 }}>WHISPR</a>
            <span style={{ color: 'rgba(245,242,235,0.3)', fontSize: '14px' }}>|</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <span className="anim-blink" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(245,242,235,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>{board?.name.toUpperCase()}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button onClick={() => setShowInvite(true)} style={{ background: 'transparent', border: '1px solid rgba(245,242,235,0.3)', color: 'rgba(245,242,235,0.7)', padding: '6px 12px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              INVITE
            </button>
            <button onClick={() => setShowConfess(true)} style={{ background: 'var(--paper)', border: 'none', color: 'var(--ink)', padding: '6px 14px', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              + POST
            </button>
          </div>
        </div>
      </header>

      {/* Disclaimer banner */}
      <div style={{ background: 'var(--paper-2)', borderBottom: '1px solid var(--ink-5)', padding: '8px 20px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.6 }}>
          ⚠ NOTICE: THIS PLATFORM IS FOR ANONYMOUS EXPRESSION ONLY. USE FOR BLACKMAIL, HARASSMENT, DEFAMATION OR ANY ILLEGAL ACTIVITY IS STRICTLY PROHIBITED AND MAY BE REPORTED TO RELEVANT AUTHORITIES. BY POSTING, YOU AGREE TO USE THIS PLATFORM RESPONSIBLY.
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px', display: 'flex', gap: '20px' }}>

        {/* Sidebar */}
        <aside style={{ width: '180px', flexShrink: 0 }}>
          <div className="receipt" style={{ padding: '16px 14px' }}>
            <p className="label" style={{ marginBottom: '10px' }}>FILTER</p>
            <div className="dash-line" style={{ marginBottom: '10px' }} />
            {[{ key: 'all', label: 'ALL POSTS' }, ...MOODS.map(m => ({ key: m.emoji, label: m.label.toUpperCase() }))].map(f => {
              const active = filter === f.key
              const count = f.key === 'all' ? confessions.length : (moodCount[f.key] || 0)
              return (
                <button key={f.key} onClick={() => setFilter(f.key)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '5px 6px', background: active ? 'var(--ink)' : 'transparent', color: active ? 'var(--paper)' : 'var(--ink-3)', border: 'none', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.04em', textAlign: 'left', marginBottom: '2px' }}>
                  <span>{f.label}</span>
                  {count > 0 && <span style={{ opacity: 0.6 }}>{count}</span>}
                </button>
              )
            })}

            <div className="dash-line" style={{ margin: '12px 0' }} />
            <p className="label" style={{ marginBottom: '8px' }}>STATS</p>
            {[
              ['TOTAL', confessions.length],
              ['REACTIONS', totalR],
              ['TODAY', confessions.filter(c=>Date.now()-+new Date(c.created_at)<86400000).length],
            ].map(([k,v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '3px 6px' }}>
                <span style={{ color: 'var(--ink-3)' }}>{k}</span>
                <span style={{ fontWeight: 700 }}>{v}</span>
              </div>
            ))}

            <div className="dash-line" style={{ margin: '12px 0' }} />
            <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--ink-4)', lineHeight: 1.7 }}>
              <div>{dateStr}</div>
              <div>whispr.name.ng</div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '11px', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {visible.length} RECEIPT{visible.length !== 1 ? 'S' : ''} ISSUED
            </p>
            <select value={sort} onChange={e => setSort(e.target.value)} className="input" style={{ width: 'auto', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', appearance: 'none', letterSpacing: '0.05em' }}>
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

      {/* Modals */}
      {showConfess && (
        <ConfessModal boardId={board!.id}
          onClose={() => setShowConfess(false)}
          onSuccess={() => { setShowConfess(false); notify('RECEIPT ISSUED') }}
          onError={() => notify('ERROR: TRY AGAIN', false)} />
      )}

      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <div className="thermal-center" style={{ marginBottom: '16px' }}>
            <p style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.15em' }}>INVITE MEMBERS</p>
            <p style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '4px' }}>SHARE THE CODE BELOW</p>
          </div>
          <div className="dash-line" style={{ margin: '12px 0' }} />
          <div style={{ textAlign: 'center', padding: '16px', background: 'var(--paper-2)', border: '1px solid var(--ink-5)', marginBottom: '14px' }}>
            <p className="label" style={{ marginBottom: '6px' }}>BOARD CODE</p>
            <span style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '0.3em' }}>{code}</span>
          </div>
          <div style={{ display: 'flex', border: '1px solid var(--ink-4)', overflow: 'hidden' }}>
            <span style={{ flex: 1, padding: '9px 10px', fontSize: '10px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/board/${code}`); notify('COPIED!') }}
                    style={{ padding: '9px 14px', background: 'var(--ink)', border: 'none', color: 'var(--paper)', cursor: 'pointer', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              COPY
            </button>
          </div>
          <div className="dash-line" style={{ margin: '14px 0' }} />
          <div style={{ fontSize: '10px', color: 'var(--ink-4)', textAlign: 'center', lineHeight: 1.7 }}>
            ANYONE WITH THIS CODE CAN VIEW AND POST ANONYMOUSLY
          </div>
        </Modal>
      )}

      {replying && <RepliesThread confession={replying} onClose={() => setReplying(null)} />}
      {sharing && <ShareCard confession={sharing} boardName={board?.name || 'WHISPR'} onClose={() => setSharing(null)} />}

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 200, display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: toast.ok ? 'var(--ink)' : '#cc0000', color: toast.ok ? 'var(--paper)' : '#fff', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", letterSpacing: '0.06em', animation: 'slideUp 0.2s ease', border: '1px solid var(--ink)', boxShadow: '2px 2px 0 rgba(0,0,0,0.2)' }}>
          {toast.ok ? '✓' : '✕'} {toast.msg}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) { aside { display: none; } }
      `}</style>
    </div>
  )
}

// ── Receipt Card ───────────────────────────────────────────
function ReceiptCard({ confession: c, index, myReactions, onReact, onShare, onReply }: {
  confession: Confession; index: number; myReactions: Set<string>
  onReact: (id: string, e: string) => void; onShare: () => void; onReply: () => void; sid: string
}) {
  const anon = getAnon(c.anon_seed)
  const moodLabel = MOOD_LABELS[c.mood] || 'NEUTRAL'
  const topR = Object.entries(c.reactions).sort((a,b)=>b[1]-a[1]).slice(0,3)
  const [picker, setPicker] = useState(false)
  const txnId = `TXN#${String(c.anon_seed).slice(-4).padStart(4,'0')}-${c.id.slice(-4).toUpperCase()}`
  const totalReactions = Object.values(c.reactions).reduce((s,v)=>s+v,0)

  return (
    <div className="receipt anim-feed" style={{ marginBottom: '16px', breakInside: 'avoid', animationDelay: `${index*0.04}s` }}>
      <div style={{ padding: '16px 14px' }}>

        {/* Receipt header */}
        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '10px', color: 'var(--ink-3)', letterSpacing: '0.08em' }}>WHISPR · ANONYMOUS POST</div>
          <div style={{ fontSize: '10px', color: 'var(--ink-4)', letterSpacing: '0.04em' }}>{txnId}</div>
        </div>

        <div className="dash-line" style={{ marginBottom: '10px' }} />

        {/* Meta row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '4px' }}>
          <span>ANON: {anon.letter}{anon.number}</span>
          <span>{timeAgo(c.created_at).toUpperCase()}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '10px' }}>
          <span>MOOD: {moodLabel.toUpperCase()}</span>
          <span>RXNS: {totalReactions}</span>
        </div>

        <div className="dash-line" style={{ marginBottom: '12px' }} />

        {/* Confession text */}
        <p style={{ fontSize: '13px', lineHeight: 1.7, color: 'var(--ink)', marginBottom: '12px', fontFamily: "'IBM Plex Mono',monospace" }}>
          {c.text}
        </p>

        {/* Image if present */}
        {c.image_url && (
          <div className="img-wrapper" style={{ marginBottom: '12px', border: '1px solid var(--ink-5)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.image_url} alt="attached" className="no-save"
                 style={{ width: '100%', display: 'block', filter: 'grayscale(30%)', pointerEvents: 'none' }}
                 onContextMenu={e => e.preventDefault()} draggable={false} />
            <div style={{ position: 'absolute', inset: 0, cursor: 'default' }} />
          </div>
        )}

        <div className="dash-line" style={{ marginBottom: '10px' }} />

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
          {topR.map(([emoji, count]) => {
            const key = `${c.id}_${emoji}`
            const reacted = myReactions.has(key)
            return (
              <button key={emoji} onClick={() => onReact(c.id, emoji)}
                      style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 7px', fontSize: '11px', cursor: 'pointer', fontFamily: "'IBM Plex Mono',monospace", background: reacted ? 'var(--ink)' : 'transparent', color: reacted ? 'var(--paper)' : 'var(--ink-3)', border: `1px solid ${reacted ? 'var(--ink)' : 'var(--ink-5)'}`, transition: 'all 0.1s' }}>
                {emoji} {count}
              </button>
            )
          })}

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

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
            <button className="btn-ghost" onClick={onReply} style={{ fontSize: '10px', padding: '3px 7px', letterSpacing: '0.05em' }}>REPLY</button>
            <button className="btn-ghost" onClick={onShare} style={{ fontSize: '10px', padding: '3px 7px', letterSpacing: '0.05em', borderColor: 'var(--ink-5)', color: 'var(--ink-2)' }}>SHARE</button>
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
  const [image, setImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
        const ext = image.name.split('.').pop()
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
      <div className="thermal-center" style={{ marginBottom: '16px' }}>
        <p style={{ fontWeight: 700, fontSize: '14px', letterSpacing: '0.15em' }}>NEW CONFESSION</p>
        <p style={{ fontSize: '10px', color: 'var(--ink-3)', marginTop: '2px' }}>100% ANONYMOUS · UNTRACEABLE</p>
      </div>
      <div className="dash-line" style={{ margin: '12px 0' }} />

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>CONFESSION TEXT</label>
          <textarea className="textarea" value={text} onChange={e => setText(e.target.value)} placeholder="ENTER CONFESSION..." maxLength={500} autoFocus />
          <div style={{ textAlign: 'right', fontSize: '10px', color: 'var(--ink-4)', marginTop: '3px', letterSpacing: '0.04em' }}>{text.length}/500 CHARS</div>
        </div>

        {/* Image upload */}
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '6px' }}>ATTACH IMAGE (OPTIONAL)</label>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickImage} style={{ display: 'none' }} />
          {imagePreview ? (
            <div style={{ position: 'relative', border: '1px solid var(--ink-4)', marginBottom: '6px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="preview" style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block', filter: 'grayscale(20%)' }} />
              <button type="button" onClick={() => { setImage(null); setImagePreview(null) }}
                      style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', padding: '3px 8px', fontSize: '10px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer' }}>
                REMOVE
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
                    style={{ width: '100%', padding: '16px', border: '1px dashed var(--ink-4)', background: 'transparent', color: 'var(--ink-3)', fontSize: '11px', fontFamily: "'IBM Plex Mono',monospace", cursor: 'pointer', letterSpacing: '0.05em' }}>
              + ATTACH IMAGE (MAX 5MB)
            </button>
          )}
        </div>

        {/* Mood */}
        <div>
          <label className="label" style={{ display: 'block', marginBottom: '8px' }}>MOOD CATEGORY</label>
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

        {/* Disclaimer */}
        <p style={{ fontSize: '9px', color: 'var(--ink-4)', letterSpacing: '0.03em', lineHeight: 1.7, textAlign: 'center' }}>
          BY POSTING YOU CONFIRM THIS IS NOT USED FOR BLACKMAIL, HARASSMENT OR ANY ILLEGAL ACTIVITY. MISUSE WILL BE REPORTED.
        </p>

        <button type="submit" disabled={loading || !text.trim()} className="btn-primary" style={{ width: '100%', padding: '11px', opacity: loading || !text.trim() ? 0.5 : 1 }}>
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
