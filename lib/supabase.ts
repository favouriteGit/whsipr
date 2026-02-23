import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// 1. Connection
export const supabase = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const createClient = () => supabase

// 2. Helper: Time Ago
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

// 3. Helper: getAnon (Returns the color/letter package)
export function getAnon(seed: any = 'default') {
  const s = seed?.toString() || 'default';
  const colors = ['#A78BFA', '#F472B6', '#2DD4BF', '#FB923C', '#60A5FA'];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const index = s.length % colors.length;
  const charIndex = s.length % letters.length;
  const num = s.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 100;

  return {
    color: colors[index],
    letter: letters[charIndex],
    number: num
  };
}

// 4. Moods (Flexible indexing)
export const MOOD_COLORS: any = {
  default: '#8b5cf6',
  sad: '#3b82f6',
  angry: '#ef4444',
  happy: '#f59e0b',
  whisper: '#8b5cf6'
}

export const MOOD_LABELS: any = {
  default: 'Whisper',
  sad: 'Sad',
  angry: 'Rant',
  happy: 'Joy',
  whisper: 'Whisper'
}

// 5. THE CRITICAL FIX: The Confession Type
// We add both 'text' and 'content' so no component fails
export type Confession = {
  id: string
  text?: any      // Used by your old RepliesThread component
  content?: any   // Used by the new Board page
  created_at: string
  board_code: string
  mood?: any
  anon_seed?: any
}