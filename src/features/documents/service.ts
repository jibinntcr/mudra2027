import { getCollections } from '@/lib/db/client';
import type { CategoryDocument, LibraryDocument } from '@/lib/db/types';

export async function getDocumentBySlugOrId(
  identifier: string,
  includeUnpublished = false
): Promise<{
  document: LibraryDocument | null;
  categories: CategoryDocument[];
  relatedDocuments: LibraryDocument[];
}> {
  const { documents, categories } = await getCollections();
  const baseFilter = includeUnpublished ? {} : { isPublished: true };

  const document = await documents.findOne({
    ...baseFilter,
    $or: [{ slug: identifier }, { docId: identifier }],
  });

  if (!document) {
    return { document: null, categories: [], relatedDocuments: [] };
  }

  const [docCategories, relatedDocuments] = await Promise.all([
    categories
      .find({
        slug: { $in: document.categorySlugs },
        ...(includeUnpublished ? {} : { isPublished: true }),
      })
      .sort({ order: 1 })
      .toArray(),
    documents
      .find(
        {
          ...baseFilter,
          docId: { $ne: document.docId },
          categorySlugs: { $in: document.categorySlugs },
        },
        { projection: { extractedText: 0 } }
      )
      .sort({ year: -1, createdAt: -1 })
      .limit(5)
      .toArray(),
  ]);

  return {
    document,
    categories: docCategories,
    relatedDocuments,
  };
}
