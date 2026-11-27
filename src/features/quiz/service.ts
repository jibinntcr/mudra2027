import crypto from 'crypto';
import { getCollections } from '@/lib/db/client';
import { slugify } from '@/lib/validation/normalize';
import aadharamEzhuthu100Mcqs from './aadharam-ezhuthu-100-mcqs.json';
import type {
  QuizDocument,
  QuizVersionDocument,
  QuizRoomDocument,
  QuizParticipantDocument,
  QuizQuestionItem,
  QuizScoringRules,
  LinkedDocumentRef,
} from '@/lib/db/types';
import {
  DEFAULT_SCORING_RULES,
  calculateQuestionScore,
  rankParticipants,
} from './scoring';

/**
 * Resolves linked Mudra PDF documents for each question so fixed quiz versions
 * carry an immutable snapshot of the linked document metadata.
 */
export async function hydrateQuestionLinkedDocs(
  questions: QuizQuestionItem[]
): Promise<QuizQuestionItem[]> {
  const { documents } = await getCollections();
  const docRefs = questions
    .map((q) => (q.linkedDocId || '').trim())
    .filter(Boolean);

  const docMap = new Map<string, LinkedDocumentRef>();
  if (docRefs.length > 0) {
    const foundDocs = await documents
      .find(
        {
          $or: [
            { docId: { $in: docRefs } },
            { slug: { $in: docRefs } },
            { documentNumber: { $in: docRefs } },
          ],
        },
        {
          projection: {
            docId: 1,
            slug: 1,
            documentNumber: 1,
            titleEn: 1,
            titleMl: 1,
          },
        }
      )
      .toArray();

    for (const d of foundDocs) {
      const ref: LinkedDocumentRef = {
        docId: d.docId,
        slug: d.slug,
        documentNumber: d.documentNumber,
        titleEn: d.titleEn,
        titleMl: d.titleMl,
      };
      docMap.set(d.docId, ref);
      docMap.set(d.slug, ref);
      docMap.set(d.documentNumber, ref);
    }
  }

  return questions.map((q, idx) => {
    const refKey = (q.linkedDocId || '').trim();
    const resolved = refKey ? docMap.get(refKey) || q.linkedDocSnapshot || null : null;
    return {
      ...q,
      questionId: q.questionId || `Q-${idx + 1}`,
      order: idx + 1,
      linkedDocId: resolved?.docId || (refKey || null),
      linkedDocSnapshot: resolved,
    };
  });
}

/**
 * Ensures the fixed `QuizVersionDocument` exists in `quiz_versions` for a quiz's current version.
 * Called whenever a quiz is published, a live room opens, or a self-paced attempt starts.
 * Later edits to the quiz increment `currentVersion`, leaving existing versions untouched.
 */
export async function ensureFixedQuizVersion(
  quiz: QuizDocument
): Promise<QuizVersionDocument> {
  const { quizVersions } = await getCollections();
  const versionId = `${quiz.quizId}-v${quiz.currentVersion}`;
  const existing = await quizVersions.findOne({ versionId });
  if (existing) {
    return existing;
  }

  const hydratedQuestions = await hydrateQuestionLinkedDocs(quiz.questions);
  const versionDoc: QuizVersionDocument = {
    versionId,
    quizId: quiz.quizId,
    version: quiz.currentVersion,
    categorySlug: quiz.categorySlug,
    categoryNameEn: quiz.categoryNameEn,
    categoryNameMl: quiz.categoryNameMl,
    topicEn: quiz.topicEn,
    topicMl: quiz.topicMl,
    titleEn: quiz.titleEn,
    titleMl: quiz.titleMl,
    descriptionEn: quiz.descriptionEn,
    descriptionMl: quiz.descriptionMl,
    defaultTimeSeconds: quiz.defaultTimeSeconds || 20,
    defaultRevealSeconds: quiz.defaultRevealSeconds || 6,
    scoringRules: { ...DEFAULT_SCORING_RULES, ...(quiz.scoringRules || {}) },
    questions: hydratedQuestions,
    createdAt: new Date(),
  };

  try {
    await quizVersions.insertOne(versionDoc);
  } catch {
    const concurrent = await quizVersions.findOne({ versionId });
    if (concurrent) return concurrent;
  }

  return versionDoc;
}

/**
 * Seeds the flagship bilingual Mudra Quizzes AND the 100-question "Aadharam Ezhuthu Exam (Deed Writing)"
 * full exam + 5 topic quizzes from `aadharam-ezhuthu-100-mcqs.json`, plus category & demo rooms.
 */
