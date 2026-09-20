// Frequencies are kept in one place so every selectable scale uses the same
// note names for bead assignment and audio playback.
export const SCALES = {
  ePhrygianDominant: {
    E4: 329.63,
    F4: 349.23,
    "G#4": 415.3,
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
  },
  eMinorPentatonic: {
    E4: 329.63,
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
    D5: 587.33,
  },
  cMajor: {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
  },
  eMajor: {
    E4: 329.63,
    "F#4": 369.99,
    "G#4": 415.3,
    A4: 440.0,
    B4: 493.88,
    "C#5": 554.37,
    "D#5": 622.25,
  },
  aMinor: {
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
    G5: 783.99,
  },
  aHarmonicMinor: {
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
    "G#5": 830.61,
  },
  dDorian: {
    D4: 293.66,
    E4: 329.63,
    F4: 349.23,
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
  },
  cBluesMinor: {
    C4: 261.63,
    "D#4": 311.13,
    F4: 349.23,
    "F#4": 369.99,
    G4: 392.0,
    "A#4": 466.16,
  },
  gMixolydian: {
    G4: 392.0,
    A4: 440.0,
    B4: 493.88,
    C5: 523.25,
    D5: 587.33,
    E5: 659.25,
    F5: 698.46,
  },
  hirajoshi: {
    E4: 329.63,
    "F#4": 369.99,
    G4: 392.0,
    B4: 493.88,
    C5: 523.25,
  },
  wholeTone: {
    C4: 261.63,
    D4: 293.66,
    E4: 329.63,
    "F#4": 369.99,
    "G#4": 415.3,
    "A#4": 466.16,
  },
  indianxD: {
    Sa: 240.0,
    Re: 270.0,
    Ga: 288.0,
    Ma: 320.0,
    Pa: 360.0,
    Dha: 405.0,
    Ni: 432.0,
  }
} satisfies Record<string, Record<string, number>>;

export type ScaleName = keyof typeof SCALES;

export const NOTE_FREQUENCIES = SCALES.ePhrygianDominant;

// Multiple voices per note allow simultaneous balls to overlap without
// cancelling or forcibly restarting one another's gain envelopes.
export const VOICES_PER_NOTE = 4;

// Adds an octave below and above each note (three octaves total) so pitch
// pickers can offer a wider range than the scale's base octave.
export function expandScaleOctaves(
  scale: Record<string, number>
): Record<string, number> {
  const expanded: Record<string, number> = { ...scale };

  for (const [note, frequency] of Object.entries(scale)) {
    const match = note.match(/^(.*?)(\d+)$/);
    if (match) {
      const [, base, octaveText] = match;
      const octave = Number(octaveText);
      expanded[`${base}${octave - 1}`] = frequency / 2;
      expanded[`${base}${octave + 1}`] = frequency * 2;
    } else {
      expanded[`${note}3`] = frequency / 2;
      expanded[`${note}5`] = frequency * 2;
    }
  }

  return expanded;
}

// 