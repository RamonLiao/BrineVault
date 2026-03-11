# RWA Credit Data Room — 架構決策記錄 (Architecture Decision Records)

**建立日期：** 2026-03-11
**狀態：** 已確認

---

## ADR-01: 加密粒度 — Per-Folder Key

**決策：** 採用 per-Folder 加密模型。

**理由：**
- 私募信貸場景中，敏感度自然按資料夾分層（KYC > Collateral > Reports > Misc）
- 成員移除時只需 re-encrypt 其有權存取的資料夾，而非全部或每一份文件
- 平衡金鑰管理複雜度與安全性

**實作：**
- 每個 DataRoom folder 持有獨立的 AES-256-GCM symmetric key
- 金鑰以 DataRoom members 的公鑰加密後存在 Sui dynamic field
- 成員移除 → rotate 該成員可存取的 folder keys → re-encrypt 受影響文件

---

## ADR-02: 交易簽名 — 混合模式

**決策：** 關鍵操作由用戶瀏覽器簽名；routine metadata 寫入由 backend sponsor gas。

**理由：**
- 狀態轉移、權限變更等高權限操作需要用戶親自簽名，確保不可否認性
- 文件 metadata 寫入、audit event 等低敏感操作由 backend 代付 gas，提升 UX
- Sui 原生支援 sponsored transactions

**分類：**
| 操作類型 | 簽名方式 |
|---------|---------|
| Pool 狀態轉移 | 用戶簽名 |
| 成員新增/移除 | 用戶簽名 |
| IC 決議提交 | 用戶簽名 |
| 文件 metadata 寫入 | Backend sponsor |
| Audit event emit | Backend sponsor |
| Document review 狀態變更 | 用戶簽名 |

---

## ADR-03: Walrus 費用模型 — 平台代付 + 逾期懲罰機制

**決策：** 平台統一代付 Walrus 儲存費用，計入 SaaS 訂閱費。設有明確的到期提醒與懲罰機制。

### 正常狀態
- 平台方統一代付 Walrus 儲存費用
- 後端 worker 自動在 epoch 到期前 renew blobs
- 關鍵文件同時維護 off-chain 加密備份（S3 等）
- 成本轉嫁：按 Pool 數量 + 儲存容量計入訂閱費

### 到期提醒機制
- **訂閱到期前 30 天**：開始發送提醒通知（Email + 平台內通知）
- **頻率：每週一次**，共約 4 次提醒
- **提醒內容必須包含：**
  - 訂閱到期日期
  - 未續約的嚴重後果（資料可能被 Walrus 清除、無法恢復）
  - 若過期後由平台墊付，將按 **1.3 倍懲罰費率** 徵收
  - 墊付寬限期為 **14 天**，逾期不再負責管理

### 過期處理流程
```
訂閱到期
  ├── 到期前 30 天：開始每週提醒（共 ~4 次）
  │     └── 提醒內容：到期日、後果、1.3x 懲罰費率、14 天寬限
  ├── 到期日：帳號標記為 expired
  │     └── 平台自動墊付 Walrus 費用（啟動 14 天寬限期）
  ├── 到期後 1-14 天：
  │     └── 客戶可補繳費用（按 1.3 倍計算）
  │     └── 補繳後恢復正常服務
  └── 到期後第 15 天：
        └── 停止墊付 Walrus 費用
        └── 停止所有平台服務
        └── Walrus 上的資料可能在後續 epoch 被清除
        └── 平台不再負責資料可用性
```

### 通知信範本要點
- 標題：「[重要] 您的 RWA Data Room 訂閱即將到期」
- 正文需包含：
  - 明確到期日期
  - 「若未在到期前續約，平台將代為墊付 Walrus 儲存費用，但將以原費用的 **1.3 倍** 向您追收。」
  - 「寬限期為到期後 **14 天**。超過 14 天未補繳費用，平台將停止代管，您的文件可能因 Walrus 儲存 epoch 到期而被永久清除，且無法恢復。」
  - 續約連結 / 聯繫方式

---

## ADR-04: 合規認證策略 — SOC 2 + ISO 27001 雙軌互補

**決策：** 從 Phase 1 起按 SOC 2 + ISO 27001 標準設計，分階段取得正式認證。

### 策略定位
| 認證 | 定位 | 價值 |
|------|------|------|
| **SOC 2** | 透明信任 | 由會計師事務所出具報告，展現控制設計與執行的實際效果，提升透明度與客戶信任 |
| **ISO 27001** | 架構管理 | 以制度化框架建構資安管理體系，強調持續改善與組織層級的落實 |
| **互補效果** | 全球市場拓展 | SOC 2 強調「透明信任」，ISO 27001 提供「架構管理」，結合運用有助企業拓展全球市場 |

