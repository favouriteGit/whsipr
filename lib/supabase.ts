import { createBrowserClient } from '@supabase/ssr'

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Board = {
  id: string; name: string; code: string; created_at: string; member_count: number
}

export type Confession = {
  id: string; board_id: string; text: string; mood: string
  anon_seed: number; created_at: string; reactions: Record<string, number>
  image_url?: string
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let sid = localStorage.getItem('whispr_session')
  if (!sid) { sid = crypto.randomUUID(); localStorage.setItem('whispr_session', sid) }
  return sid
}

export async function createBoard(name: string): Promise<Board> {
  const code = generateCode()
  const { data, error } = await supabase.from('boards').insert({ name, code }).select().single()
  if (error) throw error
  return data
}

export async function getBoardByCode(code: string): Promise<Board | null> {
  const { data } = await supabase.from('boards').select().eq('code', code.toUpperCase()).single()
  return data
}

export async function getConfessions(boardId: string): Promise<Confession[]> {
  const { data, error } = await supabase.rpc('get_confessions_with_reactions', { p_board_id: boardId })
  if (error) throw error
  return (data || []) as Confession[]
}

export async function postConfession(boardId: string, text: string, mood: string, imageUrl?: string): Promise<Confession> {
  const payload: Record<string, unknown> = { board_id: boardId, text, mood }
  if (imageUrl) payload.image_url = imageUrl
  const { data, error } = await supabase.from('confessions').insert(payload).select().single()
  if (error) throw error
  return { ...data, reactions: {} }
}

export async function getMyReactions(boardId: string, sessionId: string): Promise<Set<string>> {
  const { data } = await supabase.from('reactions').select('confession_id, emoji').eq('session_id', sessionId)
  const set = new Set<string>()
  ;(data || []).forEach((r: { confession_id: string; emoji: string }) => set.add(`${r.confession_id}_${r.emoji}`))
  return set
}

export async function toggleReaction(confessionId: string, emoji: string, sessionId: string, wasReacted: boolean) {
  if (wasReacted) {
    await supabase.from('reactions').delete().match({ confession_id: confessionId, emoji, session_id: sessionId })
  } else {
    await supabase.from('reactions').insert({ confession_id: confessionId, emoji, session_id: sessionId })
  }
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 8; i++) { if (i === 4) c += '-'; c += chars[Math.floor(Math.random() * chars.length)] }
  return c
}

export const MOOD_COLORS: Record<string, string> = {
  '😶': '#71717a', '😔': '#60a5fa', '😏': '#fb923c', '🔥': '#f97316',
  '😂': '#facc15', '🥺': '#f472b6', '😱': '#f87171', '🫣': '#a78bfa',
}

export const MOOD_LABELS: Record<string, string> = {
  '😶': 'Neutral', '😔': 'Heavy', '😏': 'Petty', '🔥': 'Heated',
  '😂': 'Funny', '🥺': 'Tender', '😱': 'Shocking', '🫣': 'Awkward',
}

export const MOODS = Object.entries(MOOD_LABELS).map(([emoji, label]) => ({ emoji, label }))

const NAMES  = ['Ghost','Shadow','Echo','Cipher','Mirage','Specter','Phantom','Wraith','Void','Myth']
const COLORS = ['#f59e0b','#8b5cf6','#ef4444','#3b82f6','#22c55e','#ec4899','#f97316','#06b6d4']

export function getAnon(seed: number) {
  return {
    name:   NAMES[seed % NAMES.length],
    color:  COLORS[seed % COLORS.length],
    letter: NAMES[seed % NAMES.length][0],
    number: String(seed).slice(-3).padStart(3, '0'),
  }
}

export function timeAgo(ts: string): string {
  const d = (Date.now() - new Date(ts).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}
