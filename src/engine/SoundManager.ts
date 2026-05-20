export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  private initContext() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, this.ctx.currentTime); // default volume 30%
      this.generateNoiseBuffer();
    } catch (e) {
      console.warn("Web Audio API not supported in this browser", e);
    }
  }

  private generateNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.3, this.ctx.currentTime);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private playSound(setup: (ctx: AudioContext, destination: AudioNode) => void) {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    // Resume context if suspended (browser security)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    try {
      setup(this.ctx, this.masterGain!);
    } catch (e) {
      console.error("Error playing procedural sound", e);
    }
  }

  // --- SOUND EFFECTS ---

  /** Conventional machine gun / tank shell shoot sound */
  public playShoot() {
    this.playSound((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.13);
    });
  }

  /** Evolved sci-fi laser shoot sound */
  public playLaser() {
    this.playSound((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    });
  }

  /** Flamethrower / plasma fire sound (short noise burst) */
  public playFlame() {
    this.playSound((ctx, dest) => {
      if (!this.noiseBuffer) return;
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 400;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
      noise.stop(ctx.currentTime + 0.2);
    });
  }

  /** Rocket shoot / launch sound */
  public playRocketLaunch() {
    this.playSound((ctx, dest) => {
      if (!this.noiseBuffer) return;
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start();
      noise.stop(ctx.currentTime + 0.35);
    });
  }

  /** Explosion sound (conventional) */
  public playExplosion() {
    this.playSound((ctx, dest) => {
      // Create noise source
      if (!this.noiseBuffer) return;
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      // Filter to make it bassy
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.5);

      // Volume envelope
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1.0, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      // Add a low bass thump oscillator
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(30, ctx.currentTime + 0.3);

      oscGain.gain.setValueAtTime(1.0, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(oscGain);
      oscGain.connect(dest);

      noise.start();
      noise.stop(ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    });
  }

  /** Evolved Sci-Fi / Lightning blast explosion sound */
  public playSciFiExplosion() {
    this.playSound((ctx, dest) => {
      if (!this.noiseBuffer) return;
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.6);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.8, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);

      // Rapidly changing frequency oscillator to modulate
      const modulator = ctx.createOscillator();
      const modGain = ctx.createGain();
      modulator.type = 'sawtooth';
      modulator.frequency.value = 50;
      modGain.gain.value = 100;

      modulator.connect(modGain);
      // Connect modulator to filter frequency
      modGain.connect(filter.frequency);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      modulator.start();
      noise.start();
      
      modulator.stop(ctx.currentTime + 0.65);
      noise.stop(ctx.currentTime + 0.65);
    });
  }

  /** Player hit damage sound */
  public playPlayerHit() {
    this.playSound((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(60, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    });
  }

  /** XP Gem collection chime */
  public playCollectXP(pitchMult: number = 1.0) {
    this.playSound((ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Map level/gem tier to pitch
      const freq = 600 * pitchMult;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(dest);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    });
  }

  /** Game Level Up arpeggio chime */
  public playLevelUp() {
    this.playSound((ctx, dest) => {
      const now = ctx.currentTime;
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major scale notes
      
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = now + index * 0.07;
        const duration = 0.25;

        gain.gain.setValueAtTime(0, now);
        gain.gain.setValueAtTime(0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.005, startTime + duration);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);
      });
    });
  }

  /** Upgrade Selected sound effect */
  public playUpgradeSelected() {
    this.playSound((ctx, dest) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
      osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1); // C6

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(dest);

      osc1.start();
      osc2.start();

      osc1.stop(ctx.currentTime + 0.3);
      osc2.stop(ctx.currentTime + 0.3);
    });
  }
}

// Export a single global instance for the application
export const soundManager = new SoundManager();
