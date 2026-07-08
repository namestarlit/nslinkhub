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

// Template inputs follow the transactional-email doc: the minimum variable
// set, no recipient address, opaque expiring URLs only. The subject never
// carries the code (subjects stay free of sensitive data).
export interface LoginCodeEmailInput {
  /** Supported locales; copy ships English-first. */
  locale: "en";
  /** The one-time sign-in code better-auth minted. */
  code: string;
  /** Opaque, expiring fallback sign-in URL (https). */
  signInUrl: string;
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

function assertValidInput(input: LoginCodeEmailInput): void {
  const errors: string[] = [];
  if (!SUPPORTED_LOCALES.includes(input.locale)) {
    errors.push(`unsupported locale "${input.locale}"`);
  }
  if (!CODE_RE.test(input.code)) {
    errors.push("code must be 4-10 digits");
  }
  for (const [name, url] of [
    ["signInUrl", input.signInUrl],
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
  if (errors.length > 0) {
    throw new Error(`Invalid login-code email input: ${errors.join("; ")}`);
  }
}

// Visual direction: Substack-style minimal transactional layout — wordmark,
// one large spaced code, one button, one bold warning, muted footer. Neutral
// near-black palette until the product brand tokens exist (the web Tailwind
// theme is not an email rendering contract).
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

function LoginCodeEmail(input: LoginCodeEmailInput) {
  const minutes = input.expiresInMinutes === 1 ? "1 minute" : `${input.expiresInMinutes} minutes`;
  return (
    <Html lang={input.locale}>
      <Head />
      <Preview>Your nslinkhub sign-in code</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.wordmark}>nslinkhub</Text>
          <Text style={styles.lead}>Here's your verification code to sign in to nslinkhub:</Text>
          <Text style={styles.code}>{input.code}</Text>
          <Text style={styles.validity}>
            This code is only valid for the next {minutes}. If the code does not work, you can sign
            in with this link instead:
          </Text>
          <Section>
            <Button href={input.signInUrl} style={styles.button}>
              Sign in
            </Button>
          </Section>
          <Text style={styles.linkFallback}>
            Or paste this link into your browser: {input.signInUrl}
          </Text>
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

export async function renderLoginCode(input: LoginCodeEmailInput): Promise<RenderedEmail> {
  assertValidInput(input);
  const element = <LoginCodeEmail {...input} />;
  return {
    // The subject deliberately never contains the code.
    subject: "Your nslinkhub sign-in code",
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}
