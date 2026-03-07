import Stripe from "stripe";
import { HttpError } from "../api/httpError";

let stripeClient: Stripe | null = null;

function readEnv(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw || null;
}

function throwMissingBillingConfig(missing: string[]): never {
  throw new HttpError(
    503,
    "BILLING_NOT_CONFIGURED",
    "Billing is not configured for this environment.",
    { missingEnvVars: missing }
  );
}

export function getStripeClient(): Stripe {
  const secretKey = readEnv("STRIPE_SECRET_KEY");
  if (!secretKey) {
    throwMissingBillingConfig(["STRIPE_SECRET_KEY"]);
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

export function getStripePlusPriceId(): string {
  const plusPriceId = readEnv("STRIPE_PLUS_PRICE_ID");
  if (!plusPriceId) {
    throwMissingBillingConfig(["STRIPE_PLUS_PRICE_ID"]);
  }
  return plusPriceId;
}

export function getStripeWebhookSecret(): string {
  const webhookSecret = readEnv("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    throwMissingBillingConfig(["STRIPE_WEBHOOK_SECRET"]);
  }
  return webhookSecret;
}

export function resolveBillingAppOrigin(req: Request): string {
  const configured = readEnv("NEXT_PUBLIC_APP_URL");
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      console.warn("Invalid NEXT_PUBLIC_APP_URL for billing routes; using request origin.");
    }
  }
  return new URL(req.url).origin;
}
