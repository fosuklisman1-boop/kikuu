import Link from 'next/link'

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** 'light' = dark wordmark (for light backgrounds); 'dark' = white wordmark (for dark backgrounds) */
  theme?: 'light' | 'dark'
  /** Pass null to render without a Link wrapper */
  href?: string | null
  className?: string
}

const SIZES = {
  xs: { icon: 26, gap: 'gap-1.5', text: 'text-sm' },
  sm: { icon: 30, gap: 'gap-2',   text: 'text-base' },
  md: { icon: 36, gap: 'gap-2.5', text: 'text-xl' },
  lg: { icon: 48, gap: 'gap-3',   text: 'text-3xl' },
}

function TeloMallIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
        borderRadius: Math.round(size * 0.28),
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        {/* Roofline / T crossbar */}
        <rect x="14" y="26" width="72" height="14" rx="4" fill="white" />
        {/* Central pillar / T stem */}
        <rect x="44" y="26" width="12" height="54" rx="3" fill="white" />
        {/* Left shop window */}
        <rect x="16" y="47" width="22" height="22" rx="3" fill="white" />
        {/* Right shop window */}
        <rect x="62" y="47" width="22" height="22" rx="3" fill="white" />
      </svg>
    </div>
  )
}

export default function Logo({
  size = 'md',
  theme = 'light',
  href = '/',
  className = '',
}: LogoProps) {
  const { icon, gap, text } = SIZES[size]

  const inner = (
    <div className={`flex items-center ${gap} ${className}`}>
      <TeloMallIcon size={icon} />
      <span className={`${text} font-extrabold tracking-tight leading-none`}>
        <span className="text-[#b45309]">Telo</span>
        <span className={theme === 'dark' ? 'text-white' : 'text-[#0a0a0a]'}>Mall</span>
      </span>
    </div>
  )

  if (href === null) return inner
  return <Link href={href}>{inner}</Link>
}
