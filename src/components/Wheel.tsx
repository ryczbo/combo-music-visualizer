import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { NOTE_FREQUENCIES } from "../constants/notes";
import { AudioEngine } from "../services/audioEngine";

type WheelProps = {
  started: boolean;
  audioEngine: AudioEngine;
  randomizeKey: number;
};

type SpokeBeadProps = {
  wheel: RefObject<THREE.Group | null>;
  spokeAngle: number;
  initialDistance: number;
  color: string;
  note: string;
  audioEngine: AudioEngine;
  beadIndex: number;
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
const BEAD_COUNT = 6;

const shuffledSpokes = Array.from({ length: SPOKE_COUNT }, (_, index) => index)
  .sort(() => Math.random() - 0.5)
  .slice(0, BEAD_COUNT);
const beadNotes = Object.keys(NOTE_FREQUENCIES);

function seededRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function getRandomSpokes(count: number, seed: number) {
  return Array.from({ length: SPOKE_COUNT }, (_, index) => index)
    .sort(
      (first, second) =>
        seededRandom(seed + first * 17.23) -
        seededRandom(seed + second * 17.23)
    )
    .slice(0, count);
}

function SpokeBead({
  wheel,
  spokeAngle,
  initialDistance,
  color,
  note,
  audioEngine,
  beadIndex,
  onStateChange,
}: SpokeBeadProps) {
  const bead = useRef<THREE.Mesh>(null);
  const distance = useRef(initialDistance);
  const velocity = useRef(0);
  const lastImpactTime = useRef(-Infinity);

  useFrame((_, delta) => {
    if (!bead.current) return;

    const wheelAngle = wheel.current?.rotation.z ?? 0;
    const radialY = Math.cos(wheelAngle + spokeAngle);
    velocity.current += -9.81 * radialY * delta;
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
      if (hitHub && currentTime - lastImpactTime.current > 120) {
        audioEngine.playNote(note, 0.35);
        lastImpactTime.current = currentTime;
      }
    } else if (distance.current > maxDistance) {
      distance.current = maxDistance;
      velocity.current = -Math.abs(velocity.current) * 0.45;
      if (hitRim && currentTime - lastImpactTime.current > 120) {
        audioEngine.playNote(note, 0.35);
        lastImpactTime.current = currentTime;
      }
    }

    bead.current.position.y = distance.current;
  });

  return (
    <group rotation={[0, 0, spokeAngle]}>
      <mesh ref={bead} position={[0, initialDistance, 0.22]}>
        <sphereGeometry args={[BEAD_RADIUS, 20, 20]} />
        <meshStandardMaterial color={color} roughness={0.25} metalness={0.7} />
      </mesh>
    </group>
  );
}

export function Wheel({ started, audioEngine, randomizeKey }: WheelProps) {
  const wheel = useRef<THREE.Group>(null);
  const spokeIndices = useMemo(
    () => {
      if (randomizeKey === 0) return shuffledSpokes;

      const randomBeadCount =
        1 + Math.floor(seededRandom(randomizeKey) * SPOKE_COUNT);
      return getRandomSpokes(randomBeadCount, randomizeKey);
    },
    [randomizeKey]
  );
  const beadStates = useRef<Array<{ distance: number; velocity: number; spoke: number }>>([]);
  const beadCollisionTimes = useRef(new Map<string, number>());
  const pendingStates = useRef(
    new Map<number, { distance: number; velocity: number }>()
  );

  useEffect(() => {
    beadStates.current = [];
    pendingStates.current.clear();
    beadCollisionTimes.current.clear();
  }, [randomizeKey]);

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
      if (now - lastCollision > 120) {
        audioEngine.playNote(beadNotes[index % beadNotes.length], 0.3);
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
    if (started && wheel.current) {
      wheel.current.rotation.z -= delta * 0.7;
    }
  });

  return (
    <group ref={wheel}>
      <mesh>
        <torusGeometry args={[WHEEL_RADIUS, 0.22, 20, 96]} />
        <meshStandardMaterial color="#171a1f" roughness={0.45} metalness={0.75} />
      </mesh>

      <mesh>
        <torusGeometry args={[WHEEL_RADIUS - 0.28, 0.07, 12, 96]} />
        <meshStandardMaterial color="#c7ced8" roughness={0.25} metalness={0.9} />
      </mesh>

      {Array.from({ length: SPOKE_COUNT }, (_, index) => (
        <group
          key={index}
          rotation={[0, 0, (index / SPOKE_COUNT) * Math.PI * 2]}
        >
          <mesh position={[0, SPOKE_START + SPOKE_LENGTH / 2, 0]}>
            <cylinderGeometry args={[0.035, 0.035, SPOKE_LENGTH, 8]} />
            <meshStandardMaterial color="#b8c0ca" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      ))}

      {spokeIndices.map((spokeIndex, index) => (
        <SpokeBead
          key={`${randomizeKey}-${index}`}
          wheel={wheel}
          spokeAngle={(spokeIndex / SPOKE_COUNT) * Math.PI * 2}
          initialDistance={2.1 + index * 0.45}
          color={["#ffb52e", "#4fe3c1", "#ff6b9d", "#a78bfa", "#fb7185", "#facc15"][index]}
          note={beadNotes[index % beadNotes.length]}
          audioEngine={audioEngine}
          beadIndex={index}
          onStateChange={handleBeadState}
        />
      ))}

      <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.3, 32]} />
        <meshStandardMaterial color="#272c33" roughness={0.3} metalness={0.8} />
      </mesh>

      <mesh position={[0, 0, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.55, 24]} />
        <meshStandardMaterial color="#e2e7ed" roughness={0.2} metalness={0.95} />
      </mesh>
    </group>
  );
}
