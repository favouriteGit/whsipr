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

const REACTION_EMOJIS = ['❤️','💀','😭','😂','🫂','🔥','😱','👀','🤯','🫡']

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
    const ch = supabase.channel(`board:${board.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'confessions', filter: `board_id=eq.${board.id}` }, async () => setConfessions(await getConfessions(board.id)))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, async () => setConfessions(await getConfessions(board.id)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'confessions' }, async () => setConfessions(await getConfessions(board.id)))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [board])

  function toast_(msg: string, ok = true) { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  async function handleReaction(confessionId: string, emoji: string) {
    const key = `${confessionId}_${emoji}`
    const was = myReactions.has(key)
    setMyReactions(prev => { const n = new Set(prev); was ? n.delete(key) : n.add(key); return n })
    setConfessions(prev => prev.map(c => {
      if (c.id !== confessionId) return c
      const r = { ...c.reactions }
      if (was) { r[emoji] = Math.max(0,(r[emoji]||0)-1); if (!r[emoji]) delete r[emoji] }
      else r[emoji] = (r[emoji]||0)+1
      return { ...c, reactions: r }
    }))
    await toggleReaction(confessionId, emoji, sessionId, was)
  }

  function copyLink() { navigator.clipboard?.writeText(`${window.location.origin}/board/${code}`); toast_('Link copied!') }

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
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'14px' }}>
      <div className="animate-spin" style={{ width:'18px', height:'18px', border:'2px solid var(--line-2)', borderTopColor:'var(--amber)', borderRadius:'50%' }} />
      <p className="mono">Loading board...</p>
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px' }}>
      <span style={{ fontSize:'48px', opacity:0.15 }}>🤫</span>
      <p style={{ fontSize:'18px', fontWeight:600, color:'var(--ink-2)' }}>Board not found</p>
      <a href="/" className="mono" style={{ color:'var(--ink-3)' }}>← Go home</a>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <header style={{ height:'54px', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', borderBottom:'1px solid var(--line)', background:'rgba(12,12,15,0.92)', backdropFilter:'blur(16px)', position:'sticky', top:0, zIndex:50 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
          <a href="/" style={{ fontFamily:'Georgia,serif', fontStyle:'italic', fontWeight:900, fontSize:'18px', color:'var(--ink)', textDecoration:'none' }}>whispr</a>
          <span style={{ color:'var(--line-3)', fontSize:'18px', lineHeight:1 }}>·</span>
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <span className="animate-blink" style={{ width:'7px', height:'7px', borderRadius:'50%', background:'var(--green)', boxShadow:'0 0 6px var(--green)', display:'block' }} />
            <span style={{ fontSize:'14px', fontWeight:600, color:'var(--ink-2)' }}>{board?.name}</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button className="btn-outline" onClick={() => setShowInvite(true)} style={{ padding:'6px 14px', fontSize:'12px' }}>Invite ↗</button>
          <button className="btn-amber" onClick={() => setShowConfess(true)} style={{ padding:'7px 16px', fontSize:'13px' }}>+ Confess</button>
        </div>
      </header>

      <div style={{ display:'flex', flex:1 }}>

        {/* Sidebar */}
        <aside style={{ width:'220px', borderRight:'1px solid var(--line)', padding:'24px 16px', flexShrink:0, display:'flex', flexDirection:'column', gap:'6px', position:'sticky', top:'54px', height:'calc(100vh - 54px)', overflowY:'auto' }}>
          <p className="section-label" style={{ marginBottom:'10px', paddingLeft:'8px' }}>Filter by mood</p>
          {[{ key:'all', label:'All confessions', emoji:'✦' }, ...MOODS.map(m => ({ key:m.emoji, label:m.label, emoji:m.emoji }))].map(f => {
            const active = filter === f.key
            const count = f.key === 'all' ? confessions.length : (moodCount[f.key] || 0)
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'7px 10px', borderRadius:'var(--radius-sm)', background:active ? 'var(--bg-2)' : 'transparent', border:`1px solid ${active ? 'var(--line-2)' : 'transparent'}`, color:active ? 'var(--ink)' : 'var(--ink-3)', cursor:'pointer', fontSize:'13px', fontWeight:active ? 600 : 400, fontFamily:"'Bricolage Grotesque',sans-serif", width:'100%', transition:'all 0.15s', textAlign:'left' }}>
                <span style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                  <span>{f.emoji}</span>
                  <span>{f.label}</span>
                </span>
                {count > 0 && <span className="mono" style={{ fontSize:'10px', color:'var(--ink-4)', background:'var(--bg-3)', padding:'1px 6px', borderRadius:'99px' }}>{count}</span>}
              </button>
            )
          })}

          <div className="rule" style={{ margin:'16px 0 10px' }} />
          <p className="section-label" style={{ marginBottom:'10px', paddingLeft:'8px' }}>Stats</p>
          {[
            { label:'Confessions', value:confessions.length },
            { label:'Today', value:confessions.filter(c => Date.now()-new Date(c.created_at).getTime()<86400000).length },
            { label:'Reactions', value:totalReactions },
          ].map(s => (
            <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px' }}>
              <span style={{ fontSize:'12px', color:'var(--ink-3)' }}>{s.label}</span>
              <span style={{ fontSize:'13px', fontWeight:700, color:'var(--ink-2)' }}>{s.value}</span>
            </div>
          ))}
          {topMood && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 10px' }}>
              <span style={{ fontSize:'12px', color:'var(--ink-3)' }}>Top mood</span>
              <span style={{ fontSize:'16px' }}>{topMood[0]}</span>
            </div>
          )}
        </aside>

        {/* Main */}
        <main style={{ flex:1, padding:'28px 28px', minWidth:0 }}>

          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' }}>
            <div>
              <h1 style={{ fontSize:'20px', fontWeight:700, letterSpacing:'-0.02em', marginBottom:'2px' }}>
                {filter === 'all' ? 'All confessions' : `${filter} ${MOOD_LABELS[filter] || ''}`}
              </h1>
              <p style={{ fontSize:'13px', color:'var(--ink-3)' }}>{visible.length} confession{visible.length !== 1 ? 's' : ''}</p>
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)}
                    style={{ background:'var(--bg-1)', border:'1px solid var(--line-2)', color:'var(--ink-2)', padding:'7px 12px', borderRadius:'var(--radius-md)', fontSize:'12px', outline:'none', cursor:'pointer', fontFamily:"'Bricolage Grotesque',sans-serif", appearance:'none' }}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="mostReacted">Most reacted</option>
            </select>
          </div>

          {/* Grid */}
          {visible.length === 0 ? (
            <div style={{ textAlign:'center', padding:'100px 0' }}>
              <div style={{ fontSize:'48px', opacity:0.1, marginBottom:'16px' }}>🤫</div>
              <p style={{ fontSize:'16px', fontWeight:600, color:'var(--ink-2)', marginBottom:'6px' }}>Nothing here yet</p>
              <p style={{ fontSize:'13px', color:'var(--ink-3)' }}>Be the first to speak your truth.</p>
            </div>
          ) : (
            <div style={{ columns:'auto', columnWidth:'300px', columnGap:'14px' }}>
              {visible.map((c, i) => (
                <Card key={c.id} confession={c} index={i} myReactions={myReactions}
                  onReact={handleReaction} onShare={() => setSharing(c)} onReply={() => setReplying(c)} sessionId={sessionId} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      {showConfess && (
        <ConfessModal boardId={board!.id}
          onClose={() => setShowConfess(false)}
          onSuccess={() => { setShowConfess(false); toast_('Confession posted') }}
          onError={() => toast_('Something went wrong', false)} />
      )}

      {showInvite && (
        <Modal onClose={() => setShowInvite(false)}>
          <p className="section-label" style={{ marginBottom:'10px' }}>→ Invite</p>
          <h2 style={{ fontSize:'20px', fontWeight:700, letterSpacing:'-0.02em', marginBottom:'6px' }}>Invite members</h2>
          <p style={{ fontSize:'13px', color:'var(--ink-2)', lineHeight:1.6, marginBottom:'22px' }}>Share this code or link. Anyone can view and post anonymously.</p>

          <div style={{ background:'var(--bg)', border:'1px solid var(--line-2)', borderRadius:'var(--radius-md)', padding:'20px', textAlign:'center', marginBottom:'14px' }}>
            <p className="section-label" style={{ marginBottom:'8px' }}>Board code</p>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'30px', fontWeight:500, letterSpacing:'0.2em', color:'var(--amber)' }}>{code}</span>
          </div>

          <div style={{ display:'flex', border:'1px solid var(--line-2)', borderRadius:'var(--radius-md)', overflow:'hidden' }}>
            <span className="mono" style={{ flex:1, padding:'10px 12px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'11px' }}>
              {typeof window !== 'undefined' ? `${window.location.origin}/board/${code}` : ''}
            </span>
            <button onClick={copyLink} style={{ padding:'10px 16px', background:'var(--bg-2)', border:'none', borderLeft:'1px solid var(--line-2)', color:'var(--ink-2)', cursor:'pointer', fontSize:'12px', fontWeight:600, fontFamily:"'Bricolage Grotesque',sans-serif", whiteSpace:'nowrap' }}>
              Copy link
            </button>
          </div>
        </Modal>
      )}

      {replying && <RepliesThread confession={replying} onClose={() => setReplying(null)} />}
      {sharing && <ShareCard confession={sharing} boardName={board?.name||'whispr'} onClose={() => setSharing(null)} />}

      {toast && (
        <div style={{ position:'fixed', bottom:'20px', right:'20px', zIndex:200, display:'flex', alignItems:'center', gap:'8px', padding:'10px 16px', background:'var(--bg-2)', border:`1px solid ${toast.ok ? 'var(--line-2)' : 'rgba(248,113,113,0.3)'}`, borderRadius:'var(--radius-md)', fontSize:'13px', fontWeight:500, animation:'slideUp 0.2s ease', boxShadow:'0 8px 24px rgba(0,0,0,0.5)' }}>
          <span style={{ color:toast.ok ? 'var(--green)' : 'var(--red)' }}>{toast.ok ? '✓' : '✕'}</span>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

// ── Card ───────────────────────────────────────────────────
function Card({ confession:c, index, myReactions, onReact, onShare, onReply, sessionId }: {
  confession:Confession; index:number; myReactions:Set<string>
  onReact:(id:string,emoji:string)=>void; onShare:()=>void; onReply:()=>void; sessionId:string
}) {
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#666'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const topReactions = Object.entries(c.reactions).sort((a,b)=>b[1]-a[1]).slice(0,3)
  const [picker, setPicker] = useState(false)
  const isFeatured = c.text.length > 160

  return (
    <div className="whispr-card animate-card-in" style={{ marginBottom:'14px', breakInside:'avoid', animationDelay:`${index*0.035}s` }}>

      {/* Mood left border */}
      <div style={{ position:'absolute', left:0, top:'20%', bottom:'20%', width:'3px', background:color, borderRadius:'0 3px 3px 0', opacity:0.8 }} />

      <div style={{ padding:'18px 18px 14px 22px' }}>

        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:`${anon.color}15`, border:`1.5px solid ${anon.color}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, color:anon.color, fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>
              {anon.letter}
            </div>
            <div>
              <span className="mono" style={{ fontSize:'11px' }}>Anon #{anon.number}</span>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <span className="tag" style={{ color, borderColor:`${color}30`, background:`${color}10`, fontSize:'10px', padding:'2px 7px' }}>
              {c.mood} {moodLabel}
            </span>
            <span className="mono" style={{ fontSize:'10px' }}>{timeAgo(c.created_at)}</span>
          </div>
        </div>

        {/* Confession text */}
        <p style={{
          fontFamily: isFeatured ? "'Lora',serif" : "'Bricolage Grotesque',sans-serif",
          fontStyle: isFeatured ? 'italic' : 'normal',
          fontSize: isFeatured ? '16px' : '14px',
          lineHeight: 1.7,
          color: 'var(--ink)',
          marginBottom: '14px',
          fontWeight: 400,
        }}>
          {c.text}
        </p>

        {/* Divider */}
        <div className="rule" style={{ marginBottom:'12px' }} />

        {/* Actions */}
        <div style={{ display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
          {topReactions.map(([emoji, count]) => {
            const key = `${c.id}_${emoji}`
            const reacted = myReactions.has(key)
            return (
              <button key={emoji} onClick={() => onReact(c.id, emoji)}
                      style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 9px', borderRadius:'var(--radius-sm)', fontSize:'12px', cursor:'pointer', fontFamily:"'Bricolage Grotesque',sans-serif", transition:'all 0.15s', background:reacted ? 'rgba(245,166,35,0.1)' : 'var(--bg-2)', border:`1px solid ${reacted ? 'rgba(245,166,35,0.3)' : 'var(--line)'}`, color:reacted ? 'var(--amber)' : 'var(--ink-3)' }}>
                {emoji} <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:'11px' }}>{count}</span>
              </button>
            )
          })}

          {/* Reaction picker */}
          <div style={{ position:'relative' }}>
            <button className="btn-subtle" onClick={() => setPicker(p=>!p)} style={{ fontSize:'11px', padding:'4px 9px' }}>
              + React
            </button>
            {picker && (
              <div style={{ position:'absolute', bottom:'calc(100% + 6px)', left:0, padding:'8px', background:'var(--bg-2)', border:'1px solid var(--line-2)', borderRadius:'var(--radius-md)', display:'flex', flexWrap:'wrap', gap:'2px', width:'184px', zIndex:10, boxShadow:'0 12px 32px rgba(0,0,0,0.5)' }}>
                {REACTION_EMOJIS.map(emoji => (
                  <button key={emoji} onClick={() => { onReact(c.id, emoji); setPicker(false) }}
                          style={{ width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'var(--radius-sm)', cursor:'pointer', fontSize:'15px', border:'none', background:'transparent', transition:'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background='var(--bg-3)')}
                          onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginLeft:'auto', display:'flex', gap:'4px' }}>
            <button className="btn-subtle" onClick={onReply} style={{ fontSize:'11px', padding:'4px 9px' }}>💬 Reply</button>
            <button className="btn-subtle" onClick={onShare} style={{ fontSize:'11px', padding:'4px 9px', color:'var(--amber)', borderColor:'rgba(245,166,35,0.2)', background:'var(--amber-dim)' }}>↗</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Confess Modal ──────────────────────────────────────────
function ConfessModal({ boardId, onClose, onSuccess, onError }: { boardId:string; onClose:()=>void; onSuccess:()=>void; onError:()=>void }) {
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
      <p className="section-label" style={{ marginBottom:'10px' }}>✦ Confess</p>
      <h2 style={{ fontSize:'20px', fontWeight:700, letterSpacing:'-0.02em', marginBottom:'6px' }}>Speak anonymously</h2>
      <p style={{ fontSize:'13px', color:'var(--ink-2)', lineHeight:1.6, marginBottom:'22px' }}>No one can trace this back to you. Ever.</p>

      <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div>
          <label className="section-label" style={{ display:'block', marginBottom:'7px' }}>Your confession</label>
          <textarea className="field-area" value={text} onChange={e => setText(e.target.value)} placeholder="I have a confession..." maxLength={500} autoFocus />
          <div style={{ textAlign:'right', marginTop:'5px' }} className="mono">{text.length}/500</div>
        </div>
        <div>
          <label className="section-label" style={{ display:'block', marginBottom:'8px' }}>Mood</label>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
            {MOODS.map(m => {
              const active = mood === m.emoji
              const c = MOOD_COLORS[m.emoji] || '#666'
              return (
                <button key={m.emoji} type="button" onClick={() => setMood(m.emoji)}
                        style={{ padding:'9px 4px', borderRadius:'var(--radius-md)', display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', cursor:'pointer', fontSize:'18px', transition:'all 0.15s', background:active ? `${c}12` : 'var(--bg-1)', border:`1px solid ${active ? `${c}40` : 'var(--line)'}`, boxShadow:active ? `0 0 12px ${c}20` : 'none' }}>
                  {m.emoji}
                  <span style={{ fontSize:'9px', color:active ? c : 'var(--ink-4)', fontFamily:"'JetBrains Mono',monospace", letterSpacing:'0.03em' }}>{m.label}</span>
                </button>
              )
            })}
          </div>
        </div>
        <button type="submit" disabled={loading||!text.trim()} className="btn-amber" style={{ width:'100%', opacity:loading||!text.trim()?0.5:1 }}>
          {loading ? 'Posting...' : 'Post anonymously'}
        </button>
      </form>
    </Modal>
  )
}

// ── Modal Shell ────────────────────────────────────────────
function Modal({ children, onClose }: { children:React.ReactNode; onClose:()=>void }) {
  return (
    <div className="modal-backdrop" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal-box">
        <button onClick={onClose} style={{ position:'absolute', top:'16px', right:'16px', background:'none', border:'none', color:'var(--ink-3)', cursor:'pointer', fontSize:'18px', lineHeight:1, padding:'4px 6px', borderRadius:'var(--radius-sm)', transition:'color 0.15s' }}
                onMouseEnter={e=>(e.currentTarget.style.color='var(--ink-2)')} onMouseLeave={e=>(e.currentTarget.style.color='var(--ink-3)')}>✕</button>
        {children}
      </div>
    </div>
  )
}