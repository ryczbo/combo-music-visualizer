// A view is the camera's position expressed around CAMERA_TARGET.
export type CameraView = {
  // Rotation around the vertical axis, in radians (0 = in front of the wheel).
  azimuth: number;
  // Angle down from straight up, in radians (PI / 2 = level with the wheel).
  polar: number;
  distance: number;
};

export type CameraMove = {
  label: string;
  // Transition rate: a move takes 1 / speed seconds, at a constant pace.
  speed: number;
  // The slider that sets the finish position; omit for a move with no options.
  amount?: { label: string; min: number; max: number; step: number; value: number };
  // Returns the finish view; edit this to change where a move ends up.
  getFinishView: (current: CameraView, amount: number) => CameraView;
};

export const CAMERA_TARGET: [number, number, number] = [0, 0, 0];
export const CAMERA_MIN_DISTANCE = 4;
export const CAMERA_MAX_DISTANCE = 60;
export const SPEED_RANGE = { min: 0.05, max: 5, step: 0.05 };

// Sound controls a camera move can drive; min/max match the sidebar sliders.
export const MODULATION_TARGETS = {
  volume: { label: "Volume", min: 0, max: 1 },
  tone: { label: "Tone", min: 0, max: 1 },
  reverb: { label: "Reverb", min: 0, max: 1 },
  eqLow: { label: "Lows", min: -12, max: 12 },
  eqMid: { label: "Mids", min: -12, max: 12 },
  eqHigh: { label: "Trebles", min: -12, max: 12 },
  saturation: { label: "Saturation", min: 0, max: 1 },
  compression: { label: "Compressor", min: 0, max: 1 },
  limiterDrive: { label: "Limiter drive", min: 0, max: 1 },
  masterVolume: { label: "Master volume", min: 0, max: 1 },
  sustain: { label: "Sustain", min: 0, max: 1 },
  ringModulation: { label: "Ring mod", min: 0, max: 1 },
  filterFrequency: { label: "Filter freq", min: 100, max: 12000 },
  lfoRate: { label: "LFO rate", min: 0, max: 20 },
} as const;

export type ModulationTarget = keyof typeof MODULATION_TARGETS;

export type CameraModulation = {
  target: ModulationTarget | "none";
  // 1 = increase the control during the move, -1 = decrease it.
  direction: 1 | -1;
  // Share of the control's full range to travel.
  percent: number;
};

export const DEFAULT_MODULATION: CameraModulation = {
  target: "none",
  direction: 1,
  percent: 50,
};

const DEFAULT_SPEED = 0.5;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const degrees = (label: string, min: number, max: number, value: number) => ({
  label,
  min,
  max,
  step: 1,
  value,
});

export const CAMERA_MOVES = {
  zoomIn: {
    label: "Zoom in",
    speed: DEFAULT_SPEED,
    amount: { label: "Target distance", min: 4, max: 30, step: 1, value: 10 },
    // Never moves outward, even if the camera is already closer than the target.
    getFinishView: (current, amount) => ({
      ...current,
      distance: Math.min(current.distance, amount),
    }),
  },
  zoomOut: {
    label: "Zoom out",
    speed: DEFAULT_SPEED,
    amount: { label: "Target distance", min: 10, max: 60, step: 1, value: 30 },
    // Never moves inward, even if the camera is already farther than the target.
    getFinishView: (current, amount) => ({
      ...current,
      distance: Math.max(current.distance, amount),
    }),
  },
  turnLeft: {
    label: "Turn left",
    speed: DEFAULT_SPEED,
    amount: degrees("Angle", 5, 180, 45),
    getFinishView: (current, amount) => ({
      ...current,
      azimuth: current.azimuth - toRadians(amount),
    }),
  },
  turnRight: {
    label: "Turn right",
    speed: DEFAULT_SPEED,
    amount: degrees("Angle", 5, 180, 45),
    getFinishView: (current, amount) => ({
      ...current,
      azimuth: current.azimuth + toRadians(amount),
    }),
  },
  tiltUp: {
    label: "Look from above",
    speed: DEFAULT_SPEED,
    amount: degrees("Angle", 5, 90, 30),
    getFinishView: (current, amount) => ({
      ...current,
      polar: current.polar - toRadians(amount),
    }),
  },
  tiltDown: {
    label: "Look from below",
    speed: DEFAULT_SPEED,
    amount: degrees("Angle", 5, 90, 30),
    getFinishView: (current, amount) => ({
      ...current,
      polar: current.polar + toRadians(amount),
    }),
  },
  sideView: {
    label: "Side view",
    speed: 0.4,
    amount: degrees("Azimuth", -180, 180, 90),
    getFinishView: (current, amount) => ({
      ...current,
      azimuth: toRadians(amount),
      polar: Math.PI / 2,
    }),
  },
  topView: {
    label: "Top view",
    speed: 0.4,
    amount: degrees("Polar angle", 2, 90, 9),
    getFinishView: (current, amount) => ({
      ...current,
      polar: toRadians(amount),
    }),
  },
  reset: {
    label: "Reset view",
    speed: 0.4,
    amount: undefined,
    getFinishView: () => ({
      azimuth: 0,
      polar: Math.PI / 2,
      distance: 18,
    }),
  },
} satisfies Record<string, CameraMove>;

export type CameraMoveName = keyof typeof CAMERA_MOVES;

// The id lets the same command be triggered again; steps apply in order.
export type CameraCommand = {
  id: number;
  steps: { move: CameraMoveName; speed: number; amount: number }[];
};
