# RWA Credit Data Room — 全面審查報告

**審查日期：** 2026-03-11
**審查範圍：** Idea 構想文件 (10 份) + 正式設計文件 (4 份)
**審查維度：** 架構設計、安全性、文件一致性、技術可行性

---

## Executive Summary

本專案定位為「私募信貸型 RWA 合規資料室」，概念清晰、市場定位精準。但在將 Idea 轉化為可開發規格的過程中，存在 **多項關鍵技術誤解與規格缺口**，若不修正將導致開發方向錯誤或重大返工。

### 嚴重程度統計

| 等級 | 數量 | 說明 |
|------|------|------|
| 🔴 CRITICAL | 12 | 阻斷開發，必須在寫 code 前解決 |
| 🟠 HIGH | 10 | 影響核心功能品質，v0 需處理 |
| 🟡 MEDIUM | 12 | 影響合規/UX，Phase 1 內需處理 |
| 🔵 MINOR | 15 | 可在開發中決定 |

---

## Part 1: 🔴 CRITICAL Issues

### C1. Seal 整合架構根本性錯誤

**現狀（規格書/架構書的描述）：**
> "API Gateway 呼叫 Seal Policy 引擎"、"由 API Gateway 進行統一密鑰處理"

**問題：** 這完全錯誤。Seal 不是一個後端 API。

**Seal 實際運作方式：**
1. 存取策略定義為 Sui Move 模組（例如「只有 DataRoom.members 中 role >= Reviewer 的地址可解密」）
2. 加密時：客戶端使用 Seal SDK 以 **policy object ID** 加密資料
3. 解密時：客戶端向 **Seal key servers** 請求金鑰碎片，key servers 在鏈上執行 Move policy 驗證存取權
4. 驗證通過則返回碎片，客戶端本地重建解密金鑰

**後端完全不在解密路徑中。**

**修正方案：**
- 刪除架構書中所有「API Gateway 呼叫 Seal」的描述
- 新增 Seal policy Move 模組設計：

```move
module rwa_dataroom::seal_policy {
    /// Seal key servers 呼叫此函式驗證存取權
    public fun can_access(
        dataroom: &DataRoom,
        caller: address,
        min_role: u8,
    ): bool {
        let membership = table::borrow(&dataroom.members, caller);
        membership.is_active && (membership.role & min_role) > 0
    }
}
```

- 加密粒度建議：**per-DataRoom + role-tier policies**（一般文件用 Viewer+ policy，敏感文件用 Reviewer+ policy）

### C2. Walrus 術語與整合模型錯誤

**現狀：** 規格中使用 "Walrus CID"、"Walrus URL"。

**問題：** Walrus **不使用 CID**（那是 IPFS）。Walrus 使用 **Blob ID**。

**正確流程：**
1. 客戶端本地透過 Seal threshold encryption 加密文件
2. 客戶端呼叫 Walrus Publisher API 存儲加密 blob
3. Walrus 返回 **Blob ID**
4. 客戶端提交 Sui 交易，將 Blob ID 記錄到 Document 物件
5. 讀取時：透過 Blob ID 從 Walrus Aggregator 取得 blob，本地透過 Seal 解密

**修正：** 全文件將 "CID" 替換為 `walrus_blob_id`。

### C3. 客戶端加密是強制要求，非可選

**現狀：** 架構書提到「前端或經由 API Gateway 進行統一密鑰處理」。

**問題：** 若 API Gateway 能看到明文或加密金鑰：
- 平台營運方可讀取所有客戶 KYC/法律文件
- 違反「零信任」宣稱
- 機構客戶不會接受

**修正：**
- **客戶端加密為強制性**，API Gateway 永遠不得接觸明文或金鑰
- 前端直接與 Walrus 通訊上傳/下載
- API Gateway 僅處理 metadata、索引、交易建構

### C4. `vector<DocVersion>` 會撞 Sui 物件大小限制

**問題：** Sui 物件實務上限約 256KB。每個 DocVersion 含 blob ID、hash、uploader、changelog 等。50+ 版本時 Document 物件會超出限制導致交易失敗。

**修正：** 使用 dynamic fields：

