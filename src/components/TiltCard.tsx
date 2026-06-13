import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

type TiltCardProps = {
  children: ReactNode;
  className?: string;
  rarity?: string;
  isFoil?: boolean;
  maxTilt?: number;
  maskSrc?: string;
};

type TiltFrame = {
  rotateX: number;
  rotateY: number;
  mouseX: number;
  mouseY: number;
  scale: number;
  shineAngle: number;
  shineX: number;
  shineY: number;
};

const RESET_FRAME: TiltFrame = {
  rotateX: 0,
  rotateY: 0,
  mouseX: 50,
  mouseY: 50,
  scale: 1,
  shineAngle: 115,
  shineX: 0,
  shineY: 0,
};

function normalizeRarity(rarity?: string) {
  return String(rarity ?? "common").trim().toLowerCase();
}

function setCardFrame(card: HTMLDivElement, frame: TiltFrame) {
  card.style.setProperty("--tilt-x", `${frame.rotateX.toFixed(2)}deg`);
  card.style.setProperty("--tilt-y", `${frame.rotateY.toFixed(2)}deg`);
  card.style.setProperty("--mouse-x", `${frame.mouseX.toFixed(2)}%`);
  card.style.setProperty("--mouse-y", `${frame.mouseY.toFixed(2)}%`);
  card.style.setProperty("--tilt-scale", frame.scale.toFixed(3));
  card.style.setProperty("--shine-angle", `${frame.shineAngle.toFixed(2)}deg`);
  card.style.setProperty("--shine-x", `${frame.shineX.toFixed(2)}%`);
  card.style.setProperty("--shine-y", `${frame.shineY.toFixed(2)}%`);
}

export default function TiltCard({
  children,
  className = "",
  rarity = "common",
  isFoil = false,
  maxTilt = 14,
  maskSrc,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingFrameRef = useRef<TiltFrame>(RESET_FRAME);

  const scheduleFrame = (nextFrame: TiltFrame) => {
    pendingFrameRef.current = nextFrame;

    if (frameRef.current !== null) return;

    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const card = cardRef.current;
      if (!card) return;
      setCardFrame(card, pendingFrameRef.current);
    });
  };

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "touch") return;

    const scene = event.currentTarget;
    const rect = scene.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return;

    const rawX = (event.clientX - rect.left) / rect.width;
    const rawY = (event.clientY - rect.top) / rect.height;

    const x = Math.min(Math.max(rawX, 0), 1);
    const y = Math.min(Math.max(rawY, 0), 1);

    const rotateY = (x - 0.5) * maxTilt * 2;
    const rotateX = (0.5 - y) * maxTilt * 2;
    const dx = x - 0.5;
    const dy = y - 0.5;
    const distance = Math.min(Math.hypot(dx, dy) / 0.7071, 1);

    scheduleFrame({
      rotateX,
      rotateY,
      mouseX: x * 100,
      mouseY: y * 100,
      scale: 1.01 + distance * 0.012,
      shineAngle: 115 + dx * 18 + dy * 12,
      shineX: dx * 24,
      shineY: dy * 24,
    });
  }

  function handlePointerLeave() {
    scheduleFrame(RESET_FRAME);
  }

  const normalizedRarity = normalizeRarity(rarity);
  const useMask = Boolean(maskSrc);

  return (
    <div
      className="tiltCardScene"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerLeave}
    >
      <div
        ref={cardRef}
        className={[
          "tiltCard",
          isFoil ? "isFoil" : "",
          isFoil ? `foil-${normalizedRarity}` : "",
          useMask ? "useImageMask" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        data-foil={isFoil ? "true" : "false"}
        style={
          {
            "--tilt-x": "0deg",
            "--tilt-y": "0deg",
            "--mouse-x": "50%",
            "--mouse-y": "50%",
            "--tilt-scale": "1",
            "--shine-angle": "115deg",
            "--shine-x": "0%",
            "--shine-y": "0%",
            "--tilt-mask": maskSrc ? `url("${maskSrc}")` : "none",
          } as CSSProperties
        }
      >
        {children}

        {isFoil ? (
          <>
            <div className="tiltFoilLayer" aria-hidden="true" />
            <div className="tiltShineLayer" aria-hidden="true" />
            <div className="tiltSparkLayer" aria-hidden="true" />
          </>
        ) : (
          <div className="tiltNormalShineLayer" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
