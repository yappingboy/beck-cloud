import { useCallback, useMemo } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { GizmoHelper, GizmoViewcube } from '@react-three/drei';
import * as THREE from 'three';

type Alignment =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'center-right'
  | 'center-left'
  | 'center-center'
  | 'top-center';

interface ViewGizmoProps {
  alignment?: Alignment;
  margin?: [number, number];
}

type ControlsWithTarget = {
  target?: THREE.Vector3;
  update?: () => void;
};

function isControlsWithTarget(value: unknown): value is ControlsWithTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const hasTarget = 'target' in value;
  const hasUpdate = 'update' in value;

  return (
    (!hasTarget || value.target instanceof THREE.Vector3) &&
    (!hasUpdate || typeof value.update === 'function') &&
    (hasTarget || hasUpdate)
  );
}

// Drei's <GizmoHelper> animates the main camera toward a face/edge orientation
// frame-by-frame, stopping once the angle delta falls below ~0.01 rad. During
// the animation it temporarily rotates camera.up and then resets it on
// completion, leaving camera.up, camera.position, and camera.quaternion subtly
// out of sync. After an orbit, OrbitControls.update() — invoked every animation
// frame and ending in camera.lookAt(target) with the transient rotated up —
// bakes that drift into the camera state. The next click of the same face
// either short-circuits at the threshold (no movement, drift preserved) or
// animates toward the still-tilted state instead of the canonical
// orthographic orientation (issue #128).
//
// Fix: bypass drei's animation. Provide a custom onClick to GizmoViewcube that
// snaps the main camera directly to focus + direction * radius with up reset
// to a non-degenerate canonical axis, then runs camera.lookAt(target) and
// controls.update() so OrbitControls' internal spherical state is reconciled.
// Every click lands at the same canonical orientation regardless of orbit
// history, in both orthographic and perspective modes.
export function ViewGizmo({
  alignment = 'bottom-right',
  margin = [80, 80],
}: ViewGizmoProps) {
  const camera = useThree((state) => state.camera);
  const rawControls = useThree((state) => state.controls);
  const controls = isControlsWithTarget(rawControls) ? rawControls : null;
  const invalidate = useThree((state) => state.invalidate);
  const fallbackTarget = useMemo(() => new THREE.Vector3(), []);

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>): void => {
      e.stopPropagation();
      const eventObject = e.eventObject;
      const direction = new THREE.Vector3();
      // Edge and corner cubes carry a non-origin local position pointing
      // outward from the gizmo's center; the central face cube is at the
      // origin and we use the clicked face's normal to recover the axis.
      if (eventObject.position.lengthSq() > 1e-6) {
        direction.copy(eventObject.position).normalize();
      } else if (e.face) {
        direction.copy(e.face.normal);
      } else {
        return;
      }

      const target =
        controls && controls.target ? controls.target : fallbackTarget;
      const radius = Math.max(camera.position.distanceTo(target), 1e-3);

      if (Math.abs(direction.y) > 0.99) {
        camera.up.set(0, 0, -1);
      } else {
        camera.up.set(0, 1, 0);
      }
      camera.position.copy(target).addScaledVector(direction, radius);
      camera.lookAt(target);
      controls?.update?.();
      invalidate();
    },
    [camera, controls, invalidate, fallbackTarget],
  );
  return (
    <GizmoHelper alignment={alignment} margin={margin}>
      {/* @ts-expect-error drei 10.0.7 types this ignored callback return as null. */}
      <GizmoViewcube onClick={handleClick} />
    </GizmoHelper>
  );
}
