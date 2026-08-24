import { useRef } from "react";
import { BallCollider, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import type { BallProps } from "../../constants/physicalObjectsProperties";
import type { AudioEngine } from "../../services/audioEngine";

type BallComponentProps = BallProps & {
  audioEngine: AudioEngine;
};

export function Ball({ note, position, color, audioEngine }: BallComponentProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const lastCollisionTime = useRef(0);

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      restitution={0.9}
      friction={0.3}
      onCollisionEnter={({ other }) => {
        if (other.rigidBodyObject?.name !== "floor") return;

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