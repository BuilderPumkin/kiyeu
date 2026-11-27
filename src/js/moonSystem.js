import * as THREE from 'three';
import { createGlowSpriteTexture } from './spinVortex.js';

/**
 * Generates a true Float32Array lunar heightfield + Sobel Tangent-Space NormalMap
 * for the global Moon sphere (1536x768) plus a dedicated high-density 1024x1024
 * seamlessly tileable regolith + micro-crater map for close-up Lunar terrain.
 */
export function generateLunarMaps(width = 1536, height = 768) {
  const hash2 = (x, y) => {
    const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return h - Math.floor(h);
  };

  // Seamless periodic value noise (x wraps mod periodX, y wraps or clamps)
  const vNoise = (x, y, periodX, periodY = 0) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const x0 = ((xi % periodX) + periodX) % periodX;
    const x1 = (x0 + 1) % periodX;
    const y0 = periodY > 0 ? ((yi % periodY) + periodY) % periodY : yi;
    const y1 = periodY > 0 ? (y0 + 1) % periodY : yi + 1;

    const a = hash2(x0, y0);
    const b = hash2(x1, y0);
    const c = hash2(x0, y1);
    const d = hash2(x1, y1);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };

  const count = width * height;
  const heightfield = new Float32Array(count);
  const mariaMask = new Float32Array(count);

  // 1. Multi-octave periodic Moon terrain & Maria basins
  for (let py = 0; py < height; py++) {
    const v = py / height;
    for (let px = 0; px < width; px++) {
      const u = px / width;
      const idx = py * width + px;

      const f1 = vNoise(u * 8, v * 4, 8);
      const f2 = vNoise(u * 16, v * 8, 16);
      const f3 = vNoise(u * 32, v * 16, 32);
      const f4 = vNoise(u * 64, v * 32, 64);

      const fbm = f1 * 0.5 + f2 * 0.27 + f3 * 0.14 + f4 * 0.09;
      heightfield[idx] = fbm * 0.42;
      mariaMask[idx] = Math.max(0, Math.min(1, (0.52 - f1) * 2.2 + (0.48 - f2) * 0.7));
    }
  }

  // 2. Stamp 340 true 3D bowl craters scaled to 1536x768 resolution
  let seed = 88412;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const scaleFactor = width / 512;

  for (let c = 0; c < 340; c++) {
    const cx = rand() * width;
    const cy = (0.06 + rand() * 0.88) * height;
    const isLarge = c < 22;
    const isMed = c >= 22 && c < 95;
    const rad = (isLarge ? 14 + rand() * 20 : isMed ? 5 + rand() * 9 : 1.8 + rand() * 3.2) * scaleFactor;
    const depth = isLarge ? 0.34 : isMed ? 0.21 : 0.11;
    const rimH = depth * 0.34;

    const rOuter = Math.ceil(rad * 1.45);
    const yMin = Math.max(0, Math.floor(cy - rOuter));
    const yMax = Math.min(height - 1, Math.ceil(cy + rOuter));

    for (let py = yMin; py <= yMax; py++) {
      const dy = py - cy;
      for (let ox = -rOuter; ox <= rOuter; ox++) {
        const px = ((Math.round(cx) + ox) % width + width) % width;
        const dist = Math.sqrt(ox * ox + dy * dy);
        const normD = dist / rad;
        if (normD > 1.45) continue;

        const idx = py * width + px;
        if (normD < 0.88) {
          const bowl = 1.0 - (normD / 0.88) ** 2;
          heightfield[idx] -= depth * bowl;
        } else {
          const rimT = Math.exp(-Math.pow((normD - 0.96) / 0.16, 2));
          heightfield[idx] += rimH * rimT;
        }
      }
    }
  }

  const buildTexturePair = (w, h, hf, maria, wrapV, repeatXY, normalStrength, grainScale) => {
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = w;
    colorCanvas.height = h;
    const cCtx = colorCanvas.getContext('2d');
    const imgData = cCtx.createImageData(w, h);
    const cd = imgData.data;

    const normalBytes = new Uint8Array(w * h * 4);

    for (let py = 0; py < h; py++) {
      const pyUp = wrapV ? (py - 1 + h) % h : Math.max(0, py - 1);
      const pyDn = wrapV ? (py + 1) % h : Math.min(h - 1, py + 1);
      for (let px = 0; px < w; px++) {
        const pxL = (px - 1 + w) % w;
        const pxR = (px + 1) % w;
        const idx = py * w + px;

        const hfVal = hf[idx];
        const m = maria ? maria[idx] : 0.28;
        const grain = (hash2(px * grainScale, py * grainScale) - 0.5) * 14;

        const base = 92 - m * 38 + hfVal * 26 + grain;
        const clamped = Math.max(22, Math.min(165, base));
        cd[idx * 4] = clamped;
        cd[idx * 4 + 1] = clamped + 1;
        cd[idx * 4 + 2] = Math.min(255, clamped + 4);
        cd[idx * 4 + 3] = 255;

        const hL = hf[py * w + pxL];
        const hR = hf[py * w + pxR];
        const hU = hf[pyUp * w + px];
        const hD = hf[pyDn * w + px];

        const dx = (hL - hR) * normalStrength;
        const dy = (hU - hD) * normalStrength;
        const dz = 1.0;
        const invLen = 1.0 / Math.sqrt(dx * dx + dy * dy + dz * dz);

        normalBytes[idx * 4] = Math.round((dx * invLen * 0.5 + 0.5) * 255);
        normalBytes[idx * 4 + 1] = Math.round((dy * invLen * 0.5 + 0.5) * 255);
        normalBytes[idx * 4 + 2] = Math.round((dz * invLen * 0.5 + 0.5) * 255);
        normalBytes[idx * 4 + 3] = 255;
      }
    }

    cCtx.putImageData(imgData, 0, 0);

    const cTex = new THREE.CanvasTexture(colorCanvas);
    cTex.colorSpace = THREE.SRGBColorSpace;
    cTex.wrapS = THREE.RepeatWrapping;
    cTex.wrapT = wrapV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    cTex.magFilter = THREE.LinearFilter;
    cTex.minFilter = THREE.LinearMipmapLinearFilter;
    cTex.generateMipmaps = true;
    cTex.anisotropy = 8;
    if (repeatXY) cTex.repeat.set(repeatXY, repeatXY);

    const nTex = new THREE.DataTexture(normalBytes, w, h, THREE.RGBAFormat);
    nTex.wrapS = THREE.RepeatWrapping;
    nTex.wrapT = wrapV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    nTex.magFilter = THREE.LinearFilter;
    nTex.minFilter = THREE.LinearMipmapLinearFilter;
    nTex.generateMipmaps = true;
    nTex.anisotropy = 8;
    if (repeatXY) nTex.repeat.set(repeatXY, repeatXY);
    nTex.needsUpdate = true;

    return { cTex, nTex };
  };

  const moonPair = buildTexturePair(width, height, heightfield, mariaMask, false, 0, 5.2, 0.37);

  // 3. Dedicated Seamless 1024x1024 Close-Up Regolith Tile for crisp lunar surface detail
  const tileSize = 1024;
  const tileHF = new Float32Array(tileSize * tileSize);
  const tileMaria = new Float32Array(tileSize * tileSize);
  for (let py = 0; py < tileSize; py++) {
    const v = py / tileSize;
    for (let px = 0; px < tileSize; px++) {
      const u = px / tileSize;
      const idx = py * tileSize + px;
      const f1 = vNoise(u * 8, v * 8, 8, 8);
      const f2 = vNoise(u * 16, v * 16, 16, 16);
      const f3 = vNoise(u * 32, v * 32, 32, 32);
      const f4 = vNoise(u * 64, v * 64, 64, 64);
      const f5 = vNoise(u * 128, v * 128, 128, 128);
      tileHF[idx] = (f1 * 0.4 + f2 * 0.25 + f3 * 0.16 + f4 * 0.11 + f5 * 0.08) * 0.42;
      tileMaria[idx] = Math.max(0, Math.min(1, (0.52 - f1) * 1.4));
    }
  }

  for (let c = 0; c < 140; c++) {
    const cx = rand() * tileSize;
    const cy = rand() * tileSize;
    const rad = c < 18 ? 22 + rand() * 32 : 5 + rand() * 14;
    const depth = c < 18 ? 0.2 : 0.09;
    const rimH = depth * 0.32;
    const rOuter = Math.ceil(rad * 1.4);

    for (let oy = -rOuter; oy <= rOuter; oy++) {
      const py = ((Math.round(cy) + oy) % tileSize + tileSize) % tileSize;
      for (let ox = -rOuter; ox <= rOuter; ox++) {
        const px = ((Math.round(cx) + ox) % tileSize + tileSize) % tileSize;
        const dist = Math.sqrt(ox * ox + oy * oy);
        const normD = dist / rad;
        if (normD > 1.4) continue;
        const idx = py * tileSize + px;
        if (normD < 0.88) {
          tileHF[idx] -= depth * (1.0 - (normD / 0.88) ** 2);
        } else {
          tileHF[idx] += rimH * Math.exp(-Math.pow((normD - 0.96) / 0.16, 2));
        }
      }
    }
  }

  const surfPair = buildTexturePair(tileSize, tileSize, tileHF, tileMaria, true, 12, 4.4, 0.71);

  return {
    colorTex: moonPair.cTex,
    normalTex: moonPair.nTex,
    surfaceColorTex: surfPair.cTex,
    surfaceNormalTex: surfPair.nTex,
  };
}

