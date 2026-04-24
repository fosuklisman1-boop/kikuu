import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { filename, contentType } = await req.json()

  const allowed = ['video/mp4', 'video/webm', 'video/quicktime']
  if (!allowed.includes(contentType))
    return NextResponse.json({ error: 'Only MP4, WebM, MOV allowed' }, { status: 400 })

  const ext = String(filename).split('.').pop()
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('product-videos').createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('product-videos').getPublicUrl(path)

  return NextResponse.json({ signedUrl: data.signedUrl, publicUrl })
}
