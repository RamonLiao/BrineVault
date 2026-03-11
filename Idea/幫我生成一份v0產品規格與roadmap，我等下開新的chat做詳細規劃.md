<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 幫我生成一份v0產品規格與roadmap，我等下開新的chat做詳細規劃

下面這份可以當作你接下來新 chat 的起點：先有一個「方向正確、但不過度細節」的 v0 產品規格與 roadmap。

***

## 產品定位（v0）

- **產品名稱（暫定）**：RWA Credit Data Room
- **定位**：專門服務「私募信貸型 RWA／on-chain private credit」的 **合規型資料室＋合約生命週期管理平台**，串起借款人盡調、投資人簽署、整個存續期文件與事件。[^1][^2][^3]
- **第一階段主要客戶**：
    - RWA／tokenized private credit 平台
    - 私募信貸基金／資產管理人（originator / lender）
    - 做 SPV 結構、信託的法律／結構設計顧問

***

## v0 核心流程（只做 Phase 1，但預留 Phase 2/3）

以「一個 SME loan pool / private credit facility 上線前」為主線。

### 角色

- Originator：發起貸款／資產池的機構
- Internal Risk / Investment Committee：內部風控與投審單位
- Legal / Structuring：律師、結構設計顧問
- RWA 平台營運／合規人員


### 高階流程

1. Originator 建立「新資產池」專案（Pool A）
2. 建立對應的 **RWA 資料室物件**（SUI object），自動產生 Walrus 儲存空間與基本 Seal policy。
3. Originator 上傳盡調文件：
    - 借款人公司文件（登記、財報、股權結構）
    - loan / facility 合約草案
    - 抵押品文件、保險、擔保協議
    - 初版風控報告
4. 指定可以存取資料室的內部／外部成員（legal、risk、顧問）。
5. Legal / Risk 在平台上審閱、留言、要求補件，文件版本與審核歷程被記錄。
6. 資產池狀態依流程推進（草案 → 盡調中 → 內部核准 → 準備對外發行），每次狀態變更都有 on-chain event，可供未來發行合約引用。[^2][^1]

***

## v0 功能規格（重點）

### 1. RWA 資料室（Data Room）

- 為每個「資產池／facility」建立一個獨立 data room：
    - 對應一個 SUI 物件 ID。
    - 含 meta：名稱、借款人、幣種、規模、預計到期日、建立者、建立時間。
- 文件管理：
    - 上傳/下載（前端 Web2 體驗）。
    - 版本控制（v1, v2…），保留 hash 與 timestamp。
    - 依類型/資料夾分類（Legal, Financials, Collateral, Reports, Misc）。
- 儲存：
    - 實體檔案加密存 Walrus。
    - SUI 物件中存檔案 metadata（hash、類型、路徑、版本、上傳者、時間）。


### 2. 權限控制（Access / Policy）

- 基本角色：Owner, Editor, Viewer。
- 以地址為主的存取控制：
    - Owner 可以邀請地址加入資料室，設定角色。
    - 所有讀取/寫入操作都透過 Seal policy 檢查。
- v0 先實作簡化 policy：
    - 白名單地址可讀／可寫。
    - 日後可擴充成「需要 KYC credential」、「需要特定角色」。


### 3. 合約生命週期（前期盡調版）

- 狀態機（儲存在資產池 SUI 物件上）：
    - Draft → DD_In_Progress → IC_Review → Approved_Internal → Ready_To_Issue
- 狀態切換：
    - 由有權限的地址觸發（例如：Originator、IC、Legal）。
    - 每次切換紀錄：操作者、時間、附註（可選）。
- 事件：
    - 每次重大狀態變更 emit event，供將來發行／token 合約參考（例如：只有在 Ready_To_Issue 才能鑄造資產池 token）。[^1][^2]


### 4. 審核與協作

- 文件層級的審核歷程：
    - 可對單一文件標記「Reviewed / Needs Revision」。
    - 留言／備註（存在鏈下 DB 或 Walrus，鏈上存參考 ID）。
- 資產池級別的決策紀錄：
    - IC / Risk 決議結果（Approve / Reject / Request Changes）。
    - 上傳決議書 PDF，與狀態變化綁定。


### 5. 基礎審計軌跡

