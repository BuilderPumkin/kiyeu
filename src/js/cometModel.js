import * as THREE from 'three';
import { createGlowSpriteTexture } from './spinVortex.js';

/**
 * Generates anamorphic 4-point optical diffraction flare using smooth needle spikes
 */
function createStarFlareTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const c = size / 2;

  for (let y = 0; y < size; y++) {
    const ny = (y - c) / c;
    for (let x = 0; x < size; x++) {
      const nx = (x - c) / c;
      const r = Math.hypot(nx, ny);
      const core = Math.exp(-r * r * 14.0);
      const spikeX = Math.exp(-Math.abs(ny) * 24.0) * Math.max(0, 1 - Math.abs(nx));
      const spikeY = Math.exp(-Math.abs(nx) * 24.0) * Math.max(0, 1 - Math.abs(ny));
      const val = Math.min(1, core + (spikeX * 0.85 + spikeY * 0.72) * Math.exp(-r * 2.2));
      const edgeFade = Math.max(0, 1 - Math.pow(r, 1.4));
      const a = val * edgeFade;

      const idx = (y * size + x) * 4;
      d[idx] = 255;
      d[idx + 1] = Math.round(238 + 17 * core);
      d[idx + 2] = Math.round(188 + 67 * core);
      d[idx + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * High-Craft 3D Sculpted Shooting Star / Comet Model:
 * - Streamlined LatheGeometry teardrop plasma head aligned to velocity tangent
 * - Crisp 4-point optical anamorphic flare + layered bloom halo
 * - Crossed dual-plane volumetric plasma ribbon tail
 * - 2 helical golden energy strands spiraling around the wake
 * - 260 sparkling trailing stardust particles
 */
export function createCometModel(colors) {
  const group = new THREE.Group();
  const trailGroup = new THREE.Group();
  group.visible = false;
  trailGroup.visible = false;

  // 1. Streamlined 3D Teardrop Plasma Head (nose +Z, tapered wake -Z)
  const profile = [];
  const pSteps = 22;
  for (let i = 0; i <= pSteps; i++) {
    const t = i / pSteps; // 0 = rear tip (-0.36), 1 = rounded nose (+0.18)
    const y = THREE.MathUtils.lerp(-0.38, 0.16, t);
    // Smooth teardrop radius profile peaking near front nose
    const r = Math.sin(Math.pow(t, 0.55) * Math.PI) * 0.095;
    profile.push(new THREE.Vector2(Math.max(0.0, r), y));
  }
  const headGeo = new THREE.LatheGeometry(profile, 28);
  headGeo.rotateX(Math.PI / 2); // Orient axis along +Z

  const headMat = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uGold: { value: new THREE.Color(colors.gold) },
      uCyan: { value: new THREE.Color(colors.cherenkov) },
      uAmethyst: { value: new THREE.Color(colors.amethyst) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPos;
      varying vec3 vViewDir;
      void main() {
        vPos = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPos;
      varying vec3 vViewDir;
      uniform float uTime;
      uniform vec3 uGold;
      uniform vec3 uCyan;
      uniform vec3 uAmethyst;

      void main() {
        float ndotv = max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
        float fresnel = pow(1.0 - ndotv, 1.8);
        float noseFactor = smoothstep(-0.35, 0.14, vPos.z);
        float plasmaRipple = 0.85 + 0.15 * sin(vPos.z * 28.0 - uTime * 24.0);

        vec3 coreCol = mix(uGold * 1.4, vec3(1.8, 1.75, 1.6), pow(ndotv, 1.5) * noseFactor);
        vec3 rimCol = mix(uAmethyst, uCyan, noseFactor);
        vec3 col = mix(coreCol, rimCol * 1.3, fresnel * 0.72) * plasmaRipple;
        float alpha = clamp(0.45 + noseFactor * 0.55, 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  group.add(headMesh);

  // Inner brilliant incandescent core sphere
  const innerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 16),
    new THREE.MeshBasicMaterial({ color: '#FFFFFF' })
  );
  innerCore.position.z = 0.05;
  group.add(innerCore);

  // 2. Optical Anamorphic Star Flare + Halo
  const starTex = createStarFlareTexture(256);
  const starFlare = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: starTex,
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  starFlare.scale.set(1.12, 1.12, 1);
  starFlare.position.z = 0.06;
  group.add(starFlare);

  const haloTex = createGlowSpriteTexture('#FFFFFF', colors.gold, 128);
  const outerHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTex,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  outerHalo.scale.set(0.75, 0.75, 1);
  group.add(outerHalo);

  // 3. Crossed Dual-Plane Volumetric Plasma Ribbon Tail (48 history segments)
  const segments = 48;
  const buildRibbon = () => {
    const pos = new Float32Array(segments * 2 * 3);
    const col = new Float32Array(segments * 2 * 3);
    const idx = [];

    const c0 = new THREE.Color('#FFFFFF');
    const c1 = new THREE.Color(colors.gold);
    const c2 = new THREE.Color(colors.cherenkov);
    const c3 = new THREE.Color(colors.amethyst);

    for (let i = 0; i < segments; i++) {
      const f = i / (segments - 1);
      const c = new THREE.Color();
      if (f < 0.22) c.copy(c0).lerp(c1, f / 0.22);
      else if (f < 0.55) c.copy(c1).lerp(c2, (f - 0.22) / 0.33);
      else c.copy(c2).lerp(c3, (f - 0.55) / 0.45);

      const fade = Math.pow(1 - f, 1.65);
      for (let k = 0; k < 2; k++) {
        const ptr = (i * 2 + k) * 3;
        col[ptr] = c.r * fade * 1.25;
        col[ptr + 1] = c.g * fade * 1.25;
        col[ptr + 2] = c.b * fade * 1.25;
      }

      if (i < segments - 1) {
        const a = i * 2;
        const b = a + 1;
        const cIdx = a + 2;
        const d = a + 3;
        idx.push(a, b, cIdx, b, d, cIdx);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return { geo, mesh };
  };

  const ribbonA = buildRibbon();
  const ribbonB = buildRibbon();
  trailGroup.add(ribbonA.mesh, ribbonB.mesh);

  // 4. Dual Smooth Tapered Helical Luminous Plasma Strands (no 1px kinked wireframe lines!)
  const buildHelixRibbon = (hexColor) => {
    const pos = new Float32Array(segments * 2 * 3);
    const col = new Float32Array(segments * 2 * 3);
    const idx = [];
    const baseCol = new THREE.Color(hexColor);

    for (let i = 0; i < segments; i++) {
      const f = i / (segments - 1);
      const fade = Math.pow(1 - f, 1.55) * Math.min(1, i * 0.35);
      for (let k = 0; k < 2; k++) {
        const ptr = (i * 2 + k) * 3;
        col[ptr] = baseCol.r * fade;
        col[ptr + 1] = baseCol.g * fade;
        col[ptr + 2] = baseCol.b * fade;
      }
      if (i < segments - 1) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return { geo, mesh };
  };
  const helixA = buildHelixRibbon(colors.gold);
  const helixB = buildHelixRibbon(colors.cherenkov);
  trailGroup.add(helixA.mesh, helixB.mesh);

  // 5. 260 Pinpoint Sparkle Stardust Particles (crisp star glints, zero blurry bokeh dots)
  const dustCount = 260;
  const dustPos = new Float32Array(dustCount * 3);
  const dustCol = new Float32Array(dustCount * 3);
  const dustSize = new Float32Array(dustCount);
  const dustData = [];

  for (let i = 0; i < dustCount; i++) {
    const c = new THREE.Color(i % 3 === 0 ? colors.gold : i % 3 === 1 ? '#FFFFFF' : colors.cherenkov);
    dustCol[i * 3] = c.r;
    dustCol[i * 3 + 1] = c.g;
    dustCol[i * 3 + 2] = c.b;
    dustSize[i] = 1.1 + Math.random() * 2.2;
    dustData.push({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: Math.random(),
      maxLife: 0.45 + Math.random() * 0.65,
    });
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aColor', new THREE.BufferAttribute(dustCol, 3));
  dustGeo.setAttribute('aSize', new THREE.BufferAttribute(dustSize, 1));

  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
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
        gl_PointSize = aSize * uPixelRatio * (14.0 / dist);
        vColor = aColor;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 36.0);
        float sx = exp(-abs(uv.y) * 26.0) * smoothstep(0.45, 0.0, abs(uv.x));
        float sy = exp(-abs(uv.x) * 26.0) * smoothstep(0.45, 0.0, abs(uv.y));
        gl_FragColor = vec4(vColor * 1.25, clamp(core + (sx + sy) * 0.45, 0.0, 1.0));
      }
    `,
  });
  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.frustumCulled = false;
  trailGroup.add(dustPoints);

  const history = Array.from({ length: segments }, () => new THREE.Vector3());
  let initialized = false;
  let clockAccum = 0;

  function setVisible(vis) {
    group.visible = vis;
    trailGroup.visible = vis;
  }

  function resetTrail(pos) {
    for (let i = 0; i < segments; i++) {
      history[i].copy(pos);
    }
    for (let i = 0; i < dustCount; i++) {
      dustData[i].pos.copy(pos);
      dustData[i].vel.set((Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.45, (Math.random() - 0.5) * 0.45);
      dustData[i].life = (i / dustCount) * dustData[i].maxLife;
    }
    initialized = true;
  }

  const lookTarget = new THREE.Vector3();
  const segTan = new THREE.Vector3();
  const upRef = new THREE.Vector3(0, 1, 0);
  const perpA = new THREE.Vector3();
  const perpB = new THREE.Vector3();

  function update(worldPos, tangent, cameraPos, rawDt = 0.016) {
    clockAccum += rawDt;
    headMat.uniforms.uTime.value = clockAccum;

    group.position.copy(worldPos);
    lookTarget.copy(worldPos).add(tangent);
    group.lookAt(lookTarget);

    if (!initialized) resetTrail(worldPos);

    for (let i = segments - 1; i > 0; i--) {
      history[i].copy(history[i - 1]);
    }
    history[0].copy(worldPos);

    const posA = ribbonA.geo.attributes.position;
    const posB = ribbonB.geo.attributes.position;
    const hPosA = helixA.geo.attributes.position;
    const hPosB = helixB.geo.attributes.position;

    for (let i = 0; i < segments; i++) {
      const p = history[i];
      const nextP = i < segments - 1 ? history[i + 1] : history[i];
      const prevP = i > 0 ? history[i - 1] : history[i];
      segTan.subVectors(prevP, nextP);
      if (segTan.lengthSq() < 1e-6) segTan.copy(tangent);
      segTan.normalize();

      perpA.crossVectors(segTan, upRef);
      if (perpA.lengthSq() < 1e-6) perpA.set(1, 0, 0);
      perpA.normalize();
      perpB.crossVectors(segTan, perpA).normalize();

      const f = i / (segments - 1);
      const halfW = 0.072 * Math.pow(1 - f, 1.25);

      posA.setXYZ(i * 2, p.x + perpA.x * halfW, p.y + perpA.y * halfW, p.z + perpA.z * halfW);
      posA.setXYZ(i * 2 + 1, p.x - perpA.x * halfW, p.y - perpA.y * halfW, p.z - perpA.z * halfW);

      posB.setXYZ(i * 2, p.x + perpB.x * halfW, p.y + perpB.y * halfW, p.z + perpB.z * halfW);
      posB.setXYZ(i * 2 + 1, p.x - perpB.x * halfW, p.y - perpB.y * halfW, p.z - perpB.z * halfW);

      // Helical tapered luminous ribbons wrapping wake
      const hAng = i * 0.36 - clockAccum * 12.0;
      const hRad = 0.068 * (1 - f * 0.72) * Math.min(1, i * 0.28);
      const sW = 0.0085 * (1 - f * 0.7) * Math.min(1, i * 0.35);
      const hx = (perpA.x * Math.cos(hAng) + perpB.x * Math.sin(hAng)) * hRad;
      const hy = (perpA.y * Math.cos(hAng) + perpB.y * Math.sin(hAng)) * hRad;
      const hz = (perpA.z * Math.cos(hAng) + perpB.z * Math.sin(hAng)) * hRad;

      const rx = (-perpA.x * Math.sin(hAng) + perpB.x * Math.cos(hAng)) * sW;
      const ry = (-perpA.y * Math.sin(hAng) + perpB.y * Math.cos(hAng)) * sW;
      const rz = (-perpA.z * Math.sin(hAng) + perpB.z * Math.cos(hAng)) * sW;

      hPosA.setXYZ(i * 2, p.x + hx + rx, p.y + hy + ry, p.z + hz + rz);
      hPosA.setXYZ(i * 2 + 1, p.x + hx - rx, p.y + hy - ry, p.z + hz - rz);

      hPosB.setXYZ(i * 2, p.x - hx + rx, p.y - hy + ry, p.z - hz + rz);
      hPosB.setXYZ(i * 2 + 1, p.x - hx - rx, p.y - hy - ry, p.z - hz - rz);
    }

    posA.needsUpdate = true;
    posB.needsUpdate = true;
    hPosA.needsUpdate = true;
    hPosB.needsUpdate = true;

    // Update sparkling stardust wake
    const dAttr = dustGeo.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      const d = dustData[i];
      d.life += rawDt;
      if (d.life >= d.maxLife) {
        d.life = 0;
        d.pos.copy(worldPos).addScaledVector(tangent, -0.1 - Math.random() * 0.25);
        d.vel.set(
          (Math.random() - 0.5) * 0.6 - tangent.x * 0.65,
          (Math.random() - 0.5) * 0.6 - tangent.y * 0.65,
          (Math.random() - 0.5) * 0.6 - tangent.z * 0.65
        );
      } else {
        d.pos.addScaledVector(d.vel, rawDt);
      }
      dAttr.setXYZ(i, d.pos.x, d.pos.y, d.pos.z);
    }
    dAttr.needsUpdate = true;
  }

  return { group, trailGroup, update, resetTrail, setVisible };
}
