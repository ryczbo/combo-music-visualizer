import { useRef } from "react";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import type { BallProps } from "../../constants/physicalObjectsProperties";
import type { AudioEngine } from "../../services/audioEngine";

type BallComponentProps = BallProps & {
  started: boolean;
  audioEngine: AudioEngine;
};

export function Ball({
  note,
  boxPosition,
  color,
  linearVelocity,
  started,
  audioEngine,
}: BallComponentProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const lastCollisionTime = useRef(0);

  return (
    <RigidBody
      ref={rigidBody}
      position={boxPosition}
      linearVelocity={started ? linearVelocity : [0, 0, 0]}
      restitution={0.3}
      friction={0}
      linearDamping={0}
      angularDamping={0}
      onCollisionEnter={({ other }) => {
        const surfaceName = other.rigidBodyObject?.name ?? "";
        if (surfaceName !== "floor" && !surfaceName.startsWith("stair-")) {
          return;
        }

        if (surfaceName.startsWith("stair-")) {
          rigidBody.current?.applyImpulse({ x: 0, y: 0, z: 0.1 }, true);
        }

        const now = performance.now();
        if (now - lastCollisionTime.current < 180) return;

        lastCollisionTime.current = now;
        const impactSpeed = Math.abs(rigidBody.current?.linvel().y ?? 0);
        const velocity = Math.min(1, Math.max(0.12, (impactSpeed - 1) / 9));
        audioEngine.playNote(note, velocity);
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      <BallCollider args={[0.2]} />
    </RigidBody>
  );
}
