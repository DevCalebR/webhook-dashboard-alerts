function asBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function asInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: process.env.DATABASE_URL ?? "",
  adminEmail: process.env.ADMIN_EMAIL?.toLowerCase() ?? "admin@example.com",
  devBypassAuth: asBoolean(process.env.DEV_BYPASS_AUTH, false),
  webhookGenericSecret:
    process.env.WEBHOOK_GENERIC_SECRET ?? "dev_generic_secret",
  webhookStripeLikeSecret:
    process.env.WEBHOOK_STRIPE_LIKE_SECRET ?? "dev_stripe_like_secret",
  webhookAllowUnsignedGeneric: asBoolean(
    process.env.WEBHOOK_ALLOW_UNSIGNED_GENERIC,
    false,
  ),
  webhookRateLimitMax: asInteger(process.env.WEBHOOK_RATE_LIMIT_MAX, 60),
  webhookRateLimitWindowMs: asInteger(
    process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS,
    60_000,
  ),
  alertSlackWebhookUrl: process.env.ALERT_SLACK_WEBHOOK_URL ?? "",
};

export function isProduction(): boolean {
  return env.nodeEnv === "production";
}
