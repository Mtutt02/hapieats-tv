/**
 * Stripe webhook payloads follow the API version of the WEBHOOK ENDPOINT, not of the SDK
 * (lib/stripe.ts pins 2024-06-20). From API version 2025-03-31 (basil) several invoice / charge
 * fields moved. These readers accept both shapes so Pro revenue and refunds are recorded whichever
 * version the endpoint is on.
 *
 *   subscription   invoice.subscription                     | invoice.parent.subscription_details.subscription
 *   sub. metadata  invoice.subscription_details.metadata    | invoice.parent.subscription_details.metadata
 *   tax            invoice.tax                              | sum(invoice.total_taxes[].amount)
 *   charge invoice charge.invoice                           | invoice_payments lookup by payment intent
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

/**
 * The invoice a charge paid, or null (not an invoice charge, or not resolvable).
 * Older API versions put it on the charge; newer ones only expose it through InvoicePayment.
 */
export async function chargeInvoiceId(
  stripeClient: Stripe,
  charge: Stripe.Charge,
): Promise<string | null> {
  const direct = idOf((charge as unknown as Loose).invoice)
  if (direct) return direct

  const paymentIntent = idOf(charge.payment_intent)
  const invoicePayments = (stripeClient as unknown as Loose).invoicePayments
  if (!paymentIntent || typeof invoicePayments?.list !== 'function') return null

  const found = await invoicePayments.list({
    payment: { type: 'payment_intent', payment_intent: paymentIntent },
    limit: 1,
  })
  return idOf(found?.data?.[0]?.invoice)
}
