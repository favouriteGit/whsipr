'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase, getAnon, timeAgo, type Confession, MOOD_COLORS, MOOD_LABELS, MOOD_BG } from '@/lib/supabase'

type Reply = { id: string; confession_id: string; text: string; anon_seed: number; created_at: string }

export default function RepliesThread({ confession: c, onClose }: { confession: Confession; onClose: () => void }) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const anon = getAnon(c.anon_seed)
  const color = MOOD_COLORS[c.mood] || '#666'
  const bg = MOOD_BG[c.mood] || 'transparent'
  const moodLabel = MOOD_LABELS[c.mood] || ''

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
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border-2)', borderRadius: 'var(--r-xl)', width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', height: '85vh', maxHeight: '640px', animation: 'slideUp 0.25s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 24px 60px rgba(0,0,0,0.7)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700 }}>Thread</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '1px' }}>{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>

        {/* Original */}
        <div style={{ margin: '16px 20px 8px', padding: '14px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', borderLeft: `3px solid ${color}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: `${anon.color}18`, border: `1.5px solid ${anon.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: anon.color, fontFamily: 'monospace' }}>{anon.letter}</div>
            <span className="mono" style={{ color: 'var(--text-3)' }}>Anon #{anon.number}</span>
            <span className="badge" style={{ color, borderColor: `${color}25`, background: bg, fontSize: '10px', marginLeft: 'auto' }}>{moodLabel}</span>
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--text)' }}>{c.text}</p>
        </div>

        {/* Replies */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading && <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '20px' }}>Loading...</p>}
          {!loading && replies.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center', padding: '32px 0' }}>No replies yet. Be the first.</p>
          )}
          {replies.map(r => {
            const a = getAnon(r.anon_seed)
            return (
              <div key={r.id} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '12px', animation: 'cardIn 0.2s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px' }}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: `${a.color}18`, border: `1.5px solid ${a.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: a.color, fontFamily: 'monospace' }}>{a.letter}</div>
                  <span className="mono" style={{ color: 'var(--text-3)', fontSize: '10px' }}>Anon #{a.number}</span>
                  <span className="mono" style={{ color: 'var(--text-4)', fontSize: '10px', marginLeft: 'auto' }}>{timeAgo(r.created_at)}</span>
                </div>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--text)' }}>{r.text}</p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={post} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          <input className="input" value={text} onChange={e => setText(e.target.value)} placeholder="Reply anonymously..." maxLength={300} autoFocus style={{ flex: 1, padding: '9px 12px', borderRadius: 'var(--r-md)' }} />
          <button type="submit" disabled={posting || !text.trim()} className="btn-primary" style={{ padding: '9px 14px', opacity: posting || !text.trim() ? 0.5 : 1 }}>↑</button>
        </form>
      </div>
    </div>
  )
}
