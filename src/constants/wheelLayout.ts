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

export const DEFAULT_COLORS = {
  blue: "#2f6690",
  pink: "#d94f9a",
  background: "#111111",
  beads: "#a88a00",
};

// Builds the whole wheel palette from one color: its hue and saturation are
// reused at fixed lightness steps. The sector hover glow is shifted in hue so
// it never looks like the collision flash.
export function createWheelTheme(baseColor: string): WheelTheme {
  const base = new THREE.Color(baseColor);
  const { h, s } = base.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
  const saturation = Math.min(0.85, Math.max(0.5, s));
  const shade = (lightness: number, hue = h, sat = saturation) =>
    new THREE.Color().setHSL(hue, sat, lightness, THREE.SRGBColorSpace);

  return {
    wall: shade(0.15),
    wallEmissive: base,
    outerRing: shade(0.1),
    outerRingEmissive: shade(0.26),
    sector: shade(0.22),
    sectorEmissive: shade(0.3),
    sectorHoverEmissive: shade(0.6, (h + 1 - 35 / 360) % 1, 0.75),
    spoke: shade(0.22),
    spokeEmissive: shade(0.3),
  };
}
