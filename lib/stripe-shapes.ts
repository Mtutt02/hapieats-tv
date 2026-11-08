/**
 * Stripe webhook payloads follow the API version of the WEBHOOK ENDPOINT, not of the SDK
 * (lib/stripe.ts pins 2024-06-20). From API version 2025-03-31 (basil) several invoice / charge
 * fields moved. These readers accept both shapes so Pro revenue and refunds are recorded whichever
 * version the endpoint is on.
 *
 *   subscription   invoice.subscription                     | invoice.parent.subscription_details.subscription
 *   sub. metadata  invoice.subscription_details.metadata    | invoice.parent.subscription_details.metadata
 *   tax            invoice.tax                              | sum(invoice.total_taxes[].amount)
 *   charge invoice charge.invoice                           | pro_revenue_ledger.stripe_payment_intent_id, then invoice_payments lookup
 *   invoice PI     invoice.payment_intent                   | invoice.payments[].payment.payment_intent (expanded) or invoice_payments lookup
 *   period end     subscription.current_period_end          | subscription.items.data[0].current_period_end
 */
import type Stripe from 'stripe'

type Loose = Record<string, any>

const idOf = (v: unknown): string | null =>
  typeof v === 'string' ? v : v && typeof (v as Loose).id === 'string' ? (v as Loose).id : null

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const i = invoice as unknown as Loose
  return idOf(i.subscription) ?? idOf(i.parent?.subscription_details?.subscription)
}

export function invoiceSubscriptionMetadata(invoice: Stripe.Invoice): Record<string, string> {
  const i = invoice as unknown as Loose
  return i.subscription_details?.metadata ?? i.parent?.subscription_details?.metadata ?? {}
}

/** Tax included in amount_paid, in cents. */
export function invoiceTaxCents(invoice: Stripe.Invoice): number {
  const i = invoice as unknown as Loose
  if (typeof i.tax === 'number') return i.tax
  if (Array.isArray(i.total_taxes)) {
    return i.total_taxes.reduce((sum: number, t: Loose) => sum + (Number(t?.amount) || 0), 0)
  }
  return 0
}

const epochOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null

const toIso = (sec: number | null): string | null => (sec == null ? null : new Date(sec * 1000).toISOString())

/**
 * Billing period of a subscription, in epoch seconds. On API versions before 2025-03-31 (basil)
 * the period lives on the subscription; from basil it lives on each subscription ITEM and the
 * top-level field is gone (reading it gives undefined, and `new Date(undefined * 1000)` throws a
 * RangeError at toISOString). Null when neither exists, so callers can skip the column.
 */
export function currentPeriodEnd(sub: Stripe.Subscription): number | null {
  const s = sub as unknown as Loose
  return epochOrNull(s.current_period_end) ?? epochOrNull(s.items?.data?.[0]?.current_period_end)
}
export function currentPeriodStart(sub: Stripe.Subscription): number | null {
  const s = sub as unknown as Loose
  return epochOrNull(s.current_period_start) ?? epochOrNull(s.items?.data?.[0]?.current_period_start)
}
export const currentPeriodEndIso = (sub: Stripe.Subscription) => toIso(currentPeriodEnd(sub))
export const currentPeriodStartIso = (sub: Stripe.Subscription) => toIso(currentPeriodStart(sub))

/**
 * The payment intent that paid an invoice, when the event itself carries it:
 *   old shape  invoice.payment_intent
 *   basil      invoice.payments.data[].payment.payment_intent   (only present when `payments` is expanded)
 * Null when the payload has neither; invoicePaymentIntentFromApi() is the lookup for that case.
 */
export function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const i = invoice as unknown as Loose
  const direct = idOf(i.payment_intent)
  if (direct) return direct
  const rows: Loose[] = Array.isArray(i.payments?.data) ? i.payments.data : []
  // prefer a payment that actually paid; fall back to the first PI-backed one
  const paid = rows.find(p => p?.status === 'paid' && idOf(p?.payment?.payment_intent))
  return idOf((paid ?? rows.find(p => idOf(p?.payment?.payment_intent)))?.payment?.payment_intent)
}

