# Settings Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Settings modal with audio controls (Master, SFX, Music volume sliders with mute toggles).

**Architecture:** React Context for audio state management, localStorage for persistence, centralized `playSound()` function replacing scattered `new Audio()` calls.

**Tech Stack:** React Context, localStorage, CSS (matching existing modal styles)

---

### Task 1: Create AudioContext

**Files:**
- Create: `src/contexts/AudioContext.tsx`

**Step 1: Create the AudioContext file**

```tsx
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
  masterVolume: 50,
  masterMuted: false,
  sfxVolume: 50,
  sfxMuted: false,
  musicVolume: 50,
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
```

**Step 2: Commit**

```bash
git add src/contexts/AudioContext.tsx
git commit -m "feat: add AudioContext for centralized audio management"
```

---

### Task 2: Create SettingsModal CSS

**Files:**
- Create: `src/components/SettingsModal.css`

**Step 1: Create the CSS file**

```css
/* Settings Modal - Matches Account Modal Style */

.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-modal {
  background: #DEB858;
  border: 4px solid #8B6914;
  padding: 24px;
  max-width: 320px;
  width: 90%;
  box-shadow:
    4px 4px 0 #543810,
    -2px -2px 0 #F8E8A8 inset;
  position: relative;
}

.settings-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: #8B6914;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.settings-close:hover {
  color: #D85020;
}

.settings-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 14px;
  color: #FFFFFF;
  text-align: center;
  margin-bottom: 20px;
  text-shadow:
    2px 2px 0 #543810,
    -1px -1px 0 #543810,
    1px -1px 0 #543810,
    -1px 1px 0 #543810;
}

.settings-section {
  margin-bottom: 16px;
}

.settings-section-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: #543810;
  margin-bottom: 12px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px;
  background: rgba(248, 240, 216, 0.5);
  border: 2px solid #8B6914;
}

.settings-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #543810;
  width: 60px;
  flex-shrink: 0;
}

.settings-mute-btn {
  width: 28px;
  height: 28px;
  background: #F8F0D8;
  border: 2px solid #8B6914;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
}

.settings-mute-btn:hover {
  background: #FFF8E8;
}

.settings-mute-btn.muted {
  background: #E0D0B0;
}

.settings-mute-btn svg {
  width: 16px;
  height: 16px;
  fill: #F87820;
}

.settings-mute-btn.muted svg {
  fill: #8B6914;
}

.settings-slider {
  flex: 1;
  height: 20px;
  -webkit-appearance: none;
  appearance: none;
  background: #F8F0D8;
  border: 2px solid #8B6914;
  cursor: pointer;
}

.settings-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 24px;
  background: #F87820;
  border: 2px solid #8B6914;
  cursor: pointer;
}

.settings-slider::-moz-range-thumb {
  width: 16px;
  height: 24px;
  background: #F87820;
  border: 2px solid #8B6914;
  cursor: pointer;
}

.settings-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-volume-value {
  font-family: 'Press Start 2P', monospace;
  font-size: 8px;
  color: #543810;
  width: 28px;
  text-align: right;
  flex-shrink: 0;
}

.settings-placeholder {
  font-family: 'Press Start 2P', monospace;
  font-size: 6px;
  color: #8B6914;
  font-style: italic;
  margin-left: 68px;
  margin-top: -8px;
  margin-bottom: 12px;
}
```

**Step 2: Commit**

```bash
git add src/components/SettingsModal.css
git commit -m "feat: add SettingsModal CSS styles"
```

---

### Task 3: Create SettingsModal Component

**Files:**
- Create: `src/components/SettingsModal.tsx`

**Step 1: Create the component file**

