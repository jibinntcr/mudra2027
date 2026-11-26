'use client';

const MUTE_STORAGE_KEY = 'mudra_quiz_muted';

export function isQuizSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setQuizSoundMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false');
  } catch {
    // ignore
  }
}

/**
 * Web Audio API synthesizer for Mudra Quiz classroom game sound effects
 * Respects persistent mute preference in localStorage.
 */
export function playQuizSound(
  effect: 'select' | 'correct' | 'wrong' | 'tick' | 'podium'
): void {
  if (typeof window === 'undefined' || isQuizSoundMuted()) return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const tone = (freq: number, startOffset: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.08) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(gainVal, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    if (effect === 'select') {
      tone(520, 0, 0.09, 'triangle', 0.07);
    } else if (effect === 'tick') {
      tone(880, 0, 0.05, 'sine', 0.04);
    } else if (effect === 'correct') {
      tone(523.25, 0, 0.12, 'triangle', 0.09);
      tone(659.25, 0.1, 0.14, 'triangle', 0.09);
      tone(783.99, 0.2, 0.22, 'triangle', 0.1);
    } else if (effect === 'wrong') {
      tone(300, 0, 0.16, 'sawtooth', 0.06);
      tone(220, 0.15, 0.24, 'sawtooth', 0.06);
    } else if (effect === 'podium') {
      tone(523.25, 0, 0.14, 'triangle', 0.09);
      tone(659.25, 0.12, 0.14, 'triangle', 0.09);
      tone(783.99, 0.24, 0.16, 'triangle', 0.09);
      tone(1046.5, 0.38, 0.35, 'triangle', 0.11);
    }
  } catch {
    // ignore audio autoplay restriction
  }
}
