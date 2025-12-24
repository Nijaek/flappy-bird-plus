'use client';

import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          setUserData(data.user);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

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

  return (
    <div className="account-overlay">
      <div className="account-modal">
        <button className="account-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h1 className="account-title">ACCOUNT</h1>

        <div className="account-username">
          {userData?.displayName || 'Unknown'}
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