export async function ensureDefaultPublishedQuiz(): Promise<void> {
  const { quizzes, quizRooms, categories } = await getCollections();
  const now = new Date();

  // 1. Ensure the "Aadharam Ezhuthu Exam" category exists in `categories`
  const existingCat = await categories.findOne({ slug: 'aadharam-ezhuthu-exam' });
  if (!existingCat) {
    await categories
      .insertOne({
        slug: 'aadharam-ezhuthu-exam',
        nameEn: 'Aadharam Ezhuthu Exam (Deed Writing)',
        nameMl: 'ആധാരമെഴുത്ത് ലൈസൻസ് പരീക്ഷ',
        description:
          'Kerala Document Writers’ Licensing Exam (ആധാരമെഴുത്ത് പരീക്ഷ) — Registration Act 1908, Kerala Stamp Act 1959, Document Writers’ Licence Rules 1960, Transfer of Property Act 1882 & PEARL SOPs.',
        parentSlug: null,
        ancestors: [],
        pathLabel: 'Aadharam Ezhuthu Exam (ആധാരമെഴുത്ത് പരീക്ഷ)',
        order: 9,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      })
      .catch(() => {});
  }

  // 2. Ensure the initial 4-question LRC & IGR Orders Quiz exists
  const existingQ1 = await quizzes.findOne({ quizId: 'QUIZ-2026-0001' });
  if (!existingQ1) {
    const initialQuestions: QuizQuestionItem[] = [
      {
        questionId: 'Q-STAMP-25',
        order: 1,
        type: 'single_choice',
        promptEn:
          'Under Section 25 of the Kerala Stamp Act (Order IGR/5897/2024-RR2), when a property is sold subject to a mortgage, which amounts are added to the sale consideration for stamp duty calculation?',
        promptMl:
          'കൈമാറ്റ ആധാരങ്ങളിൽ പണയ ബാദ്ധ്യത സംബന്ധിച്ച വിവരം ചേർത്തിട്ടുള്ള സാഹചര്യത്തിൽ (IGR/5897/2024-RR2), സ്റ്റാമ്പ് ഡ്യൂട്ടി നിർണ്ണയത്തിനായി വകുപ്പ് 25 പ്രകാരം പ്രതിഫലത്തിനൊപ്പം ചേർക്കേണ്ട തുകകൾ ഏവ?',
        options: [
          {
            optionId: 'A',
            textEn: 'Only unpaid mortgage money and unpaid interest',
            textMl: 'Unpaid mortgage money, unpaid interest എന്നീ തുകകൾ മാത്രം',
          },
          {
            optionId: 'B',
            textEn: 'Entire original sanctioned loan amount regardless of repayment',
            textMl: 'തിരിച്ചടവ് പരിഗണിക്കാതെ മൊത്തം പണയ വായ്പാ തുക മുഴുവൻ',
          },
          {
            optionId: 'C',
            textEn: 'Future interest for the remaining tenure of the loan',
            textMl: 'വായ്പയുടെ വരാനിരിക്കുന്ന കാലയളവിലെ മുഴുവൻ പലിശയും',
          },
          {
            optionId: 'D',
            textEn: 'No mortgage liability is ever considered under Section 25',
            textMl: 'വകുപ്പ് 25 പ്രകാരം പണയ ബാദ്ധ്യത ഒരിക്കലും കണക്കാക്കേണ്ടതില്ല',
          },
        ],
        correctOptionId: 'A',
        explanationEn:
          'Order IGR/5897/2024-RR2 dated 24/02/2025 clarifies that only unpaid mortgage principal and unpaid interest as on the date of execution shall be added to consideration under Section 25 of the Kerala Stamp Act.',
        explanationMl:
          'IGR/5897/2024-RR2 (തീയതി 24/02/2025) ഉത്തരവ് പ്രകാരം കൈമാറ്റ ആധാരങ്ങളിൽ പണയ ബാദ്ധ്യത ചേർത്തിട്ടുള്ളപ്പോൾ Unpaid mortgage money, unpaid interest എന്നീ തുകകൾ മാത്രമേ വകുപ്പ് 25 പ്രകാരം പ്രതിഫലത്തിനൊപ്പം ചേർക്കേണ്ടതുള്ളൂ.',
        timeLimitSeconds: 25,
        linkedDocId: 'DOC-2025-0001',
      },
      {
        questionId: 'Q-NILAM-PURAYIDAM',
        order: 2,
        type: 'true_false',
        promptEn:
          'If a property was described as "Nilam" in the prior title deed and is now recorded as "Purayidam", excess stamp duty must be levied at registration (Order LR/3322/2022-LR(A3)).',
        promptMl:
          'രജിസ്ട്രേഷനായി ഹാജരാക്കിയ ആധാരത്തിന്റെ മുന്നാധാരത്തിൽ വസ്തുവിന്റെ തരം "നിലം" എന്നും ഇപ്പോൾ "പുരയിടം" എന്നും രേഖപ്പെടുത്തിയിട്ടുണ്ടെങ്കിൽ അധിക മുദ്രവില ഈടാക്കേണ്ടതാണ് (LR/3322/2022-LR(A3)).',
        options: [
          {
            optionId: 'TRUE',
            textEn: 'True (Excess stamp duty is mandatory)',
            textMl: 'ശരി (അധിക മുദ്രവില നിർബന്ധമാണ്)',
          },
          {
            optionId: 'FALSE',
            textEn: 'False (No excess stamp duty is required)',
            textMl: 'തെറ്റ് (അധിക മുദ്രവില ആവശ്യമില്ല)',
          },
        ],
        correctOptionId: 'FALSE',
        explanationEn:
          'Land Revenue Commissioner Order LR/3322/2022-LR(A3) dated 21/08/2025 rules that no excess stamp duty is required when a deed presents property currently classified as Purayidam that was earlier recorded as Nilam in the prior deed.',
        explanationMl:
          'LR/3322/2022-LR(A3) (21/08/2025) ഉത്തരവ് പ്രകാരം മുന്നാധാരത്തിൽ വസ്തുവിന്റെ തരം "നിലം" എന്ന് രേഖപ്പെടുത്തിയിരുന്നതും ഇപ്പോൾ "പുരയിടം" എന്ന് രേഖപ്പെടുത്തിയിട്ടുള്ളതുമായ ആധാരത്തിന് അധിക മുദ്രവില ആവശ്യമില്ല.',
        timeLimitSeconds: 20,
        linkedDocId: 'DOC-2022-0003',
      },
      {
        questionId: 'Q-FAIR-VALUE-28A',
        order: 3,
        type: 'single_choice',
        promptEn:
          'Under which section of the Kerala Stamp Act 1959 is the Fair Value of land notified and revised by the Government?',
        promptMl:
          'കേരള മുദ്രപത്ര നിയമം 1959-ലെ ഏത് വകുപ്പ് പ്രകാരമാണ് ഭൂമിയുടെ ന്യായവില (Fair Value) നിശ്ചയിക്കുകയും പുതുക്കുകയും ചെയ്യുന്നത്?',
        options: [
          {
            optionId: 'A',
            textEn: 'Section 28A',
            textMl: 'വകുപ്പ് 28A (Section 28A)',
          },
          {
            optionId: 'B',
            textEn: 'Section 45B',
            textMl: 'വകുപ്പ് 45B (Section 45B)',
          },
          {
            optionId: 'C',
            textEn: 'Section 17',
            textMl: 'വകുപ്പ് 17 (Section 17)',
          },
          {
            optionId: 'D',
            textEn: 'Section 78',
            textMl: 'വകുപ്പ് 78 (Section 78)',
          },
        ],
        correctOptionId: 'A',
        explanationEn:
          'Section 28A of the Kerala Stamp Act 1959 empowers the fixing and revision of Fair Value of land across Kerala (see Fair Value Revision Gazette Order GO(P)No.45/2023/TD).',
        explanationMl:
          'കേരള സ്റ്റാമ്പ് ആക്ട് വകുപ്പ് 28A പ്രകാരമാണ് ഭൂമിയുടെ ന്യായവില (Fair Value) നിശ്ചയിക്കുകയും പുതുക്കുകയും ചെയ്യുന്നത് (GO(P)No.45/2023/TD).',
        timeLimitSeconds: 20,
        linkedDocId: 'DOC-2023-0002',
      },
      {
        questionId: 'Q-SETTLEMENT-51A',
        order: 4,
        type: 'single_choice',
        promptEn:
          'Which Article of the Kerala Stamp Act Schedule governs concessional stamp duty for a Settlement Deed executed in favour of family members?',
        promptMl:
          'കുടുംബാംഗങ്ങൾക്ക് എഴുതിക്കൊടുക്കുന്ന ധനനിശ്ചയാധാരത്തിന് (Settlement Deed) ഇളവുള്ള മുദ്രവില നിശ്ചയിക്കുന്ന കേരള മുദ്രപത്ര നിയമത്തിലെ ആർട്ടിക്കിൾ ഏതാണ്?',
        options: [
          {
            optionId: 'A',
            textEn: 'Article 51(a)(i)',
            textMl: 'ആർട്ടിക്കിൾ 51(എ)(1)',
          },
          {
            optionId: 'B',
            textEn: 'Article 21(1)',
            textMl: 'ആർട്ടിക്കിൾ 21(1)',
          },
          {
            optionId: 'C',
            textEn: 'Article 42(i)',
            textMl: 'ആർട്ടിക്കിൾ 42(1)',
          },
          {
            optionId: 'D',
            textEn: 'Article 15',
            textMl: 'ആർട്ടിക്കിൾ 15',
          },
        ],
        correctOptionId: 'A',
        explanationEn:
          'As confirmed in Order R.2-5635/2020, a settlement deed of co-owned property in favour of a person falling within the statutory definition of "family" is chargeable under Article 51(a)(i) of the Kerala Stamp Act.',
        explanationMl:
          'R.2-5635/2020 ഉത്തരവ് പ്രകാരം കുടുംബം എന്ന നിർവ്വചനത്തിൽ ഉൾപ്പെട്ടുവരുന്നയാൾക്ക് എഴുതിക്കൊടുക്കുന്ന ധനനിശ്ചയാധാരത്തിന് മുദ്രപത്രനിയമം ആർട്ടിക്കിൾ 51(എ)(1) പ്രകാരം മുദ്രവില മതിയാകുന്നതാണ്.',
        timeLimitSeconds: 20,
        linkedDocId: 'DOC-2020-0014',
      },
    ];

    const hydrated = await hydrateQuestionLinkedDocs(initialQuestions);
    const defaultQuiz: QuizDocument = {
      quizId: 'QUIZ-2026-0001',
      slug: slugify('Kerala Registration & Stamp Act Mastery Quiz'),
      categorySlug: 'lrc-igr-orders',
      categoryNameEn: 'LRC & IGR Orders',
      categoryNameMl: 'എൽ.ആർ.സി & ഐ.ജി.ആർ ഉത്തരവുകൾ',
      topicEn: 'Recent Circulars & Stamp Rulings',
      topicMl: 'പുതിയ ഉത്തരവുകളും മുദ്രവില വിധികളും',
      titleEn: 'Kerala Registration & Stamp Act Mastery Quiz',
      titleMl: 'കേരള രജിസ്ട്രേഷൻ & മുദ്രപത്ര നിയമം ക്വിസ്',
      descriptionEn:
        'Test your mastery of Land Revenue Commissioner (LRC) orders, IGR rulings, Section 25 mortgage stamp duty, Nilam/Purayidam classification, and Fair Value rules.',
      descriptionMl:
        'എൽ.ആർ.സി ഉത്തരവുകൾ, രജിസ്ട്രേഷൻ ഐ.ജി സർക്കുലറുകൾ, മുദ്രവില നിർണ്ണയം, ന്യായവില ചട്ടങ്ങൾ എന്നിവയെ ആസ്പദമാക്കിയുള്ള ദ്വിഭാഷാ ക്വിസ്.',
      status: 'published',
      defaultTimeSeconds: 20,
      defaultRevealSeconds: 6,
      scoringRules: { ...DEFAULT_SCORING_RULES },
      enabledModes: ['auto_live', 'host_live', 'self_paced'],
      questions: hydrated,
      currentVersion: 1,
      createdBy: 'admin.mudra',
      createdAt: now,
      updatedAt: now,
    };

    await quizzes.insertOne(defaultQuiz).catch(() => {});
    await ensureFixedQuizVersion(defaultQuiz).catch(() => {});
  } else if (!existingQ1.categorySlug) {
    await quizzes
      .updateOne(
        { quizId: 'QUIZ-2026-0001' },
        {
          $set: {
            categorySlug: 'lrc-igr-orders',
            categoryNameEn: 'LRC & IGR Orders',
            categoryNameMl: 'എൽ.ആർ.സി & ഐ.ജി.ആർ ഉത്തരവുകൾ',
            topicEn: 'Recent Circulars & Stamp Rulings',
            topicMl: 'പുതിയ ഉത്തരവുകളും മുദ്രവില വിധികളും',
          },
        }
      )
      .catch(() => {});
  }

  // 3. Ensure the 100-question Aadharam Ezhuthu (Deed Writing) Full Exam & 5 Topic Quizzes exist
  const all100Questions = (aadharamEzhuthu100Mcqs as unknown as QuizQuestionItem[]).map((q, idx) => ({
    ...q,
    order: idx + 1,
  }));

  const aadharamQuizzesToSeed: Array<{
    quizId: string;
    slug: string;
    topicEn: string;
    topicMl: string;
    titleEn: string;
    titleMl: string;
    descriptionEn: string;
    descriptionMl: string;
    questions: QuizQuestionItem[];
  }> = [
    {
      quizId: 'QUIZ-AE-100',
      slug: 'aadharam-ezhuthu-deed-writing-100-mcqs-full-exam',
      topicEn: 'Complete 100-MCQ Licensing Exam',
      topicMl: 'സമ്പൂർണ്ണ 100 ചോദ്യങ്ങളുടെ ലൈസൻസ് പരീക്ഷ',
      titleEn: 'Aadharam Ezhuthu (Deed Writing) — Complete 100 MCQs Exam',
      titleMl: 'ആധാരമെഴുത്ത് (Deed Writing) — 100 MCQs സമ്പൂർണ്ണ പരീക്ഷ',
      descriptionEn:
        'Comprehensive 100-question bilingual mock exam covering Registration Act 1908, Kerala Stamp Act 1959, Document Writers’ Licence Rules 1960, Property Transfers & Deed Types, and PEARL Online Services.',
      descriptionMl:
        'രജിസ്ട്രേഷൻ നിയമം 1908, കേരള മുദ്രപത്ര നിയമം 1959, ആധാരമെഴുത്തുകാരുടെ ലൈസൻസും ചുമതലകളും, സ്വത്ത് കൈമാറ്റവും ആധാരങ്ങളുടെ തരങ്ങളും, ആധാരരചനയും ഭൂരേഖകളും ഓൺലൈൻ സേവനങ്ങളും (PEARL) എന്നിവ ഉൾക്കൊള്ളുന്ന 100 ചോദ്യങ്ങളുടെ സമ്പൂർണ്ണ പരീക്ഷ.',
      questions: all100Questions,
    },
    {
      quizId: 'QUIZ-AE-PART1',
      slug: 'aadharam-ezhuthu-part-1-registration-act-1908',
      topicEn: 'Part 1: Registration Act, 1908 (Q001–Q020)',
      topicMl: 'ഭാഗം 1: രജിസ്ട്രേഷൻ നിയമം, 1908 (Q001–Q020)',
      titleEn: 'Aadharam Ezhuthu Part 1 — Registration Act, 1908 (20 MCQs)',
      titleMl: 'ആധാരമെഴുത്ത് ഭാഗം 1 — രജിസ്ട്രേഷൻ നിയമം, 1908 (20 ചോദ്യങ്ങൾ)',
      descriptionEn:
        'Questions Q001–Q020 on compulsory & optional registration, presentation time limits, language translation, refusal orders, Book 1–4 indexes, and Sections 17–77 of the Registration Act, 1908.',
      descriptionMl:
        'രജിസ്ട്രേഷൻ നിയമം, 1908 (Q001–Q020): നിർബന്ധിത രജിസ്ട്രേഷൻ, ഹാജരാക്കാനുള്ള സമയപരിധി, തിരുത്തലുകൾ, രജിസ്ട്രേഷൻ നിരസിക്കൽ, ബുക്ക് 1–4 രജിസ്റ്ററുകൾ എന്നിവയെ ആസ്പദമാക്കിയുള്ള 20 ചോദ്യങ്ങൾ.',
      questions: all100Questions.slice(0, 20).map((q, idx) => ({ ...q, order: idx + 1 })),
    },
    {
      quizId: 'QUIZ-AE-PART2',
      slug: 'aadharam-ezhuthu-part-2-kerala-stamp-act-1959',
      topicEn: 'Part 2: Kerala Stamp Act, 1959 (Q021–Q040)',
      topicMl: 'ഭാഗം 2: കേരള മുദ്രപത്ര നിയമം, 1959 (Q021–Q040)',
      titleEn: 'Aadharam Ezhuthu Part 2 — Kerala Stamp Act, 1959 (20 MCQs)',
      titleMl: 'ആധാരമെഴുത്ത് ഭാഗം 2 — കേരള മുദ്രപത്ര നിയമം, 1959 (20 ചോദ്യങ്ങൾ)',
      descriptionEn:
        'Questions Q021–Q040 on chargeable instruments, several distinct matters, time of stamping, valuation, Section 28A Fair Value, Section 45B undervaluation, impounding, and stamp refunds.',
      descriptionMl:
        'കേരള മുദ്രപത്ര നിയമം, 1959 (Q021–Q040): മുദ്രവില നിർണ്ണയം, ന്യായവില (വകുപ്പ് 28A), വില കുറച്ചുകാണിക്കൽ (വകുപ്പ് 45B), മുദ്രപത്ര റീഫണ്ട് എന്നിവയെ ആസ്പദമാക്കിയുള്ള 20 ചോദ്യങ്ങൾ.',
      questions: all100Questions.slice(20, 40).map((q, idx) => ({ ...q, order: idx + 1 })),
    },
    {
      quizId: 'QUIZ-AE-PART3',
      slug: 'aadharam-ezhuthu-part-3-document-writers-licensing-duties',
      topicEn: 'Part 3: Document Writers’ Licensing & Duties (Q041–Q060)',
      topicMl: 'ഭാഗം 3: ആധാരമെഴുത്തുകാരുടെ ലൈസൻസും ചുമതലകളും (Q041–Q060)',
      titleEn: 'Aadharam Ezhuthu Part 3 — Document Writers’ Licensing & Duties (20 MCQs)',
      titleMl: 'ആധാരമെഴുത്ത് ഭാഗം 3 — ആധാരമെഴുത്തുകാരുടെ ലൈസൻസും ചുമതലകളും (20 ചോദ്യങ്ങൾ)',
      descriptionEn:
        'Questions Q041–Q060 on Kerala Document Writers’ Licence Rules 1960, scribe licenses, sub-district & district licenses, Form E register, Form F receipt, 2025 Fee Schedule, and 2026 Exam Notification.',
      descriptionMl:
        'ആധാരമെഴുത്തുകാരുടെ ലൈസൻസും ചുമതലകളും (Q041–Q060): ലൈസൻസ് ചട്ടങ്ങൾ 1960, സ്ക്രൈബ് ലൈസൻസ്, ഫോം E രജിസ്റ്റർ, ഫോം F രസീത്, ഫീസ് പട്ടിക, ലൈസൻസ് പരീക്ഷാ യോഗ്യത എന്നിവയെ ആസ്പദമാക്കിയുള്ള 20 ചോദ്യങ്ങൾ.',
      questions: all100Questions.slice(40, 60).map((q, idx) => ({ ...q, order: idx + 1 })),
    },
    {
      quizId: 'QUIZ-AE-PART4',
      slug: 'aadharam-ezhuthu-part-4-property-transfers-deed-types',
      topicEn: 'Part 4: Property Transfers & Deed Types (Q061–Q080)',
      topicMl: 'ഭാഗം 4: സ്വത്ത് കൈമാറ്റവും ആധാരങ്ങളുടെ തരങ്ങളും (Q061–Q080)',
      titleEn: 'Aadharam Ezhuthu Part 4 — Property Transfers & Deed Types (20 MCQs)',
      titleMl: 'ആധാരമെഴുത്ത് ഭാഗം 4 — സ്വത്ത് കൈമാറ്റവും ആധാരങ്ങളുടെ തരങ്ങളും (20 ചോദ്യങ്ങൾ)',
      descriptionEn:
        'Questions Q061–Q080 on Sale, Simple/Usufructuary/Equitable Mortgages, Right of Redemption, Leases, Gifts, Exchange, Release, Partition, Settlement, Easements, and Wills.',
      descriptionMl:
        'സ്വത്ത് കൈമാറ്റവും ആധാരങ്ങളുടെ തരങ്ങളും (Q061–Q080): തീറാധാരം, പണയാധാരങ്ങൾ, പാട്ടം, ദാനാധാരം, പരസ്പരമാറ്റം, ഒഴിവാക്കൽ ആധാരം, ഭാഗപത്രം, വിൽപത്രം എന്നിവയെ ആസ്പദമാക്കിയുള്ള 20 ചോദ്യങ്ങൾ.',
      questions: all100Questions.slice(60, 80).map((q, idx) => ({ ...q, order: idx + 1 })),
    },
    {
      quizId: 'QUIZ-AE-PART5',
      slug: 'aadharam-ezhuthu-part-5-drafting-property-records-pearl',
      topicEn: 'Part 5: Drafting, Property Records & Online Services (Q081–Q100)',
      topicMl: 'ഭാഗം 5: ആധാരരചനയും ഭൂരേഖകളും ഓൺലൈൻ സേവനങ്ങളും (Q081–Q100)',
      titleEn: 'Aadharam Ezhuthu Part 5 — Drafting, Property Records & PEARL Services (20 MCQs)',
      titleMl: 'ആധാരമെഴുത്ത് ഭാഗം 5 — ആധാരരചനയും ഭൂരേഖകളും ഓൺലൈൻ സേവനങ്ങളും (20 ചോദ്യങ്ങൾ)',
      descriptionEn:
        'Questions Q081–Q100 on Root of Title, Non-Testamentary Schedule (Rule 19), Rectification Deeds, PEARL Portal Token/EC/Certified Copy SOPs, Transfer of Registry (Pokkuvaravu), and Thandaper.',
      descriptionMl:
        'ആധാരരചനയും ഭൂരേഖകളും ഓൺലൈൻ സേവനങ്ങളും (Q081–Q100): മുന്നാധാര ക്രമം, പട്ടികയിലെ വിവരങ്ങൾ, തിരുത്തൽ ആധാരം, പേൾ (PEARL) പോർട്ടൽ സേവനങ്ങൾ, പോക്കുവരവ്, തണ്ടപ്പേർ എന്നിവയെ ആസ്പദമാക്കിയുള്ള 20 ചോദ്യങ്ങൾ.',
      questions: all100Questions.slice(80, 100).map((q, idx) => ({ ...q, order: idx + 1 })),
    },
  ];

  for (const item of aadharamQuizzesToSeed) {
    const exists = await quizzes.findOne({ quizId: item.quizId });
    if (!exists) {
      const qDoc: QuizDocument = {
        quizId: item.quizId,
        slug: item.slug,
        categorySlug: 'aadharam-ezhuthu-exam',
        categoryNameEn: 'Aadharam Ezhuthu Exam (Deed Writing)',
        categoryNameMl: 'ആധാരമെഴുത്ത് പരീക്ഷ',
        topicEn: item.topicEn,
        topicMl: item.topicMl,
        titleEn: item.titleEn,
        titleMl: item.titleMl,
        descriptionEn: item.descriptionEn,
        descriptionMl: item.descriptionMl,
        status: 'published',
        defaultTimeSeconds: 25,
        defaultRevealSeconds: 6,
        scoringRules: { ...DEFAULT_SCORING_RULES },
        enabledModes: ['auto_live', 'host_live', 'self_paced'],
        questions: item.questions,
        currentVersion: 1,
        createdBy: 'admin.mudra',
        createdAt: now,
        updatedAt: now,
      };
      await quizzes.insertOne(qDoc).catch(() => {});
      await ensureFixedQuizVersion(qDoc).catch(() => {});
    }
  }

  // 4. Ensure Demo Live Rooms exist:
  // - MUD207 & LIVE01 -> LRC & IGR Orders Quiz
  // - AAD100 -> Aadharam Ezhuthu 100 MCQs Live Exam Room
  const fullAeQuiz = await quizzes.findOne({ quizId: 'QUIZ-AE-100' });
  if (fullAeQuiz) {
    const aeVersion = await ensureFixedQuizVersion(fullAeQuiz);
    const existingAAD100 = await quizRooms.findOne({ roomCode: 'AAD100' });
    if (!existingAAD100) {
      await quizRooms
        .insertOne({
          roomId: 'ROOM-AAD100-DEMO',
          roomCode: 'AAD100',
          quizId: fullAeQuiz.quizId,
          versionId: aeVersion.versionId,
          version: aeVersion.version,
          mode: 'auto_live',
          status: 'lobby',
          hostUserId: 'system-admin',
          hostLoginId: 'admin.mudra',
          capacity: 100,
          joinLocked: false,
          revealDurationSeconds: 6,
          scoringRules: { ...DEFAULT_SCORING_RULES },
          currentQuestionIndex: -1,
          questionOpenedAt: null,
          questionDeadlineAt: null,
          revealStartedAt: null,
          revealEndsAt: null,
          transitionVersion: 1,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        })
        .catch(() => {});
    }
  }

  const existingMUD = await quizRooms.findOne({ roomCode: 'MUD207' });
  if (!existingMUD) {
    const q = (await quizzes.findOne({ quizId: 'QUIZ-2026-0001' })) || (await quizzes.findOne({ status: 'published' }));
    if (q) {
      const qv = await ensureFixedQuizVersion(q);
      await quizRooms
        .insertOne({
          roomId: 'ROOM-MUD207-DEMO',
          roomCode: 'MUD207',
          quizId: q.quizId,
          versionId: qv.versionId,
          version: qv.version,
          mode: 'auto_live',
          status: 'lobby',
          hostUserId: 'system-admin',
          hostLoginId: 'admin.mudra',
          capacity: 100,
          joinLocked: false,
          revealDurationSeconds: 6,
          scoringRules: { ...DEFAULT_SCORING_RULES },
          currentQuestionIndex: -1,
          questionOpenedAt: null,
          questionDeadlineAt: null,
          revealStartedAt: null,
          revealEndsAt: null,
          transitionVersion: 1,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        })
        .catch(() => {});
    }
  }
}

