import { requireServerUser } from '@/features/auth/session';
import HostRoomClient from '@/features/quiz/HostRoomClient';

export const dynamic = 'force-dynamic';

export default async function AdminHostRoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  await requireServerUser({ requiredRole: 'admin', returnTo: '/admin?tab=quizzes' });
  const { roomCode } = await params;

  return <HostRoomClient roomCode={roomCode.toUpperCase()} />;
}
