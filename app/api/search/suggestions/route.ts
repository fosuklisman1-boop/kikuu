import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json({ suggestions: [] })

  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select('name, slug')
    .eq('status', 'active')
    .ilike('name', `%${q}%`)
    .limit(6)

  return NextResponse.json({ suggestions: data ?? [] })
}
