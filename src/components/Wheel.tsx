import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Html, Text } from "@react-three/drei";
import * as THREE from "three";
import { AudioEngine } from "../services/audioEngine";

type WheelProps = {
  activeAxes: Record<"x" | "y" | "z", boolean>;
  axisDirections: Record<"x" | "y" | "z", 1 | -1>;
  axisSpeeds: Record<"x" | "y" | "z", number>;
  audioEngine: AudioEngine;
  noteOptions: string[];
  inflateHeld: boolean;
  showOuterRing: boolean;
};

type SpokeBeadProps = {
  wheel: RefObject<THREE.Group | null>;
  spokeAngle: number;
  initialDistance: number;
  note: string;
  audioEngine: AudioEngine;
  beadIndex: number;
  suppressSoundsUntil: RefObject<number>;
  hubRadius: RefObject<number>;
  hubPhase: RefObject<"idle" | "inflating" | "deflating">;
  onHubHit: () => void;
  onRimHit: () => void;
  onStateChange: (
    index: number,
    distance: number,
    velocity: number
  ) => { distance: number; velocity: number } | undefined;
};

const SPOKE_COUNT = 20;
const WHEEL_RADIUS = 4;
const SPOKE_START = 0.35;
const SPOKE_LENGTH = WHEEL_RADIUS - 0.7;
const BEAD_RADIUS = 0.16;
// Where a newly toggled-on bead drops in from along its spoke.
const BEAD_DROP_DISTANCE = SPOKE_START + SPOKE_LENGTH * 0.6;
const HUB_BASE_RADIUS = 0.42;
const HUB_MAX_RADIUS = WHEEL_RADIUS - 0.28 - 0.5;
const HUB_INFLATE_SPEED = 1.4;
const HUB_DEFLATE_SPEED = 1.4;
// Gap kept between a bead and the hub's outer edge, at the hub's resting radius.
const HUB_CONTACT_OFFSET = SPOKE_START + 0.15 - HUB_BASE_RADIUS;
// Extra outward speed given to a bead per multiple of the hub's resting size, while expanding.
const HUB_PUSH_STRENGTH = 2.5;
const RIM_RADIUS = WHEEL_RADIUS - 0.28;
const RIM_TUBE = 0.045;
// Outer ring band is four times as wide as before, with squared (flat) edges
// instead of a rounded tube, set apart from the rim by a bead-radius gap.
const OUTER_RING_WIDTH = 0.09 * 2 * 4;
const OUTER_RING_RADIUS = RIM_RADIUS + RIM_TUBE + BEAD_RADIUS + OUTER_RING_WIDTH / 2;
const OUTER_RING_INNER_RADIUS = OUTER_RING_RADIUS - OUTER_RING_WIDTH / 2;
const OUTER_RING_OUTER_RADIUS = OUTER_RING_RADIUS + OUTER_RING_WIDTH / 2;

const shuffledSpokes = Array.from({ length: SPOKE_COUNT }, (_, index) => index)
  .sort(() => Math.random() - 0.5);

// Sector base color matches the collision flash hue; hover uses a distinct teal so
// the two kinds of light-up never look the same.
const SECTOR_BASE_EMISSIVE = new THREE.Color("#1c4f7c");
const SECTOR_HOVER_EMISSIVE = new THREE.Color("#35e0c2");
const SPOKE_BASE_COLOR = new THREE.Color("#123a5e");
const SPOKE_BASE_EMISSIVE = new THREE.Color("#1c4f7c");
const SPOKE_BEAD_COLOR = new THREE.Color("#f2f7c9");
const SPOKE_BEAD_EMISSIVE = new THREE.Color("#e8f27a");

