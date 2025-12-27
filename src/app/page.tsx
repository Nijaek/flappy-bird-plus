'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import HomeScreen from '@/components/HomeScreen';
import GetReadyScreen from '@/components/GetReadyScreen';
import PlayingScreen from '@/components/PlayingScreen';
import GameOverScreen from '@/components/GameOverScreen';
import AuthModal from '@/components/AuthModal';
import LeaderboardModal from '@/components/LeaderboardModal';
import AccountModal from '@/components/AccountModal';
import SettingsModal from '@/components/SettingsModal';
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
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isInitialPrompt, setIsInitialPrompt] = useState(false);
  const hasShownInitialPrompt = useRef(false);

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
      setIsInitialPrompt(false);
      // Always check if user needs to set displayName for Google OAuth users
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
  }, [status, sessionData]);

  // Show auth modal on first page load for non-authenticated users
  useEffect(() => {
    if (status === 'loading') return;
    if (hasShownInitialPrompt.current) return;

    if (status === 'unauthenticated') {
      hasShownInitialPrompt.current = true;
      setIsInitialPrompt(true);
      setShowAuthModal(true);
    }
  }, [status]);

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
    setIsInitialPrompt(false);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowAuthModal(false);
    setNeedsUsername(false);
  }, []);

  const handleLeaderboardClick = useCallback(() => {
    setShowLeaderboardModal(true);
  }, []);

  const handleAccountClick = useCallback(() => {
    if (isAuthenticated) {
      setShowAccountModal(true);
    } else {
      setShowAuthModal(true);
    }
  }, [isAuthenticated]);

  const handleSettingsClick = useCallback(() => {
    setShowSettingsModal(true);
  }, []);

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
          } catch {
            // Silently ignore leaderboard fetch errors
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
          userDisplayName={session?.user?.displayName || null}
          bestScore={bestScore}
          onAccountClick={handleAccountClick}
          onLeaderboardClick={handleLeaderboardClick}
          onSettingsClick={handleSettingsClick}
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
          onClose={needsUsername || isInitialPrompt ? undefined : handleCloseModal}
          needsUsername={needsUsername}
        />
      )}
      {showLeaderboardModal && (
        <LeaderboardModal
          onClose={() => setShowLeaderboardModal(false)}
          isAuthenticated={isAuthenticated}
        />
      )}
      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
        />
      )}
      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </>
  );
}
