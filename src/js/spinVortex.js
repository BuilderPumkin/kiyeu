import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Creates a soft radial glow texture on an offscreen canvas (no external image needed).
 */
export function createGlowSpriteTexture(innerColor = '#FFF8E7', midColor = '#E8C56E', size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0.0, innerColor);
  grad.addColorStop(0.24, midColor);
  grad.addColorStop(0.58, 'rgba(157, 127, 234, 0.24)');
  grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Persistent Deep-Space Planck-Blackbody Starfield with crisp pinpoint stars & cross spikes
 */
export function createDeepStarfield() {
  const count = 3200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  const palette = [
    new THREE.Color('#BFD7FF'), // O/B blue-white
    new THREE.Color('#F8FAFF'), // A/F pure white
    new THREE.Color('#FFF1D0'), // G warm cream
    new THREE.Color('#FFD09B'), // K/M amber
  ];

  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const root = Math.sqrt(1 - u * u);
    const r = 58 + Math.random() * 44;

    positions[i * 3] = root * Math.cos(phi) * r;
    positions[i * 3 + 1] = u * r;
    positions[i * 3 + 2] = root * Math.sin(phi) * r;

    const cPick = Math.random();
    const col = cPick < 0.22 ? palette[0] : cPick < 0.65 ? palette[1] : cPick < 0.88 ? palette[2] : palette[3];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;

    const isBright = Math.random() > 0.95;
    sizes[i] = isBright ? 2.1 + Math.random() * 1.6 : 0.65 + Math.random() * 1.1;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;

      uniform float uTime;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vBright;
      varying float vTwinkle;

      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(14.0, -mv.z);
        vTwinkle = 0.78 + 0.22 * sin(uTime * 1.8 + aPhase);
        vBright = step(2.0, aSize);
        gl_PointSize = aSize * uPixelRatio * (38.0 / dist) * (0.9 + 0.1 * vTwinkle);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vBright;
      varying float vTwinkle;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 34.0);
        float spikeX = exp(-abs(uv.y) * 28.0) * smoothstep(0.48, 0.04, abs(uv.x));
        float spikeY = exp(-abs(uv.x) * 28.0) * smoothstep(0.48, 0.04, abs(uv.y));
        float spikes = (spikeX + spikeY) * 0.45 * vBright;
        float alpha = clamp((core + spikes) * vTwinkle, 0.0, 1.0);
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, uniforms };
}

/**
 * Photographic Golden Ratio Spiral Galaxy:
 * - Custom GLSL Volumetric FBM Spiral Nebula Disc with dust lanes & golden bulge
 * - 9,000 fine pinpoint astronomical stars (bloom cleanly via UnrealBloomPass)
 * - Golden Ratio filament guides & Singularity shockwave
 */