function SpokeBead({
  wheel,
  spokeAngle,
  initialDistance,
  note,
  audioEngine,
  beadIndex,
  suppressSoundsUntil,
  hubRadius,
  hubPhase,
  onHubHit,
  onRimHit,
  onStateChange,
}: SpokeBeadProps) {
  const bead = useRef<THREE.Mesh>(null);
  const beadMaterial = useRef<THREE.MeshStandardMaterial | null>(null);
  const beadFlash = useRef(0);
  const distance = useRef(initialDistance);
  const velocity = useRef(0);
  const lastImpactTime = useRef(-Infinity);

  useFrame((_, delta) => {
    if (!bead.current) return;

    const radialDirection = new THREE.Vector3(0, 1, 0)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), spokeAngle)
      .applyQuaternion(wheel.current?.quaternion ?? new THREE.Quaternion());
    const gravity = new THREE.Vector3(0, -9.81, 0);
    velocity.current += gravity.dot(radialDirection) * delta;
    velocity.current *= Math.exp(-1.8 * delta);
    const previousDistance = distance.current;
    distance.current += velocity.current * delta;
    const collisionState = onStateChange(
      beadIndex,
      distance.current,
      velocity.current
    );
    if (collisionState !== undefined) {
      distance.current = collisionState.distance;
      velocity.current = collisionState.velocity;
    }

    const minDistance = hubRadius.current + HUB_CONTACT_OFFSET;
    const maxDistance = SPOKE_START + SPOKE_LENGTH - BEAD_RADIUS;
    const currentTime = performance.now();
    const hitHub =
      previousDistance > minDistance &&
      distance.current <= minDistance &&
      velocity.current < 0;
    const hitRim =
      previousDistance < maxDistance &&
      distance.current >= maxDistance &&
      velocity.current > 0;

    if (distance.current < minDistance) {
      distance.current = minDistance;
      // A bigger, still-expanding center shoves the bead outward with more force.
      const inflatePush =
        hubPhase.current === "inflating"
          ? (hubRadius.current / HUB_BASE_RADIUS - 1) * HUB_PUSH_STRENGTH
          : 0;
      velocity.current = Math.abs(velocity.current) * 0.45 + inflatePush;
      if (hitHub) {
        onHubHit();
        beadFlash.current = 1;
      }
      if (
        hitHub &&
        currentTime > suppressSoundsUntil.current &&
        currentTime - lastImpactTime.current > 120
      ) {
        audioEngine.playNote(note, 0.35);
        lastImpactTime.current = currentTime;
      }
    } else if (distance.current > maxDistance) {
      distance.current = maxDistance;
      velocity.current = -Math.abs(velocity.current) * 0.45;
      if (hitRim) {
        onRimHit();
        beadFlash.current = 1;
      }
      if (
        hitRim &&
        currentTime > suppressSoundsUntil.current &&
        currentTime - lastImpactTime.current > 120
      ) {
        audioEngine.playNote(note, 0.35);
        lastImpactTime.current = currentTime;
      }
    }

    bead.current.position.y = distance.current;

    // Fade the bead's own light-up glow back down after a surface hit.
    beadFlash.current *= Math.exp(-6 * delta);
    if (beadMaterial.current) {
      beadMaterial.current.emissiveIntensity = beadFlash.current * 3;
      beadMaterial.current.opacity = 0.5 + beadFlash.current * 0.4;
    }
  });

  return (
    <group rotation={[0, 0, spokeAngle]}>
      <mesh ref={bead} position={[0, initialDistance, 0.22]}>
        <sphereGeometry args={[BEAD_RADIUS, 20, 20]} />
        <meshStandardMaterial
          ref={beadMaterial}
          color="#6b5900"
          emissive="#8a7000"
          emissiveIntensity={0}
          transparent
          opacity={0.5}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}

