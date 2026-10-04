import { SCALES, expandScaleOctaves, type ScaleName } from "./notes";
import { DRUM_SOUNDS } from "../services/drumEngine";

export type BeadStartingPosition = "start" | "middle" | "end";

export type PatternBead = {
  spoke: number;
  startingPosition: BeadStartingPosition;
  note: string;
};

// Everything that is configured per wheel; patterns share activeness and length.
export type WheelConfig = {
  sectionCount: number;
  beads: PatternBead[];
  scaleName: ScaleName;
  volume: number;
  tone: number;
  reverb: number;
  sustain: number;
  ringModulation: number;
  oscillatorType: OscillatorType;
  filterType: BiquadFilterType;
  filterFrequency: number;
  lfoType: OscillatorType;
  lfoRate: number;
};

export const MAX_SECTIONS = 20;

export function getScaleNoteNames(scaleName: ScaleName) {
  return Object.entries(expandScaleOctaves(SCALES[scaleName]))
    .sort((left, right) => left[1] - right[1])
    .map(([note]) => note);
}

export function createDefaultBead(
  index: number,
  spoke = index,
  scaleName: ScaleName = "ePhrygianDominant",
  // Overrides the scale's notes, e.g. with drum sounds.
  noteNames: readonly string[] = getScaleNoteNames(scaleName)
): PatternBead {
  const positions: BeadStartingPosition[] = ["start", "middle", "end"];
  return {
    spoke,
    startingPosition: positions[index % positions.length],
    note: noteNames[index % noteNames.length],
  };
}

export function createDefaultWheelConfig(
  sectionCount = MAX_SECTIONS,
  scaleName: ScaleName = "ePhrygianDominant"
): WheelConfig {
  return {
    sectionCount,
    beads: [createDefaultBead(0, 0, scaleName), createDefaultBead(1, 1, scaleName)],
    scaleName,
    volume: 0.8,
    tone: 1,
    reverb: 0.24,
    sustain: 0.5,
    ringModulation: 0,
    oscillatorType: "sine",
    filterType: "lowpass",
    filterFrequency: 12000,
    lfoType: "sine",
    lfoRate: 0,
  };
}

// The pink wheel plays one bead per drum sound by default.
export function createDefaultDrumConfig(sectionCount = 8): WheelConfig {
  return {
    ...createDefaultWheelConfig(sectionCount),
    beads: DRUM_SOUNDS.map((_, index) =>
      createDefaultBead(index, index, "custom", DRUM_SOUNDS)
    ),
  };
}

const firstFreeSpoke = (sectionCount: number, usedSpokes: Set<number>) =>
  Array.from({ length: sectionCount }, (_, candidate) => candidate).find(
    (candidate) => !usedSpokes.has(candidate)
  );

// Fills in defaults and repairs saved wheel data (legacy beadCount, duplicate spokes).
export function normalizeWheelConfig<T extends WheelConfig>(
  saved: Partial<T> & { beadCount?: number },
  defaults: T,
  maxSections = MAX_SECTIONS,
  noteNames?: readonly string[]
): T {
  const { beadCount, beads: savedBeads, ...savedSettings } = saved as Partial<WheelConfig> & {
    beadCount?: number;
  };
  const sectionCount = Math.min(
    savedSettings.sectionCount ?? defaults.sectionCount,
    maxSections
  );
  const scaleName = savedSettings.scaleName ?? defaults.scaleName;
  const usedSpokes = new Set<number>();
  const beads = Array.isArray(savedBeads)
    ? savedBeads.slice(0, sectionCount).map((bead, index) => {
        const savedSpoke = Number.isInteger(bead.spoke) ? bead.spoke : index;
        const spoke =
          savedSpoke >= 0 && savedSpoke < sectionCount && !usedSpokes.has(savedSpoke)
            ? savedSpoke
            : firstFreeSpoke(sectionCount, usedSpokes) ?? 0;
        usedSpokes.add(spoke);
        const fallbackNote = createDefaultBead(index, spoke, scaleName, noteNames).note;
        return {
          spoke,
          startingPosition: bead.startingPosition ?? "middle",
          // Notes saved for a different sound set are replaced.
          note:
            bead.note && (!noteNames || noteNames.includes(bead.note))
              ? bead.note
              : fallbackNote,
        };
      })
    : Array.from(
        { length: Math.min(sectionCount, beadCount ?? defaults.beads.length) },
        (_, index) => createDefaultBead(index, index, scaleName, noteNames)
      );
  return { ...defaults, ...savedSettings, sectionCount, scaleName, beads } as T;
}

// The helpers below return the config changes needed for one control, so a
// single slider can update several fields at once.
export function sectionCountPatch(
  config: WheelConfig,
  value: number
): Partial<WheelConfig> {
  const usedSpokes = new Set<number>();
  const beads = config.beads.slice(0, value).map((bead, index) => {
    const spoke =
      bead.spoke >= 0 && bead.spoke < value && !usedSpokes.has(bead.spoke)
        ? bead.spoke
        : firstFreeSpoke(value, usedSpokes) ?? index;
    usedSpokes.add(spoke);
    return { ...bead, spoke };
  });
  const beadsChanged =
    beads.length !== config.beads.length ||
    beads.some((bead, index) => bead.spoke !== config.beads[index]?.spoke);
  return beadsChanged ? { sectionCount: value, beads } : { sectionCount: value };
}

export function beadCountPatch(
  config: WheelConfig,
  value: number,
  noteNames?: readonly string[]
): Partial<WheelConfig> {
  const targetCount = Math.min(value, config.sectionCount);
  const beads = config.beads.slice(0, targetCount);
  const usedSpokes = new Set(beads.map((bead) => bead.spoke));
  for (let index = beads.length; index < targetCount; index += 1) {
    const spoke = firstFreeSpoke(config.sectionCount, usedSpokes);
    if (spoke === undefined) break;
    usedSpokes.add(spoke);
    beads.push(createDefaultBead(index, spoke, config.scaleName, noteNames));
  }
  return { beads };
}

export function scalePatch(
  config: WheelConfig,
  scaleName: ScaleName
): Partial<WheelConfig> {
  const scaleNotes = getScaleNoteNames(scaleName);
  return {
    scaleName,
    beads: config.beads.map((bead, index) => ({
      ...bead,
      note: scaleNotes[index % scaleNotes.length],
    })),
  };
}
