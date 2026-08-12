import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { menuById } from "./data/menuCards";
import { getMenuDisplayName, getRacerForMenu } from "./data/sushiRacers";
import { getTopSpinFinalists, getTopSpinWinnerIndex, TOP_SPIN_CUT_IN_MS, TOP_SPIN_PLAY_MS } from "./game/topSpin";
import { getFoodImageUrl } from "./lib/menuAssets";
import type { RoomState } from "./types";

const CUT_IMAGES = [1, 2, 3, 4].map((index) => `/top-spin/bibimbap-top-spin-cut-${String(index).padStart(2, "0")}.webp`);
const TAU = Math.PI * 2;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
const easeInOutCubic = (value: number) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);

export function TopSpinCutIn({ now, room }: { now: number; room: RoomState }) {
  const startedAt = (room.startAt ?? now + TOP_SPIN_CUT_IN_MS) - TOP_SPIN_CUT_IN_MS;
  const progress = clamp01((now - startedAt) / TOP_SPIN_CUT_IN_MS);
  const phase = progress < 0.22 ? 0 : progress < 0.48 ? 1 : progress < 0.72 ? 2 : 3;

  return (
    <section className={`top-spin-cutin phase-${phase}`} aria-label="Bibimbap Fot top spin action cut-in">
      <div className="top-spin-cutin__frames" aria-hidden="true">
        {CUT_IMAGES.map((src, index) => (
          <img className={`top-spin-cutin__frame cut-${index + 1}${phase === index ? " is-active" : ""}`} key={src} src={src} alt="" />
        ))}
      </div>
      <div className="top-spin-cutin__vignette" aria-hidden="true" />
      <div className="top-spin-cutin__speed-lines" aria-hidden="true" />
      <div className="top-spin-cutin__flash" aria-hidden="true" />
      <div className="top-spin-cutin__title">
        <span>BIBIMBAP&apos;S</span>
        <strong>TOP SPIN</strong>
      </div>
      <div className="top-spin-cutin__progress" aria-hidden="true">
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
    </section>
  );
}

const makeTopTexture = (room: RoomState) => {
  const finalists = getTopSpinFinalists(room);
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;

  if (!context) {
    return texture;
  }

  const center = size / 2;
  const radius = size * 0.47;
  const slice = TAU / Math.max(1, finalists.length);
  const images = new Map<string, HTMLImageElement>();

  const draw = () => {
    context.clearRect(0, 0, size, size);
    context.save();
    context.beginPath();
    context.arc(center, center, radius, 0, TAU);
    context.clip();

    finalists.forEach((menuId, index) => {
      const racer = getRacerForMenu(menuId);
      const start = index * slice - Math.PI / 2;
      const end = start + slice;
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, radius, start, end);
      context.closePath();
      context.fillStyle = racer.color;
      context.fill();

      const image = images.get(menuId);
      const angle = start + slice / 2;
      const imageCenterX = center + Math.cos(angle) * radius * 0.58;
      const imageCenterY = center + Math.sin(angle) * radius * 0.58;
      const imageSize = radius * 0.52;

      context.save();
      context.beginPath();
      context.arc(imageCenterX, imageCenterY, imageSize * 0.43, 0, TAU);
      context.clip();
      if (image?.complete && image.naturalWidth) {
        context.drawImage(image, imageCenterX - imageSize / 2, imageCenterY - imageSize / 2, imageSize, imageSize);
      } else {
        context.fillStyle = racer.accent;
        context.fillRect(imageCenterX - imageSize / 2, imageCenterY - imageSize / 2, imageSize, imageSize);
      }
      context.restore();

    });

    context.strokeStyle = "rgba(255, 239, 190, 0.9)";
    context.lineWidth = 10;
    finalists.forEach((_, index) => {
      const angle = index * slice - Math.PI / 2;
      context.beginPath();
      context.moveTo(center, center);
      context.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      context.stroke();
    });
    context.restore();

    const rim = context.createRadialGradient(center, center, radius * 0.72, center, center, radius);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(0.84, "rgba(255,224,155,0.16)");
    rim.addColorStop(1, "rgba(62,31,8,0.68)");
    context.fillStyle = rim;
    context.beginPath();
    context.arc(center, center, radius, 0, TAU);
    context.fill();
    texture.needsUpdate = true;
  };

  finalists.forEach((menuId) => {
    const menu = menuById.get(menuId);
    if (!menu) {
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.onload = draw;
    image.src = getFoodImageUrl(menu);
    images.set(menuId, image);
  });
  draw();
  return texture;
};

