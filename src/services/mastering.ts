const SATURATION_SHAPE = 2;
const MAX_SATURATION_PRE_GAIN = 16;
const CURVE_SIZE = 2048;
const LIMITER_CEILING_DB = -1;
const MAX_LIMITER_DRIVE_DB = 12;

const dbToGain = (db: number) => 10 ** (db / 20);

// Unity gain for small signals, soft-clipping toward a ceiling.
function createSaturationCurve() {
  const curve = new Float32Array(CURVE_SIZE);
  for (let index = 0; index < CURVE_SIZE; index += 1) {
    const x = (index * 2) / (CURVE_SIZE - 1) - 1;
    curve[index] = Math.tanh(SATURATION_SHAPE * x) / SATURATION_SHAPE;
  }
  return curve;
}

// Pushes the signal into a soft clipper (the voices are quiet, so the drive
// must scale with the amount to be audible) and blends it with the clean signal.
export class Saturator {
  readonly input: GainNode;

  readonly output: GainNode;

  private dry: GainNode;

  private wet: GainNode;

  private preGain: GainNode;

  private postGain: GainNode;

  constructor(context: AudioContext, amount: number) {
    this.input = context.createGain();
    this.output = context.createGain();
    this.dry = context.createGain();
    this.wet = context.createGain();
    this.preGain = context.createGain();
    this.postGain = context.createGain();

    const shaper = context.createWaveShaper();
    shaper.curve = createSaturationCurve();
    shaper.oversample = "4x";

    this.input.connect(this.dry);
    this.dry.connect(this.output);
    this.input.connect(this.preGain);
    this.preGain.connect(shaper);
    shaper.connect(this.postGain);
    this.postGain.connect(this.wet);
    this.wet.connect(this.output);
    this.setAmount(amount, context);
  }

  setAmount(amount: number, context: AudioContext) {
    const now = context.currentTime;
    const preGain = 1 + amount * (MAX_SATURATION_PRE_GAIN - 1);
    this.preGain.gain.setTargetAtTime(preGain, now, 0.02);
    this.postGain.gain.setTargetAtTime(1 / Math.sqrt(preGain), now, 0.02);
    this.dry.gain.setTargetAtTime(1 - amount, now, 0.02);
    this.wet.gain.setTargetAtTime(amount, now, 0.02);
  }
}

export type MasterBusSettings = {
  compression: number;
  limiterDrive: number;
  masterVolume: number;
};

// Compressor with automatic makeup gain, then drive into a brick-wall limiter,
// then master volume. Loudness comes from the compressor and limiter drive;
// master volume only turns the finished signal down, so it can't clip.
export class MasterBus {
  readonly input: DynamicsCompressorNode;

  private compressor: DynamicsCompressorNode;

  private makeup: GainNode;

  private drive: GainNode;

  private master: GainNode;

  private context: AudioContext;

  constructor(context: AudioContext, settings: MasterBusSettings) {
    this.context = context;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.knee.value = 12;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.2;
    this.input = this.compressor;

    this.makeup = context.createGain();
    this.drive = context.createGain();

    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = LIMITER_CEILING_DB;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;

    this.master = context.createGain();

    this.compressor.connect(this.makeup);
    this.makeup.connect(this.drive);
    this.drive.connect(limiter);
    limiter.connect(this.master);
    this.master.connect(context.destination);

    this.setCompression(settings.compression);
    this.setLimiterDrive(settings.limiterDrive);
    this.setMasterVolume(settings.masterVolume);
  }

  // 0 leaves the signal alone; 1 is heavy compression.
  setCompression(amount: number) {
    const threshold = -4 - 24 * amount;
    const ratio = 1 + 19 * amount;
    const now = this.context.currentTime;
    this.compressor.threshold.setTargetAtTime(threshold, now, 0.02);
    this.compressor.ratio.setTargetAtTime(ratio, now, 0.02);
    const makeupDb = -threshold * (1 - 1 / ratio) * 0.5 * Math.min(1, amount * 10);
    this.makeup.gain.setTargetAtTime(dbToGain(makeupDb), now, 0.02);
  }

  // Pushes the signal harder into the limiter, up to +12 dB.
  setLimiterDrive(amount: number) {
    this.drive.gain.setTargetAtTime(
      dbToGain(amount * MAX_LIMITER_DRIVE_DB),
      this.context.currentTime,
      0.02
    );
  }

  setMasterVolume(value: number) {
    this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }
}
