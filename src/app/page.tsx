'use client';

import { useState, useCallback } from 'react';
import HomeScreen from '@/components/HomeScreen';
import GetReadyScreen from '@/components/GetReadyScreen';
import PlayingScreen from '@/components/PlayingScreen';

type GameState = 'home' | 'getReady' | 'playing' | 'gameOver';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('home');
  const [lastScore, setLastScore] = useState(0);

  const handleGoToGetReady = useCallback(() => {
    setGameState('getReady');
  }, []);

  const handleStartPlaying = useCallback(() => {
    setGameState('playing');
  }, []);

  const handleGameOver = useCallback((score: number) => {
    setLastScore(score);
    setGameState('gameOver');
    // For now, go back to home after a delay
    setTimeout(() => {
      setGameState('home');
    }, 1500);
  }, []);

  return (
    <>
      {gameState === 'home' && <HomeScreen onStart={handleGoToGetReady} />}
      {gameState === 'getReady' && <GetReadyScreen onStart={handleStartPlaying} />}
      {gameState === 'playing' && <PlayingScreen onGameOver={handleGameOver} />}
      {/* TODO: Add GameOver screen */}
    </>
  );
}
