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

interface RepliesThreadProps {
  confession: Confession
  onClose: () => void
}

export default function RepliesThread({ confession: c, onClose }: RepliesThreadProps) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const color = MOOD_COLORS[c.mood] || '#888'
  const moodLabel = MOOD_LABELS[c.mood] || ''
  const confAnon = getAnon(c.anon_seed)

  // Load replies
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('replies')
        .select('*')
        .eq('confession_id', c.id)
        .order('created_at', { ascending: true })
      setReplies(data || [])
      setLoading(false)
    }
    load()
  }, [c.id])

  // Realtime replies
  useEffect(() => {
    const channel = supabase
      .channel(`replies:${c.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'replies',
        filter: `confession_id=eq.${c.id}`
      }, (payload) => {
        setReplies(prev => [...prev, payload.new as Reply])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [c.id])

  // Scroll to bottom on load
  useEffect(() => {
    if (!loading) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
  }, [loading])

  async function postReply(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || posting) return
    setPosting(true)
    const { error } = await supabase
      .from('replies')
      .insert({ confession_id: c.id, text: text.trim() })
    if (!error) setText('')
    setPosting(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
         style={{ background: 'rgba(8,8,8,0.95)', backdropFilter: 'blur(12px)' }}
         onClick={e => e.target === e.currentTarget && onClose()}>

      <div className="w-full max-w-[520px] flex flex-col animate-[slideUp_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
           style={{ height: '85vh', maxHeight: '700px' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase mb-1">💬 Thread</div>
            <h2 className="font-playfair text-xl font-bold">Replies</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-muted hover:text-[var(--text)] transition-colors">✕</button>
        </div>

        {/* Original confession */}
        <div className="p-5 border mb-4 relative shrink-0"
             style={{ background: 'var(--surface)', borderColor: `${color}40` }}>
          <div className="absolute left-0 top-0 bottom-0 w-[2px]" style={{ background: color }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] font-bold border"
                 style={{ background: `${confAnon.color}18`, borderColor: `${confAnon.color}40`, color: confAnon.color }}>
              {confAnon.letter}
            </div>
            <span className="font-mono text-[10px] text-dim">Anon #{confAnon.number}</span>
            <span className="font-mono text-[10px] text-dim ml-auto">{timeAgo(c.created_at)}</span>
          </div>
          <p className="font-playfair italic text-sm leading-relaxed text-[var(--text)] mb-2">{c.text}</p>
          <span className="font-mono text-[10px]" style={{ color }}>{c.mood} {moodLabel}</span>
        </div>

        {/* Replies list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scrollbar-none">
          {loading && (
            <div className="text-center py-8 font-mono text-xs text-dim animate-pulse">loading replies...</div>
          )}

          {!loading && replies.length === 0 && (
            <div className="text-center py-10">
              <div className="text-3xl mb-3 opacity-30">💬</div>
              <p className="font-mono text-xs text-dim">No replies yet. Be the first to respond.</p>
            </div>
          )}

          {replies.map((r, i) => {
            const anon = getAnon(r.anon_seed)
            return (
              <div key={r.id}
                   className="p-4 border border-[var(--border)] bg-surface animate-[cardIn_0.3s_ease]"
                   style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center font-mono text-[9px] font-bold border"
                       style={{ background: `${anon.color}18`, borderColor: `${anon.color}40`, color: anon.color }}>
                    {anon.letter}
                  </div>
                  <span className="font-mono text-[10px] text-dim">Anon #{anon.number}</span>
                  <span className="font-mono text-[10px] text-dim ml-auto">{timeAgo(r.created_at)}</span>
                </div>
                <p className="font-syne text-sm leading-relaxed text-[var(--text)]">{r.text}</p>
              </div>
            )
          })}

          <div ref={bottomRef} />
        </div>

        {/* Reply input */}
        <form onSubmit={postReply} className="mt-4 shrink-0">
          <div className="flex gap-2">
            <input
              className="form-input flex-1 text-sm"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Reply anonymously..."
              maxLength={300}
              autoFocus
            />
            <button
              type="submit"
              disabled={posting || !text.trim()}
              className="px-5 font-syne font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-30"
              style={{ background: 'var(--accent)', color: '#080808' }}>
              {posting ? '...' : '↑'}
            </button>
          </div>
          <div className="text-right font-mono text-[10px] text-dim mt-1">{text.length} / 300</div>
        </form>
      </div>
    </div>
  )
}
