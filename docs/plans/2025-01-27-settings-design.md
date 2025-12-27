# Settings Feature Design

## Overview

Add a Settings modal accessible from the home screen with audio controls (Master, SFX, Music volume sliders with mute toggles).

## Data Model

```typescript
interface AudioSettings {
  masterVolume: number;    // 0-100
  masterMuted: boolean;
  sfxVolume: number;       // 0-100
  sfxMuted: boolean;
  musicVolume: number;     // 0-100
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
  playSound: (sound: 'wing' | 'point' | 'hit' | 'click') => void;
}
```

### Effective Volume Calculation

- SFX effective = `masterMuted ? 0 : (masterVolume/100) * (sfxMuted ? 0 : sfxVolume/100)`
- Music effective = same pattern with musicVolume

### Persistence

- Store in `localStorage` under key `'flappy-audio-settings'`
- Load on app mount with defaults: all volumes at 50, all unmuted
- Handle corrupted data by falling back to defaults

## UI Structure

```
SettingsModal
├── Overlay (darkened backdrop, click to close)
├── Modal Container (matching existing modal styles)
│   ├── Close Button (✕)
│   ├── Title ("SETTINGS")
│   └── Audio Section
│       ├── Master Volume Row
│       │   ├── Label ("Master")
│       │   ├── Mute Toggle Button (speaker icon)
│       │   └── Slider (0-100)
│       ├── Sound Effects Row (same layout)
│       └── Music Row (same layout, placeholder - no music yet)
```

### Visual Style

- Match existing modals (AccountModal, LeaderboardModal)
- Pixel font ("Press Start 2P")
- Orange accent color (#F87820) for sliders/toggles
- Cream background matching button style
- Chunky/pixelated slider styling

### Mute Toggle States

- Unmuted: Speaker icon with sound waves
- Muted: Speaker icon with X

## Files to Create/Modify

### New Files

- `src/contexts/AudioContext.tsx` - Context provider with playSound function
- `src/components/SettingsModal.tsx` - Modal component
- `src/components/SettingsModal.css` - Modal styles

### Files to Modify

- `src/components/Providers.tsx` - Wrap app with AudioProvider
- `src/app/page.tsx` - Add showSettingsModal state, wire up modal
- `src/components/HomeScreen.tsx` - Add onSettingsClick prop, wire button
- `src/components/PlayingScreen.tsx` - Use context instead of inline Audio
- `src/components/GetReadyScreen.tsx` - Use context instead of inline Audio
- `src/components/GameOverScreen.tsx` - Use context instead of inline Audio

## Sound Mapping

```typescript
const SOUNDS = {
  wing: '/sounds/wing.ogg',
  point: '/sounds/point.ogg',
  hit: '/sounds/hit.ogg',
  click: '/sounds/click_001.ogg',
} as const;
```

## Behavior Details

### Slider Behavior

- Dragging slider while muted: Unmute automatically
- Setting volume to 0 via slider: Don't auto-mute (keep independent)
- Play click sound on slider release for audio preview

### Accessibility

- Sliders have `aria-label` attributes
- Mute buttons have `aria-pressed` state
- ESC key closes modal

### Audio Autoplay

- Browsers block audio until user interaction
- Silently fail with `.catch(() => {})` pattern (existing behavior)

## Out of Scope

- Music playback (placeholder slider only)
- Server-side settings persistence
- Non-audio settings (accessibility, gameplay, etc.)
