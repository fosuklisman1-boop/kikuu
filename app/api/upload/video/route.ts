import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const allowed = ['video/mp4', 'video/webm', 'video/quicktime']
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: 'Only MP4, WebM, MOV allowed' }, { status: 400 })
  if (file.size > 50 * 1024 * 1024)
    return NextResponse.json({ error: 'Max video size is 50MB' }, { status: 400 })

  const admin = createAdminClient()
  const ext = file.name.split('.').pop()
  const path = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await admin.storage.from('product-images').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('product-images').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl })
}
