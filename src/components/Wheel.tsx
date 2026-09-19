import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { AudioEngine } from "../services/audioEngine";

type WheelProps = {
  activeAxes: Record<"x" | "y" | "z", boolean>;
  axisDirections: Record<"x" | "y" | "z", 1 | -1>;
  axisSpeeds: Record<"x" | "y" | "z", number>;
  audioEngine: AudioEngine;
  beadCount: number;
  notes: string[];
};

type SpokeBeadProps = {
  wheel: RefObject<THREE.Group | null>;
  spokeAngle: number;
  initialDistance: number;
  note: string;
  audioEngine: AudioEngine;
  beadIndex: number;
  suppressSoundsUntil: RefObject<number>;
  onHubHit: (beadIndex: number) => void;
  onRimHit: (beadIndex: number) => void;
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

const shuffledSpokes = Array.from({ length: SPOKE_COUNT }, (_, index) => index)
  .sort(() => Math.random() - 0.5);

function SpokeBead({
  wheel,
  spokeAngle,
  initialDistance,
  note,
  audioEngine,
  beadIndex,
  suppressSoundsUntil,
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

    const minDistance = SPOKE_START + 0.15;
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
      velocity.current = Math.abs(velocity.current) * 0.45;
      if (hitHub) {
        onHubHit(beadIndex);
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
        onRimHit(beadIndex);
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
  beadCount,
  notes,
}: WheelProps) {
  const wheel = useRef<THREE.Group>(null);
  const spokeIndices = useMemo(
    () => shuffledSpokes.slice(0, beadCount),
    [beadCount]
  );
  const beadStates = useRef<Array<{ distance: number; velocity: number; spoke: number }>>([]);
  const beadCollisionTimes = useRef(new Map<string, number>());
  const pendingStates = useRef(
    new Map<number, { distance: number; velocity: number }>()
  );
  const suppressSoundsUntil = useRef(0);
  const spokeFlash = useRef(new Float32Array(SPOKE_COUNT));
  const spokeMaterials = useRef<Array<THREE.MeshStandardMaterial | null>>(
    new Array(SPOKE_COUNT).fill(null)
  );
  const hubFlash = useRef(0);
  const hubMaterial = useRef<THREE.MeshStandardMaterial | null>(null);

  useEffect(() => {
    suppressSoundsUntil.current = performance.now() + 180;
  }, [axisSpeeds]);

  const flashSpoke = (beadIndex: number) => {
    spokeFlash.current[spokeIndices[beadIndex]] = 1;
  };

  const flashHub = () => {
    hubFlash.current = 1;
  };

  const handleBeadState = (
    index: number,
    distance: number,
    velocity: number
  ) => {
    let pendingState = pendingStates.current.get(index);
    pendingStates.current.delete(index);
    const state = { distance, velocity, spoke: spokeIndices[index] };
    beadStates.current[index] = state;

    for (let otherIndex = 0; otherIndex < beadStates.current.length; otherIndex += 1) {
      if (otherIndex === index) continue;

      const other = beadStates.current[otherIndex];
      if (!other || other.spoke !== state.spoke) continue;

      const touching = Math.abs(state.distance - other.distance) <= BEAD_RADIUS * 2;
      const approaching =
        (state.distance - other.distance) * (state.velocity - other.velocity) < 0;
      if (!touching || !approaching) continue;

      const pairKey = [index, otherIndex].sort().join(":");
      const now = performance.now();
      const lastCollision = beadCollisionTimes.current.get(pairKey) ?? -Infinity;
      if (
        now > suppressSoundsUntil.current &&
        now - lastCollision > 120
      ) {
        audioEngine.playNote(notes[index % notes.length], 0.3);
        beadCollisionTimes.current.set(pairKey, now);
        const midpoint = (state.distance + other.distance) / 2;
        const separation = BEAD_RADIUS;
        const currentIsOuter = state.distance > other.distance;
        const currentDistance = midpoint + (currentIsOuter ? separation : -separation);
        const otherDistance = midpoint + (currentIsOuter ? -separation : separation);
        const minDistance = SPOKE_START + 0.15;
        const maxDistance = SPOKE_START + SPOKE_LENGTH - BEAD_RADIUS;
        const currentAtBoundary =
          Math.abs(state.distance - minDistance) < 0.03 ||
          Math.abs(state.distance - maxDistance) < 0.03;
        const otherAtBoundary =
          Math.abs(other.distance - minDistance) < 0.03 ||
          Math.abs(other.distance - maxDistance) < 0.03;

        if (currentAtBoundary || otherAtBoundary) {
          const boundaryIsCurrent = currentAtBoundary;
          const boundaryDistance = boundaryIsCurrent
            ? state.distance
            : other.distance;
          const movingDistance = boundaryIsCurrent
            ? boundaryDistance + (currentIsOuter ? -separation : separation)
            : boundaryDistance + (currentIsOuter ? separation : -separation);

          pendingState = boundaryIsCurrent
            ? { distance: boundaryDistance, velocity: 0 }
            : {
                distance: movingDistance,
                velocity: -state.velocity * 0.45,
              };
          pendingStates.current.set(otherIndex, boundaryIsCurrent
            ? { distance: movingDistance, velocity: -other.velocity * 0.45 }
            : { distance: boundaryDistance, velocity: 0 });
        } else {
          pendingState = {
            distance: currentDistance,
            velocity: -state.velocity * 0.45,
          };
          pendingStates.current.set(otherIndex, {
            distance: otherDistance,
            velocity: -other.velocity * 0.45,
          });
        }
      }
    }

    return pendingState;
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

    // Fade lit-up spokes and hub back toward their resting bioluminescent glow.
    const decay = Math.exp(-6 * delta);
    for (let index = 0; index < SPOKE_COUNT; index += 1) {
      spokeFlash.current[index] *= decay;
      const material = spokeMaterials.current[index];
      if (material) {
        material.emissiveIntensity = 0.5 + spokeFlash.current[index] * 4;
        material.opacity = 0.45 + spokeFlash.current[index] * 0.5;
      }
    }

    hubFlash.current *= decay;
    if (hubMaterial.current) {
      hubMaterial.current.emissiveIntensity = 0.5 + hubFlash.current * 4;
    }
  });

  return (
    <group ref={wheel}>
      {/* Thin bioluminescent rim, translucent like a ctenophore's edge. */}
      <mesh>
        <torusGeometry args={[WHEEL_RADIUS - 0.28, 0.045, 6, 48]} />
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

      {/* Thin dark-blue spokes, lit up individually on impact. */}
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

      {spokeIndices.map((spokeIndex, index) => (
        <SpokeBead
          key={index}
          wheel={wheel}
          spokeAngle={(spokeIndex / SPOKE_COUNT) * Math.PI * 2}
          initialDistance={2.1 + index * 0.45}
          note={notes[index % notes.length]}
          audioEngine={audioEngine}
          beadIndex={index}
          suppressSoundsUntil={suppressSoundsUntil}
          onHubHit={flashHub}
          onRimHit={flashSpoke}
          onStateChange={handleBeadState}
        />
      ))}

      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
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