```move
struct Document has key, store {
    id: UID,
    dataroom_id: ID,
    folder_id: u64,
    doc_type: u8,
    title: String,
    current_version: u64,
    version_count: u64,
    required_flag: bool,
    review_state: u8,
    // ...
}
// 每個版本以 dynamic field 存儲：
// dynamic_field::add(&mut doc.id, version_number, doc_version)
```

### C5. `vector<Membership>` 同樣有無限增長問題

**問題：** 機構信貸案件輕易 30+ 成員。每次成員變更需載入並重寫整個 vector。

**修正：** 使用 `Table<address, Membership>`：

```move
struct DataRoom has key, store {
    id: UID,
    pool_id: ID,
    owner: address,
    member_count: u64,
    members: Table<address, Membership>,
    // ...
}
```

### C6. AuditTrailEntry 作為獨立物件 — 儲存成本爆炸

**問題：** 每個操作建一個 Sui 物件，每個 Pool 會產生數百/數千物件。每個都有儲存費用，極為昂貴且不必要。

**修正：** 改用 **events**（免費 emit、可被 indexer 查詢）+ Walrus 存詳細 log：

```move
public struct AuditEvent has copy, drop {
    pool_id: ID,
    actor: address,
    action_type: u8,
    target_id: ID,
    timestamp: u64,
    metadata_hash: vector<u8>,
}
// 在函式中 emit：
event::emit(AuditEvent { ... });
```

Indexer 捕獲 events 寫入 PostgreSQL。定期批次打包存 Walrus 做合規留底。

### C7. Move Entry Functions 缺乏鏈上授權檢查

**問題：** 角色存在 Membership table，但未指定 Move entry functions 如何驗權。若函式可被任意地址呼叫、僅依賴 API Gateway 做 auth，則整個權限模型可被繞過（直接提交 Sui 交易）。

**修正：** 每個狀態修改函式必須檢查 `tx_context::sender()`：

```move
public entry fun progress_to_dd(
    pool: &mut Pool,
    dataroom: &DataRoom,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    let member = table::borrow(&dataroom.members, sender);
    assert!(member.is_active && member.role & ROLE_OWNER > 0, EUnauthorized);
    assert!(pool.current_state == STATE_DRAFT, EInvalidStateTransition);
    pool.current_state = STATE_DD_IN_PROGRESS;
    // emit event...
}
```

### C8. 缺少 Move 模組介面規格

**問題：** 架構書僅概念性描述物件，未定義：模組名稱/檔案結構、entry function 簽名、Capability/AdminCap 模式、物件擁有權模型（shared vs owned）、Event struct 定義。

**修正：** 建立 `docs/design/move-interface.md`，建議模組結構：

```
rwa_dataroom/sources/
  pool.move          // Pool struct, 狀態機, 轉移函式
  dataroom.move      // DataRoom, 成員管理
  document.move      // Document, 版本管理
  seal_policy.move   // Seal 存取策略驗證
  ic_decision.move   // IC 決策記錄
  admin.move         // AdminConfig, 暫停, upgrade cap
  events.move        // 所有 event 定義
  errors.move        // 錯誤常數
  types.move         // 共享常數 (roles, states, doc_types)
```

### C9. 缺少 API 規格

**問題：** 前後端團隊無法平行開發。無 endpoint 定義、request/response payload、auth header、error code。

**修正：** 建立 `docs/design/api-spec.md`，至少涵蓋：Auth flow, Pool CRUD, Document CRUD, Membership 管理, 狀態轉移, Audit log 查詢。

### C10. 缺少 Off-chain Database Schema

**問題：** 提到 PostgreSQL + Redis 但無任何表定義。

**修正：** 建立 `docs/design/db-schema.md`，至少包含：`orgs`, `users`, `pool_cache`, `document_cache`, `comments`, `audit_log_detail`, `checklist_templates`, `checklist_items`。

### C11. 缺少認證/Session 管理設計

**問題：** 提到「錢包登入或 SSO」但未指定：
- 錢包 auth 流程（sign message → JWT?）
- Session 生命週期
- 後端如何驗證呼叫者地址
- 用戶簽名所有交易？還是 API server 有 custodial key？

**修正：** 在架構書新增 "Authentication & Authorization Flow" 章節。

### C12. DD Checklist 系統未被正式規格化

**問題：** Idea 文件詳述了 checklist（per-folder 建議文件、使用者勾選、完成度追蹤、checklist 完成與 Pool 狀態轉移的關聯），但正式規格書完全未涵蓋。這是核心差異化功能。

