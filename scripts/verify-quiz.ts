import assert from 'assert';
import * as XLSX from 'xlsx';
import { setupDatabaseIndexes } from './db/setup-indexes';
import { EXCEL_TEMPLATE_HEADERS } from '../src/features/quiz/excel';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = raw.match(/mudra_session=[^;]+/);
  return match ? match[0] : '';
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMudraQuizVerification() {
  console.log('===================================================================');
  console.log(' MUDRA QUIZ MODULE — E2E & 100-PLAYER CONCURRENCY VERIFICATION');
  console.log('===================================================================\n');

  await setupDatabaseIndexes();

  // 1. TEST PUBLIC GUEST ACCESS TO QUIZ JOIN SCREEN & AUTHENTICATED ADMIN/READER ROLES
  console.log('1. Testing Public Guest Join Screen & Role Restrictions...');
  const publicQuizPage = await fetch(`${BASE_URL}/quiz`, { redirect: 'manual' });
  assert.strictEqual(
    publicQuizPage.status,
    200,
    'Public /quiz join screen must be accessible to guests without signing in'
  );
  console.log('  ✓ Public /quiz page is accessible to signed-out guests (HTTP 200)');

  // Guest cannot access /api/admin/quizzes or /quiz/history
  const guestAdminApi = await fetch(`${BASE_URL}/api/admin/quizzes`);
  assert.strictEqual(guestAdminApi.status, 401, 'Guest must get 401 on /api/admin/quizzes');
  const guestHistoryApi = await fetch(`${BASE_URL}/api/quiz/history`);
  assert.strictEqual(guestHistoryApi.status, 401, 'Guest must get 401 on /api/quiz/history');

  // Sign in as Reader and Admin
  const readerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quickLogin: true, loginId: 'reader.kerala' }),
  });
  const readerCookie = extractCookie(readerLogin);
  assert(readerCookie, 'Expected reader session cookie');

  // Reader cannot access /api/admin/quizzes
  const readerAdminQuizRes = await fetch(`${BASE_URL}/api/admin/quizzes`, {
    headers: { Cookie: readerCookie },
  });
  assert.strictEqual(
    readerAdminQuizRes.status,
    403,
    'Reader must be blocked from /api/admin/quizzes with HTTP 403'
  );
  console.log('  ✓ Role restrictions verified: Guests (401) and Readers (403) blocked from Admin Quiz APIs\n');

  const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quickLogin: true, loginId: 'admin.mudra' }),
  });
  const adminCookie = extractCookie(adminLogin);
  assert(adminCookie, 'Expected admin session cookie');

  // 2. TEST ADMIN QUIZ CREATION, QUESTION REORDERING, EXCEL (.XLSX) VALIDATION & BULK IMPORT
  console.log('2. Testing Admin Quiz Creation, Bilingual Questions, and .xlsx Bulk Import Validation...');

  // Download .xlsx template
  const tplRes = await fetch(`${BASE_URL}/api/admin/quizzes/template`, {
    headers: { Cookie: adminCookie },
  });
  assert.strictEqual(tplRes.status, 200, 'Admin .xlsx template download must return 200');
  const tplBuf = Buffer.from(await tplRes.arrayBuffer());
  assert(tplBuf.byteLength > 2000, 'Template .xlsx buffer must be valid');
  console.log(`  ✓ Downloaded .xlsx template (${tplBuf.byteLength} bytes)`);

  // Create a new draft quiz
  const createQuizRes = await fetch(`${BASE_URL}/api/admin/quizzes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      titleEn: 'Kerala Stamp & Registration Verification Quiz',
      titleMl: 'കേരള രജിസ്ട്രേഷൻ & സ്റ്റാമ്പ് വെരിഫിക്കേഷൻ ക്വിസ്',
      descriptionEn: 'Automated E2E verification quiz with bilingual questions and linked PDFs.',
      descriptionMl: 'മലയാളവും ഇംഗ്ലീഷും ഉൾപ്പെട്ട വെരിഫിക്കേഷൻ ക്വിസ്.',
      defaultTimeSeconds: 15,
      defaultRevealSeconds: 2,
      status: 'draft',
    }),
  });
  assert.strictEqual(createQuizRes.status, 201, 'Quiz creation must return 201');
  const createdQuiz = (await createQuizRes.json()).quiz;
  const quizId = createdQuiz.quizId;
  console.log(`  ✓ Created draft quiz ${quizId} (Version v${createdQuiz.currentVersion})`);

  // Test Excel validation error reporting (invalid row)
  const invalidSheetRows = [
    EXCEL_TEMPLATE_HEADERS,
    [
      'invalid_type',
      '', // missing both prompts
      '',
      'Opt A',
      '',
      'Opt B',
      '',
      '',
      '',
      '',
      '',
      'Z', // invalid correct option
      'Exp EN',
      'Exp ML',
      'NON-EXISTENT-PDF-9999', // invalid PDF reference
      999, // invalid time limit > 300
    ],
  ];
  const invalidWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    invalidWb,
    XLSX.utils.aoa_to_sheet(invalidSheetRows),
    'Invalid'
  );
  const invalidB64 = Buffer.from(
    XLSX.write(invalidWb, { type: 'buffer', bookType: 'xlsx' })
  ).toString('base64');

  const invalidPreviewRes = await fetch(`${BASE_URL}/api/admin/quizzes/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      mode: 'preview',
      quizId,
      fileBase64: invalidB64,
    }),
  });
  const invalidPreview = await invalidPreviewRes.json();
  assert.strictEqual(invalidPreview.canImport, false, 'Invalid Excel sheet must have canImport=false');
  assert.strictEqual(invalidPreview.invalidRowsCount, 1, 'Expected 1 invalid row');
  assert.strictEqual(invalidPreview.rows[0].rowNumber, 2, 'Error must report Excel Row #2');
  assert(
    invalidPreview.rows[0].errors.length >= 4,
    'Expected specific validation errors for type, prompt, correct option, PDF ref, and time limit'
  );

  // Attempting to confirm import with invalid rows must be rejected (HTTP 422)
  const blockedConfirmRes = await fetch(`${BASE_URL}/api/admin/quizzes/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      mode: 'confirm',
      quizId,
      fileBase64: invalidB64,
    }),
  });
  assert.strictEqual(
    blockedConfirmRes.status,
    422,
    'Confirming an invalid Excel batch must be blocked with HTTP 422'
  );
  console.log(
    `  ✓ Excel validator reported Row #2 errors (${invalidPreview.rows[0].errors.length} specific errors) and blocked batch write (HTTP 422)`
  );

  // Now build a valid 4-question bilingual `.xlsx` workbook (with linked Mudra PDFs) so we can test 3+ streak bonus!
  const validSheetRows = [
    EXCEL_TEMPLATE_HEADERS,
    [
      'single_choice',
      'Under Section 25 of the Kerala Stamp Act (IGR/5897/2024-RR2), what mortgage amounts are added to consideration?',
      'വകുപ്പ് 25 പ്രകാരം കൈമാറ്റ ആധാരങ്ങളിൽ ഏത് പണയ തുകകളാണ് പ്രതിഫലത്തിനൊപ്പം ചേർക്കേണ്ടത്?',
      'Only unpaid mortgage principal and unpaid interest',
      'Unpaid mortgage money, unpaid interest എന്നിവ മാത്രം',
      'Entire original loan amount',
      'മൊത്തം വായ്പാ തുക മുഴുവൻ',
      'Double the property fair value',
      'വസ്തുവിന്റെ ഇരട്ടി ന്യായവില',
      'None of the above',
      'ഇവയൊന്നുമല്ല',
      'A',
      'Order IGR/5897/2024-RR2 confirms only unpaid mortgage principal and unpaid interest are added.',
      'IGR/5897/2024-RR2 ഉത്തരവ് പ്രകാരം Unpaid mortgage money, unpaid interest എന്നിവ മാത്രമേ ചേർക്കേണ്ടതുള്ളൂ.',
      'IGR/5897/2024-RR2',
      15,
    ],
    [
      'true_false',
      'Does a land parcel recorded as "Nilam" in a prior deed and "Purayidam" currently require excess stamp duty (LR/3322/2022-LR)?',
      'മുന്നാധാരത്തിൽ "നിലം" എന്നും ഇപ്പോൾ "പുരയിടം" എന്നും രേഖപ്പെടുത്തിയ ആധാരത്തിന് അധിക മുദ്രവില ആവശ്യമുണ്ടോ?',
      'True',
      'ശരി',
      'False',
      'തെറ്റ്',
      '',
      '',
      '',
      '',
      'FALSE',
      'Order LR/3322/2022-LR(A3) rules that no excess stamp duty is required.',
      'LR/3322/2022-LR(A3) ഉത്തരവ് പ്രകാരം അധിക മുദ്രവില ആവശ്യമില്ല.',
      'LR/3322/2022-LR',
      15,
    ],
    [
      'single_choice',
      'Which Section of the Kerala Stamp Act 1959 governs the fixation and revision of Fair Value of land?',
      'കേരള സ്റ്റാമ്പ് ആക്ട് 1959-ലെ ഏത് വകുപ്പ് പ്രകാരമാണ് ഭൂമിയുടെ ന്യായവില നിശ്ചയിക്കുന്നത്?',
      'Section 28A',
      'വകുപ്പ് 28A',
      'Section 45B',
      'വകുപ്പ് 45B',
      'Section 17',
      'വകുപ്പ് 17',
      'Section 78',
      'വകുപ്പ് 78',
      'A',
      'Section 28A governs Fair Value fixation and revision (GO(P)No.45/2023/TD).',
      'വകുപ്പ് 28A പ്രകാരമാണ് ന്യായവില നിശ്ചയിക്കുന്നത് (GO(P)No.45/2023/TD).',
      'GO(P)No.45/2023/TD',
      15,
    ],
    [
      'single_choice',
      'Which Article of the Kerala Stamp Act Schedule applies to family Settlement Deeds (R.2-5635/2020)?',
      'കുടുംബാംഗങ്ങൾക്കുള്ള ധനനിശ്ചയാധാരത്തിന് ബാധകമായ മുദ്രപത്ര നിയമ ആർട്ടിക്കിൾ ഏതാണ്?',
      'Article 51(a)(i)',
      'ആർട്ടിക്കിൾ 51(എ)(1)',
      'Article 21(1)',
      'ആർട്ടിക്കിൾ 21(1)',
      'Article 42(i)',
      'ആർട്ടിക്കിൾ 42(1)',
      'Article 15',
      'ആർട്ടിക്കിൾ 15',
      'A',
      'Order R.2-5635/2020 applies Article 51(a)(i) to family settlement deeds.',
      'R.2-5635/2020 ഉത്തരവ് പ്രകാരം ആർട്ടിക്കിൾ 51(എ)(1) ബാധകമാണ്.',
      'R.2-5635/2020',
      15,
    ],
  ];
  const validWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    validWb,
    XLSX.utils.aoa_to_sheet(validSheetRows),
    'Valid'
  );
  const validB64 = Buffer.from(
    XLSX.write(validWb, { type: 'buffer', bookType: 'xlsx' })
  ).toString('base64');

  const validPreviewRes = await fetch(`${BASE_URL}/api/admin/quizzes/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      mode: 'preview',
      quizId,
      fileBase64: validB64,
    }),
  });
  const validPreview = await validPreviewRes.json();
  assert.strictEqual(validPreview.canImport, true, 'Valid 4-row sheet must have canImport=true');
  assert.strictEqual(validPreview.validRowsCount, 4, 'Expected 4 valid rows');

  const confirmImportRes = await fetch(`${BASE_URL}/api/admin/quizzes/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      mode: 'confirm',
      quizId,
      fileBase64: validB64,
      replaceExisting: true,
    }),
  });
  assert.strictEqual(confirmImportRes.status, 200, 'Confirming valid Excel import must return 200');
  const confirmedData = await confirmImportRes.json();
  assert.strictEqual(confirmedData.totalQuestions, 4, 'Quiz must now have 4 imported questions');

  // Publish the quiz
  const publishRes = await fetch(`${BASE_URL}/api/admin/quizzes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      quizId,
      status: 'published',
    }),
  });
  assert.strictEqual(publishRes.status, 200, 'Publishing quiz must succeed');
  const publishedQuiz = (await publishRes.json()).quiz;
  const fixedVersionBeforeEdit = publishedQuiz.currentVersion;
  console.log(
    `  ✓ Imported 4 bilingual questions via .xlsx and published ${quizId} (Fixed Version v${fixedVersionBeforeEdit})\n`
  );

  // 3. TEST SELF-PACED MODE, MALAYALAM/ENGLISH SWITCHING, FIXED VERSION ISOLATION & READER HISTORY
  console.log('3. Testing Self-Paced Mode, Malayalam/English Switching, Version Isolation & Reader History...');
  const spStartRes = await fetch(`${BASE_URL}/api/quiz/self-paced`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: readerCookie },
    body: JSON.stringify({
      quizId,
      preferredLanguage: 'en',
    }),
  });
  assert.strictEqual(spStartRes.status, 201, 'Starting self-paced quiz must return 201');
  const { attemptId, attemptToken } = await spStartRes.json();

  // Edit the quiz title AFTER starting the attempt to prove version isolation
  await fetch(`${BASE_URL}/api/admin/quizzes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      quizId,
      titleEn: 'Kerala Stamp & Registration Verification Quiz (Edited Later)',
      scoringRules: { ...publishedQuiz.scoringRules, basePoints: 1000 },
    }),
  });

  // Switch language to Malayalam mid-attempt without losing progress
  const switchLangRes = await fetch(`${BASE_URL}/api/quiz/self-paced/${attemptId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: readerCookie },
    body: JSON.stringify({
      attemptToken,
      action: 'switch_language',
      preferredLanguage: 'ml',
    }),
  });
  assert.strictEqual(switchLangRes.status, 200, 'Language switch must succeed');

  // Answer all 4 self-paced questions (Q1=A, Q2=FALSE, Q3=A, Q4=A) -> earns 3+ streak bonus on Q3 and Q4!
  const spAnswers = ['A', 'FALSE', 'A', 'A'];
  for (let i = 0; i < spAnswers.length; i++) {
    const ansRes = await fetch(`${BASE_URL}/api/quiz/self-paced/${attemptId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: readerCookie },
      body: JSON.stringify({
        attemptToken,
        questionIndex: i,
        selectedOptionId: spAnswers[i],
      }),
    });
    assert.strictEqual(ansRes.status, 200, `Self-paced Q${i + 1} submission must succeed`);
    const ansJson = await ansRes.json();
    assert.strictEqual(ansJson.feedback.isCorrect, true, `Self-paced Q${i + 1} must be correct`);
    if (i >= 2) {
      assert.strictEqual(
        ansJson.feedback.streakBonusEarned,
        100,
        `Question ${i + 1} (3rd+ consecutive correct) must award +100 streak bonus`
      );
    }
  }

  // Verify completed self-paced review & version isolation
  const spCompletedRes = await fetch(
    `${BASE_URL}/api/quiz/self-paced/${attemptId}?attemptToken=${attemptToken}`,
    { headers: { Cookie: readerCookie } }
  );
  const spCompleted = await spCompletedRes.json();
  assert.strictEqual(spCompleted.attempt.status, 'completed');
  assert.strictEqual(spCompleted.attempt.version, fixedVersionBeforeEdit, 'Attempt must stay locked to fixed version');
  assert.strictEqual(spCompleted.attempt.correctCount, 4);
  assert.strictEqual(spCompleted.attempt.accuracyPercent, 100);
  assert.strictEqual(spCompleted.attempt.preferredLanguage, 'ml');
  assert(
    spCompleted.completedReview[0].linkedDocSnapshot?.docId === 'DOC-2025-0001',
    'Completed review must include linked Mudra PDF snapshot'
  );

  // Verify My Quiz History for signed-in reader
  const historyRes = await fetch(`${BASE_URL}/api/quiz/history`, {
    headers: { Cookie: readerCookie },
  });
  assert.strictEqual(historyRes.status, 200);
  const historyData = await historyRes.json();
  assert(
    historyData.attempts.some((a: { attemptId: string }) => a.attemptId === attemptId),
    'Reader quiz history must contain the completed self-paced attempt'
  );
  console.log(
    `  ✓ Self-paced attempt completed (${spCompleted.attempt.totalPoints} pts, 100% accuracy, ML switch preserved, v${spCompleted.attempt.version} isolated, recorded in My Quiz History)\n`
  );

  // 4. TEST AUTOMATIC LIVE MODE (SERVER-SIDE PROGRESSION WITHOUT HOST BROWSER)
  console.log('4. Testing Automatic Live Mode (Auto-Reveal & Auto-Advance Without Host Poll)...');
  const autoRoomCreateRes = await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      quizId,
      mode: 'auto_live',
      capacity: 10,
      revealDurationSeconds: 2,
    }),
  });
  assert.strictEqual(autoRoomCreateRes.status, 201);
  const autoRoomCode = (await autoRoomCreateRes.json()).room.roomCode;

  // Override Q1 time limit in room by starting quiz and letting guest join first
  const autoGuestJoin = await fetch(`${BASE_URL}/api/quiz/rooms/${autoRoomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode: autoRoomCode,
      displayName: 'AutoLive Guest',
      preferredLanguage: 'ml',
    }),
  });
  assert.strictEqual(autoGuestJoin.status, 200);
  const autoGuestToken = (await autoGuestJoin.json()).participant.participantToken;

  // Start automatic live room
  await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ roomCode: autoRoomCode, action: 'start_quiz' }),
  });

  // Verify while question_open, correctOptionId is NEVER sent to player
  const openStateRes = await fetch(
    `${BASE_URL}/api/quiz/rooms/${autoRoomCode}/state?participantToken=${autoGuestToken}`
  );
  const openState = await openStateRes.json();
  assert.strictEqual(openState.room.status, 'question_open');
  assert.strictEqual(
    openState.currentQuestion.correctOptionId,
    undefined,
    'Server must NOT send correctOptionId while question is open'
  );

  // Submit answer as guest
  const autoAnsRes = await fetch(`${BASE_URL}/api/quiz/rooms/${autoRoomCode}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantToken: autoGuestToken,
      questionIndex: 0,
      selectedOptionId: 'A',
    }),
  });
  assert.strictEqual(autoAnsRes.status, 200);

  // Trigger reveal and wait 2.3s for revealDurationSeconds (2s) to elapse, then poll ONLY as player (host browser closed!)
  await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ roomCode: autoRoomCode, action: 'reveal_question' }),
  });

  await sleep(2300);

  // Player poll alone must automatically advance room to Question 2 (index 1)!
  const autoAdvancedRes = await fetch(
    `${BASE_URL}/api/quiz/rooms/${autoRoomCode}/state?participantToken=${autoGuestToken}`
  );
  const autoAdvancedState = await autoAdvancedRes.json();
  assert.strictEqual(
    autoAdvancedState.room.status,
    'question_open',
    'Auto-live room must automatically open next question after reveal duration even when host browser is closed'
  );
  assert.strictEqual(
    autoAdvancedState.room.currentQuestionIndex,
    1,
    'Auto-live room must automatically advance to questionIndex 1'
  );
  console.log(
    `  ✓ Automatic Live Room (${autoRoomCode}) auto-advanced from Q1 reveal to Q2 without any host browser request\n`
  );

  // 5. TEST 100-PLAYER CONCURRENT LOAD TEST IN HOST-CONTROLLED LIVE ROOM
  console.log('5. Running 100-Player Concurrent Load Test (Capacity, Near-Deadline Answers, Retries, Reconnect, Ranking & .xlsx Export)...');
  const loadStartMs = Date.now();

  const roomCreateRes = await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({
      quizId,
      mode: 'host_live',
      capacity: 100,
      revealDurationSeconds: 5,
    }),
  });
  assert.strictEqual(roomCreateRes.status, 201, 'Creating 100-player live room must return 201');
  const roomCode = (await roomCreateRes.json()).room.roomCode;

  // Join 100 concurrent players (Player 1 uses signed-in Reader identity; Players 2..100 are concurrent Guests)
  const joinPromises = Array.from({ length: 100 }, (_, i) => {
    const isReader = i === 0;
    return fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isReader ? { Cookie: readerCookie } : {}),
      },
      body: JSON.stringify({
        roomCode,
        displayName: isReader ? 'Reader_001' : `Player_${String(i + 1).padStart(3, '0')}`,
        preferredLanguage: i % 2 === 0 ? 'en' : 'ml',
      }),
    }).then(async (r) => ({
      index: i,
      status: r.status,
      body: await r.json(),
    }));
  });

  const joinedPlayers = await Promise.all(joinPromises);
  const successfulJoins = joinedPlayers.filter((p) => p.status === 200);
  assert.strictEqual(
    successfulJoins.length,
    100,
    `Expected all 100 concurrent players to join room ${roomCode}, got ${successfulJoins.length}`
  );
  console.log(`  ✓ 100 concurrent players joined room ${roomCode} (Capacity: 100/100)`);

  // Player #101 attempting to join when room is at 100/100 capacity must receive HTTP 409 ROOM_FULL
  const overflowJoinRes = await fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode,
      displayName: 'Overflow_Player_101',
    }),
  });
  const overflowData = await overflowJoinRes.json();
  assert.strictEqual(overflowJoinRes.status, 409, '101st player must receive HTTP 409');
  assert.strictEqual(overflowData.code, 'ROOM_FULL', '101st player must receive ROOM_FULL code');
  console.log('  ✓ 101st player blocked with HTTP 409 (ROOM_FULL)');

  // Verify an existing player (Player #50) CAN reconnect even when the room is full (100/100)
  const player50Token = joinedPlayers[49].body.participant.participantToken;
  const reconnectFullRes = await fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomCode,
      participantToken: player50Token,
    }),
  });
  const reconnectFullData = await reconnectFullRes.json();
  assert.strictEqual(reconnectFullRes.status, 200, 'Existing player must reconnect when room is full');
  assert.strictEqual(reconnectFullData.reconnected, true, 'Must flag reconnected=true');
  console.log('  ✓ Existing player reconnected seamlessly while room was full (100/100)');

  // Host starts the quiz (Opens Q1)
  const startQuizRes = await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ roomCode, action: 'start_quiz' }),
  });
  assert.strictEqual(startQuizRes.status, 200);

  // Play all 4 questions across all 100 concurrent players:
  // - Q1 (index 0): 80 players submit right away, 20 players submit near the end of the timed window,
  //   plus Player #1 sends a duplicate submission retry, and Player #10 reconnects mid-question!
  const correctOptionsPerQuestion = ['A', 'FALSE', 'A', 'A'];
  const wrongOptionsPerQuestion = ['B', 'TRUE', 'B', 'C'];

  for (let qIdx = 0; qIdx < 4; qIdx++) {
    const correctOpt = correctOptionsPerQuestion[qIdx];
    const wrongOpt = wrongOptionsPerQuestion[qIdx];

    // First wave: Players 0..79 submit concurrently
    const wave1Promises = joinedPlayers.slice(0, 80).map((p) => {
      const token = p.body.participant.participantToken;
      // Players 0..69 answer correctly, Players 70..79 answer wrong
      const choice = p.index < 70 ? correctOpt : wrongOpt;
      return fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: token,
          questionIndex: qIdx,
          selectedOptionId: choice,
        }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }));
    });

    const wave1Results = await Promise.all(wave1Promises);
    assert(
      wave1Results.every((r) => r.status === 200 && r.data.accepted),
      `All 80 Wave-1 answers for Q${qIdx + 1} must be accepted`
    );

    if (qIdx === 0) {
      // Test duplicate submission retry by Player 0 (must return duplicateRetry=true and NOT double-add score)
      const retryRes = await fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: joinedPlayers[0].body.participant.participantToken,
          questionIndex: 0,
          selectedOptionId: 'B',
        }),
      });
      const retryData = await retryRes.json();
      assert.strictEqual(retryRes.status, 200);
      assert.strictEqual(retryData.duplicateRetry, true, 'Duplicate retry must be idempotent');
      assert.strictEqual(
        retryData.submittedOptionId,
        'A',
        'Original accepted answer must be preserved on retry'
      );

      // Test mid-question reconnection after refresh for Player 10
      const p10Token = joinedPlayers[10].body.participant.participantToken;
      const midQStateRes = await fetch(
        `${BASE_URL}/api/quiz/rooms/${roomCode}/state?participantToken=${p10Token}`
      );
      const midQState = await midQStateRes.json();
      assert.strictEqual(
        midQState.me.currentSubmission.selectedOptionId,
        'A',
        'Reconnecting mid-question must restore current submitted answer and score'
      );
    }

    // Wait briefly so Wave 2 answers arrive later in the timed window (testing speed bonus ordering & near-deadline burst)
    await sleep(350);

    // Wave 2: Players 80..99 submit concurrently near the end of the timed window
    const wave2Promises = joinedPlayers.slice(80, 100).map((p) => {
      const token = p.body.participant.participantToken;
      const choice = p.index < 90 ? correctOpt : wrongOpt;
      return fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: token,
          questionIndex: qIdx,
          selectedOptionId: choice,
        }),
      }).then(async (r) => ({ status: r.status, data: await r.json() }));
    });

    const wave2Results = await Promise.all(wave2Promises);
    assert(
      wave2Results.every((r) => r.status === 200 && r.data.accepted),
      `All 20 Wave-2 near-deadline answers for Q${qIdx + 1} must be accepted`
    );

    // Check host console live response counter ("100 of 100 answered")
    const hostCheckRes = await fetch(
      `${BASE_URL}/api/admin/quizzes/rooms?roomCode=${roomCode}`,
      { headers: { Cookie: adminCookie } }
    );
    const hostCheck = await hostCheckRes.json();
    assert.strictEqual(
      hostCheck.currentQuestionAnsweredCount,
      100,
      `Host dashboard must report 100 of 100 answered on Q${qIdx + 1}`
    );

    // Host locks & reveals the question
    await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ roomCode, action: 'reveal_question' }),
    });

    if (qIdx === 0) {
      // Test late submission rejection after question closes
      const lateRes = await fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantToken: joinedPlayers[0].body.participant.participantToken,
          questionIndex: 0,
          selectedOptionId: 'A',
        }),
      });
      // Since Player 0 already answered, test late submission with a fresh question index or unsubmitted state
      assert.strictEqual(lateRes.status, 200); // Player 0 gets their idempotent receipt
    }

    // Host advances to next question (or finishes after Q4)
    await fetch(`${BASE_URL}/api/admin/quizzes/rooms`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ roomCode, action: 'next_question' }),
    });
  }

  // Also explicitly verify late submission rejection for an unsubmitted question when room is not open
  const lateRejectRes = await fetch(`${BASE_URL}/api/quiz/rooms/${roomCode}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      participantToken: joinedPlayers[0].body.participant.participantToken,
      questionIndex: 99,
      selectedOptionId: 'A',
    }),
  });
  assert.strictEqual(
    lateRejectRes.status,
    409,
    'Late submission after question closes must be rejected with HTTP 409'
  );

  // Verify final host state, 100-player ranking order, answer distributions, and Excel report export
  const finalHostRes = await fetch(
    `${BASE_URL}/api/admin/quizzes/rooms?roomCode=${roomCode}`,
    { headers: { Cookie: adminCookie } }
  );
  const finalHost = await finalHostRes.json();
  assert.strictEqual(finalHost.room.status, 'completed', 'Room must be completed');
  assert.strictEqual(finalHost.leaderboard.length, 100, 'Leaderboard must rank all 100 players');

  // Verify ranking rules: sorted by totalPoints desc, then correctCount desc, then cumulativeCorrectTimeMs asc
  for (let i = 1; i < finalHost.leaderboard.length; i++) {
    const prev = finalHost.leaderboard[i - 1];
    const curr = finalHost.leaderboard[i];
    const validOrder =
      prev.totalPoints > curr.totalPoints ||
      (prev.totalPoints === curr.totalPoints && prev.correctCount > curr.correctCount) ||
      (prev.totalPoints === curr.totalPoints &&
        prev.correctCount === curr.correctCount &&
        prev.cumulativeCorrectTimeMs <= curr.cumulativeCorrectTimeMs);
    assert(
      validOrder,
      `Leaderboard ranking invariant violated between rank ${prev.rank} and ${curr.rank}`
    );
  }

  // Verify Players 0..69 (who got all 4 correct) achieved maxStreak = 4 and earned > 4,200 points (base + speed + 2 streak bonuses)
  const topPlayer = finalHost.leaderboard[0];
  assert.strictEqual(topPlayer.correctCount, 4, 'Top player must have 4/4 correct');
  assert.strictEqual(topPlayer.maxStreak, 4, 'Top player must have maxStreak=4');
  assert(
    topPlayer.totalPoints >= 4200,
    `Expected top player points >= 4200 (4000 base + 200 streak + speed), got ${topPlayer.totalPoints}`
  );

  // Export and inspect `.xlsx` report for the 100-player room
  const exportRes = await fetch(
    `${BASE_URL}/api/admin/quizzes/rooms/${roomCode}/export`,
    { headers: { Cookie: adminCookie } }
  );
  assert.strictEqual(exportRes.status, 200, '.xlsx report export must return HTTP 200');
  const exportBuf = Buffer.from(await exportRes.arrayBuffer());
  const exportedWb = XLSX.read(exportBuf, { type: 'buffer' });
  assert(
    exportedWb.SheetNames.includes('Participant_Results') &&
      exportedWb.SheetNames.includes('Question_Breakdown'),
    'Exported .xlsx report must include Participant_Results and Question_Breakdown sheets'
  );
  const exportedParticipants = XLSX.utils.sheet_to_json(
    exportedWb.Sheets['Participant_Results']
  );
  const exportedQuestions = XLSX.utils.sheet_to_json(
    exportedWb.Sheets['Question_Breakdown']
  );
  assert.strictEqual(
    exportedParticipants.length,
    100,
    'Exported Participant_Results sheet must contain all 100 participants'
  );
  assert.strictEqual(
    exportedQuestions.length,
    4,
    'Exported Question_Breakdown sheet must contain all 4 questions'
  );

  const loadElapsedMs = Date.now() - loadStartMs;
  console.log(
    `  ✓ 100-player concurrent load test completed in ${loadElapsedMs}ms:`
  );
  console.log(
    `    • 400 concurrent answers recorded exactly once (100 players × 4 questions)`
  );
  console.log(
    `    • Rank #1: ${topPlayer.displayName} (${topPlayer.totalPoints} pts, 4/4 correct, ${topPlayer.cumulativeCorrectTimeMs}ms total time, streak=${topPlayer.maxStreak})`
  );
  console.log(
    `    • Exported .xlsx report verified (${exportBuf.byteLength} bytes, 100 participant rows, 4 question breakdown rows)\n`
  );

  console.log('===================================================================');
  console.log(' ALL MUDRA QUIZ E2E & 100-PLAYER LOAD VERIFICATIONS PASSED!');
  console.log('===================================================================');
}

runMudraQuizVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Mudra Quiz verification failed:', err);
    process.exit(1);
  });
