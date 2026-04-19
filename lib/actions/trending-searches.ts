'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TrendingSearch } from '@/lib/supabase/types'

export async function fetchTrendingSearches(): Promise<TrendingSearch[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('trending_searches')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .limit(8)
  return data ?? []
}

export async function addTrendingSearch(query: string) {
  if (!query.trim()) return { error: 'Query cannot be empty' }
  const admin = createAdminClient()
  const { count } = await admin
    .from('trending_searches')
    .select('*', { count: 'exact', head: true })
  const { error } = await admin.from('trending_searches').insert({
    query: query.trim(),
    sort_order: count ?? 0,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/trending-searches')
  return { success: true }
}

export async function updateTrendingSearch(id: string, data: { query?: string; sort_order?: number; active?: boolean }) {
  const admin = createAdminClient()
  const { error } = await admin.from('trending_searches').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trending-searches')
  return { success: true }
}

export async function deleteTrendingSearch(id: string) {
  const admin = createAdminClient()
  const { error } = await admin.from('trending_searches').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/trending-searches')
  return { success: true }
}
