import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { AudioEngine } from "./services/audioEngine";

const audioEngine = new AudioEngine();

export default function App() {
  const [started, setStarted] = useState(false);
  const [randomizeKey, setRandomizeKey] = useState(0);

  return (
    <>
      <Canvas
        shadows
        camera={{
          position: [0, 0, 18],
          fov: 45,
        }}
        style={{
          width: "100vw",
          height: "100vh",
          background: "#111111",
        }}
      >
        <Scene
          started={started}
          audioEngine={audioEngine}
          randomizeKey={randomizeKey}
        />
      </Canvas>

      <div
        style={{
          // Keep the start control on the right side of the viewport.
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <button
          onClick={async () => {
            if (!started) {
              await audioEngine.start();
              setStarted(true);
            } else {
              setRandomizeKey((key) => key + 1);
            }
          }}
          style={{
            padding: "15px 35px",
            fontSize: "18px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {started ? "Randomize" : "Start"}
        </button>
      </div>
    </>
  );
}