import { NOTE_FREQUENCIES } from "./notes";

export type BallProps = {
  note: string;
  position: [number, number, number];
  color: string;
};

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

const BALL_RADIUS = 0.2;
const BALLS_PER_NOTE = 3;
const RING_SIZES = [1, 6, 12, 18, 23];
const RING_HEIGHTS = [3, 3.6, 4.2, 4.8, 5.4];

function getRingRadius(ringSize: number) {
  if (ringSize === 1) return 0;

  return (BALL_RADIUS / Math.sin(Math.PI / ringSize)) * 1.15;
}

function getRing(index: number) {
  let firstIndex = 0;

  for (let ring = 0; ring < RING_SIZES.length; ring += 1) {
    const ringSize = RING_SIZES[ring];
    if (index < firstIndex + ringSize) return ring;
    firstIndex += ringSize;
  }

  return RING_SIZES.length;
}

function shuffle<T>(items: T[]) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[randomIndex]] = [items[randomIndex], items[index]];
  }

  return items;
}

const shuffledNotes = shuffle(Object.keys(NOTE_FREQUENCIES));

export const BALLS: BallProps[] = shuffledNotes.flatMap(
  (note) => Array.from({ length: BALLS_PER_NOTE }, () => note)
).map((note, index) => {
    const ring = getRing(index);
    const ringStart = RING_SIZES
      .slice(0, ring)
      .reduce((total, size) => total + size, 0);
    const ringSize = RING_SIZES[ring];
    const ringIndex = index - ringStart;
    const angle = (ringIndex / ringSize) * Math.PI * 2;

    return {
      note,
      position: [
        Math.cos(angle) * getRingRadius(ringSize),
        RING_HEIGHTS[ring],
        Math.sin(angle) * getRingRadius(ringSize),
      ],
      color: COLORS[index % COLORS.length],
    };
  });