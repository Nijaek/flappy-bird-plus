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
  const [sessionBest, setSessionBest] = useState(0);
  const [userBest, setUserBest] = useState<number | null>(null);
  const [lastSubmitResult, setLastSubmitResult] = useState<{
    isNewBest: boolean;
    rank: number | null;
  } | null>(null);

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

  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'unauthenticated' && !isGuest) {
      setShowAuthModal(true);
    } else if (status === 'authenticated') {
      setShowAuthModal(false);
      if (sessionData?.user && !sessionData.user.name) {
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
    if (status === 'unauthenticated') {
      setIsGuest(true);
    }
  }, [status]);

  const handleGoToGetReady = useCallback(async () => {
    setGameState('getReady');
    await startGame();
  }, [startGame]);

  const handleStartPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const handleGameOver = useCallback(async (score: number, durationMs: number) => {
    setLastScore(score);
    setLastSubmitResult(null);

    if (!isAuthenticated) {
      setSessionBest(prev => Math.max(prev, score));
    }

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
    setTimeout(() => {
      setGameState('home');
      resetSession();
    }, 2000);
  }, [isAuthenticated, submitScore, resetSession]);

  const bestScore = isAuthenticated ? (userBest ?? 0) : sessionBest;

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
    </>
  );
}
