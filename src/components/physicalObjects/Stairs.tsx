import { CuboidCollider, RigidBody } from "@react-three/rapier";

const STEP_COUNT = 40;
const STEP_WIDTH = 28;
const STEP_DEPTH = 1.5;
const STEP_HEIGHT = 0.7;

export function Stairs() {
  return (
    <>
      {Array.from({ length: STEP_COUNT }, (_, index) => {
        const height = STEP_HEIGHT * (STEP_COUNT - index);
        const z = (index + 0.5) * STEP_DEPTH;

        return (
          <RigidBody
            key={index}
            type="fixed"
            name={`stair-${index}`}
            friction={0}
            restitution={0.3}
          >
            <mesh receiveShadow position={[0, height / 2, z]}>
              <boxGeometry args={[STEP_WIDTH, height, STEP_DEPTH]} />
              <meshStandardMaterial
                color={index % 2 === 0 ? "#666666" : "#707070"}
                roughness={0.75}
              />
            </mesh>

            <CuboidCollider
              args={[STEP_WIDTH / 2, height / 2, STEP_DEPTH / 2]}
              position={[0, height / 2, z]}
            />
          </RigidBody>
        );
      })}
    </>
  );
}
