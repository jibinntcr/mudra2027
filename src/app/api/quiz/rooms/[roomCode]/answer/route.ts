import { NextRequest, NextResponse } from 'next/server';
import { submitLiveRoomAnswer } from '@/features/quiz/service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await context.params;
    const body = await req.json();

    const participantToken = String(body.participantToken || '').trim();
    const questionIndex = Number(body.questionIndex);
    const selectedOptionId = String(body.selectedOptionId || '').trim();

    if (!participantToken || !Number.isInteger(questionIndex) || !selectedOptionId) {
      return NextResponse.json(
        { error: 'participantToken, questionIndex, and selectedOptionId are required.' },
        { status: 400 }
      );
    }

    const res = await submitLiveRoomAnswer({
      roomCode,
      participantToken,
      questionIndex,
      selectedOptionId,
    });

    return NextResponse.json(
      {
        ok: true,
        ...res,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' },
      }
    );
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode || 400;
    const code = (err as { code?: string })?.code || 'SUBMIT_ERROR';
    return NextResponse.json(
      {
        error: (err as Error).message || 'Could not submit answer.',
        code,
      },
      { status, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
