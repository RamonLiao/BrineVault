<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 好，把每個物件轉成更具體的欄位表（包含未來 Phase 2/3 預留的欄位），以及將上面 workflows 轉成更精細的狀態圖與序列圖。

下面我會先把主要物件拆成欄位表（含 Phase 2/3 預留欄位），再用文字版「狀態圖」與「序列圖」描述核心流程，讓架構師可以直接轉成 Sui 物件與 UML。Sui 本身非常適合這種以物件為中心、狀態驅動的 DeFi/RWA 應用，這也是官方鼓勵的方向。[^1]

***

## 物件模型與欄位設計總覽

建議先分三層：

- On-chain（Sui）：Pool、DataRoom、Document、Membership、AuditTrail、OnChainEvent 等。
- Off-chain（DB）：User/Org、全文搜尋索引、UI 快取。
- Off-chain（Walrus）：文件原文、詳細 log、KYC 文件等。

下面欄位都可以視情況決定要放在哪一層（我會標註「建議層級」）。

***

## Org / Workspace 物件（多租戶）

**類型**：Off-chain DB 主為主，可選擇在鏈上存 hash 做錨定。
**用途**：代表一個 Originator / Asset Manager / RWA 平台的組織空間。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| org_id | String/UUID | 組織唯一 ID（DB key） | v0 |
| name | String | 組織名稱 | v0 |
| legal_name | String | 法定名稱 | v0 |
| created_at | Timestamp | 建立時間 | v0 |
| created_by_user_id | String | 建立者 user_id | v0 |
| billing_plan | Enum | 計價方案（Free/Pro/Enterprise） | v0 |
| default_policies | JSON | 預設 Pool policy 模板（例如預設角色權限） | v0 |
| kyc_provider_config | JSON | KYC/AML 供應商設定（API key, webhook URL） | v2 |
| jurisdiction | String | 組織主要司法管轄區（用於合規條件） | v2 |
| metadata | JSON | 其他補充資訊（logo、聯絡方式） | v0 |


***

## User 物件（平台使用者）

**類型**：Off-chain DB + 鏈上地址關聯。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| user_id | String/UUID | 平台內 user key | v0 |
| primary_wallet | Address | 主錢包地址 | v0 |
| email | String | 聯絡信箱（非必填） | v0 |
| display_name | String | 顯示名稱 | v0 |
| org_id | String | 所屬組織 ID | v0 |
| role_in_org | Enum | Org 層級角色（OrgAdmin / Member） | v0 |
| kyc_status | Enum | 未開始 / 進行中 / 通過 / 失敗 | v2 |
| kyc_reference_id | String | 連到 KYC 系統的 external id | v2 |
| created_at | Timestamp | 帳號建立時間 | v0 |
| last_login_at | Timestamp | 最後登入時間 | v0 |


***

## Pool 物件（Sui：RWA 資產池）

**類型**：On-chain Sui object，系統核心。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| id | ObjectID | Sui 物件 ID | v0 |
| org_id_hash | Bytes32 | Org ID 的 hash（不暴露實際 org_id） | v0 |
| name | String | Pool 名稱（SME Loan Pool A） | v0 |
| borrower_name_hash | Bytes32 | 借款人名稱 hash（實名放 Walrus/DB） | v0 |
| currency | String | 幣別（USD, USDC, EUR 等） | v0 |
| target_notional | u64 | 目標貸款規模（單位依照 currency） | v0 |
| expected_maturity_date | u64 (timestamp) | 預計到期日 | v0 |
| created_at | u64 (timestamp) | Pool 建立區塊時間 | v0 |
| created_by | Address | Pool Owner 地址 | v0 |
| current_state | Enum PoolState | Draft / DD_In_Progress / IC_Review / Approved_Internal / Ready_To_Issue / Issued / Closed 等 | v0→v2 |
| lifecycle_state | Enum LifecycleState | Performing / Watchlist / Default / Workout / Resolved | v3 |
| dataroom_id | ObjectID | 關聯的 DataRoom 物件 ID | v0 |
| token_contract_addr | Address | 對應 RWA token 合約地址（v0 可為 None） | v2 |
| kyc_policy_id | ObjectID/Bytes32 | 關聯 KYC / investor eligibility policy 的 ID | v2 |
| servicing_policy_id | ObjectID/Bytes32 | 存續期事件/報告 policy ID | v3 |
| tags | vector<String> | 自訂標籤（例如：ESG, RealEstate, SME 等） | v0 |
| last_updated_at | u64 (timestamp) | 最後更新時間（狀態或 meta 變化） | v0 |


