'use client';

import { useEffect, useState, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import './AccountModal.css';

interface AccountModalProps {
  onClose: () => void;
}

interface UserData {
  displayName: string | null;
  pointsBalance: number;
  bestScore: { bestScore: number } | null;
  gamesPlayed: number;
}

export default function AccountModal({ onClose }: AccountModalProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (res.status === 401) {
          // Not authenticated, close modal
          onClose();
          return;
        }
        if (!res.ok) {
          setError('Failed to load account data');
          return;
        }
        const data = await res.json();
        setUserData(data.user);
      } catch (error) {
        console.error('Failed to fetch user data:', error);
        setError('Failed to load account data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [onClose]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    onClose();
  };

  if (isLoading) {
    return (
      <div className="account-overlay">
        <div className="account-modal">
          <div className="account-loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="account-overlay">
        <div className="account-modal">
          <button className="account-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
          <div className="account-loading">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="account-overlay">
      <div className="account-modal">
        <button className="account-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h1 className="account-title">ACCOUNT</h1>

        <div className="account-username">
          {userData?.displayName ?? 'Unknown'}
        </div>

        <div className="account-stats">
          <div className="account-stat-row">
            <span className="account-stat-label">BEST SCORE</span>
            <span className="account-stat-value">
              {userData?.bestScore?.bestScore ?? 0}
            </span>
          </div>
          <div className="account-stat-row">
            <span className="account-stat-label">GAMES PLAYED</span>
            <span className="account-stat-value">
              {userData?.gamesPlayed ?? 0}
            </span>
          </div>
          <div className="account-stat-row">
            <span className="account-stat-label">TOTAL POINTS</span>
            <span className="account-stat-value">
              {userData?.pointsBalance ?? 0}
            </span>
          </div>
        </div>

        <button className="account-signout-btn" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
