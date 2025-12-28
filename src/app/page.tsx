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
import ShopModal from '@/components/ShopModal';
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
  const [showShopModal, setShowShopModal] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isInitialPrompt, setIsInitialPrompt] = useState(false);
  const [equippedSkin, setEquippedSkin] = useState<string>('skin_yellow');
  const [equippedTrail, setEquippedTrail] = useState<string | null>(null);
  const [pointsBalance, setPointsBalance] = useState(0);
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
          // Set points balance
          setPointsBalance(data?.user?.pointsBalance ?? 0);
          // After getting user data, fetch equipped cosmetic SKUs
          if (data?.user) {
            const equippedSkinId = data.user.equippedSkinId;
            const equippedTrailId = data.user.equippedTrailId;

            if (equippedSkinId || equippedTrailId) {
              fetch('/api/shop/items')
                .then(r => r.json())
                .then(shopData => {
                  if (equippedSkinId) {
                    const skin = shopData.items.find((i: { id: string }) => i.id === equippedSkinId);
                    if (skin) setEquippedSkin(skin.sku);
                  }
                  if (equippedTrailId) {
                    const trail = shopData.items.find((i: { id: string }) => i.id === equippedTrailId);
                    if (trail) setEquippedTrail(trail.sku);
                  }
                })
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Clearing state when logged out
      setUserBest(null);
      setEquippedSkin('skin_yellow');
      setEquippedTrail(null);
      setPointsBalance(0);
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

  const handleShopClick = useCallback(() => {
    setShowShopModal(true);
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
        setPointsBalance(result.pointsBalance);
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
      {/* Logo link to nijae.dev */}
      <a
        href="https://nijae.dev"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed top-4 left-4 z-50 transition-transform duration-150 hover:scale-110"
      >
        <img
          src="/logo_transparent_bg.png"
          alt="nijae.dev"
          className="w-10 h-10"
        />
      </a>
      {gameState === 'home' && (
        <HomeScreen
          onStart={handleGoToGetReady}
          isAuthenticated={isAuthenticated}
          userDisplayName={session?.user?.displayName || null}
          bestScore={bestScore}
          pointsBalance={pointsBalance}
          onAccountClick={handleAccountClick}
          onLeaderboardClick={handleLeaderboardClick}
          onSettingsClick={handleSettingsClick}
          onShopClick={handleShopClick}
          equippedSkin={equippedSkin}
          equippedTrail={equippedTrail}
        />
      )}
      {gameState === 'getReady' && <GetReadyScreen onStart={handleStartPlaying} equippedSkin={equippedSkin} equippedTrail={equippedTrail} />}
      {gameState === 'playing' && (
        <PlayingScreen
          onGameOver={handleGameOver}
          equippedSkin={equippedSkin}
          equippedTrail={equippedTrail ?? undefined}
        />
      )}
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
      {showShopModal && (
        <ShopModal
          onClose={() => setShowShopModal(false)}
          isAuthenticated={isAuthenticated}
          onBalanceChange={setPointsBalance}
          onEquipChange={(type, sku) => {
            if (type === 'skin') {
              setEquippedSkin(sku ?? 'skin_yellow');
            } else {
              setEquippedTrail(sku);
            }
          }}
        />
      )}
    </>
  );
}
