'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import HomeScreen from '@/components/HomeScreen';
import GetReadyScreen from '@/components/GetReadyScreen';
import PlayingScreen from '@/components/PlayingScreen';
import GameOverScreen from '@/components/GameOverScreen';
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
  const [gameFrameData, setGameFrameData] = useState<ImageData | null>(null);
  const [nearbyLeaderboard, setNearbyLeaderboard] = useState<{
    playerRank: number;
    totalPlayers: number;
    nearbyPlayers: Array<{
      rank: number;
      displayName: string;
      bestScore: number;
      isPlayer: boolean;
    }>;
  } | null>(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);

  const {
    isAuthenticated,
    session,
    startGame,
    submitScore,
    resetSession,
  } = useGameSession();

  // Check if authenticated user needs to set username (Google SSO)
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated') {
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
  }, [status, sessionData]);

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
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowAuthModal(false);
    setNeedsUsername(false);
  }, []);

  const handleAccountClick = useCallback(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [isAuthenticated]);

  const handleGoToGetReady = useCallback(async () => {
    setGameState('getReady');
    await startGame();
  }, [startGame]);

  const handleStartPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const handleGameOver = useCallback(async (score: number, durationMs: number, frameData?: ImageData) => {
    setLastScore(score);
    setLastSubmitResult(null);
    setNearbyLeaderboard(null);

    if (frameData) {
      setGameFrameData(frameData);
    }

    if (!isAuthenticated) {
      setSessionBest(prev => Math.max(prev, score));
    }

    let userRank: number | null = null;

    if (isAuthenticated) {
      const result = await submitScore(score, durationMs);
      if (result) {
        setUserBest(result.you.bestScore);
        userRank = result.you.rank;
        setLastSubmitResult({
          isNewBest: result.you.isNewBest,
          rank: result.you.rank,
        });

        // Fetch nearby leaderboard
        if (userRank !== null) {
          try {
            const response = await fetch(`/api/leaderboard/nearby?rank=${userRank}`);
            if (response.ok) {
              const data = await response.json();
              setNearbyLeaderboard({
                playerRank: userRank,
                totalPlayers: data.totalPlayers,
                nearbyPlayers: data.nearbyPlayers,
              });
            }
          } catch (err) {
            console.error('Failed to fetch nearby leaderboard:', err);
          }
        }
      }
    }

    setGameState('gameOver');
  }, [isAuthenticated, submitScore]);

  const handlePlayAgain = useCallback(async () => {
    setGameFrameData(null);
    setNearbyLeaderboard(null);
    resetSession();
    setGameState('getReady');
    await startGame();
  }, [resetSession, startGame]);

  const handleGoHome = useCallback(() => {
    setGameFrameData(null);
    setNearbyLeaderboard(null);
    resetSession();
    setGameState('home');
  }, [resetSession]);

  const handleSignInFromGameOver = useCallback(() => {
    setGameFrameData(null);
    setNearbyLeaderboard(null);
    resetSession();
    setShowAuthModal(true);
    setGameState('home');
  }, [resetSession]);

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

  return (
    <>
      {gameState === 'home' && (
        <HomeScreen
          onStart={handleGoToGetReady}
          isAuthenticated={isAuthenticated}
          userDisplayName={session?.user?.name || null}
          bestScore={bestScore}
          onAccountClick={handleAccountClick}
        />
      )}
      {gameState === 'getReady' && <GetReadyScreen onStart={handleStartPlaying} />}
      {gameState === 'playing' && <PlayingScreen onGameOver={handleGameOver} />}
      {gameState === 'gameOver' && (
        <GameOverScreen
          score={lastScore}
          bestScore={bestScore}
          isNewBest={lastSubmitResult?.isNewBest ?? false}
          isAuthenticated={isAuthenticated}
          leaderboardData={nearbyLeaderboard}
          onPlayAgain={handlePlayAgain}
          onHome={handleGoHome}
          onSignIn={handleSignInFromGameOver}
          gameFrameData={gameFrameData}
        />
      )}
      {showAuthModal && (
        <AuthModal
          onComplete={handleAuthComplete}
          onClose={needsUsername ? undefined : handleCloseModal}
          needsUsername={needsUsername}
        />
      )}
    </>
  );
}
