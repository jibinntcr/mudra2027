# Mudra Publications — Eaadharam Document Migration Report

- **Latest Run ID**: `MIGRATE-2026-11-25T09-10-51-736Z`
- **Source Site**: `https://www.eaadharam.in/2020/07/home-eaadharam_5.html`
- **Executed At**: `2026-11-25T09:11:06.673Z`

## Summary Metrics

| Metric | Count |
| :--- | :--- |
| Categories & Subcategories Synced | **18** |
| Source Entries Inspected in Run | **47** |
| New Documents Imported in Run | **0** |
| Multi-Category Merges in Run | **0** |
| Duplicate Entries Skipped (Idempotent Dedup) | **47** |
| Failed Entries | **0** |
| **Total Unique Documents in MongoDB** | **41** |
| Text-Layer Searchable PDFs | **29** |
| Scanned Archive PDFs (Catalogue Indexed) | **12** |

## Storage & Deduplication Architecture

- **Private Storage Root**: `./private_storage/documents/<docId>/v<version>/document.pdf`
- **Cover Thumbnails**: `./private_storage/documents/<docId>/v<version>/thumbnail.svg`
- **Deduplication Keys**: `sourceId` (Google Drive ID / Eaadharam URL hash), `normalizedDocNumber`, and SHA-256 `latestFileHash`.
- **Multi-Category Assignment**: Documents appearing under multiple categories (e.g. `LRC Orders → Sale` and `Registration → SD and Reg. Fee`) retain a single MongoDB record, one reader URL (`/library/documents/<slug>`), and one stored PDF copy per version.

## Sample Imported / Verified Documents

| Doc ID | Document Number | Normalized Number | Categories | Text Layer | SHA-256 (Prefix) | Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `DOC-2025-0001` | `IGR/5897/2024-RR2` | `IGR58972024RR2` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `3b69bd630f1a…` | **skipped_duplicate** |
| `DOC-2023-0002` | `GO(P)No.45/2023/TD` | `GOPNO452023TD` | `registration-fair-value`, `registration`, `registration-stamp-duty` | No (Scanned) | `b59933ee3f45…` | **skipped_duplicate** |
| `DOC-2022-0003` | `LR/3322/2022-LR` | `LR33222022LR` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty`, `lrc-orders-rectification` | Yes (Text) | `b4116f4e047c…` | **skipped_duplicate** |
| `DOC-2025-0001` | `IGR/5897/2024-RR2` | `IGR58972024RR2` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `3b69bd630f1a…` | **skipped_duplicate** |
| `DOC-2023-0004` | `IGR/6397/2022-RR2` | `IGR63972022RR2` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `fd64497931d9…` | **skipped_duplicate** |
| `DOC-2022-0005` | `RR.2-6164/2021` | `RR261642021` | `lrc-orders-sale`, `lrc-orders`, `lrc-orders-release` | No (Scanned) | `9d8e14e1b585…` | **skipped_duplicate** |
| `DOC-2021-0006` | `LR/8529/2021-LR` | `LR85292021LR` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `a7c43e853031…` | **skipped_duplicate** |
| `DOC-2022-0007` | `LRA.3-152/2021` | `LRA31522021` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `dca47d93ce90…` | **skipped_duplicate** |
| `DOC-2022-0008` | `LRA.3-492/2021` | `LRA34922021` | `lrc-orders-sale`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `5c7d36154310…` | **skipped_duplicate** |
| `DOC-2022-0009` | `LRA.3-8529/2021` | `LRA385292021` | `lrc-orders-sale`, `lrc-orders` | No (Scanned) | `4e406e470f22…` | **skipped_duplicate** |
| `DOC-2023-0010` | `LR/6816/2023-LR` | `LR68162023LR` | `lrc-orders-settlement`, `lrc-orders` | Yes (Text) | `f32833deb0a3…` | **skipped_duplicate** |
| `DOC-2021-0011` | `LRC-ORDERS-SETTLEMENT-3` | `LRCORDERSSETTLEMENT3` | `lrc-orders-settlement`, `lrc-orders` | Yes (Text) | `1b89c9fa2c2a…` | **skipped_duplicate** |
| `DOC-2021-0012` | `LRA. 3- 3905/2021` | `LRA339052021` | `lrc-orders-settlement`, `lrc-orders`, `registration-stamp-duty` | No (Scanned) | `cb6918dcfe89…` | **skipped_duplicate** |
| `DOC-2021-0013` | `J1/198/2019/TD` | `J11982019TD` | `lrc-orders-settlement`, `lrc-orders`, `registration-stamp-duty` | No (Scanned) | `8d618c3e3dd0…` | **skipped_duplicate** |
| `DOC-2020-0014` | `R.2-5635/2020` | `R256352020` | `lrc-orders-settlement`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `161268486329…` | **skipped_duplicate** |
| `DOC-2020-0015` | `RR-2- 12050/2019` | `RR2120502019` | `lrc-orders-settlement`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `3c8fb5dbb265…` | **skipped_duplicate** |
| `DOC-2022-0016` | `G.O` | `GO` | `lrc-orders-release`, `lrc-orders` | Yes (Text) | `bbc1648f3cf2…` | **skipped_duplicate** |
| `DOC-2022-0017` | `G.O` | `GO` | `lrc-orders-release`, `lrc-orders` | Yes (Text) | `6209318758b0…` | **skipped_duplicate** |
| `DOC-2022-0018` | `G.O` | `GO` | `lrc-orders-release`, `lrc-orders`, `registration-stamp-duty` | Yes (Text) | `1dd9c780d82d…` | **skipped_duplicate** |
| `DOC-2022-0005` | `RR.2-6164/2021` | `RR261642021` | `lrc-orders-sale`, `lrc-orders`, `lrc-orders-release` | No (Scanned) | `9d8e14e1b585…` | **skipped_duplicate** |
| `DOC-2023-0019` | `LRA.3-8751/2023` | `LRA387512023` | `lrc-orders-partition`, `lrc-orders`, `lrc-orders-settlement` | No (Scanned) | `3b7ef4d99c5d…` | **skipped_duplicate** |
| `DOC-2023-0020` | `LRC-ORDERS-PARTITION-3` | `LRCORDERSPARTITION3` | `lrc-orders-partition`, `lrc-orders` | Yes (Text) | `a53ed887a564…` | **skipped_duplicate** |
| `DOC-2022-0021` | `LRA.3-6572/2022` | `LRA365722022` | `lrc-orders-partition`, `lrc-orders` | No (Scanned) | `cc58e30b4333…` | **skipped_duplicate** |
| `DOC-2022-0022` | `LRC-ORDERS-PARTITION-5` | `LRCORDERSPARTITION5` | `lrc-orders-partition`, `lrc-orders` | Yes (Text) | `4cef7f67c98d…` | **skipped_duplicate** |
| `DOC-2011-0023` | `LRC-ORDERS-GIFT-2` | `LRCORDERSGIFT2` | `lrc-orders-gift`, `lrc-orders` | Yes (Text) | `3767ae70c9fd…` | **skipped_duplicate** |