**修正：** 在規格書新增「DD Checklist & Gate Conditions」章節，定義：checklist template schema、per-pool 客製化、狀態轉移前置條件、UI 顯示規則。

---

## Part 2: 🟠 HIGH Risk Issues

### H1. 狀態機缺少 Rejected / Cancelled 狀態

**問題：** IC 可以拒絕、Originator 可以撤回，但狀態機沒有這些路徑。

**修正後狀態機：**
```
Draft → DD_In_Progress → IC_Review → Approved_Internal → Ready_To_Issue
                                   → Rejected
                        ← DD_In_Progress (IC 要求補件)
Draft → Cancelled
DD_In_Progress → Cancelled
Rejected → Draft (重新開案，可選)
```

### H2. 成員移除後仍可解密歷史文件

**問題：** Seal 移除成員後阻止未來解密，但已取得的金鑰/明文不可撤回。對合規級資料室，這是根本性缺口。

**修正：**
1. 成員移除時，對其曾存取的文件執行 **re-encryption**（新金鑰加密、重新上傳 Walrus、更新 Blob ID）
2. 至少維護 **access log** 知道被移除成員曾存取哪些文件
3. 建議採 **per-document key** 模型（非 per-Pool），縮小 re-encryption 範圍

### H3. Pool-DataRoom 擁有權關係模糊

**修正：** Pool 透過 `dynamic_object_field` 擁有 DataRoom：

```move
// DataRoom 作為 Pool 的 dynamic object field：
dynamic_object_field::add(&mut pool.id, b"dataroom", dataroom);
```

好處：刪除 Pool 自動級聯、狀態轉移可原子性存取 DataRoom、無孤兒 DataRoom。

### H4. Package Upgrade 風險

**問題：** Move package 可升級。惡意升級可改變狀態機規則、移除授權檢查。

**修正：**
- 核心授權和狀態機模組使用 **immutable package**
- 若需可升級：`UpgradeCap` 由 multi-sig 持有 + time-lock governance
- 向客戶明確文件化升級策略

### H5. Walrus 資料可用性風險

**問題：** 若足夠多 Walrus 節點同時下線，加密文件暫時或永久不可用。法律/合規文件需隨時可調閱。

**修正：**
1. 維護所有關鍵文件的 **off-chain 加密備份**（傳統雲端，仍用相同金鑰加密）
2. 監控 Walrus 儲存健康度
3. 評估並文件化 Walrus SLA

### H6. 鏈上 Metadata 洩漏風險

**問題：** 即使不解密文件，觀察者可看到：
- 誰在同一個 data room（揭露商業關係）
- 文件上傳模式揭露交易時程
- `IC_Review → Approved_Internal` 揭露投資決策

**修正：**
- 最小化鏈上 metadata
- 資料夾/類別使用不透明 ID（非 "KYC"、"Legal"）
- 考慮 Membership 是否應 hash 化

### H7. 單一 Document 審核狀態不夠用

**問題：** 多個 reviewer 審閱同一份文件，需獨立追蹤每人簽核。

**修正：**
```move
struct ReviewRecord has store, drop {
    reviewer: address,
    status: u8,       // Pending=0, Approved=1, NeedsRevision=2
    comment_hash: Option<vector<u8>>,
    reviewed_at: u64,
}
// 以 dynamic field 存在 Document 上, keyed by reviewer address
```

### H8. 角色名稱不一致

| 來源 | 角色列表 |
|------|---------|
| Idea（權限模型）| Org Admin, Pool Owner, Editor, Reviewer, Viewer, Auditor |
| 正式規格書 | Pool Owner, Editor, Reviewer, Viewer |

`Org Admin` 和 `Auditor` 在正式文件中消失。

**修正：** 建立標準角色 enum。建議使用 bitmask：
```move
const ROLE_VIEWER: u8 = 1;
const ROLE_REVIEWER: u8 = 2;
const ROLE_EDITOR: u8 = 4;
const ROLE_OWNER: u8 = 8;
const ROLE_AUDITOR: u8 = 16;
const ROLE_ORG_ADMIN: u8 = 32;
```

### H9. Seal Policy 無法直接讀取鏈上狀態（需驗證）

