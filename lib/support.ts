// Pure helpers (no server imports) so client components can use them too.

export interface SupportSettings {
  email: string
  phone: string
  whatsapp: string
}

export const EMPTY_SUPPORT: SupportSettings = { email: '', phone: '', whatsapp: '' }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Digits only, Ghana-aware: 0241234567 / +233 24 123 4567 -> 233241234567.
export function toInternationalDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) return `233${digits.slice(1)}`
  return digits
}

// Returns an error message, or null when the (possibly blank) input is valid.
// Blank is allowed: it hides that channel from the storefront.
export function validateSupport(s: SupportSettings): string | null {
  if (s.email && !EMAIL_RE.test(s.email)) return 'Enter a valid support email address.'
  for (const [label, value] of [['phone', s.phone], ['WhatsApp', s.whatsapp]] as const) {
    if (!value) continue
    if (!/^[+\d\s()-]+$/.test(value)) return `The ${label} number can only contain digits, spaces, + ( ) and -.`
    const n = toInternationalDigits(value).length
    if (n < 10 || n > 15) return `Enter a valid ${label} number.`
  }
  return null
}

export interface SupportLink {
  kind: 'email' | 'phone' | 'whatsapp'
  label: string
  display: string
  href: string
}

// Only channels the admin filled in are returned.
export function buildSupportLinks(s: SupportSettings): SupportLink[] {
  const links: SupportLink[] = []
  if (s.phone) links.push({ kind: 'phone', label: 'Call', display: s.phone, href: `tel:+${toInternationalDigits(s.phone)}` })
  if (s.whatsapp) links.push({ kind: 'whatsapp', label: 'WhatsApp', display: s.whatsapp, href: `https://wa.me/${toInternationalDigits(s.whatsapp)}` })
  if (s.email) links.push({ kind: 'email', label: 'Email', display: s.email, href: `mailto:${s.email}` })
  return links
}
