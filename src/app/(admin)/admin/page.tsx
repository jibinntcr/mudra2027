import { requireServerUser } from '@/features/auth/session';
import { getCollections } from '@/lib/db/client';
import AdminDashboardClient from '@/features/admin/AdminDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireServerUser({ requiredRole: 'admin', returnTo: '/admin' });
  const sp = await searchParams;

  const { users, documents, categories } = await getCollections();
  const [
    totalUsers,
    activeReaders,
    totalDocuments,
    publishedDocuments,
    textPdfs,
    scannedPdfs,
    totalCategories,
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({ role: 'reader', isActive: true }),
    documents.countDocuments(),
    documents.countDocuments({ isPublished: true }),
    documents.countDocuments({ hasTextLayer: true }),
    documents.countDocuments({ hasTextLayer: false }),
    categories.countDocuments(),
  ]);

  return (
    <AdminDashboardClient
      initialTab={sp.tab || 'users'}
      stats={{
        totalUsers,
        activeReaders,
        totalDocuments,
        publishedDocuments,
        textPdfs,
        scannedPdfs,
        totalCategories,
      }}
    />
  );
}
