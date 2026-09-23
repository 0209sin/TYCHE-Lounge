/**
 * Synthwave Retro BGM Synthesizer for Tyche Lounge
 * Uses Web Audio API to create a gentle, ambient cyberpunk background music loop.
 * Zero external audio files, zero network dependencies, 100% offline.
 */

// Ambient chord progression: Am -> F -> C -> G
const CHORDS = [
  { bass: 110.0, notes: [220.0, 261.63, 329.63, 440.0] }, // Am (A2 / A3, C4, E4, A4)
  { bass: 87.31, notes: [174.61, 261.63, 349.23, 440.0] }, // F (F2 / F3, C4, F4, A4)
  { bass: 130.81, notes: [261.63, 329.63, 392.0, 523.25] }, // C (C3 / C4, E4, G4, C5)
  { bass: 98.0, notes: [196.0, 246.94, 293.66, 392.0] }, // G (G2 / G3, B3, D4, G4)
];

class BgmEngine {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentStep = 0;
  private timer: number | null = null;
  private masterGain: GainNode | null = null;

  private initCtx() {
    if (typeof window === 'undefined') return;
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.038, this.ctx.currentTime);

      // Low-pass filter for soft, warm ambient feel (cuts harsh high frequencies)
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.2, this.ctx.currentTime);

      this.masterGain.connect(filter);
      filter.connect(this.ctx.destination);
    }
  }

  public setEnabled(enabled: boolean) {
    if (enabled) {
      this.play();
    } else {
      this.pause();
    }
  }

  public play() {
    if (this.isPlaying) return;
    this.initCtx();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }

    this.isPlaying = true;
    this.scheduleNextTick();
  }

  public pause() {
    this.isPlaying = false;
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextTick() {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;

    const bar = Math.floor(this.currentStep / 16) % CHORDS.length;
    const stepInBar = this.currentStep % 16;
    const chord = CHORDS[bar];
    const now = this.ctx.currentTime;

    // 1. Sub-bass note on beats 0, 6, 8, 14
    if (stepInBar === 0 || stepInBar === 6 || stepInBar === 8 || stepInBar === 14) {
      this.playBass(chord.bass, now, 0.28);
    }

    // 2. Gentle ambient synth pad on beat 0 of each bar
    if (stepInBar === 0) {
      this.playPad(chord.notes, now, 3.4);
    }

    // 3. Arpeggiated melody note on alternating steps
    if (stepInBar % 2 === 0) {
      const noteIdx = (stepInBar / 2) % chord.notes.length;
      const freq = chord.notes[noteIdx];
      this.playArp(freq, now, 0.16);
    }

    this.currentStep = (this.currentStep + 1) % (CHORDS.length * 16);

    // 16th note at ~104 BPM = ~144ms per step
    const stepMs = 144;
    this.timer = window.setTimeout(() => this.scheduleNextTick(), stepMs);
  }

  private playBass(freq: number, when: number, dur: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq / 2, when);
      gain.gain.setValueAtTime(0.045, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    } catch {
      // Audio fallback safe
    }
  }

  private playPad(notes: number[], when: number, dur: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      notes.slice(0, 3).forEach(freq => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, when);
        gain.gain.setValueAtTime(0.001, when);
        gain.gain.linearRampToValueAtTime(0.018, when + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(when);
        osc.stop(when + dur + 0.1);
      });
    } catch {
      // Audio fallback safe
    }
  }

  private playArp(freq: number, when: number, dur: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, when);
      gain.gain.setValueAtTime(0.02, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    } catch {
      // Audio fallback safe
    }
  }
}

export const bgmManager = new BgmEngine();
