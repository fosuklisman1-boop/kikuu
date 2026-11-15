import { Phone, Mail, MessageCircle } from 'lucide-react'
import { buildSupportLinks, type SupportSettings } from '@/lib/support'

const ICONS = { phone: Phone, email: Mail, whatsapp: MessageCircle }

// Renders nothing when the admin hasn't configured any support channel.
export default function SupportContact({
  support,
  title = 'Need help?',
  className = '',
}: {
  support: SupportSettings
  title?: string
  className?: string
}) {
  const links = buildSupportLinks(support)
  if (links.length === 0) return null

  return (
    <div className={className}>
      {title && <p className="text-xs font-semibold text-[#6b6360] mb-2">{title}</p>}
      <div className="flex flex-wrap gap-2">
        {links.map(({ kind, label, display, href }) => {
          const Icon = ICONS[kind]
          return (
            <a
              key={kind}
              href={href}
              {...(kind === 'whatsapp' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#ede8df] bg-white px-3 py-2 text-xs font-medium text-[#6b6360] hover:border-[#b45309] hover:text-[#b45309] transition-colors"
            >
              <Icon size={14} className="shrink-0" />
              <span className="font-semibold">{label}</span>
              <span className="text-[#a89e96]">{display}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
