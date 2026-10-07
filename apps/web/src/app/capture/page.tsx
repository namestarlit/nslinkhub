import type { Metadata } from "next";
import { CaptureForm } from "../../components/capture-form";
export const metadata: Metadata = { title: "Save a link" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CaptureForm query={await searchParams} />;
}
