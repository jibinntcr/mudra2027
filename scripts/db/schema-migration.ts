import { getCollections } from '../../src/lib/db/client';
import { hashPassword } from '../../src/features/auth/session';
import { setupDatabaseIndexes } from './setup-indexes';

/**
 * Repeatable Schema Validation & Default Accounts Migration Script
 * Run with: `npm run db:migrate`
 */
export async function runSchemaMigration() {
  const { db, users } = await getCollections();
  console.log('--- Mudra Publications: Running Schema Migration & Account Bootstrap ---');

  // Ensure collections exist
  const existingCols = (await db.listCollections().toArray()).map((c) => c.name);
  for (const colName of [
    'users',
    'sessions',
    'rate_limits',
    'categories',
    'documents',
    'import_logs',
  ]) {
    if (!existingCols.includes(colName)) {
      await db.createCollection(colName);
      console.log(`✓ Created collection: ${colName}`);
    }
  }

  // Apply indexes
  await setupDatabaseIndexes();

  // Bootstrap default Admin and Reader accounts
  const adminLoginId = (process.env.DEFAULT_ADMIN_LOGIN_ID || 'admin.mudra').toLowerCase();
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'MudraAdmin@2026!';
  const readerLoginId = (process.env.DEFAULT_READER_LOGIN_ID || 'reader.kerala').toLowerCase();
  const readerPassword = process.env.DEFAULT_READER_PASSWORD || 'MudraReader@2026!';

  const now = new Date();

  const existingAdmin = await users.findOne({ loginId: adminLoginId });
  if (!existingAdmin) {
    await users.insertOne({
      loginId: adminLoginId,
      displayName: 'Mudra Chief Administrator',
      passwordHash: await hashPassword(adminPassword),
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    });
    console.log(`✓ Created bootstrap Admin account: ${adminLoginId}`);
  } else {
    console.log(`✓ Admin account already exists: ${adminLoginId}`);
  }

  const existingReader = await users.findOne({ loginId: readerLoginId });
  if (!existingReader) {
    await users.insertOne({
      loginId: readerLoginId,
      displayName: 'Kerala Registration Reader',
      passwordHash: await hashPassword(readerPassword),
      role: 'reader',
      isActive: true,
      mustChangePassword: false,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: adminLoginId,
    });
    console.log(`✓ Created bootstrap Reader account: ${readerLoginId}`);
  } else {
    console.log(`✓ Reader account already exists: ${readerLoginId}`);
  }

  // Also ensure a test first-login reader account exists to demonstrate mandatory password change on first login
  const firstLoginId = 'newreader.mudra';
  const existingFirstLogin = await users.findOne({ loginId: firstLoginId });
  if (!existingFirstLogin) {
    await users.insertOne({
      loginId: firstLoginId,
      displayName: 'First-Login Sub-Registrar Reader',
      passwordHash: await hashPassword('TempPass@2026!'),
      role: 'reader',
      isActive: true,
      mustChangePassword: true,
      sessionVersion: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: adminLoginId,
    });
    console.log(`✓ Created first-login test account (mustChangePassword=true): ${firstLoginId}`);
  }
}

if (require.main === module) {
  runSchemaMigration()
    .then(() => {
      console.log('--- Schema migration completed successfully ---');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Schema migration failed:', err);
      process.exit(1);
    });
}
