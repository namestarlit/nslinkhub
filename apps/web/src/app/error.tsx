"use client";
import { Feedback } from "../components/feedback";
import { failure } from "../lib/http";
export default function ErrorPage() {
  return <Feedback error={failure()} />;
}
