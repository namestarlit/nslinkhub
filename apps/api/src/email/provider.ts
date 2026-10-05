import type { DeliveryPayload } from "./outbox";

export interface EmailProvider {
  send(key: string, payload: DeliveryPayload, reference: string): Promise<string>;
}
export class DeliveryError extends Error {
  constructor(readonly terminal: boolean) {
    super("Email delivery failed");
  }
}
export class CaptureProvider implements EmailProvider {
  // Test/local inspection only. No HTTP endpoint or ordinary log exposes this.
  readonly messages = new Map<string, DeliveryPayload>();
  async send(key: string, payload: DeliveryPayload) {
    if (!this.messages.has(key)) this.messages.set(key, payload);
    if (this.messages.size > 100) {
      const oldest = this.messages.keys().next().value;
      if (oldest) this.messages.delete(oldest);
    }
    return `capture-${key}`;
  }
  clear() {
    this.messages.clear();
  }
}
export class ResendProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly transport: typeof fetch = fetch,
  ) {}
  async send(key: string, payload: DeliveryPayload, reference: string): Promise<string> {
    const response = await this.transport("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(5000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify({
        from: this.from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        tags: [{ name: "delivery_id", value: reference }],
      }),
    });
    if (!response.ok)
      throw new DeliveryError(
        response.status >= 400 &&
          response.status < 500 &&
          ![408, 409, 429].includes(response.status),
      );
    const result = (await response.json()) as { id?: unknown };
    if (typeof result.id !== "string" || result.id.length > 200) throw new DeliveryError(false);
    return result.id;
  }
}
