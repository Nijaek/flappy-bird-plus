'use client';

import { useState, useCallback, useEffect } from 'react';
import HomeScreen from '@/components/HomeScreen';
import GetReadyScreen from '@/components/GetReadyScreen';
import PlayingScreen from '@/components/PlayingScreen';
import { useGameSession } from '@/hooks/useGameSession';

type GameState = 'home' | 'getReady' | 'playing' | 'gameOver';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('home');
  const [lastScore, setLastScore] = useState(0);
  const [sessionBest, setSessionBest] = useState(0); // For guests
  const [userBest, setUserBest] = useState<number | null>(null); // For logged-in users
  const [lastSubmitResult, setLastSubmitResult] = useState<{
    isNewBest: boolean;
    rank: number | null;
  } | null>(null);

  const {
    isAuthenticated,
    session,
    startGame,
    submitScore,
    resetSession,
  } = useGameSession();

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
