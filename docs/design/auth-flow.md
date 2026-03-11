# RWA Credit Data Room — 認證與 Session 管理規格書

**建立日期：** 2026-03-11
**狀態：** Draft
**適用範圍：** Phase 1 (v0–v1)

---

## 1. 錢包認證流程 (Wallet Authentication Flow)

### 1.1 流程總覽

```
┌──────────┐       ┌──────────────┐       ┌──────────┐       ┌─────────┐
│  Browser  │       │   Frontend   │       │  Backend  │       │  Redis  │
│  Wallet   │       │   (Next.js)  │       │ (NestJS)  │       │         │
└────┬─────┘       └──────┬───────┘       └─────┬────┘       └────┬────┘
     │                     │                      │                 │
     │  1. Connect Wallet  │                      │                 │
     │◄───────────────────►│                      │                 │
     │                     │  2. GET /auth/challenge                │
     │                     │─────────────────────►│                 │
     │                     │                      │  3. Store nonce │
     │                     │                      │────────────────►│
     │                     │  4. { nonce, ts }     │                 │
     │                     │◄─────────────────────│                 │
     │  5. Sign message    │                      │                 │
     │◄────────────────────│                      │                 │
     │  6. signature       │                      │                 │
     │────────────────────►│                      │                 │
     │                     │  7. POST /auth/verify │                 │
     │                     │─────────────────────►│                 │
     │                     │                      │  8. Verify nonce│
     │                     │                      │────────────────►│
     │                     │                      │  9. Verify sig  │
     │                     │                      │  10. Upsert User│
     │                     │                      │  11. Create session
     │                     │                      │────────────────►│
     │                     │  12. JWT + cookie     │                 │
     │                     │◄─────────────────────│                 │
     │                     │                      │                 │
```

### 1.2 各步驟詳細說明

#### Step 1–2: 錢包連接與 Challenge 請求

使用者透過 Sui Wallet Adapter 連接錢包（支援 Sui Wallet、Suiet、Martian 等）。連接成功後，Frontend 向 Backend 請求一次性 challenge。

```
GET /v1/auth/challenge
```

Response:
```json
{
  "nonce": "a1b2c3d4e5f6789012345678",
  "timestamp": "2026-03-11T08:30:00.000Z",
  "expires_at": "2026-03-11T08:35:00.000Z"
}
```

- `nonce`：24 字元隨機 hex string，由 `crypto.randomBytes(12).toString('hex')` 產生
- 有效期：5 分鐘
- Backend 將 `nonce` 存入 Redis，key 為 `auth:challenge:{nonce}`，TTL = 300s

#### Step 3–6: 簽名訊息

Frontend 組裝簽名訊息並請求使用者簽名：

```
Sign in to RWA Data Room
Nonce: a1b2c3d4e5f6789012345678
Timestamp: 2026-03-11T08:30:00.000Z
```

使用 Sui Wallet Adapter 的 `signPersonalMessage()` 方法。簽名結果為 `Uint8Array`，Frontend 轉為 base64 傳送。

#### Step 7–12: 驗證與 Token 發行

```
POST /v1/auth/verify
Content-Type: application/json

{
  "address": "0x1234...abcd",
  "signature": "base64_encoded_signature",
  "nonce": "a1b2c3d4e5f6789012345678"
}
```

Backend 驗證邏輯（依序）：

1. **Nonce 驗證**：從 Redis 取出 `auth:challenge:{nonce}`，確認存在且未過期。取出後立即刪除（one-time use）。
2. **時間驗證**：確認 challenge timestamp 在 5 分鐘內。
3. **簽名驗證**：使用 `@mysten/sui` SDK 的 `verifyPersonalMessageSignature()` 驗證 signature 對應 address。
4. **User Upsert**：在 PostgreSQL 中 `INSERT ... ON CONFLICT (wallet_address) DO UPDATE SET last_login_at = NOW()`。
5. **Session 建立**：生成 session ID，存入 Redis。
6. **Token 發行**：簽發 JWT access token + refresh token。

成功回應：
```json
{
  "access_token": "eyJhbGciOiJFZDI1NTE5...",
  "user": {
    "id": "uuid-v7",
    "address": "0x1234...abcd",
    "org_id": null,
    "role": null,
    "created_at": "2026-03-11T08:30:05.000Z"
  }
}
```

- `access_token` 放在 response body，由 Frontend 存於 memory
- `refresh_token` 透過 `Set-Cookie` header 設定為 httpOnly cookie（不在 body 中暴露）

失敗回應：
```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "Signature verification failed for the given address."
  }
}
```

---

## 2. Session 管理

### 2.1 Token 規格

