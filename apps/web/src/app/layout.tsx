import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FreshDocument } from "../components/fresh-document";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collections · nslinkhub",
  description: "Useful links, collected and shared.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <nav aria-label="Main navigation" className="shell">
            <a className="wordmark" href="/">
              nslinkhub
            </a>
            <a className="status-nav" href="/status">
              Service status
            </a>
          </nav>
        </header>
        <main id="main" aria-label="Main content" tabIndex={-1} className="shell">
          <FreshDocument />
          {children}
        </main>
      </body>
    </html>
  );
}
