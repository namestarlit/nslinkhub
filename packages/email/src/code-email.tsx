import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  render,
  Section,
  Text,
} from "@react-email/components";

// Shared base for every code-bearing email (sign-in, email-change
// confirmation, new-email verification). One layout, decided visual
// direction: Substack-style minimal — lowercase nslinkhub text wordmark, one
// large letter-spaced code, validity line, one action button with a
// plain-link fallback (every code email carries BOTH the code and a direct
// verify link; either completes the flow), bold do-not-share warning, muted
// support footer. Neutral near-black palette until W3 brand tokens exist.

export interface CodeEmailBaseInput {
  /** Supported locales; copy ships English-first. */
  locale: "en";
  /** The one-time code better-auth minted. */
  code: string;
  /** Opaque, expiring direct action URL (https) — completes the same flow as the code. */
  actionUrl: string;
  /** Support route for unexpected-message recovery (https). */
  supportUrl: string;
  /** Validity window better-auth decided, in minutes (1–60). */
  expiresInMinutes: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const SUPPORTED_LOCALES = ["en"];
const CODE_RE = /^[0-9]{4,10}$/;

export function assertValidBaseInput(input: CodeEmailBaseInput): string[] {
  const errors: string[] = [];
  if (!SUPPORTED_LOCALES.includes(input.locale)) {
    errors.push(`unsupported locale "${input.locale}"`);
  }
  if (!CODE_RE.test(input.code)) {
    errors.push("code must be 4-10 digits");
  }
  for (const [name, url] of [
    ["actionUrl", input.actionUrl],
    ["supportUrl", input.supportUrl],
  ] as const) {
    if (!/^https:\/\//.test(url)) {
      errors.push(`${name} must be an https:// URL`);
    }
  }
  if (
    !Number.isInteger(input.expiresInMinutes) ||
    input.expiresInMinutes < 1 ||
    input.expiresInMinutes > 60
  ) {
    errors.push("expiresInMinutes must be an integer between 1 and 60");
  }
  return errors;
}

export function expiryPhrase(expiresInMinutes: number): string {
  return expiresInMinutes === 1 ? "1 minute" : `${expiresInMinutes} minutes`;
}

const styles = {
  body: {
    backgroundColor: "#ffffff",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    color: "#1a1a1a",
    margin: 0,
  },
  container: { maxWidth: "560px", margin: "0 auto", padding: "40px 24px" },
  wordmark: { fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 },
  lead: { fontSize: "16px", lineHeight: "24px", margin: "28px 0 0" },
  code: {
    fontSize: "32px",
    fontWeight: 600,
    letterSpacing: "0.35em",
    margin: "24px 0 0",
  },
  validity: { fontSize: "16px", lineHeight: "24px", color: "#1a1a1a", margin: "24px 0 0" },
  button: {
    backgroundColor: "#111827",
    borderRadius: "6px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 24px",
    textDecoration: "none",
    marginTop: "24px",
  },
  linkFallback: { fontSize: "13px", lineHeight: "20px", color: "#6b7280", margin: "16px 0 0" },
  note: { fontSize: "14px", lineHeight: "21px", color: "#6b7280", margin: "24px 0 0" },
  warning: { fontSize: "15px", lineHeight: "23px", fontWeight: 700, margin: "32px 0 0" },
  hr: { borderColor: "#e5e7eb", margin: "40px 0 16px" },
  footer: {
    fontSize: "12px",
    lineHeight: "18px",
    color: "#9ca3af",
    textAlign: "center" as const,
    margin: 0,
  },
} as const;

export interface CodeEmailCopy {
  /** Inbox preview line; never contains the code. */
  preview: string;
  /** The sentence introducing the code. */
  lead: string;
  /** Action button label. */
  actionLabel: string;
  /** Optional muted reassurance line, e.g. "ignore this and nothing changes". */
  note?: string;
}

export function CodeEmail({ input, copy }: { input: CodeEmailBaseInput; copy: CodeEmailCopy }) {
  return (
    <Html lang={input.locale}>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.wordmark}>nslinkhub</Text>
          <Text style={styles.lead}>{copy.lead}</Text>
          <Text style={styles.code}>{input.code}</Text>
          <Text style={styles.validity}>
            This code is only valid for the next {expiryPhrase(input.expiresInMinutes)}. If the code
            does not work, you can use this link instead:
          </Text>
          <Section>
            <Button href={input.actionUrl} style={styles.button}>
              {copy.actionLabel}
            </Button>
          </Section>
          <Text style={styles.linkFallback}>
            Or paste this link into your browser: {input.actionUrl}
          </Text>
          {copy.note ? <Text style={styles.note}>{copy.note}</Text> : null}
          <Text style={styles.warning}>
            Do not share this code with anyone. Do not forward this email. nslinkhub will never ask
            you for this code.
          </Text>
          <Hr style={styles.hr} />
          <Text style={styles.footer}>
            Didn't request this? {input.supportUrl}
            <br />
            nslinkhub — an ns series product
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderCodeEmail(
  subject: string,
  input: CodeEmailBaseInput,
  copy: CodeEmailCopy,
): Promise<RenderedEmail> {
  const element = <CodeEmail input={input} copy={copy} />;
  return {
    subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
