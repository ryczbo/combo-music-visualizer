// Anything a wheel can ask to play when a bead hits a surface.
export type NotePlayer = {
  playNote: (note: string, velocity?: number) => void;
};
