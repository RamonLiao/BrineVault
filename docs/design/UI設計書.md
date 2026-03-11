# RWA Credit Data Room UI 設計書 (UI Design & UX Guidelines)

## 1. 設計理念與風格定調 (Design Philosophy)

為打造具備國際級 B2B 金融水準的合規資料室平台，UI 設計將融合 Web3 當前主流的技術感與傳統投資銀行的嚴謹穩重。
- **明亮簡潔 (Clean & Bright)**：利用大面積白留白、卡片化佈局以減輕長時檢閱財報的疲勞感，剔除多餘的裝飾線條，保證內容為王。
- **嚴謹穩重 (Trustworthy & Professional)**：排版對齊強調強迫症級別的精準度。運用層級分明的陰影與微毛玻璃效果 (Glassmorphism)，展現高級的質感與「造市商」等級的信任度。
- **品牌調性參考**：融合 Sui Network 的原生水藍色與深邃漸層，以及傳統金融如 J.P. Morgan 或頂級 VDR (如 DataSite, DocSend) 的沉穩大氣。

---

## 2. 顏色與版式規範 (Design System)

### 2.1 色彩計畫 (Color Palette)
- **Primary (主色 - Trust Blue)**：`#007BFF` (Sui 的延伸科技藍)。用於主要動作按鈕 (CAs)、標籤與選取狀態。
- **Surface (表面/背景色)**：`#FAFAFC` 作為全域背景，`#FFFFFF` 作為卡片或模態視窗背景，提供高對比銳利的閱讀區。
- **Text (字體配色)**：
  - 主要標題/重點數值：`#1A1C29` (深邃海軍藍，取代死黑，增加高級感)。
  - 次要文字/輔助說明：`#64748B` (乾淨的 Slate 灰)。
- **Semantic (語意色彩 - 重點提醒)**：
  - 狀態 - 核准 (Approved) / 成功：`#10B981` (翠綠色)。
  - 狀態 - 待修訂 (Needs Revision) / 警告：`#F59E0B` (琥珀橘)。
  - 狀態 - 拒絕 (Rejected) / 刪除：`#EF4444` (警示紅)。

### 2.2 字體排印 (Typography)
- **主要字體**：`Inter` 或 `Plus Jakarta Sans`。此類幾何無襯線字體具備出色的螢幕易讀性及現代科技感。
- **層級設定**：
  - 標題 (Headers)：Bold，嚴格遵守 Web 規範，字距適當緊縮增強力量感。
  - 內文 (Body)：Regular / Medium，字級預設 14px - 16px，行高 1.5 倍，提供法務合約閱讀上的舒適度。
  - 數字/金額：強調等寬數字對齊 (Tabular numbers)，便於對帳。

### 2.3 材質與陰影 (Materials & Shadows)
- 運用細膩的柔和陰影 (Drop Shadow) 與圓角 (Border Radius `8px` - `12px`) 來區隔主視圖與子卡片。
- 在重點對話框 (如簽署、批准 Modal) 四周可點綴輕微的 Glassmorphism 以分離背景並鎖定視覺焦點。

---

## 3. 關鍵介面設計與交互 (Key Screens & Workflows)

### 3.1 儀表板與專案列表 (Dashboard & Pool List)
**目標：一眼看穿所有專案狀態與代辦事項。**
- **視覺組成**：
  - 頂部導覽列：Logo、當前組織 (Org) 切換下拉單、使用者頭像與錢包連結狀態 (Sui Wallet)。
  - 數據卡片區：顯示 `Total Pools`, `Total Asset Value`, 以及 `Pending IC Reviews` 警示，以便快速進入工作流。
  - 專案清單 (Data Table)：以精緻的資料表呈現。具備狀態徽章 (State Badges, 顯示 Draft、DD_In_Progress 等)，滑鼠懸停 (Hover) 時以極簡的高光底色作為回饋。

### 3.2 專案詳情與虛擬資料室 (Data Room Detail & VDR)
**目標：極致流暢的文件管理與版本控管體驗。**
- **頂部進度條 (State Machine Tracker)**：使用具備方向性的 Chevron 進度條，清晰顯示當前 Pool 所處階段，即將推進的階段則提供「一鍵推進 (Request Transition)」按鈕。
- **左側邊欄 (File Tree / Folders)**：展開式的資料夾層級結構 (`Legal`, `Financials`, `Reports`)。
- **主視圖區 (Document List & Version Viewer)**：
  - **Drag & Drop** 檔案拖拉上傳區域，具備虛線框及上傳進度動畫。
  - 每列檔案右側提供版本下拉選單 (v1, v2…)，點擊後可呼叫右側滑出式側邊欄 (Drawer)。