/**
 * Generates a unique 6-character uppercase room code (e.g., "MUD207").
 */
export async function generateUniqueRoomCode(): Promise<string> {
  const { quizRooms } = await getCollections();
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 15; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    const exists = await quizRooms.findOne({ roomCode: code });
    if (!exists) return code;
  }
  return `M${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

/**
 * Creates a new Live Quiz Room (`auto_live` or `host_live`) bound to a fixed `QuizVersionDocument`.
 */
export async function createLiveQuizRoom(params: {
  quizId: string;
  mode: 'auto_live' | 'host_live';
  hostUserId: string;
  hostLoginId: string;
  capacity?: number;
  revealDurationSeconds?: number;
  scoringOverrides?: Partial<QuizScoringRules>;
}): Promise<{ room: QuizRoomDocument; quizVersion: QuizVersionDocument }> {
  const { quizzes, quizRooms } = await getCollections();
  const quiz = await quizzes.findOne({
    $or: [{ quizId: params.quizId }, { slug: params.quizId }],
  });
  if (!quiz) {
    throw new Error('Quiz not found.');
  }
  if (quiz.status !== 'published') {
    throw new Error('Only published quizzes can open a live room.');
  }
  if (quiz.questions.length === 0) {
    throw new Error('Quiz must contain at least one question before opening a room.');
  }

  // Save/lock a fixed quiz version when a live session opens
  const quizVersion = await ensureFixedQuizVersion(quiz);
  const roomCode = await generateUniqueRoomCode();
  const now = new Date();

  const scoringRules: QuizScoringRules = {
    ...quizVersion.scoringRules,
    ...(params.scoringOverrides || {}),
  };

  const room: QuizRoomDocument = {
    roomId: `ROOM-${roomCode}-${Date.now()}`,
    roomCode,
    quizId: quiz.quizId,
    versionId: quizVersion.versionId,
    version: quizVersion.version,
    mode: params.mode,
    status: 'lobby',
    hostUserId: params.hostUserId,
    hostLoginId: params.hostLoginId,
    capacity: Math.min(500, Math.max(2, Number(params.capacity || 100))),
    joinLocked: false,
    revealDurationSeconds: Math.min(
      60,
      Math.max(2, Number(params.revealDurationSeconds || quizVersion.defaultRevealSeconds || 6))
    ),
    scoringRules,
    currentQuestionIndex: -1,
    questionOpenedAt: null,
    questionDeadlineAt: null,
    revealStartedAt: null,
    revealEndsAt: null,
    transitionVersion: 1,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  await quizRooms.insertOne(room);
  return { room, quizVersion };
}

/**
 * Finalizes a live room when it reaches `completed`, recording `QuizAttemptDocument` history entries
 * for every participant (so signed-in readers see it in My Quiz History and guests can view their result).
 */
export async function finalizeCompletedRoomHistory(
  room: QuizRoomDocument,
  quizVersion: QuizVersionDocument
): Promise<void> {
  const { quizParticipants, quizSubmissions, quizAttempts } = await getCollections();
  const [participants, submissions] = await Promise.all([
    quizParticipants.find({ roomCode: room.roomCode, removed: false }).toArray(),
    quizSubmissions.find({ roomCode: room.roomCode }).toArray(),
  ]);

  const ranked = rankParticipants(participants);
  const totalQuestions = quizVersion.questions.length;
  const now = room.completedAt || new Date();

  const subByParticipant = new Map<string, typeof submissions>();
  for (const s of submissions) {
    const arr = subByParticipant.get(s.participantId) || [];
    arr.push(s);
    subByParticipant.set(s.participantId, arr);
  }

  for (const p of ranked) {
    const attemptId = `LIVE-${room.roomCode}-${p.participantId}`;
    const existing = await quizAttempts.findOne({ attemptId });
    if (existing) continue;

    const pSubs = (subByParticipant.get(p.participantId) || []).sort(
      (a, b) => a.questionIndex - b.questionIndex
    );

    const accuracyPercent =
      totalQuestions > 0 ? Math.round((p.correctCount / totalQuestions) * 100) : 0;

    await quizAttempts
      .insertOne({
        attemptId,
        attemptToken: p.participantToken,
        mode: room.mode,
        roomCode: room.roomCode,
        participantId: p.participantId,
        quizId: room.quizId,
        versionId: room.versionId,
        version: room.version,
        quizTitleEn: quizVersion.titleEn,
        quizTitleMl: quizVersion.titleMl,
        userId: p.userId || null,
        loginId: p.loginId || null,
        displayName: p.displayName,
        isGuest: p.isGuest,
        preferredLanguage: p.preferredLanguage,
        status: 'completed',
        scoringRules: room.scoringRules,
        currentQuestionIndex: totalQuestions - 1,
        currentQuestionStartedAt: now,
        totalQuestions,
        totalPoints: p.totalPoints,
        correctCount: p.correctCount,
        answeredCount: p.answeredCount,
        accuracyPercent,
        cumulativeCorrectTimeMs: p.cumulativeCorrectTimeMs,
        currentStreak: p.currentStreak,
        maxStreak: p.maxStreak,
        rank: p.rank,
        totalParticipantsInRoom: ranked.length,
        answers: pSubs.map((s) => ({
          questionIndex: s.questionIndex,
          questionId: s.questionId,
          selectedOptionId: s.selectedOptionId,
          isCorrect: s.isCorrect,
          responseTimeMs: s.responseTimeMs,
          basePointsEarned: s.basePointsEarned,
          speedBonusEarned: s.speedBonusEarned,
          streakBonusEarned: s.streakBonusEarned,
          totalPointsEarned: s.totalPointsEarned,
          streakAfterAnswer: s.streakAfterAnswer,
          questionStartedAt: s.submittedAt,
          submittedAt: s.submittedAt,
        })),
        startedAt: p.joinedAt,
        completedAt: now,
      })
      .catch(() => {});
  }
}

/**
 * Resets streaks to 0 for any participant in the room who did NOT submit an answer
 * to `closedQuestionIndex` before the question closed.
 */
async function resetUnansweredStreaksForClosedQuestion(
  roomCode: string,
  closedQuestionIndex: number
): Promise<void> {
  if (closedQuestionIndex < 0) return;
  const { quizParticipants, quizSubmissions } = await getCollections();
  const answeredSubs = await quizSubmissions
    .find({ roomCode, questionIndex: closedQuestionIndex })
    .toArray();
  const answeredParticipantIds = answeredSubs.map((s) => s.participantId);

  if (answeredParticipantIds.length === 0) {
    await quizParticipants.updateMany(
      { roomCode, removed: false, currentStreak: { $gt: 0 } },
      { $set: { currentStreak: 0 } }
    );
  } else {
    await quizParticipants.updateMany(
      {
        roomCode,
        removed: false,
        participantId: { $nin: answeredParticipantIds },
        currentStreak: { $gt: 0 },
      },
      { $set: { currentStreak: 0 } }
    );
  }
}

/**
 * Server-Authoritative Atomic State Machine Tick for a Live Room.
 *
 * - Runs on every client or host state poll AND before answer submissions.
 * - Because transitions are evaluated from server timestamps persisted in MongoDB,
 *   `auto_live` progression continues automatically even if the host closes their browser!
 * - Protects every transition with `{ roomCode, transitionVersion: room.transitionVersion }`
 *   so when 100 concurrent players poll at the exact millisecond a timer expires,
 *   only ONE worker executes the transition.
 */
export async function syncLiveRoomStateMachine(roomCode: string): Promise<{
  room: QuizRoomDocument | null;
  quizVersion: QuizVersionDocument | null;
}> {
  const { quizRooms, quizVersions } = await getCollections();
  const normalizedCode = roomCode.trim().toUpperCase();
  let room = await quizRooms.findOne({ roomCode: normalizedCode });
  if (!room) {
    return { room: null, quizVersion: null };
  }

  const quizVersion = await quizVersions.findOne({ versionId: room.versionId });
  if (!quizVersion) {
    return { room, quizVersion: null };
  }

  const totalQuestions = quizVersion.questions.length;

  // Loop up to 3 times in case both questionDeadlineAt and revealEndsAt have elapsed
  for (let step = 0; step < 3; step++) {
    const now = new Date();

    // Transition 1: `question_open` -> `question_revealed` when `now >= questionDeadlineAt`
    if (
      room.status === 'question_open' &&
      room.questionDeadlineAt &&
      now.getTime() >= new Date(room.questionDeadlineAt).getTime()
    ) {
      const revealStartedAt = new Date();
      const revealEndsAt =
        room.mode === 'auto_live'
          ? new Date(revealStartedAt.getTime() + (room.revealDurationSeconds || 6) * 1000)
          : null;

      const updateRes = await quizRooms.updateOne(
        {
          roomCode: normalizedCode,
          status: 'question_open',
          transitionVersion: room.transitionVersion,
        },
        {
          $set: {
            status: 'question_revealed',
            revealStartedAt,
            revealEndsAt,
            updatedAt: revealStartedAt,
          },
          $inc: { transitionVersion: 1 },
        }
      );

      if (updateRes.modifiedCount > 0) {
        await resetUnansweredStreaksForClosedQuestion(
          normalizedCode,
          room.currentQuestionIndex
        );
      }

      const refreshed = await quizRooms.findOne({ roomCode: normalizedCode });
      if (refreshed) room = refreshed;
      continue;
    }

    // Transition 2 (Automatic Live Mode only): `question_revealed` -> next `question_open` or `completed`
    // when `now >= revealEndsAt` (works even if the host's browser is completely closed!)
    if (
      room.status === 'question_revealed' &&
      room.mode === 'auto_live' &&
      room.revealEndsAt &&
      now.getTime() >= new Date(room.revealEndsAt).getTime()
    ) {
      const nextIndex = room.currentQuestionIndex + 1;
      if (nextIndex < totalQuestions) {
        const nextQ = quizVersion.questions[nextIndex];
        const openedAt = new Date();
        const durationSec = nextQ.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20;
        const deadlineAt = new Date(openedAt.getTime() + durationSec * 1000);

        await quizRooms.updateOne(
          {
            roomCode: normalizedCode,
            status: 'question_revealed',
            transitionVersion: room.transitionVersion,
          },
          {
            $set: {
              status: 'question_open',
              currentQuestionIndex: nextIndex,
              questionOpenedAt: openedAt,
              questionDeadlineAt: deadlineAt,
              revealStartedAt: null,
              revealEndsAt: null,
              updatedAt: openedAt,
            },
            $inc: { transitionVersion: 1 },
          }
        );
      } else {
        const completedAt = new Date();
        const res = await quizRooms.updateOne(
          {
            roomCode: normalizedCode,
            status: 'question_revealed',
            transitionVersion: room.transitionVersion,
          },
          {
            $set: {
              status: 'completed',
              completedAt,
              updatedAt: completedAt,
            },
            $inc: { transitionVersion: 1 },
          }
        );
        const refreshed = await quizRooms.findOne({ roomCode: normalizedCode });
        if (refreshed) {
          room = refreshed;
          if (res.modifiedCount > 0) {
            await finalizeCompletedRoomHistory(room, quizVersion);
          }
        }
        break;
      }

      const refreshed = await quizRooms.findOne({ roomCode: normalizedCode });
      if (refreshed) room = refreshed;
      continue;
    }

    break;
  }

  if (room.status === 'completed') {
    await finalizeCompletedRoomHistory(room, quizVersion);
  }

  return { room, quizVersion };
}

/**
 * Host control actions: `start_quiz`, `reveal_question`, `next_question`, `toggle_lock`, `remove_participant`, `end_session`.
 * Protected by `transitionVersion` optimistic concurrency control.
 */
export async function executeHostRoomAction(params: {
  roomCode: string;
  action:
    | 'start_quiz'
    | 'reveal_question'
    | 'next_question'
    | 'toggle_lock'
    | 'remove_participant'
    | 'end_session'
    | 'update_settings';
  participantId?: string;
  joinLocked?: boolean;
  revealDurationSeconds?: number;
  capacity?: number;
  expectedQuestionIndex?: number;
}): Promise<QuizRoomDocument> {
  const { quizRooms, quizParticipants } = await getCollections();
  const { room, quizVersion } = await syncLiveRoomStateMachine(params.roomCode);
  if (!room || !quizVersion) {
    throw new Error('Live room not found.');
  }

  const now = new Date();

  if (params.action === 'toggle_lock') {
    const nextLocked =
      typeof params.joinLocked === 'boolean' ? params.joinLocked : !room.joinLocked;
    await quizRooms.updateOne(
      { roomCode: room.roomCode },
      { $set: { joinLocked: nextLocked, updatedAt: now } }
    );
    return (await quizRooms.findOne({ roomCode: room.roomCode }))!;
  }

  if (params.action === 'update_settings') {
    const updates: Record<string, unknown> = { updatedAt: now };
    if (typeof params.revealDurationSeconds === 'number') {
      updates.revealDurationSeconds = Math.min(60, Math.max(2, params.revealDurationSeconds));
    }
    if (typeof params.capacity === 'number') {
      updates.capacity = Math.min(500, Math.max(2, params.capacity));
    }
    await quizRooms.updateOne({ roomCode: room.roomCode }, { $set: updates });
    return (await quizRooms.findOne({ roomCode: room.roomCode }))!;
  }

  if (params.action === 'remove_participant') {
    if (!params.participantId) {
      throw new Error('participantId is required to remove a participant.');
    }
    await quizParticipants.updateOne(
      { roomCode: room.roomCode, participantId: params.participantId },
      { $set: { removed: true, lastSeenAt: now } }
    );
    return room;
  }

  if (params.action === 'end_session') {
    await quizRooms.updateOne(
      { roomCode: room.roomCode },
      {
        $set: {
          status: 'completed',
          completedAt: now,
          updatedAt: now,
        },
        $inc: { transitionVersion: 1 },
      }
    );
    const updated = (await quizRooms.findOne({ roomCode: room.roomCode }))!;
    await finalizeCompletedRoomHistory(updated, quizVersion);
    return updated;
  }

  if (params.action === 'start_quiz') {
    if (room.status !== 'lobby') {
      return room;
    }
    const firstQ = quizVersion.questions[0];
    if (!firstQ) {
      throw new Error('Quiz has no questions.');
    }
    const durationSec = firstQ.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20;
    const deadlineAt = new Date(now.getTime() + durationSec * 1000);

    await quizRooms.updateOne(
      {
        roomCode: room.roomCode,
        status: 'lobby',
        transitionVersion: room.transitionVersion,
      },
      {
        $set: {
          status: 'question_open',
          currentQuestionIndex: 0,
          questionOpenedAt: now,
          questionDeadlineAt: deadlineAt,
          revealStartedAt: null,
          revealEndsAt: null,
          updatedAt: now,
        },
        $inc: { transitionVersion: 1 },
      }
    );
    return (await quizRooms.findOne({ roomCode: room.roomCode }))!;
  }

  if (params.action === 'reveal_question') {
    if (room.status !== 'question_open') {
      return room;
    }
    if (
      typeof params.expectedQuestionIndex === 'number' &&
      room.currentQuestionIndex !== params.expectedQuestionIndex
    ) {
      return room;
    }
    const revealEndsAt =
      room.mode === 'auto_live'
        ? new Date(now.getTime() + (room.revealDurationSeconds || 6) * 1000)
        : null;

    const res = await quizRooms.updateOne(
      {
        roomCode: room.roomCode,
        status: 'question_open',
        currentQuestionIndex: room.currentQuestionIndex,
        transitionVersion: room.transitionVersion,
      },
      {
        $set: {
          status: 'question_revealed',
          revealStartedAt: now,
          revealEndsAt,
          updatedAt: now,
        },
        $inc: { transitionVersion: 1 },
      }
    );
    if (res.modifiedCount > 0) {
      await resetUnansweredStreaksForClosedQuestion(
        room.roomCode,
        room.currentQuestionIndex
      );
    }
    return (await quizRooms.findOne({ roomCode: room.roomCode }))!;
  }

  if (params.action === 'next_question') {
    if (
      typeof params.expectedQuestionIndex === 'number' &&
      room.currentQuestionIndex !== params.expectedQuestionIndex
    ) {
      return room;
    }
    if (room.status === 'question_open') {
      // First close & reveal if host clicks next while open
      await resetUnansweredStreaksForClosedQuestion(
        room.roomCode,
        room.currentQuestionIndex
      );
    }

    const nextIndex = room.currentQuestionIndex + 1;
    if (nextIndex < quizVersion.questions.length) {
      const nextQ = quizVersion.questions[nextIndex];
      const durationSec = nextQ.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20;
      const deadlineAt = new Date(now.getTime() + durationSec * 1000);

      await quizRooms.updateOne(
        {
          roomCode: room.roomCode,
          currentQuestionIndex: room.currentQuestionIndex,
          transitionVersion: room.transitionVersion,
        },
        {
          $set: {
            status: 'question_open',
            currentQuestionIndex: nextIndex,
            questionOpenedAt: now,
            questionDeadlineAt: deadlineAt,
            revealStartedAt: null,
            revealEndsAt: null,
            updatedAt: now,
          },
          $inc: { transitionVersion: 1 },
        }
      );
    } else {
      await quizRooms.updateOne(
        {
          roomCode: room.roomCode,
          currentQuestionIndex: room.currentQuestionIndex,
          transitionVersion: room.transitionVersion,
        },
        {
          $set: {
            status: 'completed',
            completedAt: now,
            updatedAt: now,
          },
          $inc: { transitionVersion: 1 },
        }
      );
      const completedRoom = (await quizRooms.findOne({ roomCode: room.roomCode }))!;
      await finalizeCompletedRoomHistory(completedRoom, quizVersion);
      return completedRoom;
    }

    return (await quizRooms.findOne({ roomCode: room.roomCode }))!;
  }

  return room;
}

/**
 * Joins a live room or reconnects an existing participant.
 *
 * - Allows existing participants to reconnect at any time (even when the room is full, joinLocked, or mid-question!)
 *   without losing their current answer, score, or participant identity.
 * - Enforces `room.capacity` (e.g. 100 players) and `room.joinLocked` for NEW participants.
 */
export async function joinOrReconnectLiveRoom(params: {
  roomCode: string;
  displayName?: string;
  participantToken?: string | null;
  userId?: string | null;
  loginId?: string | null;
  preferredLanguage?: 'en' | 'ml';
}): Promise<{
  participant: QuizParticipantDocument;
  reconnected: boolean;
  room: QuizRoomDocument;
}> {
  const { quizParticipants } = await getCollections();
  const normalizedCode = params.roomCode.trim().toUpperCase();
  await ensureDefaultPublishedQuiz();
  let { room } = await syncLiveRoomStateMachine(normalizedCode);

  if (!room) {
    const err = new Error('Room code not found. Please check your 6-character code.');
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const now = new Date();
  const isDemoRoom = ['MUD207', 'LIVE01', 'AAD100'].includes(normalizedCode);

  // Auto-reset completed demo rooms when a new player joins so demo room codes never fail with "already ended"
  if (room.status === 'completed' && isDemoRoom) {
    const { quizRooms, quizSubmissions } = await getCollections();
    await quizSubmissions.deleteMany({ roomCode: normalizedCode });
    await quizParticipants.updateMany(
      { roomCode: normalizedCode },
      {
        $set: {
          totalPoints: 0,
          correctCount: 0,
          answeredCount: 0,
          cumulativeCorrectTimeMs: 0,
          currentStreak: 0,
          maxStreak: 0,
          lastSeenAt: now,
        },
      }
    );
    await quizRooms.updateOne(
      { roomCode: normalizedCode },
      {
        $set: {
          status: 'lobby',
          currentQuestionIndex: -1,
          questionOpenedAt: null,
          questionDeadlineAt: null,
          revealStartedAt: null,
          revealEndsAt: null,
          completedAt: null,
          updatedAt: now,
        },
        $inc: { transitionVersion: 1 },
      }
    );
    const refreshed = await syncLiveRoomStateMachine(normalizedCode);
    if (refreshed.room) room = refreshed.room;
  }

  // 1. Check reconnection ONLY by participantToken so multiple players sharing the same account or device can join independently
  let existingParticipant: QuizParticipantDocument | null = null;
  if (params.participantToken) {
    existingParticipant = await quizParticipants.findOne({
      roomCode: normalizedCode,
      participantToken: params.participantToken,
    });
  }

  if (existingParticipant) {
    if (existingParticipant.removed) {
      const err = new Error('You have been removed from this session by the host.');
      (err as Error & { statusCode?: number }).statusCode = 403;
      throw err;
    }

    const updatedLang = params.preferredLanguage || existingParticipant.preferredLanguage;
    const requestedName = (params.displayName || '').trim();
    const updatedName =
      requestedName && requestedName.length >= 2
        ? requestedName.slice(0, 40)
        : existingParticipant.displayName;

    await quizParticipants.updateOne(
      { participantId: existingParticipant.participantId },
      {
        $set: {
          lastSeenAt: now,
          preferredLanguage: updatedLang,
          displayName: updatedName,
        },
      }
    );

    return {
      participant: {
        ...existingParticipant,
        lastSeenAt: now,
        preferredLanguage: updatedLang,
        displayName: updatedName,
      },
      reconnected: true,
      room,
    };
  }

  // 2. New participant joining checks
  if (room.status === 'completed') {
    const err = new Error('This quiz session has already ended.');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  if (room.joinLocked) {
    const err = new Error('Joining is currently locked by the host.');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  // Note: New players are allowed to join both in 'lobby' AND while a live game is in progress
  // ('question_open' / 'question_revealed') unless the host explicitly locked joining (`room.joinLocked === true`).

  const activeCount = await quizParticipants.countDocuments({
    roomCode: normalizedCode,
    removed: false,
  });

  if (activeCount >= room.capacity) {
    const err = new Error(
      `Room is full (${activeCount}/${room.capacity} players). Existing players can still reconnect.`
    );
    (err as Error & { statusCode?: number; code?: string }).statusCode = 409;
    (err as Error & { code?: string }).code = 'ROOM_FULL';
    throw err;
  }

  const cleanName = (params.displayName || params.loginId || '').trim();
  if (!cleanName || cleanName.length < 2) {
    const err = new Error('Please enter a display name (at least 2 characters).');
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  // Disambiguate duplicate display names in the same room so every player has a distinct leaderboard identity
  const existingInRoom = await quizParticipants
    .find({ roomCode: normalizedCode, removed: false })
    .toArray();
  const takenNamesLower = new Set(
    existingInRoom.map((p) => p.displayName.trim().toLowerCase())
  );
  let finalDisplayName = cleanName.slice(0, 40);
  if (takenNamesLower.has(finalDisplayName.toLowerCase())) {
    for (let suffix = 2; suffix <= 999; suffix++) {
      const candidate = `${cleanName.slice(0, 34)} (${suffix})`;
      if (!takenNamesLower.has(candidate.toLowerCase())) {
        finalDisplayName = candidate;
        break;
      }
    }
  }

  const participantId = `P-${normalizedCode}-${crypto.randomBytes(6).toString('hex')}`;
  const participantToken = crypto.randomBytes(18).toString('hex');

  const newParticipant: QuizParticipantDocument = {
    participantId,
    participantToken,
    roomCode: normalizedCode,
    roomId: room.roomId,
    quizId: room.quizId,
    versionId: room.versionId,
    userId: params.userId || null,
    loginId: params.loginId || null,
    displayName: finalDisplayName,
    isGuest: !params.userId,
    preferredLanguage: params.preferredLanguage || 'en',
    removed: false,
    totalPoints: 0,
    correctCount: 0,
    answeredCount: 0,
    cumulativeCorrectTimeMs: 0,
    currentStreak: 0,
    maxStreak: 0,
    joinedAt: now,
    lastSeenAt: now,
  };

  await quizParticipants.insertOne(newParticipant);

  // Re-verify capacity after insert to prevent concurrent burst above capacity
  const postInsertCount = await quizParticipants.countDocuments({
    roomCode: normalizedCode,
    removed: false,
  });
  if (postInsertCount > room.capacity) {
    const allInRoom = await quizParticipants
      .find({ roomCode: normalizedCode, removed: false })
      .sort({ joinedAt: 1, _id: 1 })
      .toArray();
    const allowedIds = new Set(
      allInRoom.slice(0, room.capacity).map((p) => p.participantId)
    );
    if (!allowedIds.has(participantId)) {
      await quizParticipants.deleteOne({ participantId });
      const err = new Error(
        `Room is full (${room.capacity}/${room.capacity} players). Existing players can still reconnect.`
      );
      (err as Error & { statusCode?: number; code?: string }).statusCode = 409;
      (err as Error & { code?: string }).code = 'ROOM_FULL';
      throw err;
    }
  }

  return {
    participant: newParticipant,
    reconnected: false,
    room,
  };
}

/**
 * Submits an answer for the active question in a Live Room.
 *
 * - Uses server timestamps (`now` vs `room.questionOpenedAt` and `room.questionDeadlineAt`).
 * - Rejects late answers (`now > questionDeadlineAt` or `room.status !== 'question_open'`).
 * - Accepts at most ONE valid answer per player per question (enforced by unique index `{ roomCode, participantId, questionIndex }`).
 * - Safe on submission retries: if the player already submitted for this question, returns their existing accepted submission idempotently without double-counting points.
 * - Does NOT leak `correctOptionId` or `explanation` while the question is open.
 */
export async function submitLiveRoomAnswer(params: {
  roomCode: string;
  participantToken: string;
  questionIndex: number;
  selectedOptionId: string;
}): Promise<{
  accepted: boolean;
  duplicateRetry: boolean;
  submittedOptionId: string;
  responseTimeMs: number;
  submittedAt: Date;
}> {
  const { quizRooms, quizVersions, quizParticipants, quizSubmissions } =
    await getCollections();
  const normalizedCode = params.roomCode.trim().toUpperCase();
  const serverReceivedAt = new Date();

  const room = await quizRooms.findOne({ roomCode: normalizedCode });
  if (!room) {
    const err = new Error('Live room not found.');
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }

  const participant = await quizParticipants.findOne({
    roomCode: normalizedCode,
    participantToken: params.participantToken,
    removed: false,
  });
  if (!participant) {
    const err = new Error('Participant session not found or removed.');
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  // Check if an answer was already recorded for this participant & questionIndex (Idempotent retry check)
  const existingSub = await quizSubmissions.findOne({
    roomCode: normalizedCode,
    participantId: participant.participantId,
    questionIndex: params.questionIndex,
  });
  if (existingSub) {
    return {
      accepted: true,
      duplicateRetry: true,
      submittedOptionId: existingSub.selectedOptionId,
      responseTimeMs: existingSub.responseTimeMs,
      submittedAt: existingSub.submittedAt,
    };
  }

  // Validate active question & server deadline timestamp
  if (
    room.status !== 'question_open' ||
    room.currentQuestionIndex !== params.questionIndex
  ) {
    const err = new Error('Question is closed. Late answers are not accepted.');
    (err as Error & { statusCode?: number; code?: string }).statusCode = 409;
    (err as Error & { code?: string }).code = 'LATE_SUBMISSION';
    throw err;
  }

  if (
    room.questionDeadlineAt &&
    serverReceivedAt.getTime() > new Date(room.questionDeadlineAt).getTime()
  ) {
    // Trigger state machine transition to lock & reveal
    await syncLiveRoomStateMachine(normalizedCode);
    const err = new Error('Answer timer expired on the server. Late answer rejected.');
    (err as Error & { statusCode?: number; code?: string }).statusCode = 409;
    (err as Error & { code?: string }).code = 'LATE_SUBMISSION';
    throw err;
  }

  const quizVersion = await quizVersions.findOne({ versionId: room.versionId });
  if (!quizVersion) {
    throw new Error('Quiz version not found.');
  }

  const question = quizVersion.questions[params.questionIndex];
  if (!question) {
    const err = new Error('Invalid question index.');
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const normalizedOptionId = params.selectedOptionId.trim().toUpperCase();
  const validOption = question.options.some((o) => o.optionId === normalizedOptionId);
  if (!validOption) {
    const err = new Error(`Invalid option ID "${normalizedOptionId}".`);
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }

  const openedAtMs = room.questionOpenedAt
    ? new Date(room.questionOpenedAt).getTime()
    : serverReceivedAt.getTime();
  const responseTimeMs = Math.max(0, serverReceivedAt.getTime() - openedAtMs);
  const isCorrect = normalizedOptionId === question.correctOptionId;

  const scoreRes = calculateQuestionScore({
    isCorrect,
    responseTimeMs,
    timeLimitSeconds: question.timeLimitSeconds || quizVersion.defaultTimeSeconds || 20,
    previousStreak: participant.currentStreak,
    rules: room.scoringRules,
  });

  const submissionDoc = {
    submissionId: `SUB-${normalizedCode}-${participant.participantId}-Q${params.questionIndex}`,
    roomCode: normalizedCode,
    sessionType: 'live' as const,
    quizId: room.quizId,
    versionId: room.versionId,
    participantId: participant.participantId,
    userId: participant.userId || null,
    questionIndex: params.questionIndex,
    questionId: question.questionId,
    selectedOptionId: normalizedOptionId,
    isCorrect: scoreRes.isCorrect,
    responseTimeMs,
    basePointsEarned: scoreRes.basePointsEarned,
    speedBonusEarned: scoreRes.speedBonusEarned,
    streakBonusEarned: scoreRes.streakBonusEarned,
    totalPointsEarned: scoreRes.totalPointsEarned,
    streakAfterAnswer: scoreRes.streakAfterAnswer,
    submittedAt: serverReceivedAt,
  };

  try {
    await quizSubmissions.insertOne(submissionDoc);
  } catch (err) {
    // Handle concurrent duplicate retry caught by unique index `{ roomCode, participantId, questionIndex }`
    if ((err as { code?: number })?.code === 11000) {
      const concurrentSub = await quizSubmissions.findOne({
        roomCode: normalizedCode,
        participantId: participant.participantId,
        questionIndex: params.questionIndex,
      });
      if (concurrentSub) {
        return {
          accepted: true,
          duplicateRetry: true,
          submittedOptionId: concurrentSub.selectedOptionId,
          responseTimeMs: concurrentSub.responseTimeMs,
          submittedAt: concurrentSub.submittedAt,
        };
      }
    }
    throw err;
  }

  // Atomically update participant score, accuracy counters, cumulative correct time, and streak
  const nextMaxStreak = Math.max(participant.maxStreak, scoreRes.streakAfterAnswer);
  await quizParticipants.updateOne(
    { participantId: participant.participantId },
    {
      $inc: {
        totalPoints: scoreRes.totalPointsEarned,
        correctCount: scoreRes.isCorrect ? 1 : 0,
        answeredCount: 1,
        cumulativeCorrectTimeMs: scoreRes.isCorrect ? responseTimeMs : 0,
      },
      $set: {
        currentStreak: scoreRes.streakAfterAnswer,
        maxStreak: nextMaxStreak,
        lastSeenAt: serverReceivedAt,
      },
    }
  );

  return {
    accepted: true,
    duplicateRetry: false,
    submittedOptionId: normalizedOptionId,
    responseTimeMs,
    submittedAt: serverReceivedAt,
  };
}
