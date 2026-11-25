/**
 * Eaadharam-inspired Category Hierarchy & Source Page Inventory
 * Covers the Eaadharam category structure (https://www.eaadharam.in/2020/07/home-eaadharam_5.html):
 * - LRC Orders (Sale, Settlement, Release, Partition, Gift, Rectification, Lease, Miscellaneous)
 * - Registration (Document Registration, Stamp Duty & Reg Fee, Fair Value, Court Orders, Licence & Marriage)
 * - Service Matters (GOs & Circulars, Pay Revision & DA, GPF & SPARK, Leave & Pension)
 * - Acts, Rules & Downloads (Acts & Rules, Manuals & Forms)
 */

export interface SourceCategorySpec {
  slug: string;
  nameEn: string;
  nameMl: string;
  description: string;
  parentSlug: string | null;
  ancestors: string[];
  pathLabel: string;
  order: number;
  sourceUrl?: string;
  maxItemsToImport?: number;
}

export const EAADHARAM_CATEGORY_INVENTORY: SourceCategorySpec[] = [
  // Top-level 1: LRC Orders
  {
    slug: 'lrc-orders',
    nameEn: 'LRC Orders',
    nameMl: 'എൽ.ആർ.സി ഉത്തരവുകൾ (LRC Orders)',
    description:
      'Land Revenue Commissioner and Inspector General of Registration appellate orders on stamp duty, classification, and registration.',
    parentSlug: null,
    ancestors: [],
    pathLabel: 'LRC Orders',
    order: 1,
    sourceUrl: 'https://www.eaadharam.in/2020/07/home-eaadharam_5.html',
  },
  {
    slug: 'lrc-orders-sale',
    nameEn: 'Sale',
    nameMl: 'തീറാധാരം (Sale)',
    description: 'LRC and IGR orders relating to Sale Deeds, property classification, road access, and consideration.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Sale',
    order: 1,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-sale-order-no-and-date-lra3.html',
    maxItemsToImport: 8,
  },
  {
    slug: 'lrc-orders-settlement',
    nameEn: 'Settlement',
    nameMl: 'ധനനിശ്ചയാധാരം (Settlement)',
    description: 'LRC and IGR orders on family settlement deeds, Article 51(a) stamp duty concessions, and cancellations.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Settlement',
    order: 2,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-settlement-rr.html',
    maxItemsToImport: 6,
  },
  {
    slug: 'lrc-orders-release',
    nameEn: 'Release',
    nameMl: 'ഒഴിമുറി (Release)',
    description: 'Orders governing release deeds among co-owners, legal heirs, and mortgage releases.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Release',
    order: 3,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-release-lra3.html',
    maxItemsToImport: 4,
  },
  {
    slug: 'lrc-orders-partition',
    nameEn: 'Partition',
    nameMl: 'ഭാഗപത്രം (Partition)',
    description: 'Orders governing partition deeds, family definition under Kerala Stamp Act, and co-ownership.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Partition',
    order: 4,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-sale-lra3.html',
    maxItemsToImport: 4,
  },
  {
    slug: 'lrc-orders-gift',
    nameEn: 'Gift',
    nameMl: 'ഇഷ്ടദാനം (Gift)',
    description: 'Orders relating to Gift deeds, public purpose gift exemptions, and valuation.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Gift',
    order: 5,
    sourceUrl: 'https://www.eaadharam.in/p/lrcorders-gift-lra3.html',
    maxItemsToImport: 3,
  },
  {
    slug: 'lrc-orders-rectification',
    nameEn: 'Rectification',
    nameMl: 'പിഴതിരുത്തൽ ആധാരം (Rectification)',
    description: 'Orders distinguishing rectification deeds from fresh conveyances when survey numbers or boundaries change.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Rectification',
    order: 6,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-rectification-lra3.html',
    maxItemsToImport: 3,
  },
  {
    slug: 'lrc-orders-lease',
    nameEn: 'Lease',
    nameMl: 'പാട്ടച്ചീട്ട് (Lease)',
    description: 'Orders on lease agreements, security deposits, rent calculation, and surrender of lease.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Lease',
    order: 7,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-lease-lra3.html',
    maxItemsToImport: 2,
  },
  {
    slug: 'lrc-orders-miscellaneous',
    nameEn: 'Miscellaneous',
    nameMl: 'മറ്റു ഉത്തരവുകൾ (Miscellaneous)',
    description: 'General LRC & IGR rulings on powers of attorney, agreements, and special stamp duty adjudications.',
    parentSlug: 'lrc-orders',
    ancestors: ['lrc-orders'],
    pathLabel: 'LRC Orders → Miscellaneous',
    order: 8,
    sourceUrl: 'https://www.eaadharam.in/p/lrc-orders-miscellaneous-m.html',
    maxItemsToImport: 2,
  },

  // Top-level 2: Registration
  {
    slug: 'registration',
    nameEn: 'Registration',
    nameMl: 'രജിസ്ട്രേഷൻ (Registration)',
    description: 'Kerala Registration Department circulars, stamp duty notifications, fair value orders, and court judgments.',
    parentSlug: null,
    ancestors: [],
    pathLabel: 'Registration',
    order: 2,
  },
  {
    slug: 'registration-stamp-duty',
    nameEn: 'SD and Reg. Fee',
    nameMl: 'മുദ്രവിലയും രജിസ്ട്രേഷൻ ഫീസും (SD & Reg. Fee)',
    description: 'Kerala Stamp Act 1959 schedules, stamp duty exemptions, and registration fee table circulars.',
    parentSlug: 'registration',
    ancestors: ['registration'],
    pathLabel: 'Registration → SD and Reg. Fee',
    order: 1,
    sourceUrl: 'https://www.eaadharam.in/p/kerala-stamp-act-1959-kerala-stamp-act.html',
    maxItemsToImport: 3,
  },
  {
    slug: 'registration-fair-value',
    nameEn: 'UV / Fair Value',
    nameMl: 'ന്യായവില ഉത്തരവുകൾ (UV / Fair Value)',
    description: 'Fair value notifications, percentage revision orders, and undervaluation adjudication guidelines.',
    parentSlug: 'registration',
    ancestors: ['registration'],
    pathLabel: 'Registration → UV / Fair Value',
    order: 2,
    sourceUrl: 'https://www.eaadharam.in/p/blog-page_5.html',
    maxItemsToImport: 2,
  },
  {
    slug: 'registration-court-orders',
    nameEn: 'Court Orders',
    nameMl: 'കോടതി ഉത്തരവുകൾ (Court Orders)',
    description: 'High Court and Supreme Court judgments relating to document registration, attachments, and stamp duty.',
    parentSlug: 'registration',
    ancestors: ['registration'],
    pathLabel: 'Registration → Court Orders',
    order: 3,
    sourceUrl: 'https://www.eaadharam.in/p/blog-page_1.html',
    maxItemsToImport: 2,
  },

  // Top-level 3: Service Matters
  {
    slug: 'service-matters',
    nameEn: 'Service Matters',
    nameMl: 'സർവീസ് വിഷയങ്ങൾ (Service Matters)',
    description: 'Government orders, circulars, pay revision, DA orders, GPF, SPARK, and pension rules for Kerala Government employees.',
    parentSlug: null,
    ancestors: [],
    pathLabel: 'Service Matters',
    order: 3,
  },
  {
    slug: 'service-gos-circulars',
    nameEn: 'GOs and Circulars',
    nameMl: 'സർക്കാർ ഉത്തരവുകളും സർക്കുലറുകളും',
    description: 'General establishment government orders and departmental service circulars.',
    parentSlug: 'service-matters',
    ancestors: ['service-matters'],
    pathLabel: 'Service Matters → GOs and Circulars',
    order: 1,
    sourceUrl: 'https://www.eaadharam.in/p/blog-page_13.html',
    maxItemsToImport: 2,
  },
  {
    slug: 'service-pay-revision',
    nameEn: 'Pay Revision & DA',
    nameMl: 'ശമ്പള പരിഷ്കരണം & ഡി.എ ഉത്തരവുകൾ',
    description: 'Pay Revision Government Orders, Master Scale tables, and Dearness Allowance statements.',
    parentSlug: 'service-matters',
    ancestors: ['service-matters'],
    pathLabel: 'Service Matters → Pay Revision & DA',
    order: 2,
    sourceUrl: 'https://www.eaadharam.in/p/pay-revision-g.html',
    maxItemsToImport: 2,
  },

  // Top-level 4: Acts, Rules & Downloads
  {
    slug: 'acts-and-rules',
    nameEn: 'Acts & Rules',
    nameMl: 'നിയമങ്ങളും ചട്ടങ്ങളും (Acts & Rules)',
    description: 'Registration Act 1908, Kerala Stamp Act 1959, Special Marriage Act, RTI Act, and statutory amendment rules.',
    parentSlug: null,
    ancestors: [],
    pathLabel: 'Acts & Rules',
    order: 4,
  },
  {
    slug: 'acts-statutory-rules',
    nameEn: 'Statutory Acts & Amendments',
    nameMl: 'നിയമ ഭേദഗതികളും ചട്ടങ്ങളും',
    description: 'Consolidated acts, filing of true copies amendment rules, and statutory manuals.',
    parentSlug: 'acts-and-rules',
    ancestors: ['acts-and-rules'],
    pathLabel: 'Acts & Rules → Statutory Acts & Amendments',
    order: 1,
    sourceUrl: 'https://www.eaadharam.in/p/act-and-rules-appartment-ownership-act.html',
    maxItemsToImport: 2,
  },
];