export function ThreeTopSpinGame({ room }: { room: RoomState }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const finalists = useMemo(() => getTopSpinFinalists(room), [room]);
  const winnerIndex = useMemo(() => getTopSpinWinnerIndex(room), [room]);
  const [winnerRevealed, setWinnerRevealed] = useState(false);
  const [spinPhase, setSpinPhase] = useState<"launch" | "spin" | "wobble">("launch");

  useEffect(() => {
    setWinnerRevealed(false);
    if (!room.raceStartedAt) {
      return;
    }

    const timer = window.setTimeout(
      () => setWinnerRevealed(true),
      Math.max(0, room.raceStartedAt + TOP_SPIN_PLAY_MS * 0.82 - Date.now()),
    );
    const phaseTimer = window.setInterval(() => {
      const progress = clamp01((Date.now() - (room.raceStartedAt ?? Date.now())) / TOP_SPIN_PLAY_MS);
      setSpinPhase(progress < 0.22 ? "launch" : progress < 0.66 ? "spin" : "wobble");
    }, 120);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(phaseTimer);
    };
  }, [room.raceStartedAt]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !room.raceStartedAt) {
      return;
    }

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x140c08, 0.055);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 8.6, 0.15);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffe6b0, 0x07111f, 2.2));
    const key = new THREE.DirectionalLight(0xffe0a3, 5.2);
    key.position.set(-3.5, 7, 4.5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.PointLight(0x26c6b8, 2.8, 18);
    fill.position.set(4, 4, -3);
    scene.add(fill);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 96),
      new THREE.MeshStandardMaterial({ color: 0x3b2112, roughness: 0.82, metalness: 0.05 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.14;
    floor.receiveShadow = true;
    scene.add(floor);

    const orbitRings = [2.45, 2.95, 3.5].map((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(radius, radius + 0.025 + index * 0.012, 128),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? 0xffc76a : 0xffe0a0,
          transparent: true,
          opacity: 0.34 - index * 0.07,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -1.115 + index * 0.006;
      scene.add(ring);
      return ring;
    });

    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(150 * 3);
    for (let index = 0; index < 150; index += 1) {
      const angle = (index / 150) * TAU + Math.random() * 0.25;
      const radius = 2.1 + Math.random() * 2.2;
      dustPositions[index * 3] = Math.cos(angle) * radius;
      dustPositions[index * 3 + 1] = -0.94 + Math.random() * 0.36;
      dustPositions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0xffd594,
      size: 0.045,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dust);

    const topRoot = new THREE.Group();
    scene.add(topRoot);
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x9d4f1f, roughness: 0.38, metalness: 0.12 });
    const darkWoodMaterial = new THREE.MeshStandardMaterial({ color: 0x4d210d, roughness: 0.5, metalness: 0.08 });
    const goldMaterial = new THREE.MeshStandardMaterial({ color: 0xf6c764, emissive: 0x7a3500, emissiveIntensity: 0.45, roughness: 0.22, metalness: 0.72 });

    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.52, 0.72, 96), woodMaterial);
    body.position.y = -0.04;
    body.castShadow = true;
    topRoot.add(body);
    const point = new THREE.Mesh(new THREE.ConeGeometry(1.52, 1.28, 96), darkWoodMaterial);
    point.position.y = -1;
    point.rotation.z = Math.PI;
    point.castShadow = true;
    topRoot.add(point);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.16, 24, 96), goldMaterial);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.39;
    topRoot.add(rim);

    const topTexture = makeTopTexture(room);
    const topSurfaceMaterial = new THREE.MeshStandardMaterial({ map: topTexture, roughness: 0.3, metalness: 0.08 });
    const surface = new THREE.Mesh(new THREE.CircleGeometry(1.72, 96), topSurfaceMaterial);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.43;
    topRoot.add(surface);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.25, 0.9, 40), woodMaterial);
    handle.position.y = 0.91;
    handle.castShadow = true;
    topRoot.add(handle);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 16), goldMaterial);
    cap.position.y = 1.38;
    topRoot.add(cap);

    const slice = TAU / Math.max(1, finalists.length);
    const winnerGlow = new THREE.Mesh(
      new THREE.CircleGeometry(1.78, 48, winnerIndex * slice - Math.PI / 2, slice),
      new THREE.MeshBasicMaterial({ color: 0xffe56e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    winnerGlow.rotation.x = -Math.PI / 2;
    winnerGlow.position.y = 0.455;
    topRoot.add(winnerGlow);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(2.15, 2.28, 96),
      new THREE.MeshBasicMaterial({ color: 0xffc05c, transparent: true, opacity: 0.68, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -1.08;
    scene.add(halo);

    let cancelled = false;
    let frameId = 0;
    const targetAngle = -winnerIndex * slice - slice / 2;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer.setSize(Math.max(320, Math.round(rect.width)), Math.max(320, Math.round(rect.height)), false);
      camera.aspect = Math.max(0.5, rect.width / Math.max(1, rect.height));
      camera.updateProjectionMatrix();
    };

    const render = () => {
      if (cancelled) {
        return;
      }
      const elapsed = Math.max(0, Date.now() - (room.raceStartedAt ?? Date.now()));
      const progress = clamp01(elapsed / TOP_SPIN_PLAY_MS);
      const spinProgress = easeOutCubic(clamp01(progress / 0.82));
      const settle = easeInOutCubic(clamp01((progress - 0.62) / 0.2));
      const fall = easeInOutCubic(clamp01((progress - 0.82) / 0.18));
      const wobble = progress > 0.58 && progress < 0.9 ? Math.sin(elapsed / Math.max(38, 120 - settle * 70)) * (0.035 + settle * 0.075) : 0;
      const turns = TAU * 15;

      topRoot.rotation.order = "YXZ";
      topRoot.rotation.y = turns * spinProgress + targetAngle * settle;
      const fallDirection = winnerIndex * slice;
      topRoot.rotation.x = wobble + Math.sin(fallDirection) * fall * 0.78;
      topRoot.rotation.z = wobble * 0.72 + Math.cos(fallDirection) * fall * 0.78;
      const launch = easeOutCubic(clamp01(progress / 0.22));
      const travelRadius = (1 - launch) * 1.15;
      topRoot.position.x = Math.cos(elapsed / 185) * travelRadius;
      topRoot.position.z = Math.sin(elapsed / 185) * travelRadius * 0.72;
      topRoot.position.y = 0.16 + Math.sin(Math.min(1, progress / 0.12) * Math.PI) * 0.22 - fall * 0.12;
      topRoot.scale.setScalar(0.72 + easeOutCubic(clamp01(progress / 0.48)) * 0.38);
      halo.rotation.z = -elapsed / 210;
      halo.scale.setScalar(1 + Math.sin(elapsed / 90) * 0.035);
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.68 * (1 - fall * 0.7);
      (winnerGlow.material as THREE.MeshBasicMaterial).opacity = fall * (0.45 + Math.sin(elapsed / 80) * 0.18);
      orbitRings.forEach((ring, index) => {
        const material = ring.material as THREE.MeshBasicMaterial;
        const pulse = 0.8 + Math.sin(elapsed / (150 + index * 45) - index) * 0.2;
        ring.scale.setScalar(0.78 + progress * 0.3 + index * 0.035 + pulse * 0.035);
        material.opacity = (0.32 - index * 0.06) * (1 - fall * 0.75) * pulse;
      });
      dust.rotation.y = elapsed / 1050;
      dustMaterial.opacity = (0.28 + Math.sin(elapsed / 120) * 0.12) * (1 - fall * 0.65);

      const cameraArrival = easeInOutCubic(clamp01(progress / 0.72));
      camera.position.x = Math.sin(elapsed / 1450) * (0.55 - cameraArrival * 0.34);
      camera.position.y = 9.8 - cameraArrival * 2.35 + fall * 0.45;
      camera.position.z = 1.7 - cameraArrival * 1.45;
      camera.lookAt(topRoot.position.x * 0.15, -0.12, topRoot.position.z * 0.15);

      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    frameId = window.requestAnimationFrame(render);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(frameId);
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      });
      topTexture.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [finalists, room, winnerIndex]);

  const winner = menuById.get(finalists[winnerIndex] ?? "");

  return (
    <section className="top-spin-game" aria-label="Six menu spinning top roulette">
      <div className="top-spin-game__match-frame" aria-hidden="true" />
      <div className="top-spin-game__canvas" ref={hostRef} />
      <div className="top-spin-game__motion-ring" aria-hidden="true"><span /><span /><span /></div>
      <p className={`top-spin-game__status is-${spinPhase}`}>
        {spinPhase === "launch" ? "팽이가 힘차게 날아듭니다" : spinPhase === "spin" ? "오늘의 한 끼를 찾는 중" : "어느 쪽으로 기울까요?"}
      </p>
      <div className="top-spin-game__hud">
        <i aria-hidden="true">▼</i>
      </div>
      <ul className="top-spin-game__finalists" aria-label="Top six menu finalists">
        {finalists.map((menuId, index) => (
          <li className={winnerRevealed && index === winnerIndex ? "is-target" : ""} key={menuId}>
            <span>{index + 1}</span>
            {getMenuDisplayName(menuById.get(menuId))}
          </li>
        ))}
      </ul>
    </section>
  );
}
