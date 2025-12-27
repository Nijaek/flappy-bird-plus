'use client';

import { useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface SubmitResult {
  top10: Array<{
    rank: number;
    displayName: string;
    bestScore: number;
  }>;
  you: {
    rank: number | null;
    bestScore: number;
    isNewBest: boolean;
  };
  pointsEarned: number;
  pointsBalance: number;
}

interface GameSessionState {
  runToken: string | null;
  startTime: number | null;
  isLoading: boolean;
  error: string | null;
}

export function useGameSession() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === 'authenticated';

  const [state, setState] = useState<GameSessionState>({
    runToken: null,
    startTime: null,
    isLoading: false,
    error: null,
  });

  const startGame = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) {
      // Guests can still play, just no tracking
      setState(prev => ({ ...prev, startTime: Date.now() }));
      return true;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/game/start', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to start game');
      }

      const data = await response.json();
      setState({
        runToken: data.runToken,
        startTime: Date.now(),
        isLoading: false,
        error: null,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      setState(prev => ({ ...prev, isLoading: false, error: message }));
      // Still allow playing even if token fetch fails
      setState(prev => ({ ...prev, startTime: Date.now() }));
      return true;
    }
  }, [isAuthenticated]);

  const submitScore = useCallback(async (
    score: number,
    durationMs: number
  ): Promise<SubmitResult | null> => {
    if (!isAuthenticated || !state.runToken) {
      return null;
    }

    try {
      const response = await fetch('/api/runs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runToken: state.runToken,
          score,
          durationMs,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const result: SubmitResult = await response.json();

      // Clear the run token after submission
      setState(prev => ({ ...prev, runToken: null }));

      return result;
    } catch {
      return null;
    }
  }, [isAuthenticated, state.runToken]);

  const resetSession = useCallback(() => {
    setState({
      runToken: null,
      startTime: null,
      isLoading: false,
      error: null,
    });
  }, []);

  return {
    isAuthenticated,
    session,
    runToken: state.runToken,
    startTime: state.startTime,
    isLoading: state.isLoading,
    error: state.error,
    startGame,
    submitScore,
    resetSession,
  };
}
