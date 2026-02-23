import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 1. The Core Connection
export const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 2. The "createClient" function for the new pages
export const createClient = () => supabase

// 3. Helper: Time Ago (Fixes the build error)
export function timeAgo(date: string | Date): string {
  const now = new Date()
  const then = new Date(date)
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return then.toLocaleDateString()
}

// 4. Helper: Anon ID (Fixes the build error)
export function getAnon() {
  return Math.random().toString(36).substring(2, 9)
}

// 5. Moods and Types (Fixes the build error)
export type Confession = {
  id: string
  content: string
  created_at: string
  board_code: string
  mood?: string
}

export const MOOD_COLORS = {
  default: '#8b5cf6',
  sad: '#3b82f6',
  angry: '#ef4444',
  happy: '#f59e0b'
}

export const MOOD_LABELS = {
  default: 'Whisper',
  sad: 'Sad',
  angry: 'Rant',
  happy: 'Joy'
}