**問題：** Tech Feasibility agent 指出 Seal policies 可能無法原生引用 Sui contract state。若屬實，需要 oracle bridge 或 attestation 模式。

**修正：** 必須在實作前驗證 Seal SDK 最新版本的能力。若確認無法直接讀取：
- Phase 1 改用較簡單的對稱加密 + membership 控制
- Phase 2 導入 Seal 進階策略

### H10. 缺少通知/提醒機制規格

**問題：** Idea 文件多處提到通知（文件被標記 Needs Revision、通知 IC 成員上線審核、@ 提及），但正式文件完全未涵蓋。

**修正：** 新增 notification 章節：delivery channels、trigger events、偏好設定。

---

## Part 3: 🟡 MEDIUM Risk Issues

| # | 問題 | 修正建議 |
|---|------|---------|
| M1 | 無 Emergency Pause 機制 | `AdminCap`-gated `pause()` 函式，multi-sig 持有 |
| M2 | 關鍵操作無 Multi-sig | IC Approve 和 Ready_To_Issue 應要求多方簽署 |
| M3 | GDPR 刪除權 vs 不可變鏈上記錄 | PII 用 salted hash（salt 存 off-chain 可銷毀）、銷毀加密金鑰實現「實際刪除」|
| M4 | 跨境資料傳輸合規 | 評估 Walrus 是否支援地理定位；客戶端加密可作為法律論據 |
| M5 | `.gitignore` 不足 | 立即新增 `.env*`, `*.key`, `*.pem`, `node_modules/`, `.sui/` |
| M6 | Walrus blob ID vs 明文 hash 的差異 | 加密後 blob 的 ID 不等於明文 hash，需在鏈上同時存兩者 |
| M7 | Race Condition: 撤權與下載同時發生 | Seal key 設短 TTL + 記錄所有存取嘗試 |
| M8 | Document Review 狀態機不一致 | Idea 文件出現 "Approved" vs "Reviewed"，需統一 |
| M9 | Sui JSON-RPC 即將 deprecated | 改用 gRPC streaming 或 GraphQL（2026 April deprecated）|
| M10 | 需使用 `sui::clock::Clock` 取得時間戳 | 所有需要 timestamp 的函式接受 `&Clock` 參數 |
| M11 | 無檔案預覽規格 | 指定支援格式（PDF/DOCX/Images）及客戶端解密→渲染 pipeline |
| M12 | 無災難復原計畫 | On-chain 資料不可變；off-chain DB 應可從鏈上 events + Walrus 重建 |

---

## Part 4: 🔵 MINOR Issues（15 項，開發中決定）

- 收費模型未正式文件化
- Mobile/Tablet 響應式設計
- 無障礙 (a11y) 未提及
- 國際化 (i18n) 策略
- 離線/弱網處理
- 批次操作（批量審核、批量下載）
- 搜尋實作細節（v0 用 PostgreSQL tsvector 即可）
- 資料保留/刪除政策
- 錯誤處理規範
- 組織建立流程（第一個使用者如何開始）
- WebSocket/SSE 即時更新
- UI 設計未涵蓋所有畫面（Pool 建立精靈、Audit Feed、版本歷史、Checklist 管理）
- 測試策略文件
- 部署計畫文件
- Comment system 實作細節

---

## Part 5: 修正後的物件依賴圖

```
Pool (shared object)
  ├── [dynamic_object_field "dataroom"] → DataRoom
  │     ├── [Table<address, Membership>]
  │     └── [dynamic_field folder_{id}] → FolderMeta
  │
  ├── [dynamic_field doc_{id}] → Document
  │     ├── [dynamic_field version_{n}] → DocVersion
  │     └── [dynamic_field review_{addr}] → ReviewRecord
  │
  └── [dynamic_field ic_decision_{n}] → ICDecision

AdminConfig (shared object, singleton)

Events (emitted, not stored as objects):
  PoolCreated, PoolStateChanged, PoolCancelled,
  MemberAdded, MemberRevoked,
  DocumentCreated, DocumentVersionAdded, DocumentReviewed,
  ICDecisionRecorded, AuditEvent
```

---

## Part 6: 缺少的設計文件清單

