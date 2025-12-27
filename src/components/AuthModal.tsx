'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import './AuthModal.css';

type ModalState = 'SIGN_IN' | 'CREATE_ACCOUNT' | 'CHOOSE_USERNAME' | 'SUCCESS';

interface AuthModalProps {
  onComplete: () => void;
  onClose?: () => void;
  needsUsername?: boolean;
}

interface FormErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

export default function AuthModal({ onComplete, onClose, needsUsername = false }: AuthModalProps) {
  const [modalState, setModalState] = useState<ModalState>(
    needsUsername ? 'CHOOSE_USERNAME' : 'SIGN_IN'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [welcomeName, setWelcomeName] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const usernameCheckTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (modalState !== 'CREATE_ACCOUNT' && modalState !== 'CHOOSE_USERNAME') return;
    if (!displayName || displayName.length < 3) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const validateSignIn = useCallback((): boolean => {
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
  }, [email, password]);

  const validateCreateAccount = useCallback((): boolean => {
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
    } else if (password !== confirmPassword) {
      // Only check match after password itself is valid
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [displayName, usernameStatus, usernameError, email, password, confirmPassword]);

  const validateUsername = useCallback((): boolean => {
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
  }, [displayName, usernameStatus, usernameError]);

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
  }, [email, password, onComplete, validateSignIn]);

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
  }, [email, password, displayName, usernameStatus, onComplete, validateCreateAccount]);

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
  }, [displayName, onComplete, validateUsername]);

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

  if (modalState === 'CREATE_ACCOUNT') {
    return (
      <div className="auth-overlay">
        <div className="auth-modal">
          {onClose && (
            <button className="auth-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
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
              onClick={() => { setModalState('SIGN_IN'); setErrors({}); }}
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

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        {onClose && (
          <button className="auth-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
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
            onClick={() => { setModalState('CREATE_ACCOUNT'); setErrors({}); }}
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
