import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import gsap from 'gsap';
import {
  createDeepStarfield,
  createSpinVortex,
  createCosmicPlanets,
  createSpeedStreaks,
} from './spinVortex.js';
import {
  generateLunarMaps,
  createRealisticMoon,
  createLunarSurfaceStage,
} from './moonSystem.js';
import { createFracturableStoneTablet } from './stoneTablet3d.js';
import { createCometModel } from './cometModel.js';
import { createKarsRigController } from './karsRigController.js';

/**
 * Generates crisp JoJo "ゴ" (Menacing) sprite texture
 */
function createMenacingTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  ctx.font = 'bold 84px "Be Vietnam Pro", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#09080E';
  ctx.strokeText('ゴ', 64, 66);
  ctx.fillStyle = colors.amethyst;
  ctx.fillText('ゴ', 64, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Populates 110 fine tapered G-pen black manga speedlines around the viewport perimeter
 */
function populateMangaSpeedlines() {
  const svg = document.getElementById('manga-speedlines-svg');
  if (!svg) return;
  svg.innerHTML = '';
  const ns = 'http://www.w3.org/2000/svg';
  const cx = 600;
  const cy = 400;
  const count = 110;

  let seed = 71243;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.032;
    const innerR = 230 + rand() * 195;
    const outerR = 960;
    const halfSpread = (0.0055 + rand() * 0.013);

    const xTip = cx + Math.cos(ang) * innerR;
    const yTip = cy + Math.sin(ang) * innerR;
    const xA = cx + Math.cos(ang - halfSpread) * outerR;
    const yA = cy + Math.sin(ang - halfSpread) * outerR;
    const xB = cx + Math.cos(ang + halfSpread) * outerR;
    const yB = cy + Math.sin(ang + halfSpread) * outerR;

    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('class', 'manga-wedge');
    poly.setAttribute(
      'points',
      `${xTip.toFixed(1)},${yTip.toFixed(1)} ${xA.toFixed(1)},${yA.toFixed(1)} ${xB.toFixed(1)},${yB.toFixed(1)}`
    );
    svg.appendChild(poly);
  }
}

