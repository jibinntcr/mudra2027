import { getCollections } from '@/lib/db/client';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}

export async function checkLoginRateLimit(loginId: string, ipAddress: string): Promise<RateLimitResult> {
  const { rateLimits } = await getCollections();
  const now = new Date();
  const keys = [`login:id:${loginId.toLowerCase()}`, `login:ip:${ipAddress}`];

  const records = await rateLimits.find({ key: { $in: keys } }).toArray();

  for (const record of records) {
    if (record.lockedUntil && record.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }
  }

  let maxUsed = 0;
  for (const record of records) {
    if (now.getTime() - record.firstAttemptAt.getTime() < WINDOW_MS) {
      maxUsed = Math.max(maxUsed, record.attempts);
    }
  }

  return {
    allowed: true,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - maxUsed),
    retryAfterSeconds: 0,
  };
}

export async function recordFailedLoginAttempt(loginId: string, ipAddress: string): Promise<RateLimitResult> {
  const { rateLimits } = await getCollections();
  const now = new Date();
  const keys = [`login:id:${loginId.toLowerCase()}`, `login:ip:${ipAddress}`];

  let highestAttempts = 0;
  let lockedUntilDate: Date | undefined;

  for (const key of keys) {
    const existing = await rateLimits.findOne({ key });
    if (!existing || now.getTime() - existing.firstAttemptAt.getTime() >= WINDOW_MS) {
      await rateLimits.updateOne(
        { key },
        {
          $set: {
            attempts: 1,
            firstAttemptAt: now,
            updatedAt: now,
          },
          $unset: { lockedUntil: '' },
        },
        { upsert: true }
      );
      highestAttempts = Math.max(highestAttempts, 1);
    } else {
      const nextAttempts = existing.attempts + 1;
      const lockedUntil =
        nextAttempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MS) : undefined;
      await rateLimits.updateOne(
        { key },
        {
          $set: {
            attempts: nextAttempts,
            updatedAt: now,
            ...(lockedUntil ? { lockedUntil } : {}),
          },
        }
      );
      highestAttempts = Math.max(highestAttempts, nextAttempts);
      if (lockedUntil) lockedUntilDate = lockedUntil;
    }
  }

  const retryAfterSeconds = lockedUntilDate
    ? Math.ceil((lockedUntilDate.getTime() - now.getTime()) / 1000)
    : 0;

  return {
    allowed: highestAttempts < MAX_ATTEMPTS,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - highestAttempts),
    retryAfterSeconds,
  };
}

export async function clearLoginRateLimit(loginId: string, ipAddress: string): Promise<void> {
  const { rateLimits } = await getCollections();
  await rateLimits.deleteMany({
    key: { $in: [`login:id:${loginId.toLowerCase()}`, `login:ip:${ipAddress}`] },
  });
}