| Token | 存放位置 | 有效期 | 用途 |
|-------|---------|--------|------|
| Access Token (JWT) | Frontend memory (非 localStorage) | 15 分鐘 | API 請求認證 |
| Refresh Token | httpOnly, Secure, SameSite=Strict cookie | 7 天 | 換發新 access token |

#### Access Token (JWT) Payload

```json
{
  "sub": "user-uuid-v7",
  "address": "0x1234...abcd",
  "org_id": "org-uuid-v7",
  "org_role": "admin",
  "sid": "session-uuid",
  "iat": 1741680600,
  "exp": 1741681500
}
```

- 簽名演算法：`Ed25519`（與 Sui 生態一致），或 `RS256` 作為備選
- `sid`（session ID）用於 server-side invalidation

#### Refresh Token

- 格式：opaque random string（64 bytes hex）
- Redis key：`session:{sid}` → `{ user_id, refresh_token_hash, created_at, last_active_at, ip, user_agent }`
- Refresh token 本身只存 SHA-256 hash，不存明文

### 2.2 Token 刷新流程

```
POST /v1/auth/refresh
Cookie: refresh_token=abc123...
```

Backend 處理：

1. 從 cookie 取出 refresh token
2. 計算 SHA-256 hash，比對 Redis 中的 `refresh_token_hash`
3. 確認 session 未過期、未被 revoke
4. **Refresh Token Rotation**：簽發新的 access token + 新的 refresh token，舊 refresh token 立即失效
5. 更新 Redis session 的 `last_active_at`

成功回應：
```json
{
  "access_token": "eyJhbGciOiJFZDI1NTE5..."
}
```

新 refresh token 同樣透過 `Set-Cookie` 回傳。

#### Refresh Token Reuse Detection

若偵測到已被 rotate 的舊 refresh token 再次被使用（可能被竊取）：
- 立即 invalidate 該 session 的所有 token
- 清除 Redis session
- 回傳 `401`，強制使用者重新登入

### 2.3 登出

```
POST /v1/auth/logout
Authorization: Bearer {access_token}
Cookie: refresh_token=abc123...
```

Backend 處理：
1. 從 JWT 取出 `sid`
2. 刪除 Redis 中的 `session:{sid}`
3. 將 access token 的 `jti` 加入 Redis blacklist，TTL = access token 剩餘有效期
4. 清除 refresh token cookie：`Set-Cookie: refresh_token=; Max-Age=0; ...`

回應：`204 No Content`

### 2.4 Session 儲存結構 (Redis)

```
# Challenge（一次性）
auth:challenge:{nonce} → { timestamp, ip } TTL=300s

# Session
session:{sid} → {
  user_id: "uuid",
  refresh_token_hash: "sha256hex",
  created_at: "ISO8601",
  last_active_at: "ISO8601",
  ip: "1.2.3.4",
  user_agent: "Mozilla/5.0..."
} TTL=604800s (7天)

# Access token blacklist（登出用）
token:blacklist:{jti} → 1 TTL=remaining_seconds

# Rate limit
rate:auth:{ip} → count TTL=60s
```

---

## 3. 交易簽名模型 (Transaction Signing Model)

### 3.1 混合簽名分類

本系統採用混合簽名模式（參照 ADR-02）。關鍵操作由使用者在瀏覽器中親自簽名，確保不可否認性；Routine metadata 寫入由 Backend 以平台金鑰代簽並贊助 gas。

| 操作類型 | 簽名者 | Gas 支付者 | 理由 |
|---------|--------|-----------|------|
| Pool 狀態轉移 | 使用者（瀏覽器） | 使用者 | 高權限操作，需不可否認性 |
| 成員新增/移除 | 使用者（瀏覽器） | 使用者 | 影響權限範圍，需明確授權 |
| IC 決議提交 | 使用者（瀏覽器） | 使用者 | 法律效力，需個人簽名 |
| Document review 狀態變更 | 使用者（瀏覽器） | 使用者 | 審核責任歸屬 |
| 文件 metadata 寫入 | Backend（平台金鑰） | 平台（sponsored tx） | 頻繁操作，提升 UX |
| Audit event 發送 | Backend（平台金鑰） | 平台（sponsored tx） | 系統自動觸發 |

### 3.2 使用者簽名流程