/**
 * Photorealistic Normal-Mapped 3D Moon in outer space + Volumetric 3D Impact FX
 */
export function createRealisticMoon(moonConfig, lunarMaps, colors) {
  const group = new THREE.Group();
  group.position.set(...moonConfig.position);
  const radius = moonConfig.radius || 1.85;

  const moonMat = new THREE.MeshStandardMaterial({
    map: lunarMaps.colorTex,
    normalMap: lunarMaps.normalTex,
    normalScale: new THREE.Vector2(1.45, 1.45),
    roughness: 0.96,
    metalness: 0.0,
  });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), moonMat);
  sphere.rotation.y = -0.65;
  group.add(sphere);

  const flashTex = createGlowSpriteTexture('#FFFFFF', colors.gold, 128);
  const impactSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: flashTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const impactDir = new THREE.Vector3(-0.34, 0.28, radius * 0.96).normalize();
  const impactSurfPos = impactDir.clone().multiplyScalar(radius * 1.005);
  impactSprite.position.copy(impactSurfPos);
  impactSprite.scale.set(2.1, 2.1, 1);
  group.add(impactSprite);

  // Volumetric 3D Impact Assembly oriented along Moon outward surface normal (+Z = normal)
  const impactGroup = new THREE.Group();
  impactGroup.position.copy(impactSurfPos);
  impactGroup.lookAt(impactSurfPos.clone().multiplyScalar(2));
  impactGroup.visible = false;
  group.add(impactGroup);

  // 1. Molten Crater Flash Disc (focused hot-spot instead of washing whole Moon white)
  const craterFlashMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uHeat: { value: 0 },
      uCore: { value: new THREE.Color('#FFF6DC') },
      uGold: { value: new THREE.Color(colors.gold) },
      uMagma: { value: new THREE.Color('#FF5A18') },
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
      uniform float uHeat;
      uniform vec3 uCore;
      uniform vec3 uGold;
      uniform vec3 uMagma;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        if (r > 1.0 || uHeat <= 0.005) discard;
        float core = exp(-r * r * 18.0);
        float rim = exp(-pow((r - 0.45) * 8.0, 2.0)) * 0.42;
        vec3 col = mix(uMagma, uGold, smoothstep(0.18, 0.7, core + rim));
        col = mix(col, uCore * 1.15, pow(core, 1.8));
        float alpha = (core * 0.85 + rim) * (1.0 - smoothstep(0.7, 1.0, r)) * uHeat;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const craterFlashMesh = new THREE.Mesh(new THREE.CircleGeometry(0.32, 40), craterFlashMat);
  craterFlashMesh.position.z = 0.015;
  impactGroup.add(craterFlashMesh);

  // 2. 3D Expanding Hemispherical Vapor Plume Shell (crisp Fresnel rim only, zero cream fill)
  const domeGeo = new THREE.SphereGeometry(0.45, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
  domeGeo.rotateX(Math.PI / 2);
  const domeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0 },
      uGold: { value: new THREE.Color('#FF9F40') },
      uCyan: { value: new THREE.Color(colors.cherenkov) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying float vElev;
      void main() {
        vElev = clamp(position.z / 0.45, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying float vElev;
      uniform float uOpacity;
      uniform vec3 uGold;
      uniform vec3 uCyan;
      void main() {
        float ndotv = abs(dot(normalize(vNormal), normalize(vViewDir)));
        float fresnel = pow(clamp(1.0 - ndotv, 0.0, 1.0), 2.6);
        vec3 col = mix(uGold, uCyan, vElev * 0.65);
        float alpha = (0.06 + fresnel * 0.72) * smoothstep(0.02, 0.28, vElev + 0.16) * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const vaporDome = new THREE.Mesh(domeGeo, domeMat);
  impactGroup.add(vaporDome);

  // 3. Expanding Concentric Surface Shockwave Ring
  const shockRingMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uOpacity: { value: 0 },
      uGold: { value: new THREE.Color(colors.gold) },
      uCore: { value: new THREE.Color('#FFFFFF') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vPos;
      uniform float uOpacity;
      uniform vec3 uGold;
      uniform vec3 uCore;
      void main() {
        float r = length(vPos.xy);
        float band = smoothstep(0.18, 0.34, r) * (1.0 - smoothstep(0.36, 0.52, r));
        vec3 col = mix(uGold, uCore, band * 0.65) * 1.4;
        gl_FragColor = vec4(col, band * uOpacity);
      }
    `,
  });
  const shockRingMesh = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.52, 48), shockRingMat);
  shockRingMesh.position.z = 0.03;
  impactGroup.add(shockRingMesh);

  // 4. 64 High-Velocity Conical Ejecta Fragments / Sparks
  const ejectaCount = 64;
  const ejPos = new Float32Array(ejectaCount * 3);
  const ejCol = new Float32Array(ejectaCount * 3);
  const ejSize = new Float32Array(ejectaCount);
  const ejDirs = [];

  for (let i = 0; i < ejectaCount; i++) {
    const theta = (i / ejectaCount) * Math.PI * 2 + (i % 7) * 0.19;
    const spread = 0.45 + ((i * 37) % 19) / 19 * 1.15;
    const speed = 2.4 + ((i * 53) % 23) / 23 * 3.8;
    ejDirs.push({
      vx: Math.cos(theta) * spread * speed,
      vy: Math.sin(theta) * spread * speed,
      vz: (0.85 + ((i * 17) % 11) / 11 * 1.4) * speed,
    });
    const c = new THREE.Color(i % 4 === 0 ? '#FFFFFF' : i % 3 === 0 ? colors.cherenkov : '#FF963B');
    ejCol[i * 3] = c.r;
    ejCol[i * 3 + 1] = c.g;
    ejCol[i * 3 + 2] = c.b;
    ejSize[i] = 1.6 + (i % 5) * 0.7;
  }

  const ejectaGeo = new THREE.BufferGeometry();
  ejectaGeo.setAttribute('position', new THREE.BufferAttribute(ejPos, 3));
  ejectaGeo.setAttribute('aColor', new THREE.BufferAttribute(ejCol, 3));
  ejectaGeo.setAttribute('aSize', new THREE.BufferAttribute(ejSize, 1));

  const ejectaMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(1.0, -mv.z);
        gl_PointSize = aSize * uPixelRatio * (18.0 / dist);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 28.0);
        gl_FragColor = vec4(vColor * 1.55, core * uOpacity);
      }
    `,
  });
  const ejectaPoints = new THREE.Points(ejectaGeo, ejectaMat);
  ejectaPoints.frustumCulled = false;
  impactGroup.add(ejectaPoints);

  // 5. Dedicated Dynamic Crater Impact PointLight
  const impactLight = new THREE.PointLight('#ffdca8', 0, 12);
  impactLight.position.copy(impactSurfPos).addScaledVector(impactDir, 0.55);
  group.add(impactLight);

  let impactActive = false;
  let impactAge = 0;

  function applySpaceImpactAt(age) {
    impactAge = age;
    const maxDur = 2.0;
    if (age <= 0 || age > maxDur) {
      impactGroup.visible = false;
      impactSprite.material.opacity = 0;
      impactLight.intensity = 0;
      return;
    }

    impactGroup.visible = true;
    const t = age / maxDur;

    // Brief initial flash clearing rapidly to reveal 3D dome, ring & ejecta rays
    const flashEnv = Math.exp(-age * 14.0);
    impactSprite.material.opacity = Math.min(0.85, flashEnv);
    const fs = 1.0 + age * 0.9;
    impactSprite.scale.set(fs, fs, 1);

    // Molten crater heat glowing and cooling
    craterFlashMat.uniforms.uHeat.value = Math.max(0, Math.exp(-age * 1.8));

    // Hemispherical translucent vapor dome expanding sharply
    const domeEase = 1 - Math.pow(1 - Math.min(1, age / 1.3), 2.4);
    const domeScale = 0.15 + domeEase * 3.0;
    vaporDome.scale.setScalar(domeScale);
    domeMat.uniforms.uOpacity.value = Math.max(0, (1 - Math.min(1, age / 1.3)) * 0.42);

    // Concentric shock ring sweeping across surface
    const ringEase = 1 - Math.pow(1 - Math.min(1, age / 1.25), 2.0);
    shockRingMesh.scale.setScalar(0.35 + ringEase * 3.8);
    shockRingMat.uniforms.uOpacity.value = Math.max(0, (1 - Math.min(1, age / 1.25)) * 0.78);

    // Conical ejecta particles moving outward in Moon vacuum
    const posAttr = ejectaGeo.attributes.position;
    for (let i = 0; i < ejectaCount; i++) {
      const d = ejDirs[i];
      posAttr.setXYZ(i, d.vx * age, d.vy * age, d.vz * age);
    }
    posAttr.needsUpdate = true;
    ejectaMat.uniforms.uOpacity.value = Math.max(0, 1 - t * 1.05);

    // Warm orange-amber raking crater light
    impactLight.intensity = 9.5 * Math.exp(-age * 2.6);
  }

  function triggerSpaceImpact() {
    impactActive = true;
    applySpaceImpactAt(0.01);
  }

  function updateSpaceImpact(rawDt) {
    if (!impactActive) return;
    impactAge += rawDt;
    if (impactAge > 2.0) {
      impactActive = false;
      impactGroup.visible = false;
      impactLight.intensity = 0;
      return;
    }
    applySpaceImpactAt(impactAge);
  }

  function resetSpaceImpact() {
    impactActive = false;
    impactAge = 0;
    impactGroup.visible = false;
    impactSprite.material.opacity = 0;
    impactLight.intensity = 0;
    craterFlashMat.uniforms.uHeat.value = 0;
    domeMat.uniforms.uOpacity.value = 0;
    shockRingMat.uniforms.uOpacity.value = 0;
    ejectaMat.uniforms.uOpacity.value = 0;
  }

  return {
    group,
    sphere,
    impactSprite,
    impactLight,
    triggerSpaceImpact,
    updateSpaceImpact,
    applySpaceImpactAt,
    resetSpaceImpact,
  };
}

/**
 * Generates soft grey-silver lunar regolith dust cloud texture
 */
function createRegolithTexture(size = 192) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  const lobes = [
    [0.5, 0.5, 0.45, 0.46],
    [0.34, 0.46, 0.28, 0.30],
    [0.64, 0.44, 0.28, 0.30],
    [0.48, 0.62, 0.26, 0.26],
  ];
  for (const [cx, cy, r, a] of lobes) {
    const px = cx * size;
    const py = cy * size;
    const pr = r * size;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0.0, `rgba(218, 220, 226, ${a})`);
    g.addColorStop(0.5, `rgba(148, 150, 158, ${a * 0.5})`);
    g.addColorStop(1.0, 'rgba(90, 92, 100, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Distant Crescent Earth hanging high in the black lunar sky
 */
function createDistantEarth() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14498a';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#2d684a';
  ctx.beginPath();
  ctx.ellipse(90, 56, 36, 22, 0.4, 0, Math.PI * 2);
  ctx.ellipse(178, 72, 28, 18, -0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(244, 248, 255, 0.58)';
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    ctx.ellipse((i * 37) % 256, 16 + ((i * 23) % 96), 28, 6, 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 36, 36),
    new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.72,
      metalness: 0.05,
    })
  );
  earth.position.set(-7.5, 6.2, -32);
  return earth;
}

