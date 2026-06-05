import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  // Escape LIKE wildcards in user input so '%' / '_' are treated literally
  const safe = q.replace(/[%_]/g, (m) => `\\${m}`)

  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, slug, price, compare_at_price, images')
    .in('status', ['active', 'pre_order'])
    .ilike('name', `%${safe}%`)
    .limit(6)

  return NextResponse.json({ suggestions: data ?? [] })
}
