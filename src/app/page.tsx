'use client';

import { useState, useCallback } from 'react';
import HomeScreen from '@/components/HomeScreen';

type GameState = 'home' | 'playing' | 'gameOver';

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('home');

  const handleStart = useCallback(() => {
    console.log('Game starting!');
    // TODO: Implement game state transition
    // setGameState('playing');
  }, []);

  return (
    <>
      {gameState === 'home' && <HomeScreen onStart={handleStart} />}
      {/* TODO: Add Game and GameOver screens */}
    </>
  );
}