export function Wheel({
  activeAxes,
  axisDirections,
  axisSpeeds,
  audioEngine,
  noteOptions,
  inflateHeld,
  showOuterRing,
}: WheelProps) {
  const wheel = useRef<THREE.Group>(null);
  // Which spokes currently carry a bead; toggled by clicking their space.
  const [activeSpokes, setActiveSpokes] = useState<Set<number>>(
    () => new Set(shuffledSpokes.slice(0, 2))
  );
  const beadStates = useRef(new Map<number, { distance: number; velocity: number }>());
  const suppressSoundsUntil = useRef(0);
  // Per-sector note assignments the user picked from the outer ring dropdown,
  // overriding the scale's default cycling assignment.
  const [noteOverrides, setNoteOverrides] = useState<Map<number, string>>(
    new Map()
  );
  const notesKey = noteOptions.join("|");
  const [lastNotesKey, setLastNotesKey] = useState(notesKey);
  if (notesKey !== lastNotesKey) {
    setLastNotesKey(notesKey);
    setNoteOverrides(new Map());
  }
  // Which outer-ring sector currently has its note-picker dropdown open.
  const [editingSector, setEditingSector] = useState<number | null>(null);
  const axesStopped = !activeAxes.x && !activeAxes.y && !activeAxes.z;
  // Each spoke owns the "space" (sector) that follows it; that space carries a
  // fixed note and lights up on collision instead of the bead or the spoke.
  const sectorFlash = useRef(new Float32Array(SPOKE_COUNT));
  const sectorMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(SPOKE_COUNT).fill(null)
  );
  const outerSectorMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(SPOKE_COUNT).fill(null)
  );
  const spokeMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(SPOKE_COUNT).fill(null)
  );
  const hoveredSector = useRef<number | null>(null);
  const pressedSector = useRef<number | null>(null);
  const hubFlash = useRef(0);
  const hubMaterial = useRef<THREE.MeshStandardMaterial | null>(null);
  const hubMesh = useRef<THREE.Mesh>(null);
  const hubRadius = useRef(HUB_BASE_RADIUS);
  const hubPhase = useRef<"idle" | "inflating" | "deflating">("idle");
  const hasPoppedThisHold = useRef(false);

  useEffect(() => {
    if (inflateHeld) {
      hasPoppedThisHold.current = false;
      hubPhase.current = "inflating";
    } else {
      hubPhase.current = "idle";
    }
  }, [inflateHeld]);

  useEffect(() => {
    suppressSoundsUntil.current = performance.now() + 180;
  }, [axisSpeeds]);

  const noteForSpoke = (spokeIndex: number) =>
    noteOverrides.get(spokeIndex) ?? noteOptions[spokeIndex % noteOptions.length];

  const sectorAngle = (spokeIndex: number) =>
    (spokeIndex / SPOKE_COUNT) * Math.PI * 2 + Math.PI / 2;

  const flashSector = (spokeIndex: number) => {
    sectorFlash.current[spokeIndex] = 1;
  };

  const flashHub = () => {
    hubFlash.current = 1;
  };

  const toggleBeadAtSpoke = (spokeIndex: number) => {
    setActiveSpokes((current) => {
      const next = new Set(current);
      if (next.has(spokeIndex)) {
        next.delete(spokeIndex);
      } else {
        next.add(spokeIndex);
      }
      return next;
    });
  };

  const popRandomBead = () => {
    setActiveSpokes((current) => {
      if (current.size === 0) return current;
      const survivors = Array.from(current);
      const chosen = survivors[Math.floor(Math.random() * survivors.length)];
      const next = new Set(current);
      next.delete(chosen);
      return next;
    });
  };

  const handleBeadState = (
    spokeIndex: number,
    distance: number,
    velocity: number
  ) => {
    beadStates.current.set(spokeIndex, { distance, velocity });
    return undefined;
  };

  useFrame((_, delta) => {
    if (wheel.current) {
      for (const axis of ["x", "y", "z"] as const) {
        if (activeAxes[axis]) {
          wheel.current.rotation[axis] +=
            delta * axisSpeeds[axis] * 0.1 * axisDirections[axis];
        }
      }
    }

    // Fade lit-up sectors and hub back toward their resting bioluminescent glow.
    const decay = Math.exp(-6 * delta);
    for (let index = 0; index < SPOKE_COUNT; index += 1) {
      sectorFlash.current[index] *= decay;
      const material = sectorMaterials.current[index];
      if (material) {
        const isPressed = pressedSector.current === index;
        const isHovered = hoveredSector.current === index;
        const hoverAmount = isPressed ? 1 : isHovered ? 0.55 : 0;
        material.emissive.lerpColors(
          SECTOR_BASE_EMISSIVE,
          SECTOR_HOVER_EMISSIVE,
          hoverAmount
        );
        material.emissiveIntensity =
          0.5 + sectorFlash.current[index] * 4 + hoverAmount * 3;
        material.opacity = 0.15 + sectorFlash.current[index] * 0.5 + hoverAmount * 0.35;
      }

      const outerMaterial = outerSectorMaterials.current[index];
      if (outerMaterial) {
        const isPressed = pressedSector.current === index;
        const isHovered = hoveredSector.current === index;
        const hoverAmount = isPressed ? 1 : isHovered ? 0.55 : 0;
        outerMaterial.emissive.lerpColors(
          SECTOR_BASE_EMISSIVE,
          SECTOR_HOVER_EMISSIVE,
          hoverAmount
        );
        outerMaterial.emissiveIntensity =
          0.5 + sectorFlash.current[index] * 4 + hoverAmount * 3;
        outerMaterial.opacity = 0.15 + sectorFlash.current[index] * 0.5 + hoverAmount * 0.35;
      }

      const spokeMaterial = spokeMaterials.current[index];
      if (spokeMaterial) {
        const hasBead = activeSpokes.has(index);
        spokeMaterial.color.copy(hasBead ? SPOKE_BEAD_COLOR : SPOKE_BASE_COLOR);
        spokeMaterial.emissive.copy(hasBead ? SPOKE_BEAD_EMISSIVE : SPOKE_BASE_EMISSIVE);
      }
    }

    hubFlash.current *= decay;
    if (hubMaterial.current) {
      hubMaterial.current.emissiveIntensity = 0.5 + hubFlash.current * 4;
    }

    if (hubPhase.current === "inflating") {
      hubRadius.current = Math.min(
        HUB_MAX_RADIUS,
        hubRadius.current + HUB_INFLATE_SPEED * delta
      );
      if (hubRadius.current >= HUB_MAX_RADIUS) {
        if (!hasPoppedThisHold.current) {
          popRandomBead();
          hasPoppedThisHold.current = true;
        }
        // Only reverse direction once a boundary is actually reached.
        hubPhase.current = "deflating";
      }
    } else if (hubPhase.current === "deflating") {
      hubRadius.current = Math.max(
        HUB_BASE_RADIUS,
        hubRadius.current - HUB_DEFLATE_SPEED * delta
      );
      if (hubRadius.current <= HUB_BASE_RADIUS) {
        hubPhase.current = "inflating";
      }
    }

    if (hubMesh.current) {
      const scaleFactor = hubRadius.current / HUB_BASE_RADIUS;
      hubMesh.current.scale.set(scaleFactor, 1, scaleFactor);
    }
  });

  return (
    <group ref={wheel}>
      {/* Thin bioluminescent rim, translucent like a ctenophore's edge. */}
      <mesh>
        <torusGeometry args={[RIM_RADIUS, RIM_TUBE, 6, 48]} />
        <meshStandardMaterial
          color="#0a1a3c"
          emissive="#2f6690"
          emissiveIntensity={0.6}
          transparent
          opacity={0.55}
          roughness={0.35}
          metalness={0.2}
        />
      </mesh>

      {/* Squared-edge outer ring, set apart from the rim by a bead-radius gap. */}
      {showOuterRing && (
        <>
          <mesh>
            <ringGeometry
              args={[OUTER_RING_INNER_RADIUS, OUTER_RING_OUTER_RADIUS, 64]}
            />
            <meshStandardMaterial
              color="#08132e"
              emissive="#1c3f66"
              emissiveIntensity={0.6}
              transparent
              opacity={0.55}
              roughness={0.35}
              metalness={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Ring segments echoing each inner sector's collision/hover glow on the outer ring;
              clickable to reassign that sector's note once the wheel is fully stopped. */}
          {Array.from({ length: SPOKE_COUNT }, (_, index) => (
            <mesh
              key={index}
              position={[0, 0, -0.02]}
              onClick={(event) => {
                event.stopPropagation();
                if (!axesStopped) return;
                setEditingSector(index);
              }}
              onPointerOver={(event) => {
                if (!axesStopped) return;
                event.stopPropagation();
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={(event) => {
                if (!axesStopped) return;
                event.stopPropagation();
                document.body.style.cursor = "auto";
              }}
            >
              <ringGeometry
                args={[
                  OUTER_RING_INNER_RADIUS,
                  OUTER_RING_OUTER_RADIUS,
                  8,
                  1,
                  (index / SPOKE_COUNT) * Math.PI * 2 + Math.PI / 2 - Math.PI / SPOKE_COUNT,
                  (Math.PI * 2) / SPOKE_COUNT,
                ]}
              />
              <meshStandardMaterial
                ref={(material) => {
                  outerSectorMaterials.current[index] = material;
                }}
                color="#08132e"
                emissive="#1c3f66"
                emissiveIntensity={0.5}
                transparent
                opacity={0.15}
                roughness={0.3}
                metalness={0.1}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}

          {/* Note name for each outer sector, matching its connected inner sector. */}
          {Array.from({ length: SPOKE_COUNT }, (_, index) => {
            const angle = sectorAngle(index);
            return (
              <Text
                key={index}
                position={[
                  OUTER_RING_RADIUS * Math.cos(angle),
                  OUTER_RING_RADIUS * Math.sin(angle),
                  0.05,
                ]}
                fontSize={0.18}
                color="#dff6ff"
                anchorX="center"
                anchorY="middle"
              >
                {noteForSpoke(index)}
              </Text>
            );
          })}

          {editingSector !== null && (
            <Html
              position={[
                OUTER_RING_RADIUS * Math.cos(sectorAngle(editingSector)),
                OUTER_RING_RADIUS * Math.sin(sectorAngle(editingSector)),
                0.1,
              ]}
              center
            >
              <select
                autoFocus
                defaultValue={noteForSpoke(editingSector)}
                onChange={(event) => {
                  const spokeIndex = editingSector;
                  setNoteOverrides((current) => {
                    const next = new Map(current);
                    next.set(spokeIndex, event.target.value);
                    return next;
                  });
                  setEditingSector(null);
                }}
                onBlur={() => setEditingSector(null)}
                style={{ fontSize: "14px", padding: "4px" }}
              >
                {noteOptions.map((note) => (
                  <option key={note} value={note}>
                    {note}
                  </option>
                ))}
              </select>
            </Html>
          )}
        </>
      )}

      {/* Thin dark-blue spokes, purely structural. */}
      {Array.from({ length: SPOKE_COUNT }, (_, index) => (
        <group
          key={index}
          rotation={[0, 0, (index / SPOKE_COUNT) * Math.PI * 2]}
        >
          <mesh position={[0, SPOKE_START + SPOKE_LENGTH / 2, 0]}>
            <cylinderGeometry args={[0.02, 0.02, SPOKE_LENGTH, 6]} />
            <meshStandardMaterial
              ref={(material) => {
                spokeMaterials.current[index] = material;
              }}
              color="#123a5e"
              emissive="#1c4f7c"
              emissiveIntensity={0.5}
              transparent
              opacity={0.45}
              roughness={0.3}
              metalness={0.1}
            />
          </mesh>
        </group>
      ))}

      {/* Wedge for the space centered on each spoke, lit up on that space's collision
          and clickable to add or remove that space's bead. */}
      {Array.from({ length: SPOKE_COUNT }, (_, index) => (
        <mesh
          key={index}
          position={[0, 0, -0.02]}
          onClick={(event) => {
            event.stopPropagation();
            toggleBeadAtSpoke(index);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            hoveredSector.current = index;
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={(event) => {
            event.stopPropagation();
            if (hoveredSector.current === index) hoveredSector.current = null;
            if (pressedSector.current === index) pressedSector.current = null;
            document.body.style.cursor = "auto";
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            pressedSector.current = index;
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            if (pressedSector.current === index) pressedSector.current = null;
          }}
        >
          <ringGeometry
            args={[
              SPOKE_START,
              RIM_RADIUS,
              8,
              1,
              (index / SPOKE_COUNT) * Math.PI * 2 + Math.PI / 2 - Math.PI / SPOKE_COUNT,
              (Math.PI * 2) / SPOKE_COUNT,
            ]}
          />
          <meshStandardMaterial
            ref={(material) => {
              sectorMaterials.current[index] = material;
            }}
            color="#123a5e"
            emissive="#1c4f7c"
            emissiveIntensity={0.5}
            transparent
            opacity={0.15}
            roughness={0.3}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {Array.from(activeSpokes).map((spokeIndex) => (
        <SpokeBead
          key={spokeIndex}
          wheel={wheel}
          spokeAngle={(spokeIndex / SPOKE_COUNT) * Math.PI * 2}
          initialDistance={BEAD_DROP_DISTANCE}
          note={noteForSpoke(spokeIndex)}
          audioEngine={audioEngine}
          beadIndex={spokeIndex}
          suppressSoundsUntil={suppressSoundsUntil}
          hubRadius={hubRadius}
          hubPhase={hubPhase}
          onHubHit={() => {
            flashHub();
            flashSector(spokeIndex);
          }}
          onRimHit={() => flashSector(spokeIndex)}
          onStateChange={handleBeadState}
        />
      ))}

      <mesh ref={hubMesh} position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.3, 6]} />
        <meshStandardMaterial
          ref={hubMaterial}
          color="#0a1a3c"
          emissive="#2f6690"
          emissiveIntensity={0.5}
          transparent
          opacity={0.55}
          roughness={0.35}
          metalness={0.2}
        />
      </mesh>
    </group>
  );
}
