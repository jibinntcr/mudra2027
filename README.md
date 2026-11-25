# Mudra Publications — Kerala Registration & Land Revenue Digital Library

Built with **Next.js App Router**, **TypeScript**, **MongoDB**, and a **Mudra-branded PDF.js Reader**.
Migrates and indexes the **Eaadharam** (`https://www.eaadharam.in/2020/07/home-eaadharam_5.html`) category hierarchy and document collection behind mandatory session authentication and private byte-range PDF delivery.

---

## 1. Project Architecture & Structure

```text
src/
  app/                      Next.js App Router routes and layouts
    (public)/               Public Homepage (/), About (/about), Contact (/contact), Login (/login)
    (protected)/            Authenticated Library (/library), Categories (/library/categories/[slug]),
                            Bilingual Search (/library/search), PDF Reader (/library/documents/[slug]),
                            and Mandatory First-Login Password Update (/change-password)
    (admin)/admin/          Admin Console (/admin) for Reader Accounts, Categories, Imports & Publication
    api/                    Server-authenticated endpoints & HTTP 206 byte-range PDF delivery
  features/
    auth/                   JWT + MongoDB session validation, bcrypt hashing, rate limiting, revocation
    documents/              Document lookups and multi-category card components
    categories/             Hierarchical category tree & breadcrumb resolution
    search/                 MongoDB Atlas Search ($search) + Indexed Hybrid Bilingual Search & Ranking
    reader/                 Mudra-branded PDF.js progressive canvas reader (desktop & mobile responsive)
    admin/                  Admin dashboard client for accounts, categories, publication & migration
  lib/
    db/                     MongoDB connection pool and TypeScript collection schemas
    storage/                Private object storage grouped by `documents/<docId>/v<version>/document.pdf`
    validation/             Zod request schemas and document-number normalization (`IGR/5897/2024-RR2` ↔ `IGR 5897 2024 RR2`)
scripts/
  import/                   Eaadharam source inventory (`source-inventory.ts`) and migration (`migrate-eaadharam.ts`)
  db/                       MongoDB index setup (`setup-indexes.ts`) and schema/account bootstrap (`schema-migration.ts`)
  verify-handover.ts        Automated end-to-end handover verification suite
```

---

## 2. Environment Setup Instructions

1. **Copy the environment template**:
   ```bash
   cp .env.example .env.local
   ```
2. **Configure `.env.local`**:
   - `MONGODB_URI`: Connection string to your MongoDB instance or MongoDB Atlas cluster (default: `mongodb://127.0.0.1:27017/mudra_publications`).
   - `MONGODB_DB_NAME`: Database name (`mudra_publications`).
   - `JWT_SECRET`: Secret key used to sign HTTP-only session cookies.
   - `PRIVATE_STORAGE_ROOT`: Path outside `public/` where private PDF versions and SVG cover thumbnails are stored (default: `./private_storage`).

3. **Install dependencies**:
   ```bash
   npm install
   ```

---

## 3. Repeatable Database Index Setup & Eaadharam Migration Commands

- **Set up all MongoDB indexes & Atlas Search index definitions**:
  ```bash
  npm run db:setup
  ```
- **Run schema migration & bootstrap default Admin and Reader accounts**:
  ```bash
  npm run db:migrate
  ```
- **Run the Eaadharam category & document migration (idempotent with SHA-256 & `sourceId` deduplication)**:
  ```bash
  npm run import:eaadharam
  ```
  Generates the full migration report at [`MIGRATION_REPORT.md`](./MIGRATION_REPORT.md).

---

## 4. Running the Application & Verification Suite

- **Start the development server**:
  ```bash
  npm run dev
  ```
- **Build & start for production**:
  ```bash
  npm run build && npm run start
  ```
- **Run the end-to-end verification suite** (while the server is running on port 3000):
  ```bash
  npm run verify
  ```

### Default Bootstrap Credentials

| Role | Login ID | Initial Password | Notes |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin.mudra` | `MudraAdmin@2026!` | Full access to `/admin` and `/library` |
| **Reader** | `reader.kerala` | `MudraReader@2026!` | Access to `/library`, search, and PDF reader |
| **First-Login Reader** | `newreader.mudra` | `TempPass@2026!` | Demonstrates mandatory password change on first login |