***

## DataRoom 物件（Sui：資料室設定）

**類型**：On-chain Sui object，對應每個 Pool 一個。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| id | ObjectID | Sui 物件 ID | v0 |
| pool_id | ObjectID | 關聯的 Pool ID | v0 |
| owner | Address | Data Room Owner（通常與 Pool Owner 相同） | v0 |
| members | vector<Membership> | 成員與角色列表（可嵌入或分離） | v0 |
| default_folders | vector<String> | 預設資料夾名稱（Legal, Financials, Collateral, Reports） | v0 |
| custom_folders | vector<FolderMeta> | 使用者自訂資料夾 | v0 |
| seal_policy_ref | Bytes32/ObjectID | 與 Seal policy 的映射 ID | v0 |
| kyc_required | Bool | 進入資料室是否需 KYC 憑證 | v2 |
| investor_only_sections | vector<String> | 僅投資人可見的區域 ID（例如 Investor Reports） | v2 |
| created_at | u64 (timestamp) | 建立時間 | v0 |
| last_updated_at | u64 (timestamp) | 最後更新 | v0 |

`FolderMeta` 建議欄位：


| 欄位名 | 類型 | 說明 |
| :-- | :-- | :-- |
| name | String | 資料夾名稱 |
| folder_id | String | 客戶端/DB 專用 ID |
| parent_id | String | 如果要支援子資料夾 |
| created_at | Timestamp | 建立時間 |


***

## Membership 物件（Sui or Off-chain）

可以設計成 Sui 上嵌入在 DataRoom，也可以獨立成 object 方便查詢。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| member_address | Address | 成員錢包地址 | v0 |
| role | Enum | Owner / Editor / Reviewer / Viewer / Auditor | v0 |
| added_by | Address | 邀請人地址 | v0 |
| added_at | u64 | 加入時間 | v0 |
| revoked | Bool | 是否已被移除 | v0 |
| revoked_at | u64 | 移除時間（如果有） | v0 |
| kyc_level | Enum | 無 / Basic / Enhanced | v2 |
| jurisdiction | String | 成員所在國別（用於 Policy） | v2 |
| tags | vector<String> | 額外標記（IC, Legal 顧問等） | v0 |


***

## Document 物件（Sui：文件 metadata）

**類型**：Sui object 或 DataRoom 內部 vector。建議單獨 object，方便授權與事件。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| id | ObjectID | Sui 文檔物件 ID | v0 |
| dataroom_id | ObjectID | 所屬 DataRoom | v0 |
| folder_id | String | 所屬資料夾（對應 FolderMeta.folder_id） | v0 |
| doc_type | Enum | Legal / Financial / Collateral / Report / Misc / KYC | v0→v2 |
| title | String | 文件名稱（顯示用） | v0 |
| current_version | u32 | 目前最新版本號 | v0 |
| versions | vector<DocVersion> | 所有版本 metadata | v0 |
| required_flag | Bool | 是否為盡調 checklist 必要文件 | v0 |
| review_state | Enum ReviewState | 未審核 / Reviewed / NeedsRevision | v0 |
| last_reviewed_by | Address | 最後標記審核狀態的地址 | v0 |
| last_reviewed_at | u64 | 最後審核時間 | v0 |
| visible_to_roles | vector<Enum> | 可見角色（例如只給 Reviewer 以上） | v0 |
| investor_only | Bool | 僅合格投資人可見（Phase 2, 投資者專區） | v2 |
| tags | vector<String> | 關鍵標籤（例如「財報 2024 Q1」） | v0 |