- **審核面板 (Review & Comment Drawer)**：
  - 當點擊檔案時右側滑出的操作面板。上方提供檔案預覽或 Walrus 下載連結。
  - 中間是快速審核按鈕：🟢 `Approve`, 🟠 `Needs Revision`。
  - 下方為活動流與對話框 (Threaded Comments)，標註使用者暱稱與時間戳。

### 3.3 成員授權與角色管理 (Membership & Access Control)
**目標：降低隱私控管的操作門檻。**
- 提供清晰的 User List。
- 新增成員採用 Modal，包含地址輸入、身份角色選擇 (`Pool Owner`, `Editor`, `Reviewer`, `Viewer`)。
- 角色變動時彈出二度確認對話框，明確提示「該操作將會更動 Seal 鏈上權限並且不可逆」，利用字體加粗及警告色彩增強防呆。

### 3.4 投審會決策專區 (IC Decision Panel)
**目標：肅穆、儀式感、防呆究責。**
- 專屬的決策頁籤 (Tab)，上方彙整風控報告、核准率及總體評分等摘要卡片。
- **Decision Box**：大型動作介面，強制要求上傳簽核決議書 (PDF) 以及輸入評語，方可點擊藍色主按鈕「送交核准 (Submit Approval)」。完成後會有鏈上交易確認的讀取動畫與成功音頻 / 視覺回饋。
- **委員投票顯示 (Per-Member Vote Display)**：
  - 以水平卡片列呈現每位 IC 委員的投票狀態：頭像/地址 + 投票徽章 (`Approve` / `Reject` / `Abstain` / `Pending`)。
  - 彙總視覺化：圓餅圖或色條 (Stacked Bar) 顯示核准 / 否決 / 棄權比例，搭配文字標註如「4/5 Approved」。
  - 每位委員的投票附帶時間戳與評語摘要（點擊可展開完整評語）。
- **歷史決策列表 (Decision History)**：
  - 決策頁籤底部呈現該 Pool 歷史 IC 決策紀錄 (Data Table)。
  - 欄位：決策輪次、日期、結果 (Approved/Rejected)、投票摘要、決議書連結。
  - 點擊任一列可展開查看該輪次的完整委員投票與評語。

### 3.5 Pool 建立精靈 (Pool Creation Wizard)
**目標：引導式建立新 Pool，降低操作門檻並確保必要資訊齊備。**
- **整體設計**：乾淨的多步驟精靈介面，頂部配置 Step Indicator（如 `1 → 2 → 3 → 4 → 5`），清晰標示當前步驟，已完成步驟以主色勾選標記。底部固定導覽列提供「上一步 (Back)」與「下一步 (Next)」按鈕，最末步為「確認送出 (Confirm & Submit)」。
- **Step 1 — 基本資訊 (Basic Info)**：
  - 表單欄位：Pool 名稱、借款人 (Borrower) 名稱/實體、幣別 (Currency Selector)、目標名義金額 (Target Notional)、到期日 (Maturity Date Picker)。
  - 必填欄位以星號標示，即時 Inline Validation。
- **Step 2 — 加密引擎選擇 (Encryption Engine Selection)**：
  - 雙欄卡片式選擇：
    - **AES-256 Production**（預設選取）：穩定版圖示、簡要說明「業界標準對稱加密」。
    - **Seal Beta**：附帶 Beta 徽章（`#F59E0B` 琥珀背景）、說明「Threshold encryption via Sui Seal」、10% 折扣標註、確認勾選框（「我了解此為 Beta 功能」）。
  - 選擇後下方顯示引擎摘要資訊。
- **Step 3 — DD Checklist 自訂 (DD Checklist Customization)**：
  - 預先填入模板清單，依資料夾分群 (Legal, Financials, Collateral, Insurance, etc.)。
  - 每個項目提供 Toggle：必填 (Required) / 選填 (Optional)，並可拖曳排序。
  - 支援新增自定義項目（+ Add Item 按鈕）與刪除非必要項目。
