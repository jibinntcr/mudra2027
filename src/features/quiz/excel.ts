import * as XLSX from 'xlsx';
import type {
  QuizQuestionItem,
  QuizQuestionType,
  QuizOptionItem,
  LinkedDocumentRef,
} from '@/lib/db/types';
import { getCollections } from '@/lib/db/client';
import { normalizeDocNumber } from '@/lib/validation/normalize';

export interface ExcelQuestionRowPreview {
  rowNumber: number; // 1-based Excel row index (header is row 1, first data row is 2)
  rawType: string;
  type: QuizQuestionType;
  promptEn: string;
  promptMl: string;
  options: QuizOptionItem[];
  correctOptionId: string;
  explanationEn: string;
  explanationMl: string;
  linkedDocRefRaw: string;
  resolvedDocument: LinkedDocumentRef | null;
  timeLimitSeconds: number;
  errors: string[];
  isValid: boolean;
}

export interface ExcelPreviewResponse {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  canImport: boolean;
  rows: ExcelQuestionRowPreview[];
}

export const EXCEL_TEMPLATE_HEADERS = [
  'QuestionType',
  'QuestionEn',
  'QuestionMl',
  'OptionA_En',
  'OptionA_Ml',
  'OptionB_En',
  'OptionB_Ml',
  'OptionC_En',
  'OptionC_Ml',
  'OptionD_En',
  'OptionD_Ml',
  'CorrectAnswer',
  'ExplanationEn',
  'ExplanationMl',
  'LinkedPdfReference',
  'TimeLimitSeconds',
];

/**
 * Generates an `.xlsx` template buffer with bilingual Malayalam + English sample rows
 * covering both `single_choice` and `true_false` questions with linked Mudra PDF references.
 */
