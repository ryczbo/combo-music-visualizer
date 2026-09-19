import { NOTE_FREQUENCIES, VOICES_PER_NOTE } from "../constants/notes";

export class AudioEngine {
  // The context is created lazily from the user's Start/Drop gesture.
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private toneFilter: BiquadFilterNode | null = null;

  private filterBaseFrequency = 12000;

  private filterLfo: OscillatorNode | null = null;

  private filterLfoDepth: GainNode | null = null;

  private reverbGain: GainNode | null = null;

  private ringModGain: GainNode | null = null;

  private ringModOscillator: OscillatorNode | null = null;

  private ringModDepth: GainNode | null = null;

  private sustain = 0.5;

  private oscillatorType: OscillatorType = "sine";

  private noteFrequencies: Record<string, number> = NOTE_FREQUENCIES;

  private filterType: BiquadFilterType = "lowpass";

  private lfoType: OscillatorType = "sine";

  private lfoRate = 0;

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

    // Interactive latency is preferable here because collisions are immediate
    // events rather than a long-form music stream.
    this.context = new AudioContext({ latencyHint: "interactive" });

    // Route all voices through a gain stage, compressor, makeup gain, and final
    // limiter so many simultaneous impacts remain loud without clipping.
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.8;
    this.toneFilter = this.context.createBiquadFilter();
    this.toneFilter.type = this.filterType;
    this.toneFilter.frequency.value = this.filterBaseFrequency;
    this.toneFilter.Q.value = 0.7;

    this.masterGain.connect(this.toneFilter);
    this.filterLfo = this.context.createOscillator();
    this.filterLfo.type = this.lfoType;
    this.filterLfo.frequency.value = this.lfoRate;
    this.filterLfoDepth = this.context.createGain();
    this.filterLfoDepth.gain.value = this.filterBaseFrequency * 0.45;
    this.filterLfo.connect(this.filterLfoDepth);
    this.filterLfoDepth.connect(this.toneFilter.frequency);
    this.filterLfo.start();
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 20;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.12;
    this.toneFilter.connect(this.compressor);