- **Step 4 — 邀請初始團隊成員 (Invite Initial Members)**：
  - 可新增多列，每列包含：Sui 地址輸入框 + 角色下拉選單 (`Editor`, `Reviewer`, `Viewer`)。
  - 地址格式即時驗證（`0x` 開頭，64 hex chars）。
  - 可跳過此步驟，後續再行邀請。
- **Step 5 — 總覽與確認 (Review & Confirm)**：
  - 以唯讀摘要卡片呈現前四步所有填入資訊，方便檢查。
  - 點擊「Confirm & Submit」→ 觸發 Sui Transaction，彈出 Wallet Signing Modal。
  - Signing Modal 使用 Glassmorphism 遮罩，清晰列示交易內容摘要（建立 Pool、設定成員、Gas 費估算）。
  - 送出成功後顯示成功動畫 + Transaction Hash 連結，自動導向新建 Pool 詳情頁。

### 3.6 DD Checklist 檢視 (DD Checklist View)
**目標：一目了然掌握盡職調查文件的完備狀態與缺口。**
- **位置**：Pool 詳情頁內的獨立頁籤 (Tab)。
- **頂部進度摘要**：
  - 雙層進度條：第一條顯示上傳進度（如「Required: 15/25 已上傳」），第二條顯示審閱進度（如「10/25 已審閱」）。
  - 進度條使用語意色彩：完成段落 `#10B981`，進行中 `#007BFF`，未開始 `#E2E8F0`。
- **Gate Condition 指示器**：
  - 頂部右側顯示 Gate 狀態徽章：
    - 就緒：綠色徽章「Ready for IC Review」。
    - 未就緒：琥珀色徽章「3 required documents still pending review」，附帶數量明細。
- **分群清單 (Grouped List)**：
  - 依資料夾分群 (Legal, Financials, Collateral, etc.)，每群可收合/展開。
  - 每個項目顯示：
    - 名稱 (Item Name)
    - 狀態圖示：❌ 缺件 (Missing) / ⬆️ 已上傳 (Uploaded) / ✅ 已審閱 (Reviewed) / 🔄 需修訂 (Needs Revision)
    - 必填/選填徽章
    - 關聯文件連結（點擊直達 Document Detail）
  - 色碼對應設計系統語意色彩。

### 3.7 稽核軌跡與活動動態 (Audit Trail / Activity Feed)
**目標：完整透明的操作歷史，支援合規稽核需求。**
- **位置**：Pool 詳情頁內的獨立頁籤 (Tab)。
- **時間軸視圖 (Timeline View)**：
  - 垂直時間軸，最新事件在最上方。
  - 每筆記錄包含：
    - 動作類型圖示（上傳、審閱、狀態變更、成員異動、IC 決策等，各有專屬 Icon）。
    - 操作者名稱/地址（可點擊查看完整地址）。
    - 動作描述（如「Alice 上傳了 Legal/NDA_v2.pdf」）。
    - 時間戳（相對時間 + hover 顯示絕對時間）。
- **篩選器 (Filters)**：
  - 依動作類型、操作者、日期範圍篩選。
  - 篩選條件以 Chip 形式顯示於清單上方，支援快速清除。
- **匯出功能**：右上角匯出按鈕，支援 JSON / CSV 格式下載。
- **物件連結 (Object Links)**：
  - 點擊記錄中的文件名稱 → 跳轉至 Document Detail。
  - 點擊狀態變更事件 → 顯示 from/to 狀態對照（如 `DD_In_Progress → IC_Review`）。

### 3.8 文件版本歷史 (Document Version History)
**目標：清晰追溯文件每一版的異動紀錄與鏈上存證。**
- **入口**：Document Detail 頁面中的「Version History」區塊或展開面板。
- **時間軸呈現**：垂直排列所有版本 (v1, v2, v3...)，最新版在上。
- **每個版本卡片包含**：
  - 版本號碼（當前版本以 Primary 色高亮 + 「Current」徽章）。
  - 上傳者名稱/地址。
  - 上傳時間。
  - 檔案大小。
  - 變更備註 (Changelog Note)，可為空。
  - Walrus Blob ID（截斷顯示，附複製按鈕與 Walrus Explorer 連結）。
  - 下載按鈕（該版本的解密下載）。
- **歷史版本**：附帶「Superseded」灰色徽章，視覺權重降低（字色使用 `#64748B`）。

