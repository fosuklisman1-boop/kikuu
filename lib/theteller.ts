const THETELLER_BASE = process.env.THETELLER_LIVE === 'true'
  ? 'https://checkout.theteller.net'
  : 'https://checkout-test.theteller.net'

const MERCHANT_ID = process.env.THETELLER_MERCHANT_ID!
const API_USER = process.env.THETELLER_API_USER!
const API_KEY = process.env.THETELLER_API_KEY!

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${API_USER}:${API_KEY}`).toString('base64')
}

export interface InitiatePaymentParams {
  email: string
  amount: number // in GHS
  transactionId: string // exactly 12 digits
  desc: string
  redirectUrl: string
}

export interface InitiateResult {
  checkoutUrl: string
  token: string
}

// Initiate a TheTeller Standard Checkout payment. Throws on any non-success
// response, matching lib/paystack.ts's initializePayment convention.
export async function initiatePayment(params: InitiatePaymentParams): Promise<InitiateResult> {
  const res = await fetch(`${THETELLER_BASE}/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify({
      merchant_id: MERCHANT_ID,
      transaction_id: params.transactionId,
      desc: params.desc,
      amount: Math.round(params.amount * 100).toString().padStart(12, '0'), // GHS -> pesewas, zero-padded per TheTeller's documented amount format
      redirect_url: params.redirectUrl,
      email: params.email,
      API_Key: API_KEY,
      apiuser: API_USER,
    }),
  })
  const json = await res.json()
  if (json.status !== 'success') throw new Error(json.reason || 'TheTeller initiate failed')
  return { checkoutUrl: json.checkout_url, token: json.token }
}

export interface TransactionStatusResult {
  status: string // 'approved' on success
  code: string // '000' on success
  transactionId: string
  amount: number // UNVERIFIED unit — assumed GHS decimal by callers, but
                  // TheTeller's docs never confirm this for the /status
                  // response (the /initiate REQUEST side is confirmed
                  // pesewas). Do not remove this note until a real test
                  // transaction confirms the unit. See processVerification's
                  // amount-sanity guard, which fails closed if this is wrong.
}

// Poll TheTeller's transaction status endpoint. Used both by the redirect
// verification route and the reconciliation cron.
export async function checkTransactionStatus(transactionId: string): Promise<TransactionStatusResult> {
  const res = await fetch(
    `${THETELLER_BASE}/v1.1/users/transactions/${encodeURIComponent(transactionId)}/status`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Merchant-Id': MERCHANT_ID,
        'Cache-Control': 'no-cache',
      },
    }
  )
  const json = await res.json()
  return {
    status: json.status,
    code: json.code,
    transactionId: json.transaction_id,
    amount: Number(json.amount),
  }
}

// TheTeller requires exactly 12 digits. Timestamp (13 digits) + 3 random
// digits, taking the last 12 — sufficiently unique for practical purposes.
// This column has no DB-level unique constraint (matching how
// paystack_reference isn't uniquely constrained either); a rare collision
// would surface as a verify-time reference mismatch, not silent corruption.
export function generateTransactionId(): string {
  const timestamp = Date.now().toString()
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
  return (timestamp + random).slice(-12)
}