| 文件 | 優先級 | 說明 |
|------|--------|------|
| `move-interface.md` | 🔴 開發前 | Move struct 定義、entry function 簽名、events |
| `api-spec.md` | 🔴 開發前 | REST endpoints、payloads、auth headers |
| `db-schema.md` | 🔴 開發前 | PostgreSQL 表結構 |
| `auth-flow.md` | 🔴 開發前 | 錢包認證、Session、交易簽名流程 |
| `seal-integration.md` | 🟠 第一個 sprint | Seal policy schema、加密/解密流程、key management |
| `walrus-integration.md` | 🟠 第一個 sprint | 上傳/下載流程、Blob ID 管理、備份策略 |
| `checklist-spec.md` | 🟠 第一個 sprint | DD Checklist 模板、gate conditions |
| `notification-design.md` | 🟠 PoC 前 | 通知 channels、trigger events |
| `test-strategy.md` | 🟡 PoC 前 | Unit → Integration → Monkey testing |
| `deployment.md` | 🟡 PoC 前 | Sui network target、CI/CD、環境管理 |
| `security-model.md` | 🟠 第一個 sprint | 信任模型、威脅模型、加密架構 |

---

## Part 7: 技術可行性總結

| 技術 | 狀態 | 可行性 | 注意事項 |
|------|------|--------|---------|
| **Sui Move** | ✅ Production | 高 | 物件模型非常適合此 use case |
| **Walrus** | ✅ Testnet+ | 高 | 需注意不使用 CID 術語；注意 SLA |
| **Seal** | ⚠️ 早期/實驗性 | 中 | 可能無法直接讀取鏈上狀態；需驗證最新 SDK |
| **整合架構** | ⚠️ 需修正 | 中高 | 修正 Seal 架構後可行 |

**整體可行性：7/10** — 技術上可行，但需要自訂 orchestration。建議 MVP 階段若 Seal 尚未成熟，先用對稱加密 + membership 控制，Phase 2 再導入 Seal。

---

## Part 8: 開發前必做 Action Items（按優先序）

### 立即（寫 code 之前）
1. ✏️ 修正架構書中 Seal 整合描述（C1）
2. ✏️ 修正所有 Walrus CID → Blob ID（C2）
3. ✏️ 強制客戶端加密，重寫加密架構（C3）
4. 📝 撰寫 `move-interface.md`（C8）
5. 📝 撰寫 `api-spec.md`（C9）
6. 📝 撰寫 `db-schema.md`（C10）
7. 📝 撰寫 `auth-flow.md`（C11）
8. ✏️ 修正物件模型：vector → dynamic fields/Table（C4, C5）
9. ✏️ AuditTrailEntry 改為 events（C6）
10. 📝 加入 DD Checklist 規格（C12）

### 第一個 Sprint 內
11. 📝 撰寫 `seal-integration.md`（驗證 Seal 最新能力）
12. 📝 撰寫 `walrus-integration.md`
13. ✏️ 補齊狀態機（Rejected, Cancelled）（H1）
14. ✏️ 統一角色名稱（H8）
15. ✏️ 加入 per-reviewer 追蹤（H7）
16. ✏️ 定義 Package upgrade 策略（H4）
17. ✏️ 加入 Emergency pause（M1）
18. ✏️ 擴充 `.gitignore`（M5）

### PoC 前
19. 📝 撰寫通知系統設計
20. 📝 撰寫測試策略
21. 📝 撰寫部署計畫
22. 🔒 初步安全審計
23. 法律諮詢：GDPR、跨境資料傳輸

---

## Part 9: 開放問題（需決策）

1. **Seal 加密模型**：per-Pool key 還是 per-Document key？前者簡單但成員移除需 re-encrypt 全部文件；後者複雜但 blast radius 小
2. **交易簽名方式**：用戶在瀏覽器簽名（推薦）還是 API server custodial key（不推薦）？
3. **Walrus 費用模型**：儲存 epoch 過期後文件如何續期？誰付費？
4. **合規認證**：目標客戶是否要求 SOC 2 / ISO 27001？
5. **目標司法管轄區**：US (SEC)? EU (MiCA)? Singapore (MAS)?
6. **Key Recovery**：Pool Owner 遺失錢包金鑰的復原機制？機構客戶不接受「你的鑰匙你負責」
7. **Seal 成熟度**：若 Seal 尚未 production-ready，Phase 1 是否先用對稱加密替代？
