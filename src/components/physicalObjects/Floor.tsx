import { CuboidCollider, RigidBody } from "@react-three/rapier";

export function Floor() {
  return (
    // The name is used by Ball to distinguish floor impacts from ball contacts.
    <RigidBody type="fixed" name="floor">
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[40, 140]} />
        <meshStandardMaterial
          color="#444444"
          roughness={0.8}
        />
      </mesh>

      <CuboidCollider
        args={[20, 0.05, 70]}
        position={[0, -0.05, 0]}
      />
    </RigidBody>
  );
}