```
┌──────────┐       ┌──────────────┐       ┌──────────┐       ┌──────────┐
│  Browser  │       │   Frontend   │       │  Backend  │       │ Sui RPC  │
│  Wallet   │       │              │       │          │       │          │
└────┬─────┘       └──────┬───────┘       └─────┬────┘       └────┬─────┘
     │                     │                      │                 │
     │                     │  1. POST /pools/:id/transitions       │
     │                     │─────────────────────►│                 │
     │                     │                      │  2. Build tx    │
     │                     │  3. { tx_bytes }      │                 │
     │                     │◄─────────────────────│                 │
     │  4. signTransaction │                      │                 │
     │◄────────────────────│                      │                 │
     │  5. signed_tx       │                      │                 │
     │────────────────────►│                      │                 │
     │                     │  6. Submit signed tx  │                 │
     │                     │─────────────────────►│                 │
     │                     │                      │  7. Execute tx  │
     │                     │                      │────────────────►│
     │                     │                      │  8. tx result   │
     │                     │                      │◄────────────────│
     │                     │  9. { tx_digest }     │                 │
     │                     │◄─────────────────────│                 │
```

**流程說明：**
1. Frontend 向 Backend 發起操作請求（例如狀態轉移）
2. Backend 建構 Sui `TransactionBlock`，但**不簽名**
3. Backend 回傳序列化後的 `tx_bytes`（base64）
4. Frontend 請求使用者錢包簽名
5. 使用者確認並簽名
6. Frontend 將簽名後的交易送回 Backend
7. Backend 提交至 Sui RPC 執行
8–9. 回傳交易結果

### 3.3 Backend Sponsored Transaction 流程

```
Frontend 上傳文件至 Walrus → 取得 blob_id
  │
  ▼
POST /pools/:poolId/documents
  { folder_id, doc_type, title, walrus_blob_id, content_hash, ... }
  │
  ▼
Backend 以平台金鑰簽署 + 贊助 gas
  │
  ▼
Sui Network 執行 → Document metadata 上鏈
  │
  ▼
Event Indexer 同步至 PostgreSQL
```

**平台金鑰管理：**
- 平台簽名金鑰以 HSM 或 KMS 保管（生產環境）
- 開發環境：環境變數中的 Ed25519 keypair（永不 commit）
- 平台金鑰僅用於 sponsored tx，不持有任何高權限角色
- Gas budget 上限：每筆 sponsored tx 設有 gas limit，防止異常消耗

---

## 4. 組織與首次使用者流程

### 4.1 首次連接流程

```
使用者連接錢包
  │
  ▼
認證成功，取得 JWT
  │
  ▼
Backend 檢查 user.org_id
  │
  ├── org_id == null → 導向 Onboarding 頁面
  │     │
  │     ├── 選擇「建立組織 (Create Organization)」
  │     │     └── 填寫 org name + legal name
  │     │     └── POST /v1/orgs → 建立 Org，user 成為 org_admin
  │     │
  │     └── 選擇「加入組織 (Join Organization)」
  │           └── 輸入邀請碼
  │           └── POST /v1/orgs/join → 加入 Org，角色由邀請設定
  │
  └── org_id != null → 導向 Dashboard
```

### 4.2 建立組織

```
POST /v1/orgs
Authorization: Bearer {access_token}

{
  "name": "Maple Capital",
  "legal_name": "Maple Capital Pte. Ltd.",
  "jurisdiction": "SG"
}
```

回應：
```json
{
  "id": "org-uuid-v7",
  "name": "Maple Capital",
  "legal_name": "Maple Capital Pte. Ltd.",
  "jurisdiction": "SG",
  "owner_id": "user-uuid-v7",
  "created_at": "2026-03-11T09:00:00.000Z"
}
```

- 建立者自動成為 `org_admin`
- 一個使用者只能屬於一個 Organization（Phase 1 限制）

### 4.3 邀請碼機制

```
POST /v1/orgs/:orgId/invite
Authorization: Bearer {access_token}

{
  "role": "member",
  "max_uses": 5,
  "expires_in_hours": 72
}
```

回應：
```json
{
  "invite_code": "MAPLE-A3X9-K2M7",
  "expires_at": "2026-03-14T09:00:00.000Z",
  "max_uses": 5,
  "used_count": 0
}
```

- 邀請碼格式：`{ORG_PREFIX}-{RANDOM_4}-{RANDOM_4}`（人類可讀）
- 儲存在 PostgreSQL，支援過期與使用次數限制
- 僅 `org_admin` 可產生邀請碼

### 4.4 加入組織

```
POST /v1/orgs/join
Authorization: Bearer {access_token}

{
  "invite_code": "MAPLE-A3X9-K2M7"
}
```

回應：
```json
{
  "org_id": "org-uuid-v7",
  "org_name": "Maple Capital",
  "role": "member",
  "joined_at": "2026-03-11T09:05:00.000Z"
}
```

---

## 5. API 請求認證機制

### 5.1 Bearer Token

所有非 `/auth/*` 的 API 請求必須帶入：

