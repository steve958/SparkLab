// ============================================================================
// SparkLab Audio Engine
// Synthesized sound effects via Web Audio API
// No external audio assets required
// ============================================================================

class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private reducedMotion = false;
  private masterGain: GainNode | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setReducedMotion(reduced: boolean) {
    this.reducedMotion = reduced;
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 1.0
  ) {
    const ctx = this.getContext();
    if (!ctx || !this.enabled || !this.masterGain) return;

    const gain = this.reducedMotion ? volume * 0.3 : volume;
    if (gain <= 0.01) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playSweep(
    fromFreq: number,
    toFreq: number,
    duration: number,
    type: OscillatorType = "sine",
    volume = 1.0
  ) {
    const ctx = this.getContext();
    if (!ctx || !this.enabled || !this.masterGain) return;

    const gain = this.reducedMotion ? volume * 0.3 : volume;
    if (gain <= 0.01) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(fromFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(toFreq, ctx.currentTime + duration);

    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  private playNoise(duration: number, volume = 1.0) {
    const ctx = this.getContext();
    if (!ctx || !this.enabled || !this.masterGain) return;

    const gain = this.reducedMotion ? volume * 0.3 : volume;
    if (gain <= 0.01) return;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    source.buffer = buffer;
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    source.connect(gainNode);
    gainNode.connect(this.masterGain);

    source.start(ctx.currentTime);
  }

  // ==========================================================================
  // Public sound API
  // ==========================================================================

  /** Soft pop when an atom appears on the scene */
  atomSpawn() {
    this.playTone(800, 0.05, "sine", 0.4);
  }

  /** Snap/chime when a covalent bond forms */
  bondForm() {
    const ctx = this.getContext();
    if (!ctx || !this.enabled || !this.masterGain) return;

    const gain = this.reducedMotion ? 0.15 : 0.5;
    if (gain <= 0.01) return;

    // Two-tone chime: 600Hz then 1200Hz
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(600, ctx.currentTime);
    gain1.gain.setValueAtTime(gain, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc1.connect(gain1);
    gain1.connect(this.masterGain);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.1);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.05);
    gain2.gain.setValueAtTime(gain * 0.7, ctx.currentTime + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc2.connect(gain2);
    gain2.connect(this.masterGain);
    osc2.start(ctx.currentTime + 0.05);
    osc2.stop(ctx.currentTime + 0.15);
  }

  /** Sweep sound for ionic bond electron transfer */
  bondIonic() {
    this.playSweep(400, 800, 0.15, "sine", 0.5);
  }

  /** Gentle buzz when an invalid action is attempted */
  invalidAction() {
    this.playTone(200, 0.08, "sawtooth", 0.15);
  }

  /** Celebration chord when mission completes */
  missionComplete() {
    const ctx = this.getContext();
    if (!ctx || !this.enabled || !this.masterGain) return;

    const gain = this.reducedMotion ? 0.15 : 0.5;
    if (gain <= 0.01) return;

    // Major triad arpeggio: C4 (261.63), E4 (329.63), G4 (392.00), C5 (523.25)
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      g.gain.setValueAtTime(gain * 0.6, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.4);
      osc.connect(g);
      g.connect(this.masterGain!);
      osc.start(ctx.currentTime + i * 0.12);
      osc.stop(ctx.currentTime + i * 0.12 + 0.4);
    });
  }

  /** High ding when a star is awarded */
  starAward() {
    this.playTone(2000, 0.08, "sine", 0.3);
  }

  /** Subtle tick for UI button clicks */
  uiClick() {
    this.playNoise(0.01, 0.15);
  }

  /** Very subtle blip for UI hover */
  uiHover() {
    this.playTone(1200, 0.02, "sine", 0.05);
  }
}

export const audio = new AudioEngine();
