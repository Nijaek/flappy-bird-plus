# Flappy Bird Web + Accounts + Global Leaderboard + Shop — Project Plan

## 1) Tech stack + why it fits

### Frontend
- **Next.js (React) + TypeScript**
  - One codebase for game + auth + shop + leaderboard pages.
  - Strong routing and long-term maintainability.
- **Canvas 2D (lightweight game loop)**
  - Best "works everywhere" option (including iOS Safari) for broad browser support.
  - Small bundle size; avoids WebGL edge cases on older devices.
- **Tailwind CSS**
  - Fast UI build for menus, modals, shop, and leaderboard.

### Backend (on your VPS)
- **Next.js API Routes**
  - Use Next.js built-in API routes for all backend logic (single deployment, simpler ops).
  - If scaling requires separation later, extract to standalone Fastify service.
- **PostgreSQL**
  - Great for "store every run" + ranking queries + transactional shop purchases.
- **Prisma**
  - Type-safe DB access + migrations; faster iteration.
- **Auth.js (NextAuth)**
  - Handles Google SSO + Credentials + email verification and supports custom linking flows.
  - Use Auth.js's default Prisma adapter schema to avoid conflicts.

### Required Infrastructure
- **Redis**
  - Cache Top 100 leaderboard (refresh every 5-10 seconds) to reduce DB load.
  - Sorted set for O(log n) user rank lookups.
  - Rate-limiting counters (per-user and per-IP).
  - **Note**: With leaderboard queries on every game over, Redis is essential—not optional.

---

## 2) Product goals
- Flappy Bird recreation playable on **desktop + mobile web**, optimized for **broad browser support**.
- **Score per run:** pipes passed.
- **Points (currency):** after each run, user earns points equal to that run’s score; points persist for shop use.
- **Global leaderboard:** on game over show:
  - Top 100 scores
  - Your **global rank**, even if it’s 10,000+
- **Accounts:**
  - Guest play supported
  - Signup/login via Google SSO or email+password
  - Email verification required
  - If same email exists across methods: prompt to link (both directions)
- **Shop:** cosmetic-only (skins/trails/backgrounds)

---

## 3) Non-functional requirements

### Browser Compatibility
- Use Canvas 2D, input fallbacks (touch/click/keyboard), avoid fragile APIs.
- Mobile-specific handling:
  - Prevent double-tap zoom: `touch-action: manipulation`
  - Prevent pull-to-refresh: `overscroll-behavior: none`
  - Handle `visibilitychange` event (pause when tab hidden)
  - Test thoroughly on iOS Safari (notorious for quirks)

### Game Physics
- **Fixed timestep physics** (critical for fair gameplay):
  - Use 60 updates/sec with interpolation for rendering
  - Prevents variable frame rates from affecting gameplay
  - Ensures consistent experience across devices

### Audio Handling
- Mobile browsers block autoplay—require user interaction to unlock audio context
- Provide mute/volume controls in settings

### Security Requirements
- HTTPS/TLS required for all traffic
- CSRF protection: `SameSite=Strict` cookies + CSRF tokens for mutations
- Input sanitization: escape HTML in display names before rendering
- Session management: support "log out all devices" capability

### Anti-Cheat (server-side validation)
- Rate limiting: 1 run/3 seconds, 100 runs/hour per user, 500/hour per IP
- Timing validation (see Section 9 for details)
- Statistical outlier detection for suspicious patterns
- Flag suspicious runs for review rather than auto-blocking

### VPS Hosting
- Deploy behind Nginx with SSL termination
- Run Next.js + Postgres + Redis
- Configure proper backup schedule for Postgres

---

## 4) Core user journeys

### A) Guest play → optional upgrade
1. User lands on Play, starts immediately as **Guest**.
2. Game over shows leaderboard snapshot (Top 100). Guest rank is not persisted unless they sign up.
3. Prompt: “Create an account to save points + scores.”
4. If they sign up/log in: guest progress can be merged (see Merge rules).

### B) Signed-in play → submit run → rank
1. User plays → score increments by pipes passed.
2. Game over → client submits run `{score, durationMs}`.
3. Server:
   - validates run (cheap checks)
   - inserts run into `runs`
   - increments user `pointsBalance += score`
   - returns:
     - Top 100 leaderboard
     - User’s rank
     - Updated points balance

### C) Account linking (same email)
**Case 1: Credentials account exists → user tries Google SSO**
- After Google returns email, detect existing credentials user.
- Show modal: “We found an existing account with this email. Link Google login?”
- If yes: require **password confirmation** (or email OTP) → link.
- If no: cancel sign-in.

