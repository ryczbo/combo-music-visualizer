import { OrbitControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { AudioEngine } from "../services/audioEngine";
import { BALLS } from "../constants/physicalObjectsProperties";
import { Ball } from "./physicalObjects/Ball";
import { Floor } from "./physicalObjects/Floor";

type SceneProps = {
  dropCount: number;
  audioEngine: AudioEngine;
};

export function Scene({ dropCount, audioEngine }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Physics gravity={[0, -8.81, 0]}>
        {dropCount > 0 && (
          <>
            {BALLS.map((ball, index) => (
              <Ball
                key={`${dropCount}-${index}`}
                {...ball}
                audioEngine={audioEngine}
              />
            ))}
          </>
        )}

        <Floor />
      </Physics>

      <OrbitControls />
    </>
  );
}