### 分階段執行
| Phase | 行動 |
|-------|------|
| Phase 1 (v0-v1) | 按 SOC 2 Type I + ISO 27001 Annex A 控制項設計系統（不做正式審計）；完成一次 penetration test |
| Phase 2（有付費客戶）| 取得 SOC 2 Type I 報告（控制設計審計）；啟動 ISO 27001 ISMS 建置 |
| Phase 3（規模化）| 升級 SOC 2 Type II（控制執行審計，觀察期 6-12 個月）；取得 ISO 27001 正式認證 |

### 免費 vs 付費用戶策略
- **免費試用期：7 天**，開放全部功能
- **7 天後未付費**：帳號凍結，資料保留 30 天（之後清除）
- **未付費用戶不做正式審計覆蓋**
- **後續討論**：是否開放基礎功能給免費用戶（Freemium 模式），目標是篩選出真正需要服務的機構大客戶
- **設計原則**：不花資源服務「試玩」用戶；所有合規認證成本由付費訂閱覆蓋

---

## ADR-05: 目標司法管轄區 — Singapore 優先

**決策：** Singapore (MAS) 為首要市場，EU (MiCA) 次之，US 暫不進入。

**理由：**
- 新加坡是亞洲 RWA tokenization 最活躍的市場，MAS 對 tokenized private credit 態度友好
- PDPA 對資料跨境傳輸相對寬鬆（有加密即可論證），降低 Walrus 去中心化儲存的法律風險
- EU/MiCA 法規框架最完整但合規成本最高，Phase 2 再進入
- US SEC 監管不確定性最高，暫不碰

---

## ADR-06: Key Recovery — 2-of-3 Multi-Party Recovery

**決策：** 採用 2-of-3 多方恢復機制。

**設計：**
```
Pool Owner 建立時 → 生成 recovery shares
  ├── Share 1: Owner 自己（錢包）
  ├── Share 2: Org Admin（組織管理員）
  └── Share 3: Platform escrow（平台託管，僅在 recovery 時啟用）

Recovery 需任意 2-of-3 shares
```

**實作：**
- Sui 原生 multi-sig address 作為 Pool Owner
- Org Admin 作為機構級備援，符合 B2B 場景
- Platform escrow share 需明確法律條款，僅在 recovery 流程中啟用
- Recovery 流程需身份驗證 + 冷卻期（防止社工攻擊）

---

## ADR-07: 加密策略 — Dual-Engine + Graduated Rollout

**決策：** AES-256-GCM 為正式生產引擎；Seal 作為 Beta 引擎並行運營，漸進式推廣至預設。

**核心原則：** UX 流暢度與資安為最高優先。兩種引擎對用戶而言體驗完全一致，差異僅在後端加密實作。

---

### 架構：Encryption Abstraction Layer

```
┌────────────────────────────────────────────────────┐
│                 Client SDK                          │
│                                                    │
│   EncryptionEngine (interface)                     │
│     ├── AESEngine   (production, 預設)              │
│     └── SealEngine  (beta, 可選)                    │
│                                                    │
│   上傳：engine.encrypt(file) → encrypted blob       │
│   下載：engine.decrypt(blob) → plaintext            │
│                                                    │
│   Document metadata: encryption_scheme: "aes"|"seal"│
│   SDK 自動根據 metadata 選擇正確引擎解密             │
└────────────────────────────────────────────────────┘
```

用戶無感。無論 AES 或 Seal，操作流程完全相同：上傳 → 加密 → Walrus → 下載 → 解密。

---

### AES Engine（正式服務）

```
加密：AES-256-GCM，per-folder symmetric key
金鑰分發：key 以每位 member 的公鑰加密後存在 Sui dynamic field
         只有 DataRoom.members 中的地址可透過 Move 合約取得
解密：客戶端取得加密後的 key → 本地解密 key
     → 從 Walrus 下載 encrypted blob → 本地解密檔案
```

- **定價：正式價格**
- **SLA：完整 production SLA**
- **合規：SOC 2 / ISO 27001 完整覆蓋**

### Seal Engine（Beta 服務）

```
加密：Seal threshold encryption，policy 定義在 Move 合約中
金鑰分發：Seal key servers 驗證鏈上 policy 後發放金鑰碎片
解密：客戶端向 Seal key servers 請求 → 驗證通過 → 本地重建金鑰 → 解密
```

