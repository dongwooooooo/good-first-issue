import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null

export interface Issue {
  id: number
  repo_full_name: string
  repo_owner: string
  repo_name: string
  issue_number: number
  title: string
  url: string
  author: string
  labels: string[]
  language: string | null
  stars: number | null
  created_at: string
  is_open: boolean
}