export class IntroDirector {
  constructor({
    canvas,
    choreography,
    onProgress,
    onBeatChange,
    onTabletReady,
    onWebGLUnavailable,
  }) {
    this.canvas = canvas;
    this.cfg = choreography;
    this.onProgress = onProgress || (() => {});
    this.onBeatChange = onBeatChange || (() => {});
    this.onTabletReady = onTabletReady || (() => {});
    this.onWebGLUnavailable = onWebGLUnavailable || (() => {});

    this.disposed = false;
    this.isFrozenFinale = false;
    this.isRenderPaused = false;
    this.isAmbientStandby = false;
    this.ambientThetaOffset = 0;
    this.timeline = null;
    this.karsRoot = null;
    this.karsRig = null;
    this.handRightBone = null;

    this.state = {
      galaxyClock: 0,
      handheldWeight: 0,
      shakeAmp: 0,
      meteorProgress: 0,
      meteorActive: false,
      meteorMode: 'space',
      streakIntensity: 0,
      worldTimeScale: 1.0,
      tabletAttached: false,
      tabletPickupBlend: 0,
      tabletThrown: false,
      crackProgress: 0,
      splitProgress: 0,
      cameraMode: 'spin',
    };

    this.trauma = {
      active: false,
      ampPos: 0,
      ampRot: 0,
      fovKick: 0,
      decay: 4.5,
      age: 0,
    };

    this.craterTabletPos = new THREE.Vector3(-0.14, -0.24, 0.24);
    this.craterTabletQuat = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI * 0.44, 0.14, 0.22)
    );

    this.camPos = new THREE.Vector3(0, 0.55, 8.8);
    this.camTarget = new THREE.Vector3(0, 0, 0);
    this.camFov = { value: this.cfg.camera.fovBase || 50 };

    this.tabletVelocity = new THREE.Vector3();
    this.tabletAngVel = new THREE.Vector3();

    this.rafId = 0;
    this.clock = new THREE.Clock();
    this.elapsedGlobal = 0;

    populateMangaSpeedlines();
    this._initRendererAndScene();
  }

  _initRendererAndScene() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: 'high-performance',
        alpha: false,
      });
    } catch (err) {
      this.onWebGLUnavailable(err);
      return;
    }

    if (!renderer || !renderer.getContext()) {
      this.onWebGLUnavailable(new Error('WebGL context failed'));
      return;
    }

    this.renderer = renderer;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.cfg.colors.cosmosBg);

    this.cameraRig = new THREE.Group();
    this.camera = new THREE.PerspectiveCamera(this.camFov.value, w / h, 0.08, 220);
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    // HDR Post-Processing Composer with UnrealBloomPass
    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.56, 0.45, 0.72);
    this.outputPass = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);

    // Three-point + Shadow-Casting Solar Key Light
    this.ambLight = new THREE.AmbientLight('#8e96b8', 0.55);
    this.scene.add(this.ambLight);

    this.sunLight = new THREE.DirectionalLight('#fff5e4', 2.55);
    this.sunLight.position.set(12, 8, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 30;
    this.sunLight.shadow.camera.left = -4.8;
    this.sunLight.shadow.camera.right = 4.8;
    this.sunLight.shadow.camera.top = 4.8;
    this.sunLight.shadow.camera.bottom = -4.8;
    this.sunLight.shadow.radius = 2.4;
    this.sunLight.shadow.bias = -0.0004;
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(this.cfg.colors.amethyst, 1.75);
    this.rimLight.position.set(-4, 6, -10);
    this.scene.add(this.rimLight);

    this.fillLight = new THREE.DirectionalLight('#9ab8f2', 0.6);
    this.fillLight.position.set(-8, 3, 6);
    this.scene.add(this.fillLight);

    // Persistent Deep Planck Starfield
    this.deepStars = createDeepStarfield();
    this.scene.add(this.deepStars.points);

    // =========================================================
    // OUTER SPACE GROUP
    // =========================================================
    this.spaceGroup = new THREE.Group();
    this.scene.add(this.spaceGroup);

    this.vortex = createSpinVortex(this.cfg.colors);
    this.spaceGroup.add(this.vortex.group);

    this.cosmicPlanets = createCosmicPlanets();
    this.spaceGroup.add(this.cosmicPlanets.group);

    this.lunarMaps = generateLunarMaps();
    const moonCfg = this.cfg.moon || { position: [13.5, 0.4, -4.8], radius: 1.85 };
    this.moon = createRealisticMoon(moonCfg, this.lunarMaps, this.cfg.colors);
    this.spaceGroup.add(this.moon.group);

    // High-Craft 3D Comet Model (Teardrop Plasma Head + Dual Ribbon + Helical Filaments + 260 Stardust)
    this.comet = createCometModel(this.cfg.colors);
    this.scene.add(this.comet.group);
    this.scene.add(this.comet.trailGroup);

    const mPos = new THREE.Vector3(...moonCfg.position);
    const mRad = moonCfg.radius || 1.85;
    const spaceImpactPos = mPos.clone().add(new THREE.Vector3(-0.34, 0.28, mRad * 0.96));

    this.spaceMeteorCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.0, 0.0),
      new THREE.Vector3(1.55, 0.45, 5.2),
      new THREE.Vector3(mPos.x * 0.42, 0.95, 1.35),
      new THREE.Vector3(mPos.x * 0.74, 0.75, -1.65),
      spaceImpactPos,
    ]);

    this.lunarMeteorCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(5.8, 10.5, -13.5),
      new THREE.Vector3(2.4, 4.8, -5.6),
      new THREE.Vector3(0.45, 1.3, -1.1),
      new THREE.Vector3(-0.14, -0.14, 0.24),
    ]);

    this.speedStreaks = createSpeedStreaks(this.cfg.colors);
    this.spaceGroup.add(this.speedStreaks.lines);

    // =========================================================
    // LUNAR SURFACE GROUP
    // =========================================================
    this.lunarGroup = new THREE.Group();
    this.lunarGroup.visible = false;
    this.scene.add(this.lunarGroup);

    this.lunarSurface = createLunarSurfaceStage(this.lunarMaps, this.cfg.colors);
    this.lunarSurface.group.visible = true;
    this.lunarGroup.add(this.lunarSurface.group);

    this.craterLight = new THREE.PointLight(this.cfg.colors.gold, 1.4, 7.5);
    this.craterLight.position.set(0.35, 1.8, 1.65);
    this.lunarGroup.add(this.craterLight);

    // Crisp Monolith 2-half Fracturable Stone Tablet
    this.fracturableTablet = createFracturableStoneTablet(this.cfg.colors);
    this.stoneTablet = this.fracturableTablet.root;
    this.scene.add(this.stoneTablet);
    this._resetTabletAtCrater();

    // JoJo Menacing Glyphs behind Kars
    const glyphTex = createMenacingTexture(this.cfg.colors);
    this.menacingSprites = [];
    const glyphCoords = [
      [-1.18, 1.48, -0.35, 0.44],
      [1.08, 1.74, -0.25, 0.40],
      [-0.86, 0.88, 0.15, 0.32],
    ];
    for (const [gx, gy, gz, gs] of glyphCoords) {
      const m = new THREE.SpriteMaterial({
        map: glyphTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const sp = new THREE.Sprite(m);
      sp.position.set(gx, gy, gz);
      sp.scale.set(gs, gs, 1);
      this.lunarGroup.add(sp);
      this.menacingSprites.push({ sp, mat: m, baseY: gy, phase: Math.random() * 6 });
    }

    this._bindResize();
  }

  _resetTabletAtCrater() {
    if (!this.stoneTablet || !this.fracturableTablet) return;
    this.fracturableTablet.reset();
    this.stoneTablet.visible = false;
    this.stoneTablet.scale.set(1, 1, 1);
    this.stoneTablet.position.copy(this.craterTabletPos);
    this.stoneTablet.quaternion.copy(this.craterTabletQuat);
  }

  triggerCameraImpact({ ampPos = 0.14, ampRot = 0.025, fovKick = 0, decay = 4.2 } = {}) {
    this.trauma.active = true;
    this.trauma.ampPos = ampPos;
    this.trauma.ampRot = ampRot;
    this.trauma.fovKick = fovKick;
    this.trauma.decay = decay;
    this.trauma.age = 0;
  }

  _applyGalaxyKinematics(t) {
    const b = this.cfg.beats;
    const collapseEndT = b.spinCollapseEnd || 19.2;

    const spinStart = 4.0;
    const accelEndT = 13.0;
    const accelDur = Math.max(0.1, accelEndT - spinStart);

    // 3-phase continuous galaxy kinematics:
    // 1) Steady ambient spin -> 2) Smooth spin-up to 4x old max (51.2 rad/s) BEFORE collapse ->
    // 3) Center inward collapse once peak angular velocity is reached
    let theta = 0.40 * t;
    let collapse = 0;

    if (t > spinStart && t <= accelEndT) {
      const u = THREE.MathUtils.clamp((t - spinStart) / accelDur, 0, 1);
      const u4 = u * u * u * u;
      theta = 0.40 * t + accelDur * 50.8 * (2.5 * u4 - 3.0 * u4 * u + u4 * u * u);
    } else if (t > accelEndT) {
      const thetaAtPeak = 0.40 * accelEndT + accelDur * 50.8 * 0.5;
      const collapseDur = Math.max(0.1, collapseEndT - accelEndT);
      const v = THREE.MathUtils.clamp((t - accelEndT) / collapseDur, 0, 1);
      theta = thetaAtPeak + 51.2 * (t - accelEndT) + 6.0 * collapseDur * (v * v * v - 0.5 * v * v * v * v);
      collapse = 0.35 * v * v + 0.65 * Math.pow(v, 4);
    }

    const vCollapse = collapse;
    this.vortex.uniforms.uSpinAngle.value = (this.ambientThetaOffset || 0) + theta;
    this.vortex.uniforms.uCollapse.value = collapse;

    const guideFade = THREE.MathUtils.smoothstep(vCollapse, 0.05, 0.55);
    this.vortex.spiralGuideMat.opacity = 0.08 + 0.82 * guideFade;
    const gScale = Math.max(0.035, 1.0 - 0.96 * Math.pow(collapse, 1.15));
    this.vortex.spiralGuides.scale.setScalar(gScale);

    const coreGrow = 2.0 + 2.6 * Math.pow(vCollapse, 2.5);
    this.vortex.coreSprite.scale.set(coreGrow, coreGrow, 1);
    this.vortex.coreSprite.material.opacity = 0.56 + 0.44 * vCollapse;

    if (this.state.cameraMode === 'spin') {
      const sCurve = vCollapse * vCollapse * (3 - 2 * vCollapse);
      this.camPos.set(
        Math.sin(t * 0.22) * 0.28 * (1 - vCollapse),
        THREE.MathUtils.lerp(0.55, 0.16, sCurve),
        THREE.MathUtils.lerp(8.8, 7.45, sCurve)
      );
      this.camTarget.set(0, 0, 0);
    }
  }

  async loadAssetsAndStart({ skipIntroImmediately = false, startInAmbient = false } = {}) {
    if (!this.renderer) {
      this.onTabletReady();
      return;
    }

    const loader = new GLTFLoader();
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          this.cfg.modelPath,
          (res) => resolve(res),
          (xhr) => {
            if (xhr.total > 0) {
              this.onProgress(Math.min(95, Math.round((xhr.loaded / xhr.total) * 100)));
            }
          },
          (err) => reject(err)
        );
      });

      this.karsRoot = gltf.scene;
      this.karsRoot.visible = false;
      this.karsRoot.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.frustumCulled = false;
          obj.castShadow = true;
          obj.receiveShadow = true;
          obj.material.transparent = true;
          obj.material.opacity = 1;
          if ('roughness' in obj.material) {
            obj.material.roughness = 0.82;
          }
        }
        if (obj.isBone && (obj.name === 'HandR' || obj.name === 'Hand.R' || obj.name === 'Hand_R')) {
          this.handRightBone = obj;
        }
      });

      this.lunarGroup.add(this.karsRoot);

      if (gltf.animations && gltf.animations.length > 0) {
        this.karsRig = createKarsRigController(
          this.karsRoot,
          gltf.animations,
          this.lunarSurface.craterHeightAt
        );
      }
    } catch (err) {
      console.warn('GLB load warning, continuing sequence:', err);
    }

    if (this.cfg.moon?.customGlbUrl) {
      try {
        const customMoon = await new Promise((resolve, reject) =>
          loader.load(this.cfg.moon.customGlbUrl, resolve, undefined, reject)
        );
        this.moon.sphere.visible = false;
        this.moon.group.add(customMoon.scene);
      } catch (e) {
        console.warn('Custom Moon GLB fallback to procedural Moon:', e);
      }
    }

    this.onProgress(100);
    this._buildTimeline();
    this._startRenderLoop();

    if (skipIntroImmediately) {
      this.skipToFinale();
    } else if (startInAmbient) {
      this.enterAmbientStandby();
    } else {
      this.timeline.play(0);
    }
  }

  enterAmbientStandby() {
    this.isFrozenFinale = false;
    this.isRenderPaused = false;
    this.isAmbientStandby = true;
    this.ambientThetaOffset = 0;
    this.timeline?.pause(0);

    this.spaceGroup.visible = true;
    this.lunarGroup.visible = false;
    this.ambLight.intensity = 0.55;
    this.sunLight.intensity = 2.55;
    this.sunLight.position.set(12, 8, 10);
    this.rimLight.color.set(this.cfg.colors.amethyst);
    this.rimLight.intensity = 1.75;
    this.rimLight.position.set(-4, 6, -10);

    this.vortex.uniforms.uCollapse.value = 0;
    this.vortex.uniforms.uBurst.value = 0;
    this.vortex.spiralGuideMat.opacity = 0.14;
    this.vortex.spiralGuides.scale.set(1, 1, 1);
    this.vortex.coreSprite.scale.set(2.0, 2.0, 1);
    this.vortex.coreSprite.material.opacity = 0.56;
    this.comet.setVisible(false);

    this.state.cameraMode = 'spin';
    this.state.worldTimeScale = 1.0;
    this.camPos.set(0, 0.55, 8.8);
    this.camTarget.set(0, 0, 0);
    this.camFov.value = this.cfg.camera.fovBase || 50;
  }

  startFromAmbient() {
    if (!this.timeline) return;
    this.ambientThetaOffset = this.vortex?.uniforms?.uSpinAngle?.value || 0;
    this.isAmbientStandby = false;
    this.isRenderPaused = false;
    this.timeline.play(0);
  }

  _setOverlayOpacity(id, val) {
    const el = document.getElementById(id);
    if (el) el.style.opacity = String(val);
  }

  _setAnimeFx(active) {
    const el = document.getElementById('anime-manga-fx');
    if (el) el.classList.toggle('is-active', active);
  }

  _buildTimeline() {
    if (this.timeline) this.timeline.kill();
    const b = this.cfg.beats;
    const moonCfg = this.cfg.moon || { position: [13.5, 0.4, -4.8] };
    const mPos = new THREE.Vector3(...moonCfg.position);

    const fadeEl = document.getElementById('scene-fade');
    const novaEl = document.getElementById('supernova-flash');

    const tl = gsap.timeline({
      paused: true,
    });

    // =========================================================================
    // ACT 1 (0.0s -> 19.35s): SEAMLESS C3-CONTINUOUS GALAXY SPIN & COLLAPSE
    // =========================================================================
    tl.call(() => {
      this.spaceGroup.visible = true;
      this.lunarGroup.visible = false;
      this.ambLight.intensity = 0.55;
      this.sunLight.intensity = 2.55;
      this.state.cameraMode = 'spin';
      this._applyGalaxyKinematics(0);
    }, null, 0);

    tl.to(this.state, {
      galaxyClock: b.shockwave,
      duration: b.shockwave,
      ease: 'none',
      onUpdate: () => {
        this._applyGalaxyKinematics(this.state.galaxyClock);
      },
    }, 0);

    // Shockwave + Comet Launch (slower 2.6s flyby)
    tl.call(() => {
      this.state.cameraMode = 'shock';
      this.state.meteorMode = 'space';
      this.state.meteorActive = true;
      this.state.meteorProgress = 0;
      this.comet.setVisible(true);
      this.comet.resetTrail(this.spaceMeteorCurve.getPoint(0));
      this._triggerImpactFlash(0.62);
      this.triggerCameraImpact({ ampPos: 0.12, ampRot: 0.02, fovKick: 2.5, decay: 4.0 });
    }, null, b.shockwave);

    tl.to(this.vortex.uniforms.uBurst, { value: 1.0, duration: 1.4, ease: 'power3.out' }, b.shockwave);
    tl.to(this.vortex.spiralGuideMat, { opacity: 0.0, duration: 0.45 }, b.shockwave);
    tl.to(this.vortex.coreSprite.material, { opacity: 0.0, duration: 0.55 }, b.shockwave);
    tl.set(this.vortex.shockMat.uniforms.uOpacity, { value: 0.95 }, b.shockwave);
    tl.to(this.vortex.shockMat.uniforms.uProgress, { value: 1.0, duration: 1.2, ease: 'power2.out' }, b.shockwave);
    tl.to(this.vortex.shockMat.uniforms.uOpacity, { value: 0.0, duration: 1.0, ease: 'power2.in' }, b.shockwave + 0.2);

    tl.to(this.state, { meteorProgress: 0.42, duration: 2.6, ease: 'power1.out' }, b.meteorFlybyStart);

    // =========================================================================
    // ACT 2 (21.1s -> 32.0s): WHIP PAN -> MOON -> CRASH ZOOM -> COMET -> SPACE IMPACT
    // =========================================================================
    tl.call(() => {
      this.state.cameraMode = 'moon';
    }, null, b.whipPanStart);

    tl.to(this.state, { handheldWeight: 1.0, duration: 1.1, ease: 'power2.out' }, b.whipPanStart);
    tl.to(this.camPos, {
      x: mPos.x - 0.55,
      y: mPos.y + 0.25,
      z: mPos.z + 6.95,
      duration: b.whipPanEnd - b.whipPanStart,
      ease: 'power3.out',
    }, b.whipPanStart);
    tl.to(this.camTarget, {
      x: mPos.x,
      y: mPos.y,
      z: mPos.z,
      duration: b.whipPanEnd - b.whipPanStart,
      ease: 'power3.out',
    }, b.whipPanStart);

    // Slower Moon Crash Zoom framing cratered horizon heroically
    tl.to(this.camPos, {
      x: mPos.x - 0.28,
      y: mPos.y + 0.22,
      z: mPos.z + 3.45,
      duration: b.crashZoomInEnd - b.crashZoomInStart,
      ease: 'power2.inOut',
    }, b.crashZoomInStart);
    tl.to(this.camFov, {
      value: 40,
      duration: b.crashZoomInEnd - b.crashZoomInStart,
      ease: 'power2.inOut',
    }, b.crashZoomInStart);

    tl.to(this.camPos, {
      x: mPos.x - 0.75,
      y: mPos.y + 0.35,
      z: mPos.z + 6.75,
      duration: b.crashZoomOutEnd - b.crashZoomInEnd,
      ease: 'power3.out',
    }, b.crashZoomInEnd + 0.12);
    tl.to(this.camFov, {
      value: this.cfg.camera.fovBase || 50,
      duration: b.crashZoomOutEnd - b.crashZoomInEnd,
      ease: 'power3.out',
    }, b.crashZoomInEnd + 0.12);

    // Lock-On to Sculpted 3D Comet + Speed Streaks
    tl.call(() => {
      this.state.cameraMode = 'meteorLock';
    }, null, b.meteorLockStart);

    tl.to(this.state, {
      meteorProgress: 0.76,
      duration: b.meteorLockEnd - b.meteorLockStart,
      ease: 'none',
    }, b.meteorLockStart);
    tl.to(this.state, { streakIntensity: 1.0, duration: 0.4, ease: 'power2.out' }, b.meteorLockStart);
    tl.to(this.camFov, { value: this.cfg.camera.fovStreak || 64, duration: 0.55, ease: 'power2.out' }, b.meteorLockStart);
    tl.to(this.state, { streakIntensity: 0.0, duration: 0.35 }, b.meteorLockEnd - 0.32);

    // Re-lock Moon -> Space 3D Volumetric Impact -> Slow Fade into Lunar Surface
    tl.call(() => {
      this.state.cameraMode = 'moon';
      this.camPos.set(mPos.x - 0.35, mPos.y + 0.35, mPos.z + 6.65);
      this.camTarget.copy(mPos);
    }, null, b.meteorLockEnd);

    tl.to(this.camFov, { value: this.cfg.camera.fovBase || 50, duration: 0.5, ease: 'power2.out' }, b.meteorLockEnd);
    tl.to(this.state, { meteorProgress: 1.0, duration: b.moonSpaceImpact - b.meteorLockEnd, ease: 'power2.in' }, b.meteorLockEnd);

    tl.call(() => {
      this.state.meteorActive = false;
      this.comet.setVisible(false);
      this.moon.triggerSpaceImpact();
      this._triggerImpactFlash(0.45);
      this.triggerCameraImpact({ ampPos: 0.18, ampRot: 0.032, fovKick: -3.0, decay: 4.5 });
    }, null, b.moonSpaceImpact);

    if (fadeEl) {
      tl.to(fadeEl, {
        opacity: 1,
        duration: b.fadeOutDone - (b.moonSpaceImpact + 0.35),
        ease: 'sine.inOut',
      }, b.moonSpaceImpact + 0.35);
    }

    // Switch Scene to Shadowed Lunar Surface while faded dark (30.65s)
    tl.call(() => {
      this.spaceGroup.visible = false;
      this.lunarGroup.visible = true;
      this.ambLight.intensity = 0.24;
      this.sunLight.intensity = 1.75;
      this.sunLight.position.set(11, 8, 6);
      this.rimLight.color.set('#84DCFF');
      this.rimLight.intensity = 1.45;
      this.rimLight.position.set(-4.5, 4.2, -3.5);
      this.fillLight.intensity = 0.34;
      this.craterLight.intensity = 1.25;

      this.lunarSurface.resetDebris();
      this._resetTabletAtCrater();
      this.stoneTablet.visible = false;
      if (this.karsRoot) this.karsRoot.visible = false;

      this.state.cameraMode = 'lunar';
      this.state.meteorMode = 'lunar';
      this.state.meteorActive = true;
      this.state.meteorProgress = 0.0;
      this.comet.setVisible(true);
      this.comet.resetTrail(this.lunarMeteorCurve.getPoint(0));

      this.camPos.set(1.2, 2.55, 5.4);
      this.camTarget.set(0.2, 1.4, -1.2);
    }, null, b.fadeOutDone);

    if (fadeEl) {
      tl.to(fadeEl, {
        opacity: 0,
        duration: b.fadeInDone - b.fadeOutDone,
        ease: 'sine.inOut',
      }, b.fadeOutDone + 0.05);
    }

    // =========================================================================
    // ACT 3 (30.65s -> 48.45s): LUNAR METEOR EXPLOSION -> OVERHEAD -> ANIME ZOOM -> 5-SHOT KARS
    // =========================================================================
    tl.to(this.state, {
      meteorProgress: 1.0,
      duration: b.lunarMeteorImpact - (b.fadeOutDone + 0.08),
      ease: 'power2.in',
    }, b.fadeOutDone + 0.08);

    tl.to(this.camTarget, {
      x: this.craterTabletPos.x,
      y: this.craterTabletPos.y + 0.1,
      z: this.craterTabletPos.z,
      duration: 1.25,
      ease: 'power2.out',
    }, b.fadeOutDone + 0.3);

    tl.call(() => {
      this.state.meteorActive = false;
      this.comet.setVisible(false);
      this.stoneTablet.visible = true;
      this.lunarSurface.triggerMeteorGroundImpact();
      this._triggerImpactFlash(0.62);
      this.triggerCameraImpact({ ampPos: 0.22, ampRot: 0.036, fovKick: 3.5, decay: 3.8 });
    }, null, b.lunarMeteorImpact);

    // Overhead Crane Shot descending toward Stone Tablet
    tl.to(this.camPos, { x: -0.05, y: 4.85, z: 1.65, duration: 1.0, ease: 'power2.out' }, b.overheadStart);
    tl.to(this.camTarget, {
      x: this.craterTabletPos.x,
      y: this.craterTabletPos.y + 0.08,
      z: this.craterTabletPos.z,
      duration: 1.0,
      ease: 'power2.out',
    }, b.overheadStart);
    tl.to(this.camPos, {
      x: -0.1,
      y: 2.22,
      z: 1.15,
      duration: b.animeZoomTablet - (b.overheadStart + 1.0),
      ease: 'sine.inOut',
    }, b.overheadStart + 1.0);

    // Anime Zoom + Shake + 110 Black G-Pen Speedlines on Monolithic Stone Tablet
    tl.call(() => {
      this._setAnimeFx(true);
      this.state.shakeAmp = 0.075;
    }, null, b.animeZoomTablet);

    tl.to(this.camPos, { x: -0.11, y: 1.18, z: 0.88, duration: 0.85, ease: 'power3.out' }, b.animeZoomTablet);
    tl.to(this.camFov, { value: 38, duration: 0.85, ease: 'power3.out' }, b.animeZoomTablet);

    // -------------------------------------------------------------------------
    // 5-SHOT KARS SEQUENCE
    // -------------------------------------------------------------------------
    // Shot A (38.5s -> 40.25s): Clear low-angle lunar surface -> Boot stomps cleanly into dust!
    tl.call(() => {
      this._setAnimeFx(false);
      this.state.shakeAmp = 0;
      if (this.karsRoot) this.karsRoot.visible = true;
      this.camPos.set(0.95, 0.48, -0.25);
      this.camTarget.set(0.06, 0.28, -1.25);
      this.camFov.value = 44;
    }, null, b.lunarGroundShot);

    tl.call(() => {
      this.lunarSurface.triggerFootstep(0.18, -1.25, true);
      this.triggerCameraImpact({ ampPos: 0.15, ampRot: 0.026, fovKick: 2.2, decay: 5.5 });
    }, null, b.karsBootStomp);

    // Shot B (40.25s -> 42.30s): Snap Zoom-Out + Trauma Jolt + G-pen SFX highlighting Kars
    tl.call(() => {
      this._setAnimeFx(true);
      this.triggerCameraImpact({ ampPos: 0.18, ampRot: 0.032, fovKick: -5.0, decay: 3.4 });
    }, null, b.karsHeroZoomOut);

    tl.to(this.camPos, { x: 0.68, y: 0.72, z: 1.55, duration: 0.36, ease: 'expo.out' }, b.karsHeroZoomOut);
    tl.to(this.camTarget, { x: -0.02, y: 0.92, z: -0.95, duration: 0.36, ease: 'expo.out' }, b.karsHeroZoomOut);
    tl.to(this.camFov, { value: 48, duration: 0.36, ease: 'expo.out' }, b.karsHeroZoomOut);

    // Slow footsteps during Shot B & approach
    tl.call(() => this.lunarSurface.triggerFootstep(-0.20, -0.98, false), null, b.karsHeroZoomOut + 0.45);
    tl.call(() => this.lunarSurface.triggerFootstep(0.18, -0.68, false), null, b.karsHeroZoomOut + 1.70);

    for (const ms of this.menacingSprites) {
      tl.to(ms.mat, { opacity: 0.88, duration: 0.65 }, b.karsHeroZoomOut + 0.2);
    }

    // Shot C (42.30s -> 45.20s): Cut BEHIND-RIGHT (-X, -Z) of Kars facing the Stone Tablet -> Kneel & Pickup
    tl.call(() => {
      this._setAnimeFx(false);
      this.camPos.set(-1.02, 1.06, -1.56);
      this.camTarget.set(-0.08, 0.28, 0.18);
      this.camFov.value = 46;
    }, null, b.karsBehindCut);

    tl.call(() => this.lunarSurface.triggerFootstep(-0.18, -0.36, false), null, b.karsBehindCut + 0.90);

    tl.to(this.camPos, { x: -0.88, y: 0.92, z: -1.16, duration: 2.0, ease: 'sine.inOut' }, b.karsBehindCut);
    tl.to(this.camTarget, { x: -0.08, y: 0.26, z: 0.18, duration: 2.0, ease: 'sine.inOut' }, b.karsBehindCut);

    tl.call(() => {
      this.state.tabletAttached = true;
      this.state.tabletPickupBlend = 0;
    }, null, b.tabletGrab);

    tl.to(this.state, {
      tabletPickupBlend: 1.0,
      duration: b.karsGazeStart - b.tabletGrab,
      ease: 'power2.inOut',
    }, b.tabletGrab);

    // Shot D (45.20s -> 47.60s): Clear Over-the-Right-Shoulder (-X, -Z) Gaze at Stone Tablet (~2.4s)
    tl.to(this.camPos, { x: -1.12, y: 1.54, z: -0.98, duration: 0.7, ease: 'power2.out' }, b.karsGazeStart);
    tl.to(this.camTarget, { x: -0.08, y: 1.32, z: 0.08, duration: 0.7, ease: 'power2.out' }, b.karsGazeStart);
    tl.to(this.camFov, { value: 44, duration: 0.7, ease: 'power2.out' }, b.karsGazeStart);

    // Shot E (47.60s -> 48.45s): Wind-up & Throw Stone Tablet into Lunar Sky
    tl.to(this.camPos, { x: -1.06, y: 1.26, z: -1.28, duration: 0.55, ease: 'power2.out' }, b.karsWindupStart);
    tl.to(this.camTarget, { x: -0.06, y: 1.72, z: 0.28, duration: 0.55, ease: 'power2.out' }, b.karsWindupStart);
    tl.to(this.camFov, { value: 48, duration: 0.55, ease: 'power2.out' }, b.karsWindupStart);

    tl.call(() => {
      this.state.tabletAttached = false;
      this.state.tabletPickupBlend = 0;
      this.state.tabletThrown = true;
      this.tabletVelocity.set(0.05, 4.25, 1.02);
      this.tabletAngVel.set(1.8, 2.8, -1.0);
      this.state.cameraMode = 'tabletTrack';
      this.triggerCameraImpact({ ampPos: 0.09, ampRot: 0.016, fovKick: -2.0, decay: 4.5 });
    }, null, b.tabletThrow);

    // =========================================================================
    // ACT 4 (48.45s -> 57.5s): SLOW FREEZE -> CLOSE-UP -> DIAGONAL CRACK & SPLIT -> SUPERNOVA
    // =========================================================================
    tl.to(this.state, { worldTimeScale: 0.14, duration: 1.25, ease: 'power2.out' }, b.tabletThrow + 0.25);
    tl.to(this.state, { worldTimeScale: 0.0, duration: 1.33, ease: 'power3.out' }, b.tabletThrow + 1.5);
    tl.to(this.state, { handheldWeight: 0.0, duration: 1.2, ease: 'power2.out' }, b.tabletThrow + 0.8);

    tl.to(this.state, {
      crackProgress: 1.0,
      duration: b.splitStart - b.crackStart,
      ease: 'power1.inOut',
      onUpdate: () => {
        this.fracturableTablet.setCrackProgress(this.state.crackProgress);
      },
    }, b.crackStart);
    tl.call(() => {
      this.triggerCameraImpact({ ampPos: 0.04, ampRot: 0.008, fovKick: 0, decay: 2.8 });
    }, null, b.crackStart);
    tl.set(this.state, { shakeAmp: 0.018 }, b.crackStart);

    tl.to(this.state, {
      splitProgress: 1.0,
      duration: b.supernovaStart - b.splitStart + 0.15,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.fracturableTablet.setSplitProgress(this.state.splitProgress);
      },
    }, b.splitStart);
    tl.call(() => {
      this.triggerCameraImpact({ ampPos: 0.08, ampRot: 0.014, fovKick: -1.5, decay: 3.2 });
    }, null, b.splitStart);
    tl.set(this.state, { shakeAmp: 0.03 }, b.splitStart);

    tl.call(() => {
      this.state.shakeAmp = 0;
    }, null, b.supernovaStart);

    if (novaEl) {
      tl.to(novaEl, {
        opacity: 1,
        scale: 2.6,
        duration: b.tabletReveal - b.supernovaStart,
        ease: 'expo.in',
      }, b.supernovaStart);
    }

    tl.call(() => {
      this.isFrozenFinale = true;
      this.stoneTablet.visible = false;
      this.onTabletReady();
    }, null, b.tabletReveal);

    if (novaEl) {
      tl.to(novaEl, {
        opacity: 0,
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => {
          novaEl.style.transform = 'scale(0.06)';
        },
      }, b.tabletReveal + 0.06);
    }

    this.timeline = tl;
  }

  _triggerImpactFlash(peak = 0.72) {
    const el = document.getElementById('impact-flash');
    if (!el) return;
    el.style.opacity = String(peak);
    setTimeout(() => {
      el.style.opacity = '0';
    }, 120);
  }

  _startRenderLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.clock.start();

    const tick = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(tick);

      if (this.isRenderPaused) return;

      const rawDt = Math.min(this.clock.getDelta(), 0.05);
      this.elapsedGlobal += rawDt;
      const scaledDt = rawDt * this.state.worldTimeScale;

      this._updateFrame(rawDt, scaledDt);
      this.composer.render();
    };

    tick();
  }

  setPaused(paused) {
    this.isRenderPaused = Boolean(paused);
    if (!this.isRenderPaused) {
      this.clock.getDelta();
      this._onResize?.();
    }
  }

  _updateFrame(rawDt, scaledDt) {
    this.deepStars.uniforms.uTime.value = this.elapsedGlobal;
    this.vortex.uniforms.uTime.value = this.elapsedGlobal;

    if (this.isAmbientStandby) {
      const t = this.elapsedGlobal;
      this.vortex.uniforms.uSpinAngle.value = t * 0.34;
      this.vortex.uniforms.uCollapse.value = 0;
      this.vortex.uniforms.uBurst.value = 0;
      this.camPos.set(Math.sin(t * 0.22) * 0.24, 0.55 + Math.cos(t * 0.17) * 0.05, 8.8);
      this.camTarget.set(0, 0, 0);
    }

    this.cosmicPlanets.update(
      this.elapsedGlobal,
      this.vortex.uniforms.uSpinAngle.value,
      this.vortex.uniforms.uCollapse.value,
      this.vortex.uniforms.uBurst.value
    );

    if (this.spaceGroup.visible) {
      this.moon.sphere.rotation.y += scaledDt * 0.04;
      this.moon.updateSpaceImpact(rawDt);
    }

    if (this.state.meteorActive) {
      const mp = Math.min(1, Math.max(0, this.state.meteorProgress));
      const curve = this.state.meteorMode === 'lunar' ? this.lunarMeteorCurve : this.spaceMeteorCurve;
      const mPos = curve.getPoint(mp);
      const mTan = curve.getTangent(mp);
      const camWorld = this.camera.position.clone().add(this.cameraRig.position);
      this.comet.update(mPos, mTan, camWorld, rawDt);

      if (this.state.cameraMode === 'meteorLock') {
        const camOffset = new THREE.Vector3(-1.85, 0.52, 2.05);
        this.camPos.lerp(mPos.clone().add(camOffset), 0.25);
        this.camTarget.lerp(mPos.clone().addScaledVector(mTan, 0.75), 0.35);
      }

      this.speedStreaks.update(rawDt, this.state.streakIntensity, this.camPos, mTan);
    } else {
      this.speedStreaks.update(rawDt, 0, this.camPos, new THREE.Vector3(0, 0, -1));
    }

    if (this.lunarGroup.visible) {
      this.lunarSurface.update(scaledDt);
    }

    if (this.karsRoot?.visible && this.karsRig && !this.isFrozenFinale) {
      const curTime = this._explicitSeekTime ?? this.timeline?.time() ?? 0;
      this.karsRig.updateAtTimeline(curTime, this.cfg.beats);
    }

    for (const ms of this.menacingSprites) {
      ms.sp.position.y = ms.baseY + Math.sin(this.elapsedGlobal * 1.4 + ms.phase) * 0.06 * this.state.worldTimeScale;
    }

    if (this.state.tabletAttached && this.handRightBone) {
      this.handRightBone.updateWorldMatrix(true, false);
      const handPos = new THREE.Vector3();
      const handQuat = new THREE.Quaternion();
      this.handRightBone.getWorldPosition(handPos);
      this.handRightBone.getWorldQuaternion(handQuat);

      // Seat Stone Tablet cleanly in front of Hand.R palm so fingers cradle rear without clipping face
      const targetPos = handPos.clone().add(new THREE.Vector3(-0.02, 0.14, -0.045));
      // Orient carved front face (+Z) cleanly toward Kars & over-right-shoulder camera
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, Math.PI * 0.88, -0.06));

      const blend = THREE.MathUtils.smoothstep(this.state.tabletPickupBlend, 0, 1);
      this.stoneTablet.position.lerpVectors(this.craterTabletPos, targetPos, blend);
      this.stoneTablet.quaternion.slerpQuaternions(this.craterTabletQuat, targetQuat, blend);
    } else if (this.state.tabletThrown) {
      if (this.state.worldTimeScale > 0.002) {
        this.tabletVelocity.y -= 1.62 * scaledDt;
        this.stoneTablet.position.addScaledVector(this.tabletVelocity, scaledDt);
        this.stoneTablet.rotation.x += this.tabletAngVel.x * scaledDt;
        this.stoneTablet.rotation.y += this.tabletAngVel.y * scaledDt;
        this.stoneTablet.rotation.z += this.tabletAngVel.z * scaledDt;
      }

      if (this.state.cameraMode === 'tabletTrack') {
        const distZ = THREE.MathUtils.lerp(1.45, 0.76, 1 - this.state.worldTimeScale);
        const desiredCam = this.stoneTablet.position.clone().add(new THREE.Vector3(0.0, 0.01, distZ));
        this.camPos.lerp(desiredCam, 0.07 + (1 - this.state.worldTimeScale) * 0.14);
        this.camTarget.lerp(this.stoneTablet.position, 0.14);

        if (this.state.worldTimeScale < 0.25) {
          this.stoneTablet.rotation.x = THREE.MathUtils.lerp(this.stoneTablet.rotation.x, 0.02, 0.14);
          this.stoneTablet.rotation.y = THREE.MathUtils.lerp(this.stoneTablet.rotation.y, 0.0, 0.14);
          this.stoneTablet.rotation.z = THREE.MathUtils.lerp(this.stoneTablet.rotation.z, 0.0, 0.14);
        }
      }
    }

    this.fracturableTablet.updateShards(rawDt);

    this.cameraRig.position.copy(this.camPos);
    if (!this._lookMat) this._lookMat = new THREE.Matrix4();
    this._lookMat.lookAt(this.camPos, this.camTarget, this.camera.up);
    this.cameraRig.quaternion.setFromRotationMatrix(this._lookMat);

    const hAmpPos = (this.cfg.camera.handheldAmpPos || 0.04) * this.state.handheldWeight;
    const hAmpRot = (this.cfg.camera.handheldAmpRot || 0.009) * this.state.handheldWeight;
    const f = this.cfg.camera.handheldFreq || 1.25;
    const t = this.elapsedGlobal;

    const swayX = Math.sin(t * f * 1.1) * hAmpPos + Math.sin(t * f * 2.7) * hAmpPos * 0.35;
    const swayY = Math.cos(t * f * 0.85) * hAmpPos * 0.8 + Math.cos(t * f * 2.1) * hAmpPos * 0.3;
    const shakeX = (Math.random() - 0.5) * this.state.shakeAmp;
    const shakeY = (Math.random() - 0.5) * this.state.shakeAmp;

    let traumaX = 0;
    let traumaY = 0;
    let traumaZ = 0;
    let traumaRoll = 0;
    let traumaFov = 0;
    if (this.trauma.active) {
      this.trauma.age += rawDt;
      const env = Math.exp(-this.trauma.age * this.trauma.decay);
      if (env < 0.008) {
        this.trauma.active = false;
      } else {
        const ta = this.trauma.age;
        traumaX = env * this.trauma.ampPos * (0.65 * Math.sin(ta * 46) + 0.35 * Math.cos(ta * 79));
        traumaY = env * this.trauma.ampPos * (0.6 * Math.cos(ta * 41) + 0.4 * Math.sin(ta * 67));
        traumaZ = env * this.trauma.ampPos * 0.45 * Math.sin(ta * 33);
        traumaRoll = env * this.trauma.ampRot * Math.sin(ta * 37);
        traumaFov = env * this.trauma.fovKick;
      }
    }

    this.camera.position.set(swayX + shakeX + traumaX, swayY + shakeY + traumaY, traumaZ);
    this.camera.rotation.set(
      Math.cos(t * f * 0.9) * hAmpRot,
      Math.sin(t * f * 1.15) * hAmpRot,
      Math.sin(t * f * 0.7) * hAmpRot * 0.7 + traumaRoll
    );

    const targetFov = this.camFov.value + traumaFov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * Jump deterministically to a specific timeline second (for visual inspection)
   */
  seekTo(seconds) {
    if (!this.timeline) return;
    const b = this.cfg.beats;
    this.replay();
    this.timeline.pause();
    this.timeline.seek(seconds, false);

    if (seconds < b.shockwave) {
      this._applyGalaxyKinematics(seconds);
    }

    if (seconds >= b.meteorLockStart && seconds <= b.meteorLockEnd) {
      this.state.meteorActive = true;
      this.state.meteorMode = 'space';
      this.comet.setVisible(true);
      const mp = Math.min(1, Math.max(0, this.state.meteorProgress));
      const mPos = this.spaceMeteorCurve.getPoint(mp);
      const mTan = this.spaceMeteorCurve.getTangent(mp);
      this.comet.resetTrail(mPos.clone().addScaledVector(mTan, -1.8));
      for (let k = 0; k < 24; k++) {
        const subMp = Math.max(0, mp - (24 - k) * 0.005);
        this.comet.update(
          this.spaceMeteorCurve.getPoint(subMp),
          this.spaceMeteorCurve.getTangent(subMp),
          this.camPos,
          0.016
        );
      }
      this.camPos.copy(mPos).add(new THREE.Vector3(-1.85, 0.52, 2.05));
      this.camTarget.copy(mPos).addScaledVector(mTan, 0.75);
    }

    if (seconds >= b.moonSpaceImpact && seconds < b.fadeOutDone) {
      this.moon.applySpaceImpactAt(seconds - b.moonSpaceImpact);
    }

    if (seconds >= b.fadeOutDone) {
      this._setOverlayOpacity('scene-fade', 0);
      this.spaceGroup.visible = false;
      this.lunarGroup.visible = true;
      this.ambLight.intensity = 0.24;
      this.sunLight.intensity = 1.75;
      this.sunLight.position.set(11, 8, 6);
      this.rimLight.color.set('#84DCFF');
      this.rimLight.intensity = 1.45;
      this.rimLight.position.set(-4.5, 4.2, -3.5);
      this.fillLight.intensity = 0.34;
      this.craterLight.intensity = 1.25;
    }

    if (seconds >= b.lunarMeteorImpact) {
      this.stoneTablet.visible = seconds < b.tabletReveal;
      this.lunarSurface.triggerMeteorGroundImpact();
      const simTime = Math.min(2.8, Math.max(0.06, seconds - b.lunarMeteorImpact));
      const step = 0.04;
      for (let s = 0; s < simTime; s += step) {
        this.lunarSurface.update(step);
      }
    }

    if (seconds >= b.lunarGroundShot && this.karsRoot && this.karsRig) {
      this.karsRoot.visible = true;
      this.karsRig.updateAtTimeline(seconds, b);
      if (seconds >= b.karsBootStomp) {
        this.lunarSurface.triggerFootstep(0.18, -1.25, true);
        const stepAge = Math.min(0.65, Math.max(0.04, seconds - b.karsBootStomp));
        for (let s = 0; s < stepAge; s += 0.04) {
          this.lunarSurface.update(0.04);
        }
      }
    }

    if (seconds >= b.tabletThrow) {
      const airPos = new THREE.Vector3(0.04, 3.25, 1.32);
      this.stoneTablet.visible = seconds < b.tabletReveal;
      this.stoneTablet.position.copy(airPos);
      this.stoneTablet.rotation.set(0.03, 0.0, 0.0);
      this.camPos.copy(airPos).add(new THREE.Vector3(0, 0.01, 0.76));
      this.camTarget.copy(airPos);
      this.fracturableTablet.setCrackProgress(this.state.crackProgress);
      this.fracturableTablet.setSplitProgress(this.state.splitProgress);
      this.fracturableTablet.updateShards(0.35);
    }

    this._explicitSeekTime = seconds;
    this._updateFrame(0.016, 0.0);
    this.composer?.render();
    this._explicitSeekTime = null;
  }

  skipToFinale() {
    if (!this.timeline) {
      this.isFrozenFinale = true;
      this.onTabletReady();
      return;
    }

    this.isRenderPaused = false;
    this.timeline.pause();
    this._setOverlayOpacity('scene-fade', 0);
    this._setOverlayOpacity('supernova-flash', 0);
    this._setAnimeFx(false);

    this.spaceGroup.visible = false;
    this.lunarGroup.visible = true;
    this.ambLight.intensity = 0.2;
    this.sunLight.intensity = 1.65;
    this.sunLight.position.set(11, 8, 6);
    this.rimLight.intensity = 0.85;
    this.fillLight.intensity = 0.25;

    this.state.meteorActive = false;
    this.comet.setVisible(false);
    this.state.streakIntensity = 0;
    this.state.handheldWeight = 0;
    this.state.shakeAmp = 0;
    this.trauma.active = false;
    this.state.worldTimeScale = 0;
    this.state.tabletAttached = false;
    this.state.tabletPickupBlend = 0;
    this.state.tabletThrown = true;
    this.state.cameraMode = 'tabletTrack';

    if (this.karsRoot && this.karsRig) {
      this.karsRoot.visible = true;
      this.karsRig.updateAtTimeline(this.cfg.beats.timeFreezeComplete || 51.3, this.cfg.beats);
    }

    for (const ms of this.menacingSprites) {
      ms.mat.opacity = 0.75;
    }

    const frozenPos = new THREE.Vector3(0.05, 3.3, 1.35);
    this.stoneTablet.visible = false;
    this.stoneTablet.position.copy(frozenPos);
    this.stoneTablet.rotation.set(0.03, 0, 0);
    this.fracturableTablet.setCrackProgress(1.0);
    this.fracturableTablet.setSplitProgress(1.0);

    this.camPos.copy(frozenPos).add(new THREE.Vector3(0, 0.01, 0.85));
    this.camTarget.copy(frozenPos);
    this.camFov.value = this.cfg.camera.fovBase || 50;

    this.isFrozenFinale = true;
    this.onTabletReady();
  }

  replay() {
    if (!this.timeline) return;
    this.isFrozenFinale = false;
    this.isRenderPaused = false;
    this.isAmbientStandby = false;
    this.ambientThetaOffset = 0;
    this._onResize?.();
    this._explicitSeekTime = null;

    this.rimLight.color.set(this.cfg.colors.amethyst);
    this.rimLight.intensity = 1.75;
    this.rimLight.position.set(-4, 6, -10);

    this._setOverlayOpacity('scene-fade', 0);
    const novaEl = document.getElementById('supernova-flash');
    if (novaEl) {
      novaEl.style.opacity = '0';
      novaEl.style.transform = 'scale(0.06)';
    }
    this._setAnimeFx(false);

    this.spaceGroup.visible = true;
    this.lunarGroup.visible = false;
    this.ambLight.intensity = 0.55;
    this.sunLight.intensity = 2.55;
    this.sunLight.position.set(12, 8, 10);

    this.state.galaxyClock = 0;
    this.vortex.uniforms.uSpinAngle.value = 0;
    this.vortex.uniforms.uCollapse.value = 0;
    this.vortex.uniforms.uBurst.value = 0;
    this.vortex.spiralGuideMat.opacity = 0.08;
    this.vortex.spiralGuides.scale.set(1, 1, 1);
    this.vortex.coreSprite.scale.set(2.0, 2.0, 1);
    this.vortex.coreSprite.material.opacity = 0.56;
    this.vortex.shockMat.uniforms.uProgress.value = 0;
    this.vortex.shockMat.uniforms.uOpacity.value = 0;

    this.moon.resetSpaceImpact();
    this.comet.setVisible(false);
    this.lunarSurface.resetDebris();
    if (this.karsRoot) this.karsRoot.visible = false;
    for (const ms of this.menacingSprites) ms.mat.opacity = 0;

    this.state.handheldWeight = 0;
    this.state.shakeAmp = 0;
    this.trauma.active = false;
    this.state.meteorProgress = 0;
    this.state.meteorActive = false;
    this.state.meteorMode = 'space';
    this.state.streakIntensity = 0;
    this.state.worldTimeScale = 1.0;
    this.state.tabletAttached = false;
    this.state.tabletPickupBlend = 0;
    this.state.tabletThrown = false;
    this.state.crackProgress = 0;
    this.state.splitProgress = 0;
    this.state.cameraMode = 'spin';

    this.camPos.set(0, 0.55, 8.8);
    this.camTarget.set(0, 0, 0);
    this.camFov.value = this.cfg.camera.fovBase || 50;
    this._resetTabletAtCrater();

    this.timeline.restart();
  }

  _bindResize() {
    this._onResize = () => {
      if (!this.renderer || !this.camera) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this.composer?.setSize(w, h);
      this.bloomPass?.resolution.set(w, h);
      this.deepStars.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
      this.vortex.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio || 1, 2);
    };
    window.addEventListener('resize', this._onResize);
  }

  dispose() {
    this.disposed = true;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.timeline) this.timeline.kill();
    window.removeEventListener('resize', this._onResize);
    this.composer?.dispose();
    if (this.renderer) this.renderer.dispose();
  }
}