- **定價：正式價格的 90%（Beta 折扣 10%）**
- **SLA：Best-effort，明確標示 Beta**
- **合規：不納入正式審計範圍，另行提供 Beta 安全報告**

---

### Graduated Rollout 時間表

#### Phase 1：Dual Launch（v0 上線時）
- 新建 Pool 預設 = AES Engine（正式服務）
- 建立 Pool 時可選「啟用 Seal Beta Engine」
- Seal 選項帶有明確的 Beta 標示：
  - UI 標籤：`🧪 Beta — Seal Encryption`
  - 建立時彈窗說明：
    - 「Seal 採用新一代 threshold encryption 技術」
    - 「目前為 Beta 階段，享有 10% 價格折扣」
    - 「資料安全性與 AES 引擎等同，但服務穩定性仍在驗證中」
    - 「您可隨時為新建的 Pool 切換回 AES 引擎」
  - 勾選確認：「我理解此為 Beta 功能」
- **已存在的 Pool 不可中途切換引擎**（避免 re-encryption 風險）

#### Phase 2：Invited Beta（上線後 3-6 個月）
- 根據 Seal Engine 的穩定性與效能數據，發出小批量邀請
- 邀請對象：對新技術友好的中型客戶（非核心大客戶）
- **平台補貼方案：**
  - 受邀客戶的 Seal Engine Pool = 免費使用 3 個月（平台代付全部費用）
  - 3 個月後回到 Beta 定價（90% 正價）
  - 目的：收集真實使用數據、壓力測試、收集 feedback
- 持續監控指標：
  - Seal key server 可用率
  - 加密/解密延遲 (p50, p95, p99)
  - 失敗率
  - 客戶 feedback 與 support ticket

#### Phase 3：Seal 升級為正式服務（穩定性達標後）
**升級條件（全部滿足才執行）：**
- Seal key server 可用率 ≥ 99.9% 連續 90 天
- 加密/解密 p99 延遲 ≤ AES 的 2 倍
- 失敗率 < 0.1%
- 至少 10 個 Beta Pool 無重大事故運行 6 個月
- 通過獨立安全審計

**升級動作：**
- Seal Engine 移除 Beta 標籤
- 新建 Pool 預設切換為 Seal Engine
- AES Engine 保留為「Classic」選項（永不移除）
- **遷移獎勵**：
  - 現有 AES Pool 客戶若建立新 Pool 選用 Seal = 新 Pool 首年 15% 折扣
  - **不主動遷移任何既有 Pool**，舊 Pool 永遠使用建立時的引擎
  - 客戶自願遷移（建新 Pool + 搬文件）= 提供遷移工具 + 15% 折扣

---

### 關鍵限制（保護 UX 與資安）

1. **已建立的 Pool 永遠不切換加密引擎**
   - 建立時選什麼就用什麼，直到 Pool 生命週期結束
   - 這避免了所有 re-encryption 風險
   - 客戶要「遷移」= 建立新 Pool（Seal Engine）+ 使用遷移工具搬文件

2. **兩個引擎的 UX 完全一致**
   - 相同的上傳/下載流程
   - 相同的權限管理 UI
   - 相同的 audit trail
   - 唯一差異：Pool 設定頁顯示使用的引擎名稱

3. **Seal Engine 故障時的 fallback**
   - 若 Seal key server 暫時不可用，顯示友善錯誤：「加密服務暫時忙碌，請稍後重試」
   - **不自動 fallback 到 AES**（混用會破壞安全模型）
   - 記錄事件到 monitoring + 通知平台 on-call

4. **Beta 客戶的資料保護**
   - Seal Beta Pool 的檔案同時維護 AES 加密備份（off-chain S3）
   - 若 Seal 出現不可恢復的問題，可用備份恢復
   - 備份策略對客戶透明揭露

---

### 定價結構摘要

| 引擎 | 階段 | 定價 |
|------|------|------|
| AES (Production) | 永久 | 正式價格 100% |
| Seal (Beta) | Phase 1-2 | 正式價格 90%（Beta 折扣 10%） |
| Seal (Invited Beta) | Phase 2 | 免費 3 個月（平台代付），之後 90% |
| Seal (Production) | Phase 3 後 | 正式價格 100% |
| Seal 遷移獎勵 | Phase 3 後 | 新 Pool 首年 85%（遷移折扣 15%） |
| AES (Classic) | Phase 3 後 | 維持正式價格 100%（永不移除） |
