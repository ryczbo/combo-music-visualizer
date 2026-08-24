import { NOTE_FREQUENCIES, VOICES_PER_NOTE } from "../constants/notes";

export class AudioEngine {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private compressor: DynamicsCompressorNode | null = null;

  private limiter: DynamicsCompressorNode | null = null;

  private voices = new Map<
    string,
    Array<{ oscillator: OscillatorNode; gain: GainNode }>
  >();

  private voiceCursors = new Map<string, number>();

  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    this.context = new AudioContext({ latencyHint: "interactive" });

    // Master output
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.8;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 20;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.12;
    this.masterGain.connect(this.compressor);

    const makeupGain = this.context.createGain();
    makeupGain.gain.value = 2.7;
    this.compressor.connect(makeupGain);

    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;
    makeupGain.connect(this.limiter);
    this.limiter.connect(this.context.destination);

    this.initialized = true;
  }

  async start() {
    await this.initialize();

    if (!this.context) {
      throw new Error("AudioEngine has not been initialized.");
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.prewarmNotes();
  }

  private prewarmNotes() {
    if (!this.context || !this.masterGain) return;

    const startTime = this.context.currentTime;

    for (const [note, frequency] of Object.entries(NOTE_FREQUENCIES)) {
      if (this.voices.has(note)) continue;

      const noteVoices = [];

      for (let voiceIndex = 0; voiceIndex < VOICES_PER_NOTE; voiceIndex += 1) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
        gain.gain.setValueAtTime(0, startTime + 0.05);

        oscillator.connect(gain);
        gain.connect(this.masterGain);
        oscillator.start(startTime);
        noteVoices.push({ oscillator, gain });
      }

      this.voices.set(note, noteVoices);
      this.voiceCursors.set(note, 0);
    }
  }

  playNote(note: string, velocity = 1) {
    if (!this.context || !this.masterGain) {
      console.warn("AudioEngine is not ready.");
      return;
    }

    const frequency = NOTE_FREQUENCIES[note];

    if (!frequency) {
      console.warn(`Unknown note: ${note}`);
      return;
    }

    const noteVoices = this.voices.get(note);
    if (!noteVoices) {
      console.warn("AudioEngine has not been started.");
      return;
    }

    const cursor = this.voiceCursors.get(note) ?? 0;
    const voice = noteVoices[cursor];
    this.voiceCursors.set(note, (cursor + 1) % noteVoices.length);

    const now = this.context.currentTime;
    const gain = voice.gain.gain;
    const attackTime = now + 0.008;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
    gain.exponentialRampToValueAtTime(0.0001, attackTime);

    gain.exponentialRampToValueAtTime(
      0.13 * velocity,
      attackTime + 0.005
    );

    gain.exponentialRampToValueAtTime(
      0.0001,
      attackTime + 0.5
    );
    gain.setValueAtTime(0, attackTime + 0.5);
  }
}