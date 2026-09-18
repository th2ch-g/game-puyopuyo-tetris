import type { Settings } from './storage';

export class Sound {
  private context: AudioContext | null = null;
  settings: Settings;
  constructor(settings: Settings) {
    this.settings = settings;
  }
  unlock() {
    if (!this.settings.sound) return;
    try {
      this.context ||= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
    } catch {
      /* Audio is optional. */
    }
  }
  play(type: 'move' | 'rotate' | 'drop' | 'clear' | 'win' | 'count', chain = 1) {
    if (!this.settings.sound || !this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const notes =
      type === 'win'
        ? [523, 659, 784, 1047]
        : type === 'clear'
          ? [330 + chain * 85, 440 + chain * 85]
          : [type === 'move' ? 180 : type === 'rotate' ? 360 : type === 'drop' ? 90 : 660];
    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.07,
        duration = type === 'drop' ? 0.13 : 0.085;
      oscillator.type = type === 'drop' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(this.settings.volume * 0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.01);
    });
  }
}
