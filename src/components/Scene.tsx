import { OrbitControls } from "@react-three/drei";
import { AudioEngine } from "../services/audioEngine";
import { Wheel } from "./Wheel";

type SceneProps = {
  activeAxes: Record<"x" | "y" | "z", boolean>;
  axisDirections: Record<"x" | "y" | "z", 1 | -1>;
  axisSpeeds: Record<"x" | "y" | "z", number>;
  audioEngine: AudioEngine;
  noteOptions: string[];
  inflateHeld: boolean;
  showOuterRing: boolean;
};

export function Scene({
  activeAxes,
  axisDirections,
  axisSpeeds,
  audioEngine,
  noteOptions,
  inflateHeld,
  showOuterRing,
}: SceneProps) {
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
        activeAxes={activeAxes}
        axisDirections={axisDirections}
        axisSpeeds={axisSpeeds}
        audioEngine={audioEngine}
        noteOptions={noteOptions}
        inflateHeld={inflateHeld}
        showOuterRing={showOuterRing}
      />

      <OrbitControls target={[0, 0, 0]} enablePan={false} />
    </>
  );
}