**Case 2: Google account exists → user tries Credentials signup**
- Detect email already owned by Google identity.
- Prompt: “This email uses Google login. Link a password too?”
- If yes: require Google login first (or active session) → set password.

### D) Email verification
- Credentials signup sends verification email with token.
- Until verified:
  - allow play (optional), but block shop purchases and/or leaderboard submissions (choose during implementation).
  - recommended MVP: allow play, but warn “verify to save runs + points”.

---

## 5) Ranking rules (recommendation)
Two options:

1) **Rank by best score (recommended)**
- Leaderboard Top 100 = highest best score per user.
- “Your rank” = rank of your best score globally.

2) **Rank by single-run score**
- Leaderboard Top 100 = highest run scores (multiple entries per user allowed).
- “Your rank” = rank of your latest run or best run.

**Recommendation:** Rank display by **best score per user**, while storing **every run** for history/analytics.

---

## 6) Data model (Postgres)

### Auth.js Compatibility Note
Use Auth.js's default Prisma adapter schema (`User`, `Account`, `Session`, `VerificationToken`) and extend with custom tables below. This avoids adapter conflicts.

### Tables

**Auth.js Default Tables (required)**
- **User** (Auth.js default, extended)
  - `id`, `name`, `email (unique)`, `emailVerified`, `image`
  - Extended fields:
    - `displayName (varchar 3-20)` — validated: alphanumeric + limited symbols
    - `pointsBalance (int default 0)`
    - `isGuest (boolean default false)`
    - `guestConvertedAt (timestamp nullable)`
    - `equippedSkinId`, `equippedTrailId`, `equippedBgId`
- **Account** (Auth.js default) — handles OAuth providers
- **Session** (Auth.js default) — manages user sessions
- **VerificationToken** (Auth.js default) — email verification

**Custom Game Tables**
- **runs**
  - `id`, `userId`, `score (int)`, `durationMs (int)`, `createdAt`
  - `runToken (uuid)` — generated at game start, prevents replay attacks
  - `ipHash`, `flagged (boolean)`, `flagReason` — abuse tracking
- **user_best_scores**
  - `userId (pk)`, `bestScore`, `achievedAt`
  - Maintained atomically on each run insert (trigger or transaction)
- **items**
  - `id`, `sku`, `name`, `type (skin|trail|bg)`, `pricePoints`, `active`
- **user_items**
  - `userId`, `itemId`, `unlockedAt`
- **point_transactions**
  - `id`, `userId`, `delta`, `reason (run|purchase|admin|guest_merge)`, `refId`, `createdAt`
- **password_reset_tokens**
  - `id`, `userId`, `tokenHash`, `expiresAt`, `usedAt`, `createdAt`
- **audit_logs**
  - `id`, `userId`, `action`, `details (jsonb)`, `ipHash`, `createdAt`
  - Track: admin actions, suspicious activity, account changes

### Display Name Validation Rules
- Length: 3-20 characters
- Allowed: alphanumeric, underscores, hyphens
- No leading/trailing spaces
- Profanity filter (basic word list or moderation queue)

### Indexes (important for "rank 10,000+")
- `user_best_scores(bestScore DESC)`
- `runs(userId, createdAt DESC)`
- `runs(score DESC)` — for run-based leaderboard queries
- `User(isGuest)` — for guest cleanup jobs

---

## 7) API design

### Auth (mostly handled by Auth.js)
- Auth.js handles: `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback/*`
- Custom endpoints:
  - `POST /api/auth/link/google` — link Google to existing credentials account
  - `POST /api/auth/link/credentials` — add password to existing Google account
  - `POST /api/auth/resend-verification` — re-send verification email
  - `POST /api/auth/reset-password` — initiate password reset
  - `POST /api/auth/reset-password/confirm` — complete password reset with token
  - `POST /api/auth/guest` — create guest session

### User
- `GET /api/users/me` — profile info, equipped cosmetics, points balance
- `PATCH /api/users/me` — update display name, settings
- `DELETE /api/users/me` — account deletion (GDPR compliance)
- `POST /api/users/me/logout-all` — invalidate all sessions

### Game / Leaderboard
- `POST /api/game/start`
  - Returns: `{ runToken }` — required for run submission
- `POST /api/runs/submit`
  - Input: `{ runToken, score, durationMs }`
  - Returns (optimized response):
    ```json
    {
      "top10": [{"rank": 1, "displayName": "...", "bestScore": 100}],
      "neighborhood": {
        "above": [{"rank": 148, "displayName": "...", "bestScore": 50}],
        "you": {"rank": 150, "bestScore": 48, "isNewBest": true},
        "below": [{"rank": 151, "displayName": "...", "bestScore": 47}]
      },
      "pointsEarned": 48,
      "pointsBalance": 1234
    }
    ```
