import "server-only";

/**
 * FUTURE ONLINE PAYMENT GATEWAY – intentionally NOT implemented.
 *
 * The business will arrange its own bank payment gateway. Until then the store accepts
 * manual bank transfers (verified by staff) and cash on delivery only. Nothing in the app
 * may mark an order paid from a browser callback.
 *
 * To add a gateway later, implement this interface in a new module and wire it up behind
 * PAYMENT_GATEWAY_ENABLED=true:
 *  - createPayment(): create the gateway order server-side for Order.total (never a browser amount)
 *  - verifyWebhook(): verify the gateway's HMAC/signature on the raw body, store the event id for idempotency
 *  - on a verified "captured" event: insert a PaymentTransaction (kind PAYMENT, method RAZORPAY/…),
 *    update Order.amountPaid/paymentStatus and transitionOrder(…, "CONFIRMED") – the same path staff use.
 * The pre-existing Razorpay implementation is preserved in git history (baseline commit f1645a7).
 */
export interface PaymentGateway {
  name: string;
  createPayment(orderId: string): Promise<{ checkoutPayload: unknown }>;
  verifyWebhook(rawBody: string, signature: string): Promise<{ eventId: string; type: string; orderNumber: string; amountPaise: number } | null>;
}

export const gatewayEnabled = () => process.env.PAYMENT_GATEWAY_ENABLED === "true" && false; // no gateway implemented yet
