import type { Metadata } from "next";
import { InvitationEntry } from "../../../components/invitation-entry";
export const metadata: Metadata = { title: "Check your inbox" };
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <section className="reader account-flow">
      <h1>Check your inbox</h1>
      <InvitationEntry />
    </section>
  );
}