export function createSpinVortex(colors) {
  const group = new THREE.Group();
  const count = 9000;

  const positions = new Float32Array(count * 3);
  const initialData = new Float32Array(count * 4); // radius, angle, zOffset, speedMult
  const burstDirs = new Float32Array(count * 3);
  const colorAttr = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const cCore = new THREE.Color('#FFF8E7');
  const cGold = new THREE.Color(colors.gold);
  const cBlue = new THREE.Color('#8FB8FF');
  const cAmethyst = new THREE.Color(colors.amethyst);
  const cCyan = new THREE.Color(colors.cherenkov);

  for (let i = 0; i < count; i++) {
    const isBulge = i < count * 0.18;
    let radius, theta, zOffset;

    if (isBulge) {
      const rNorm = Math.pow(Math.random(), 1.85);
      radius = 0.05 + rNorm * 1.45;
      theta = Math.random() * Math.PI * 2;
      zOffset = (Math.random() - 0.5) * 0.55 * (1 - rNorm * 0.6);
    } else {
      const arm = i % 4;
      const isMajor = arm % 2 === 0;
      const t = Math.pow(Math.random(), isMajor ? 0.72 : 0.85);
      theta = t * Math.PI * 4.8 + arm * (Math.PI * 0.5);
      const goldenR = 0.24 * Math.pow(PHI, (theta % (Math.PI * 3.5)) * 0.6366);
      const scatter = (Math.random() - 0.5) * (0.22 + t * (isMajor ? 1.45 : 2.0));
      radius = Math.min(13.2, Math.max(0.16, goldenR + scatter));
      zOffset = (Math.random() - 0.5) * (0.28 + radius * 0.11);
    }

    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = Math.sin(theta) * radius;
    positions[i * 3 + 2] = zOffset;

    initialData[i * 4] = radius;
    initialData[i * 4 + 1] = theta;
    initialData[i * 4 + 2] = zOffset;
    initialData[i * 4 + 3] = 0.65 + Math.random() * 0.85;

    const u = Math.random() * 2 - 1;
    const phiDir = Math.random() * Math.PI * 2;
    const root = Math.sqrt(1 - u * u);
    const burstDist = 12 + Math.random() * 32;
    burstDirs[i * 3] = root * Math.cos(phiDir) * burstDist;
    burstDirs[i * 3 + 1] = root * Math.sin(phiDir) * burstDist;
    burstDirs[i * 3 + 2] = u * burstDist - 5.0;

    const radialNorm = Math.min(1.0, radius / 9.2);
    const col = new THREE.Color();
    if (radialNorm < 0.22) {
      col.copy(cCore).lerp(cGold, radialNorm * 3.2);
    } else {
      const pick = Math.random();
      if (pick < 0.40) col.copy(cBlue).lerp(cCyan, Math.random() * 0.3);
      else if (pick < 0.74) col.copy(cAmethyst).lerp(cBlue, Math.random() * 0.4);
      else col.copy(cGold).lerp(cCore, Math.random() * 0.45);
    }

    colorAttr[i * 3] = col.r;
    colorAttr[i * 3 + 1] = col.g;
    colorAttr[i * 3 + 2] = col.b;

    // Fine pinpoint sizes (no chunky confetti dots!)
    sizes[i] = isBulge ? 0.85 + Math.random() * 1.15 : 0.55 + Math.random() * 1.55;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aData', new THREE.BufferAttribute(initialData, 4));
  geo.setAttribute('aBurst', new THREE.BufferAttribute(burstDirs, 3));
  geo.setAttribute('aColor', new THREE.BufferAttribute(colorAttr, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const uniforms = {
    uTime: { value: 0 },
    uSpinAngle: { value: 0 },
    uCollapse: { value: 0 },
    uBurst: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec4 aData;
      attribute vec3 aBurst;
      attribute vec3 aColor;
      attribute float aSize;

      uniform float uTime;
      uniform float uSpinAngle;
      uniform float uCollapse;
      uniform float uBurst;
      uniform float uPixelRatio;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float baseR = aData.x;
        float baseTheta = aData.y;
        float baseZ = aData.z;
        float speedMult = aData.w;

        float invR = 1.0 / (0.55 + baseR * 0.36);
        float angle = baseTheta + uSpinAngle * (0.35 + invR * 1.4) * speedMult;

        float collapsedR = mix(baseR, 0.025, pow(uCollapse, 1.4));
        float collapsedZ = mix(baseZ, 0.0, uCollapse);

        vec3 spiralPos = vec3(
          cos(angle) * collapsedR,
          sin(angle) * collapsedR,
          collapsedZ
        );

        vec3 pos = mix(spiralPos, aBurst, smoothstep(0.0, 1.0, uBurst));

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        float dist = max(1.2, -mvPosition.z);
        gl_PointSize = aSize * uPixelRatio * (10.5 / dist) * (1.0 + uCollapse * 0.35);
        vColor = mix(aColor, vec3(1.15, 1.08, 0.94), uCollapse * 0.65 * (1.0 - uBurst));
        vAlpha = mix(0.92, 0.42, uBurst);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 36.0);
        float halo = smoothstep(0.45, 0.04, d) * 0.32;
        gl_FragColor = vec4(vColor, (core + halo) * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  group.add(points);

  // Volumetric FBM Spiral Nebula Disc Shader (smooth continuous gas filaments & dust lanes)
  const nebulaDiscMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uSpinAngle;
      uniform float uCollapse;
      uniform float uBurst;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p = rot * p * 2.04;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        if (uBurst > 0.95) discard;
        vec2 c = (vUv * 2.0 - 1.0);
        float scale = mix(1.0, 0.06, pow(uCollapse, 1.4));
        vec2 p = c / max(0.05, scale);
        float r = length(p);
        if (r > 1.05) discard;

        float angle = atan(p.y, p.x);
        // Smooth rigid-plus-gentle-shear rotation avoids winding concentric moire rings at 4x spin speed
        float spinPhase = mod(uSpinAngle * 0.055 + uTime * 0.18, 6.283185307);
        float swirl = angle - log(max(r, 0.04)) * 2.5 - spinPhase;
        vec2 spiralCoord = vec2(cos(swirl), sin(swirl)) * r * 3.2;
        vec2 warp = 0.28 * vec2(fbm(spiralCoord * 0.8), fbm(spiralCoord * 0.8 + vec2(3.1, 1.7)));
        spiralCoord += warp;

        float armWave = 0.5 + 0.5 * cos(swirl * 2.0);
        float gas = fbm(spiralCoord + vec2(uTime * 0.03, -uTime * 0.02));
        float dustLane = smoothstep(0.32, 0.68, fbm(spiralCoord * 1.9 + 4.2));

        float armDensity = pow(armWave, 1.7) * gas * (0.55 + 0.45 * dustLane);
        float radialFade = smoothstep(1.0, 0.14, r);
        float bulge = exp(-r * r * 14.0);

        vec3 innerCol = vec3(0.95, 0.76, 0.45);
        vec3 midCol = vec3(0.48, 0.38, 0.84);
        vec3 outerCol = vec3(0.28, 0.64, 0.88);

        vec3 col = mix(innerCol, midCol, smoothstep(0.06, 0.46, r));
        col = mix(col, outerCol, smoothstep(0.44, 0.9, r));
        col = mix(col, vec3(1.15, 1.04, 0.82), bulge * 0.68);

        float alpha = (armDensity * 0.46 + bulge * 0.36) * radialFade * (1.0 - smoothstep(0.0, 0.92, uBurst));
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const nebulaDisc = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), nebulaDiscMat);
  nebulaDisc.position.z = -0.15;
  group.add(nebulaDisc);

  // Golden Ratio spiral wireframe guide curves (subtle early, intensify during Spin acceleration)
  const spiralGuideMat = new THREE.LineBasicMaterial({
    color: colors.gold,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const spiralGuides = new THREE.Group();
  for (let arm = 0; arm < 2; arm++) {
    const pts = [];
    const steps = 160;
    for (let s = 0; s <= steps; s++) {
      const f = s / steps;
      const th = f * Math.PI * 4.4 + arm * Math.PI;
      const r = 0.09 * Math.pow(PHI, f * 4.4 * 0.6366 * 1.45);
      pts.push(new THREE.Vector3(Math.cos(th) * r, Math.sin(th) * r, 0));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    spiralGuides.add(new THREE.Line(lineGeo, spiralGuideMat));
  }
  group.add(spiralGuides);

  // Galactic Bulge / Singularity Core Glow
  const coreTex = createGlowSpriteTexture('#FFFFFF', colors.gold, 128);
  const coreSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: coreTex,
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  coreSprite.scale.set(2.0, 2.0, 1);
  group.add(coreSprite);

  // Expanding Shockwave Plasma Ring
  const shockMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uGold: { value: new THREE.Color(colors.gold) },
      uAmethyst: { value: new THREE.Color(colors.amethyst) },
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
      uniform vec3 uAmethyst;

      void main() {
        vec2 c = vUv * 2.0 - 1.0;
        float r = length(c);
        float ringRadius = 0.06 + uProgress * 0.92;
        float ring = exp(-pow((r - ringRadius) * 26.0, 2.0));
        float innerWave = exp(-pow((r - ringRadius * 0.82) * 34.0, 2.0)) * 0.45;
        vec3 col = mix(uAmethyst, uGold, ring);
        float alpha = (ring + innerWave) * uOpacity * (1.0 - smoothstep(0.75, 1.0, r));
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(col * 1.4, alpha);
      }
    `,
  });

  const shockPlane = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), shockMat);
  group.add(shockPlane);

  const shockPlaneTilted = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), shockMat);
  shockPlaneTilted.rotation.set(0.82, 0.35, -0.25);
  group.add(shockPlaneTilted);

  return {
    group,
    uniforms,
    spiralGuides,
    spiralGuideMat,
    coreSprite,
    shockMat,
    updateNebula: () => {},
  };
}

/**
 * 6 Distinct Large 3D Planets orbiting inside the galaxy field (collapse smoothly with Singularity spin)
 */
export function createCosmicPlanets() {
  const group = new THREE.Group();

  // Shared 3D noise snippet for rocky/lava/storm planets
  const noise3DGlsL = /* glsl */ `
    float hash3(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise3(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
        mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z
      );
    }
  `;

  // 1. Ringed Banded Saturnian Gas Giant (radius 0.82)
  const gasGroup = new THREE.Group();
  const gasMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      uniform float uTime;

      void main() {
        float y = vLocal.y;
        float swirl = sin(vLocal.x * 8.0 + uTime * 0.4 + sin(y * 16.0) * 1.5) * 0.05;
        float bands = sin((y + swirl) * 24.0) * 0.5 + 0.5;
        vec3 colA = vec3(0.78, 0.62, 0.45);
        vec3 colB = vec3(0.42, 0.32, 0.48);
        vec3 storm = vec3(0.92, 0.78, 0.55);
        vec3 albedo = mix(colB, colA, bands);
        albedo = mix(albedo, storm, smoothstep(0.78, 0.96, bands) * 0.6);

        vec3 lDir = normalize(vec3(0.8, 0.45, 0.9));
        float diff = max(0.08, dot(normalize(vNormal), lDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 3.0);

        vec3 finalCol = albedo * diff + vec3(0.85, 0.72, 0.52) * fresnel * 0.35;
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
  const gasMesh = new THREE.Mesh(new THREE.SphereGeometry(0.82, 48, 48), gasMat);
  gasGroup.add(gasMesh);

  const ringGeo = new THREE.RingGeometry(1.12, 1.88, 80);
  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        float r = length(vPos.xy);
        float t = clamp((r - 1.12) / 0.76, 0.0, 1.0);
        float bands = 0.45 + 0.55 * sin(t * 36.0) * cos(t * 14.0);
        float cassini = 1.0 - exp(-pow((t - 0.62) * 28.0, 2.0)) * 0.85;
        float edge = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.88, 1.0, t));
        vec3 col = mix(vec3(0.68, 0.58, 0.46), vec3(0.88, 0.80, 0.68), bands);
        gl_FragColor = vec4(col, edge * cassini * (0.28 + bands * 0.34));
      }
    `,
  });
  const gasRing = new THREE.Mesh(ringGeo, ringMat);
  gasRing.rotation.set(Math.PI * 0.41, 0.25, -0.18);
  gasGroup.add(gasRing);
  group.add(gasGroup);

  // 2. Terrestrial Ocean/Ice Exoplanet with Rayleigh Blue Atmosphere (radius 0.54)
  const oceanGroup = new THREE.Group();
  const oceanMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      uniform float uTime;
      ${noise3DGlsL}

      void main() {
        float cont = noise3(vLocal * 3.4) * 0.65 + noise3(vLocal * 7.2) * 0.35;
        float clouds = smoothstep(0.54, 0.78, noise3(vLocal * 4.8 + vec3(uTime * 0.04, 0.0, 0.0)));
        vec3 sea = vec3(0.08, 0.24, 0.52);
        vec3 land = mix(vec3(0.24, 0.42, 0.32), vec3(0.68, 0.64, 0.52), smoothstep(0.58, 0.78, cont));
        vec3 surf = mix(sea, land, smoothstep(0.49, 0.54, cont));
        surf = mix(surf, vec3(0.95, 0.97, 1.0), clouds * 0.72);

        vec3 lDir = normalize(vec3(-0.7, 0.5, 0.8));
        float diff = max(0.07, dot(normalize(vNormal), lDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 3.2);

        vec3 finalCol = surf * diff + vec3(0.35, 0.68, 1.0) * fresnel * 0.75;
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
  const oceanMesh = new THREE.Mesh(new THREE.SphereGeometry(0.54, 40, 40), oceanMat);
  oceanGroup.add(oceanMesh);
  group.add(oceanGroup);

  // 3. Cratered Dusty Martian Exoplanet (radius 0.42)
  const marsGroup = new THREE.Group();
  const marsMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      ${noise3DGlsL}

      void main() {
        float terrain = noise3(vLocal * 4.2) * 0.6 + noise3(vLocal * 11.0) * 0.4;
        float polar = smoothstep(0.84, 0.95, abs(vLocal.y) + terrain * 0.08);
        vec3 rust = mix(vec3(0.36, 0.19, 0.14), vec3(0.76, 0.42, 0.25), terrain);
        rust = mix(rust, vec3(0.88, 0.85, 0.82), polar * 0.72);

        vec3 lDir = normalize(vec3(0.75, 0.5, 0.75));
        float diff = max(0.08, dot(normalize(vNormal), lDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 3.4);

        gl_FragColor = vec4(rust * diff + vec3(0.86, 0.56, 0.36) * fresnel * 0.38, 1.0);
      }
    `,
  });
  const marsMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 36, 36), marsMat);
  marsGroup.add(marsMesh);
  group.add(marsGroup);

  // 4. Large Azure Ice Giant with Steep Tilted Ice Ring (radius 0.74)
  const iceGroup = new THREE.Group();
  const iceMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      uniform float uTime;
      ${noise3DGlsL}

      void main() {
        float wisp = noise3(vec3(vLocal.x * 5.0 + uTime * 0.05, vLocal.y * 14.0, vLocal.z * 5.0));
        float bands = sin(vLocal.y * 16.0 + wisp * 3.0) * 0.5 + 0.5;
        vec3 deepSea = vec3(0.08, 0.24, 0.58);
        vec3 cyanBand = vec3(0.32, 0.74, 0.92);
        vec3 surf = mix(deepSea, cyanBand, bands * 0.72 + wisp * 0.28);

        vec3 lDir = normalize(vec3(-0.75, 0.4, 0.82));
        float diff = max(0.09, dot(normalize(vNormal), lDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 2.8);

        gl_FragColor = vec4(surf * diff + vec3(0.42, 0.88, 1.0) * fresnel * 0.78, 1.0);
      }
    `,
  });
  const iceMesh = new THREE.Mesh(new THREE.SphereGeometry(0.74, 44, 44), iceMat);
  iceGroup.add(iceMesh);

  const iceRingMat = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        float r = length(vPos.xy);
        float t = clamp((r - 0.96) / 0.44, 0.0, 1.0);
        float streaks = 0.4 + 0.6 * sin(t * 28.0);
        float edge = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.84, 1.0, t));
        gl_FragColor = vec4(vec3(0.55, 0.88, 0.98), edge * streaks * 0.45);
      }
    `,
  });
  const iceRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.40, 72), iceRingMat);
  iceRing.rotation.set(1.22, -0.35, 0.42);
  iceGroup.add(iceRing);
  group.add(iceGroup);

  // 5. Colossal Crimson-Amber Jovian Supergiant + Orbiting Moon (radius 0.96)
  const jovianGroup = new THREE.Group();
  const jovianMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      uniform float uTime;
      ${noise3DGlsL}

      void main() {
        float turb = noise3(vec3(vLocal.x * 6.0 - uTime * 0.04, vLocal.y * 12.0, vLocal.z * 6.0));
        float belt = sin(vLocal.y * 22.0 + turb * 2.8) * 0.5 + 0.5;
        vec3 ochre = vec3(0.82, 0.52, 0.28);
        vec3 crimson = vec3(0.56, 0.20, 0.16);
        vec3 cream = vec3(0.94, 0.82, 0.64);
        vec3 col = mix(crimson, ochre, belt);
        col = mix(col, cream, smoothstep(0.72, 0.96, belt) * 0.68);

        // Great swirling crimson storm spot
        float spotDist = length(vec2((vLocal.x - 0.42) * 1.4, (vLocal.y + 0.24) * 2.2));
        float spot = 1.0 - smoothstep(0.14, 0.34, spotDist);
        col = mix(col, vec3(0.86, 0.26, 0.18), spot * 0.85 * step(0.15, vLocal.z));

        vec3 lDir = normalize(vec3(0.82, 0.55, 0.72));
        float diff = max(0.08, dot(normalize(vNormal), lDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 3.0);

        gl_FragColor = vec4(col * diff + vec3(0.95, 0.74, 0.48) * fresnel * 0.42, 1.0);
      }
    `,
  });
  const jovianMesh = new THREE.Mesh(new THREE.SphereGeometry(0.96, 48, 48), jovianMat);
  jovianGroup.add(jovianMesh);

  const icyMoon = new THREE.Mesh(
    new THREE.SphereGeometry(0.11, 20, 20),
    new THREE.MeshStandardMaterial({ color: '#cfd8eb', roughness: 0.78, metalness: 0.05 })
  );
  icyMoon.position.set(1.42, 0.22, 0.48);
  jovianGroup.add(icyMoon);
  group.add(jovianGroup);

  // 6. Large Volcanic Obsidian-Gold Exoplanet with Magma Fissures (radius 0.62)
  const volcanicGroup = new THREE.Group();
  const volcanicMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      void main() {
        vLocal = normalize(position);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vLocal;
      varying vec3 vWorldPos;
      uniform float uTime;
      ${noise3DGlsL}

      void main() {
        float n1 = noise3(vLocal * 4.8);
        float n2 = noise3(vLocal * 10.5 + 3.2);
        float ridge = 1.0 - abs(n1 * 2.0 - 1.0);
        float fissure = pow(clamp(ridge * 0.75 + (1.0 - abs(n2 * 2.0 - 1.0)) * 0.35, 0.0, 1.0), 4.8);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.4 + n1 * 8.0);

        vec3 basalt = mix(vec3(0.08, 0.07, 0.11), vec3(0.20, 0.18, 0.24), n2);
        vec3 lava = mix(vec3(0.95, 0.32, 0.06), vec3(1.45, 0.92, 0.35), smoothstep(0.45, 0.92, fissure));

        vec3 lDir = normalize(vec3(0.6, 0.65, 0.7));
        float diff = max(0.12, dot(normalize(vNormal), lDir));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(0.0, dot(normalize(vNormal), viewDir)), 3.2);

        vec3 litCrust = basalt * diff + vec3(0.68, 0.44, 0.88) * fresnel * 0.45;
        vec3 finalCol = litCrust + lava * fissure * 1.15 * pulse;
        gl_FragColor = vec4(finalCol, 1.0);
      }
    `,
  });
  const volcanicMesh = new THREE.Mesh(new THREE.SphereGeometry(0.62, 42, 42), volcanicMat);
  volcanicGroup.add(volcanicMesh);
  group.add(volcanicGroup);

  const specs = [
    { obj: gasGroup, mesh: gasMesh, baseR: 6.9, baseAng: 2.65, baseZ: -8.5, speed: 0.08, rotSpd: 0.09 },
    { obj: oceanGroup, mesh: oceanMesh, baseR: 6.4, baseAng: -0.45, baseZ: -10.0, speed: 0.11, rotSpd: 0.12 },
    { obj: marsGroup, mesh: marsMesh, baseR: 4.9, baseAng: 3.72, baseZ: -6.2, speed: 0.14, rotSpd: 0.15 },
    { obj: iceGroup, mesh: iceMesh, baseR: 7.9, baseAng: 0.58, baseZ: -7.4, speed: 0.07, rotSpd: 0.10 },
    { obj: jovianGroup, mesh: jovianMesh, baseR: 8.6, baseAng: 3.62, baseZ: -9.4, speed: 0.06, rotSpd: 0.08 },
    { obj: volcanicGroup, mesh: volcanicMesh, baseR: 5.7, baseAng: 1.85, baseZ: -6.8, speed: 0.095, rotSpd: 0.11 },
  ];

  function update(elapsed, spinAngle, collapse, burst) {
    group.visible = burst < 0.08;
    if (!group.visible) return;

    gasMat.uniforms.uTime.value = elapsed;
    oceanMat.uniforms.uTime.value = elapsed;
    iceMat.uniforms.uTime.value = elapsed;
    jovianMat.uniforms.uTime.value = elapsed;
    volcanicMat.uniforms.uTime.value = elapsed;

    icyMoon.position.set(Math.cos(elapsed * 0.65) * 1.48, 0.18 + Math.sin(elapsed * 0.65) * 0.18, Math.sin(elapsed * 0.65) * 1.48);

    const cPow = Math.pow(collapse, 1.4);
    const sc = Math.max(0.02, 1 - cPow * 0.92);

    for (const s of specs) {
      s.mesh.rotation.y = elapsed * s.rotSpd;
      const ang = s.baseAng + elapsed * s.speed + spinAngle * 0.35;
      const r = THREE.MathUtils.lerp(s.baseR, 0.08, cPow);
      const z = THREE.MathUtils.lerp(s.baseZ, 0.0, cPow);
      s.obj.position.set(Math.cos(ang) * r, Math.sin(ang) * r * 0.72, z);
      s.obj.scale.setScalar(sc);
    }
  }

  return { group, update };
}

/**
 * Background hyper-speed star streaks for the meteor lock-on beat
 */
export function createSpeedStreaks(colors) {
  const count = 170;
  const positions = new Float32Array(count * 6);
  const vColors = new Float32Array(count * 6);
  const seeds = [];

  const cTail = new THREE.Color('#091326');
  const cHead = new THREE.Color(colors.cherenkov || '#5CE1E6').lerp(new THREE.Color(colors.starCore || '#FFF8E7'), 0.65);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radial = 0.9 + Math.random() * 5.2;
    const zOffset = (Math.random() - 0.5) * 20;
    const len = 1.6 + Math.random() * 2.8;
    const speed = 14 + Math.random() * 18;
    seeds.push({
      x: Math.cos(angle) * radial,
      y: Math.sin(angle) * radial,
      z: zOffset,
      len,
      speed,
    });
    vColors[i * 6] = cTail.r;
    vColors[i * 6 + 1] = cTail.g;
    vColors[i * 6 + 2] = cTail.b;
    vColors[i * 6 + 3] = cHead.r;
    vColors[i * 6 + 4] = cHead.g;
    vColors[i * 6 + 5] = cHead.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;

  function update(dt, intensity, anchorPos, dirVec) {
    mat.opacity = intensity * 0.78;
    lines.visible = intensity > 0.01;
    if (!lines.visible) return;

    lines.position.copy(anchorPos);
    lines.lookAt(anchorPos.clone().add(dirVec));

    const posAttr = geo.attributes.position;
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      s.z -= s.speed * dt;
      if (s.z < -10) s.z += 20;

      posAttr.setXYZ(i * 2, s.x, s.y, s.z);
      posAttr.setXYZ(i * 2 + 1, s.x, s.y, s.z + s.len);
    }
    posAttr.needsUpdate = true;
  }

  return { lines, update };
}