### 3.9 個別審閱者狀態面板 (Per-Reviewer Status Panel)
**目標：明確呈現每位審閱者的獨立審核狀態，避免混淆。**
- **位置**：Document Detail 的 Review Drawer 內，擴展現有審核面板設計。
- **彙總狀態 (Aggregate Status)**：
  - Drawer 頂部顯示彙總資訊，如「2/3 Approved, 1 Needs Revision」。
  - 以色條或小型進度指示器視覺化比例。
- **個別審閱者列表**：
  - 每列包含：頭像/地址 + 狀態徽章 (`Pending` / `Approved` / `Needs Revision`) + 操作時間戳。
  - 狀態徽章使用語意色彩：Pending `#64748B`、Approved `#10B981`、Needs Revision `#F59E0B`。
  - 當前使用者的列以淡藍底色高亮，且僅當前使用者可操作自己的狀態（其他列為唯讀）。

### 3.10 組織設定 (Organization Settings)
**目標：集中管理組織資訊、成員與訂閱狀態。**
- **組織資訊 (Org Info)**：
  - 可編輯欄位：組織名稱、法律名稱。
  - 唯讀欄位：組織 ID、建立日期。
- **成員管理 (Member Management)**：
  - 組織層級成員清單 (Data Table)：地址、角色 (`Admin` / `Member`)、加入日期、狀態。
  - 角色變更下拉選單（僅 Admin 可操作）。
  - 移除成員按鈕（附二次確認 Modal）。
- **邀請管理 (Invite Management)**：
  - 產生邀請碼按鈕 → 彈出 Modal 顯示邀請碼（附複製與 QR Code）。
  - 已產生邀請碼列表：碼值（部分遮罩）、狀態 (Active/Used/Expired)、建立時間。
- **訂閱狀態 (Subscription Status)**：
  - 顯示：目前方案名稱、到期日、自動續約狀態。
  - 「Renew Now」主按鈕（臨近到期時強調顯示）。
- **付款紀錄 (Payment History)**：
  - 帳單列表 (Data Table)：日期、金額、方案、狀態 (Paid/Pending)、發票下載連結。
- **通知偏好 (Notification Preferences)**：
  - 依通知類型設定開關：Email 通知、In-App 通知，可分別啟用/停用。

### 3.11 錢包連結與首次使用者流程 (Wallet Connection & First-Time User Flow)
**目標：無摩擦的 Web3 Onboarding，兼顧安全提示。**
- **Connect Wallet Modal**：
  - Glassmorphism 遮罩背景，中央卡片列出支援的錢包選項：Sui Wallet、Suiet、Martian 等，每個以 Logo + 名稱呈現。
  - 點選後進入該錢包的連結授權流程。
- **Sign Message 確認**：
  - 連結成功後彈出簽名確認 Modal，清楚解釋簽名用途（「此簽名僅用於身份驗證，不會發送任何交易或轉移資產」）。
  - 顯示即將簽署的 Challenge 內容摘要。
- **首次使用者分流 (First-Time Flow)**：
  - 驗證通過後，若為新使用者，顯示選擇畫面：
    - **「建立組織 (Create Organization)」**：簡易表單（組織名稱、法律名稱）→ 送出後導向 Dashboard。
    - **「加入現有組織 (Join with Invite Code)」**：邀請碼輸入框 → 驗證成功後顯示組織資訊確認 → 導向 Dashboard。
  - 兩個選項以大型卡片並排呈現，附帶圖示與簡要說明。

### 3.12 通知中心 (Notification Center)
**目標：即時掌握所有需要關注的事件，不遺漏關鍵動態。**
- **入口**：頂部導覽列的鈴鐺圖示 (Bell Icon)，未讀數量以紅色圓形徽章標示。
- **下拉面板 (Dropdown Panel)**：
  - 點擊鈴鐺展開下拉面板，寬度約 380px，最大高度固定並可捲動。
  - 依時間分群：Today、Yesterday、Earlier。
  - 每則通知包含：動作類型圖示 + 標題 + 簡短描述 + 相對時間戳 + 「標為已讀 (Mark as Read)」操作。
  - 未讀通知以淡藍底色區分。
  - 點擊通知 → 導航至相關頁面（如對應的 Document Detail 或 Pool 詳情）。
- **完整通知頁 (Full Notification Page)**：
  - 面板底部「View All」連結 → 全頁式通知列表，支援分頁與篩選。
- **通知偏好**：連結至 Organization Settings 的通知偏好區塊。

