# RWA Data Room 專案計畫與決策紀錄 (Plan.md)

## 2026-03-11: 規格與設計文件產出

### 做了什麼
1. 讀取並統整 `/Idea` 資料夾內所有關於「RWA 資料室 (Data Room)」的概念與討論文件。
2. 生成 3 份核心文檔並存入 `/docs/design/`：
   - `規格書.md`：確立產品為 Phase 1~3 的「私募信貸合規虛擬資料室 (VDR)」，釐清角色權限、核心物件與文件管理流程。
   - `系統架構書.md`：定義 SUI On-chain、Walrus + Seal 與 Off-chain Node.js/DB 協同運作的三層架構，並附帶時序流程。
   - `UI設計書.md`：定調具備高信任度與 Web2 流暢體驗的介面設計 (Sui Blue & Glassmorphism)，涵蓋儀表板、檔案審批與權限指派。

### 更動了哪些檔案
- `docs/design/規格書.md` (NEW)
- `docs/design/系統架構書.md` (NEW)
- `docs/design/UI設計書.md` (NEW)
- `docs/design/roadmap.md` (NEW)
- `plan.md` (NEW, 本文件)

### 決策原因
- 為了確保整個專案能夠被後續 AI 嚴謹審核並接續開發，故採用最完整的系統與介面拆解，將原本的想法 (ideas) 濃縮為能直接供工程師與設計師作為 Blueprint 的技術文檔。
- 基於 SUI 生態與 B2B 金融領域的需求，介面設計採用嚴謹但不死板的美學風格 (明亮簡潔/信任感)。

### 尚未完成的 TODO
- 基礎環境建置與合約 (Sui Move) 目錄框架。
- 前後端專案初始化 (Next.js / Node.js)。
- `move-notes.md`, `frontend-notes.md` 等子領域具體開發。
