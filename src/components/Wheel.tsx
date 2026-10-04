import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Html, Text } from "@react-three/drei";
import * as THREE from "three";
import type { NotePlayer } from "../services/notePlayer";
import {
  BEAD_RADIUS,
  OUTER_RING_INNER_RADIUS,
  OUTER_RING_OUTER_RADIUS,
  OUTER_RING_RADIUS,
  RIM_RADIUS,
  WHEEL_OUTER_RADIUS,
  WHEEL_RADIUS,
  type WheelTheme,
} from "../constants/wheelLayout";

type PatternBead = {
  spoke: number;
  note: string;
};

type WheelProps = {
  spinning: boolean;
  spinDirection: 1 | -1;
  spinSpeed: number;
  audioEngine: NotePlayer;
  noteOptions: string[];
  scaleNotes: string[];
  inflateHeld: boolean;
  showOuterRing: boolean;
  sectionCount: number;
  beads: PatternBead[];
  onBeadsChange: (beads: PatternBead[]) => void;
  onBeadNoteChange: (beads: PatternBead[]) => void;
  onSectionTurn: () => void;
  theme: WheelTheme;
  beadColor: string;
  position?: [number, number, number];
  scale?: number;
  // Spin rate relative to the spin speed setting; negative turns the other way.
  rotationRatio?: number;
};

