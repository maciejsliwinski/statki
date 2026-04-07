import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ijlqufnhjjvpuorjdszu.supabase.co'
const SUPABASE_KEY = 'sb_publishable_YQlC6LlWLQKza0wAzl35sw_6hMpLTLF'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Unikalny identyfikator gracza na czas sesji przeglądarki
export function getPlayerId(): string {
  const KEY = 'statki_player_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}

// Generuje 6-znakowy kod pokoju (bez mylących znaków: 0/O, 1/I/L)
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}