`DocVersion`：


| 欄位名 | 類型 | 說明 |
| :-- | :-- | :-- |
| version | u32 | 版本號（從 1 開始） |
| walrus_cid | String | Walrus content ID / 路徑 |
| content_hash | Bytes32 | 檔案 hash（完整性驗證） |
| size_bytes | u64 | 檔案大小 |
| uploaded_by | Address | 上傳者地址 |
| uploaded_at | u64 | 上傳時間 |
| change_log | String | 上傳時的備註（v0 可選） |


***

## ICDecision / Resolution 物件

**類型**：可為 Sui object，或 meta 部分上鏈、PDF 放 Walrus。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| id | ObjectID | 決議物件 ID | v0 |
| pool_id | ObjectID | 關聯 Pool | v0 |
| decision_type | Enum | Approve / Reject / RequestChanges | v0 |
| decision_text | String | 簡短描述 | v0 |
| decision_pdf_cid | String | 決議書 PDF 的 Walrus CID | v0 |
| created_by | Address | 做決定的主要負責人地址 | v0 |
| committee_members | vector<Address> | 參與決議的 committee 成員地址 | v0 |
| created_at | u64 | 決議時間 | v0 |
| related_docs | vector<ObjectID> | 此決議主要參考的文件 ID 列表 | v0 |


***

## AuditTrailEntry 物件（Sui：審計摘要）

**類型**：Sui object 或 event log 聚合。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| id | ObjectID | 審計物件 ID | v0 |
| pool_id | ObjectID | 所屬 Pool | v0 |
| actor | Address | 執行操作的人 | v0 |
| action_type | Enum | CreatePool / UploadDoc / UpdateRole / ChangeState / ICDecision 等 | v0 |
| target_id | ObjectID | 目標物件 ID（可為 Document / DataRoom / Pool） | v0 |
| timestamp | u64 | 操作時間 | v0 |
| metadata_hash | Bytes32 | 詳細 log hash（全文放 Walrus / DB） | v0 |
| walrus_cid | String | 詳細 log 存放位置（可選） | v0 |


***

## InvestorProfile 物件（Phase 2）

**類型**：Off-chain DB + hash 上鏈。


| 欄位名 | 類型 | 說明 | Phase |
| :-- | :-- | :-- | :-- |
| investor_id | String/UUID | 平台內投資人 ID | v2 |
| user_id | String | 關聯 User（若為自然人） | v2 |
| org_id | String | 若為機構投資人，關聯 Org | v2 |
| wallet_address | Address | 投資用錢包地址 | v2 |
| kyc_status | Enum | 未開始 / 進行中 / 通過 / 失敗 | v2 |
| accreditation | Enum | Accredited / Professional / Retail 等 | v2 |
| jurisdiction | String | 投資人居住國／註冊國 | v2 |
| risk_profile | JSON | 風險等級、自我聲明等 | v2 |
| kyc_doc_cid | String | KYC 文件 Walrus CID | v2 |
| profile_hash | Bytes32 | Profile 摘要 hash，上鏈用 | v2 |
| created_at | Timestamp | 建立時間 | v2 |


***

## Subscription / InvestorPosition 物件（Phase 2/3）

對應「某投資人在某 Pool 的持倉」，可鏈上表示或由發行合約持有。

