import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/features/auth/session';
import { joinOrReconnectLiveRoom } from '@/features/quiz/service';

/**
 * Public & Reader Live Room Join / Reconnect Endpoint
 * - Signed-in readers can use their account identity (`user.displayName` & `user.userId`).
 * - Guests enter a display name.
 * - Enforces room capacity (e.g., 100 players) and returns a clear `ROOM_FULL` 409 status when full,
 *   while allowing existing players to reconnect even when the room is full or mid-question.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const roomCode = String(body.roomCode || '').trim().toUpperCase();
    if (!roomCode) {
      return NextResponse.json(
        { error: 'Please enter a valid 6-character room code.' },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    const displayName =
      String(body.displayName || '').trim() ||
      (user ? user.displayName : '');
    const participantToken = body.participantToken
      ? String(body.participantToken)
      : null;
    const preferredLanguage =
      body.preferredLanguage === 'ml' ? 'ml' : 'en';

    const result = await joinOrReconnectLiveRoom({
      roomCode,
      displayName,
      participantToken,
      userId: user?.userId || null,
      loginId: user?.loginId || null,
      preferredLanguage,
    });

    return NextResponse.json(
      {
        ok: true,
        reconnected: result.reconnected,
        roomCode: result.room.roomCode,
        roomStatus: result.room.status,
        participant: {
          participantId: result.participant.participantId,
          participantToken: result.participant.participantToken,
          displayName: result.participant.displayName,
          isGuest: result.participant.isGuest,
          preferredLanguage: result.participant.preferredLanguage,
          totalPoints: result.participant.totalPoints,
          correctCount: result.participant.correctCount,
          currentStreak: result.participant.currentStreak,
        },
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const code = (err as { code?: string })?.code || 'JOIN_ERROR';
    return NextResponse.json(
      {
        error: (err as Error).message || 'Unable to join room.',
        code,
      },
      { status, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