### 3.13 訂閱到期警示 (Subscription Expiry Warnings)
**目標：分級預警，引導使用者及時續約，避免服務中斷。**
- **警示邏輯與呈現**：
  - **30 天前**：Dashboard 頂部顯示資訊性橫幅 (Info Banner)，背景 `#DBEAFE`（淡藍），內容：到期日 + 「Renew Now」文字連結。語氣平和。
  - **14 天前**：升級為警告橫幅 (Warning Banner)，背景 `#FEF3C7`（淡琥珀），文字更明確提及服務限制風險，「Renew Now」改為按鈕。
  - **7 天前**：升級為嚴重警告橫幅 (Critical Banner)，背景 `#FEE2E2`（淡紅），文字加粗並標註「逾期將加收 1.3 倍滯納金」，CTA 按鈕更醒目。
  - **已過期**：Dashboard 覆蓋紅色半透明遮罩 (Red Overlay)，功能受限提示，僅保留續約入口與資料匯出功能。
- **點擊行為**：所有 Banner 的 CTA 按鈕均導向 Organization Settings 的 Subscription 區塊。

### 3.14 加密引擎指示器 (Encryption Engine Indicator)
**目標：明確但不干擾地標示每個 Pool 使用的加密引擎。**
- **Pool Header 徽章**：
  - Pool 詳情頁標題旁顯示小型徽章：「AES-256」或「Seal Beta」。
  - AES-256：鎖頭圖示 + 文字，使用 `#64748B` 低調色調。
  - Seal Beta：實驗瓶圖示 + 文字 + Beta 子徽章（琥珀色 `#F59E0B`），稍具辨識度但不喧賓奪主。
- **功能一致性**：無論加密引擎為何，所有畫面（上傳、下載、審閱）的 UX 完全一致，不做差異化處理。
- **Pool Settings 頁面**：加密引擎類型以唯讀方式顯示（建立後不可變更），附帶說明文字。

---

## 4. 動態與微交互 (Micro-interactions)
- **按鈕回饋**：點擊主要按鈕呼叫區塊鏈錢包前，按鈕轉為 Loading Spinner (載入動畫) 以穩定使用者情緒，等候簽署結果。
- **資料刷新**：使用骨架屏 (Skeleton Loading) 替代傳統轉圈動畫，保持版面的重量感不斷裂。
- **通知模組 (Toast Notifications)**：於畫面右上角懸浮顯示成功/失敗或鏈上紀錄結果 (Transaction Hash Link)，停留 3-5 秒後淡出。

---

## 5. 響應式設計 (Responsive Design)

Phase 1 以桌面環境為主要目標 (viewport >= 1280px)，確保所有功能完整可用。
- **桌面 (Desktop, >= 1280px)**：完整功能，雙欄/三欄佈局，側邊欄常駐展開。
- **平板 (Tablet, >= 768px)**：支援審閱與唯讀工作流（文件瀏覽、Review Drawer、Audit Trail 查看）。側邊欄改為可收合 Overlay，表單精靈改為全寬單欄。
- **行動裝置 (Mobile, < 768px)**：Phase 1 不在範圍內。未來視需求評估。

---

## 6. 無障礙設計 (Accessibility)

遵循 WCAG AA 等級為最低標準：
- **色彩對比**：所有文字與背景的對比度須符合 WCAG AA 標準（一般文字 >= 4.5:1，大型文字 >= 3:1）。語意色彩在淺色背景上已預設滿足此要求。
- **鍵盤導覽 (Keyboard Navigation)**：所有互動元素 (按鈕、連結、表單欄位、下拉選單、Tab 切換) 須支援完整的鍵盤操作 (`Tab`, `Enter`, `Escape`, 方向鍵)。
- **焦點指示器 (Focus Indicators)**：所有按鈕與輸入欄位須具備清晰可見的焦點外框 (Focus Ring)，使用 `#007BFF` 2px outline，不可僅依賴色彩變化。
- **螢幕閱讀器標籤 (Screen Reader Labels)**：所有互動元素須提供 `aria-label` 或關聯 `<label>`。狀態圖示 (如審核狀態 icon) 須附帶 `alt` text 或 `aria-label`（如 `alt="Status: Approved"`）。
- **圖示替代文字 (Icon Alt Text)**：純裝飾性圖示標記為 `aria-hidden="true"`，功能性圖示提供語意化替代文字。
