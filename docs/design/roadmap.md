# RWA Credit Data Room — 產品路線圖 (Roadmap)

## 總覽時程圖

```
Month  0    1    2    3    4    5    6    7    8    9   10   11   12        18        24
  │────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼────┼─────···───┼─────···───┤
  │◄── Phase 1: 底層建設與盡調資料室 ──►│                                              │
  │  MVP (0-2m) │ 協作 (3-4m) │ PoC (5-6m) │                                          │
  │             │             │            │◄── Phase 2: 投資人與合規發行 ──►│           │
  │             │             │            │         (6-12 個月)              │           │
  │             │             │            │                                 │◄─ Phase 3 ►│
  │             │             │            │                                 │ (12-24 個月)│
  │             │             │            │                                 │            │
  │  AES-256-GCM Production ──────────────────────────── "Classic" 永久選項 ───────────►│
  │             │  Seal Beta 開發 ──►│  Seal Beta │ Seal Invited Beta ──►│ Seal 正式 GA │
  │             │             │            │                                 │            │
  │ SOC 2 控制設計 ──────────►│ Pen Test   │ SOC 2 Type I  │ ISO ISMS Build │SOC2-II+ISO │
  │             │             │            │                                 │ 27001 認證  │
  │             │             │            │                                 │            │
  │ 🇸🇬 Singapore (MAS) ─────────────────►│ + 🇪🇺 EU (MiCA) ──────────────────────────►│
```

> **目標市場**：Phase 1-2 聚焦新加坡 (MAS) 私募信貸 / RWA 平台；Phase 2 起擴展至歐盟 (MiCA)。美國市場不在可預見的規劃範圍內。

---

## 雙引擎加密策略 (Dual-Engine Encryption)

| 引擎 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| **AES-256-GCM** | Production（client-side 加密） | Production | 永久保留為 "Classic" 選項 |
| **Seal** | Beta（並行開發） | Invited Beta（平台補貼 3 個月試用） | 正式 GA（條件：99.9% uptime + 安全審計通過） |

---

## 合規認證時程 (Compliance Certification)

| 階段 | 內容 |
|------|------|
| **Phase 1** | 依 SOC 2 Type I + ISO 27001 Annex A 控制項設計系統；PoC 前完成 penetration test |
| **Phase 2** | 取得 SOC 2 Type I 報告；啟動 ISO 27001 ISMS 建置 |
| **Phase 3** | 升級 SOC 2 Type II（6-12 個月觀察期）；取得 ISO 27001 認證 |

---

## 商業模式 (Business Model)

- **免費試用**：7 天全功能試用，之後僅提供付費方案
- **訂閱計價**：per Pool + 儲存容量
- **Seal Beta 優惠**：選用 Seal 引擎享 10% 折扣
- **Walrus 費用**：包含在訂閱費中（平台代付）
- **逾期政策**：1.3x 罰金，14 天寬限期

---

## 階段一：底層建設與盡調資料室 (Phase 1: 0-6 個月)

### 0-2 個月 — MVP

**Sui Move 智慧合約**
- `Pool`、`DataRoom`、`Document` 物件定義（使用 dynamic fields / `Table`）
- 狀態機：`Draft` → `Ready_To_Issue`
- Events 定義與發射

**加密與儲存**
- AES-256-GCM 加密引擎（client-side encryption）
- Walrus 整合：upload / download / blob management

**前端 Web App**
- Dashboard 儀表板
- Pool 建立流程
- Data Room 檔案庫介面
- 文件加密上傳 / 解密下載

**後端服務**
- API Gateway
- PostgreSQL indexer
- 身份驗證：wallet signature + JWT

**DD Checklist 系統**
- 標準模板（templates）
- 自訂 checklist
- Gate conditions（條件門檻）

### 3-4 個月 — 協作功能

- **版本控管**：文件版本疊代（v1, v2…），不可竄改歷史
- **Review 系統**：per-reviewer tracking，`Needs Revision` / `Reviewed` 狀態
- **IC Decision 模組**：投審會決策上鏈（Approve / Reject），支援 PDF 決策書上傳
- **Comment / Notification 系統**
- **Seal Beta 引擎**：與 AES-256-GCM 並行開發
- **角色權限**：bitmask model 的 role-based permissions

### 5-6 個月 — PoC 驗證

- 與 1-2 家私募信貸團隊進行 Pilot 測試
- **Penetration test** 完成
- 內建標準模板：SME Loan DD、Real Estate DD
- Monitoring & alerting 系統建置
- 首份 **SOC 2 控制項文件** 產出

---

## 階段二：投資人端與合規發行 (Phase 2: 6-12 個月)

- **Investor Onboarding**：建立 `InvestorProfile`，對接 KYC / AML Oracle，將驗證憑證與錢包地址綁定
- **Seal Invited Beta**：平台補貼 3 個月試用，驗證 Seal 在 production 環境的穩定性
- **Subscription Agreement 簽署**：on-chain message sign + off-chain e-sign 雙軌
- **Tokenization Engine 對接**：`Ready_To_Issue` 且投資人全數簽署 → 觸發 RWA Token Minting
- 取得 **SOC 2 Type I** 報告
- 啟動 **ISO 27001 ISMS** 建置
- **EU 市場準備**（MiCA 合規研究與調整）

---

## 階段三：存續期管理與生態樞紐 (Phase 3: 12-24 個月)

- **Lifecycle 狀態機**：`Performing` → `Watchlist` → `Default` → `Workout` → `Resolved`
- **Servicing Events & Reports**：定期上傳貸後管理報告、月 / 季財報；利息支付、本金攤還、違約事件上鏈
- **Seal 正式 GA**：達成指標（99.9% uptime、安全審計通過）後升級為 production 引擎
- **SOC 2 Type II** 取得（6-12 個月觀察期）+ **ISO 27001** 認證
- **Open API / SDK**：開放系統級介面，允許 DeFi 借貸協議、次級市場平台查詢底層資產狀態（營運狀況、違約狀態），進而自動調整 LTV 或清算閾值
- **進階 Seal Policies**：KYC credential + jurisdiction-based 的動態存取控制