- 對關鍵操作記錄：
    - 新增／刪除／修改文件
    - 權限變更（新增/移除成員）
    - 狀態變更
- 在鏈上存摘要（hash + timestamp + actor address），詳細 log 可存 Walrus 或資料庫。

***

## 技術邊界（v0）

- 不做：
    - 真正的 token 發行／分配合約（只預留介面）。
    - 投資人 KYC / onboarding（留給 Phase 2）。
    - 真實金流／償還自動化（留給 Phase 3）。
- 要做：
    - 穩定的資料室功能和基礎合約生命週期 state machine。
    - 清楚的 API / 介面，讓未來「發行合約、KYC 系統」可以接進來。

***

## Roadmap（高階版本）

### Phase 1（v0–v1）：盡調資料室與狀態機（0–6 個月）

- 0–2 個月：
    - 定義 SUI 物件模型（DataRoom, Document, PoolState）。
    - 打通 Walrus 儲存（上傳/下載/加密）與 Seal 基礎 access control。
    - 做出內部可用 demo：建立資料室、上傳文件、設定成員、切換狀態。
- 3–4 個月：
    - 補齊版本控制、審核標記、狀態事件。
    - 做 1–2 條「典型 loan pool」流程樣板（用假資料）。
- 5–6 個月：
    - 找 1–2 家私募信貸/RWA 團隊做 pilot（PoC），根據真實需求調整欄位與流程。


### Phase 2：投資人 KYC / 簽署 / 資格控管（6–12 個月）

- 新增：Investor Profile、KYC 資料室、投資協議簽署流程。
- 用 Seal 實作「只有完成 KYC＋簽署，才可被白名單化」的 policy。
- 與簡易的發行合約對接：Ready_To_Issue 的 pool 才允許鑄 token \& 分配給合格地址。[^4][^5][^1]


### Phase 3：存續期管理與報告（12–24 個月）

- 為每個資產池新增存續期狀態機（Performing / Watchlist / Default / Workout / Resolved）。
- 報告與事件（利息支付、違約、重組）全部寫入你的資料室＋合約事件。
- 與現有 on-chain lending / RWA 協議整合，變成它們的「文件 \& 合規中樞」。[^6][^2]

***

你開新 chat 的時候，可以把這份當作骨架，接著我們就可以：

- 把「SUI 物件結構」拆到欄位等級，
- 把「每一個畫面（建立資料室、上傳文件、審核、切換狀態）」畫成 user flow，
- 再討論 Phase 2/3 的延伸設計。
<span style="display:none">[^10][^11][^12][^13][^14][^15][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://investax.io/blog/the-institutional-guide-to-tokenizing-private-credit

[^2]: https://chain.link/article/tokenized-private-credit

[^3]: https://www.galaxy.com/insights/perspectives/the-new-age-in-onchain-credit-markets

[^4]: https://www.antiersolutions.com/blogs/building-white-label-rwa-tokenization-platforms-an-end-to-end-system-architecture-guide/

[^5]: https://www.zealynx.io/blogs/real-world-assets-architecture

[^6]: https://www.anchorage.com/insights/what-it-takes-run-capital-markets-onchain

[^7]: https://www.spglobal.com/content/dam/spglobal/global-assets/en/special-reports/Corp_1022_TokenizedPrivateCredit.pdf

[^8]: https://www.sec.gov/files/ctf-written-sec-companion-rwa-tokenization-02-25-2026.pdf

[^9]: https://reports.weforum.org/docs/WEF_Asset_Tokenization_in_Financial_Markets_2025.pdf

[^10]: https://www.fintechweekly.com/magazine/articles/private-equity-vs-tokenized-assets-liquidity-modern-finance

[^11]: https://corporate.visa.com/content/dam/VCOM/corporate/solutions/documents/stablecoins-beyond-payments-onchain-lending-opportunity.pdf

[^12]: https://www.blockchainappfactory.com/blog/rwa-tokenization-architecture-handbook-2026/

[^13]: https://www.jpmorgan.com/kinexys/documents/how_tokenization_can_fuel_a_400_billion_opportunity_in_distributing_alternative_investments_to_individuals.pdf

[^14]: https://onchain.org/magazine/what-is-private-credit-tokenization-and-how-does-it-work/

[^15]: https://keyrock.com/knowledge-hub/credit-strategies-in-onchain-asset-management-a-guide/

