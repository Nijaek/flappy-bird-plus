# Auth Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a blocking sign-in modal that appears for unauthenticated users with Google SSO, email/password, and guest options.

**Architecture:** HTML-based modal component styled to match the pixel-art game theme. Uses NextAuth's `signIn()` for authentication, with a username selection step for new Google users. State machine pattern for modal flow.

**Tech Stack:** Next.js 16, React 19, NextAuth v5, Tailwind CSS, Prisma

---

### Task 1: Add Unique Constraint to displayName

**Files:**
- Modify: `prisma/schema.prisma:21`

**Step 1: Update schema**

In `prisma/schema.prisma`, change line 21 from:
```prisma
displayName   String?   @db.VarChar(20)
```
to:
```prisma
displayName   String?   @unique @db.VarChar(20)
```

**Step 2: Generate migration**

Run: `npx prisma db push`

Expected: Schema synced successfully (or migration created)

**Step 3: Regenerate Prisma client**

Run: `npx prisma generate`

Expected: Prisma Client generated successfully

**Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add unique constraint to displayName for username validation"
```

---

### Task 2: Create Check Username API Endpoint

**Files:**
- Create: `src/app/api/auth/check-username/route.ts`

**Step 1: Create the endpoint**

Create `src/app/api/auth/check-username/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    // Validate format
    if (name.length < 3 || name.length > 20) {
      return NextResponse.json({
        available: false,
        reason: 'Username must be 3-20 characters',
      });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json({
        available: false,
        reason: 'Only letters, numbers, underscores, and hyphens allowed',
      });
    }

    // Check database
    const existing = await prisma.user.findFirst({
      where: {
        displayName: {
          equals: name,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    return NextResponse.json({
      available: !existing,
      reason: existing ? 'Username is already taken' : null,
    });
  } catch (error) {
    console.error('Check username error:', error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Failed to check username' } },
      { status: 500 }
    );
  }
}
```

**Step 2: Test manually**

Run dev server: `npm run dev`

Test in browser or curl:
- `GET /api/auth/check-username?name=test123` → should return `{ available: true/false, reason: null/string }`
- `GET /api/auth/check-username?name=ab` → should return `{ available: false, reason: "Username must be 3-20 characters" }`

**Step 3: Commit**

```bash
git add src/app/api/auth/check-username/route.ts
git commit -m "feat: add check-username API endpoint for availability validation"
```

---

### Task 3: Create AuthModal CSS Styles

**Files:**
- Create: `src/components/AuthModal.css`

**Step 1: Create the CSS file**

Create `src/components/AuthModal.css`:

```css
/* Auth Modal - Pixel Art Game Theme */

.auth-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.auth-modal {
  background: #DEB858;
  border: 4px solid #8B6914;
  padding: 24px;
  max-width: 320px;
  width: 90%;
  box-shadow:
    4px 4px 0 #543810,
    -2px -2px 0 #F8E8A8 inset;
}

.auth-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 20px;
  text-shadow:
    2px 2px 0 #543810,
    -1px -1px 0 #543810,
    1px -1px 0 #543810,
    -1px 1px 0 #543810;
}

.auth-divider {
  display: flex;
  align-items: center;
  margin: 16px 0;
  gap: 12px;
}

.auth-divider-line {
  flex: 1;
  height: 2px;
  background: #8B6914;
}

.auth-divider-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #543810;
}

/* Buttons */
.auth-btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  width: 100%;
  padding: 12px 16px;
  border: 3px solid #8B6914;
  background: #F8F0D8;
  color: #543810;
  cursor: pointer;
  transition: transform 0.1s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.auth-btn:hover:not(:disabled) {
  background: #FFF8E8;
}

.auth-btn:active:not(:disabled) {
  transform: translateY(2px);
}

.auth-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.auth-btn-google {
  background: #FFFFFF;
}

.auth-btn-guest {
  background: transparent;
  border-style: dashed;
}

.auth-btn-guest:hover:not(:disabled) {
  background: rgba(248, 240, 216, 0.3);
}

/* Form Elements */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.auth-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #543810;
}

.auth-input {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  padding: 10px 12px;
  border: 3px solid #8B6914;
  background: #F8F0D8;
  color: #543810;
  outline: none;
}

.auth-input:focus {
  border-color: #F87820;
  box-shadow: 0 0 0 2px rgba(248, 120, 32, 0.3);
}

.auth-input-error {
  border-color: #E85858;
}

.auth-error {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #E85858;
  margin-top: 2px;
}