| 欄位名          | 類型        | 說明                                            | Phase |
|-----------------|-------------|-------------------------------------------------|
| id              | ObjectID    | Sui Position 物件 ID                           | v2    |
| pool_id         | ObjectID    | 關聯 Pool                                      | v2    |
| investor_id_hash| Bytes32     | InvestorProfile 的 hash 或 anonymized ID       | v2    |
| wallet_address  | Address     | 該持倉對應地址                                 | v2    |
| token_amount    | u64         | 當前持有 token 數量                            | v2    |
| subscribed_at   | u64         | 初次申購時間                                   | v2    |
| last_updated_at | u64         | 最近變動時間                                   | v2    |
| status          | Enum        | Active / Redeemed / Transferred                | v2    |

***

## ServicingEvent / Report 物件（Phase 3）

用於存續期：利息支付、違約、重組、報告等事件。

| 欄位名        | 類型        | 說明                                          | Phase |
|---------------|-------------|-----------------------------------------------|
| id            | ObjectID    | 事件 ID                                      | v3    |
| pool_id       | ObjectID    | 所屬 Pool                                   | v3    |
| event_type    | Enum        | InterestPayment / PrincipalRepayment / Default / WorkoutUpdate / FinalResolution / PeriodicReport | v3 |
| amount        | u64         | 相關金額（如利息或本金）                     | v3    |
| currency      | String      | 幣別                                        | v3    |
| event_date    | u64         | 事件日期                                    | v3    |
| report_cid    | String      | 詳細報告 Walrus CID（如月報、違約報告）      | v3    |
| created_at    | u64         | 記錄時間                                    | v3    |
| created_by    | Address     | 建立者地址                                  | v3    |

***

## 狀態圖（State Machine）設計

### 1. PoolState（v0→v3）

**狀態集合**

- v0：Draft → DD_In_Progress → IC_Review → Approved_Internal → Ready_To_Issue
- v2 延伸：Ready_To_Issue → Issued → Closed
- v3 加上存續期 LifecycleState（分開的 state machine，但會互相參考）

**轉移與條件（角色 + 條件）**

1. Draft → DD_In_Progress
    - 觸發者：Pool Owner / Org Admin
    - 條件：至少 X 個「必要文件」已上傳（可由後端檢查）、無 blocking issue。
2. DD_In_Progress → IC_Review
    - 觸發者：Pool Owner / 指定 Risk Lead
    - 條件：所有「必要文件」的 review_state 已為 Reviewed，或顯式 override（需備註）。
3. IC_Review → Approved_Internal
    - 觸發者：ICDecision 物件建立且 decision_type=Approve。
    - 條件：ICDecision 建立者角色屬於 Reviewer 並標記為「IC 成員」。
4. IC_Review → Draft / DD_In_Progress
    - 觸發者：ICDecision=Reject / RequestChanges。
    - 條件：同上。Reject 可直接退回 Draft，RequestChanges 可退到 DD_In_Progress。
5. Approved_Internal → Ready_To_Issue
    - 觸發者：Org Admin / Compliance Officer（Pool Owner 可請求，但需要合規確認）。
    - 條件：合約草案定稿文件存在並被標記 Reviewed、法律與合規 checklist 完成。
6. Ready_To_Issue → Issued（Phase 2）
    - 觸發者：發行合約成功鑄造 RWA token 並寫入 Pool ID。
    - 條件：由發行合約檢查 `current_state == Ready_To_Issue`，發行成功後回寫 state=Issued。
7. Issued → Closed（Phase 3）
    - 觸發者：ServicingEvent 顯示所有本金已償還，且最後 Resolution 事件完成。
    - 條件：合約與 off-chain 報告一致，合規/平台方確認。

### 2. LifecycleState（存續期）

- 狀態：Performing → Watchlist → Default → Workout → Resolved
- 簡化轉移：
    - Issued 後自動進入 Performing。
    - 如果逾期一定天數或 KPI 變差，由 Risk / Servicer 將狀態改成 Watchlist。
    - 真正發生付款違約，設為 Default。
    - 進入重組協議後，轉為 Workout。
    - 最後結案（全數回收／損失確認）後，設為 Resolved。

