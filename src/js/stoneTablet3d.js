import * as THREE from 'three';
import { createGlowSpriteTexture } from './spinVortex.js';

/**
 * Slightly diagonal jagged vertical crack curve along the center of the Stone Tablet.
 * Applied ONLY to the interior cut face when the two crisp monolith halves crack apart.
 */
function crackProfileX(y, z = 0) {
  return (
    0.042 * (y / 0.29) +
    0.015 * Math.sin(19.0 * y) +
    0.008 * Math.sin(43.0 * y + 7.0 * z) +
    0.004 * Math.cos(83.0 * y)
  );
}

/**
 * Generates crisp original basalt monolith albedo + subtle engraved relief bump map.
 */
function createStoneMaps(colors) {
  const w = 768;
  const h = 1080;

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = w;
  colorCanvas.height = h;
  const cCtx = colorCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const bCtx = bumpCanvas.getContext('2d');

  cCtx.fillStyle = '#1e1d2a';
  cCtx.fillRect(0, 0, w, h);
  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, w, h);

  let s = 91823;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let i = 0; i < 6500; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const rad = 1.0 + rand() * 3.6;
    const bright = rand() > 0.5;
    cCtx.fillStyle = bright ? 'rgba(255,255,255,0.065)' : 'rgba(6,6,12,0.34)';
    cCtx.fillRect(x, y, rad, rad);

    bCtx.fillStyle = bright ? 'rgba(215,215,215,0.24)' : 'rgba(32,32,32,0.30)';
    bCtx.fillRect(x, y, rad, rad);
  }

  // Subtle carved basalt micro-fissures for authentic stony relief
  bCtx.strokeStyle = 'rgba(24,24,24,0.35)';
  bCtx.lineWidth = 1.4;
  for (let f = 0; f < 34; f++) {
    let fx = rand() * w;
    let fy = rand() * h;
    bCtx.beginPath();
    bCtx.moveTo(fx, fy);
    for (let seg = 0; seg < 6; seg++) {
      fx += (rand() - 0.5) * 44;
      fy += (rand() - 0.5) * 44;
      bCtx.lineTo(fx, fy);
    }
    bCtx.stroke();
  }

  const drawCarvings = (ctx, stroke, lw) => {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.strokeRect(36, 36, w - 72, h - 72);
    ctx.strokeRect(57, 57, w - 114, h - 114);

    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 195, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(w / 2, h * 0.42, 114, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(90, h * 0.42);
    ctx.lineTo(w - 90, h * 0.42);
    ctx.moveTo(w / 2, 105);
    ctx.lineTo(w / 2, h - 105);
    ctx.stroke();

    ctx.strokeRect(129, h * 0.68, w - 258, 165);
  };

  drawCarvings(cCtx, colors.gold, 6);
  drawCarvings(bCtx, '#323232', 8);

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.anisotropy = 8;
  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  bumpTex.anisotropy = 8;

  return { colorTex, bumpTex };
}

/**
 * Builds one interlocked half ('left' or 'right') with razor-sharp straight outer monolith
 * silhouette & edges, and undistorted UVs computed AFTER inner crack shaping.
 */
