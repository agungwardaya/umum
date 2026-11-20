let audioCtx: AudioContext | null = null;

export function playScanTone(type: 'success' | 'warning' | 'error'): void {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(1174.66, now + 0.08);
      gainNode.gain.setValueAtTime(0.14, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      oscillator.start(now);
      oscillator.stop(now + 0.22);
    } else if (type === 'warning') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(520, now);
      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      oscillator.start(now);
      oscillator.stop(now + 0.18);
    } else {
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(240, now);
      oscillator.frequency.setValueAtTime(180, now + 0.1);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      oscillator.start(now);
      oscillator.stop(now + 0.25);
    }
  } catch {
    // Audio playback blocked or unsupported
  }
}

export function triggerHaptic(type: 'success' | 'warning' | 'error'): void {
  try {
    if (!navigator.vibrate) return;
    if (type === 'success') {
      navigator.vibrate([50]);
    } else if (type === 'warning') {
      navigator.vibrate([40, 40, 40]);
    } else {
      navigator.vibrate([120, 50, 120]);
    }
  } catch {
    // Vibration unsupported
  }
}
