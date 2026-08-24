import { CuboidCollider, RigidBody } from "@react-three/rapier";

export function Floor() {
  return (
    <RigidBody type="fixed" name="floor">
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial
          color="#444444"
          roughness={0.8}
        />
      </mesh>

      <CuboidCollider
        args={[10, 0.05, 10]}
        position={[0, -0.05, 0]}
      />
    </RigidBody>
  );
}
