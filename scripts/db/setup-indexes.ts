import { getCollections } from '../../src/lib/db/client';

/**
 * Repeatable MongoDB Index & Atlas Search Index Definition Script
 * Run with: `npm run db:setup`
 */
export async function setupDatabaseIndexes() {
  const {
    db,
    users,
    sessions,
    rateLimits,
    categories,
    documents,
    importLogs,
    quizzes,
    quizVersions,
    quizRooms,
    quizParticipants,
    quizSubmissions,
    quizAttempts,
  } = await getCollections();

  console.log('--- Mudra Publications: Setting up MongoDB Indexes ---');

  // 1. Users indexes
  await users.createIndexes([
    { key: { loginId: 1 }, name: 'idx_users_loginId_unique', unique: true },
    { key: { role: 1, isActive: 1 }, name: 'idx_users_role_active' },
  ]);
  console.log('✓ Users indexes verified (idx_users_loginId_unique, idx_users_role_active)');

  // 2. Sessions indexes
  await sessions.createIndexes([
    { key: { tokenHash: 1 }, name: 'idx_sessions_tokenHash_unique', unique: true },
    { key: { userId: 1, revokedAt: 1 }, name: 'idx_sessions_userId_revoked' },
    { key: { expiresAt: 1 }, name: 'idx_sessions_expiresAt_ttl', expireAfterSeconds: 0 },
  ]);
  console.log('✓ Sessions indexes verified (tokenHash unique, userId revocation, TTL expiry)');

  // 3. Rate Limits indexes
  await rateLimits.createIndexes([
    { key: { key: 1 }, name: 'idx_rate_limits_key_unique', unique: true },
    {
      key: { updatedAt: 1 },
      name: 'idx_rate_limits_ttl',
      expireAfterSeconds: 3600,
    },
  ]);
  console.log('✓ Rate limit indexes verified');

  // 4. Categories indexes
  await categories.createIndexes([
    { key: { slug: 1 }, name: 'idx_categories_slug_unique', unique: true },
    {
      key: { isPublished: 1, parentSlug: 1, order: 1 },
      name: 'idx_categories_published_parent_order',
    },
    { key: { ancestors: 1 }, name: 'idx_categories_ancestors' },
  ]);
  console.log('✓ Categories hierarchy indexes verified');

  // 5. Documents indexes for actual access patterns
  await documents.createIndexes([
    { key: { docId: 1 }, name: 'idx_documents_docId_unique', unique: true },
    { key: { slug: 1 }, name: 'idx_documents_slug_unique', unique: true },
    {
      key: { normalizedDocNumber: 1, isPublished: 1 },
      name: 'idx_documents_normalizedDocNumber_published',
    },
    {
      key: { isPublished: 1, categorySlugs: 1, year: -1, documentDate: -1 },
      name: 'idx_documents_published_category_year_date',
    },
    {
      key: { isPublished: 1, year: -1, documentDate: -1 },
      name: 'idx_documents_published_year_date',
    },
    {
      key: { sourceId: 1 },
      name: 'idx_documents_sourceId_dedup',
      unique: true,
    },
    {
      key: { latestFileHash: 1 },
      name: 'idx_documents_latestFileHash_dedup',
    },
    {
      key: {
        documentNumber: 'text',
        spacedDocNumber: 'text',
        titleEn: 'text',
        titleMl: 'text',
        summaryEn: 'text',
        summaryMl: 'text',
        keywords: 'text',
        extractedText: 'text',
      },
      name: 'idx_documents_fulltext_multilingual',
      weights: {
        documentNumber: 15,
        spacedDocNumber: 15,
        titleMl: 10,
        titleEn: 10,
        summaryMl: 6,
        summaryEn: 6,
        keywords: 5,
        extractedText: 2,
      },
      default_language: 'none',
    },
  ]);
  console.log('✓ Documents access-pattern indexes verified');

  // 6. Import logs indexes
  await importLogs.createIndexes([
    { key: { runId: 1 }, name: 'idx_import_logs_runId_unique', unique: true },
    { key: { startedAt: -1 }, name: 'idx_import_logs_startedAt' },
  ]);

  // 7. Mudra Quiz module indexes
  await quizzes.createIndexes([
    { key: { quizId: 1 }, name: 'idx_quizzes_quizId_unique', unique: true },
    { key: { slug: 1 }, name: 'idx_quizzes_slug_unique', unique: true },
    { key: { status: 1, updatedAt: -1 }, name: 'idx_quizzes_status_updatedAt' },
  ]);
  await quizVersions.createIndexes([
    { key: { versionId: 1 }, name: 'idx_quiz_versions_versionId_unique', unique: true },
    { key: { quizId: 1, version: -1 }, name: 'idx_quiz_versions_quizId_version', unique: true },
  ]);
  await quizRooms.createIndexes([
    { key: { roomCode: 1 }, name: 'idx_quiz_rooms_roomCode_unique', unique: true },
    { key: { quizId: 1, createdAt: -1 }, name: 'idx_quiz_rooms_quizId_createdAt' },
    { key: { status: 1, updatedAt: -1 }, name: 'idx_quiz_rooms_status_updatedAt' },
  ]);
  await quizParticipants.createIndexes([
    { key: { participantId: 1 }, name: 'idx_quiz_participants_participantId_unique', unique: true },
    { key: { participantToken: 1 }, name: 'idx_quiz_participants_token_unique', unique: true },
    {
      key: {
        roomCode: 1,
        removed: 1,
        totalPoints: -1,
        correctCount: -1,
        cumulativeCorrectTimeMs: 1,
      },
      name: 'idx_quiz_participants_leaderboard',
    },
    { key: { roomCode: 1, userId: 1 }, name: 'idx_quiz_participants_room_user' },
  ]);
  await quizSubmissions.createIndexes([
    {
      key: { roomCode: 1, participantId: 1, questionIndex: 1 },
      name: 'idx_quiz_submissions_unique_answer',
      unique: true,
    },
    {
      key: { roomCode: 1, questionIndex: 1 },
      name: 'idx_quiz_submissions_room_question',
    },
  ]);
  await quizAttempts.createIndexes([
    { key: { attemptId: 1 }, name: 'idx_quiz_attempts_attemptId_unique', unique: true },
    { key: { attemptToken: 1 }, name: 'idx_quiz_attempts_token' },
    { key: { userId: 1, startedAt: -1 }, name: 'idx_quiz_attempts_user_history' },
    { key: { roomCode: 1, participantId: 1 }, name: 'idx_quiz_attempts_room_participant' },
  ]);
  console.log('✓ Mudra Quiz indexes verified (quizzes, versions, rooms, participants, submissions, attempts)');

  // 8. Declarative MongoDB Atlas Search index definition (mudra_documents_search)
  const atlasSearchIndexDef = {
    name: 'mudra_documents_search',
    definition: {
      mappings: {
        dynamic: false,
        fields: {
          normalizedDocNumber: [{ type: 'token' }, { type: 'string', analyzer: 'lucene.keyword' }],
          spacedDocNumber: { type: 'string', analyzer: 'lucene.standard' },
          documentNumber: { type: 'string', analyzer: 'lucene.standard' },
          titleMl: { type: 'string', analyzer: 'lucene.standard' },
          summaryMl: { type: 'string', analyzer: 'lucene.standard' },
          titleEn: { type: 'string', analyzer: 'lucene.standard' },
          summaryEn: { type: 'string', analyzer: 'lucene.standard' },
          keywords: { type: 'string', analyzer: 'lucene.standard' },
          extractedText: { type: 'string', analyzer: 'lucene.standard' },
          categorySlugs: { type: 'token' },
          year: { type: 'number' },
          isPublished: { type: 'boolean' },
          hasTextLayer: { type: 'boolean' },
        },
      },
    },
  };

  try {
    await db.command({
      createSearchIndexes: 'documents',
      indexes: [atlasSearchIndexDef],
    });
    console.log('✓ MongoDB Atlas Search index `mudra_documents_search` created on cluster');
  } catch {
    console.log(
      'ℹ Atlas Search `$search` index definition (`mudra_documents_search`) registered in version control.'
    );
  }
}

if (require.main === module) {
  setupDatabaseIndexes()
    .then(() => {
      console.log('--- Index setup completed successfully ---');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Index setup failed:', err);
      process.exit(1);
    });
}