/**
 * Full 3D Shadow-Receiving Lunar Surface Stage:
 * Displaced cratered terrain + subdivided organic rocks + Earth + Low-gravity dust/pebble debris
 */
export function createLunarSurfaceStage(lunarMaps, colors) {
  const group = new THREE.Group();
  group.visible = false;

  const terrainGeo = new THREE.PlaneGeometry(48, 48, 140, 140);
  terrainGeo.rotateX(-Math.PI / 2);

  const pos = terrainGeo.attributes.position;
  const craterCenterX = -0.16;
  const craterCenterZ = 0.42;

  const craterHeightAt = (x, z) => {
    const dx = x - craterCenterX;
    const dz = z - craterCenterZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    let y = 0;
    if (dist < 2.65) {
      const bowl = Math.max(0, 1 - (dist / 1.9) ** 2);
      const rim = Math.exp(-Math.pow((dist - 2.08) / 0.45, 2));
      y += -0.36 * bowl + 0.26 * rim;
    }

    const ridgeNoise =
      Math.sin(x * 0.24 + 0.7) * Math.cos(z * 0.21) * 0.35 +
      Math.sin(x * 0.65 - z * 0.55) * 0.12 +
      Math.cos(x * 1.4 + z * 1.2) * 0.04;

    const farHill = Math.max(0, (dist - 8.5) * 0.16) * (0.55 + 0.45 * Math.sin(x * 0.28 + z * 0.2));
    const walkMask = Math.min(1, Math.max(0, (Math.abs(x) - 0.55) / 1.4));
    y += ridgeNoise * (0.35 + 0.65 * walkMask) + farHill;
    return y;
  };

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, craterHeightAt(x, z));
  }
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: lunarMaps.surfaceColorTex,
    normalMap: lunarMaps.surfaceNormalTex,
    normalScale: new THREE.Vector2(1.25, 1.25),
    roughness: 0.96,
    metalness: 0.0,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.receiveShadow = true;
  group.add(terrain);

  // Smooth continuous-noise organic lunar boulders (zero vertex-seam tearing)
  const rockGeo = new THREE.IcosahedronGeometry(0.14, 2);
  const rPos = rockGeo.attributes.position;
  for (let i = 0; i < rPos.count; i++) {
    const vx = rPos.getX(i);
    const vy = rPos.getY(i);
    const vz = rPos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    const n =
      0.86 +
      0.14 * Math.sin(nx * 2.4 + ny * 1.7) * Math.cos(nz * 2.1) +
      0.06 * Math.cos(nx * 4.2 - nz * 3.6);
    rPos.setXYZ(i, vx * n, vy * n * 0.72, vz * n);
  }
  rockGeo.computeVertexNormals();

  const rockMat = new THREE.MeshStandardMaterial({
    color: '#636670',
    normalMap: lunarMaps.surfaceNormalTex,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.94,
    metalness: 0.02,
  });

  for (let i = 0; i < 64; i++) {
    const ang = (i / 64) * Math.PI * 2 + (i % 5) * 0.2;
    const dist = 2.15 + (i % 13) * 1.15;
    const rx = Math.cos(ang) * dist;
    const rz = Math.sin(ang) * dist;
    if (Math.abs(rx) < 0.95 && rz > 0.15 && rz < 4.5) continue;

    const rock = new THREE.Mesh(rockGeo, rockMat);
    const s = 0.45 + (i % 7) * 0.32;
    rock.scale.set(s * 1.18, s * 0.72, s);
    rock.position.set(rx, craterHeightAt(rx, rz) + s * 0.02, rz);
    rock.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  const earth = createDistantEarth();
  group.add(earth);

  // Low-Gravity Dust, Pebble & Incandescent Impact Debris Pool
  const dustTex = createRegolithTexture(192);
  const dustPool = [];
  const pebblePool = [];
  const debrisGroup = new THREE.Group();
  group.add(debrisGroup);

  for (let i = 0; i < 90; i++) {
    const mat = new THREE.SpriteMaterial({
      map: dustTex,
      color: i % 4 === 0 ? '#d8d4dc' : '#a7a9b4',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.visible = false;
    debrisGroup.add(sp);
    dustPool.push({
      sp,
      mat,
      active: false,
      age: 0,
      maxAge: 2.4,
      vel: new THREE.Vector3(),
      baseScale: 0.5,
      maxOpacity: 0.36,
    });
  }

  const pebbleGeo = new THREE.DodecahedronGeometry(0.024, 0);
  const pPos = pebbleGeo.attributes.position;
  for (let i = 0; i < pPos.count; i++) {
    const vx = pPos.getX(i);
    const vy = pPos.getY(i);
    const vz = pPos.getZ(i);
    const len = Math.hypot(vx, vy, vz) || 1;
    const nx = vx / len;
    const ny = vy / len;
    const nz = vz / len;
    const m = 0.88 + 0.14 * Math.sin(nx * 2.8 + ny * 1.9) * Math.cos(nz * 2.5);
    pPos.setXYZ(i, vx * m, vy * m * 0.74, vz * m);
  }
  pebbleGeo.computeVertexNormals();

  const pebbleMat = new THREE.MeshStandardMaterial({
    color: '#7e818c',
    roughness: 0.92,
    metalness: 0.02,
  });

  for (let i = 0; i < 108; i++) {
    const mesh = new THREE.Mesh(pebbleGeo, pebbleMat);
    mesh.visible = false;
    mesh.castShadow = true;
    debrisGroup.add(mesh);
    pebblePool.push({
      mesh,
      active: false,
      age: 0,
      maxAge: 3.4,
      vel: new THREE.Vector3(),
      angVel: new THREE.Vector3(),
      floorY: -0.02,
    });
  }

  // Ground Crater Explosion FX: Seismic Shockwave Ring + Molten Crater Bed + 90 Luminescent Sparks
  const seismicMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uGold: { value: new THREE.Color(colors.gold) },
      uCyan: { value: new THREE.Color(colors.cherenkov) },
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
      uniform float uProgress;
      uniform float uOpacity;
      uniform vec3 uGold;
      uniform vec3 uCyan;
      void main() {
        float r = length(vUv * 2.0 - 1.0);
        if (r > 1.0 || uOpacity <= 0.004) discard;
        float rad1 = 0.06 + uProgress * 0.92;
        float rad2 = rad1 * 0.68;
        float ring1 = exp(-pow((r - rad1) * 26.0, 2.0));
        float ring2 = exp(-pow((r - rad2) * 32.0, 2.0)) * 0.55;
        vec3 col = mix(uGold * 1.4, uCyan, ring2 * 0.5);
        float alpha = (ring1 + ring2) * (1.0 - smoothstep(0.75, 1.0, r)) * uOpacity;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const seismicMesh = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 8.5), seismicMat);
  seismicMesh.rotation.x = -Math.PI / 2;
  seismicMesh.position.set(craterCenterX, 0.04, craterCenterZ);
  seismicMesh.visible = false;
  group.add(seismicMesh);

  const moltenMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uHeat: { value: 0 },
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
      uniform float uHeat;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      void main() {
        if (uHeat <= 0.005) discard;
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c);
        if (r > 1.0) discard;
        float n = noise(c * 4.5) * 0.6 + noise(c * 11.0) * 0.4;
        float fissures = pow(1.0 - abs(n * 2.0 - 1.0), 3.6);
        float glow = exp(-r * r * 5.2);
        vec3 ember = mix(vec3(1.0, 0.30, 0.05), vec3(1.45, 0.92, 0.38), fissures * 0.78 + glow * 0.22);
        float alpha = (glow * 0.14 + fissures * (0.25 + glow * 0.75)) * (1.0 - smoothstep(0.55, 1.0, r)) * uHeat;
        gl_FragColor = vec4(ember, alpha);
      }
    `,
  });
  const moltenBedMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), moltenMat);
  moltenBedMesh.rotation.x = -Math.PI / 2;
  moltenBedMesh.position.set(craterCenterX, -0.34, craterCenterZ);
  moltenBedMesh.visible = false;
  group.add(moltenBedMesh);

  const sparkCount = 90;
  const sparkPos = new Float32Array(sparkCount * 3);
  const sparkCol = new Float32Array(sparkCount * 3);
  const sparkSize = new Float32Array(sparkCount);
  const sparks = [];
  for (let i = 0; i < sparkCount; i++) {
    const c = new THREE.Color(i % 4 === 0 ? '#FFFFFF' : i % 3 === 0 ? colors.cherenkov : '#FFB054');
    sparkCol[i * 3] = c.r;
    sparkCol[i * 3 + 1] = c.g;
    sparkCol[i * 3 + 2] = c.b;
    sparkSize[i] = 1.6 + (i % 5) * 0.55;
    sparks.push({
      active: false,
      age: 0,
      maxAge: 2.2,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      floorY: -0.34,
    });
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('aColor', new THREE.BufferAttribute(sparkCol, 3));
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSize, 1));
  const sparkMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uOpacity: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      uniform float uPixelRatio;
      varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(1.0, -mv.z);
        gl_PointSize = aSize * uPixelRatio * (16.0 / dist);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 26.0);
        gl_FragColor = vec4(vColor * 1.4, core * uOpacity);
      }
    `,
  });
  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  sparkPoints.visible = false;
  debrisGroup.add(sparkPoints);

  let dustIdx = 0;
  let pebbleIdx = 0;
  let groundImpactActive = false;
  let groundImpactAge = 0;

  function spawnDust(x, y, z, vx, vy, vz, scale, maxOpacity, maxAge) {
    const d = dustPool[dustIdx % dustPool.length];
    dustIdx++;
    d.active = true;
    d.age = 0;
    d.maxAge = maxAge;
    d.sp.visible = true;
    d.sp.position.set(x, y, z);
    d.sp.scale.set(scale * 0.5, scale * 0.5, 1);
    d.vel.set(vx, vy, vz);
    d.baseScale = scale;
    d.maxOpacity = maxOpacity;
    d.mat.opacity = maxOpacity;
  }

  function spawnPebble(x, y, z, vx, vy, vz, sizeMult, maxAge) {
    const p = pebblePool[pebbleIdx % pebblePool.length];
    pebbleIdx++;
    p.active = true;
    p.age = 0;
    p.maxAge = maxAge;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.set(sizeMult * 1.15, sizeMult * 0.78, sizeMult);
    p.vel.set(vx, vy, vz);
    p.angVel.set((Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7, (Math.random() - 0.5) * 7);
    p.floorY = craterHeightAt(x, z) + 0.015;
  }

  function triggerMeteorGroundImpact() {
    groundImpactActive = true;
    groundImpactAge = 0.01;
    seismicMesh.visible = true;
    moltenBedMesh.visible = true;
    sparkPoints.visible = true;
    seismicMat.uniforms.uProgress.value = 0.02;
    seismicMat.uniforms.uOpacity.value = 0.95;
    moltenMat.uniforms.uHeat.value = 1.0;
    sparkMat.uniforms.uOpacity.value = 1.0;

    for (let i = 0; i < 44; i++) {
      const ang = (i / 44) * Math.PI * 2 + Math.random() * 0.25;
      const spd = 0.75 + Math.random() * 1.85;
      spawnDust(
        craterCenterX + Math.cos(ang) * 0.28,
        -0.16 + Math.random() * 0.22,
        craterCenterZ + Math.sin(ang) * 0.28,
        Math.cos(ang) * spd,
        0.42 + Math.random() * 1.05,
        Math.sin(ang) * spd,
        1.35 + Math.random() * 1.45,
        0.4 + Math.random() * 0.14,
        4.2
      );
    }

    for (let i = 0; i < 52; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.9 + Math.random() * 2.25;
      spawnPebble(
        craterCenterX + Math.cos(ang) * 0.22,
        -0.15,
        craterCenterZ + Math.sin(ang) * 0.22,
        Math.cos(ang) * spd,
        1.55 + Math.random() * 2.45,
        Math.sin(ang) * spd,
        0.75 + Math.random() * 1.35,
        4.5
      );
    }

    for (let i = 0; i < sparkCount; i++) {
      const sp = sparks[i];
      const ang = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.3;
      const horiz = 0.8 + Math.random() * 2.8;
      sp.active = true;
      sp.age = 0;
      sp.maxAge = 1.5 + Math.random() * 1.4;
      sp.pos.set(craterCenterX + Math.cos(ang) * 0.18, -0.18, craterCenterZ + Math.sin(ang) * 0.18);
      sp.vel.set(Math.cos(ang) * horiz, 1.8 + Math.random() * 3.1, Math.sin(ang) * horiz);
      sp.floorY = -0.32;
      sparkPos[i * 3] = sp.pos.x;
      sparkPos[i * 3 + 1] = sp.pos.y;
      sparkPos[i * 3 + 2] = sp.pos.z;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  }

  function triggerFootstep(x, z, heavy = false) {
    const gy = craterHeightAt(x, z);
    const dCount = heavy ? 16 : 9;
    const pCount = heavy ? 22 : 14;
    for (let i = 0; i < dCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (heavy ? 0.42 : 0.28) + Math.random() * (heavy ? 0.95 : 0.62);
      spawnDust(
        x + (Math.random() - 0.5) * 0.18,
        gy + 0.05,
        z + (Math.random() - 0.5) * 0.18,
        Math.cos(ang) * spd,
        0.22 + Math.random() * (heavy ? 0.58 : 0.42),
        Math.sin(ang) * spd,
        (heavy ? 0.62 : 0.48) + Math.random() * 0.48,
        heavy ? 0.42 : 0.34,
        3.0
      );
    }

    for (let i = 0; i < pCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (heavy ? 0.5 : 0.35) + Math.random() * 0.95;
      spawnPebble(
        x + (Math.random() - 0.5) * 0.15,
        gy + 0.04,
        z + (Math.random() - 0.5) * 0.15,
        Math.cos(ang) * spd,
        (heavy ? 0.95 : 0.75) + Math.random() * 1.45,
        Math.sin(ang) * spd,
        0.55 + Math.random() * 0.9,
        3.4
      );
    }
  }

  function resetDebris() {
    groundImpactActive = false;
    groundImpactAge = 0;
    seismicMesh.visible = false;
    moltenBedMesh.visible = false;
    sparkPoints.visible = false;
    seismicMat.uniforms.uProgress.value = 0;
    seismicMat.uniforms.uOpacity.value = 0;
    moltenMat.uniforms.uHeat.value = 0;
    sparkMat.uniforms.uOpacity.value = 0;
    for (const d of dustPool) {
      d.active = false;
      d.sp.visible = false;
      d.mat.opacity = 0;
    }
    for (const p of pebblePool) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const sp of sparks) {
      sp.active = false;
    }
  }

  function update(scaledDt) {
    if (scaledDt <= 0) return;
    const lunarGravity = 1.62;

    if (groundImpactActive) {
      groundImpactAge += scaledDt;
      const shockT = Math.min(1, groundImpactAge / 1.55);
      seismicMat.uniforms.uProgress.value = shockT;
      seismicMat.uniforms.uOpacity.value = Math.max(0, (1 - shockT) * 0.95);
      if (shockT >= 1) seismicMesh.visible = false;

      const heat = Math.max(0, Math.exp(-groundImpactAge * 0.85));
      moltenMat.uniforms.uHeat.value = heat;
      if (heat < 0.01) moltenBedMesh.visible = false;

      const sPosAttr = sparkGeo.attributes.position;
      let anySpark = false;
      for (let i = 0; i < sparkCount; i++) {
        const sp = sparks[i];
        if (!sp.active) continue;
        sp.age += scaledDt;
        if (sp.age >= sp.maxAge) {
          sp.active = false;
          sPosAttr.setXYZ(i, 9999, 9999, 9999);
          continue;
        }
        anySpark = true;
        sp.vel.y -= lunarGravity * scaledDt;
        sp.pos.addScaledVector(sp.vel, scaledDt);
        if (sp.pos.y < sp.floorY && sp.vel.y < 0) {
          sp.pos.y = sp.floorY;
          sp.vel.y *= -0.38;
          sp.vel.x *= 0.65;
          sp.vel.z *= 0.65;
        }
        sPosAttr.setXYZ(i, sp.pos.x, sp.pos.y, sp.pos.z);
      }
      sPosAttr.needsUpdate = true;
      sparkMat.uniforms.uOpacity.value = Math.max(0, 1 - groundImpactAge / 2.2);
      if (!anySpark) sparkPoints.visible = false;
      if (groundImpactAge > 4.2) groundImpactActive = false;
    }

    for (const d of dustPool) {
      if (!d.active) continue;
      d.age += scaledDt;
      const t = d.age / d.maxAge;
      if (t >= 1) {
        d.active = false;
        d.sp.visible = false;
        continue;
      }
      d.sp.position.addScaledVector(d.vel, scaledDt);
      d.vel.multiplyScalar(Math.max(0.85, 1 - scaledDt * 0.65));
      const grow = d.baseScale * (0.55 + t * 1.25);
      d.sp.scale.set(grow, grow, 1);
      d.mat.opacity = d.maxOpacity * Math.sin((1 - t) * Math.PI * 0.5);
    }

    for (const p of pebblePool) {
      if (!p.active) continue;
      p.age += scaledDt;
      if (p.age >= p.maxAge) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }
      p.vel.y -= lunarGravity * scaledDt;
      p.mesh.position.addScaledVector(p.vel, scaledDt);
      p.floorY = craterHeightAt(p.mesh.position.x, p.mesh.position.z) + 0.012;
      if (p.mesh.position.y < p.floorY && p.vel.y < 0) {
        p.mesh.position.y = p.floorY;
        p.vel.y *= -0.25;
        p.vel.x *= 0.5;
        p.vel.z *= 0.5;
      }
      p.mesh.rotation.x += p.angVel.x * scaledDt;
      p.mesh.rotation.y += p.angVel.y * scaledDt;
      p.mesh.rotation.z += p.angVel.z * scaledDt;
    }
  }

  return {
    group,
    earth,
    craterHeightAt,
    triggerMeteorGroundImpact,
    triggerFootstep,
    resetDebris,
    update,
  };
}
