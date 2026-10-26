// audio.js - Web Audio API Sound Synthesizers (Zero external files)
class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.7;
    this.lastTickTime = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
  }

  toggleSound() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Mechanical tick sound when slice boundary crosses needle
  playTick() {
    if (!this.enabled) return;
    const now = performance.now();
    // Throttle ticks to avoid audio overlap buffer overflow
    if (now - this.lastTickTime < 35) return;
    this.lastTickTime = now;

    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const startTime = this.ctx.currentTime;
      // High pitch wood/plastic click
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + Math.random() * 200, startTime);
      osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.04);

      gain.gain.setValueAtTime(this.volume * 0.45, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.045);
    } catch (e) {
      // Audio context might be waiting for user gesture
    }
  }

  // Victory Fanfare & Chimes
  playWin() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const baseTime = this.ctx.currentTime;
      const notes = [
        { f: 523.25, t: 0.00, d: 0.12 }, // C5
        { f: 659.25, t: 0.12, d: 0.12 }, // E5
        { f: 783.99, t: 0.24, d: 0.14 }, // G5
        { f: 1046.50, t: 0.38, d: 0.60 } // C6
      ];

      notes.forEach(({ f, t, d }) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const nStart = baseTime + t;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, nStart);

        gain.gain.setValueAtTime(0, nStart);
        gain.gain.linearRampToValueAtTime(this.volume * 0.5, nStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, nStart + d);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(nStart);
        osc.stop(nStart + d + 0.05);
      });
    } catch (e) {
      console.warn('Audio playWin error:', e);
    }
  }
}

window.soundManager = new SoundManager();