```
Authorization: Bearer {access_token}
```

### 5.2 JWT 驗證流程（每次 API 請求）

```
收到請求
  │
  ▼
1. 解析 Authorization header 取出 JWT
  │
  ▼
2. 驗證 JWT 簽名（Ed25519 公鑰）
  │
  ▼
3. 檢查 exp（是否過期）
  │
  ▼
4. 檢查 jti 是否在 Redis blacklist 中（已登出的 token）
  │
  ▼
5. 從 JWT payload 取出 user_id, org_id, sid
  │
  ▼
6. （可選）檢查 session:{sid} 是否仍存在於 Redis
  │
  ▼
7. 注入 request context，繼續處理
```

### 5.3 權限檢查分層

```
Layer 1: JWT 有效性（NestJS AuthGuard）
  │
  ▼
Layer 2: 組織層級（user 是否屬於該 org）
  │
  ▼
Layer 3: Pool 層級（user 是否為該 pool 的 member + 角色是否足夠）
  │
  ▼
Layer 4: 鏈上驗證（Sui Move 合約在 tx 執行時最終驗證）
```

- Layer 1–3 在 Backend 做預檢（fail fast，改善 UX）
- Layer 4 是最終權威。即使 Backend 放行，合約層仍會驗證
- Backend 的權限檢查是**效能優化**，不是**安全邊界**

---

## 6. 安全機制

### 6.1 Rate Limiting

| 端點類別 | 限制 | 維度 |
|---------|------|------|
| `GET /auth/challenge` | 10 req/min | per IP |
| `POST /auth/verify` | 5 req/min | per IP |
| `POST /auth/refresh` | 10 req/min | per user |
| Read endpoints | 100 req/min | per user |
| Write endpoints | 30 req/min | per user |

實作：Redis sliding window counter。

超過限制回應：
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please retry after 42 seconds.",
    "details": {
      "retry_after": 42
    }
  }
}
```

HTTP Status: `429 Too Many Requests`
Header: `Retry-After: 42`

### 6.2 CORS 政策

```typescript
// NestJS CORS 設定
{
  origin: ['https://app.rwadataroom.io'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  credentials: true,  // 允許 cookie
  maxAge: 86400,       // preflight cache 24hr
}
```

- 僅白名單 Frontend domain
- 開發環境額外允許 `http://localhost:3000`

### 6.3 CSRF 防護

- Refresh token cookie 設為 `SameSite=Strict`，阻擋跨站請求
- 所有 mutation endpoints（POST/PATCH/DELETE）額外要求 `X-CSRF-Token` header
- CSRF token 在每次 page load 時從 `GET /auth/csrf-token` 取得（存於 meta tag）
- Double Submit Cookie pattern 作為備用方案

### 6.4 安全 Headers

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

### 6.5 禁止事項

- **永不記錄**：私鑰、助記詞、refresh token 明文、完整 JWT
- **永不儲存**：使用者私鑰（Backend 完全不接觸）
- **永不傳輸**：加密金鑰明文（所有金鑰交換皆以公鑰加密）
- **永不信任**：Frontend 傳來的 user role（一律以 Backend DB + 鏈上合約為準）

### 6.6 異常偵測與回應

| 情境 | 偵測方式 | 回應 |
|------|---------|------|
| 同一 IP 短時間大量 challenge 請求 | Rate limiter | 429 + 暫時封鎖 IP 15 分鐘 |
| Refresh token reuse（可能被竊） | Redis 比對已 rotate 的 token | Invalidate 全部 session，強制重登 |
| JWT 簽名驗證失敗 | 標準驗證流程 | 401 + 記錄警告 log |
| 同一帳號從多個異常地理位置登入 | 登入 IP 與 session 比對 | 記錄 + Phase 2 加入通知機制 |

---

## 7. 未來擴展（Phase 2+）

### 7.1 多裝置 Session 管理
- 允許使用者查看所有 active sessions
- 支援遠端登出特定裝置
- `GET /auth/sessions` → 列出所有 active sessions
- `DELETE /auth/sessions/:sid` → 登出特定 session

### 7.2 組織層級 Session 政策
- Org admin 可設定 session 最長存活時間
- 強制要求定期重新簽名（例如每 24 小時）
- IP 白名單限制

### 7.3 硬體錢包支援
- Ledger / Keystone 透過 Sui Wallet Adapter 原生支援
- 簽名流程不變，僅 UX 上需等待硬體確認

### 7.4 KYC 整合
- 在認證流程後加入 KYC 狀態檢查
- `user.kyc_status`: `none` → `pending` → `approved` / `rejected`
- 特定操作（如加入投審會）需 `kyc_status = approved`
