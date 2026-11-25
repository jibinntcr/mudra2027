import { getCollections } from '@/lib/db/client';
import type { CategoryDocument } from '@/lib/db/types';

export interface CategoryTreeNode extends CategoryDocument {
  documentCount: number;
  children: CategoryTreeNode[];
}

export async function getCategoryTree(includeUnpublished = false): Promise<CategoryTreeNode[]> {
  const { categories, documents } = await getCollections();
  const catFilter = includeUnpublished ? {} : { isPublished: true };
  const docFilter = includeUnpublished ? {} : { isPublished: true };

  const [allCategories, countsAgg] = await Promise.all([
    categories.find(catFilter).sort({ order: 1, nameEn: 1 }).toArray(),
    documents
      .aggregate<{ _id: string; count: number }>([
        { $match: docFilter },
        { $unwind: '$categorySlugs' },
        { $group: { _id: '$categorySlugs', count: { $sum: 1 } } },
      ])
      .toArray(),
  ]);

  const countMap = new Map<string, number>();
  for (const row of countsAgg) {
    countMap.set(row._id, row.count);
  }

  const nodeMap = new Map<string, CategoryTreeNode>();
  for (const cat of allCategories) {
    nodeMap.set(cat.slug, {
      ...cat,
      documentCount: countMap.get(cat.slug) || 0,
      children: [],
    });
  }

  const roots: CategoryTreeNode[] = [];
  for (const node of nodeMap.values()) {
    if (node.parentSlug && nodeMap.has(node.parentSlug)) {
      const parent = nodeMap.get(node.parentSlug)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function getCategoryBySlug(
  slug: string,
  includeUnpublished = false
): Promise<{
  category: CategoryDocument | null;
  subcategories: Array<CategoryDocument & { documentCount: number }>;
  parent: CategoryDocument | null;
}> {
  const { categories, documents } = await getCollections();
  const filter = includeUnpublished ? { slug } : { slug, isPublished: true };
  const category = await categories.findOne(filter);
  if (!category) {
    return { category: null, subcategories: [], parent: null };
  }

  const childFilter = includeUnpublished
    ? { parentSlug: slug }
    : { parentSlug: slug, isPublished: true };

  const [rawChildren, parent] = await Promise.all([
    categories.find(childFilter).sort({ order: 1, nameEn: 1 }).toArray(),
    category.parentSlug ? categories.findOne({ slug: category.parentSlug }) : Promise.resolve(null),
  ]);

  const childSlugs = rawChildren.map((c) => c.slug);
  const countsAgg =
    childSlugs.length > 0
      ? await documents
          .aggregate<{ _id: string; count: number }>([
            {
              $match: {
                ...(includeUnpublished ? {} : { isPublished: true }),
                categorySlugs: { $in: childSlugs },
              },
            },
            { $unwind: '$categorySlugs' },
            { $match: { categorySlugs: { $in: childSlugs } } },
            { $group: { _id: '$categorySlugs', count: { $sum: 1 } } },
          ])
          .toArray()
      : [];

  const countMap = new Map(countsAgg.map((r) => [r._id, r.count]));
  const subcategories = rawChildren.map((c) => ({
    ...c,
    documentCount: countMap.get(c.slug) || 0,
  }));

  return { category, subcategories, parent };
}
