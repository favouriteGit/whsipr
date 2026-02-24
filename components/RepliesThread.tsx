'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, getAnon, timeAgo, type Confession, MOOD_LABELS } from '@/lib/supabase'

type Reply = { id: string; confession_id: string; text: string; anon_seed: number; created_at: string }

export default function RepliesThread({ confession: c, onClose }: { confession: Confession; onClose: () => void }) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const anon = getAnon(c.anon_seed)
  const moodLabel = MOOD_LABELS[c.mood] || 'NEUTRAL'

  useEffect(() => {
    supabase.from('replies').select('*').eq('confession_id', c.id).order('created_at', { ascending: true })
      .then(({ data }) => { setReplies(data || []); setLoading(false) })
  }, [c.id])

  useEffect(() => {
    const ch = supabase.channel(`replies:${c.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replies', filter: `confession_id=eq.${c.id}` },
        (p) => { setReplies(prev => [...prev, p.new as Reply]); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [c.id])

  useEffect(() => { if (!loading) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) }, [loading])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || posting) return
    setPosting(true)
    await supabase.from('replies').insert({ confession_id: c.id, text: text.trim() })
    setText(''); setPosting(false)
  }

  return (
    <div className="overlay anim-fade" onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--paper)', border: '1px solid var(--ink)', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', height: '85vh', maxHeight: '620px', animation: 'slideUp 0.25s ease', boxShadow: '4px 4px 0 rgba(0,0,0,0.2)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--ink-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ink)', color: 'var(--paper)', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em' }}>REPLY THREAD</p>
            <p style={{ fontSize: '10px', color: 'rgba(245,242,235,0.5)', marginTop: '1px', letterSpacing: '0.05em' }}>{replies.length} REPL{replies.length !== 1 ? 'IES' : 'Y'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid rgba(245,242,235,0.2)', color: 'rgba(245,242,235,0.7)', cursor: 'pointer', fontSize: '12px', fontFamily: "'IBM Plex Mono',monospace", padding: '4px 10px' }}>CLOSE</button>
        </div>

        {/* Original confession */}
        <div style={{ margin: '14px 16px', padding: '12px', background: 'var(--paper-2)', border: '1px solid var(--ink-5)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '6px' }}>
            <span>ANON: {anon.letter}{anon.number}</span>
            <span>MOOD: {moodLabel.toUpperCase()}</span>
          </div>
          <div className="dash-line" style={{ marginBottom: '8px' }} />
          <p style={{ fontSize: '12px', lineHeight: 1.65, color: 'var(--ink)' }}>{c.text}</p>
        </div>

        <div className="dash-line" style={{ margin: '0 16px' }} />

        {/* Replies */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && <p style={{ fontSize: '11px', color: 'var(--ink-3)', textAlign: 'center', padding: '20px', letterSpacing: '0.05em' }}>LOADING...</p>}
          {!loading && replies.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--ink-4)', textAlign: 'center', padding: '32px 0', letterSpacing: '0.05em' }}>NO REPLIES YET — BE FIRST</p>
          )}
          {replies.map(r => {
            const a = getAnon(r.anon_seed)
            return (
              <div key={r.id} style={{ background: 'var(--paper-2)', border: '1px solid var(--ink-5)', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--ink-3)', marginBottom: '6px' }}>
                  <span>ANON: {a.letter}{a.number}</span>
                  <span>{timeAgo(r.created_at).toUpperCase()}</span>
                </div>
                <p style={{ fontSize: '12px', lineHeight: 1.6, color: 'var(--ink)' }}>{r.text}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid var(--ink-5)', flexShrink: 0 }}>
          <form onSubmit={post} style={{ display: 'flex' }}>
            <input className="input" value={text} onChange={e => setText(e.target.value)}
                   placeholder="TYPE REPLY..." maxLength={300} autoFocus
                   style={{ flex: 1, borderRadius: 0, border: 'none', borderRight: '1px solid var(--ink-5)', fontSize: '12px' }} />
            <button type="submit" disabled={posting || !text.trim()} className="btn-primary"
                    style={{ borderRadius: 0, padding: '10px 16px', opacity: posting || !text.trim() ? 0.5 : 1, flexShrink: 0 }}>
              {posting ? '...' : 'POST'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