export function generateQuizExcelTemplateBuffer(): Buffer {
  const sampleRows = [
    EXCEL_TEMPLATE_HEADERS,
    [
      'single_choice',
      'Under Section 25 of the Kerala Stamp Act, which mortgage liabilities are added to consideration on a sale deed?',
      'കൈമാറ്റ ആധാരങ്ങളിൽ പണയ ബാദ്ധ്യത സംബന്ധിച്ച വിവരം ചേർത്തിട്ടുള്ളപ്പോൾ വകുപ്പ് 25 പ്രകാരം ഏത് തുകകളാണ് പ്രതിഫലത്തിനൊപ്പം ചേർക്കേണ്ടത്?',
      'Only unpaid mortgage money and unpaid interest',
      'Unpaid mortgage money, unpaid interest എന്നിവ മാത്രം',
      'Entire original mortgage loan amount',
      'മൊത്തം പണയ തുക മുഴുവൻ',
      'Double the fair value of the property',
      'വസ്തുവിന്റെ ഇരട്ടി ന്യായവില',
      'No stamp duty is payable on mortgaged land',
      'പണയ വസ്തുവിന് മുദ്രവില ആവശ്യമില്ല',
      'A',
      'As per Order IGR/5897/2024-RR2 dated 24/02/2025, only unpaid mortgage principal and unpaid interest are added to consideration under Section 25.',
      'IGR/5897/2024-RR2 ഉത്തരവ് പ്രകാരം Unpaid mortgage money, unpaid interest എന്നീ തുകകൾ മാത്രമേ വകുപ്പ് 25 പ്രകാരം പ്രതിഫലത്തിനൊപ്പം ചേർക്കേണ്ടതുള്ളൂ.',
      'IGR/5897/2024-RR2',
      25,
    ],
    [
      'true_false',
      'Does a land parcel whose prior deed recorded "Nilam" and current status is "Purayidam" require excess stamp duty upon registration?',
      'മുന്നാധാരത്തിൽ "നിലം" എന്നും ഇപ്പോൾ "പുരയിടം" എന്നും രേഖപ്പെടുത്തിയിട്ടുള്ള ആധാരത്തിന് അധിക മുദ്രവില ആവശ്യമുണ്ടോ?',
      'True (Excess stamp duty required)',
      'ശരി (അധിക മുദ്രവില ആവശ്യമാണ്)',
      'False (No excess stamp duty required)',
      'തെറ്റ് (അധിക മുദ്രവില ആവശ്യമില്ല)',
      '',
      '',
      '',
      '',
      'FALSE',
      'Order LR/3322/2022-LR(A3) clarifies that no additional stamp duty is required solely because the classification changed from Nilam in the prior deed to Purayidam.',
      'LR/3322/2022-LR(A3) ഉത്തരവ് പ്രകാരം മുന്നാധാരത്തിൽ നിലം എന്നും ഇപ്പോൾ പുരയിടം എന്നും രേഖപ്പെടുത്തിയ ആധാരത്തിന് അധിക മുദ്രവില ആവശ്യമില്ല.',
      'LR/3322/2022-LR',
      20,
    ],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sampleRows);
  worksheet['!cols'] = EXCEL_TEMPLATE_HEADERS.map((h) => ({
    wch: h.includes('Question') || h.includes('Explanation') ? 42 : 22,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mudra_Quiz_Questions');

  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}

/**
 * Parses and validates an uploaded `.xlsx` file buffer for bulk question import.
 * Reports exact Excel row numbers and specific validation errors before any database write.
 */
export async function parseAndValidateQuizExcel(
  fileBuffer: Buffer,
  defaultTimeSeconds = 20
): Promise<ExcelPreviewResponse> {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 1,
      canImport: false,
      rows: [
        {
          rowNumber: 1,
          rawType: '',
          type: 'single_choice',
          promptEn: '',
          promptMl: '',
          options: [],
          correctOptionId: '',
          explanationEn: '',
          explanationMl: '',
          linkedDocRefRaw: '',
          resolvedDocument: null,
          timeLimitSeconds: defaultTimeSeconds,
          errors: ['Workbook contains no sheets.'],
          isValid: false,
        },
      ],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawMatrix = XLSX.utils.sheet_to_json< unknown[] >(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawMatrix.length < 2) {
    return {
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
      canImport: false,
      rows: [],
    };
  }

  const headerRow = (rawMatrix[0] || []).map((c) => String(c || '').trim());
  const colIndex = (name: string) =>
    headerRow.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idxType = colIndex('QuestionType');
  const idxQEn = colIndex('QuestionEn');
  const idxQMl = colIndex('QuestionMl');
  const idxAEn = colIndex('OptionA_En');
  const idxAMl = colIndex('OptionA_Ml');
  const idxBEn = colIndex('OptionB_En');
  const idxBMl = colIndex('OptionB_Ml');
  const idxCEn = colIndex('OptionC_En');
  const idxCMl = colIndex('OptionC_Ml');
  const idxDEn = colIndex('OptionD_En');
  const idxDMl = colIndex('OptionD_Ml');
  const idxCorrect = colIndex('CorrectAnswer');
  const idxExpEn = colIndex('ExplanationEn');
  const idxExpMl = colIndex('ExplanationMl');
  const idxPdf = colIndex('LinkedPdfReference');
  const idxTime = colIndex('TimeLimitSeconds');

  const { documents } = await getCollections();
  const allDocs = await documents
    .find(
      {},
      {
        projection: {
          docId: 1,
          slug: 1,
          documentNumber: 1,
          normalizedDocNumber: 1,
          titleEn: 1,
          titleMl: 1,
        },
      }
    )
    .toArray();

  const resolvePdfRef = (refRaw: string): LinkedDocumentRef | null => {
    const trimmed = refRaw.trim();
    if (!trimmed) return null;
    const norm = normalizeDocNumber(trimmed).normalized;
    const found = allDocs.find(
      (d) =>
        d.docId.toLowerCase() === trimmed.toLowerCase() ||
        d.slug.toLowerCase() === trimmed.toLowerCase() ||
        d.documentNumber.toLowerCase() === trimmed.toLowerCase() ||
        (norm.length >= 3 && d.normalizedDocNumber === norm)
    );
    if (!found) return null;
    return {
      docId: found.docId,
      slug: found.slug,
      documentNumber: found.documentNumber,
      titleEn: found.titleEn,
      titleMl: found.titleMl,
    };
  };

  const rows: ExcelQuestionRowPreview[] = [];

  for (let r = 1; r < rawMatrix.length; r++) {
    const rowCells = rawMatrix[r] || [];
    const excelRowNumber = r + 1;
    const getCell = (idx: number) => (idx >= 0 ? String(rowCells[idx] ?? '').trim() : '');

    const rawType = getCell(idxType).toLowerCase();
    const promptEn = getCell(idxQEn);
    const promptMl = getCell(idxQMl);
    const optAEn = getCell(idxAEn);
    const optAMl = getCell(idxAMl);
    const optBEn = getCell(idxBEn);
    const optBMl = getCell(idxBMl);
    const optCEn = getCell(idxCEn);
    const optCMl = getCell(idxCMl);
    const optDEn = getCell(idxDEn);
    const optDMl = getCell(idxDMl);
    const rawCorrect = getCell(idxCorrect).toUpperCase();
    const explanationEn = getCell(idxExpEn);
    const explanationMl = getCell(idxExpMl);
    const linkedDocRefRaw = getCell(idxPdf);
    const rawTime = getCell(idxTime);

    // Skip completely empty rows
    if (!rawType && !promptEn && !promptMl && !rawCorrect) {
      continue;
    }

    const errors: string[] = [];

    // 1. Validate question type
    let type: QuizQuestionType = 'single_choice';
    if (
      rawType === 'single_choice' ||
      rawType === 'mcq' ||
      rawType === 'multiple_choice' ||
      rawType === 'single'
    ) {
      type = 'single_choice';
    } else if (
      rawType === 'true_false' ||
      rawType === 'boolean' ||
      rawType === 'tf' ||
      rawType === 'true/false'
    ) {
      type = 'true_false';
    } else {
      errors.push(
        `Invalid QuestionType "${rawType || '(empty)'}". Expected "single_choice" or "true_false".`
      );
    }

    // 2. Validate prompt (either or both languages allowed, at least one required)
    if (!promptEn && !promptMl) {
      errors.push('Question prompt is missing. Provide QuestionEn, QuestionMl, or both.');
    }

    const hasEnPrompt = Boolean(promptEn);
    const hasMlPrompt = Boolean(promptMl);

    // 3. Build options with stable optionIds
    const options: QuizOptionItem[] = [];
    if (type === 'true_false') {
      options.push(
        {
          optionId: 'TRUE',
          textEn: optAEn || 'True',
          textMl: optAMl || 'ശരി (True)',
        },
        {
          optionId: 'FALSE',
          textEn: optBEn || 'False',
          textMl: optBMl || 'തെറ്റ് (False)',
        }
      );
    } else {
      const rawOptionPairs = [
        { id: 'A', en: optAEn, ml: optAMl },
        { id: 'B', en: optBEn, ml: optBMl },
        { id: 'C', en: optCEn, ml: optCMl },
        { id: 'D', en: optDEn, ml: optDMl },
      ];

      for (const pair of rawOptionPairs) {
        if (pair.en || pair.ml) {
          // If both languages are authored on the question, check matching translation
          if (hasEnPrompt && hasMlPrompt && (!pair.en || !pair.ml)) {
            errors.push(
              `Option ${pair.id} is missing a matching translation (${
                !pair.en ? 'English empty' : 'Malayalam empty'
              }).`
            );
          }
          options.push({
            optionId: pair.id,
            textEn: pair.en,
            textMl: pair.ml,
          });
        }
      }

      if (options.length < 2) {
        errors.push('Multiple-choice questions require at least 2 answer choices (Option A and Option B).');
      }
    }

    // 4. Validate correct answer optionId
    let normalizedCorrect = rawCorrect;
    if (type === 'true_false') {
      if (rawCorrect === 'A' || rawCorrect === 'T' || rawCorrect === 'TRUE' || rawCorrect === '1') {
        normalizedCorrect = 'TRUE';
      } else if (
        rawCorrect === 'B' ||
        rawCorrect === 'F' ||
        rawCorrect === 'FALSE' ||
        rawCorrect === '0'
      ) {
        normalizedCorrect = 'FALSE';
      }
    }

    const matchingOpt = options.find((o) => o.optionId === normalizedCorrect);
    if (!matchingOpt) {
      errors.push(
        `CorrectAnswer "${rawCorrect || '(empty)'}" does not match any available option (${options
          .map((o) => o.optionId)
          .join(', ')}).`
      );
    }

    // 5. Validate optional linked PDF reference
    let resolvedDocument: LinkedDocumentRef | null = null;
    if (linkedDocRefRaw) {
      resolvedDocument = resolvePdfRef(linkedDocRefRaw);
      if (!resolvedDocument) {
        errors.push(
          `LinkedPdfReference "${linkedDocRefRaw}" was not found in the Mudra library catalogue.`
        );
      }
    }

    // 6. Validate time limit
    let timeLimitSeconds = defaultTimeSeconds;
    if (rawTime) {
      const parsedTime = Number(rawTime);
      if (!Number.isFinite(parsedTime) || parsedTime < 5 || parsedTime > 300) {
        errors.push(`TimeLimitSeconds "${rawTime}" must be a number between 5 and 300 seconds.`);
      } else {
        timeLimitSeconds = Math.round(parsedTime);
      }
    }

    rows.push({
      rowNumber: excelRowNumber,
      rawType,
      type,
      promptEn,
      promptMl,
      options,
      correctOptionId: matchingOpt ? normalizedCorrect : rawCorrect,
      explanationEn,
      explanationMl,
      linkedDocRefRaw,
      resolvedDocument,
      timeLimitSeconds,
      errors,
      isValid: errors.length === 0,
    });
  }

  const validRowsCount = rows.filter((r) => r.isValid).length;
  const invalidRowsCount = rows.length - validRowsCount;

  return {
    totalRows: rows.length,
    validRowsCount,
    invalidRowsCount,
    canImport: rows.length > 0 && invalidRowsCount === 0,
    rows,
  };
}

/**
 * Converts validated Excel preview rows into `QuizQuestionItem[]`.
 */
export function convertPreviewRowsToQuestions(
  rows: ExcelQuestionRowPreview[],
  startOrder = 1
): QuizQuestionItem[] {
  return rows
    .filter((r) => r.isValid)
    .map((r, idx) => ({
      questionId: `Q-${Date.now()}-${idx + 1}`,
      order: startOrder + idx,
      type: r.type,
      promptEn: r.promptEn,
      promptMl: r.promptMl,
      options: r.options,
      correctOptionId: r.correctOptionId,
      explanationEn: r.explanationEn,
      explanationMl: r.explanationMl,
      timeLimitSeconds: r.timeLimitSeconds,
      linkedDocId: r.resolvedDocument?.docId || null,
      linkedDocSnapshot: r.resolvedDocument || null,
    }));
}

/**
 * Generates an `.xlsx` Report workbook for a Live Room or Quiz containing:
 * Sheet 1: Participant Results (Rank, Display Name, Type, Score, Correct, Answered, Accuracy %, Total Response Time ms, Max Streak)
 * Sheet 2: Question Breakdown (Q#, Question EN/ML, Type, Correct Option, Total Responses, Correct %, Option Distribution)
 */
export function generateRoomReportExcelBuffer(params: {
  roomCode: string;
  quizTitleEn: string;
  quizTitleMl: string;
  mode: string;
  completedAt?: Date | null;
  participants: Array<{
    rank: number;
    displayName: string;
    loginId?: string | null;
    isGuest: boolean;
    totalPoints: number;
    correctCount: number;
    answeredCount: number;
    totalQuestions: number;
    accuracyPercent: number;
    cumulativeCorrectTimeMs: number;
    maxStreak: number;
  }>;
  questionBreakdowns: Array<{
    questionNumber: number;
    promptEn: string;
    promptMl: string;
    type: string;
    correctOptionId: string;
    totalAnswers: number;
    correctAnswers: number;
    accuracyPercent: number;
    optionCounts: Record<string, number>;
  }>;
}): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Participant Results
  const participantRows: unknown[][] = [
    [
      'Rank',
      'Display Name',
      'Account / Type',
      'Total Score',
      'Correct Answers',
      'Questions Answered',
      'Total Questions',
      'Accuracy (%)',
      'Cumulative Correct Time (ms)',
      'Best Streak',
    ],
    ...params.participants.map((p) => [
      p.rank,
      p.displayName,
      p.isGuest ? 'Guest' : p.loginId || 'Reader',
      p.totalPoints,
      p.correctCount,
      p.answeredCount,
      p.totalQuestions,
      p.accuracyPercent,
      p.cumulativeCorrectTimeMs,
      p.maxStreak,
    ]),
  ];

  const wsParticipants = XLSX.utils.aoa_to_sheet(participantRows);
  wsParticipants['!cols'] = [
    { wch: 8 },
    { wch: 26 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 18 },
    { wch: 15 },
    { wch: 14 },
    { wch: 26 },
    { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, wsParticipants, 'Participant_Results');

  // Sheet 2: Question Breakdown
  const questionRows: unknown[][] = [
    [
      'Q#',
      'Question (English)',
      'Question (Malayalam)',
      'Type',
      'Correct Option',
      'Total Responses',
      'Correct Responses',
      'Correct (%)',
      'Option Distribution',
    ],
    ...params.questionBreakdowns.map((q) => [
      q.questionNumber,
      q.promptEn,
      q.promptMl,
      q.type,
      q.correctOptionId,
      q.totalAnswers,
      q.correctAnswers,
      q.accuracyPercent,
      Object.entries(q.optionCounts)
        .map(([optId, cnt]) => `${optId}: ${cnt}`)
        .join(' | '),
    ]),
  ];

  const wsQuestions = XLSX.utils.aoa_to_sheet(questionRows);
  wsQuestions['!cols'] = [
    { wch: 6 },
    { wch: 44 },
    { wch: 44 },
    { wch: 15 },
    { wch: 15 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 32 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, 'Question_Breakdown');

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}
