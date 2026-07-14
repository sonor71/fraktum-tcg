import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

type D20ViewProps = {
  value?: number;
  onRoll: () => void;
  disabled?: boolean;
};

const ROLL_TICKS = 28;
const ROLL_TICK_MS = 36;
const SETTLE_MS = 560;

const REST_ROTATIONS: Array<[number, number, number]> = [
  [-0.88, 0.22, 0.08],
  [-0.62, 1.14, -0.18],
  [-0.44, 2.02, 0.12],
  [-0.92, 2.78, 0.1],
  [-0.58, 3.62, -0.16],
  [0.0, 0.58, 0.12],
  [0.06, 1.34, -0.12],
  [0.02, 2.26, 0.08],
  [0.0, 3.08, -0.08],
  [0.08, 3.92, 0.16],
  [0.56, 0.34, -0.1],
  [0.72, 1.18, 0.08],
  [0.62, 2.02, -0.08],
  [0.84, 2.88, 0.06],
  [0.54, 3.72, -0.14],
  [1.04, 0.84, 0.08],
  [0.98, 1.78, -0.06],
  [1.12, 2.6, 0.12],
  [1.0, 3.42, -0.1],
  [0.9, 4.18, 0.14],
];

function clampD20(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return undefined;
  return Math.max(1, Math.min(20, Math.round(value)));
}

function randomD20() {
  return Math.floor(Math.random() * 20) + 1;
}

function D20Mesh({ rolling, value }: { rolling: boolean; value?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const wireRef = useRef<THREE.LineSegments>(null);

  const targetQuaternion = useMemo(() => {
    const result = clampD20(value) ?? 1;
    const [x, y, z] = REST_ROTATIONS[result - 1] ?? REST_ROTATIONS[0];
    const q = new THREE.Quaternion();
    q.setFromEuler(new THREE.Euler(x, y, z));
    return q;
  }, [value]);

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1.15, 0), []);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      edgesGeometry.dispose();
    };
  }, [geometry, edgesGeometry]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const wire = wireRef.current;
    if (!group) return;

    if (rolling) {
      group.rotation.x += delta * 7.8;
      group.rotation.y += delta * 9.1;
      group.rotation.z += delta * 6.4;
      group.position.y = Math.sin(performance.now() * 0.012) * 0.08;
    } else {
      group.position.y = THREE.MathUtils.damp(group.position.y, 0, 7, delta);
      group.quaternion.slerp(targetQuaternion, 1 - Math.exp(-7 * delta));
    }

    if (wire) {
      wire.rotation.copy(group.rotation);
      wire.position.copy(group.position);
    }
  });

  return (
    <group>
      <group ref={groupRef}>
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#c8943a"
            metalness={0.72}
            roughness={0.28}
            clearcoat={0.3}
            clearcoatRoughness={0.22}
            reflectivity={0.82}
            emissive="#3c2206"
            emissiveIntensity={0.45}
          />
        </mesh>

        <mesh geometry={geometry} scale={0.985}>
          <meshStandardMaterial
            color="#f4cd78"
            metalness={0.2}
            roughness={0.7}
            transparent
            opacity={0.18}
          />
        </mesh>
      </group>

      <lineSegments ref={wireRef} geometry={edgesGeometry}>
        <lineBasicMaterial color="#2a1607" transparent opacity={0.95} />
      </lineSegments>

      <mesh position={[0, -1.75, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.25, 32]} />
        <shadowMaterial transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

export function D20View({ value, onRoll, disabled = false }: D20ViewProps) {
  const [rolling, setRolling] = useState(false);
  const [rollingValue, setRollingValue] = useState<number | undefined>();
  const displayValue = rolling ? rollingValue : clampD20(value);
  const tickerRef = useRef<number | null>(null);
  const settleRef = useRef<number | null>(null);


  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
      if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    };
  }, []);

  const handleRoll = () => {
    if (disabled || rolling) return;

    setRolling(true);
    let ticks = 0;

    if (tickerRef.current !== null) window.clearInterval(tickerRef.current);
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);

    tickerRef.current = window.setInterval(() => {
      ticks += 1;
      setRollingValue(randomD20());

      if (ticks < ROLL_TICKS) return;

      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }

      onRoll();

      settleRef.current = window.setTimeout(() => {
        setRolling(false);
        settleRef.current = null;
      }, SETTLE_MS);
    }, ROLL_TICK_MS);
  };

  const buttonClassName = [
    "matchD20",
    "fraktumD20",
    rolling ? "is-rolling" : "",
    disabled ? "is-locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={buttonClassName}
      type="button"
      onClick={handleRoll}
      disabled={disabled || rolling}
      aria-label="Roll D20"
      aria-live="polite"
      data-result={displayValue ?? "none"}
    >
      <span className="matchD20Label">D20</span>

      <span className="fraktumD20CanvasWrap" aria-hidden="true">
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0.1, 4.2], fov: 38 }}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={1.35} />
          <directionalLight position={[2.6, 3.6, 3.2]} intensity={2.0} castShadow />
          <directionalLight position={[-2.5, -1.2, 2.2]} intensity={0.45} color="#8b55ff" />
          <pointLight position={[0, 0, 2.4]} intensity={1.4} color="#ffd18a" />
          <D20Mesh rolling={rolling} value={displayValue} />
        </Canvas>
      </span>

      <span className="fraktumD20ReadoutPlate">
        <span className="fraktumD20ReadoutLabel">RESULT</span>
        <strong className="fraktumD20Readout" key={displayValue ?? "empty"}>
          {displayValue ?? "—"}
        </strong>
      </span>

      <span className="matchD20Hint">{rolling ? "ROLLING" : disabled ? "LOCKED" : "ROLL"}</span>
    </button>
  );
}