```tsx
'use client';

import { useEffect, useCallback } from 'react';
import { useAudio } from '@/contexts/AudioContext';
import './SettingsModal.css';

interface SettingsModalProps {
  onClose: () => void;
}

// Speaker icon SVG
function SpeakerIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
  );
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const {
    settings,
    setMasterVolume,
    setSfxVolume,
    setMusicVolume,
    toggleMasterMute,
    toggleSfxMute,
    toggleMusicMute,
    playSound,
  } = useAudio();

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Play click sound on slider release for preview
  const handleSliderRelease = useCallback(() => {
    playSound('click');
  }, [playSound]);

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <button className="settings-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h1 className="settings-title">SETTINGS</h1>

        <div className="settings-section">
          <div className="settings-section-title">AUDIO</div>

          {/* Master Volume */}
          <div className="settings-row">
            <span className="settings-label">Master</span>
            <button
              className={`settings-mute-btn ${settings.masterMuted ? 'muted' : ''}`}
              onClick={toggleMasterMute}
              aria-label={settings.masterMuted ? 'Unmute master' : 'Mute master'}
              aria-pressed={settings.masterMuted}
            >
              <SpeakerIcon muted={settings.masterMuted} />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.masterVolume}
              onChange={e => setMasterVolume(Number(e.target.value))}
              onMouseUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              className="settings-slider"
              aria-label="Master volume"
            />
            <span className="settings-volume-value">{settings.masterVolume}</span>
          </div>

          {/* SFX Volume */}
          <div className="settings-row">
            <span className="settings-label">SFX</span>
            <button
              className={`settings-mute-btn ${settings.sfxMuted ? 'muted' : ''}`}
              onClick={toggleSfxMute}
              aria-label={settings.sfxMuted ? 'Unmute sound effects' : 'Mute sound effects'}
              aria-pressed={settings.sfxMuted}
            >
              <SpeakerIcon muted={settings.sfxMuted} />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.sfxVolume}
              onChange={e => setSfxVolume(Number(e.target.value))}
              onMouseUp={handleSliderRelease}
              onTouchEnd={handleSliderRelease}
              className="settings-slider"
              aria-label="Sound effects volume"
            />
            <span className="settings-volume-value">{settings.sfxVolume}</span>
          </div>

          {/* Music Volume */}
          <div className="settings-row">
            <span className="settings-label">Music</span>
            <button
              className={`settings-mute-btn ${settings.musicMuted ? 'muted' : ''}`}
              onClick={toggleMusicMute}
              aria-label={settings.musicMuted ? 'Unmute music' : 'Mute music'}
              aria-pressed={settings.musicMuted}
            >
              <SpeakerIcon muted={settings.musicMuted} />
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={settings.musicVolume}
              onChange={e => setMusicVolume(Number(e.target.value))}
              className="settings-slider"
              aria-label="Music volume"
              disabled
            />
            <span className="settings-volume-value">{settings.musicVolume}</span>
          </div>
          <div className="settings-placeholder">Coming soon</div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: add SettingsModal component"
```

---

### Task 4: Update Providers to Include AudioProvider

**Files:**
- Modify: `src/components/Providers.tsx`

**Step 1: Update Providers.tsx**

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { AudioProvider } from '@/contexts/AudioContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AudioProvider>
        {children}
      </AudioProvider>
    </SessionProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/Providers.tsx
git commit -m "feat: wrap app with AudioProvider"
```

---

### Task 5: Wire Up SettingsModal to Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add import for SettingsModal**

Add after line 11 (`import AccountModal`):
```tsx
import SettingsModal from '@/components/SettingsModal';
```

**Step 2: Add state for settings modal**

Add after line 40 (`const [showAccountModal, setShowAccountModal] = useState(false);`):
```tsx
const [showSettingsModal, setShowSettingsModal] = useState(false);
```

**Step 3: Add handler for settings click**

Add after line 121 (after `handleAccountClick`):
```tsx
const handleSettingsClick = useCallback(() => {
  setShowSettingsModal(true);
}, []);
```

**Step 4: Add onSettingsClick prop to HomeScreen**

Update the HomeScreen component (around line 224-231) to include onSettingsClick:
```tsx
<HomeScreen
  onStart={handleGoToGetReady}
  isAuthenticated={isAuthenticated}
  userDisplayName={session?.user?.displayName || null}
  bestScore={bestScore}
  onAccountClick={handleAccountClick}
  onLeaderboardClick={handleLeaderboardClick}
  onSettingsClick={handleSettingsClick}
/>
```

**Step 5: Render SettingsModal**

Add after AccountModal (around line 265):
```tsx
{showSettingsModal && (
  <SettingsModal
    onClose={() => setShowSettingsModal(false)}
  />
)}
```

**Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire up SettingsModal to page"
```

---

### Task 6: Update HomeScreen to Use Audio Context

**Files:**
- Modify: `src/components/HomeScreen.tsx`

**Step 1: Add import for useAudio**

Add after line 4 (`import { signIn } from 'next-auth/react';`):
```tsx
import { useAudio } from '@/contexts/AudioContext';
```

**Step 2: Remove inline playClickSound function**

Delete lines 18-25:
```tsx
// DELETE THIS:
const playClickSound = () => {
  const audio = new Audio('/sounds/click_001.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {
    // Ignore errors (e.g., if user hasn't interacted with page yet)
  });
};
```

**Step 3: Add onSettingsClick to props interface**