- `GET /api/leaderboard?offset=0&limit=50` — paginated leaderboard
- `GET /api/leaderboard/me` — user's rank and neighborhood
- `GET /api/runs/history?limit=20` — user's run history

### Shop
- `GET /api/shop/items` — available items catalog
- `POST /api/shop/buy` — `{ itemId }`
- `POST /api/shop/equip` — `{ itemId }`
- `GET /api/inventory/me` — user's owned items

### Error Response Format
All errors return consistent structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": {}
  }
}
```

---

## 8) Password policy + verification
- Minimum **8 characters**
- Must include:
  - at least **1 uppercase**
  - at least **1 lowercase**
  - at least **1 number**
- Symbols supported (recommended).
- Email verification required for activating “save” features (exact gating decided in implementation).

---

## 9) Anti-cheat validation (server-side)

### Rate Limiting (Redis-backed)
- Per user: 1 run submission per 3 seconds, 100 runs per hour
- Per IP: 500 runs per hour (shared across guests)
- Exceeded limits return `429 Too Many Requests`

### Run Token Validation
- `POST /api/game/start` issues a `runToken` (UUID, expires in 10 minutes)
- `POST /api/runs/submit` requires valid, unused `runToken`
- Prevents replay attacks and arbitrary score submissions

### Timing Validation
- **Minimum time per score**: `durationMs >= score * MIN_PIPE_INTERVAL_MS`
  - Example: If pipes spawn every 1.5 seconds minimum, score of 10 requires at least 15,000ms
- **Maximum score per duration**: `score <= durationMs / MIN_PIPE_INTERVAL_MS`
- **Reasonable duration**: `durationMs <= 30 * 60 * 1000` (30 min max)

### Plausibility Checks
- `score >= 0` and `score <= 1000` (reasonable cap)
- `durationMs >= 1000` (at least 1 second of play)
- `runToken` was issued to the same user/session

### Statistical Outlier Detection
- Track user's historical score/duration ratio
- Flag runs where ratio is >3 standard deviations from user's mean
- Flag accounts that go from average scores to top 1% overnight

### Server-Authoritative Points
- Points earned = `score` (ignore any client-provided points)
- All point transactions logged in `point_transactions` table

### Abuse Handling
- **Soft flag**: Mark run as `flagged=true`, still count it, review later
- **Hard reject**: Return error, don't record (only for obvious violations)
- **Shadow ban** (optional): Accept submissions but exclude from public leaderboard

---

## 10) Guest merge rules (recommended MVP)
When a guest creates/logs into an account:
- Merge:
  - merge guest points into the user (optional but user-friendly)
  - do **not** merge all guest runs (or only merge last N runs) to keep signup fast

---

## 11) Milestones & deliverables

### Milestone 0 — Setup & Hosting
- Repo, CI/CD pipeline, env management (.env.local, .env.production)
- VPS: Nginx (SSL termination) + Next.js + Postgres + Redis
- Base Next.js app deployed with health check endpoint
- Prisma schema + initial migrations
- Basic logging infrastructure (structured JSON logs)
**Deliverable:** staging site running end-to-end with all services connected.

### Milestone 1 — Game MVP
- Canvas 2D rendering with fixed timestep physics (60 updates/sec)
- Bird physics: gravity, flap impulse, collision detection
- Pipe spawning, scrolling, gap generation
- Inputs: click/tap/spacebar with mobile touch handling
- Mobile optimizations: prevent zoom, pull-to-refresh, handle visibility changes
- Game over screen + restart loop
- Audio system with user-initiated unlock
- Performance validation: stable 60fps on target devices
**Deliverable:** playable game across desktop Chrome/Firefox/Safari + mobile iOS Safari/Chrome.
**Testing:** Manual testing on 3+ real mobile devices.

### Milestone 2a — Basic Authentication
- Auth.js setup with Prisma adapter
- Guest session creation (auto-assign on first visit)
- Credentials signup/login with password policy validation
- Google SSO integration
- Basic session management
**Deliverable:** users can create accounts, log in, maintain sessions.
**Testing:** Unit tests for auth flows, integration tests for API endpoints.

### Milestone 2b — Email Verification & Account Linking
- Email verification flow (send token + confirm)
- Password reset flow (request + confirm with token)
- Account linking: credentials → Google (with password confirmation)
- Account linking: Google → credentials (with session verification)
- "Logout all devices" functionality
- Account deletion (GDPR)
**Deliverable:** full auth system with linking, verification, and account management.
**Testing:** End-to-end tests for email flows (use test email service like Mailhog).

### Milestone 3 — Runs, Points, Leaderboard
- `POST /api/game/start` — issue run tokens
- `POST /api/runs/submit` — validate and record runs
- Anti-cheat validation (timing, plausibility, rate limits)
- Store every run, maintain `user_best_scores` atomically
- Redis caching for Top 100 (refresh every 5-10 seconds)
- User rank calculation via Redis sorted set
- Optimized leaderboard response (top 10 + neighborhood)
- Paginated leaderboard endpoint
**Deliverable:** game over shows top 10 + your rank + points earned.
**Testing:** Load test with simulated 100 concurrent users.

### Milestone 4 — Shop & Cosmetics
- Item catalog table + seed script with initial cosmetics
- Purchase flow with point balance validation
- Inventory management + equip/unequip
- Apply equipped cosmetics in game rendering (skins, trails, backgrounds)
- Point transaction logging
**Deliverable:** full loop: earn points → shop → buy → equip → see in-game.
**Testing:** Transaction integrity tests (concurrent purchases).

### Milestone 5 — Polish & Launch Hardening
- UI polish: loading states, error messages, skeleton screens
- Animation and audio toggles in settings
- Observability: structured logs, error tracking (Sentry or similar)
- Database: backup schedule, connection pooling, query optimization
- Redis: persistence configuration, memory limits
- Rate limiting tuning based on real traffic patterns
- Security audit: check OWASP top 10
**Deliverable:** production-ready deployment.

### Milestone 6 — Load Testing & Launch
- Load testing: simulate 1000 concurrent users
- Identify and fix bottlenecks (DB queries, Redis, memory)
- Stress test leaderboard queries at scale
- Document runbooks for common ops tasks
- Final security review
- Production deployment
**Deliverable:** live production site with monitoring.

---

## 12) Offline & Error Handling

### Network Failure During Run
- Game continues locally regardless of network state
- On game over, attempt submission:
  - If network fails: queue run locally (IndexedDB or localStorage)
  - Show message: "Score saved locally. Will sync when online."
  - On next app load with network: sync queued runs

### API Error States
- **Connection error**: "Unable to connect. Check your internet connection."
- **Rate limited (429)**: "Too many attempts. Please wait a moment."
- **Server error (5xx)**: "Something went wrong. Your progress is saved locally."
- **Auth expired**: Prompt re-login, preserve pending actions

### UI States
- All async operations show loading indicators
- Skeleton screens for leaderboard/shop while loading
- Retry buttons for failed operations
- Offline indicator in header when disconnected

---

## 13) Acceptance Criteria

### Game
- Stable 60fps on desktop and mobile devices (iPhone 8+, mid-range Android)
- Fixed timestep physics ensures consistent gameplay across devices
- Works in Chrome, Firefox, Safari (desktop + mobile), Edge
- Touch, click, and keyboard inputs all functional

### Leaderboard
- After each run: see top 10 + your rank (even at 10,000+)
- Leaderboard loads in <500ms (Redis cached)
- Rank updates reflect within 10 seconds of run submission

### Points & Shop
- Points increment by run score (server-authoritative)
- Shop displays owned/equipped status correctly
- Purchases deduct points atomically (no double-spend)
- Equipped cosmetics visible in-game immediately

### Authentication
- Guest play works with no friction
- Credentials signup enforces password policy
- Email verification blocks points/purchases until verified
- Google SSO works end-to-end
- Account linking prompts when email matches (both directions)
- Password reset flow works end-to-end
- Account deletion removes all user data

### Security
- All traffic over HTTPS
- Rate limiting prevents abuse
- Anti-cheat flags implausible runs
- No XSS vulnerabilities in display names
- Sessions properly invalidated on logout

---

## 14) Key Implementation Priorities

These items are critical and should not be deferred:

1. **Fixed timestep physics** — Without this, gameplay varies by device/frame rate
2. **Redis for leaderboard** — PostgreSQL alone won't scale for per-run queries
3. **Run tokens** — Essential anti-cheat; prevents arbitrary score submission
4. **Auth.js schema compatibility** — Use default adapter to avoid conflicts
5. **Password reset in MVP** — Users will forget passwords; can't defer this
6. **Account deletion** — GDPR requirement from day 1
7. **Mobile touch handling** — Must prevent zoom, scroll, and refresh gestures
8. **Offline run queueing** — Network drops happen; don't lose user progress