    const convolver = this.context.createConvolver();
    const impulseLength = this.context.sampleRate * 2.2;
    const impulse = this.context.createBuffer(
      2,
      impulseLength,
      this.context.sampleRate
    );
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let index = 0; index < impulseLength; index += 1) {
        data[index] =
          (Math.random() * 2 - 1) * Math.pow(1 - index / impulseLength, 2.4);
      }
    }
    convolver.buffer = impulse;
    this.reverbGain = this.context.createGain();
    this.reverbGain.gain.value = 0.12;
    this.toneFilter.connect(convolver);
    convolver.connect(this.reverbGain);
    this.reverbGain.connect(this.compressor);

    this.ringModGain = this.context.createGain();
    this.ringModGain.gain.value = 0;
    this.ringModDepth = this.context.createGain();
    this.ringModDepth.gain.value = 0;
    this.ringModOscillator = this.context.createOscillator();
    this.ringModOscillator.frequency.value = 35;
    this.ringModOscillator.connect(this.ringModDepth);
    this.ringModDepth.connect(this.ringModGain.gain);
    this.ringModOscillator.start();
    this.toneFilter.connect(this.ringModGain);
    this.ringModGain.connect(this.compressor);

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

  setVolume(value: number) {
    if (!this.context || !this.masterGain) return;
    this.masterGain.gain.setTargetAtTime(
      value,
      this.context.currentTime,
      0.015
    );
  }

  setTone(value: number) {
    if (!this.context || !this.toneFilter) return;
    this.setFilterFrequency(300 + value * 11700);
  }

  setFilterType(type: BiquadFilterType) {
    this.filterType = type;
    if (!this.toneFilter) return;
    this.toneFilter.type = type;
  }

  setFilterFrequency(value: number) {
    this.filterBaseFrequency = value;
    if (!this.context || !this.toneFilter) return;
    this.toneFilter.frequency.setTargetAtTime(
      value,
      this.context.currentTime,
      0.02
    );
    this.filterLfoDepth?.gain.setTargetAtTime(
      value * 0.45,
      this.context.currentTime,
      0.02
    );
  }

  setLfoType(type: OscillatorType) {
    this.lfoType = type;
    if (!this.filterLfo) return;
    this.filterLfo.type = type;
  }

  setLfoRate(value: number) {
    this.lfoRate = value;
    if (!this.context || !this.filterLfo || !this.filterLfoDepth) return;
    this.filterLfo.frequency.setTargetAtTime(
      value,
      this.context.currentTime,
      0.02
    );
    this.filterLfoDepth.gain.setTargetAtTime(
      this.filterBaseFrequency * 0.45,
      this.context.currentTime,
      0.02
    );
  }

  setReverb(value: number) {
    if (!this.context || !this.reverbGain) return;
    this.reverbGain.gain.setTargetAtTime(
      value * 0.5,
      this.context.currentTime,
      0.03
    );
  }

  setSustain(value: number) {
    this.sustain = value;
  }

  setOscillatorType(type: OscillatorType) {
    this.oscillatorType = type;
    for (const noteVoices of this.voices.values()) {
      for (const voice of noteVoices) {
        voice.oscillator.type = type;
      }
    }
  }

  setScale(noteFrequencies: Record<string, number>) {
    this.noteFrequencies = noteFrequencies;
    this.prewarmNotes();
  }

  setRingModulation(value: number) {
    if (!this.context || !this.ringModGain || !this.ringModDepth) return;
    this.ringModGain.gain.setTargetAtTime(
      value * 0.35,
      this.context.currentTime,
      0.03
    );
    this.ringModDepth.gain.setTargetAtTime(
      value,
      this.context.currentTime,
      0.03
    );
  }

  async start() {
    await this.initialize();

    if (!this.context) {
      throw new Error("AudioEngine has not been initialized.");
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    // Construct every persistent oscillator before the first ball is released.
    this.prewarmNotes();
  }

  private prewarmNotes() {
    if (!this.context || !this.masterGain) return;

    const startTime = this.context.currentTime;

    for (const [note, frequency] of Object.entries(this.noteFrequencies)) {
      if (this.voices.has(note)) continue;

      const noteVoices = [];

      for (let voiceIndex = 0; voiceIndex < VOICES_PER_NOTE; voiceIndex += 1) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();

        oscillator.type = this.oscillatorType;
        oscillator.frequency.setValueAtTime(frequency, startTime);
        // Run a silent warmup envelope so the first real collision does not pay
        // the browser's audio graph activation cost.
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

    const frequency = this.noteFrequencies[note];

    if (!frequency) {
      console.warn(`Unknown note: ${note}`);
      return;
    }

    const noteVoices = this.voices.get(note);
    if (!noteVoices) {
      console.warn("AudioEngine has not been started.");
      return;
    }

    // Round-robin voices preserve overlapping impacts of the same note.
    const cursor = this.voiceCursors.get(note) ?? 0;
    const voice = noteVoices[cursor];
    this.voiceCursors.set(note, (cursor + 1) % noteVoices.length);

    const now = this.context.currentTime;
    const gain = voice.gain.gain;
    const attackTime = now + 0.008;

    // Fade briefly before retriggering to avoid clicks when a voice is reused.
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
    gain.exponentialRampToValueAtTime(0.0001, attackTime);

    gain.exponentialRampToValueAtTime(
      0.13 * velocity,
      attackTime + 0.005
    );

    const releaseTime = attackTime + 0.15 + this.sustain * 1.35;
    gain.exponentialRampToValueAtTime(0.0001, releaseTime);
    // End at exact zero so persistent oscillators do not leave a quiet drone.
    gain.setValueAtTime(0, releaseTime);
  }
}