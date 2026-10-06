// Ask Bun in the API's working directory so its .env, .env.development and
// .env.local precedence matches the child. Print only the port, never its env.
export async function resolveApiPort(cwd = "apps/api", env = process.env): Promise<number> {
  const child = Bun.spawn(["bun", "--print", 'process.env.PORT ?? "4000"'], {
    cwd,
    env: { ...env, NODE_ENV: "development" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const value = (await new Response(child.stdout).text()).trim();
  if ((await child.exited) !== 0) throw new Error("Could not resolve API development port");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid API development port");
  return port;
}
