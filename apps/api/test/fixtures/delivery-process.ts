import { PrismaPg } from "@prisma/adapter-pg";
import { EmailDelivery } from "../../src/email/delivery";
import { PrismaClient } from "../../src/generated/prisma/client";

async function main() {
  const input = JSON.parse(await Bun.stdin.text());
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  await new EmailDelivery(
    prisma,
    {
      send: async () => {
        process.stdout.write("claimed\n");
        await new Promise(() => {});
        return "unreachable";
      },
    },
    input.secret,
  ).deliver(input.id);
}
void main();