type SpokeBeadProps = {
  wheel: RefObject<THREE.Group | null>;
  spokeAngle: number;
  initialDistance: number;
  note: string;
  color: string;
  // Inactive beads still move with the wheel but are silent and never light up.
  active: boolean;
  audioEngine: NotePlayer;
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

const SPOKE_START = 0.35;
const SPOKE_LENGTH = WHEEL_RADIUS - 0.7;
// Where a newly toggled-on bead drops in from along its spoke.
const BEAD_DROP_DISTANCE = SPOKE_START + SPOKE_LENGTH * 0.5;
const HUB_BASE_RADIUS = 0.42;
const HUB_MAX_RADIUS = WHEEL_RADIUS - 0.28 - 0.5;
const HUB_INFLATE_SPEED = 1.4;
const HUB_DEFLATE_SPEED = 1.4;
// Gap kept between a bead and the hub's outer edge, at the hub's resting radius.
const HUB_CONTACT_OFFSET = SPOKE_START + 0.15 - HUB_BASE_RADIUS;
// Extra outward speed given to a bead per multiple of the hub's resting size, while expanding.
const HUB_PUSH_STRENGTH = 2.5;
// The wall is as thick (deep) as the hub; its inner face is where beads bounce.
const WALL_DEPTH = 0.3;
const WALL_INNER_RADIUS = SPOKE_START + SPOKE_LENGTH;
const WALL_OUTER_RADIUS = WHEEL_OUTER_RADIUS;
const WALL_PROFILE = [
  new THREE.Vector2(WALL_INNER_RADIUS, -WALL_DEPTH / 2),
  new THREE.Vector2(WALL_OUTER_RADIUS, -WALL_DEPTH / 2),
  new THREE.Vector2(WALL_OUTER_RADIUS, WALL_DEPTH / 2),
  new THREE.Vector2(WALL_INNER_RADIUS, WALL_DEPTH / 2),
  new THREE.Vector2(WALL_INNER_RADIUS, -WALL_DEPTH / 2),
];


function SpokeBead({
  wheel,
  spokeAngle,
  initialDistance,
  note,
  color,
  active,
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

  useEffect(() => {
    distance.current = initialDistance;
    velocity.current = 0;
  }, [initialDistance]);

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
      active &&
      previousDistance > minDistance &&
      distance.current <= minDistance &&
      velocity.current < 0;
    const hitRim =
      active &&
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
      <mesh ref={bead} visible={active} position={[0, initialDistance, 0.22]}>
        <sphereGeometry args={[BEAD_RADIUS, 20, 20]} />
        <meshStandardMaterial
          ref={beadMaterial}
          color={color}
          emissive={color}
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
  spinning,
  spinDirection,
  spinSpeed,
  audioEngine,
  noteOptions,
  scaleNotes,
  inflateHeld,
  showOuterRing,
  sectionCount,
  beads,
  onBeadsChange,
  onBeadNoteChange,
  onSectionTurn,
  theme,
  beadColor,
  position = [0, 0, 0],
  scale = 1,
  rotationRatio = 1,
}: WheelProps) {
  const wheel = useRef<THREE.Group>(null);
  // Spokes with an active bead glow in a lighter shade of the bead color.
  const spokeHighlight = useMemo(
    () => ({
      color: new THREE.Color(beadColor).offsetHSL(0, 0, 0.3),
      emissive: new THREE.Color(beadColor),
    }),
    [beadColor]
  );
  // Accumulated rotation toward the next section boundary.
  const spinProgress = useRef(0);
  const activeSpokes = useMemo(
    () => new Set(beads.map((bead) => bead.spoke)),
    [beads]
  );
  const beadStates = useRef(new Map<number, { distance: number; velocity: number }>());
  const suppressSoundsUntil = useRef(0);
  // Which outer-ring sector currently has its bead editor open.
  const [editingSector, setEditingSector] = useState<number | null>(null);
  const axesStopped = !spinning;
  // Each spoke owns the "space" (sector) that follows it; that space carries a
  // fixed note and lights up on collision instead of the bead or the spoke.
  const sectorFlash = useRef(new Float32Array(sectionCount));
  const sectorMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(sectionCount).fill(null)
  );
  const outerSectorMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(sectionCount).fill(null)
  );
  const spokeMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(sectionCount).fill(null)
  );
  const hoveredSector = useRef<number | null>(null);
  const pressedSector = useRef<number | null>(null);

  // Resize per-sector ref arrays whenever the section count changes.
  useEffect(() => {
    sectorFlash.current = new Float32Array(sectionCount);
    sectorMaterials.current = new Array(sectionCount).fill(null);
    outerSectorMaterials.current = new Array(sectionCount).fill(null);
    spokeMaterials.current = new Array(sectionCount).fill(null);
    hoveredSector.current = null;
    pressedSector.current = null;
  }, [sectionCount]);

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
  }, [spinSpeed]);

  const beadIndexForSpoke = (spokeIndex: number) =>
    beads.findIndex((bead) => bead.spoke === spokeIndex);

  const noteForSpoke = (spokeIndex: number) => {
    const beadIndex = beadIndexForSpoke(spokeIndex);
    return beadIndex >= 0
      ? beads[beadIndex]?.note ?? noteOptions[0]
      : scaleNotes[spokeIndex % scaleNotes.length];
  };

  const updateNoteAtSpoke = (spokeIndex: number, note: string) => {
    const beadIndex = beadIndexForSpoke(spokeIndex);
    if (beadIndex >= 0) {
      onBeadNoteChange(
        beads.map((bead, index) =>
          index === beadIndex ? { ...bead, note } : bead
        )
      );
      return;
    }

    if (beads.length >= sectionCount) return;
    onBeadNoteChange([...beads, { spoke: spokeIndex, note }]);
  };

  const sectorAngle = (spokeIndex: number) =>
    (spokeIndex / sectionCount) * Math.PI * 2 + Math.PI / 2;

  const flashSector = (spokeIndex: number) => {
    sectorFlash.current[spokeIndex] = 1;
  };

  const flashHub = () => {
    hubFlash.current = 1;
  };

  const toggleBeadAtSpoke = (spokeIndex: number) => {
    const beadIndex = beadIndexForSpoke(spokeIndex);
    if (beadIndex >= 0) {
      onBeadsChange(beads.filter((_, index) => index !== beadIndex));
    } else if (beads.length < sectionCount) {
      onBeadsChange([
        ...beads,
        {
          spoke: spokeIndex,
          note: scaleNotes[spokeIndex % scaleNotes.length],
        },
      ]);
    }
  };

  const popRandomBead = () => {
    if (beads.length === 0) return;
    const beadIndex = Math.floor(Math.random() * beads.length);
    onBeadsChange(beads.filter((_, index) => index !== beadIndex));
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
    if (wheel.current && spinning) {
      const rotationDelta =
        delta * spinSpeed * 0.1 * spinDirection * rotationRatio;
      wheel.current.rotation.z += rotationDelta;
      spinProgress.current += Math.abs(rotationDelta);
      const sectionAngle = (Math.PI * 2) / sectionCount;
      while (spinProgress.current >= sectionAngle) {
        spinProgress.current -= sectionAngle;
        onSectionTurn();
      }
    }

    // Fade lit-up sectors and hub back toward their resting bioluminescent glow.
    const decay = Math.exp(-6 * delta);
    for (let index = 0; index < sectionCount; index += 1) {
      sectorFlash.current[index] *= decay;
      const material = sectorMaterials.current[index];
      if (material) {
        const isPressed = pressedSector.current === index;
        const isHovered = hoveredSector.current === index;
        const hoverAmount = isPressed ? 1 : isHovered ? 0.55 : 0;
        material.emissive.lerpColors(
          theme.sectorEmissive,
          theme.sectorHoverEmissive,
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
          theme.sectorEmissive,
          theme.sectorHoverEmissive,
          hoverAmount
        );
        outerMaterial.emissiveIntensity =
          0.5 + sectorFlash.current[index] * 4 + hoverAmount * 3;
        outerMaterial.opacity = 0.15 + sectorFlash.current[index] * 0.5 + hoverAmount * 0.35;
      }

      const spokeMaterial = spokeMaterials.current[index];
      if (spokeMaterial) {
        const hasBead = activeSpokes.has(index);
        spokeMaterial.color.copy(hasBead ? spokeHighlight.color : theme.spoke);
        spokeMaterial.emissive.copy(hasBead ? spokeHighlight.emissive : theme.spokeEmissive);
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
    <group ref={wheel} position={position} scale={scale}>
      {/* Solid wall as deep as the hub, so beads visibly hit it. */}
      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <latheGeometry args={[WALL_PROFILE, 96]} />
        <meshStandardMaterial
          color={theme.wall}
          emissive={theme.wallEmissive}
          emissiveIntensity={0.6}
          transparent
          opacity={0.8}
          roughness={0.35}
          metalness={0.2}
          side={THREE.DoubleSide}
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
              color={theme.outerRing}
              emissive={theme.outerRingEmissive}
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
          {Array.from({ length: sectionCount }, (_, index) => (
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
                  (index / sectionCount) * Math.PI * 2 + Math.PI / 2 - Math.PI / sectionCount,
                  (Math.PI * 2) / sectionCount,
                ]}
              />
              <meshStandardMaterial
                ref={(material) => {
                  outerSectorMaterials.current[index] = material;
                }}
                color={theme.outerRing}
                emissive={theme.outerRingEmissive}
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
          {Array.from({ length: sectionCount }, (_, index) => {
            const angle = sectorAngle(index);
            return (
              <Text
                key={index}
                position={[
                  OUTER_RING_RADIUS * Math.cos(angle),
                  OUTER_RING_RADIUS * Math.sin(angle),
                  0.05,
                ]}
                fontSize={0.18 / Math.sqrt(scale)}
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
              <div
                onPointerDown={(event) => event.stopPropagation()}
                style={{
                  display: "grid",
                  gap: "5px",
                  padding: "6px",
                  background: "rgba(10, 20, 40, 0.95)",
                  borderRadius: "6px",
                }}
              >
                <select
                  autoFocus
                  value={noteForSpoke(editingSector)}
                  onChange={(event) =>
                    updateNoteAtSpoke(editingSector, event.target.value)
                  }
                  style={{ fontSize: "14px", padding: "4px" }}
                >
                  {noteOptions.map((note) => (
                    <option key={note} value={note}>
                      {note}
                    </option>
                  ))}
                </select>
                <button onClick={() => setEditingSector(null)}>Done</button>
              </div>
            </Html>
          )}
        </>
      )}

      {/* Thin dark-blue spokes, purely structural. */}
      {Array.from({ length: sectionCount }, (_, index) => (
        <group
          key={index}
          rotation={[0, 0, (index / sectionCount) * Math.PI * 2]}
        >
          <mesh position={[0, SPOKE_START + SPOKE_LENGTH / 2, 0]}>
            <cylinderGeometry args={[0.02, 0.02, SPOKE_LENGTH, 6]} />
            <meshStandardMaterial
              ref={(material) => {
                spokeMaterials.current[index] = material;
              }}
              color={theme.spoke}
              emissive={theme.spokeEmissive}
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
      {Array.from({ length: sectionCount }, (_, index) => (
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
              (index / sectionCount) * Math.PI * 2 + Math.PI / 2 - Math.PI / sectionCount,
              (Math.PI * 2) / sectionCount,
            ]}
          />
          <meshStandardMaterial
            ref={(material) => {
              sectorMaterials.current[index] = material;
            }}
            color={theme.sector}
            emissive={theme.sectorEmissive}
            emissiveIntensity={0.5}
            transparent
            opacity={0.15}
            roughness={0.3}
            metalness={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {Array.from({ length: sectionCount }, (_, spokeIndex) => {
        const bead = beads[beadIndexForSpoke(spokeIndex)];
        return (
          <SpokeBead
            key={spokeIndex}
            wheel={wheel}
            spokeAngle={(spokeIndex / sectionCount) * Math.PI * 2}
            initialDistance={BEAD_DROP_DISTANCE}
            note={noteForSpoke(spokeIndex)}
            color={beadColor}
            active={bead !== undefined}
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
        );
      })}

      <mesh ref={hubMesh} position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.3, 6]} />
        <meshStandardMaterial
          ref={hubMaterial}
          color={theme.wall}
          emissive={theme.wallEmissive}
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
