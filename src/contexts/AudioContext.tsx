'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const SOUNDS = {
  wing: '/sounds/wing.ogg',
  point: '/sounds/point.ogg',
  hit: '/sounds/hit.ogg',
  click: '/sounds/click_001.ogg',
} as const;

type SoundType = keyof typeof SOUNDS;

interface AudioSettings {
  masterVolume: number;
  masterMuted: boolean;
  sfxVolume: number;
  sfxMuted: boolean;
  musicVolume: number;
  musicMuted: boolean;
}

interface AudioContextValue {
  settings: AudioSettings;
  setMasterVolume: (volume: number) => void;
  setSfxVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  toggleMasterMute: () => void;
  toggleSfxMute: () => void;
  toggleMusicMute: () => void;
  playSound: (sound: SoundType) => void;
}

const defaultSettings: AudioSettings = {
  masterVolume: 100,
  masterMuted: false,
  sfxVolume: 100,
  sfxMuted: false,
  musicVolume: 100,
  musicMuted: false,
};

const STORAGE_KEY = 'flappy-audio-settings';

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AudioSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch {
      // Use defaults if corrupted
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  }, [settings, isLoaded]);

  const setMasterVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, masterVolume: volume, masterMuted: false }));
  }, []);

  const setSfxVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, sfxVolume: volume, sfxMuted: false }));
  }, []);

  const setMusicVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, musicVolume: volume, musicMuted: false }));
  }, []);

  const toggleMasterMute = useCallback(() => {
    setSettings(prev => ({ ...prev, masterMuted: !prev.masterMuted }));
  }, []);

  const toggleSfxMute = useCallback(() => {
    setSettings(prev => ({ ...prev, sfxMuted: !prev.sfxMuted }));
  }, []);

  const toggleMusicMute = useCallback(() => {
    setSettings(prev => ({ ...prev, musicMuted: !prev.musicMuted }));
  }, []);

  const playSound = useCallback((sound: SoundType) => {
    if (settings.masterMuted || settings.sfxMuted) return;

    const effectiveVolume = (settings.masterVolume / 100) * (settings.sfxVolume / 100);
    if (effectiveVolume <= 0) return;

    const audio = new Audio(SOUNDS[sound]);
    audio.volume = effectiveVolume;
    audio.play().catch(() => {});
  }, [settings.masterMuted, settings.sfxMuted, settings.masterVolume, settings.sfxVolume]);

  return (
    <AudioContext.Provider value={{
      settings,
      setMasterVolume,
      setSfxVolume,
      setMusicVolume,
      toggleMasterMute,
      toggleSfxMute,
      toggleMusicMute,
      playSound,
    }}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider');
  }
  return context;
}
