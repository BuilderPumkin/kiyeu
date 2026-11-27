import * as THREE from 'three';
import { createGlowSpriteTexture } from './spinVortex.js';

/**
 * Procedural Mysterious 3D Planet with glowing tectonic fractures,
 * atmospheric Fresnel rim, crystalline ring, and optional custom GLB hook.
 */
export function createMysteriousPlanet(planetConfig, colors) {
  const group = new THREE.Group();
  group.position.set(...planetConfig.position);

  const radius = planetConfig.radius || 1.65;

  const uniforms = {
    uTime: { value: 0 },
    uImpactGlow: { value: 0 },
    uImpactPoint: { value: new THREE.Vector3(-0.22, 0.18, 0.96).normalize() },
    uGold: { value: new THREE.Color(colors.gold) },
    uAmethyst: { value: new THREE.Color(colors.amethyst) },
    uCyan: { value: new THREE.Color(colors.cherenkov) },
  };

  const planetMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;

      void main() {
        vLocalPos = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      varying vec3 vLocalPos;

      uniform float uTime;
      uniform float uImpactGlow;
      uniform vec3 uImpactPoint;
      uniform vec3 uGold;
      uniform vec3 uAmethyst;
      uniform vec3 uCyan;

      // Compact 3D procedural hash & value noise
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 p = vLocalPos;
        float terrain = fbm(p * 3.8 + vec3(0.0, uTime * 0.03, 0.0));
        float ridges = abs(fbm(p * 6.5) - 0.5) * 2.0;
        float fissures = pow(1.0 - smoothstep(0.0, 0.14, ridges), 3.0);

        // Ancient carved geometric latitude lines
        float geomBand = exp(-pow((abs(p.y) - 0.38) * 34.0, 2.0))
                       + exp(-pow((p.y) * 44.0, 2.0)) * 0.7;

        vec3 baseBasalt = mix(vec3(0.07, 0.06, 0.11), vec3(0.18, 0.15, 0.27), terrain);

        // Lighting
        vec3 lightDir = normalize(vec3(-0.6, 0.55, 0.8));
        float diff = max(0.12, dot(normalize(vNormal), lightDir));
        vec3 litRock = baseBasalt * diff;

        // Glowing tectonic & geometric fissures
        float pulse = 0.75 + 0.25 * sin(uTime * 2.2 + terrain * 6.0);
        vec3 veinColor = mix(uAmethyst, uGold, smoothstep(0.35, 0.8, terrain));
        litRock += veinColor * fissures * 1.45 * pulse;
        litRock += uCyan * geomBand * 0.45;

        // Crater impact bloom on strike
        float dImpact = distance(p, uImpactPoint);
        float craterGlow = exp(-dImpact * dImpact * 14.0) * uImpactGlow;
        litRock += mix(uGold, vec3(1.0, 0.96, 0.88), craterGlow) * craterGlow * 2.4;

        // Atmospheric Fresnel rim
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 3.2);
        litRock += mix(uAmethyst, uGold, 0.35) * fresnel * 0.95;

        gl_FragColor = vec4(litRock, 1.0);
      }
    `,
  });

  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 64), planetMat);
  group.add(sphere);

  // Outer atmosphere halo shell
  const atmoMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uAmethyst: { value: new THREE.Color(colors.amethyst) },
      uGold: { value: new THREE.Color(colors.gold) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vWorldPos;
      uniform vec3 uAmethyst;
      uniform vec3 uGold;
      void main() {
        vec3 vd = normalize(cameraPosition - vWorldPos);
        float rim = pow(clamp(0.65 - dot(normalize(vNormal), vd), 0.0, 1.0), 2.5);
        gl_FragColor = vec4(mix(uAmethyst, uGold, 0.35), rim * 0.65);
      }
    `,
  });
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.18, 48, 48), atmoMat);
  group.add(atmo);

  // Tilted ancient geometric ring around the mysterious planet
  const ringGeo = new THREE.RingGeometry(radius * 1.38, radius * 1.72, 96);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colors.gold,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.set(Math.PI * 0.42, -0.35, 0.15);
  group.add(ring);

  return { group, sphere, ring, uniforms };
}

/**
 * Generates soft volumetric dust cloud texture for crater impact & slow-mo freeze
 */
function createSmokeTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Multi-lobe radial puffs for organic cloud shape
  const lobes = [
    [0.5, 0.5, 0.46, 0.42],
    [0.36, 0.44, 0.28, 0.28],
    [0.64, 0.48, 0.26, 0.25],
    [0.48, 0.63, 0.25, 0.24],
    [0.52, 0.34, 0.22, 0.20],
  ];

  for (const [cx, cy, r, alpha] of lobes) {
    const px = cx * size;
    const py = cy * size;
    const pr = r * size;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    grad.addColorStop(0.0, `rgba(215, 200, 235, ${alpha})`);
    grad.addColorStop(0.45, `rgba(110, 92, 155, ${alpha * 0.55})`);
    grad.addColorStop(1.0, 'rgba(30, 24, 48, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Volumetric Dust Clouds + Crater Embers scaled by worldTimeScale
 */
export function createImpactAndDustSystem(colors) {
  const group = new THREE.Group();
  const smokeTex = createSmokeTexture(256);
  const emberTex = createGlowSpriteTexture('#FFF8E7', colors.gold, 64);

  const dustItems = [];
  const dustCount = 40;
  for (let i = 0; i < dustCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: smokeTex,
      color: i % 3 === 0 ? colors.gold : colors.dustTint,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    const angle = (i / dustCount) * Math.PI * 2 + Math.random() * 0.4;
    const radial = 0.45 + Math.random() * 2.1;
    const height = -0.15 + Math.random() * 1.45;
    const basePos = new THREE.Vector3(
      Math.cos(angle) * radial * 1.25,
      height,
      Math.sin(angle) * radial * 0.9 + 0.35
    );
    const vel = new THREE.Vector3(
      Math.cos(angle) * (0.28 + Math.random() * 0.45),
      0.06 + Math.random() * 0.16,
      Math.sin(angle) * (0.18 + Math.random() * 0.32)
    );
    const baseScale = 1.45 + Math.random() * 1.8;
    sp.position.copy(basePos);
    sp.scale.set(baseScale, baseScale, 1);
    group.add(sp);
    dustItems.push({ sp, mat, basePos, vel, baseScale, maxOpacity: 0.24 + Math.random() * 0.22 });
  }

  // Embers / Glowing crater debris
  const emberCount = 130;
  const emberPositions = new Float32Array(emberCount * 3);
  const emberVels = [];
  const emberInit = [];

  for (let i = 0; i < emberCount; i++) {
    const x = (Math.random() - 0.5) * 2.8;
    const y = Math.random() * 0.4;
    const z = (Math.random() - 0.5) * 2.2;
    emberInit.push(new THREE.Vector3(x, y, z));
    emberVels.push(
      new THREE.Vector3(
        (Math.random() - 0.5) * 1.1,
        0.45 + Math.random() * 1.45,
        (Math.random() - 0.5) * 1.1
      )
    );
    emberPositions[i * 3] = x;
    emberPositions[i * 3 + 1] = y;
    emberPositions[i * 3 + 2] = z;
  }

  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
  const emberMat = new THREE.PointsMaterial({
    map: emberTex,
    size: 0.14,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const embers = new THREE.Points(emberGeo, emberMat);
  group.add(embers);

  let active = false;
  let globalOpacity = 0;

  function trigger() {
    active = true;
    globalOpacity = 1;
    for (const d of dustItems) {
      d.sp.position.copy(d.basePos).multiplyScalar(0.35);
      d.sp.scale.set(d.baseScale * 0.6, d.baseScale * 0.6, 1);
    }
    const posAttr = emberGeo.attributes.position;
    for (let i = 0; i < emberCount; i++) {
      posAttr.setXYZ(i, emberInit[i].x, emberInit[i].y, emberInit[i].z);
    }
    posAttr.needsUpdate = true;
  }

  function reset() {
    active = false;
    globalOpacity = 0;
    for (const d of dustItems) {
      d.mat.opacity = 0;
      d.sp.position.copy(d.basePos);
      d.sp.scale.set(d.baseScale, d.baseScale, 1);
    }
    emberMat.opacity = 0;
  }

  function update(dtScaled, dustDensity = 1.0) {
    if (!active) return;
    emberMat.opacity = globalOpacity * 0.92;

    for (const d of dustItems) {
      d.mat.opacity = d.maxOpacity * globalOpacity * dustDensity;
      d.sp.position.addScaledVector(d.vel, dtScaled);
      const grow = 1 + dtScaled * 0.18;
      d.sp.scale.multiplyScalar(grow);
    }

    const posAttr = emberGeo.attributes.position;
    for (let i = 0; i < emberCount; i++) {
      const vx = emberVels[i].x;
      const vy = emberVels[i].y;
      const vz = emberVels[i].z;
      const nx = posAttr.getX(i) + vx * dtScaled;
      const ny = posAttr.getY(i) + vy * dtScaled;
      const nz = posAttr.getZ(i) + vz * dtScaled;
      posAttr.setXYZ(i, nx, ny, nz);
    }
    posAttr.needsUpdate = true;
  }

  return { group, trigger, reset, update };
}
