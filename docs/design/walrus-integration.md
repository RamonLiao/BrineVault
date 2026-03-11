# RWA Credit Data Room — Walrus 整合規格書 (Walrus Integration Specification)

**版本：** v1.0
**建立日期：** 2026-03-11
**狀態：** Draft
**關聯文件：** 系統架構書、規格書、move-interface.md、decisions.md (ADR-03)

---

## 目錄

1. [Walrus 概觀](#1-walrus-概觀)
2. [上傳流程 (Upload Flow)](#2-上傳流程-upload-flow)
3. [下載流程 (Download Flow)](#3-下載流程-download-flow)
4. [檔案預覽管線 (File Preview Pipeline)](#4-檔案預覽管線-file-preview-pipeline)
5. [版本上傳流程 (Version Upload Flow)](#5-版本上傳流程-version-upload-flow)
6. [Walrus Blob 生命週期管理](#6-walrus-blob-生命週期管理)
7. [備份策略 (Backup Strategy)](#7-備份策略-backup-strategy)
8. [Walrus API 參考](#8-walrus-api-參考)
9. [檔案大小限制與分段上傳 (Chunking)](#9-檔案大小限制與分段上傳-chunking)
10. [費用模型 (Cost Model)](#10-費用模型-cost-model)
11. [錯誤處理 (Error Handling)](#11-錯誤處理-error-handling)
12. [安全性考量 (Security Considerations)](#12-安全性考量-security-considerations)

---

## 1. Walrus 概觀

### 1.1 什麼是 Walrus

Walrus 是 Sui 生態系統中的**去中心化 Blob 儲存協議**。它為大型非結構化資料（檔案、影像、文件）提供高可用的分散式儲存，同時利用 Sui 鏈上合約管理儲存資源的會計與治理。

> **重要區別：Walrus 不是 IPFS。** IPFS 使用 Content ID (CID) 做 content addressing（相同內容產生相同 CID）；Walrus 則是回傳由 Publisher 產生的 **Blob ID** 作為唯一識別碼。加密後的同一份明文每次上傳都會產生不同的 Blob ID（因 IV 不同導致密文不同）。

### 1.2 核心概念

| 概念 | 說明 |
|------|------|
| **Blob** | 儲存在 Walrus 上的不可變二進位物件（本專案中為加密後的檔案位元組） |
| **Blob ID** | Walrus 回傳的唯一識別碼，用於後續擷取 Blob。格式為十六進位字串（如 `0xabc123...`）。**不是 CID**，不具 content addressing 特性 |
| **Publisher** | 負責接收 Blob 上傳的服務端點，處理 erasure coding 並將分片分發至 Storage Nodes |
| **Aggregator** | 負責從 Storage Nodes 收集分片並重組為完整 Blob 供下載的服務端點 |
| **Storage Epoch** | Walrus 網路的時間單位，Blob 存儲以 epoch 為計量。上傳時指定存儲 N 個 epoch，到期後資料不保證可用 |
| **Erasure Coding** | Walrus 使用 erasure coding 將 Blob 分片並冗餘儲存於多個 Storage Nodes，即使部分節點離線仍可恢復完整資料 |

### 1.3 資料可用性模型

```
原始 Blob (加密後的位元組)
    │
    ▼
Publisher 執行 Erasure Coding
    │
    ├── Shard 1 → Storage Node A
    ├── Shard 2 → Storage Node B
    ├── Shard 3 → Storage Node C
    ├── ...
    └── Shard N → Storage Node N
    (含冗餘分片，容許部分節點故障)

下載時：
    Aggregator 從足夠數量的 Storage Nodes 收集分片
    → 重組為完整 Blob
    → 回傳給請求方
```

### 1.4 本專案中 Walrus 的角色

在 RWA Credit Data Room 架構中，Walrus 負責儲存**已加密的文件 Blob**。所有明文在客戶端完成 AES-256-GCM 加密後才上傳至 Walrus。Walrus Storage Nodes 僅看到密文，無法還原明文。

```
┌──────────┐     加密後密文      ┌───────────┐     Blob ID + metadata    ┌──────────┐
│  Browser │ ──────────────────► │  Walrus   │                           │  Sui     │
│ (Client) │                     │ Publisher │                           │ On-chain │
│          │ ◄────── Blob ID ─── │           │                           │          │
│          │ ────── metadata ──────────────────────────────────────────► │ Document │
└──────────┘                     └───────────┘                           └──────────┘
```

---

## 2. 上傳流程 (Upload Flow)

### 2.1 完整流程圖

```
使用者在瀏覽器選擇檔案
  │
  ▼
① Frontend 讀取檔案為 ArrayBuffer
  │
  ▼
② Frontend 從 Sui 取得該 Folder 的 AES Key
   (以該使用者 public key 加密的版本，存於 Sui dynamic field)
  │
  ▼
③ Frontend 以使用者 key pair 於本機解密 AES Key
  │
  ▼
④ Frontend 計算明文的 SHA-256 hash (供後續完整性驗證)
   plaintext_hash = SHA-256(plaintext_bytes)
  │
  ▼
⑤ Frontend 產生隨機 IV (12 bytes, crypto.getRandomValues())
   並以 AES-256-GCM 加密檔案
   encrypted_blob = AES-256-GCM.encrypt(folder_key, iv, plaintext_bytes)
   上傳 payload = iv (12 bytes) || encrypted_blob
  │
  ▼
⑥ Frontend 呼叫 Walrus Publisher API
   POST {publisher_url}/v1/blobs?epochs=N
   Content-Type: application/octet-stream
   Body: iv || encrypted_blob
  │
  ▼
⑦ Walrus 回傳:
   {
     "blob_id": "0x...",
     "size": 1234567,
     "created_epoch": 42,
     "expiry_epoch": 52,
     "cost": { "amount": "1000000", "currency": "SUI" }
   }
  │
  ▼
⑧ Frontend 呼叫 Backend API
   POST /api/v1/pools/:poolId/documents
   Authorization: Bearer <JWT>
   Body: {
     "folder_id": "uuid",
     "title": "Loan Agreement v3.pdf",
     "doc_type": "LOAN_AGREEMENT",
     "walrus_blob_id": "0x...",
     "content_hash": "<plaintext SHA-256 hex>",
     "size_bytes": 1234567,
     "encryption_scheme": "AES_256_GCM",
     "walrus_expiry_epoch": 52
   }
  │
  ▼
⑨ Backend 建構 Sui Transaction
   → 呼叫 document::create_document() Move function
   → Backend 作為 Gas Sponsor (routine metadata write, see ADR-02)
   → 建立 Document object on-chain，含 walrus_blob_id, content_hash 等欄位
  │
  ▼
⑩ Sui emit DocumentCreated event
  │
  ▼
⑪ Event Indexer (gRPC streaming) 接收事件
   → 更新 PostgreSQL 中的文件記錄 (off-chain cache)
  │
  ▼
⑫ Frontend 收到 Backend 回應 (含 document_id)
   → UI 更新：顯示新文件於資料室列表
```

### 2.2 Upload Payload 格式

上傳到 Walrus 的 Blob 內容格式：

```
┌──────────────┬──────────────────────────┐
│ IV (12 bytes)│ AES-256-GCM Ciphertext   │
└──────────────┴──────────────────────────┘
```

- IV 固定為前 12 bytes，Aggregator 下載後直接切分
- AES-256-GCM 的 auth tag (16 bytes) 附在 ciphertext 尾端（Web Crypto API 預設行為）

### 2.3 關鍵設計決策

- **Frontend 直接上傳 Walrus**：密文不經過 Backend，減少攻擊面與頻寬瓶頸
- **Backend 只處理 metadata**：符合 Zero-Trust 架構（見系統架構書 §1.3）
- **Backend sponsor gas**：文件 metadata 寫入屬於 routine operation，由平台代付（見 ADR-02）
- **content_hash 為明文 hash**：用於下載後驗證解密結果的完整性

---

## 3. 下載流程 (Download Flow)

### 3.1 完整流程圖

```
使用者在 UI 點擊文件下載
  │
  ▼
① Frontend 從 Backend API 取得 Document metadata
   GET /api/v1/pools/:poolId/documents/:docId
   回傳: {
     walrus_blob_id: "0x...",
     content_hash: "<plaintext SHA-256>",
     encryption_scheme: "AES_256_GCM",
     title: "Loan Agreement v3.pdf",
     mime_type: "application/pdf",
     ...
   }
  │
  ▼
② Frontend 從 Sui 取得該 Folder 的 AES Key
   (以使用者 public key 加密的版本)
  │
  ▼
③ Frontend 以使用者 key pair 於本機解密 AES Key
  │
  ▼
④ Frontend 呼叫 Walrus Aggregator API
   GET {aggregator_url}/v1/blobs/{blob_id}
   → 回傳: application/octet-stream (iv || encrypted_blob)
  │
  ▼
⑤ Frontend 解析下載的 Blob
   iv = blob_bytes.slice(0, 12)
   ciphertext = blob_bytes.slice(12)
  │
  ▼
⑥ Frontend 以 AES-256-GCM 解密
   plaintext = AES-256-GCM.decrypt(folder_key, iv, ciphertext)
   (若 auth tag 驗證失敗，Web Crypto API 會拋出 OperationError)
  │
  ▼
⑦ Frontend 驗證完整性
   computed_hash = SHA-256(plaintext)
   assert computed_hash === on_chain_content_hash
   若不符 → 中止流程，顯示篡改警告，記錄 security event
  │
  ▼
⑧ Frontend 將解密後的明文呈現給使用者
   → 觸發瀏覽器下載 (Blob URL + <a download>)
   → 或進入 File Preview Pipeline (§4)
```

### 3.2 Seal Beta 引擎差異

若文件使用 Seal 加密方案（`encryption_scheme: "SEAL"`），流程有以下差異：

```
② → Frontend 不從 Sui dynamic field 取 AES key
     而是向 Seal Key Servers 請求 threshold decryption shares
     Seal Key Servers 驗證 on-chain Move policy (該使用者是否為成員且有 VIEWER+ 角色)
     回傳 key shares → Frontend 本地重組解密金鑰
③ → 使用重組後的 Seal key 解密 Blob
```

其餘步驟（hash 驗證、UI 呈現）相同。

---

## 4. 檔案預覽管線 (File Preview Pipeline)

### 4.1 支援格式

| 格式 | 預覽方式 | 技術 |
|------|---------|------|
| **PDF** | 瀏覽器內嵌預覽 | PDF.js (mozilla/pdf.js) |
| **Images** (PNG, JPG, WebP, GIF) | 瀏覽器原生渲染 | `<img>` + `URL.createObjectURL()` |
| **Plain Text** (TXT, CSV, JSON) | 瀏覽器內嵌顯示 | `<pre>` 或 Monaco Editor (read-only) |
| **其他格式** (DOCX, XLSX, etc.) | 不支援預覽 | 顯示「Download to view」按鈕 |

### 4.2 預覽流程

```
文件下載並解密完成 (§3 流程 ⑧)
  │
  ├── 判斷 mime_type
  │
  ├── PDF:
  │     └── 使用 PDF.js 渲染至 <canvas>
  │         → 於 canvas 上方疊加浮水印圖層
  │         → 顯示翻頁控制 UI
  │
  ├── Image:
  │     └── URL.createObjectURL(new Blob([plaintext]))
  │         → 設為 <img src>
  │         → CSS overlay 浮水印
  │
  ├── Text:
  │     └── new TextDecoder().decode(plaintext)
  │         → 渲染至 <pre> 或 read-only editor
  │
  └── 其他:
        └── 顯示檔案資訊 + 「下載查看」按鈕
```

### 4.3 浮水印 (Watermark)

- **內容：** 使用者地址 (truncated, e.g., `0x1234...abcd`) + UTC 時間戳
- **產生方式：** 純客戶端，不經 Backend
- **PDF 實作：** 在 PDF.js 的 `<canvas>` rendering callback 中繪製半透明文字
- **Image 實作：** CSS pseudo-element overlay 或 canvas 合成
- **目的：** 洩露追溯 — 若截圖外流，可辨識洩露來源

### 4.4 安全要求

- **明文絕不傳回 Backend** — 所有預覽在瀏覽器內完成
- 預覽結束後釋放 `URL.revokeObjectURL()` 與 ArrayBuffer reference
- 禁止右鍵選單的「另存圖片」（非嚴格防護，僅增加難度）
- Print 功能加浮水印或完全禁用（依客戶合規需求）

---

## 5. 版本上傳流程 (Version Upload Flow)

### 5.1 流程說明

版本上傳與新文件上傳（§2）流程基本相同，差異如下：

```
使用者在已有文件上點擊「上傳新版本」
  │
  ▼
① ~ ⑥ 同 §2 上傳流程 (加密 → 上傳至 Walrus → 取得新 Blob ID)
  │
  ▼
⑦ Frontend 呼叫 Backend API (不同 endpoint)
   POST /api/v1/pools/:poolId/documents/:docId/versions
   Body: {
     "walrus_blob_id": "<新版本的 Blob ID>",
     "content_hash": "<新版明文 SHA-256>",
     "size_bytes": ...,
     "change_summary": "更新了第三章條款"
   }
  │
  ▼
⑧ Backend 建構 Sui Transaction
   → 呼叫 document::add_version() Move function
   → 在 Document 的 dynamic field 新增 DocVersion
     key: version_number (u64, auto-increment)
     value: DocVersion {
       walrus_blob_id,
       content_hash,
       size_bytes,
       uploaded_by,
       uploaded_at,
       change_summary
     }
  │
  ▼
⑨ Sui emit DocumentVersionAdded event
   → Indexer 更新 PostgreSQL
```

### 5.2 版本歷史不可變性

- **舊版本的 Blob ID 永久保留**在 on-chain DocVersion dynamic fields 中
- **舊 Blob 不刪除** — 這是審計追蹤要求（immutable version history）
- Walrus Renewal Worker 會續約所有版本的 Blob，不僅限最新版
- 每個版本的 `content_hash` 獨立，可分別驗證

### 5.3 版本切換預覽

```
使用者在文件詳情頁選擇歷史版本
  → Frontend 以該版本的 walrus_blob_id 執行 §3 下載流程
  → 呈現該版本的預覽
  → UI 標示「正在檢視 v2 / 共 5 個版本」
```

---

## 6. Walrus Blob 生命週期管理

### 6.1 Storage Epochs

- Walrus 以 **epoch** 為儲存計時單位，上傳時指定存儲 N 個 epoch
- Epoch 長度取決於 Walrus 網路設定（需以實際部署的 Walrus 網路為準）
- Blob 到期後 Storage Nodes 不保證繼續保留資料 — **必須在到期前續約**
- 到期未續約 = **資料永久遺失，不可恢復**

### 6.2 Renewal Worker (Backend)

```
┌─────────────────────────────────────────────────────────┐
│  Walrus Renewal Worker (CronJob: daily 00:00 UTC)       │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
  查詢 DB：所有 active pools 的全部 documents
  (含所有 versions，每個 version 有獨立 blob_id)
              │
              ▼
  For each document version:
    │
    ├── 取得 walrus_expiry_epoch & current_epoch
    │
    ├── if (expiry_epoch - current_epoch) ≤ RENEWAL_THRESHOLD (30 天):
    │     │
    │     ├── 呼叫 Walrus API: POST /v1/blobs/{blob_id}/extend?epochs=N
    │     │
    │     ├── 成功:
    │     │     ├── 更新 DB 中的 expiry_epoch
    │     │     ├── 記錄 renewal event (blob_id, old_expiry, new_expiry, cost)
    │     │     └── 累計費用至 pool 的 cost_tracking
    │     │
    │     └── 失敗:
    │           ├── Retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
    │           ├── Max 5 attempts
    │           └── 仍失敗:
    │                 ├── 發送 alert 至 Ops team (PagerDuty / Slack)
    │                 ├── Email 通知 Pool Owner
    │                 └── 標記該 blob 為 RENEWAL_FAILED
    │
    └── else: skip (尚未進入 renewal window)
```

### 6.3 Renewal 設定

| 參數 | 值 | 說明 |
|------|-----|------|
| `RENEWAL_THRESHOLD` | 30 days | 到期前幾天開始嘗試續約 |
| `DEFAULT_EXTEND_EPOCHS` | 依訂閱方案而定 | 每次續約延長的 epoch 數 |
| `MAX_RETRY_ATTEMPTS` | 5 | 單次 renewal 最大重試次數 |
| `RETRY_BASE_DELAY` | 1000ms | 重試基礎延遲（指數退避） |
| `CRON_SCHEDULE` | `0 0 * * *` | 每日 UTC 00:00 執行 |

### 6.4 訂閱到期對 Blob 的影響

此部分與 ADR-03 完全對齊：

```
訂閱狀態                    Blob 處理方式
─────────────────────────────────────────────────────────────────
Active (正常)              Renewal Worker 自動續約所有 Blob
                            費用由平台吸收（含於訂閱費）

Expired - Grace Period      平台繼續續約 Blob
(到期後 1-14 天)            費用以 1.3x 懲罰費率計算
                            每週發送 email 提醒 + 懲罰金額
                            使用者補繳後恢復正常

Expired - Post Grace        平台停止續約 Blob
(到期後第 15 天起)          Blob 將在各自 epoch 到期時被 Walrus 清除
                            客戶收到最終通知：
                              「您的資料將在 Walrus 儲存 epoch 到期後永久遺失，
                               平台不再負責資料可用性。」
                            平台免責（Terms of Service 已明確告知）
```

### 6.5 通知時間軸

```
D-30 ──── 訂閱到期前 30 天 ────── 首次提醒 email (含 1.3x 懲罰說明)
D-21 ──── 訂閱到期前 21 天 ────── 第二次提醒
D-14 ──── 訂閱到期前 14 天 ────── 第三次提醒 (語氣加重)
D-7  ──── 訂閱到期前 7 天  ────── 最終提醒 (標紅警告)
D-0  ──── 訂閱到期          ────── 帳號標記 expired，啟動 grace period
D+7  ──── 到期後 7 天       ────── Grace period 中間提醒 (含累計懲罰費用)
D+14 ──── 到期後 14 天      ────── Grace period 最終日，最後補繳機會
D+15 ──── 到期後 15 天      ────── 停止續約，發送「資料將遺失」最終通知
```

---

## 7. 備份策略 (Backup Strategy)

### 7.1 Seal Beta Pool 備份

Seal Beta 階段的 Pool 有額外的備份層，作為 Seal Key Servers 可能出現問題時的災難復原手段。

```
文件上傳至 Walrus 成功後
  │
  ▼
Backend Backup Worker (async, event-driven):
  │
  ├── 從 Walrus Aggregator 下載加密後的 Blob
  │   GET {aggregator_url}/v1/blobs/{blob_id}
  │
  ├── 上傳至 S3 (加密 Blob，不是明文)
  │   Bucket: rwa-dataroom-backup-{env}
  │   Key: pools/{pool_id}/documents/{doc_id}/versions/{version}/{blob_id}
  │   Region: ap-southeast-1 (Singapore，符合資料駐地要求)
  │   Storage Class: S3 Standard-IA
  │   Server-Side Encryption: AES-256 (S3 managed, 額外加密層)
  │
  ├── 記錄 S3 key 至 internal DB
  │   backup_records: {
  │     blob_id, s3_key, s3_bucket, backup_at, size_bytes
  │   }
  │
  └── 完成
```

**重要澄清：**
- 備份內容是 **加密後的 Blob**，不是明文
- 即使取得 S3 備份，仍需 Seal Key Servers 的 threshold shares 才能解密
- 備份目的：若 Walrus 發生全面故障，可從 S3 恢復加密 Blob（但仍需 Seal keys）
- Seal Beta 結束後，此備份機制可能轉為 optional

### 7.2 AES Production Pool 備份

| 項目 | 說明 |
|------|------|
| **Primary Storage** | Walrus（唯一正式儲存來源） |
| **Off-chain Backup** | **可選功能**，客戶可在 Pool 設定中啟用 |
| **備份內容** | 加密後 Blob（同 §7.1，不含明文） |
| **備份位置** | S3 Singapore region (`ap-southeast-1`) |
| **觸發方式** | 上傳成功後由 Backup Worker 非同步處理 |
| **恢復流程** | 從 S3 取回加密 Blob → 重新上傳至 Walrus → 更新 on-chain Blob ID |

### 7.3 備份不可取代 Walrus

- Backup 是 **disaster recovery only**，不是 primary storage
- 正常文件存取永遠走 Walrus Aggregator，不走 S3
- 備份恢復需要管理員介入（非自動 failover）
- 備份恢復後產生新 Blob ID（因為是重新上傳至 Walrus），需更新 on-chain metadata

---

## 8. Walrus API 參考

### 8.1 Publisher API — 上傳 Blob

```http
POST {publisher_url}/v1/blobs?epochs={N}
Content-Type: application/octet-stream

Body: <encrypted blob bytes (iv || ciphertext)>
```

**Response 200 OK:**
```json
{
  "blob_id": "0xb3a1c5d9e7f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2",
  "size": 1234567,
  "created_epoch": 42,
  "expiry_epoch": 52,
  "cost": {
    "amount": "1000000",
    "currency": "SUI"
  }
}
```

**Error Responses:**
| Status | 說明 |
|--------|------|
| `400` | 請求格式錯誤（缺少 epochs 參數、body 為空等） |
| `413` | Blob 超過大小限制 |
| `500` | Publisher 內部錯誤 |
| `503` | Publisher 暫時不可用 |

### 8.2 Aggregator API — 下載 Blob

```http
GET {aggregator_url}/v1/blobs/{blob_id}
```

**Response 200 OK:**
```
Content-Type: application/octet-stream
Body: <encrypted blob bytes>
```

**Error Responses:**
| Status | 說明 |
|--------|------|
| `404` | Blob 不存在或已過期被清除 |
| `500` | Aggregator 內部錯誤 |
| `503` | Aggregator 暫時不可用 |

### 8.3 Publisher API — 延長儲存期限

```http
POST {publisher_url}/v1/blobs/{blob_id}/extend?epochs={additional_epochs}
```

**Response 200 OK:**
```json
{
  "blob_id": "0xb3a1c5d9e7f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2",
  "new_expiry_epoch": 62,
  "cost": {
    "amount": "500000",
    "currency": "SUI"
  }
}
```

**Error Responses:**
| Status | 說明 |
|--------|------|
| `404` | Blob ID 不存在 |
| `400` | 無效的 epochs 值 |
| `402` | SUI 餘額不足 |

### 8.4 Endpoint 設定

```typescript
// config/walrus.config.ts
export const WALRUS_CONFIG = {
  // Testnet
  testnet: {
    publisherUrl: 'https://publisher.testnet.walrus.atalabs.io',
    aggregatorUrl: 'https://aggregator.testnet.walrus.atalabs.io',
  },
  // Mainnet (上線前確認正式 URL)
  mainnet: {
    publisherUrl: 'https://publisher.walrus.atalabs.io',
    aggregatorUrl: 'https://aggregator.walrus.atalabs.io',
  },
  // 上傳預設 epoch 數
  defaultEpochs: 10,
  // 備用 Aggregator (failover)
  fallbackAggregators: [
    'https://aggregator-2.walrus.atalabs.io',
  ],
} as const;
```

> **注意：** 以上 URL 為示意，需以 Walrus 官方文件公布的正式 endpoint 為準。部署前務必驗證。

---

## 9. 檔案大小限制與分段上傳 (Chunking)

### 9.1 限制

| 參數 | 值 | 說明 |
|------|-----|------|
| Walrus 單一 Blob 上限 | ~256 MB | 需以 Walrus 官方文件為準，此處為預估值 |
| 分段上傳閾值 | 50 MB | 超過此大小啟用 chunked upload |
| Chunk 大小 | 10 MB | 每個 chunk 作為獨立 Blob 上傳 |

### 9.2 分段上傳流程

```
檔案 > 50 MB
  │
  ▼
① 明文切分為 10 MB chunks
   chunk_0 = plaintext[0..10MB]
   chunk_1 = plaintext[10MB..20MB]
   ...
   chunk_N = plaintext[N*10MB..end]
  │
  ▼
② 每個 chunk 獨立加密
   for each chunk:
     iv_i = crypto.getRandomValues(12 bytes)
     encrypted_chunk_i = AES-256-GCM.encrypt(folder_key, iv_i, chunk_i)
     blob_payload_i = iv_i || encrypted_chunk_i
  │
  ▼
③ 每個 chunk 獨立上傳至 Walrus
   for each chunk (可並行，建議同時 3 個):
     POST {publisher_url}/v1/blobs?epochs=N
     Body: blob_payload_i
     → 取得 blob_id_i
  │
  ▼
④ 組成 chunk manifest
   manifest = {
     "type": "chunked",
     "total_size": <原始明文總大小>,
     "chunk_size": 10485760,  // 10 MB
     "chunks": [
       { "index": 0, "blob_id": "0x...", "size": 10485760 },
       { "index": 1, "blob_id": "0x...", "size": 10485760 },
       ...
       { "index": N, "blob_id": "0x...", "size": <last chunk size> }
     ]
   }
  │
  ▼
⑤ Frontend 呼叫 Backend API
   POST /api/v1/pools/:poolId/documents
   Body: {
     ...standard fields...,
     "walrus_blob_id": null,          // chunked upload 無單一 blob_id
     "chunk_manifest": manifest,       // 完整 manifest
     "content_hash": "<全檔明文 SHA-256>"
   }
  │
  ▼
⑥ Backend 將 manifest 存入 Document metadata (on-chain or off-chain)
```

### 9.3 分段下載與重組

```
Frontend 偵測到 document 有 chunk_manifest
  │
  ▼
① 依序（或並行）下載每個 chunk
   for each chunk in manifest.chunks (可並行，建議同時 3 個):
     GET {aggregator_url}/v1/blobs/{chunk.blob_id}
     → 取得 iv_i || encrypted_chunk_i
  │
  ▼
② 每個 chunk 獨立解密
   for each chunk:
     plaintext_chunk_i = AES-256-GCM.decrypt(folder_key, iv_i, ciphertext_i)
  │
  ▼
③ 依 index 順序重組明文
   plaintext = concat(plaintext_chunk_0, plaintext_chunk_1, ..., plaintext_chunk_N)
  │
  ▼
④ 驗證完整性
   assert SHA-256(plaintext) === on_chain_content_hash
  │
  ▼
⑤ 呈現給使用者
```

### 9.4 進度追蹤

```typescript
// Frontend upload progress tracking
interface UploadProgress {
  totalChunks: number;
  completedChunks: number;
  currentChunkProgress: number;   // 0-100 (per-chunk byte progress)
  overallProgress: number;        // 0-100 (全域進度)
  failedChunks: number[];         // 需要重試的 chunk indices
  status: 'uploading' | 'retrying' | 'completed' | 'failed';
}
```

- 每個 chunk 失敗可獨立重試，不需重傳整個檔案
- 重試策略：exponential backoff，max 3 attempts per chunk
- 所有 chunk 中任一個最終失敗 → 整個上傳標記為 failed，清理已上傳的 blob（或保留待重試）

---

## 10. 費用模型 (Cost Model)

### 10.1 計費原則

- Walrus 按 **Blob 大小 × Epoch 數** 收費（以 SUI 計價）
- **平台統一代付**所有 Walrus 費用，計入客戶的 SaaS 訂閱費
- 客戶不直接與 Walrus 發生費用關係

### 10.2 費用追蹤

```typescript
// Backend: per-pool cost tracking
interface PoolCostRecord {
  pool_id: string;
  period: string;            // e.g., "2026-03"
  upload_cost_sui: bigint;   // 累計上傳費用
  renewal_cost_sui: bigint;  // 累計續約費用
  total_blobs: number;       // 總 blob 數
  total_bytes: bigint;       // 總儲存量
  penalty_multiplier: number; // 1.0 (正常) or 1.3 (grace period)
}
```

### 10.3 預算警報

| 觸發條件 | 通知對象 | 通知方式 |
|---------|---------|---------|
| Pool 儲存費用超過月度閾值 80% | Org Admin | 平台內通知 + Email |
| Pool 儲存費用超過月度閾值 100% | Org Admin + Ops | Email + Slack alert |
| 平台 SUI 儲備金低於安全閾值 | Ops team | PagerDuty alert |

### 10.4 Cost Optimization 策略

- 上傳時選擇合理的 epoch 數（不要過長，增加不必要成本）
- Renewal Worker 統一在最佳時機批次續約，避免碎片化
- 監控 Walrus 費率變化，預留 buffer

---

## 11. 錯誤處理 (Error Handling)

### 11.1 錯誤表

| 錯誤 | 原因 | 前端處理 | 後端處理 |
|------|------|---------|---------|
| **Upload timeout** | 大檔案、慢網路 | 顯示進度條 + 自動 retry（exponential backoff, max 3x） | N/A (前端直傳 Walrus) |
| **Upload 413** | 檔案超過 Walrus 單一 Blob 上限 | 自動切換為 chunked upload（§9） | N/A |
| **Blob not found (404)** | Blob 已過期被清除，或上傳尚未傳播 | 若為近期上傳 → 5 秒後重試；若非近期 → 提示「檔案已過期」 | 檢查 DB 中 expiry_epoch 判斷是否已過期 |
| **Aggregator unavailable (503)** | 網路問題或 Aggregator 維護 | 切換至 fallback Aggregator endpoint 重試 | Health check 監控 Aggregator 狀態 |
| **Hash mismatch** | 資料損毀或遭篡改 | **嚴重警告**：顯示「文件完整性驗證失敗，可能已被篡改」；禁止預覽/下載 | 記錄 security event，通知 Ops team |
| **AES decrypt failure** | 金鑰不匹配或密文損毀 | 提示「解密失敗，請聯繫管理員」 | 檢查金鑰版本是否因 key rotation 而不匹配 |
| **Renewal failure** | SUI 餘額不足 / Walrus 問題 | N/A (使用者不直接操作) | Retry 5x → alert Ops team → email Pool Owner |
| **Publisher unavailable (503)** | Publisher 維護 | 提示「上傳服務暫時不可用，請稍後重試」+ 自動 retry | 監控 Publisher 狀態 |
| **Insufficient SUI for upload** | 平台 SUI 儲備不足 | 提示「服務暫時不可用」（不透露內部原因） | Alert Ops team 立即補充 SUI |

### 11.2 重試策略

```typescript
// Shared retry utility
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts: number;    // 預設 3 (upload) 或 5 (renewal)
    baseDelay: number;      // 預設 1000ms
    maxDelay: number;       // 預設 30000ms
    backoffFactor: number;  // 預設 2
  }
): Promise<T> {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === options.maxAttempts) throw error;
      const delay = Math.min(
        options.baseDelay * Math.pow(options.backoffFactor, attempt - 1),
        options.maxDelay
      );
      await sleep(delay);
    }
  }
}
```

---

## 12. 安全性考量 (Security Considerations)

### 12.1 完整性驗證 (Integrity Check)

- 客戶端**必須**在每次解密後驗證 `SHA-256(plaintext) === on_chain_content_hash`
- 驗證失敗時：
  - 中止呈現，不顯示可能被篡改的內容
  - 記錄 security event（blob_id, expected_hash, actual_hash, user_address, timestamp）
  - 通知 Pool Owner 與 Ops team
  - 標記該 Document version 為 `INTEGRITY_COMPROMISED`

### 12.2 Walrus Storage Node 安全性

- Storage Nodes 僅儲存加密後的 Blob — **無法存取明文**
- 對機構級資料而言，「Storage Nodes 看到密文」是可接受的安全模型
- 額外風險：Storage Node 可觀察到上傳/下載的 access pattern（時間、頻率、大小）
  - 緩解方式：此 metadata 洩漏風險在本產品的威脅模型中為 acceptable risk

### 12.3 Blob ID 的公開性

- **Blob ID 本身是公開的** — 任何知道 Blob ID 的人都可以從 Aggregator 下載加密後的 Blob
- 但下載到的是密文，沒有 AES key 或 Seal key shares 無法解密
- **安全假設：AES-256-GCM 的計算安全性保護明文機密性**
- 即使 Blob ID 洩漏，攻擊者取得的只是無法解讀的位元組

### 12.4 IV/Nonce 安全性

```
⚠️ 嚴格要求：每次加密操作必須使用唯一的 IV (nonce)

- AES-256-GCM 的 nonce 為 12 bytes (96 bits)
- 必須使用 crypto.getRandomValues() 產生
- 絕對禁止：
  - 重複使用相同 (key, nonce) 組合（會導致 nonce-reuse attack，洩漏明文 XOR）
  - 使用 Math.random() 或其他非密碼學安全的隨機源
  - 使用遞增計數器作為 nonce（在分散式環境中容易碰撞）
```

### 12.5 金鑰輪替 (Key Rotation on Member Removal)

當成員被移除時，必須執行 key rotation 以確保被移除成員無法存取未來（及部分歷史）文件：

```
成員 B 被移除出 DataRoom
  │
  ▼
① 產生新的 AES key (new_folder_key) for 每個 B 有權存取的 folder
  │
  ▼
② 以剩餘成員的 public keys 加密 new_folder_key
   → 更新 Sui dynamic fields
  │
  ▼
③ 對受影響 folder 中的每份文件（所有版本）:
   a. 從 Walrus 下載加密 blob
   b. 以舊 key 解密
   c. 以 new_folder_key + 新 IV 重新加密
   d. 上傳新 blob 至 Walrus
   e. 更新 on-chain Blob ID (new blob_id replaces old)
   f. 舊 Blob 不立即刪除（但可在下次 epoch 自然過期）
  │
  ▼
④ Emit KeyRotated event on-chain
```

**效能考量：**
- Key rotation 是昂貴操作（需 re-encrypt 所有受影響文件）
- 對大型 Pool，建議在低峰時段排程執行
- UI 應顯示 progress indicator：「正在更新安全金鑰... (3/12 個檔案)」
- 可考慮分批處理，避免單次操作過長

### 12.6 前端安全清理

```typescript
// 解密完成後的記憶體清理
function cleanupDecryptedData(buffer: ArrayBuffer) {
  // 清零 ArrayBuffer 內容
  new Uint8Array(buffer).fill(0);

  // 撤銷 Object URL (若有建立)
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
}

// 頁面切換或 Tab 關閉時自動清理
window.addEventListener('beforeunload', () => {
  cleanupAllDecryptedBuffers();
});
```

### 12.7 威脅模型摘要

| 威脅 | 風險等級 | 緩解措施 |
|------|---------|---------|
| Backend 被入侵 | **低** — Backend 從未持有明文或金鑰 | Zero-Trust 架構設計 |
| Walrus Storage Node 被入侵 | **低** — 僅持有密文 | AES-256-GCM 加密 |
| Blob ID 洩漏 | **低** — 密文無法解讀 | 加密保護，金鑰獨立管理 |
| Nonce 重複使用 | **高（若發生）** | 強制使用 crypto.getRandomValues()，code review 確保 |
| 前端 XSS 攻擊 | **中** | CSP headers, sanitization, 金鑰不存 localStorage |
| 被移除成員仍持有舊 key | **中** | Key rotation 重新加密所有受影響文件 |
| Walrus 全面故障 | **低** | S3 備份（Seal Beta 預設啟用，AES 可選） |

---

## 附錄 A: Frontend Encryption SDK Interface

```typescript
// 與 §2, §3 流程對應的 SDK 介面概要

interface WalrusUploadResult {
  blobId: string;
  size: number;
  createdEpoch: number;
  expiryEpoch: number;
}

interface EncryptionSDK {
  // 加密檔案並上傳至 Walrus
  encryptAndUpload(
    file: File,
    folderKey: CryptoKey,
    walrusPublisherUrl: string,
    epochs: number,
  ): Promise<{
    walrusResult: WalrusUploadResult;
    contentHash: string;     // SHA-256 of plaintext (hex)
    sizeBytes: number;
  }>;

  // 從 Walrus 下載並解密
  downloadAndDecrypt(
    blobId: string,
    folderKey: CryptoKey,
    expectedHash: string,
    walrusAggregatorUrl: string,
  ): Promise<{
    plaintext: ArrayBuffer;
    verified: boolean;       // hash check passed
  }>;

  // 從 Sui dynamic field 取得並解密 folder key
  getFolderKey(
    dataRoomId: string,
    folderId: number,
    userKeyPair: CryptoKeyPair,
  ): Promise<CryptoKey>;
}
```

---

## 附錄 B: Backend Document Metadata Schema

```typescript
// 對應 §2 step ⑧ 的 Backend API payload & DB schema

interface DocumentMetadata {
  id: string;                    // UUID (backend-generated)
  pool_id: string;
  folder_id: string;
  title: string;
  doc_type: DocType;             // LOAN_AGREEMENT | KYC_DOC | AUDIT_REPORT | IC_DECISION | ...
  walrus_blob_id: string | null; // null if chunked upload
  chunk_manifest: ChunkManifest | null;
  content_hash: string;          // SHA-256 of plaintext (hex)
  size_bytes: number;
  encryption_scheme: 'AES_256_GCM' | 'SEAL';
  walrus_expiry_epoch: number;
  current_version: number;
  uploaded_by: string;           // Sui address
  created_at: string;            // ISO 8601
  sui_object_id: string;         // on-chain Document object ID
}

interface ChunkManifest {
  type: 'chunked';
  total_size: number;
  chunk_size: number;
  chunks: Array<{
    index: number;
    blob_id: string;
    size: number;
  }>;
}
```
