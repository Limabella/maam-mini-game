import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { menuCards } from "../data/menuCards";

export type LoadedRaceModel = {
  model: THREE.Group;
  clips: THREE.AnimationClip[];
  grabClip?: THREE.AnimationClip;
  fallClip?: THREE.AnimationClip;
};

export const raceModelCache = new Map<string, LoadedRaceModel>();
const raceModelPromises = new Map<string, Promise<LoadedRaceModel>>();

const LOADING_BOT_MODEL_URL = "/3d_glb/winlose_bgj.glb";
let loadingBotModel: LoadedRaceModel | null = null;
let loadingBotPromise: Promise<LoadedRaceModel> | null = null;

const getRaceModelUrl = (menuId: string) => {
  const menuIndex = Math.max(0, menuCards.findIndex((menu) => menu.id === menuId));
  return `/3d_glb/3m_${String(menuIndex + 1).padStart(3, "0")}.glb`;
};

export const applyRaceRenderPriority = (root: THREE.Object3D, renderOrder: number) => {
  root.renderOrder = renderOrder;
  root.traverse((child) => {
    child.renderOrder = renderOrder;

    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const clonedMaterials = materials.map((material) => {
      const clonedMaterial = material.clone();
      const usesAlpha = clonedMaterial.transparent || clonedMaterial.opacity < 1 || clonedMaterial.alphaTest > 0;
      clonedMaterial.depthTest = true;
      clonedMaterial.depthWrite = !usesAlpha;
      return clonedMaterial;
    });

    child.material = Array.isArray(child.material) ? clonedMaterials : clonedMaterials[0];
  });
};

const selectRunningClip = (clips: THREE.AnimationClip[]) => {
  if (!clips.length) {
    return undefined;
  }

  return clips.reduce((best, clip) =>
    Math.abs(clip.duration - 1.25) < Math.abs(best.duration - 1.25) ? clip : best,
  );
};

const selectGrabClip = (clips: THREE.AnimationClip[], runningClip?: THREE.AnimationClip) =>
  clips
    .filter((clip) => clip !== runningClip)
    .sort((a, b) => Math.abs(a.duration - 0.79) - Math.abs(b.duration - 0.79))[0];

const selectFallClip = (
  clips: THREE.AnimationClip[],
  runningClip?: THREE.AnimationClip,
  grabClip?: THREE.AnimationClip,
) => {
  const remainingClips = clips.filter((clip) => clip !== runningClip && clip !== grabClip);
  const namedFallClip = remainingClips.find((clip) => /fall|down|knock|hit|lose/i.test(clip.name));
  return namedFallClip ?? remainingClips.sort((a, b) => b.duration - a.duration)[0];
};

const createLoadedRaceModel = (root: THREE.Object3D, clips: THREE.AnimationClip[]): LoadedRaceModel => {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const normalized = new THREE.Group();
  root.position.set(-center.x, -box.min.y, -center.z);
  normalized.add(root);
  normalized.scale.setScalar(1 / (Math.max(size.x, size.y, size.z) || 1));

  const runningClip = selectRunningClip(clips);
  const grabClip = selectGrabClip(clips, runningClip);

  return {
    model: normalized,
    clips: runningClip ? [runningClip] : [],
    grabClip,
    fallClip: selectFallClip(clips, runningClip, grabClip),
  };
};

const loadModel = (url: string) =>
  new Promise<LoadedRaceModel>((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => resolve(createLoadedRaceModel(gltf.scene, gltf.animations)),
      undefined,
      reject,
    );
  });

export const loadRaceModel = (menuId: string) => {
  const cachedModel = raceModelCache.get(menuId);
  if (cachedModel) {
    return Promise.resolve(cachedModel);
  }

  const loadingModel = raceModelPromises.get(menuId);
  if (loadingModel) {
    return loadingModel;
  }

  const promise = loadModel(getRaceModelUrl(menuId))
    .then((loadedModel) => {
      raceModelCache.set(menuId, loadedModel);
      return loadedModel;
    })
    .finally(() => raceModelPromises.delete(menuId));

  raceModelPromises.set(menuId, promise);
  return promise;
};

export const loadLoadingBotModel = () => {
  if (loadingBotModel) {
    return Promise.resolve(loadingBotModel);
  }
  if (loadingBotPromise) {
    return loadingBotPromise;
  }

  loadingBotPromise = loadModel(LOADING_BOT_MODEL_URL)
    .then((model) => {
      loadingBotModel = model;
      return model;
    })
    .finally(() => {
      loadingBotPromise = null;
    });

  return loadingBotPromise;
};

export const preloadRaceModels = (menuIds: string[]) => Promise.all(menuIds.map(loadRaceModel));
