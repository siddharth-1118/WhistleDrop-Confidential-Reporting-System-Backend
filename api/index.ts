import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import app from '../src/app';
import { prisma } from '../src/utils/db';
import bcrypt from 'bcrypt';

let isInitialized = false;

async function initDbIfNeeded() {
  if (isInitialized) return;

  try {
    // If running on Vercel serverless environment, set up SQLite in /tmp directory
    if (process.env.VERCEL) {
      const tmpDbPath = '/tmp/whistledrop.db';
      process.env.DATABASE_URL = `file:${tmpDbPath}`;

      if (!fs.existsSync(tmpDbPath)) {
        console.log('[Vercel Init] Initializing SQLite database in /tmp...');
        try {
          execSync('npx prisma db push --accept-data-loss', {
            env: { ...process.env, DATABASE_URL: `file:${tmpDbPath}` },
          });
          console.log('[Vercel Init] Schema pushed to /tmp/whistledrop.db');
        } catch (dbErr) {
          console.error('[Vercel DB Push Error]:', dbErr);
        }
      }
    }

    // Ensure initial moderator exists in database
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
      console.log(`[Vercel Init] Initial moderator '${username}' ready.`);
    }
    isInitialized = true;
  } catch (err) {
    console.error('[Vercel Init Warning]:', err);
  }
}

export default async function handler(req: any, res: any) {
  await initDbIfNeeded();
  return app(req, res);
}
