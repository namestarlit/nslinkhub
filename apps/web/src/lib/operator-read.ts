import "server-only";
import { redirect } from "next/navigation";
import type { ApiPath } from "./http";
import { serverRead } from "./server-api";
export async function operatorRead<T>(path: ApiPath, returnTo: string) {
  const result = await serverRead<T>(path);
  if (!result.ok && result.status === 401)
    redirect(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  return result;
}
