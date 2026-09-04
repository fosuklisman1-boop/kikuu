# TheTeller Payment Gateway — Pre-Launch Checklist

TheTeller ships on this branch **disabled by default**
(`payment_gateway_settings.theteller_enabled = false`), so merging and
deploying this branch does not expose it to real shoppers. This checklist
is the gate between "merged" and "safe to flip on in `/admin/payments`."
Do not enable TheTeller in production until every item below is checked.

Every item here was surfaced by code review during implementation
(`docs/superpowers/plans/2026-09-03-theteller-payment-gateway-plan.md`),
not guessed at afterward — see that plan's SDD ledger for the full
reasoning behind each one.

## 1. Environment variables (Vercel)

None of these are documented anywhere else in the repo — there is no
`.env.example`. Set all five on the Vercel project before enabling
TheTeller:

- `THETELLER_MERCHANT_ID`
- `THETELLER_API_USER`
- `THETELLER_API_KEY`
- `THETELLER_LIVE` — `'true'` for the live TheTeller endpoint,
  unset/anything else for the sandbox (`checkout-test.theteller.net`)
- `CRON_SECRET` — required for the reconciliation cron
  (`/api/cron/reconcile-theteller`) to do anything at all. If this is
  unset, the cron's auth check now correctly fails **closed** (every
  invocation returns 401) rather than the auth-bypass it had before a
  fix round closed it — but a failed-closed cron that nobody notices is
  just as useless as the bypass was, since TheTeller has no webhook and
  this cron is the only thing standing between an interrupted checkout
  and a permanently stuck order. Confirm Vercel's cron monitoring
  actually alerts on non-2xx responses for this route.

## 2. Vercel plan check

`vercel.json` schedules the reconciliation cron at `*/5 * * * *` (every 5
minutes). Confirm the Vercel account's plan actually permits this cadence
— some plans restrict cron jobs to a much coarser schedule (e.g. once
daily) and/or cap the number of cron jobs. If the plan doesn't support
5-minute cadence, either upgrade the plan or adjust the schedule (and
re-evaluate whether the 10-minute "stale" threshold in the cron's query
still makes sense at a coarser cadence).

## 3. One real test transaction — required, and must check the RIGHT things

A test payment that simply "succeeds" does **not** validate the things
that actually matter here — several of the guards below are specifically
designed to fail *loudly* rather than silently, which means a naive
"did it work?" test can pass while the real question stays unanswered.
Run one real transaction (sandbox environment is fine) against
`checkout-test.theteller.net` and check:

- **Amount unit.** `TransactionStatusResult.amount` (in `lib/theteller.ts`)
  is currently read as `Number(json.amount)` and assumed to be GHS
  decimal — but TheTeller's own `/initiate` REQUEST side uses pesewas
  (a 12-digit zero-padded minor-unit string), so there's a real chance
  the `/status` RESPONSE also reports pesewas, not GHS. **Do not just
  check that the order gets marked paid** — log or inspect the RAW
  `json.amount` value from the `/status` response for a transaction of a
  known GHS total, and confirm by eye whether it's GHS decimal or
  pesewas. A 100x-inflated pesewas-read-as-GHS value would sail past
  the existing underpayment-only mismatch check undetected if you only
  check "did the order end up paid."
- **Amount field shape.** Confirm `json.amount` actually exists, is a
  top-level field (not nested), and parses to a finite number. If the
  field is missing, renamed, or nested, `Number(json.amount)` is `NaN`,
  and the fail-closed sanity guard added in `processVerification`
  specifically checks `!Number.isFinite(result.amount)` to catch this
  case — deliberately verify this guard actually FIRES by feeding it a
  malformed response (or reasoning through the raw response you
  captured above), not just that a normal payment passes through it.
  A guard that silently never fires is not a guard.
