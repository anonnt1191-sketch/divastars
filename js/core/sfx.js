// core/sfx.js — WebAudio-synthesized SFX. No external files. Copyright-clean.
// All tones generated procedurally — short envelopes, no sampling.

class SFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
    } catch (e) { console.warn("audio init fail", e); }
  }

  // single tone with ADSR-ish envelope
  tone(freq, dur = 0.12, type = "sine", vol = 0.16, when = 0, slide = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(40, freq), t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // noise burst (for whooshes, hits)
  noise(dur = 0.2, vol = 0.15, filterFreq = 800, when = 0) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime + when;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  click()   { this.tone(660, 0.05, "square", 0.06); }
  tick()    { this.tone(1200, 0.03, "square", 0.05); }
  whoosh()  { this.noise(0.25, 0.08, 1200); this.tone(200, 0.25, "sawtooth", 0.05, 0, 600); }
  bonk()    { this.tone(160, 0.14, "square", 0.2, 0, -60); this.tone(90, 0.18, "sine", 0.16, 0.02, -30); }
  pop()     { this.tone(880, 0.08, "triangle", 0.12, 0, 220); }
  reveal()  { this.tone(440, 0.06, "triangle", 0.1, 0, 220); this.tone(660, 0.08, "sine", 0.08, 0.04, 220); }
  card()    { this.tone(440, 0.04, "square", 0.05, 0, 120); }
  chip()    { this.tone(1400, 0.05, "sine", 0.09); this.tone(1800, 0.05, "sine", 0.06, 0.05); }
  coin()    { this.tone(880, 0.08, "triangle", 0.1); this.tone(1320, 0.12, "sine", 0.08, 0.06); }
  win()     { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, "triangle", 0.14, i * 0.07)); }
  big()     { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.2, "triangle", 0.16, i * 0.08)); this.tone(1568, 0.4, "sine", 0.1, 0.42); }
  mega()    { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, "sawtooth", 0.1, i * 0.09)); [2093, 2637].forEach((f, i) => this.tone(f, 0.3, "sine", 0.08, 0.6 + i * 0.1)); }
  jackpot() { [523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.24, "triangle", 0.15, i * 0.1)); [1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, 0.5, "sine", 0.06, 0.9 + i * 0.12)); }
  lose()    { this.tone(300, 0.3, "sawtooth", 0.1, 0, -160); this.tone(180, 0.4, "sine", 0.1, 0.12, -80); }
  crash()   { this.noise(0.6, 0.18, 400); this.tone(120, 0.5, "sawtooth", 0.15, 0, -80); }
  fly()     { this.tone(220, 1.2, "sine", 0.05, 0, 1200); }
  tickUp()  { this.tone(1000, 0.04, "square", 0.05); }
}

export const sfx = new SFX();