Update HomeScreenProps (around line 27-34) to add:
```tsx
interface HomeScreenProps {
  onStart: () => void;
  isAuthenticated: boolean;
  userDisplayName: string | null;
  bestScore: number;
  onAccountClick: () => void;
  onLeaderboardClick: () => void;
  onSettingsClick: () => void;
}
```

**Step 4: Update component signature to include onSettingsClick**

Update the function signature (around line 36):
```tsx
export default function HomeScreen({ onStart, isAuthenticated, userDisplayName, bestScore, onAccountClick, onLeaderboardClick, onSettingsClick }: HomeScreenProps) {
```

**Step 5: Add useAudio hook and create playClickSound**

Add at the start of the component (after the refs, around line 52):
```tsx
const { playSound } = useAudio();
const playClickSound = () => playSound('click');
```

**Step 6: Wire up settings button**

Update the settings button handler in handlePointerUp (around line 448-450):
```tsx
// Check if release is within settings button bounds
if (isSettingsPressed && isInBounds(x, y, bounds.settings)) {
  onSettingsClick();
}
```

**Step 7: Commit**

```bash
git add src/components/HomeScreen.tsx
git commit -m "feat: update HomeScreen to use AudioContext"
```

---

### Task 7: Update PlayingScreen to Use Audio Context

**Files:**
- Modify: `src/components/PlayingScreen.tsx`

**Step 1: Add import for useAudio**

Add after line 4 (`import { GAME, ANIMATION } from '@/game/constants';`):
```tsx
import { useAudio } from '@/contexts/AudioContext';
```

**Step 2: Remove inline sound functions**

Delete lines 19-36 (the playWingSound, playPointSound, playHitSound functions):
```tsx
// DELETE THESE:
const playWingSound = () => {
  const audio = new Audio('/sounds/wing.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

const playPointSound = () => {
  const audio = new Audio('/sounds/point.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};

const playHitSound = () => {
  const audio = new Audio('/sounds/hit.ogg');
  audio.volume = 0.5;
  audio.play().catch(() => {});
};
```

**Step 3: Add useAudio hook and sound functions**

Add at the start of the component (after canvasSize state):
```tsx
const { playSound } = useAudio();
const playWingSound = () => playSound('wing');
const playPointSound = () => playSound('point');
const playHitSound = () => playSound('hit');
```

**Step 4: Commit**

```bash
git add src/components/PlayingScreen.tsx
git commit -m "feat: update PlayingScreen to use AudioContext"
```

---

### Task 8: Update GetReadyScreen to Use Audio Context

**Files:**
- Modify: `src/components/GetReadyScreen.tsx`

**Step 1: Add import for useAudio**

Add after existing imports:
```tsx
import { useAudio } from '@/contexts/AudioContext';
```

**Step 2: Remove inline playWingSound function**

Delete the playWingSound function.

**Step 3: Add useAudio hook and playWingSound**

Add at the start of the component:
```tsx
const { playSound } = useAudio();
const playWingSound = () => playSound('wing');
```

**Step 4: Commit**

```bash
git add src/components/GetReadyScreen.tsx
git commit -m "feat: update GetReadyScreen to use AudioContext"
```

---

### Task 9: Update GameOverScreen to Use Audio Context

**Files:**
- Modify: `src/components/GameOverScreen.tsx`

**Step 1: Add import for useAudio**

Add after existing imports:
```tsx
import { useAudio } from '@/contexts/AudioContext';
```

**Step 2: Remove inline playClickSound function**

Delete the playClickSound function.

**Step 3: Add useAudio hook and playClickSound**

Add at the start of the component:
```tsx
const { playSound } = useAudio();
const playClickSound = () => playSound('click');
```

**Step 4: Commit**

```bash
git add src/components/GameOverScreen.tsx
git commit -m "feat: update GameOverScreen to use AudioContext"
```

---

### Task 10: Manual Testing & Final Commit

**Step 1: Start dev server**

```bash
npm run dev
```

**Step 2: Test checklist**

- [ ] Settings button on home screen opens modal
- [ ] ESC key closes settings modal
- [ ] Clicking overlay closes settings modal
- [ ] Master volume slider works and plays preview sound
- [ ] SFX volume slider works and plays preview sound
- [ ] Music slider shows "Coming soon" and is disabled
- [ ] Mute toggles work (icon changes, audio stops)
- [ ] Settings persist after page refresh
- [ ] Game sounds (wing, point, hit, click) respect volume settings
- [ ] Muting master mutes all sounds
- [ ] Muting SFX mutes game sounds

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address any issues from testing"
```

**Step 4: Push all changes**

```bash
git push
```
