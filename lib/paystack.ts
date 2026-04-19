const PAYSTACK_BASE = 'https://api.paystack.co'
const SECRET = process.env.PAYSTACK_SECRET_KEY!

async function paystackRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: object
): Promise<T> {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()
  if (!json.status) throw new Error(json.message || 'Paystack request failed')
  return json.data as T
}

export interface InitializePaymentParams {
  email: string
  amount: number // in GHS (will be converted to pesewas)
  reference: string
  callback_url: string
  metadata?: Record<string, unknown>
  channels?: string[]
}

export interface PaystackTransaction {
  authorization_url: string
  access_code: string
  reference: string
}

export interface VerifyTransactionResult {
  status: string // 'success' | 'failed' | 'abandoned'
  reference: string
  amount: number // in pesewas
  currency: string
  paid_at: string
  channel: string
  metadata: Record<string, unknown>
  customer: {
    email: string
    phone: string | null
  }
}

// Initialize a Paystack transaction
export async function initializePayment(params: InitializePaymentParams) {
  return paystackRequest<PaystackTransaction>('POST', '/transaction/initialize', {
    ...params,
    amount: Math.round(params.amount * 100), // convert GHS → pesewas
    currency: 'GHS',
    channels: params.channels ?? ['card', 'mobile_money', 'bank_transfer'],
  })
}

// Verify a transaction after callback
export async function verifyTransaction(reference: string) {
  return paystackRequest<VerifyTransactionResult>(
    'GET',
    `/transaction/verify/${encodeURIComponent(reference)}`
  )
}

// Validate Paystack webhook signature
export function validateWebhookSignature(body: string, signature: string): boolean {
  const crypto = require('crypto') as typeof import('crypto')
  const hash = crypto
    .createHmac('sha512', SECRET)
    .update(body)
    .digest('hex')
  return hash === signature
}

// Generate a unique payment reference
export function generateReference(orderId: string): string {
  return `TM-${orderId.slice(0, 8)}-${Date.now()}`
}