function buildHalfGeometry(side) {
  const halfW = 0.195;
  const height = 0.56;
  const depth = 0.064;

  const geo = new THREE.BoxGeometry(halfW, height, depth, 10, 48, 8);
  geo.translate(side === 'left' ? -halfW / 2 : halfW / 2, 0, 0);

  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const totalW = halfW * 2;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);

    const isInnerSeam = Math.abs(x) < 0.002;
    const isFront = z > depth * 0.45;
    const isBack = z < -depth * 0.45;

    if (isInnerSeam) {
      x = crackProfileX(y, z);
      if (Math.abs(z) < depth * 0.45) {
        z += Math.sin(y * 55 + z * 40) * 0.0022;
      }
    }

    pos.setXYZ(i, x, y, z);

    // Recompute UVs AFTER moving isInnerSeam so the carved vertical gold line stays straight!
    if (isFront || isBack) {
      const uVal = (x + totalW * 0.5) / totalW;
      const vVal = (y + height * 0.5) / height;
      uv.setXY(i, Math.min(1, Math.max(0, uVal)), Math.min(1, Math.max(0, vVal)));
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds the Crisp Monolithic Stone Tablet (pure solid single mesh when closed, swapping cleanly
 * to 2 jagged interlocking halves + flying stone chips ONLY when cracking/splitting open).
 */
export function createFracturableStoneTablet(colors) {
  const root = new THREE.Group();
  const { colorTex, bumpTex } = createStoneMaps(colors);

  const stoneMat = new THREE.MeshStandardMaterial({
    map: colorTex,
    bumpMap: bumpTex,
    bumpScale: 0.042,
    roughness: 0.84,
    metalness: 0.12,
  });

  // 100% solid seamless monolith model used before crackStart
  const solidMonolith = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.56, 0.064), stoneMat);
  solidMonolith.castShadow = true;
  solidMonolith.receiveShadow = true;
  root.add(solidMonolith);

  const leftHalf = new THREE.Mesh(buildHalfGeometry('left'), stoneMat);
  const rightHalf = new THREE.Mesh(buildHalfGeometry('right'), stoneMat);
  leftHalf.visible = false;
  rightHalf.visible = false;
  leftHalf.castShadow = true;
  rightHalf.castShadow = true;
  root.add(leftHalf, rightHalf);

  // Glowing jagged diagonal crack vein (completely hidden until crackProgress > 0.01)
  const crackSegs = 64;
  const crackPositions = new Float32Array(crackSegs * 2 * 3);
  const crackUvs = new Float32Array(crackSegs * 2 * 2);
  const crackIndices = [];

  for (let i = 0; i < crackSegs; i++) {
    const t = i / (crackSegs - 1);
    const y = THREE.MathUtils.lerp(0.275, -0.275, t);
    const cx = crackProfileX(y, 0.033);
    const halfThick = 0.007 * (0.65 + 0.55 * Math.sin(t * Math.PI));

    crackPositions[i * 6] = cx - halfThick;
    crackPositions[i * 6 + 1] = y;
    crackPositions[i * 6 + 2] = 0.035;

    crackPositions[i * 6 + 3] = cx + halfThick;
    crackPositions[i * 6 + 4] = y;
    crackPositions[i * 6 + 5] = 0.035;

    crackUvs[i * 4] = 0;
    crackUvs[i * 4 + 1] = t;
    crackUvs[i * 4 + 2] = 1;
    crackUvs[i * 4 + 3] = t;

    if (i < crackSegs - 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      crackIndices.push(a, b, c, b, d, c);
    }
  }

  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute('position', new THREE.BufferAttribute(crackPositions, 3));
  crackGeo.setAttribute('uv', new THREE.BufferAttribute(crackUvs, 2));
  crackGeo.setIndex(crackIndices);

  const crackMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCrackProgress: { value: 0 },
      uIntensity: { value: 0 },
      uGold: { value: new THREE.Color(colors.gold) },
      uCore: { value: new THREE.Color('#FFFFFF') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uCrackProgress;
      uniform float uIntensity;
      uniform vec3 uGold;
      uniform vec3 uCore;

      void main() {
        if (uIntensity < 0.01 || vUv.y > uCrackProgress) discard;
        float tip = smoothstep(uCrackProgress, max(0.0, uCrackProgress - 0.14), vUv.y);
        float centerGlow = 1.0 - abs(vUv.x * 2.0 - 1.0);
        vec3 col = mix(uGold, uCore, pow(centerGlow, 1.4));
        gl_FragColor = vec4(col * 1.8, centerGlow * uIntensity * (0.65 + 0.35 * tip));
      }
    `,
  });
  const crackMesh = new THREE.Mesh(crackGeo, crackMat);
  crackMesh.visible = false;
  root.add(crackMesh);

  // Soft Gaussian-feathered White-Gold Light Core revealed when halves separate
  const coreGroup = new THREE.Group();
  const coreMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uGold: { value: new THREE.Color(colors.gold) },
      uCore: { value: new THREE.Color('#FFFDF7') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uOpacity;
      uniform vec3 uGold;
      uniform vec3 uCore;
      void main() {
        float dx = abs(vUv.x - 0.5) * 2.0;
        float dy = abs(vUv.y - 0.5) * 2.0;
        float beamX = exp(-dx * dx * 4.5);
        float beamY = 1.0 - smoothstep(0.42, 1.0, dy);
        float intensity = beamX * beamY;
        vec3 col = mix(uGold, uCore, pow(intensity, 1.35));
        gl_FragColor = vec4(col * 1.15, intensity * uOpacity);
      }
    `,
  });
  const coreBar = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.6), coreMat);
  coreBar.rotation.z = -0.14;
  coreGroup.add(coreBar);

  const coreGlowTex = createGlowSpriteTexture('#FFFFFF', colors.gold, 128);
  const coreGlowSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coreGlowTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  coreGlowSprite.scale.set(0.65, 0.95, 1);
  coreGroup.add(coreGlowSprite);
  root.add(coreGroup);

  // 20 Crisp Angular Chiseled Basalt Chips (smooth continuous displacement -> zero torn triangles)
  const chipGeo = new THREE.DodecahedronGeometry(0.0095, 0);
  const cPos = chipGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const vx = cPos.getX(i);
    const vy = cPos.getY(i);
    const vz = cPos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    const m = 0.84 + 0.22 * Math.sin(nx * 2.5 + ny * 1.8) * Math.cos(nz * 2.3);
    cPos.setXYZ(i, vx * m * 1.25, vy * m * 0.72, vz * m * 0.9);
  }
  chipGeo.computeVertexNormals();

  const chipMat = new THREE.MeshStandardMaterial({
    color: '#4a475c',
    roughness: 0.65,
    metalness: 0.14,
  });

  const shards = [];
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    const y = THREE.MathUtils.lerp(0.24, -0.24, t);
    const dirSign = i % 2 === 0 ? 1 : -1;
    const x = crackProfileX(y, 0.032) + dirSign * 0.01;
    const mesh = new THREE.Mesh(chipGeo, chipMat);
    mesh.visible = false;
    const sc = 0.65 + (i % 4) * 0.22;
    mesh.scale.setScalar(sc);
    root.add(mesh);

    shards.push({
      mesh,
      triggerT: t * 0.85,
      origin: new THREE.Vector3(x, y, 0.036),
      vel: new THREE.Vector3(
        dirSign * (0.22 + (i % 5) * 0.065),
        ((i % 7) - 3) * 0.055,
        0.14 + (i % 3) * 0.08
      ),
      rotVel: new THREE.Vector3((i % 3 - 1) * 4.5, (i % 5 - 2) * 3.5, dirSign * 5.0),
      spawned: false,
      age: 0,
    });
  }

  let curCrackProg = 0;
  let curSplitProg = 0;

  function _syncFractureMode() {
    const fractured = curCrackProg > 0.005 || curSplitProg > 0.005;
    solidMonolith.visible = !fractured;
    leftHalf.visible = fractured;
    rightHalf.visible = fractured;
  }

  function setCrackProgress(p) {
    const prog = THREE.MathUtils.clamp(p, 0, 1);
    curCrackProg = prog;
    _syncFractureMode();

    crackMesh.visible = prog > 0.01;
    crackMat.uniforms.uCrackProgress.value = prog;
    crackMat.uniforms.uIntensity.value = prog > 0.01 ? 0.92 : 0.0;

    for (const s of shards) {
      if (prog >= s.triggerT && !s.spawned) {
        s.spawned = true;
        s.age = 0;
        s.mesh.visible = true;
        s.mesh.position.copy(s.origin);
      }
    }
  }

  function setSplitProgress(p) {
    const sp = THREE.MathUtils.clamp(p, 0, 1);
    curSplitProg = sp;
    _syncFractureMode();

    const ease = 1 - Math.pow(1 - sp, 2.2);
    const offset = ease * 0.23;

    leftHalf.position.set(-offset, ease * 0.014, -ease * 0.02);
    leftHalf.rotation.set(0, ease * 0.16, ease * 0.07);

    rightHalf.position.set(offset, -ease * 0.014, -ease * 0.02);
    rightHalf.rotation.set(0, -ease * 0.16, -ease * 0.07);

    coreMat.uniforms.uOpacity.value = Math.min(1, sp * 1.45);
    coreBar.scale.set(0.5 + sp * 1.8, 0.95 + sp * 0.25, 1);
    coreGlowSprite.material.opacity = Math.min(1, sp * 1.25);
    const glowScale = 0.6 + sp * 2.6;
    coreGlowSprite.scale.set(glowScale, glowScale * 1.25, 1);
  }

  function updateShards(rawDt) {
    for (const s of shards) {
      if (!s.spawned) continue;
      s.age += rawDt;
      s.mesh.position.addScaledVector(s.vel, rawDt);
      s.mesh.rotation.x += s.rotVel.x * rawDt;
      s.mesh.rotation.y += s.rotVel.y * rawDt;
      s.mesh.rotation.z += s.rotVel.z * rawDt;
    }
  }

  function reset() {
    curCrackProg = 0;
    curSplitProg = 0;
    _syncFractureMode();

    leftHalf.position.set(0, 0, 0);
    leftHalf.rotation.set(0, 0, 0);
    rightHalf.position.set(0, 0, 0);
    rightHalf.rotation.set(0, 0, 0);
    crackMesh.visible = false;
    crackMat.uniforms.uCrackProgress.value = 0;
    crackMat.uniforms.uIntensity.value = 0;
    coreMat.uniforms.uOpacity.value = 0;
    coreGlowSprite.material.opacity = 0;
    for (const s of shards) {
      s.spawned = false;
      s.age = 0;
      s.mesh.visible = false;
    }
  }

  return {
    root,
    setCrackProgress,
    setSplitProgress,
    updateShards,
    reset,
  };
}
