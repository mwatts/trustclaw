import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function migrate() {
  const messages = await prisma.message.findMany({
    where: { role: "assistant" },
    select: { id: true, content: true },
  });

  let updated = 0;
  for (const msg of messages) {
    const content = msg.content as Array<Record<string, unknown>>;
    if (!Array.isArray(content)) continue;

    let changed = false;
    const newContent = content.map((part) => {
      if (part.type === "dynamic-tool" && typeof part.toolName === "string") {
        changed = true;
        return { ...part, type: `tool-${part.toolName}` };
      }
      return part;
    });

    if (changed) {
      await prisma.message.update({
        where: { id: msg.id },
        data: { content: newContent as Parameters<typeof prisma.message.update>[0]["data"]["content"] },
      });
      updated++;
    }
  }

  console.log(`Migrated ${updated} messages`);
}

migrate().then(() => prisma.$disconnect());
