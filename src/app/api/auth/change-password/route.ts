import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/db/client';
import { ChangePasswordSchema } from '@/lib/validation/schemas';
import {
  attachSessionCookie,
  createServerSession,
  hashPassword,
  requireApiUser,
  revokeAllUserSessions,
  verifyPassword,
} from '@/features/auth/session';

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { allowPendingPasswordChange: true });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid password input' },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    const { users } = await getCollections();
    const userObjId = new ObjectId(auth.user.userId);
    const userDoc = await users.findOne({ _id: userObjId });

    if (!userDoc || !userDoc.isActive) {
      return NextResponse.json({ error: 'Account not found or inactive' }, { status: 403 });
    }

    const validCurrent = await verifyPassword(currentPassword, userDoc.passwordHash);
    if (!validCurrent) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    const now = new Date();

    // Revoke previous sessions and increment sessionVersion
    await revokeAllUserSessions(userObjId);

    await users.updateOne(
      { _id: userObjId },
      {
        $set: {
          passwordHash: newHash,
          mustChangePassword: false,
          updatedAt: now,
        },
      }
    );

    const updatedUser = await users.findOne({ _id: userObjId });
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const { token, expiresAt } = await createServerSession({
      user: updatedUser!,
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json(
      { ok: true, message: 'Password updated successfully.' },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
    attachSessionCookie(response, token, expiresAt);
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update password' },
      { status: 500 }
    );
  }
}