***

## Document Review 狀態機

**ReviewState**：NotReviewed → NeedsRevision → Reviewed

- 初始：NotReviewed。
- Reviewer 審閱後：
    - 若沒問題：NotReviewed / NeedsRevision → Reviewed。
    - 若有問題：NotReviewed / Reviewed → NeedsRevision（代表新一輪迭代）。
- 當有新版本上傳：
    - 最新版本 review_state 回到 NotReviewed。
    - 舊版本的 review_state 保留歷史狀態（通常維持 Reviewed 或 NeedsRevision）。

***

## Investor Onboarding 狀態機（Phase 2）

**InvestorOnboardingState**：Created → KYC_In_Progress → KYC_Approved → Agreement_Signed → Whitelisted

- Created：InvestorProfile 建立，尚未開始 KYC。
- Created → KYC_In_Progress：投資人提交 KYC 表單，系統呼叫外部 KYC provider。
- KYC_In_Progress → KYC_Approved / KYC_Rejected：KYC provider callback。
- KYC_Approved → Agreement_Signed：投資人透過平台簽署訂閱協議（電子簽章或鏈上簽名）。
- Agreement_Signed → Whitelisted：
    - Seal policy 更新：將該投資人錢包地址 + KYC credential 納入「可持有/認購此 Pool token」白名單。
    - 對應 Pool 的 KYC policy 狀態中標記該 investor 為 qualified。

***

## 序列圖（Sequence）描述

以下用「步驟編號 + Actor：動作」形式，方便直接轉 UML。

### A. 建立新 Pool 與 Data Room（v0）

1. Originator：在前端按「Create Pool」，填寫 meta。
2. Frontend：呼叫 Backend API `/pools/create`，帶上 meta + 目前登入地址。
3. Backend：

4. 檢查使用者 Org 權限。
5. 透過 Sui SDK 發送交易：
        - 建立 `Pool` object（狀態=Draft）。
        - 建立 `DataRoom` object，關聯 Pool ID，初始化 default_folders。
6. 回傳 Sui 物件 ID（pool_id, dataroom_id）給前端。
1. Frontend：導向 Pool 詳情頁，顯示 Data Room 概覽。
2. Originator：進入「成員管理」，新增 Risk / Legal 地址並指定角色。
3. Backend：更新 `DataRoom.members` + 更新 Seal policy（白名單）。
4. Sui：記錄對應 event（PoolCreated / DataRoomCreated / MembershipUpdated）。

### B. 上傳文件與版本管理（v0）

1. Editor：在 Pool Data Room 裡選擇資料夾，按「上傳」。
2. Frontend：

3. 用前端或 Backend 生成加密金鑰（依 Pool/Doc 設計）。
4. 把檔案加密後，上傳到 Walrus（可能分片）。
1. Walrus：回傳 content ID（CID）。
2. Frontend：呼叫 Backend `/documents/create`，附上 dataroom_id, folder_id, doc_type, title, CID, hash。
3. Backend：

4. 透過 Seal policy 檢查 caller 是否為 Editor / Owner。
5. 在 Sui 上建立或更新 `Document` object：
        - 新文件：current_version=1, versions=[v1]。
        - 舊文件：current_version+1, append 新版本。
6. 建立 `AuditTrailEntry`（action_type=UploadDoc）。
1. Sui：emit DocumentCreated/Updated event。
2. Reviewer：在前端看到新文件列表，點開預覽。
3. Reviewer：審閱後在前端標記「Reviewed」或「Needs Revision」，並留下 comment。
4. Backend：

5. 更新 `Document.review_state` + last_reviewed_by/at。
6. 將 comment 內容存 DB / Walrus，hash 上鏈或寫入 AuditTrail。

### C. IC 決議與狀態變更（v0）

1. Pool Owner：在文件 checklist 都變成 Reviewed 後，按「送交 IC」。
2. Backend：

