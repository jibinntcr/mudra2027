import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCollections } from '@/lib/db/client';
import {
  CreateAccountSchema,
  UpdateAccountActionSchema,
} from '@/lib/validation/schemas';
import {
  hashPassword,
  requireApiUser,
  revokeAllUserSessions,
} from '@/features/auth/session';

export async function GET(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '15', 10) || 15));
  const skip = (page - 1) * limit;

  const { users } = await getCollections();
  const [total, rawUsers] = await Promise.all([
    users.countDocuments(),
    users
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  return NextResponse.json(
    {
      items: rawUsers.map((u) => ({
        userId: u._id!.toHexString(),
        loginId: u.loginId,
        displayName: u.displayName,
        role: u.role,
        isActive: u.isActive,
        mustChangePassword: u.mustChangePassword,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
    }
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const parsed = CreateAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid account payload' },
        { status: 400 }
      );
    }

    const { loginId, displayName, role, temporaryPassword } = parsed.data;
    const { users } = await getCollections();

    const existing = await users.findOne({ loginId });
    if (existing) {
      return NextResponse.json(
        { error: `An account with Login ID "${loginId}" already exists.` },
        { status: 409 }
      );
    }

    const now = new Date();
    const passwordHash = await hashPassword(temporaryPassword);

    const insertRes = await users.insertOne({
      loginId,
      displayName,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: true, // Always require password change on first login
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.user.loginId,
    });

    return NextResponse.json(
      {
        ok: true,
        user: {
          userId: insertRes.insertedId.toHexString(),
          loginId,
          displayName,
          role,
          isActive: true,
          mustChangePassword: true,
        },
      },
      {
        status: 201,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireApiUser(req, { requiredRole: 'admin' });
  if ('errorResponse' in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const parsed = UpdateAccountActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid account update payload' },
        { status: 400 }
      );
    }

    const { users } = await getCollections();
    const targetId = new ObjectId(parsed.data.userId);
    const targetUser = await users.findOne({ _id: targetId });
    if (!targetUser) {
      return NextResponse.json({ error: 'Target account not found' }, { status: 404 });
    }

    const now = new Date();

    if (parsed.data.action === 'toggle_active') {
      if (targetUser._id!.toHexString() === auth.user.userId && !parsed.data.isActive) {
        return NextResponse.json(
          { error: 'You cannot deactivate your own active admin account.' },
          { status: 400 }
        );
      }

      // Immediately revoke all existing sessions when deactivating an account
      await revokeAllUserSessions(targetId);
      await users.updateOne(
        { _id: targetId },
        {
          $set: {
            isActive: parsed.data.isActive,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json(
        {
          ok: true,
          message: parsed.data.isActive
            ? `Account ${targetUser.loginId} reactivated.`
            : `Account ${targetUser.loginId} deactivated and all active sessions revoked.`,
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'private, no-store' },
        }
      );
    }

    if (parsed.data.action === 'reset_password') {
      const passwordHash = await hashPassword(parsed.data.temporaryPassword);
      // Revoke existing sessions and require password change on next sign-in
      await revokeAllUserSessions(targetId);
      await users.updateOne(
        { _id: targetId },
        {
          $set: {
            passwordHash,
            mustChangePassword: true,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json(
        {
          ok: true,
          message: `Temporary password issued for ${targetUser.loginId}. User must change password on next sign-in.`,
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'private, no-store' },
        }
      );
    }

    if (parsed.data.action === 'change_role') {
      await revokeAllUserSessions(targetId);
      await users.updateOne(
        { _id: targetId },
        {
          $set: {
            role: parsed.data.role,
            updatedAt: now,
          },
        }
      );

      return NextResponse.json(
        {
          ok: true,
          message: `Role updated to ${parsed.data.role} for ${targetUser.loginId}.`,
        },
        {
          status: 200,
          headers: { 'Cache-Control': 'private, no-store' },
        }
      );
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || 'Failed to update account' },
      { status: 500 }
    );
  }
}
