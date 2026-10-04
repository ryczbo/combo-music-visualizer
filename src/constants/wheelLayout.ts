import * as THREE from "three";

export const WHEEL_RADIUS = 4;
export const BEAD_RADIUS = 0.16;
export const RIM_RADIUS = WHEEL_RADIUS - 0.28;
export const RIM_TUBE = 0.045;
// Outer edge of the solid wall; this is where the two wheels touch.
export const WHEEL_OUTER_RADIUS = RIM_RADIUS + RIM_TUBE;
// Outer ring band is four times as wide as before, with squared (flat) edges
// instead of a rounded tube, set apart from the rim by a bead-radius gap.
const OUTER_RING_WIDTH = 0.09 * 2 * 4;
export const OUTER_RING_RADIUS =
  RIM_RADIUS + RIM_TUBE + BEAD_RADIUS + OUTER_RING_WIDTH / 2;
export const OUTER_RING_INNER_RADIUS = OUTER_RING_RADIUS - OUTER_RING_WIDTH / 2;
export const OUTER_RING_OUTER_RADIUS = OUTER_RING_RADIUS + OUTER_RING_WIDTH / 2;

// The second wheel is a scaled copy that meshes with the first wheel's wall
// at its top left, so it turns -1 / scale times as fast in the opposite direction.
export const SECOND_WHEEL_SCALE = 1 / 2;
const COG_DISTANCE = WHEEL_OUTER_RADIUS * (1 + SECOND_WHEEL_SCALE);
export const SECOND_WHEEL_POSITION: [number, number, number] = [
  -COG_DISTANCE * Math.SQRT1_2,
  COG_DISTANCE * Math.SQRT1_2,
  0,
];
export const SECOND_WHEEL_ROTATION_RATIO = -1 / SECOND_WHEEL_SCALE;

export type WheelTheme = {
  wall: THREE.Color;
  wallEmissive: THREE.Color;
  outerRing: THREE.Color;
  outerRingEmissive: THREE.Color;
  sector: THREE.Color;
  sectorEmissive: THREE.Color;
  sectorHoverEmissive: THREE.Color;
  spoke: THREE.Color;
  spokeEmissive: THREE.Color;
};

const createTheme = (colors: Record<keyof WheelTheme, string>): WheelTheme =>
  Object.fromEntries(
    Object.entries(colors).map(([key, value]) => [key, new THREE.Color(value)])
  ) as WheelTheme;

// Sector base color matches the collision flash hue; hover uses a distinct
// color so the two kinds of light-up never look the same.
export const BLUE_WHEEL_THEME = createTheme({
  wall: "#0a1a3c",
  wallEmissive: "#2f6690",
  outerRing: "#08132e",
  outerRingEmissive: "#1c3f66",
  sector: "#123a5e",
  sectorEmissive: "#1c4f7c",
  sectorHoverEmissive: "#35e0c2",
  spoke: "#123a5e",
  spokeEmissive: "#1c4f7c",
});

export const PINK_WHEEL_THEME = createTheme({
  wall: "#3c0a2a",
  wallEmissive: "#d94f9a",
  outerRing: "#2e0820",
  outerRingEmissive: "#8a2a62",
  sector: "#5e1245",
  sectorEmissive: "#a81f6e",
  sectorHoverEmissive: "#ffb3e0",
  spoke: "#5e1245",
  spokeEmissive: "#a81f6e",
});
