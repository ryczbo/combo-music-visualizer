import { OrbitControls } from "@react-three/drei";
import { AudioEngine } from "../services/audioEngine";
import { Wheel } from "./Wheel";

type SceneProps = {
  started: boolean;
  audioEngine: AudioEngine;
  randomizeKey: number;
};

export function Scene({ started, audioEngine, randomizeKey }: SceneProps) {
  return (
    <>
      {/* Lighting is kept outside the physics world because it is visual only. */}
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Wheel
        started={started}
        audioEngine={audioEngine}
        randomizeKey={randomizeKey}
      />

      <OrbitControls target={[0, 0, 0]} enablePan={false} />
    </>
  );
}