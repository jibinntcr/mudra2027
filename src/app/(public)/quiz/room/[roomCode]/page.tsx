import LiveRoomPlayerClient from '@/features/quiz/LiveRoomPlayerClient';

export const dynamic = 'force-dynamic';

export default async function PublicLiveRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <LiveRoomPlayerClient roomCode={roomCode.toUpperCase()} />;
}
