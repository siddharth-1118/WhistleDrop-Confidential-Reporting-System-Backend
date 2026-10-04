import app from '../src/app';
import { prisma } from '../src/utils/db';
import bcrypt from 'bcrypt';

let isInitialized = false;

async function initDbIfNeeded() {
  if (isInitialized) return;
  try {
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
      console.log(`[Vercel Init] Created initial moderator '${username}'`);
    }
    isInitialized = true;
  } catch (err) {
    console.error('[Vercel Init Error]:', err);
  }
}

export default async function handler(req: any, res: any) {
  await initDbIfNeeded();
  return app(req, res);
}