/** The charge's invoice when the charge itself says so (API versions before basil). */
export function chargeDirectInvoiceId(charge: Stripe.Charge): string | null {
  return idOf((charge as unknown as Loose).invoice)
}

// Invoice Payments (GET /v1/invoice_payments) exist from this API version. The pinned SDK
// (stripe@16, apiVersion 2024-06-20) has no types or resource for them, so they are reached with
// the version pinned PER REQUEST. NOT VERIFIED against real Stripe: it needs a live basil call.
export const INVOICE_PAYMENTS_API_VERSION = '2025-03-31.basil'

/** { payment: { type: 'x' } } -> [['payment[type]', 'x']] (Stripe's form encoding for a query string) */
function flattenParams(params: Record<string, unknown>, prefix = ''): [string, string][] {
  return Object.entries(params).flatMap(([k, v]) => {
    const name = prefix ? `${prefix}[${k}]` : k
    return v !== null && typeof v === 'object' ? flattenParams(v as Record<string, unknown>, name) : [[name, String(v)] as [string, string]]
  })
}

/** GET a Stripe path pinned to the basil API version. Returns null when this SDK cannot do a raw request. */
async function basilGet(stripeClient: Stripe, path: string, query: Record<string, unknown>): Promise<Loose | null> {
  const c = stripeClient as unknown as Loose
  if (typeof c.rawRequest === 'function') {
    // stripe-node >= 17.x: rawRequest(method, path, params, options); GET params go to the query string
    const res = await c.rawRequest('GET', path, query, { apiVersion: INVOICE_PAYMENTS_API_VERSION })
    if (res && typeof res.json === 'function') return await res.json()
    return res ?? null
  }
  const resource = path === '/v1/invoice_payments' ? c.invoicePayments : null
  if (typeof resource?.list === 'function') {
    return await resource.list(query, { apiVersion: INVOICE_PAYMENTS_API_VERSION })
  }
  // The pinned stripe@16.12 has neither rawRequest nor invoicePayments: call the REST endpoint
  // directly with the version pinned in the Stripe-Version header (read-only GET).
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || typeof fetch !== 'function') return null
  const qs = new URLSearchParams(flattenParams(query))
  const res = await fetch(`https://api.stripe.com${path}?${qs}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': INVOICE_PAYMENTS_API_VERSION },
  })
  if (!res.ok) throw new Error(`stripe GET ${path} -> ${res.status}`)
  return await res.json()
}

/** Last resort: the invoice paid by a payment intent, through InvoicePayments. Null when unresolvable. */
export async function invoiceIdForPaymentIntent(stripeClient: Stripe, paymentIntent: string): Promise<string | null> {
  const found = await basilGet(stripeClient, '/v1/invoice_payments', {
    payment: { type: 'payment_intent', payment_intent: paymentIntent },
    limit: 1,
  })
  return idOf(found?.data?.[0]?.invoice)
}

/** Last resort for invoice.paid on basil: the payment intent behind an invoice. */
export async function invoicePaymentIntentFromApi(stripeClient: Stripe, invoiceId: string): Promise<string | null> {
  const found = await basilGet(stripeClient, '/v1/invoice_payments', { invoice: invoiceId, limit: 10 })
  const rows: Loose[] = Array.isArray(found?.data) ? found!.data : []
  const paid = rows.find(p => p?.status === 'paid' && idOf(p?.payment?.payment_intent))
  return idOf((paid ?? rows.find(p => idOf(p?.payment?.payment_intent)))?.payment?.payment_intent)
}

/**
 * The invoice a charge paid, or null (not an invoice charge, or not resolvable).
 * Older API versions put it on the charge; newer ones only expose it through InvoicePayment.
 * The webhook matches the Pro ledger by invoice id, then by payment intent, and only then calls
 * this lookup (see the refund / dispute case).
 */
export async function chargeInvoiceId(
  stripeClient: Stripe,
  charge: Stripe.Charge,
): Promise<string | null> {
  const direct = chargeDirectInvoiceId(charge)
  if (direct) return direct
  const paymentIntent = idOf(charge.payment_intent)
  if (!paymentIntent) return null
  return invoiceIdForPaymentIntent(stripeClient, paymentIntent)
}