3. 檢查角色與文件狀態。
4. 呼叫 Sui 合約將 Pool.current_state 從 `DD_In_Progress → IC_Review`，emit event。
1. IC 成員：在「IC Review」tab 查看重點資料與文件。
2. IC Meeting 後，IC 成員：在前端建立決議（決策類型 + 簡短說明 + 上傳決議書 PDF）。
3. Frontend：加密 PDF，上傳 Walrus，得到 CID。
4. Backend：

5. 建立 `ICDecision` object（含 decision_type, CID, committee_members）。
6. 若 decision_type=Approve：
        - 呼叫 Pool 合約 → `IC_Review → Approved_Internal`。
7. 若決議為 Reject / RequestChanges，改變狀態回 Draft / DD_In_Progress。
8. 建立 `AuditTrailEntry`（action_type=ICDecision）。

### D. Ready_To_Issue 到發行（Phase 2）

1. Compliance / Org Admin：審查所有文件與決議，按「標記為 Ready To Issue」。
2. Backend：

3. 檢查狀態為 Approved_Internal。
4. 呼叫 Sui 合約→ Pool.state = Ready_To_Issue，emit event。
1. 發行合約（獨立 Move 模組）：

2. 監聽 Ready_To_Issue event 或由前端帶入 pool_id。
3. 檢查 Pool.current_state == Ready_To_Issue。
4. 鑄造代表該 Pool 的 RWA token（例如 ERC-20 類似的 Sui token 或細分份額）。
5. 記錄 token_contract_addr 回 Pool 物件。
6. 將 Pool.current_state 設為 Issued。

### E. 投資人 Onboarding 與持倉（Phase 2）

1. 投資人：在前端申請投資 Pool A，建立 InvestorProfile。
2. Backend：

3. 建立 InvestorProfile（狀態 Created）。
4. 呼叫 KYC provider API，狀態→KYC_In_Progress。
1. KYC provider：callback 給 Backend，告知 KYC_Approved。
2. Backend：更新 InvestorProfile.kyc_status = Approved，onboarding_state → KYC_Approved。
3. 投資人：在前端閱讀並簽署訂閱協議（可用 off-chain e-sign 或 on-chain message sign）。
4. Backend：

5. 驗證簽章，產生協議 PDF，上傳 Walrus。
6. 更新 onboarding_state = Agreement_Signed。
7. 更新 Seal policy：此 wallet_address 對該 Pool 的「Subscription/Token contract」被加入 whitelist。
8. onboarding_state = Whitelisted。
1. 投資人：透過前端發起真實申購交易，發行合約檢查該地址是否在 Seal/KYC whitelist 中，成功則建立/更新 InvestorPosition 物件。

### F. 存續期事件與報告（Phase 3）

1. Servicer / Originator：在期末輸入實際利息支付紀錄，或從現金流系統同步。
2. Backend：

3. 建立 `ServicingEvent` object（event_type=InterestPayment, amount, date）。
4. 更新 Pool.LifecycleState 如有需要（例如嚴重逾期 → Default）。
5. 上傳相關報表到 Walrus，更新 report_cid。
1. Sui：emit ServicingEvent event。
2. 前端：在 Pool 的「Performance / Reports」tab 顯示所有 ServicingEvent 與對應報告。
3. 若最後結案：
    - 建立 FinalResolution 事件，將 LifecycleState=Resolved，Pool.state=Closed。

***

如果你願意，下一步我們可以挑一兩個物件（例如 `Pool` + `DataRoom`）直接試著用 Move 的 struct 形式寫出「接近實作」的欄位定義，並畫出一個簡化的「CreatePool → UploadDoc → Approve → Ready_To_Issue」序列圖對應到實際合約 entry functions。

<div align="center">⁂</div>

[^1]: External-HackMoney-x-Sui-Project-Ideas.pdf

