import { OrbitControls } from "@react-three/drei";
import { AudioEngine } from "../services/audioEngine";
import { Wheel } from "./Wheel";

type SceneProps = {
  spinning: boolean;
  spinDirection: 1 | -1;
  spinSpeed: number;
  audioEngine: AudioEngine;
  noteOptions: string[];
  inflateHeld: boolean;
  showOuterRing: boolean;
  sectionCount: number;
  beadCount: number;
  onBeadCountChange: (count: number) => void;
  onFullSpin: () => void;
};

export function Scene({
  spinning,
  spinDirection,
  spinSpeed,
  audioEngine,
  noteOptions,
  inflateHeld,
  showOuterRing,
  sectionCount,
  beadCount,
  onBeadCountChange,
  onFullSpin,
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
        spinning={spinning}
        spinDirection={spinDirection}
        spinSpeed={spinSpeed}
        audioEngine={audioEngine}
        noteOptions={noteOptions}
        inflateHeld={inflateHeld}
        showOuterRing={showOuterRing}
        sectionCount={sectionCount}
        beadCount={beadCount}
        onBeadCountChange={onBeadCountChange}
        onFullSpin={onFullSpin}
      />

      <OrbitControls target={[0, 0, 0]} enablePan={false} />
    </>
  );
}