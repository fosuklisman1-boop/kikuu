import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format GHS currency
export function formatGHS(amount: number): string {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    minimumFractionDigits: 2,
  }).format(amount)
}

// Generate a URL-friendly slug
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Ghana regions for address form
export const GHANA_REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Eastern',
  'Central',
  'Volta',
  'Northern',
  'Upper East',
  'Upper West',
  'Brong-Ahafo',
  'Oti',
  'Bono East',
  'Ahafo',
  'Savannah',
  'North East',
  'Western North',
] as const

export type GhanaRegion = (typeof GHANA_REGIONS)[number]

// Shipping fee by region (GHS)
export const SHIPPING_FEES: Record<string, number> = {
  'Greater Accra': 15,
  'Ashanti': 25,
  'Western': 30,
  'Eastern': 25,
  'Central': 25,
  'Volta': 30,
  'Northern': 45,
  'Upper East': 50,
  'Upper West': 50,
  'Brong-Ahafo': 35,
  'Oti': 40,
  'Bono East': 40,
  'Ahafo': 40,
  'Savannah': 50,
  'North East': 50,
  'Western North': 40,
}

export function getShippingFee(region: string): number {
  return SHIPPING_FEES[region] ?? 50
}

// Validate a Ghana phone number (10 digits starting with 0, or 12 digits starting with 233)
export function isValidGhanaPhone(phone: string): boolean {
  const stripped = phone.replace(/[\s\-().+]/g, '')
  return /^(0\d{9}|233\d{9})$/.test(stripped)
}

// Format phone number to +233 format
export function formatGhanaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('233')) return `+${digits}`
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`
  return `+233${digits}`
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}
