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
