import { createBrowserClient } from '@supabase/ssr'

// Singleton browser client — safe to import anywhere in client components
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Types ──────────────────────────────────────────────────

export type Board = {
  id: string
  name: string
  code: string
  created_at: string
  member_count: number
}

export type Confession = {
  id: string
  board_id: string
  text: string
  mood: string
  anon_seed: number
  created_at: string
  reactions: Record<string, number>
}

// ── Anonymous session ID ───────────────────────────────────
// Each browser gets a persistent random ID stored in localStorage.
// It's not tied to any account — purely used to track "did this
// session already react to this confession" to prevent duplicates.

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server'
  let sid = localStorage.getItem('whispr_session')
  if (!sid) {
    sid = crypto.randomUUID()
    localStorage.setItem('whispr_session', sid)
  }
  return sid
}

// ── Board helpers ──────────────────────────────────────────

export async function createBoard(name: string): Promise<Board> {
  const code = generateCode()
  const { data, error } = await supabase
    .from('boards')
    .insert({ name, code })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getBoardByCode(code: string): Promise<Board | null> {
  const { data } = await supabase
    .from('boards')
    .select()
    .eq('code', code.toUpperCase())
    .single()
  return data
}

// ── Confession helpers ─────────────────────────────────────

export async function getConfessions(boardId: string): Promise<Confession[]> {
  const { data, error } = await supabase
    .rpc('get_confessions_with_reactions', { p_board_id: boardId })
  if (error) throw error
  return (data || []) as Confession[]
}

export async function postConfession(
  boardId: string,
  text: string,
  mood: string
): Promise<Confession> {
  const { data, error } = await supabase
    .from('confessions')
    .insert({ board_id: boardId, text, mood })
    .select()
    .single()
  if (error) throw error
  return { ...data, reactions: {} }
}

export async function deleteConfession(confessionId: string): Promise<void> {
  const { error } = await supabase
    .from('confessions')
    .delete()
    .eq('id', confessionId)
  if (error) throw error
}

// ── Reaction helpers ───────────────────────────────────────

export async function getMyReactions(
  boardId: string,
  sessionId: string
): Promise<Set<string>> {
  // Returns a Set of "confessionId_emoji" keys the session has reacted to
  const { data } = await supabase
    .from('reactions')
    .select('confession_id, emoji')
    .eq('session_id', sessionId)

  const set = new Set<string>()
  ;(data || []).forEach((r: { confession_id: string; emoji: string }) => {
    set.add(`${r.confession_id}_${r.emoji}`)
  })
  return set
}

export async function toggleReaction(
  confessionId: string,
  emoji: string,
  sessionId: string,
  currentlyReacted: boolean
): Promise<void> {
  if (currentlyReacted) {
    await supabase
      .from('reactions')
      .delete()
      .match({ confession_id: confessionId, emoji, session_id: sessionId })
  } else {
    await supabase
      .from('reactions')
      .insert({ confession_id: confessionId, emoji, session_id: sessionId })
  }
}

// ── Util ───────────────────────────────────────────────────

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 8; i++) {
    if (i === 4) c += '-'
    c += chars[Math.floor(Math.random() * chars.length)]
  }
  return c
}

export const MOOD_COLORS: Record<string, string> = {
  '😶': '#888888', '😔': '#6b9bd2', '😏': '#f0a500', '🔥': '#ff6b35',
  '😂': '#f5c518', '🥺': '#e894b3', '😱': '#ff4757', '🫣': '#a855f7',
}

export const MOOD_LABELS: Record<string, string> = {
  '😶': 'Neutral', '😔': 'Heavy', '😏': 'Petty', '🔥': 'Heated',
  '😂': 'Funny', '🥺': 'Tender', '😱': 'Shocking', '🫣': 'Awkward',
}

export const MOODS = Object.entries(MOOD_LABELS).map(([emoji, label]) => ({ emoji, label }))

export const ANON_NAMES = ['Ghost','Shadow','Echo','Cipher','Mirage','Specter','Phantom','Wraith','Void','Myth']
export const ANON_COLORS = ['#e8ff47','#a855f7','#ff4757','#f0a500','#6b9bd2','#e894b3','#ff6b35','#2ecc71']

export function getAnon(seed: number) {
  return {
    name: ANON_NAMES[seed % ANON_NAMES.length],
    color: ANON_COLORS[seed % ANON_COLORS.length],
    letter: ANON_NAMES[seed % ANON_NAMES.length][0],
    number: String(seed).slice(-3).padStart(3, '0'),
  }
}

export function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
