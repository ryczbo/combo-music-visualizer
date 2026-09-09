import { NOTE_FREQUENCIES } from "./notes";

export type BallProps = {
  note: string;
  position: [number, number, number];
  boxPosition: [number, number, number];
  color: string;
  delay: number;
  linearVelocity: [number, number, number];
};

// Reusing a broad palette makes neighboring balls easy to distinguish in the
// tightly packed cone. Colors repeat only after the palette is exhausted.
const COLORS = [
  "hotpink",
  "deepskyblue",
  "gold",
  "tomato",
  "mediumseagreen",
  "orchid",
  "coral",
  "skyblue",
  "khaki",
  "plum",
  "limegreen",
  "royalblue",
  "orange",
  "crimson",
  "turquoise",
  "violet",
  "salmon",
  "dodgerblue",
  "yellow",
  "indigo",
  "springgreen",
  "navy",
  "orangered",
  "mediumvioletred",
  "aqua",
  "mediumslateblue",
  "lightcoral",
  "steelblue",
  "chartreuse",
  "firebrick",
  "teal",
  "magenta",
  "darkorange",
];

const BALLS_PER_NOTE = 3;

const orderedNotes = Object.keys(NOTE_FREQUENCIES);
const orderedBallNotes = Array.from(
  { length: BALLS_PER_NOTE },
  () => orderedNotes
).flat();

// Cycle through the scale once per copy so balls are released in musical order.
export const BALLS: BallProps[] = orderedBallNotes.map((note, index) => {
    const column = (index % 9) - 4;
    const row = Math.floor(index / 9);

    return {
      note,
      position: [column * 0.45, 30 + row * 0.5, 0.7 + (index % 3) * 0.25],
      boxPosition: [
        column * 0.45,
        30.5 + row * 0.3,
        0.2 + (index % 3) * 0.35,
      ],
      color: COLORS[index % COLORS.length],
      delay: index * 90,
      linearVelocity: [0, 0, 2.5],
    };
  });