import type { NotePlayer } from "./notePlayer";
import { createEqBands } from "./eq";
import { MasterBus, Saturator } from "./mastering";

export const DRUM_SOUNDS = ["Kick", "Snare", "Hihat", "Crash"] as const;

export type DrumSound = (typeof DRUM_SOUNDS)[number];

const NOISE_SECONDS = 2;
const REVERB_SECONDS = 1.6;

// Synthesized percussion with its own output chain, so it can sit next to the
// melodic AudioEngine; it only exposes the controls that make sense for drums.
export class DrumEngine implements NotePlayer {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private toneFilter: BiquadFilterNode | null = null;

  private eqBands: BiquadFilterNode[] = [];

  private eqGains = [0, 0, 0];

  private masterBus: MasterBus | null = null;

  private saturator: Saturator | null = null;

  private mastering = {
    saturation: 0,
    compression: 0.5,
    limiterDrive: 0.5,
    masterVolume: 1,
  };

  private reverbGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private volume = 0.8;

  private tone = 1;

  private reverb = 0.24;

  async start() {
    if (!this.context) this.initialize();
    if (this.context?.state === "suspended") await this.context.resume();
  }

  private initialize() {
    const context = new AudioContext({ latencyHint: "interactive" });
    this.context = context;

    this.masterGain = context.createGain();
    this.toneFilter = context.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.reverbGain = context.createGain();
    const convolver = context.createConvolver();
    this.masterBus = new MasterBus(context, this.mastering);
    const busInput = this.masterBus.input;
    this.eqBands = createEqBands(context, this.eqGains);
    this.eqBands.forEach((band, index) => {
      if (index > 0) this.eqBands[index - 1].connect(band);
    });

    this.saturator = new Saturator(context, this.mastering.saturation);
    this.masterGain.connect(this.eqBands[0]);
    this.eqBands[2].connect(this.saturator.input);
    this.saturator.output.connect(this.toneFilter);
    this.toneFilter.connect(busInput);
    this.toneFilter.connect(this.reverbGain);
    this.reverbGain.connect(convolver);
    convolver.connect(busInput);
    this.noiseBuffer = this.createNoise(context, NOISE_SECONDS);
    convolver.buffer = this.createImpulse(context);
    this.setVolume(this.volume);
    this.setTone(this.tone);
    this.setReverb(this.reverb);
  }

  private createNoise(context: AudioContext, seconds: number) {
    const buffer = context.createBuffer(
      1,
      Math.floor(context.sampleRate * seconds),
      context.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private createImpulse(context: AudioContext) {
    const buffer = this.createNoise(context, REVERB_SECONDS);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] *= (1 - index / data.length) ** 3;
    }
    return buffer;
  }

  setVolume(value: number) {
    this.volume = value;
    if (this.masterGain) this.masterGain.gain.value = value;
  }

  // 0 is muffled, 1 is fully open.
  setTone(value: number) {
    this.tone = value;
    if (this.toneFilter) this.toneFilter.frequency.value = 400 + value * 15600;
  }

  // Gains are in dB: low shelf, mid peak, high shelf.
  setEq(low: number, mid: number, high: number) {
    this.eqGains = [low, mid, high];
    if (!this.context) return;
    this.eqBands.forEach((band, index) =>
      band.gain.setTargetAtTime(this.eqGains[index], this.context!.currentTime, 0.02)
    );
  }

  setSaturation(value: number) {
    this.mastering.saturation = value;
    if (this.context) this.saturator?.setAmount(value, this.context);
  }

  setCompression(value: number) {
    this.mastering.compression = value;
    this.masterBus?.setCompression(value);
  }

  setLimiterDrive(value: number) {
    this.mastering.limiterDrive = value;
    this.masterBus?.setLimiterDrive(value);
  }

  setMasterVolume(value: number) {
    this.mastering.masterVolume = value;
    this.masterBus?.setMasterVolume(value);
  }

  setReverb(value: number) {
    this.reverb = value;
    if (this.reverbGain) this.reverbGain.gain.value = value;
  }

  playNote(note: string, velocity = 1) {
    const context = this.context;
    if (!context || !this.masterGain) return;

    const level = Math.min(1, velocity * 2.5);
    const now = context.currentTime;
    switch (note) {
      case "Kick":
        this.playNoise(context, now, level * 0.6, 7000, 0.06);
        break;
      case "Snare":
       this.playNoise(context, now, level * 0.6, 7000, 0.06);
        break;
      case "Hihat":
       this.playNoise(context, now, level * 0.6, 7000, 0.06);
        break;
      case "Crash":
        this.playNoise(context, now, level * 0.6, 7000, 0.06);
        break;
    }
  }

  private envelope(context: AudioContext, start: number, peak: number, length: number) {
    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + length);
    gain.connect(this.masterGain!);
    return gain;
  }

  // private playKick(context: AudioContext, start: number, level: number) {
  //   const oscillator = context.createOscillator();
  //   oscillator.frequency.setValueAtTime(160, start);
  //   oscillator.frequency.exponentialRampToValueAtTime(42, start + 0.12);
  //   oscillator.connect(this.envelope(context, start, level, 0.45));
  //   oscillator.start(start);
  //   oscillator.stop(start + 0.5);
  // }

  // private playSnare(context: AudioContext, start: number, level: number) {
  //   const body = context.createOscillator();
  //   body.type = "triangle";
  //   body.frequency.setValueAtTime(190, start);
  //   body.connect(this.envelope(context, start, level * 0.6, 0.12));
  //   body.start(start);
  //   body.stop(start + 0.15);

  //   this.playNoise(context, start, level * 0.8, 1500, 0.2);
  // }

  private playNoise(
    context: AudioContext,
    start: number,
    level: number,
    highpass: number,
    length: number
  ) {
    const source = context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    source.connect(filter);
    filter.connect(this.envelope(context, start, level, length));
    source.start(start);
    source.stop(start + length + 0.05);
  }
}
