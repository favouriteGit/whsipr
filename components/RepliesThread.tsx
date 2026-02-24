'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, getAnon, timeAgo, type Confession, MOOD_COLORS, MOOD_LABELS } from '@/lib/supabase'

type Reply = {
  id: string
  confession_id: string
  text: string
  anon_seed: number
  created_at: string
}

export default function RepliesThread({ confession: c, onClose }: { confession: Confession; onClose: () => void }) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const color = MOOD_COLORS[c.mood] || '#666'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const confAnon = getAnon(c.anon_seed)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('replies').select('*').eq('confession_id', c.id).order('created_at', { ascending: true })
      setReplies(data || []); setLoading(false)
    }
    load()
  }, [c.id])

  useEffect(() => {
    const channel = supabase.channel(`replies:${c.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'replies', filter: `confession_id=eq.${c.id}` },
        (payload) => { setReplies(prev => [...prev, payload.new as Reply]); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100) })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [c.id])

  useEffect(() => {
    if (!loading) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [loading])

  async function postReply(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || posting) return
    setPosting(true)
    await supabase.from('replies').insert({ confession_id: c.id, text: text.trim() })
    setText(''); setPosting(false)
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
         style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.15s ease' }}>

      <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-focus)', borderRadius: '16px', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', height: '80vh', maxHeight: '640px', animation: 'slideUp 0.2s ease', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Thread</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '1px' }}>{replies.length} repl{replies.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>

        {/* Original confession */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, borderLeft: `3px solid ${color}`, marginLeft: '20px', marginRight: '20px', marginTop: '16px', marginBottom: '4px', borderRadius: '0 8px 8px 0', background: 'var(--bg)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `${confAnon.color}18`, border: `1px solid ${confAnon.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: confAnon.color }}>
              {confAnon.letter}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: "'Geist Mono', monospace" }}>Anon #{confAnon.number}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(c.created_at)}</span>
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>{c.text}</p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '11px', color, background: `${color}12`, border: `1px solid ${color}25`, padding: '2px 8px', borderRadius: '99px' }}>
            {c.mood} {moodLabel}
          </span>
        </div>

        {/* Replies */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '24px' }}>Loading...</p>}
          {!loading && replies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No replies yet. Be the first.</p>
            </div>
          )}
          {replies.map((r) => {
            const anon = getAnon(r.anon_seed)
            return (
              <div key={r.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', animation: 'cardIn 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: `${anon.color}18`, border: `1px solid ${anon.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: anon.color }}>
                    {anon.letter}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: "'Geist Mono', monospace" }}>Anon #{anon.number}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
                </div>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>{r.text}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={postReply} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input className="input" value={text} onChange={e => setText(e.target.value)}
                 placeholder="Reply anonymously..." maxLength={300} autoFocus style={{ flex: 1, padding: '8px 12px', borderRadius: '8px' }} />
          <button type="submit" disabled={posting || !text.trim()} className="btn-primary"
                  style={{ padding: '8px 14px', opacity: posting || !text.trim() ? 0.5 : 1 }}>
            {posting ? '...' : '↑'}
          </button>
        </form>
      </div>
    </div>
  )
}