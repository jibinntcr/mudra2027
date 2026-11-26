import SelfPacedPlayerClient from '@/features/quiz/SelfPacedPlayerClient';

export const dynamic = 'force-dynamic';

export default async function SelfPacedAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <SelfPacedPlayerClient attemptId={attemptId} />;
}
