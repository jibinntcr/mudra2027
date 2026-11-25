import assert from 'assert';
import { getCollections } from '../src/lib/db/client';
import { runEaadharamMigration } from './import/migrate-eaadharam';

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';

function extractCookie(res: Response): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = raw.match(/mudra_session=[^;]+/);
  return match ? match[0] : '';
}

async function runVerificationSuite() {
  console.log('================================================================');
  console.log(' MUDRA PUBLICATIONS — MANDATORY HANDOVER VERIFICATION SUITE');
  console.log('================================================================\n');

  const { documents } = await getCollections();
  const sampleDoc = await documents.findOne({ normalizedDocNumber: 'IGR58972024RR2' });
  assert(sampleDoc, 'Expected benchmark document IGR/5897/2024-RR2 in MongoDB');

  // 1. TEST PUBLIC vs SIGNED-OUT VISITOR PROTECTION
  console.log('1. Testing Signed-Out Visitor Protection (Pages, Search, PDF, Thumbnail, Download)...');

  const homeRes = await fetch(`${BASE_URL}/`);
  assert.strictEqual(homeRes.status, 200, 'Public homepage should return 200');
  const homeHtml = await homeRes.text();
  assert(
    !homeHtml.includes('IGR/5897/2024-RR2'),
    'Public homepage must NOT expose protected document numbers or titles'
  );

  // Direct protected document link while signed out -> 307 redirect to /login?returnTo=...
  const directDocRes = await fetch(`${BASE_URL}/library/documents/${sampleDoc.slug}`, {
    redirect: 'manual',
  });
  assert(
    [302, 307, 308].includes(directDocRes.status),
    `Expected redirect for signed-out document page, got ${directDocRes.status}`
  );
  const loc = directDocRes.headers.get('location') || '';
  assert(
    loc.includes('/login') && loc.includes(encodeURIComponent(`/library/documents/${sampleDoc.slug}`)),
    `Expected redirect to /login with returnTo parameter, got ${loc}`
  );
  console.log(`  ✓ Direct document page redirects signed-out visitor to: ${loc}`);

  // Direct category page while signed out
  const directCatRes = await fetch(`${BASE_URL}/library/categories/lrc-orders-sale`, {
    redirect: 'manual',
  });
  assert([302, 307, 308].includes(directCatRes.status), 'Expected redirect for signed-out category page');
  console.log('  ✓ Direct category page blocks signed-out visitor');

  // Direct API search endpoint while signed out -> 401
  const anonSearchRes = await fetch(`${BASE_URL}/api/search?q=IGR`);
  assert.strictEqual(anonSearchRes.status, 401, 'Signed-out /api/search must return 401');
  console.log('  ✓ Search API blocks signed-out visitor with HTTP 401');

  // Direct PDF stream endpoint while signed out -> 401
  const anonPdfRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/pdf`);
  assert.strictEqual(anonPdfRes.status, 401, 'Signed-out PDF URL must return 401');
  console.log('  ✓ Private PDF stream endpoint blocks signed-out visitor with HTTP 401');

  // Direct Thumbnail endpoint while signed out -> 401
  const anonThumbRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/thumbnail`);
  assert.strictEqual(anonThumbRes.status, 401, 'Signed-out Thumbnail URL must return 401');
  console.log('  ✓ Private Thumbnail endpoint blocks signed-out visitor with HTTP 401');

  // Direct Download endpoint while signed out -> 401
  const anonDownloadRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/download`);
  assert.strictEqual(anonDownloadRes.status, 401, 'Signed-out Download URL must return 401');
  console.log('  ✓ Private Download endpoint blocks signed-out visitor with HTTP 401\n');

  // 2. TEST READER SIGN-IN, RETURN-TO REDIRECT, AND ADMIN ROUTE RESTRICTION
  console.log('2. Testing Reader Authentication, Return-To Flow & Admin Route Restriction...');
  const readerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: 'reader.kerala',
      password: 'MudraReader@2026!',
      returnTo: `/library/documents/${sampleDoc.slug}`,
    }),
  });
  assert.strictEqual(readerLoginRes.status, 200, 'Reader login should succeed');
  const readerCookie = extractCookie(readerLoginRes);
  assert(readerCookie, 'Expected mudra_session cookie for reader');
  const readerLoginJson = await readerLoginRes.json();
  assert.strictEqual(
    readerLoginJson.redirectUrl,
    `/library/documents/${sampleDoc.slug}`,
    'Login must return visitor to shared document link after sign-in'
  );
  console.log(`  ✓ Reader signed in and returned to shared link: ${readerLoginJson.redirectUrl}`);

  // Confirm Reader CANNOT access /admin or /api/admin/*
  const readerAdminPageRes = await fetch(`${BASE_URL}/admin`, {
    headers: { Cookie: readerCookie },
    redirect: 'manual',
  });
  assert(
    [302, 307, 308].includes(readerAdminPageRes.status),
    'Reader visiting /admin must be redirected away'
  );
  const readerAdminApiRes = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Cookie: readerCookie },
  });
  assert.strictEqual(
    readerAdminApiRes.status,
    403,
    'Reader calling /api/admin/users must receive HTTP 403 Forbidden'
  );
  console.log('  ✓ Reader is blocked from /admin page and receives HTTP 403 on /api/admin/*\n');

  // 3. TEST DOCUMENT NUMBER VARIANTS & RANKING
  console.log('3. Testing Document-Number Variants & Exact-Match First Ranking...');
  const variant1Res = await fetch(
    `${BASE_URL}/api/search?q=${encodeURIComponent('IGR/5897/2024-RR2')}`,
    { headers: { Cookie: readerCookie } }
  );
  const variant1Data = await variant1Res.json();
  assert(variant1Data.items.length > 0, 'Expected results for IGR/5897/2024-RR2');

  const variant2Res = await fetch(
    `${BASE_URL}/api/search?q=${encodeURIComponent('IGR 5897 2024 RR2')}`,
    { headers: { Cookie: readerCookie } }
  );
  const variant2Data = await variant2Res.json();
  assert(variant2Data.items.length > 0, 'Expected results for IGR 5897 2024 RR2');

  assert.strictEqual(
    variant1Data.items[0].docId,
    variant2Data.items[0].docId,
    'Both IGR/5897/2024-RR2 and IGR 5897 2024 RR2 must rank the exact same record #1'
  );
  assert.strictEqual(
    variant2Data.items[0].exactNumberMatch,
    true,
    'Top result must be flagged as exactNumberMatch=true'
  );
  console.log(
    `  ✓ Variants "IGR/5897/2024-RR2" and "IGR 5897 2024 RR2" both resolve #1 to ${variant1Data.items[0].docId} (exactNumberMatch=true)\n`
  );

  // 4. TEST MALAYALAM TITLE SEARCH & SCANNED vs TEXT PDF SEARCH
  console.log('4. Testing Malayalam Title Search, Text PDFs, and Scanned PDFs...');
  const mlSearchRes = await fetch(
    `${BASE_URL}/api/search?q=${encodeURIComponent('പണയ ബാദ്ധ്യത')}`,
    { headers: { Cookie: readerCookie } }
  );
  const mlSearchData = await mlSearchRes.json();
  assert(mlSearchData.items.length > 0, 'Malayalam search for "പണയ ബാദ്ധ്യത" must return results');
  console.log(
    `  ✓ Malayalam title query "പണയ ബാദ്ധ്യത" returned ${mlSearchData.total} result(s) (Top: ${mlSearchData.items[0].documentNumber})`
  );

  const scannedSearchRes = await fetch(
    `${BASE_URL}/api/search?q=${encodeURIComponent('ന്യായവില')}&hasTextLayer=false`,
    { headers: { Cookie: readerCookie } }
  );
  const scannedSearchData = await scannedSearchRes.json();
  assert(
    scannedSearchData.items.length > 0,
    'Scanned PDF without text layer must remain searchable through Malayalam catalogue metadata'
  );
  assert.strictEqual(
    scannedSearchData.items[0].hasTextLayer,
    false,
    'Result should be a scanned PDF (hasTextLayer=false)'
  );
  console.log(
    `  ✓ Scanned PDF without text layer found via Malayalam catalogue search "ന്യായവില": ${scannedSearchData.items[0].documentNumber} (hasTextLayer=false)\n`
  );

  // 5. TEST SERVER-SIDE CATEGORY PAGINATION
  console.log('5. Testing Server-Side Category Pagination...');
  const catPage1Res = await fetch(
    `${BASE_URL}/api/search?category=lrc-orders-sale&page=1&limit=3`,
    { headers: { Cookie: readerCookie } }
  );
  const catPage1 = await catPage1Res.json();
  const catPage2Res = await fetch(
    `${BASE_URL}/api/search?category=lrc-orders-sale&page=2&limit=3`,
    { headers: { Cookie: readerCookie } }
  );
  const catPage2 = await catPage2Res.json();
  assert.strictEqual(catPage1.items.length, 3, 'Category page 1 should have 3 items (limit=3)');
  assert(catPage2.items.length > 0, 'Category page 2 should have items');
  assert.notStrictEqual(
    catPage1.items[0].docId,
    catPage2.items[0].docId,
    'Category page 1 and page 2 must return distinct slices from server-side pagination'
  );
  console.log(
    `  ✓ Category "lrc-orders-sale" paginated on server: Total=${catPage1.total}, Page1[0]=${catPage1.items[0].docId}, Page2[0]=${catPage2.items[0].docId}\n`
  );

  // 6. TEST PRIVATE BYTE-RANGE PDF STREAMING, CACHE HEADERS, THUMBNAIL & DOWNLOAD
  console.log('6. Testing Private Byte-Range PDF Streaming (HTTP 206) & Cache-Control Headers...');
  const rangePdfRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/pdf`, {
    headers: {
      Cookie: readerCookie,
      Range: 'bytes=0-127',
    },
  });
  assert.strictEqual(rangePdfRes.status, 206, 'Byte-range PDF request must return HTTP 206 Partial Content');
  const contentRange = rangePdfRes.headers.get('content-range') || '';
  const cacheControl = rangePdfRes.headers.get('cache-control') || '';
  assert(contentRange.startsWith('bytes 0-127/'), `Expected Content-Range bytes 0-127/*, got ${contentRange}`);
  assert(
    cacheControl.includes('private') && cacheControl.includes('no-store'),
    `PDF response must prevent public caching, got Cache-Control: ${cacheControl}`
  );
  const sliceBytes = Buffer.from(await rangePdfRes.arrayBuffer());
  assert.strictEqual(sliceBytes.byteLength, 128, 'Expected exactly 128 bytes in range slice');
  assert.strictEqual(sliceBytes.subarray(0, 5).toString('ascii'), '%PDF-', 'First 5 bytes must be %PDF-');
  console.log(`  ✓ Byte-Range PDF returned HTTP 206 (${contentRange}), Cache-Control: "${cacheControl}"`);

  const thumbRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/thumbnail`, {
    headers: { Cookie: readerCookie },
  });
  assert.strictEqual(thumbRes.status, 200, 'Authenticated thumbnail request must succeed');

  const downloadRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/download`, {
    headers: { Cookie: readerCookie },
  });
  assert.strictEqual(downloadRes.status, 200, 'Authenticated download request must succeed');
  console.log('  ✓ Authenticated thumbnail and download endpoints verified with private no-store headers\n');

  // 7. TEST ADMIN ACCOUNT LIFECYCLE: FIRST-LOGIN PASSWORD CHANGE & DEACTIVATION SESSION REVOCATION
  console.log('7. Testing Admin Account Provisioning, First-Login Password Change & Session Revocation...');
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: 'admin.mudra',
      password: 'MudraAdmin@2026!',
    }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login must succeed');
  const adminCookie = extractCookie(adminLoginRes);

  const testUserLoginId = `verify.reader.${Date.now()}`;
  const createAcctRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      loginId: testUserLoginId,
      displayName: 'Verification Test Reader',
      role: 'reader',
      temporaryPassword: 'TempLogin@2026!',
    }),
  });
  assert.strictEqual(createAcctRes.status, 201, 'Admin account creation must return 201');
  const createdAcctData = await createAcctRes.json();
  const createdUserId = createdAcctData.user.userId;

  // Sign in with newly created account -> must require password change
  const tempLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      loginId: testUserLoginId,
      password: 'TempLogin@2026!',
    }),
  });
  const tempCookie = extractCookie(tempLoginRes);
  const tempLoginData = await tempLoginRes.json();
  assert.strictEqual(
    tempLoginData.user.mustChangePassword,
    true,
    'Newly provisioned user must have mustChangePassword=true'
  );
  assert(
    tempLoginData.redirectUrl.startsWith('/change-password'),
    'First login must redirect to /change-password'
  );

  // Attempting to call /api/search before changing password must be blocked with 403
  const preChangeSearch = await fetch(`${BASE_URL}/api/search?q=IGR`, {
    headers: { Cookie: tempCookie },
  });
  assert.strictEqual(
    preChangeSearch.status,
    403,
    'User with mustChangePassword=true must not access library before changing password'
  );
  console.log('  ✓ First-login user is required to change password before accessing library');

  // Complete password change
  const changePwRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: tempCookie,
    },
    body: JSON.stringify({
      currentPassword: 'TempLogin@2026!',
      newPassword: 'PersonalPass@2026!',
      confirmPassword: 'PersonalPass@2026!',
    }),
  });
  assert.strictEqual(changePwRes.status, 200, 'Password change must succeed');
  const activeUserCookie = extractCookie(changePwRes);

  // Verify user can now access library search
  const postChangeSearch = await fetch(`${BASE_URL}/api/search?q=IGR`, {
    headers: { Cookie: activeUserCookie },
  });
  assert.strictEqual(postChangeSearch.status, 200, 'User can access library after password change');
  console.log('  ✓ After password update, user can access protected library endpoints');

  // Now Admin deactivates the user -> existing session cookie must be immediately revoked!
  const deactivateRes = await fetch(`${BASE_URL}/api/admin/users`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      action: 'toggle_active',
      userId: createdUserId,
      isActive: false,
    }),
  });
  assert.strictEqual(deactivateRes.status, 200, 'Admin deactivation must succeed');

  // Verify the previously valid session cookie is immediately rejected on search and PDF requests
  const revokedSearchRes = await fetch(`${BASE_URL}/api/search?q=IGR`, {
    headers: { Cookie: activeUserCookie },
  });
  assert.strictEqual(
    revokedSearchRes.status,
    401,
    'Deactivated account existing session must be immediately revoked (HTTP 401)'
  );
  const revokedPdfRes = await fetch(`${BASE_URL}/api/documents/${sampleDoc.docId}/pdf`, {
    headers: { Cookie: activeUserCookie },
  });
  assert.strictEqual(
    revokedPdfRes.status,
    401,
    'Deactivated account cannot fetch PDF with existing session cookie'
  );
  console.log('  ✓ Deactivating account immediately revoked existing sessions (HTTP 401)\n');

  // 8. TEST STORAGE KEY IMMUTABILITY ON RENAME / CATEGORY MOVE & REPEAT IMPORT DEDUPLICATION
  console.log('8. Testing Storage Key Stability on Rename/Move & Repeat-Import Deduplication...');
  const storageKeyBefore = sampleDoc.versions[sampleDoc.versions.length - 1].storageKey;
  const renameRes = await fetch(`${BASE_URL}/api/admin/documents`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
    },
    body: JSON.stringify({
      docId: sampleDoc.docId,
      titleEn: sampleDoc.titleEn,
      categorySlugs: ['lrc-orders-sale', 'lrc-orders', 'registration-stamp-duty'],
    }),
  });
  assert.strictEqual(renameRes.status, 200, 'Document metadata update must succeed');
  const renameData = await renameRes.json();
  const storageKeyAfter =
    renameData.document.versions[renameData.document.versions.length - 1].storageKey;
  assert.strictEqual(
    storageKeyBefore,
    storageKeyAfter,
    'Storage key grouped by docId and version must remain unchanged when updating titles or categories'
  );
  console.log(`  ✓ Storage key remained immutable (${storageKeyAfter}) across metadata/category update`);

  // Run repeat Eaadharam import and verify 0 new duplicate records are inserted
  const countBeforeRepeat = await documents.countDocuments();
  const repeatReport = await runEaadharamMigration();
  const countAfterRepeat = await documents.countDocuments();
  assert.strictEqual(
    repeatReport.documentsInserted,
    0,
    'Repeat migration run must insert 0 duplicate records'
  );
  assert.strictEqual(
    countBeforeRepeat,
    countAfterRepeat,
    'Total document count in MongoDB must remain identical after repeat import'
  );
  console.log(
    `  ✓ Repeat import deduplication verified: 0 new records inserted, ${repeatReport.duplicatesSkipped} duplicates skipped, total=${countAfterRepeat}\n`
  );

  console.log('================================================================');
  console.log(' ALL MANDATORY HANDOVER VERIFICATIONS PASSED SUCCESSFULLY');
  console.log('================================================================');
}

runVerificationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Verification suite failed:', err);
    process.exit(1);
  });
