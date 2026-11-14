const THETELLER_BASE = process.env.THETELLER_LIVE === 'true'
  ? 'https://checkout.theteller.net'
  : 'https://checkout-test.theteller.net'

// /status is served from the API host, which (unlike checkout.theteller.net)
// isn't behind Cloudflare's bot challenge and returns JSON to server calls.
const THETELLER_API_BASE = process.env.THETELLER_LIVE === 'true'
  ? 'https://prod.theteller.net'
  : 'https://test.theteller.net'

// Parse a gateway response, turning a Cloudflare/HTML challenge page into a
// readable error instead of "Unexpected token '<' ... is not valid JSON".
async function readJson(res: Response): Promise<any> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`TheTeller returned a non-JSON response (HTTP ${res.status}). The gateway is blocking or failing server requests.`)
  }
}

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
  const json = await readJson(res)
  if (json.status !== 'success') {
    // TheTeller's `reason` is usually a string, but a validation-style
    // rejection (e.g. a malformed redirect_url) returns it as an object
    // of per-field messages — stringify it so the error is ever readable
    // instead of collapsing to "[object Object]".
    const reason = typeof json.reason === 'string' ? json.reason : JSON.stringify(json.reason)
    throw new Error(reason || 'TheTeller initiate failed')
  }
  return { checkoutUrl: json.checkout_url, token: json.token }
}

export interface TransactionStatusResult {
  status: string // 'approved' on success
  code: string // '000' on success
  transactionId: string
  reason?: string
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
    `${THETELLER_API_BASE}/v1.1/users/transactions/${encodeURIComponent(transactionId)}/status`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Merchant-Id': MERCHANT_ID,
        'Cache-Control': 'no-cache',
      },
    }
  )
  const json = await readJson(res)
  return {
    status: json.status,
    code: json.code,
    transactionId: json.transaction_id,
    reason: typeof json.reason === 'string' ? json.reason : undefined,
    // /status doesn't return an amount; NaN signals "not provided".
    amount: json.amount === undefined || json.amount === null ? NaN : Number(json.amount),
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

export type MomoNetwork = 'MTN' | 'VDF' | 'ATL' | 'TGO'

// Local Ghana number (024 123 4567, +233 24 123 4567, ...) -> 233241234567,
// the 12-digit international form TheTeller's subscriber_number expects.
export function toMsisdn(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('233')) return digits
  return '233' + digits.replace(/^0/, '')
}

// Result codes that mean the customer's payment definitively failed (declined,
// wrong PIN, no funds, ...), as opposed to still waiting on their approval.
const FAILED_CODES = new Set(['100', '101', '102', '103', '104', '105', '114'])
export function isFailedCode(code: string | number | undefined): boolean {
  return FAILED_CODES.has(String(code))
}

// Start a direct mobile money charge: the customer gets an approval prompt on
// their phone. Goes to the API host rather than the Cloudflare-fronted
// checkout page. Code 111 ("request sent") or 000 means the prompt is out.
export async function chargeMobileMoney(params: {
  transactionId: string
  amount: number // GHS
  desc: string
  network: MomoNetwork
  phone: string
}): Promise<{ code: string; status: string; reason: string }> {
  const res = await fetch(`${THETELLER_API_BASE}/v1.1/transaction/process`, {
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
      amount: Math.round(params.amount * 100).toString().padStart(12, '0'),
      processing_code: '000200',
      'r-switch': params.network,
      subscriber_number: toMsisdn(params.phone),
    }),
  })
  const json = await readJson(res)
  const reason = typeof json.reason === 'string' ? json.reason : JSON.stringify(json.reason)
  const code = String(json.code)
  if (code !== '111' && code !== '000') {
    throw new Error(reason || 'Mobile money request failed')
  }
  return { code, status: String(json.status), reason }
}
