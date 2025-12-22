# MVP Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the core backend for Flappy Bird Plus: authentication (guest, credentials, Google SSO), run submission with anti-cheat, and Redis-cached leaderboard.

**Architecture:** Next.js API routes handle all backend logic. PostgreSQL stores users, runs, and scores. Redis caches the Top 100 leaderboard and provides O(log n) rank lookups via sorted sets. Auth.js manages sessions and OAuth.

**Tech Stack:** Next.js 14+, Prisma ORM, PostgreSQL, Redis, Auth.js v5, bcrypt

---

## Phase 1: VPS Infrastructure Setup

### Task 1.1: Install PostgreSQL on VPS

**Context:** PostgreSQL will store all persistent data (users, runs, scores, items).

**Step 1: SSH into VPS and install PostgreSQL**

```bash
ssh your-vps

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Step 2: Create database and user**

```bash
sudo -u postgres psql

# In psql:
CREATE USER flappybird WITH PASSWORD 'your-secure-password-here';
CREATE DATABASE flappybird_db OWNER flappybird;
GRANT ALL PRIVILEGES ON DATABASE flappybird_db TO flappybird;
\q
```

**Step 3: Configure PostgreSQL for remote connections**

```bash
# Edit postgresql.conf
sudo nano /etc/postgresql/*/main/postgresql.conf
# Change: listen_addresses = 'localhost'
# To: listen_addresses = '*'

# Edit pg_hba.conf to allow your dev IP
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Add line (replace YOUR_DEV_IP):
# host    flappybird_db    flappybird    YOUR_DEV_IP/32    scram-sha-256

# Restart PostgreSQL
sudo systemctl restart postgresql
```

**Step 4: Open firewall port (if using ufw)**

```bash
sudo ufw allow 5432/tcp
```

**Step 5: Test connection from local machine**

```bash
psql -h YOUR_VPS_IP -U flappybird -d flappybird_db
# Enter password when prompted
# Should connect successfully
\q
```

---

### Task 1.2: Install Redis on VPS

**Context:** Redis caches leaderboard data and handles rate limiting.

**Step 1: Install Redis**

```bash
ssh your-vps

sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Step 2: Configure Redis for remote access**

```bash
sudo nano /etc/redis/redis.conf

# Find and change:
# bind 127.0.0.1 ::1
# To:
# bind 0.0.0.0

# Set a password (find requirepass line):
requirepass your-redis-password-here

# Save and restart
sudo systemctl restart redis-server
```

**Step 3: Open firewall port**

```bash
sudo ufw allow 6379/tcp
```

**Step 4: Test connection from local machine**

```bash
redis-cli -h YOUR_VPS_IP -a your-redis-password-here ping
# Should return: PONG
```

---

### Task 1.3: Create Google OAuth Credentials

**Context:** Needed for Google SSO login.

**Step 1: Go to Google Cloud Console**

1. Navigate to https://console.cloud.google.com/
2. Create a new project or select existing one
3. Name it "Flappy Bird Plus" or similar

**Step 2: Enable OAuth consent screen**

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" user type
3. Fill in:
   - App name: "Flappy Bird Plus"
   - User support email: your email
   - Developer contact: your email
4. Skip scopes (defaults are fine)
5. Add test users if in testing mode

**Step 3: Create OAuth credentials**

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Application type: "Web application"
4. Name: "Flappy Bird Plus Web"
5. Authorized JavaScript origins:
   - `http://localhost:3000`
   - `https://your-production-domain.com`
6. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-production-domain.com/api/auth/callback/google`
7. Click "Create"

**Step 4: Save credentials**

Copy the Client ID and Client Secret - you'll need these for `.env.local`

---

## Phase 2: Project Backend Setup

### Task 2.1: Install Backend Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Prisma and database packages**

```bash
npm install prisma @prisma/client
npm install next-auth@beta @auth/prisma-adapter
npm install bcryptjs
npm install ioredis
npm install uuid
npm install -D @types/bcryptjs @types/uuid
```

**Step 2: Initialize Prisma**

```bash
npx prisma init
```

This creates `prisma/schema.prisma` and `.env`

**Step 3: Commit**

```bash
git add package.json package-lock.json prisma/
git commit -m "chore: add backend dependencies (prisma, auth, redis)"
```

---

### Task 2.2: Configure Environment Variables

**Files:**
- Modify: `.env` (gitignored, local only)
- Create: `.env.example`

**Step 1: Create .env.example (committed to git)**

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/database"

# Redis
REDIS_URL="redis://:password@host:6379"

# Auth.js
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_URL="http://localhost:3000"

# Google OAuth
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

**Step 2: Create actual .env.local with real values**

```env
# Database (your VPS)
DATABASE_URL="postgresql://flappybird:your-secure-password@YOUR_VPS_IP:5432/flappybird_db"

# Redis (your VPS)
REDIS_URL="redis://:your-redis-password@YOUR_VPS_IP:6379"

# Auth.js (generate secret with: openssl rand -base64 32)
AUTH_SECRET="your-generated-secret-here"
AUTH_URL="http://localhost:3000"

# Google OAuth (from Google Cloud Console)
AUTH_GOOGLE_ID="your-google-client-id.apps.googleusercontent.com"
AUTH_GOOGLE_SECRET="your-google-client-secret"
```

**Step 3: Add .env.local to .gitignore**

```bash
echo ".env.local" >> .gitignore
echo ".env" >> .gitignore
```

**Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add environment variable template"
```

---

### Task 2.3: Create Prisma Schema

**Files:**
- Create: `prisma/schema.prisma`

**Step 1: Write the complete schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================================
// Auth.js Required Tables
// ============================================================================

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?

  // Extended fields for game
  displayName   String?   @db.VarChar(20)
  pointsBalance Int       @default(0)
  isGuest       Boolean   @default(false)
  guestConvertedAt DateTime?

  // Equipped cosmetics (future use)
  equippedSkinId String?
  equippedTrailId String?
  equippedBgId   String?

  // Relations
  accounts      Account[]
  sessions      Session[]
  runs          Run[]
  bestScore     UserBestScore?
  pointTransactions PointTransaction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isGuest])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// ============================================================================
// Game Tables
// ============================================================================

model Run {
  id         String   @id @default(cuid())
  userId     String
  score      Int
  durationMs Int
  runToken   String   @unique
  ipHash     String?
  flagged    Boolean  @default(false)
  flagReason String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([score(sort: Desc)])
}

model UserBestScore {
  userId     String   @id
  bestScore  Int
  achievedAt DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([bestScore(sort: Desc)])
}

model RunToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([token])
  @@index([expiresAt])
}

model PointTransaction {
  id        String   @id @default(cuid())
  userId    String
  delta     Int
  reason    String   // 'run' | 'purchase' | 'admin' | 'guest_merge'
  refId     String?  // Reference to run ID or item ID

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([userId, createdAt(sort: Desc)])
}

// ============================================================================
// Shop Tables (for future use)
// ============================================================================

model Item {
  id          String   @id @default(cuid())
  sku         String   @unique
  name        String
  type        String   // 'skin' | 'trail' | 'bg'
  pricePoints Int
  active      Boolean  @default(true)

  userItems   UserItem[]

  createdAt DateTime @default(now())
}

model UserItem {
  id       String @id @default(cuid())
  userId   String
  itemId   String

  item Item @relation(fields: [itemId], references: [id])

  unlockedAt DateTime @default(now())

  @@unique([userId, itemId])
}
```

**Step 2: Generate Prisma client and push schema**

```bash
npx prisma generate
npx prisma db push
```

**Step 3: Verify tables were created**

```bash
npx prisma studio
# Opens browser - verify all tables exist
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Prisma schema for auth and game data"
```

---

### Task 2.4: Create Prisma Client Singleton

**Files:**
- Create: `src/lib/prisma.ts`

**Step 1: Create the singleton**

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

**Step 2: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "feat: add Prisma client singleton"
```

---

### Task 2.5: Create Redis Client

**Files:**
- Create: `src/lib/redis.ts`

**Step 1: Create the Redis client**

```typescript
import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL environment variable is not set');
  }
  return new Redis(url);
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Leaderboard keys
export const LEADERBOARD_KEY = 'leaderboard:best_scores';
export const LEADERBOARD_CACHE_KEY = 'leaderboard:top100:cache';
export const LEADERBOARD_CACHE_TTL = 10; // seconds
```

**Step 2: Commit**

```bash
git add src/lib/redis.ts
git commit -m "feat: add Redis client with leaderboard keys"
```

---

## Phase 3: Authentication

### Task 3.1: Configure Auth.js

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Step 1: Create auth configuration**

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user with password
        const account = await prisma.account.findFirst({
          where: {
            provider: 'credentials',
            user: { email },
          },
          include: { user: true },
        });

        if (!account || !account.access_token) {
          return null;
        }

        // Verify password (stored in access_token field for credentials)
        const isValid = await bcrypt.compare(password, account.access_token);
        if (!isValid) {
          return null;
        }

        return {
          id: account.user.id,
          email: account.user.email,
          name: account.user.name,
          image: account.user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
});
```

**Step 2: Create route handler**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

**Step 3: Extend NextAuth types**

```typescript
// src/types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
```

**Step 4: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/types/
git commit -m "feat: configure Auth.js with Google and credentials providers"
```

---

### Task 3.2: Create Credentials Signup API

**Files:**
- Create: `src/app/api/auth/signup/route.ts`

**Step 1: Create signup endpoint**

```typescript
// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

// Password validation
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
}

// Display name validation
function validateDisplayName(name: string): { valid: boolean; error?: string } {
  if (name.length < 3 || name.length > 20) {
    return { valid: false, error: 'Display name must be 3-20 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return { valid: false, error: 'Display name can only contain letters, numbers, underscores, and hyphens' };
  }
  return { valid: true };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid email address' } },
        { status: 400 }
      );
    }

    // Validate password
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: passwordCheck.error } },
        { status: 400 }
      );
    }

    // Validate display name
    const nameCheck = validateDisplayName(displayName);
    if (!nameCheck.valid) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: nameCheck.error } },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' } },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user and credentials account in transaction
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          name: displayName,
          displayName,
        },
      });

      // Store password hash in Account's access_token field
      await tx.account.create({
        data: {
          userId: newUser.id,
          type: 'credentials',
          provider: 'credentials',
          providerAccountId: newUser.id,
          access_token: hashedPassword,
        },
      });

      return newUser;
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/signup/
git commit -m "feat: add credentials signup API with validation"
```

---

### Task 3.3: Create Guest Session API

**Files:**
- Create: `src/app/api/auth/guest/route.ts`

**Step 1: Create guest session endpoint**

```typescript
// src/app/api/auth/guest/route.ts
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/lib/prisma';
import { signIn } from '@/lib/auth';

export async function POST() {
  try {
    // Create guest user
    const guestId = uuidv4();
    const guestName = `Guest_${guestId.slice(0, 8)}`;

    const user = await prisma.user.create({
      data: {
        id: guestId,
        name: guestName,
        displayName: guestName,
        isGuest: true,
      },
    });

    // Create a session token for the guest
    const sessionToken = uuidv4();
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.session.create({
      data: {
        sessionToken,
        userId: user.id,
        expires,
      },
    });

    // Return session info (client will store this)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        displayName: user.displayName,
        isGuest: true,
      },
      sessionToken,
      expires: expires.toISOString(),
    });
  } catch (error) {
    console.error('Guest session error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to create guest session' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/auth/guest/
git commit -m "feat: add guest session creation API"
```

---

### Task 3.4: Create User Profile API

**Files:**
- Create: `src/app/api/users/me/route.ts`

**Step 1: Create profile endpoint**

```typescript
// src/app/api/users/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        displayName: true,
        pointsBalance: true,
        isGuest: true,
        equippedSkinId: true,
        equippedTrailId: true,
        equippedBgId: true,
        bestScore: {
          select: {
            bestScore: true,
            achievedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'User not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch profile' } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { displayName } = body;

    // Validate display name if provided
    if (displayName !== undefined) {
      if (displayName.length < 3 || displayName.length > 20) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Display name must be 3-20 characters' } },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(displayName)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Display name contains invalid characters' } },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(displayName !== undefined && { displayName }),
      },
      select: {
        id: true,
        displayName: true,
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to update profile' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/users/
git commit -m "feat: add user profile GET and PATCH endpoints"
```

---

## Phase 4: Game API (Runs & Scoring)

### Task 4.1: Create Run Token API (Game Start)

**Files:**
- Create: `src/app/api/game/start/route.ts`

**Step 1: Create game start endpoint**

```typescript
// src/app/api/game/start/route.ts
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

// Rate limit: 1 game start per 3 seconds per user
const RATE_LIMIT_WINDOW = 3; // seconds

export async function POST() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Check rate limit
    const rateLimitKey = `ratelimit:gamestart:${userId}`;
    const lastStart = await redis.get(rateLimitKey);

    if (lastStart) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Please wait before starting another game' } },
        { status: 429 }
      );
    }

    // Set rate limit
    await redis.setex(rateLimitKey, RATE_LIMIT_WINDOW, '1');

    // Generate run token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database
    await prisma.runToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return NextResponse.json({
      runToken: token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Game start error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to start game' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/game/
git commit -m "feat: add game start API with run token generation"
```

---

### Task 4.2: Create Run Submission API

**Files:**
- Create: `src/app/api/runs/submit/route.ts`

**Step 1: Create run submission endpoint with anti-cheat validation**

```typescript
// src/app/api/runs/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY } from '@/lib/redis';
import crypto from 'crypto';

// Anti-cheat constants
const MIN_PIPE_INTERVAL_MS = 1500; // Minimum 1.5 seconds per pipe
const MAX_SCORE = 1000;
const MAX_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MIN_DURATION_MS = 1000; // 1 second minimum

// Rate limits
const RUNS_PER_HOUR_USER = 100;
const RUNS_PER_HOUR_IP = 500;

function hashIP(ip: string): string {
  return crypto.createHash('sha256').update(ip + process.env.AUTH_SECRET).digest('hex').slice(0, 16);
}

interface ValidationResult {
  valid: boolean;
  flagged: boolean;
  flagReason?: string;
}

function validateRun(score: number, durationMs: number): ValidationResult {
  // Basic bounds checks
  if (score < 0 || score > MAX_SCORE) {
    return { valid: false, flagged: true, flagReason: 'score_out_of_bounds' };
  }

  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    return { valid: false, flagged: true, flagReason: 'duration_out_of_bounds' };
  }

  // Timing validation: score should be achievable in given time
  const minRequiredTime = score * MIN_PIPE_INTERVAL_MS;
  if (durationMs < minRequiredTime) {
    return { valid: false, flagged: true, flagReason: 'impossible_timing' };
  }

  // Soft flag: unusually fast scoring (flag but accept)
  const maxExpectedScore = Math.floor(durationMs / MIN_PIPE_INTERVAL_MS);
  if (score > maxExpectedScore * 0.95) {
    return { valid: true, flagged: true, flagReason: 'suspiciously_fast' };
  }

  return { valid: true, flagged: false };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const ipHash = hashIP(ip);

    // Check rate limits
    const userRateKey = `ratelimit:runs:user:${userId}`;
    const ipRateKey = `ratelimit:runs:ip:${ipHash}`;

    const [userRuns, ipRuns] = await Promise.all([
      redis.incr(userRateKey),
      redis.incr(ipRateKey),
    ]);

    // Set expiry on first increment
    if (userRuns === 1) await redis.expire(userRateKey, 3600);
    if (ipRuns === 1) await redis.expire(ipRateKey, 3600);

    if (userRuns > RUNS_PER_HOUR_USER) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many runs. Please try again later.' } },
        { status: 429 }
      );
    }

    if (ipRuns > RUNS_PER_HOUR_IP) {
      return NextResponse.json(
        { error: { code: 'RATE_LIMITED', message: 'Too many requests from this network.' } },
        { status: 429 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const { runToken, score, durationMs } = body;

    if (!runToken || typeof score !== 'number' || typeof durationMs !== 'number') {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid request body' } },
        { status: 400 }
      );
    }

    // Validate run token
    const tokenRecord = await prisma.runToken.findUnique({
      where: { token: runToken },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Invalid or expired run token' } },
        { status: 400 }
      );
    }

    if (tokenRecord.userId !== userId) {
      return NextResponse.json(
        { error: { code: 'INVALID_TOKEN', message: 'Token does not belong to this user' } },
        { status: 403 }
      );
    }

    if (tokenRecord.used) {
      return NextResponse.json(
        { error: { code: 'TOKEN_USED', message: 'Run token has already been used' } },
        { status: 400 }
      );
    }

    if (tokenRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: { code: 'TOKEN_EXPIRED', message: 'Run token has expired' } },
        { status: 400 }
      );
    }

    // Validate run (anti-cheat)
    const validation = validateRun(score, durationMs);

    if (!validation.valid) {
      // Mark token as used even for invalid runs
      await prisma.runToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      return NextResponse.json(
        { error: { code: 'INVALID_RUN', message: 'Run validation failed' } },
        { status: 400 }
      );
    }

    // Process run in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.runToken.update({
        where: { id: tokenRecord.id },
        data: { used: true },
      });

      // Create run record
      const run = await tx.run.create({
        data: {
          userId,
          score,
          durationMs,
          runToken,
          ipHash,
          flagged: validation.flagged,
          flagReason: validation.flagReason,
        },
      });

      // Update user points
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          pointsBalance: { increment: score },
        },
      });

      // Log point transaction
      await tx.pointTransaction.create({
        data: {
          userId,
          delta: score,
          reason: 'run',
          refId: run.id,
        },
      });

      // Update best score if needed
      const currentBest = await tx.userBestScore.findUnique({
        where: { userId },
      });

      let isNewBest = false;
      if (!currentBest || score > currentBest.bestScore) {
        isNewBest = true;
        await tx.userBestScore.upsert({
          where: { userId },
          create: {
            userId,
            bestScore: score,
            achievedAt: new Date(),
          },
          update: {
            bestScore: score,
            achievedAt: new Date(),
          },
        });
      }

      return {
        run,
        user,
        isNewBest,
        bestScore: isNewBest ? score : currentBest?.bestScore || score,
      };
    });

    // Update Redis leaderboard (async, don't wait)
    redis.zadd(LEADERBOARD_KEY, result.bestScore, userId).catch(console.error);

    // Get user's rank
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const userRank = rank !== null ? rank + 1 : null;

    // Get top 10
    const top10Data = await redis.zrevrange(LEADERBOARD_KEY, 0, 9, 'WITHSCORES');
    const top10UserIds = top10Data.filter((_, i) => i % 2 === 0);

    const top10Users = await prisma.user.findMany({
      where: { id: { in: top10UserIds } },
      select: { id: true, displayName: true },
    });

    const top10 = top10UserIds.map((id, i) => {
      const user = top10Users.find(u => u.id === id);
      return {
        rank: i + 1,
        displayName: user?.displayName || 'Unknown',
        bestScore: parseInt(top10Data[i * 2 + 1]),
      };
    });

    return NextResponse.json({
      top10,
      you: {
        rank: userRank,
        bestScore: result.bestScore,
        isNewBest: result.isNewBest,
      },
      pointsEarned: score,
      pointsBalance: result.user.pointsBalance,
    });
  } catch (error) {
    console.error('Run submission error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to submit run' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/runs/
git commit -m "feat: add run submission API with anti-cheat validation"
```

---

## Phase 5: Leaderboard

### Task 5.1: Create Leaderboard API

**Files:**
- Create: `src/app/api/leaderboard/route.ts`
- Create: `src/app/api/leaderboard/me/route.ts`

**Step 1: Create paginated leaderboard endpoint**

```typescript
// src/app/api/leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY, LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL } from '@/lib/redis';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    // For top 100, try cache first
    if (offset === 0 && limit <= 100) {
      const cached = await redis.get(LEADERBOARD_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return NextResponse.json({
          leaderboard: parsed.slice(0, limit),
          total: await redis.zcard(LEADERBOARD_KEY),
          offset,
          limit,
        });
      }
    }

    // Get from Redis sorted set
    const end = offset + limit - 1;
    const data = await redis.zrevrange(LEADERBOARD_KEY, offset, end, 'WITHSCORES');

    if (data.length === 0) {
      return NextResponse.json({
        leaderboard: [],
        total: 0,
        offset,
        limit,
      });
    }

    // Parse user IDs and scores
    const entries: { userId: string; score: number }[] = [];
    for (let i = 0; i < data.length; i += 2) {
      entries.push({
        userId: data[i],
        score: parseInt(data[i + 1]),
      });
    }

    // Fetch user display names
    const users = await prisma.user.findMany({
      where: { id: { in: entries.map(e => e.userId) } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    const leaderboard = entries.map((entry, i) => ({
      rank: offset + i + 1,
      displayName: userMap.get(entry.userId) || 'Unknown',
      bestScore: entry.score,
    }));

    // Cache top 100 if this was a top query
    if (offset === 0 && limit >= 100) {
      await redis.setex(LEADERBOARD_CACHE_KEY, LEADERBOARD_CACHE_TTL, JSON.stringify(leaderboard.slice(0, 100)));
    }

    const total = await redis.zcard(LEADERBOARD_KEY);

    return NextResponse.json({
      leaderboard,
      total,
      offset,
      limit,
    });
  } catch (error) {
    console.error('Leaderboard fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch leaderboard' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Create user rank endpoint**

```typescript
// src/app/api/leaderboard/me/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redis, LEADERBOARD_KEY } from '@/lib/redis';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user's rank from Redis
    const rank = await redis.zrevrank(LEADERBOARD_KEY, userId);
    const score = await redis.zscore(LEADERBOARD_KEY, userId);

    if (rank === null || score === null) {
      // User hasn't played yet or not on leaderboard
      return NextResponse.json({
        rank: null,
        bestScore: null,
        neighborhood: null,
      });
    }

    const userRank = rank + 1;
    const bestScore = parseInt(score);

    // Get neighborhood (2 above, 2 below)
    const start = Math.max(0, rank - 2);
    const end = rank + 2;

    const neighborData = await redis.zrevrange(LEADERBOARD_KEY, start, end, 'WITHSCORES');

    const neighborEntries: { userId: string; score: number; rank: number }[] = [];
    for (let i = 0; i < neighborData.length; i += 2) {
      neighborEntries.push({
        userId: neighborData[i],
        score: parseInt(neighborData[i + 1]),
        rank: start + (i / 2) + 1,
      });
    }

    // Fetch display names
    const users = await prisma.user.findMany({
      where: { id: { in: neighborEntries.map(e => e.userId) } },
      select: { id: true, displayName: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.displayName]));

    const neighborhood = {
      above: neighborEntries
        .filter(e => e.rank < userRank)
        .map(e => ({
          rank: e.rank,
          displayName: userMap.get(e.userId) || 'Unknown',
          bestScore: e.score,
        })),
      you: {
        rank: userRank,
        bestScore,
      },
      below: neighborEntries
        .filter(e => e.rank > userRank)
        .map(e => ({
          rank: e.rank,
          displayName: userMap.get(e.userId) || 'Unknown',
          bestScore: e.score,
        })),
    };

    return NextResponse.json({
      rank: userRank,
      bestScore,
      neighborhood,
    });
  } catch (error) {
    console.error('Leaderboard me fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch your rank' } },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/leaderboard/
git commit -m "feat: add leaderboard API with caching and user rank"
```

---

### Task 5.2: Create Leaderboard Sync Script

**Files:**
- Create: `scripts/sync-leaderboard.ts`

**Context:** This script syncs PostgreSQL `user_best_scores` to Redis. Run on initial setup or to recover from Redis data loss.

**Step 1: Create sync script**

```typescript
// scripts/sync-leaderboard.ts
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

const LEADERBOARD_KEY = 'leaderboard:best_scores';

async function syncLeaderboard() {
  console.log('Starting leaderboard sync...');

  // Clear existing leaderboard
  await redis.del(LEADERBOARD_KEY);

  // Fetch all best scores
  const bestScores = await prisma.userBestScore.findMany({
    select: {
      userId: true,
      bestScore: true,
    },
  });

  console.log(`Found ${bestScores.length} users with scores`);

  if (bestScores.length === 0) {
    console.log('No scores to sync');
    return;
  }

  // Add to Redis in batches
  const BATCH_SIZE = 1000;
  for (let i = 0; i < bestScores.length; i += BATCH_SIZE) {
    const batch = bestScores.slice(i, i + BATCH_SIZE);
    const pipeline = redis.pipeline();

    for (const entry of batch) {
      pipeline.zadd(LEADERBOARD_KEY, entry.bestScore, entry.userId);
    }

    await pipeline.exec();
    console.log(`Synced ${Math.min(i + BATCH_SIZE, bestScores.length)} / ${bestScores.length}`);
  }

  const total = await redis.zcard(LEADERBOARD_KEY);
  console.log(`Sync complete. ${total} entries in leaderboard.`);

  await prisma.$disconnect();
  await redis.quit();
}

syncLeaderboard().catch((error) => {
  console.error('Sync failed:', error);
  process.exit(1);
});
```

**Step 2: Add script to package.json**

Add to `scripts` in `package.json`:
```json
"sync-leaderboard": "npx tsx scripts/sync-leaderboard.ts"
```

**Step 3: Commit**

```bash
git add scripts/ package.json
git commit -m "feat: add leaderboard sync script for Redis recovery"
```

---

## Phase 6: Run History

### Task 6.1: Create Run History API

**Files:**
- Create: `src/app/api/runs/history/route.ts`

**Step 1: Create run history endpoint**

```typescript
// src/app/api/runs/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const cursor = searchParams.get('cursor');

    const runs = await prisma.run.findMany({
      where: {
        userId: session.user.id,
        ...(cursor && { id: { lt: cursor } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to determine if there's a next page
      select: {
        id: true,
        score: true,
        durationMs: true,
        createdAt: true,
      },
    });

    const hasMore = runs.length > limit;
    const results = hasMore ? runs.slice(0, limit) : runs;
    const nextCursor = hasMore ? results[results.length - 1].id : null;

    return NextResponse.json({
      runs: results,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error('Run history fetch error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to fetch run history' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/runs/history/
git commit -m "feat: add paginated run history API"
```

---

## Phase 7: Health Check & Cleanup

### Task 7.1: Create Health Check Endpoint

**Files:**
- Create: `src/app/api/health/route.ts`

**Step 1: Create health check**

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';

export async function GET() {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      database: 'up' | 'down';
      redis: 'up' | 'down';
    };
    timestamp: string;
  } = {
    status: 'healthy',
    services: {
      database: 'down',
      redis: 'down',
    },
    timestamp: new Date().toISOString(),
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'up';
  } catch {
    health.status = 'unhealthy';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'up';
  } catch {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
```

**Step 2: Commit**

```bash
git add src/app/api/health/
git commit -m "feat: add health check endpoint for database and redis"
```

---

### Task 7.2: Create Token Cleanup Script

**Files:**
- Create: `scripts/cleanup-tokens.ts`

**Context:** Cron job to clean up expired run tokens. Run hourly.

**Step 1: Create cleanup script**

```typescript
// scripts/cleanup-tokens.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupTokens() {
  console.log('Starting token cleanup...');

  const result = await prisma.runToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { used: true, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }, // Used tokens older than 24h
      ],
    },
  });

  console.log(`Deleted ${result.count} expired/used tokens`);

  await prisma.$disconnect();
}

cleanupTokens().catch((error) => {
  console.error('Cleanup failed:', error);
  process.exit(1);
});
```

**Step 2: Add script to package.json**

Add to `scripts` in `package.json`:
```json
"cleanup-tokens": "npx tsx scripts/cleanup-tokens.ts"
```

**Step 3: Commit**

```bash
git add scripts/ package.json
git commit -m "feat: add token cleanup script for maintenance"
```

---

## Phase 8: Integration Testing

### Task 8.1: Test Full Flow Manually

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Test health endpoint**

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"healthy","services":{"database":"up","redis":"up"},...}
```

**Step 3: Test signup**

```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123","displayName":"TestPlayer"}'
# Expected: {"success":true,"user":{...}}
```

**Step 4: Test Google OAuth**

1. Open browser to `http://localhost:3000/api/auth/signin`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify redirect and session

**Step 5: Test game flow (with authenticated session)**

```bash
# Get session cookie from browser dev tools, then:

# Start game
curl -X POST http://localhost:3000/api/game/start \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
# Expected: {"runToken":"uuid","expiresAt":"..."}

# Submit run
curl -X POST http://localhost:3000/api/runs/submit \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN" \
  -d '{"runToken":"FROM_ABOVE","score":10,"durationMs":20000}'
# Expected: {"top10":[...],"you":{"rank":1,"bestScore":10,...},...}
```

**Step 6: Test leaderboard**

```bash
curl http://localhost:3000/api/leaderboard
# Expected: {"leaderboard":[...],"total":1,...}

curl http://localhost:3000/api/leaderboard/me \
  -H "Cookie: next-auth.session-token=YOUR_TOKEN"
# Expected: {"rank":1,"bestScore":10,"neighborhood":{...}}
```

---

## Summary: API Endpoints Created

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Service health check |
| `/api/auth/[...nextauth]` | GET/POST | Auth.js handlers |
| `/api/auth/signup` | POST | Credentials signup |
| `/api/auth/guest` | POST | Create guest session |
| `/api/users/me` | GET/PATCH | User profile |
| `/api/game/start` | POST | Get run token |
| `/api/runs/submit` | POST | Submit run with anti-cheat |
| `/api/runs/history` | GET | Paginated run history |
| `/api/leaderboard` | GET | Paginated leaderboard |
| `/api/leaderboard/me` | GET | User's rank & neighborhood |

---

## Next Steps After MVP

1. **Frontend integration** - Connect game to APIs
2. **Game Over screen** - Display leaderboard results
3. **Auth UI** - Signin/signup pages
4. **Shop (Milestone 4)** - Items, purchases, cosmetics
5. **Production deployment** - Nginx config, PM2, SSL