- **`redirect_url` query-string concatenation.** The checkout flow's
  `redirect_url` already has `?order_id=...` on it before TheTeller adds
  its own params (`?code=&status=&reason=&transaction_id=`). If TheTeller
  appends with a literal `?` instead of `&`, every TheTeller payment
  will fail order lookup — this fails loud (100% failure, immediately
  obvious, no silent money loss), but confirm it works before assuming
  the gateway is functional at all.
- **Non-`'000'` status codes.** If possible, observe what status/code
  TheTeller returns for a payment that is still awaiting MoMo approval
  (not yet approved or declined) — this codebase currently has no
  documented vocabulary for TheTeller's status codes beyond `'000'` =
  success. The checkout redirect path (`app/api/payment/theteller-verify/route.ts`)
  cancels the order on ANY non-`'000'` code with no distinction between
  "still processing" and "hard decline" — if a genuinely slow-but-valid
  MoMo approval produces a non-`'000'` code before the redirect fires,
  the order gets wrongly cancelled while the shopper is later still
  charged, with no refund path. (The reconciliation cron already applies
  a 24-hour grace period before it will auto-cancel an ambiguous status,
  but that only helps orders where the browser redirect never fires at
  all — the common case, where the redirect DOES fire within seconds, is
  not covered by the grace period.) If TheTeller's docs or support can
  provide the actual code vocabulary, update `processVerification`'s
  failure branch to distinguish terminal failure from still-pending
  before relying on this in production.

## 4. Known follow-up work (not merge-blocking, but real)

These don't block enabling TheTeller once section 3 is resolved, but are
tracked here so they aren't lost:

- **Cart-clearing gap when the cron (not the redirect) completes an
  order.** `ClearCartOnSuccess` only clears the cart when a shopper's
  browser visits `/orders/{id}?success=1`. If a shopper completes
  TheTeller payment and closes the tab before the redirect fires, the
  reconciliation cron correctly credits the order later, but the cart is
  never cleared — the shopper could check out the same items again and
  be charged twice. Needs its own scoped design (e.g. clearing on any
  view of a non-pending order the visitor owns, not just the
  `?success=1` flag), not a one-line fix. The same latent gap already
  exists for Paystack (webhook completes payment without the shopper's
  browser ever confirming), so this branch narrows an existing bug class
  rather than introducing a new one — but it's real and should be fixed.
- **No unit tests for `lib/payment-verification.ts` or the reconciliation
  cron route**, despite this logic going through 3 rounds of fixes where
  each round's fix seeded the next round's bug. A stubbed-admin-client
  test suite over the branch matrix (`autoCancel` × success/failure/
  mismatch/sanity-guard, plus the terminal-status denylist) would be
  cheap and would structurally end that pattern.
- **`?error=<code>` query params are never rendered.** All four
  TheTeller/Paystack redirect failure paths append an error code, but
  the order page only reads `?success=`. A failed TheTeller payment
  currently lands the shopper on a bare order page with no explanation.
- **Internal diagnostic text is shown to customers.** The amount-sanity
  guard's `order_events` description ("possible currency-unit
  mismatch... unit unconfirmed") is developer-facing language that
  renders directly in the customer's order timeline. Worth a
  customer-facing rewrite with the diagnostic detail moved to
  `console.error` only.
- **No `maxDuration` set on the cron route.** The batch loop can run up
  to 50 sequential iterations of HTTP + DB calls; a mid-batch timeout is
  self-healing (retries next tick) but the time budget is currently
  implicit rather than deliberate.

## 5. Enablement procedure

Once sections 1-3 are fully checked off:

1. Set all five environment variables on Vercel and redeploy (env
   changes require a new deployment to take effect).
2. Confirm the cron is actually running: check Vercel's cron logs for a
   successful (200, or 500-with-partial-results if something's
   genuinely wrong) invocation within 5 minutes of deploy.
3. Only then, go to `/admin/payments` and enable TheTeller.
4. Watch the first few real TheTeller orders manually (via `/admin/orders`
   and the `order_events` timeline) rather than assuming section 3's
   sandbox test transaction generalizes perfectly to live traffic.