.auth-form-error {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #E85858;
  text-align: center;
  padding: 8px;
  background: rgba(232, 88, 88, 0.1);
  border: 2px solid #E85858;
}

/* Toggle Link */
.auth-toggle {
  text-align: center;
  margin-top: 12px;
}

.auth-toggle-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #543810;
}

.auth-toggle-link {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  color: #F87820;
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.auth-toggle-link:hover {
  color: #D85020;
}

/* Username Availability */
.auth-username-status {
  font-family: 'Press Start 2P', monospace;
  font-size: 7px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.auth-username-available {
  color: #58A028;
}

.auth-username-taken {
  color: #E85858;
}

.auth-username-checking {
  color: #8B6914;
}

/* Success State */
.auth-success {
  text-align: center;
  padding: 20px;
}

.auth-success-text {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: #FFFFFF;
  text-shadow:
    2px 2px 0 #543810,
    -1px -1px 0 #543810;
}

/* Google Icon */
.auth-google-icon {
  width: 18px;
  height: 18px;
}

/* Loading Spinner */
.auth-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid #8B6914;
  border-top-color: transparent;
  border-radius: 50%;
  animation: auth-spin 0.8s linear infinite;
}

@keyframes auth-spin {
  to { transform: rotate(360deg); }
}
```

**Step 2: Commit**

```bash
git add src/components/AuthModal.css
git commit -m "feat: add AuthModal CSS with pixel-art game theme styling"
```

---

### Task 4: Create AuthModal Component

**Files:**
- Create: `src/components/AuthModal.tsx`

**Step 1: Create the component**

Create `src/components/AuthModal.tsx`:

```tsx
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import './AuthModal.css';

type ModalState = 'SIGN_IN' | 'CREATE_ACCOUNT' | 'CHOOSE_USERNAME' | 'SUCCESS';

interface AuthModalProps {
  onComplete: () => void;
  needsUsername?: boolean; // True if Google user needs to set username
}

interface FormErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

export default function AuthModal({ onComplete, needsUsername = false }: AuthModalProps) {
  const [modalState, setModalState] = useState<ModalState>(
    needsUsername ? 'CHOOSE_USERNAME' : 'SIGN_IN'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [welcomeName, setWelcomeName] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Username availability
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  // Check username availability with debounce
  useEffect(() => {
    if (modalState !== 'CREATE_ACCOUNT' && modalState !== 'CHOOSE_USERNAME') return;
    if (!displayName || displayName.length < 3) {
      setUsernameStatus('idle');
      setUsernameError(null);
      return;
    }

    setUsernameStatus('checking');

    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }

    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?name=${encodeURIComponent(displayName)}`);
        const data = await res.json();

        if (data.available) {
          setUsernameStatus('available');
          setUsernameError(null);
        } else {
          setUsernameStatus('taken');
          setUsernameError(data.reason || 'Username unavailable');
        }
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);

    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, [displayName, modalState]);

  const validateSignIn = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateCreateAccount = (): boolean => {
    const newErrors: FormErrors = {};

    if (!displayName) {
      newErrors.displayName = 'Username is required';
    } else if (displayName.length < 3 || displayName.length > 20) {
      newErrors.displayName = 'Must be 3-20 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(displayName)) {
      newErrors.displayName = 'Letters, numbers, _ and - only';
    } else if (usernameStatus === 'taken') {
      newErrors.displayName = usernameError || 'Username taken';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Min 8 characters';
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password = 'Need uppercase letter';
    } else if (!/[a-z]/.test(password)) {
      newErrors.password = 'Need lowercase letter';
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = 'Need a number';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateUsername = (): boolean => {
    const newErrors: FormErrors = {};

    if (!displayName) {
      newErrors.displayName = 'Username is required';
    } else if (displayName.length < 3 || displayName.length > 20) {
      newErrors.displayName = 'Must be 3-20 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(displayName)) {
      newErrors.displayName = 'Letters, numbers, _ and - only';
    } else if (usernameStatus === 'taken') {
      newErrors.displayName = usernameError || 'Username taken';
    } else if (usernameStatus === 'checking') {
      newErrors.displayName = 'Checking availability...';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && usernameStatus === 'available';
  };

  const handleGoogleSignIn = useCallback(async () => {
    setIsLoading(true);
    setErrors({});

    try {
      await signIn('google', { callbackUrl: window.location.href });
    } catch {
      setErrors({ form: 'Google sign-in failed. Please try again.' });
      setIsLoading(false);
    }
  }, []);

  const handleEmailSignIn = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateSignIn()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setErrors({ form: 'Invalid email or password' });
        setIsLoading(false);
        return;
      }

      setWelcomeName(email.split('@')[0]);
      setModalState('SUCCESS');
      setTimeout(onComplete, 1500);
    } catch {
      setErrors({ form: 'Sign in failed. Please try again.' });
      setIsLoading(false);
    }
  }, [email, password, onComplete]);

  const handleCreateAccount = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCreateAccount()) return;
    if (usernameStatus !== 'available') {
      setErrors({ displayName: 'Please choose an available username' });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      // Create the account
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      const signupData = await signupRes.json();

      if (!signupRes.ok) {
        setErrors({ form: signupData.error?.message || 'Signup failed' });
        setIsLoading(false);
        return;
      }

      // Sign in with the new credentials
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        setErrors({ form: 'Account created but sign-in failed. Please sign in manually.' });
        setIsLoading(false);
        return;
      }

      setWelcomeName(displayName);
      setModalState('SUCCESS');
      setTimeout(onComplete, 1500);
    } catch {
      setErrors({ form: 'Signup failed. Please try again.' });
      setIsLoading(false);
    }
  }, [email, password, confirmPassword, displayName, usernameStatus, onComplete]);

  const handleSetUsername = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateUsername()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrors({ form: data.error?.message || 'Failed to set username' });
        setIsLoading(false);
        return;
      }

      setWelcomeName(displayName);
      setModalState('SUCCESS');
      setTimeout(onComplete, 1500);
    } catch {
      setErrors({ form: 'Failed to set username. Please try again.' });
      setIsLoading(false);
    }
  }, [displayName, onComplete]);

  const handleGuestPlay = useCallback(() => {
    onComplete();
  }, [onComplete]);

  const renderUsernameStatus = () => {
    if (usernameStatus === 'idle' || !displayName || displayName.length < 3) return null;

    if (usernameStatus === 'checking') {
      return (
        <div className="auth-username-status auth-username-checking">
          <span className="auth-spinner" /> Checking...
        </div>
      );
    }

    if (usernameStatus === 'available') {
      return (
        <div className="auth-username-status auth-username-available">
          ✓ Available
        </div>
      );
    }

    if (usernameStatus === 'taken') {
      return (
        <div className="auth-username-status auth-username-taken">
          ✗ {usernameError}
        </div>
      );
    }

    return null;
  };

  // Render SUCCESS state
  if (modalState === 'SUCCESS') {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <div className="auth-success">
            <div className="auth-success-text">Welcome, {welcomeName}!</div>
          </div>
        </div>
      </div>
    );
  }

  // Render CHOOSE_USERNAME state
  if (modalState === 'CHOOSE_USERNAME') {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <h1 className="auth-title">Choose Username</h1>

          <form className="auth-form" onSubmit={handleSetUsername}>
            <div className="auth-field">
              <label className="auth-label">USERNAME</label>
              <input
                type="text"
                className={`auth-input ${errors.displayName ? 'auth-input-error' : ''}`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter username"
                maxLength={20}
                disabled={isLoading}
                autoFocus
              />
              {renderUsernameStatus()}
              {errors.displayName && <div className="auth-error">{errors.displayName}</div>}
            </div>

            {errors.form && <div className="auth-form-error">{errors.form}</div>}

            <button type="submit" className="auth-btn" disabled={isLoading || usernameStatus !== 'available'}>
              {isLoading ? <span className="auth-spinner" /> : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render CREATE_ACCOUNT state
  if (modalState === 'CREATE_ACCOUNT') {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          <h1 className="auth-title">Create Account</h1>

          <form className="auth-form" onSubmit={handleCreateAccount}>
            <div className="auth-field">
              <label className="auth-label">USERNAME</label>
              <input
                type="text"
                className={`auth-input ${errors.displayName ? 'auth-input-error' : ''}`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Choose a username"
                maxLength={20}
                disabled={isLoading}
                autoFocus
              />
              {renderUsernameStatus()}
              {errors.displayName && <div className="auth-error">{errors.displayName}</div>}
            </div>

            <div className="auth-field">
              <label className="auth-label">EMAIL</label>
              <input
                type="email"
                className={`auth-input ${errors.email ? 'auth-input-error' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isLoading}
              />
              {errors.email && <div className="auth-error">{errors.email}</div>}
            </div>

            <div className="auth-field">
              <label className="auth-label">PASSWORD</label>
              <input
                type="password"
                className={`auth-input ${errors.password ? 'auth-input-error' : ''}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, A-Z, a-z, 0-9"
                disabled={isLoading}
              />
              {errors.password && <div className="auth-error">{errors.password}</div>}
            </div>

            <div className="auth-field">
              <label className="auth-label">CONFIRM PASSWORD</label>
              <input
                type="password"
                className={`auth-input ${errors.confirmPassword ? 'auth-input-error' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                disabled={isLoading}
              />
              {errors.confirmPassword && <div className="auth-error">{errors.confirmPassword}</div>}
            </div>

            {errors.form && <div className="auth-form-error">{errors.form}</div>}

            <button type="submit" className="auth-btn" disabled={isLoading}>
              {isLoading ? <span className="auth-spinner" /> : 'Create Account'}
            </button>
          </form>

          <div className="auth-toggle">
            <span className="auth-toggle-text">Already have an account? </span>
            <button
              className="auth-toggle-link"
              onClick={() => {
                setModalState('SIGN_IN');
                setErrors({});
              }}
              disabled={isLoading}
            >
              Sign in
            </button>
          </div>

          <div className="auth-divider">
            <div className="auth-divider-line" />
            <span className="auth-divider-text">or</span>
            <div className="auth-divider-line" />
          </div>

          <button className="auth-btn auth-btn-guest" onClick={handleGuestPlay} disabled={isLoading}>
            Play as Guest
          </button>
        </div>
      </div>
    );
  }

  // Render SIGN_IN state (default)
  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        <h1 className="auth-title">Flappy Bird+</h1>

        <button className="auth-btn auth-btn-google" onClick={handleGoogleSignIn} disabled={isLoading}>
          <svg className="auth-google-icon" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">or</span>
          <div className="auth-divider-line" />
        </div>

        <form className="auth-form" onSubmit={handleEmailSignIn}>
          <div className="auth-field">
            <label className="auth-label">EMAIL</label>
            <input
              type="email"
              className={`auth-input ${errors.email ? 'auth-input-error' : ''}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              disabled={isLoading}
            />
            {errors.email && <div className="auth-error">{errors.email}</div>}
          </div>

          <div className="auth-field">
            <label className="auth-label">PASSWORD</label>
            <input
              type="password"
              className={`auth-input ${errors.password ? 'auth-input-error' : ''}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={isLoading}
            />
            {errors.password && <div className="auth-error">{errors.password}</div>}
          </div>

          {errors.form && <div className="auth-form-error">{errors.form}</div>}

          <button type="submit" className="auth-btn" disabled={isLoading}>
            {isLoading ? <span className="auth-spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="auth-toggle">
          <span className="auth-toggle-text">Don&apos;t have an account? </span>
          <button
            className="auth-toggle-link"
            onClick={() => {
              setModalState('CREATE_ACCOUNT');
              setErrors({});
            }}
            disabled={isLoading}
          >
            Create one
          </button>
        </div>

        <div className="auth-divider">
          <div className="auth-divider-line" />
          <span className="auth-divider-text">or</span>
          <div className="auth-divider-line" />
        </div>

        <button className="auth-btn auth-btn-guest" onClick={handleGuestPlay} disabled={isLoading}>
          Play as Guest
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/AuthModal.tsx
git commit -m "feat: add AuthModal component with sign-in, create account, and guest flows"
```

---

### Task 5: Integrate AuthModal into Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Update page.tsx to show AuthModal**

Replace the entire content of `src/app/page.tsx` with:

```tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import HomeScreen from '@/components/HomeScreen';
import GetReadyScreen from '@/components/GetReadyScreen';
import PlayingScreen from '@/components/PlayingScreen';
import AuthModal from '@/components/AuthModal';
import { useGameSession } from '@/hooks/useGameSession';

type GameState = 'home' | 'getReady' | 'playing' | 'gameOver';

export default function Home() {
  const { status, data: sessionData } = useSession();
  const [gameState, setGameState] = useState<GameState>('home');
  const [lastScore, setLastScore] = useState(0);
  const [sessionBest, setSessionBest] = useState(0); // For guests
  const [userBest, setUserBest] = useState<number | null>(null); // For logged-in users
  const [lastSubmitResult, setLastSubmitResult] = useState<{
    isNewBest: boolean;
    rank: number | null;
  } | null>(null);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isGuest, setIsGuest] = useState(false);

  const {
    isAuthenticated,
    session,
    startGame,
    submitScore,
    resetSession,
  } = useGameSession();

  // Handle initial auth state
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' && !isGuest) {
      setShowAuthModal(true);
    } else if (status === 'authenticated') {
      setShowAuthModal(false);
      // Check if user needs to set username (Google SSO new user)
      if (sessionData?.user && !sessionData.user.name) {
        // Fetch user profile to check displayName
        fetch('/api/users/me')
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.user && !data.user.displayName) {
              setNeedsUsername(true);
              setShowAuthModal(true);
            }
          })
          .catch(() => {});
      }
    }
  }, [status, isGuest, sessionData]);

  // Fetch user's best score on login
  useEffect(() => {
    if (isAuthenticated) {
      fetch('/api/users/me')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.user?.bestScore?.bestScore !== undefined) {
            setUserBest(data.user.bestScore.bestScore);
          }
        })
        .catch(() => {});
    } else {
      setUserBest(null);
    }
  }, [isAuthenticated]);

  const handleAuthComplete = useCallback(() => {
    setShowAuthModal(false);
    setNeedsUsername(false);
    // If they completed auth (not guest), the session will update
    // If guest, mark as guest
    if (status === 'unauthenticated') {
      setIsGuest(true);
    }
  }, [status]);

  const handleGoToGetReady = useCallback(async () => {
    setGameState('getReady');
    // Start game session (get token if authenticated)
    await startGame();
  }, [startGame]);

  const handleStartPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const handleGameOver = useCallback(async (score: number, durationMs: number) => {
    setLastScore(score);
    setLastSubmitResult(null);

    // Update session best for guests
    if (!isAuthenticated) {
      setSessionBest(prev => Math.max(prev, score));
    }

    // Submit score if authenticated
    if (isAuthenticated) {
      const result = await submitScore(score, durationMs);
      if (result) {
        setUserBest(result.you.bestScore);
        setLastSubmitResult({
          isNewBest: result.you.isNewBest,
          rank: result.you.rank,
        });
      }
    }

    setGameState('gameOver');
    // Go back to home after a delay
    setTimeout(() => {
      setGameState('home');
      resetSession();
    }, 2000);
  }, [isAuthenticated, submitScore, resetSession]);

  // Calculate best score to display
  const bestScore = isAuthenticated ? (userBest ?? 0) : sessionBest;

  // Show loading state while checking auth
  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#70C5CE',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '12px',
        color: '#543810'
      }}>
        Loading...
      </div>
    );
  }

  // Show auth modal if needed
  if (showAuthModal) {
    return <AuthModal onComplete={handleAuthComplete} needsUsername={needsUsername} />;
  }

  return (
    <>
      {gameState === 'home' && (
        <HomeScreen
          onStart={handleGoToGetReady}
          isAuthenticated={isAuthenticated}
          userDisplayName={session?.user?.name || null}
          bestScore={bestScore}
        />
      )}
      {gameState === 'getReady' && <GetReadyScreen onStart={handleStartPlaying} />}
      {gameState === 'playing' && <PlayingScreen onGameOver={handleGameOver} />}
      {/* TODO: Add proper GameOver screen */}
    </>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: integrate AuthModal as blocking modal for unauthenticated users"
```

---

### Task 6: Test Full Flow

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test guest flow**

1. Open browser in incognito/private mode
2. Navigate to `http://localhost:3000`
3. Verify blocking modal appears
4. Click "Play as Guest"
5. Verify game loads and is playable

**Step 3: Test email signup flow**

1. Open browser in incognito mode
2. Click "Create one" link
3. Fill in: username (check availability works), email, password, confirm
4. Click "Create Account"
5. Verify "Welcome, [username]!" appears
6. Verify game loads with user authenticated

**Step 4: Test email sign-in flow**

1. Open browser in incognito mode
2. Enter credentials from previous signup
3. Click "Sign In"
4. Verify welcome message and game loads

**Step 5: Test Google SSO flow**

1. Open browser in incognito mode
2. Click "Continue with Google"
3. Complete Google auth
4. If new user: verify "Choose Username" screen appears
5. Select username and continue
6. Verify welcome message and game loads

**Step 6: Commit final verification**

```bash
git add -A
git commit -m "test: verify auth modal flows work correctly"
```

(Only commit if there were any fixes needed during testing)

---

## Summary

**Files Created:**
- `src/app/api/auth/check-username/route.ts` - Username availability API
- `src/components/AuthModal.css` - Pixel-art themed styles
- `src/components/AuthModal.tsx` - Modal component with 4 states

**Files Modified:**
- `prisma/schema.prisma` - Added unique constraint to displayName
- `src/app/page.tsx` - Integrated AuthModal for blocking auth

**Total Tasks:** 6
