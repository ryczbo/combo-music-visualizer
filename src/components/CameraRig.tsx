import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  CAMERA_MOVES,
  CAMERA_TARGET,
  type CameraCommand,
  type CameraView,
} from "../constants/cameraMoves";

type CameraRigProps = {
  command: CameraCommand | null;
};

const target = new THREE.Vector3(...CAMERA_TARGET);
const MIN_POLAR = 0.02;
const MAX_POLAR = Math.PI - 0.02;

function readView(camera: THREE.Camera): CameraView {
  const spherical = new THREE.Spherical().setFromVector3(
    camera.position.clone().sub(target)
  );
  return {
    azimuth: spherical.theta,
    polar: spherical.phi,
    distance: spherical.radius,
  };
}

// Animates the camera toward the combined finish view of the latest command.
export function CameraRig({ command }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  // Tracks the animated view itself: re-reading the camera each frame would wrap
  // azimuth at +-PI and break the interpolation.
  const animation = useRef<{
    start: CameraView;
    goal: CameraView;
    speeds: CameraView;
    elapsed: number;
  } | null>(null);

  useEffect(() => {
    if (!command || command.steps.length === 0) return;
    const start = readView(camera);
    let view = start;
    // Each axis moves at the speed of the last step that changed it.
    const speeds: CameraView = { azimuth: 1, polar: 1, distance: 1 };
    for (const step of command.steps) {
      const finish = CAMERA_MOVES[step.move].getFinishView(view, step.amount);
      if (finish.azimuth !== view.azimuth) speeds.azimuth = step.speed;
      if (finish.polar !== view.polar) speeds.polar = step.speed;
      if (finish.distance !== view.distance) speeds.distance = step.speed;
      view = finish;
    }
    animation.current = {
      start,
      speeds,
      elapsed: 0,
      goal: {
        azimuth: view.azimuth,
        polar: THREE.MathUtils.clamp(view.polar, MIN_POLAR, MAX_POLAR),
        distance: THREE.MathUtils.clamp(
          view.distance,
          CAMERA_MIN_DISTANCE,
          CAMERA_MAX_DISTANCE
        ),
      },
    };
  }, [command, camera]);

  // Dragging the view takes over from any running animation.
  useEffect(() => {
    const dispatcher = controls as THREE.EventDispatcher<{ start: object }> | null;
    if (!dispatcher) return;
    const cancel = () => {
      animation.current = null;
    };
    dispatcher.addEventListener("start", cancel);
    return () => dispatcher.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((_, delta) => {
    const running = animation.current;
    if (!running) return;

    running.elapsed += delta;
    const { start, goal, speeds } = running;
    // Constant-rate interpolation that lands exactly on the goal.
    const progress = (speed: number) => Math.min(1, running.elapsed * speed);
    const next: CameraView = {
      azimuth: THREE.MathUtils.lerp(start.azimuth, goal.azimuth, progress(speeds.azimuth)),
      polar: THREE.MathUtils.lerp(start.polar, goal.polar, progress(speeds.polar)),
      distance: THREE.MathUtils.lerp(start.distance, goal.distance, progress(speeds.distance)),
    };

    camera.position
      .setFromSpherical(
        new THREE.Spherical(next.distance, next.polar, next.azimuth)
      )
      .add(target);
    camera.lookAt(target);

    const finished =
      progress(speeds.azimuth) === 1 &&
      progress(speeds.polar) === 1 &&
      progress(speeds.distance) === 1;
    if (finished) animation.current = null;
  });

  return null;
}
