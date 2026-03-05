import { handleWebhookRequest } from "@/lib/webhook";

export const runtime = "nodejs";

interface WebhookRouteContext {
  params: Promise<{ source: string }>;
}

export async function POST(request: Request, context: WebhookRouteContext) {
  const { source } = await context.params;
  return handleWebhookRequest(request, source);
}
