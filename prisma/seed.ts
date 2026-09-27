import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const username = process.env.MODERATOR_INIT_USERNAME || 'admin';
  const password = process.env.MODERATOR_INIT_PASSWORD || 'adminpassword123';

  const existing = await prisma.moderator.findUnique({
    where: { username },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.moderator.create({
      data: {
        username,
        passwordHash,
        role: 'MODERATOR',
      },
    });
    console.log(`[Seed] Initial moderator created: username='${username}'`);
  } else {
    console.log(`[Seed] Moderator '${username}' already exists.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
