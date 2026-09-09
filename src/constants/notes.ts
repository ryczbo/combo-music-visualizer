// Frequencies are kept in one place so audio voices and generated ball data
// always use the same note vocabulary.
export const NOTE_FREQUENCIES: Record<string, number> = {
  E4: 329.63,
  F4: 349.23,
  "G#4": 415.3,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
};

// Multiple voices per note allow simultaneous balls to overlap without
// cancelling or forcibly restarting one another's gain envelopes.
export const VOICES_PER_NOTE = 4;