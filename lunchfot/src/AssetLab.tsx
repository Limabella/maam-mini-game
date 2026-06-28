import { useEffect, useMemo, useRef, useState } from "react";
import { Application, Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import "./assetLab.css";

type MotionId = "run" | "idle";
type EffectId = "dust" | "steam";
type PreviewMode = "rig" | "spritesheet";

type LayerName =
  | "shadow"
  | "dust_trail"
  | "thigh_screen_right"
  | "shin_screen_right"
  | "foot_screen_right"
  | "torso"
  | "thigh_screen_left"
  | "shin_screen_left"
  | "foot_screen_left"
  | "arm_screen_right"
  | "arm_screen_left_with_spoon_bowl"
  | "head_pot"
  | "face_panel"
  | "steam_top";

type RigLayer = {
  file: string;
  pivot: [number, number];
};

type RigData = {
  canvas: {
    width: number;
    height: number;
  };
  layers: Record<LayerName, RigLayer>;
};

const RIG_ROOT = "/character_assets/kimchi_runner_layered_rig_assets";

const drawOrder: LayerName[] = [
  "shadow",
  "dust_trail",
  "thigh_screen_right",
  "shin_screen_right",
  "foot_screen_right",
  "torso",
  "thigh_screen_left",
  "shin_screen_left",
  "foot_screen_left",
  "arm_screen_right",
  "arm_screen_left_with_spoon_bowl",
  "head_pot",
  "face_panel",
  "steam_top",
];

const motionLabels: Record<MotionId, string> = {
  run: "Run",
  idle: "Idle",
};

const layerMotion = (layer: LayerName, motion: MotionId, phase: number, elapsedMs: number) => {
  const wave = Math.sin(phase);
  const counter = Math.sin(phase + Math.PI);
  const bounce = Math.sin(phase * 2);

  if (motion === "idle") {
    return {
      rotation: ["head_pot", "face_panel", "steam_top"].includes(layer) ? wave * 0.018 : 0,
      x: 0,
      y: layer === "torso" || layer === "head_pot" || layer === "face_panel" ? bounce * 4 : 0,
      alpha: layer === "dust_trail" ? 0 : 1,
      scale: 1,
    };
  }

  return {
    rotation:
      layer === "thigh_screen_right"
        ? wave * 0.18
        : layer === "shin_screen_right"
          ? counter * 0.28
          : layer === "foot_screen_right"
            ? Math.sin(phase + Math.PI / 2) * 0.18
            : layer === "thigh_screen_left"
              ? counter * 0.18
              : layer === "shin_screen_left"
                ? wave * 0.28
                : layer === "foot_screen_left"
                  ? Math.sin(phase - Math.PI / 2) * 0.18
                  : layer === "arm_screen_right"
                    ? counter * 0.08
                    : layer === "arm_screen_left_with_spoon_bowl"
                      ? wave * 0.06
                      : layer === "torso"
                        ? wave * 0.02
                        : 0,
    x: layer === "dust_trail" ? wave * 14 : 0,
    y: ["torso", "head_pot", "face_panel"].includes(layer) ? bounce * 4 : 0,
    alpha: layer === "dust_trail" ? 0.82 : 1,
    scale: 1,
  };
};

type AssetLabProps = {
  embedded?: boolean;
};

function AssetLab({ embedded = false }: AssetLabProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const rigRef = useRef<Container | null>(null);
  const layerSpritesRef = useRef<Map<LayerName, Sprite>>(new Map());
  const effectRef = useRef<Graphics | null>(null);
  const [rig, setRig] = useState<RigData | null>(null);
  const [motion, setMotion] = useState<MotionId>("run");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("spritesheet");
  const [speed, setSpeed] = useState(1);
  const [scale, setScale] = useState(0.48);
  const [facingLeft, setFacingLeft] = useState(true);
  const [effects, setEffects] = useState<Record<EffectId, boolean>>({
    dust: false,
    steam: false,
  });
  const enabledEffects = useMemo(() => Object.entries(effects).filter(([, enabled]) => enabled).map(([id]) => id), [effects]);

  useEffect(() => {
    fetch(`${RIG_ROOT}/rig_pivots.json`)
      .then((response) => response.json())
      .then(setRig)
      .catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !rig) {
      return;
    }

    const app = new Application();
    app
      .init({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        height: Math.max(520, Math.round(host.getBoundingClientRect().height)),
        resolution: window.devicePixelRatio || 1,
        width: Math.max(320, Math.round(host.getBoundingClientRect().width)),
      })
      .then(async () => {
        if (cancelled) {
          app.destroy(true);
          return;
        }

        appRef.current = app;
        host.appendChild(app.canvas);

        const rigContainer = new Container();
        const effectLayer = new Graphics();
        rigRef.current = rigContainer;
        effectRef.current = effectLayer;
        app.stage.addChild(effectLayer, rigContainer);

        const textures = await Promise.all(
          drawOrder.map(async (name) => {
            const texture = await Assets.load<Texture>(`${RIG_ROOT}/${rig.layers[name].file}`);
            return [name, texture] as const;
          }),
        );

        if (cancelled) {
          return;
        }

        textures.forEach(([name, texture]) => {
          const sprite = new Sprite(texture);
          sprite.anchor.set(rig.layers[name].pivot[0] / rig.canvas.width, rig.layers[name].pivot[1] / rig.canvas.height);
          sprite.x = rig.layers[name].pivot[0];
          sprite.y = rig.layers[name].pivot[1];
          layerSpritesRef.current.set(name, sprite);
          rigContainer.addChild(sprite);
        });

        app.ticker.add((ticker) => {
          const hostBounds = host.getBoundingClientRect();
          const width = Math.max(320, Math.round(hostBounds.width));
          const height = Math.max(520, Math.round(hostBounds.height));
          if (app.renderer.width !== width || app.renderer.height !== height) {
            app.renderer.resize(width, height);
          }

          const elapsedMs = performance.now();
          const phase = (elapsedMs / 1000) * Math.PI * 2 * speed;
          const rigScale = facingLeft ? -scale : scale;
          rigContainer.x = width * 0.5;
          rigContainer.y = height * 0.54;
          rigContainer.scale.set(rigScale, scale);
          rigContainer.pivot.set(rig.canvas.width * 0.52, rig.canvas.height * 0.64);

          layerSpritesRef.current.forEach((sprite, name) => {
            const transform = layerMotion(name, motion, phase, elapsedMs);
            sprite.rotation = transform.rotation;
            sprite.x = rig.layers[name].pivot[0] + transform.x;
            sprite.y = rig.layers[name].pivot[1] + transform.y;
            sprite.alpha =
              name === "dust_trail" && !effects.dust
                ? 0
                : name === "steam_top" && !effects.steam
                  ? 0
                  : transform.alpha;
            sprite.scale.set(transform.scale);
          });

          effectLayer.clear();
        });
      })
      .catch(console.error);

    return () => {
      cancelled = true;
      layerSpritesRef.current.clear();
      appRef.current?.destroy(true);
      appRef.current = null;
      rigRef.current = null;
      effectRef.current = null;
    };
  }, [effects, facingLeft, motion, rig, scale, speed]);

  return (
    <div className={embedded ? "asset-lab asset-lab--embedded" : "asset-lab"}>
      <header className="asset-lab__header">
        {!embedded && (
          <a className="asset-lab__back" href="/">
            LF
          </a>
        )}
        <div>
          <p>Asset Environment</p>
          <h1>Character Motion Lab</h1>
        </div>
      </header>

      <section className="asset-lab__workspace">
        <aside className="asset-lab__controls" aria-label="Asset controls">
          <section>
            <h2>Preview</h2>
            <div className="asset-lab__segmented">
              <button className={previewMode === "spritesheet" ? "is-active" : ""} type="button" onClick={() => setPreviewMode("spritesheet")}>
                Sheet
              </button>
              <button className={previewMode === "rig" ? "is-active" : ""} type="button" onClick={() => setPreviewMode("rig")}>
                Rig
              </button>
            </div>
          </section>

          <section>
            <h2>Motion</h2>
            <div className="asset-lab__segmented">
              {(Object.keys(motionLabels) as MotionId[]).map((id) => (
                <button className={motion === id ? "is-active" : ""} key={id} type="button" onClick={() => setMotion(id)}>
                  {motionLabels[id]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Playback</h2>
            <label>
              Speed
              <input min="0.25" max="2" step="0.05" type="range" value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
            </label>
            <label>
              Scale
              <input min="0.32" max="0.72" step="0.02" type="range" value={scale} onChange={(event) => setScale(Number(event.target.value))} />
            </label>
            <label className="asset-lab__check">
              <input type="checkbox" checked={facingLeft} onChange={(event) => setFacingLeft(event.target.checked)} />
              Face left
            </label>
          </section>

          <section>
            <h2>Effects</h2>
            {(Object.keys(effects) as EffectId[]).map((id) => (
              <label className="asset-lab__check" key={id}>
                <input
                  type="checkbox"
                  checked={effects[id]}
                  onChange={(event) => setEffects((current) => ({ ...current, [id]: event.target.checked }))}
                />
                {id}
              </label>
            ))}
          </section>
        </aside>

        <section className="asset-lab__stage" aria-label="Rig preview">
          <div className={previewMode === "rig" ? "asset-lab__pixi is-active" : "asset-lab__pixi"} ref={hostRef} />
          {previewMode === "spritesheet" && <SpriteSheetPreview speed={speed} />}
          <div className="asset-lab__hud">
            <span>{previewMode === "spritesheet" ? "24 frame sheet" : motionLabels[motion]}</span>
            <span>{enabledEffects.length ? enabledEffects.join(" / ") : "no effects"}</span>
          </div>
        </section>
      </section>
    </div>
  );
}

function SpriteSheetPreview({ speed }: { speed: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    const image = new Image();
    image.src = `${RIG_ROOT}/spritesheets/kimchi_runner_left_run_24.png`;
    let frame = 0;
    let lastStep = 0;
    let animationFrame = 0;
    let cancelled = false;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(320, Math.round(rect.width * ratio));
      canvas.height = Math.max(360, Math.round(rect.height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const draw = (timestamp: number) => {
      if (cancelled) {
        return;
      }

      resize();
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);

      if (timestamp - lastStep > 1000 / (24 * speed)) {
        frame = (frame + 1) % 24;
        lastStep = timestamp;
      }

      context.clearRect(0, 0, width, height);
      context.fillStyle = "#f8f3e9";
      context.fillRect(0, 0, width, height);

      context.save();
      context.strokeStyle = "rgba(15, 118, 110, 0.08)";
      context.lineWidth = 1;
      for (let x = 0; x < width; x += 44) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      }
      for (let y = 0; y < height; y += 44) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(width, y);
        context.stroke();
      }
      context.restore();

      context.fillStyle = "rgba(130, 107, 66, 0.22)";
      context.fillRect(0, height * 0.76, width, 14);

      if (image.complete && image.naturalWidth > 0) {
        const sourceX = (frame % 6) * 512;
        const sourceY = Math.floor(frame / 6) * 512;
        const size = Math.min(width * 0.78, height * 0.82, 500);
        context.drawImage(image, sourceX, sourceY, 512, 512, (width - size) / 2, height * 0.52 - size / 2, size, size);
      } else {
        context.fillStyle = "#172033";
        context.font = "900 18px Inter, sans-serif";
        context.textAlign = "center";
        context.fillText("Loading spritesheet", width / 2, height / 2);
      }

      context.fillStyle = "#172033";
      context.font = "900 13px Inter, sans-serif";
      context.textAlign = "left";
      context.fillText(`frame ${String(frame + 1).padStart(2, "0")} / 24`, 18, 28);

      animationFrame = window.requestAnimationFrame(draw);
    };

    image.onload = () => {
      animationFrame = window.requestAnimationFrame(draw);
    };
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [speed]);

  return <canvas className="asset-lab__sheet-preview" ref={canvasRef} />;
}

export default AssetLab;
