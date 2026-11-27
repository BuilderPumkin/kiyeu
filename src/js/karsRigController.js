import * as THREE from 'three';

/**
 * Grounded Skeletal Rig Controller for Ultimate Kars (Kars_Armature):
 * Uses true stance-foot ground-pinning + articulated gait leg/knee/ankle/arm cycles
 * so the planted boot never slides on the lunar dust while Hips and torso propel
 * forward genuinely step by step, followed by crouch/pickup, 2.4s gaze, and throw.
 */
export function createKarsRigController(karsRoot, animations, craterHeightAt) {
  const mixer = animations?.length ? new THREE.AnimationMixer(karsRoot) : null;
  const action = mixer ? mixer.clipAction(animations[0]) : null;
  if (action) {
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
  }

  const getBone = (name) =>
    karsRoot.getObjectByName(name)
    || karsRoot.getObjectByName(name.replace(/\./g, ''))
    || karsRoot.getObjectByName(name.replace(/\./g, '_'))
    || null;
  const bones = {
    hips: getBone('Hips'),
    spine: getBone('Spine'),
    chest: getBone('Chest'),
    neck: getBone('Neck'),
    head: getBone('Head'),
    upperArmL: getBone('UpperArm.L'),
    forearmL: getBone('Forearm.L'),
    handL: getBone('Hand.L'),
    upperArmR: getBone('UpperArm.R'),
    forearmR: getBone('Forearm.R'),
    handR: getBone('Hand.R'),
    thighL: getBone('Thigh.L'),
    shinL: getBone('Shin.L'),
    footL: getBone('Foot.L'),
    thighR: getBone('Thigh.R'),
    shinR: getBone('Shin.R'),
    footR: getBone('Foot.R'),
  };

  let lastClipTime = -1;
  const bootSoleOffset = 0.115;
  const baseX = -0.02;

  const tmpL = new THREE.Vector3();
  const tmpR = new THREE.Vector3();
  const tmpStance = new THREE.Vector3();

  function applyClipTime(tClip) {
    if (!mixer || !action) return;
    const clamped = THREE.MathUtils.clamp(tClip, 0, 4.49);
    const evalTime = Math.abs(clamped - lastClipTime) < 1e-5 ? Math.max(0, clamped - 2e-4) : clamped;
    lastClipTime = evalTime;
    mixer.setTime(evalTime);
  }

  function applyStepGaitPose(stanceSide, s, stanceA0, stanceA1, swingA0, swingA1, isGather = false) {
    applyClipTime(1.40);

    const easeS = THREE.MathUtils.smoothstep(s, 0, 1);
    const stanceAng = THREE.MathUtils.lerp(stanceA0, stanceA1, easeS);
    const swingAng = THREE.MathUtils.lerp(swingA0, swingA1, easeS);
    const lift = Math.sin(Math.PI * s) * (isGather ? 0.6 : 1.0);

    const isRightStance = stanceSide === 'R';
    const stThigh = isRightStance ? bones.thighR : bones.thighL;
    const stShin = isRightStance ? bones.shinR : bones.shinL;
    const stFoot = isRightStance ? bones.footR : bones.footL;

    const swThigh = isRightStance ? bones.thighL : bones.thighR;
    const swShin = isRightStance ? bones.shinL : bones.shinR;
    const swFoot = isRightStance ? bones.footL : bones.footR;

    // Stance leg extends backward cleanly relative to pelvis while pushing body forward
    if (stThigh && stShin && stFoot) {
      stThigh.rotateX(-stanceAng);
      stShin.rotateX(0.10 * Math.sin(Math.PI * s));
      stFoot.rotateX(THREE.MathUtils.lerp(-0.10, 0.16, easeS));
    }

    // Swing leg bends knee backward/high so boot clears the ground cleanly before heel strike
    if (swThigh && swShin && swFoot) {
      swThigh.rotateX(-swingAng - 0.34 * lift);
      swShin.rotateX(1.02 * lift + Math.max(0, -swingAng) * 0.28);
      swFoot.rotateX(-0.34 * lift + 0.14 * Math.sin(Math.PI * s * 0.5));
    }

    // Pelvis vertical rise over mid-stance & torso/arm natural counterweight
    if (bones.hips) {
      bones.hips.position.y -= 0.04 * (1 - lift);
      bones.hips.position.z = 0;
      bones.hips.rotation.y = (isRightStance ? 1 : -1) * swingAng * 0.16;
    }

    if (bones.spine && bones.chest) {
      bones.spine.rotateY((isRightStance ? -1 : 1) * swingAng * 0.14);
      bones.chest.rotateX(0.05);
    }

    const leftArmSwing = isRightStance ? -swingAng : swingAng;
    if (bones.upperArmL && bones.forearmL) {
      bones.upperArmL.rotateX(leftArmSwing * 0.38 + 0.06);
      bones.forearmL.rotateX(-0.14 - Math.max(0, leftArmSwing) * 0.12);
    }
    if (bones.upperArmR && bones.forearmR) {
      bones.upperArmR.rotateX(-leftArmSwing * 0.38 + 0.06);
      bones.forearmR.rotateX(-0.14 - Math.max(0, -leftArmSwing) * 0.12);
    }
  }

  function pinStanceFootAndGround(stanceBone, pinZ) {
    karsRoot.position.set(baseX, 0, 0);
    karsRoot.updateMatrixWorld(true);

    if (stanceBone) {
      stanceBone.getWorldPosition(tmpStance);
      const zShift = pinZ - tmpStance.z;
      karsRoot.position.z = zShift;
      karsRoot.updateMatrixWorld(true);
      stanceBone.getWorldPosition(tmpStance);
      const gy = craterHeightAt ? craterHeightAt(tmpStance.x, tmpStance.z) : 0;
      karsRoot.position.y = gy - (tmpStance.y - bootSoleOffset);
    }
    karsRoot.updateMatrixWorld(true);
  }

  function groundLowestFootAt(x, z) {
    karsRoot.position.set(x, 0, z);
    karsRoot.updateMatrixWorld(true);
    if (bones.footL && bones.footR && craterHeightAt) {
      bones.footL.getWorldPosition(tmpL);
      bones.footR.getWorldPosition(tmpR);
      const refFoot = tmpL.y <= tmpR.y ? tmpL : tmpR;
      const gy = craterHeightAt(refFoot.x, refFoot.z);
      karsRoot.position.y = gy - (refFoot.y - bootSoleOffset);
    } else if (craterHeightAt) {
      karsRoot.position.y = craterHeightAt(x, z);
    }
    karsRoot.updateMatrixWorld(true);
  }

  // Calibrate consecutive foot-pin Z targets once so Foot.L lands cleanly at z = -1.25 at stompT
  // and each subsequent step transitions with 0.000m foot slip!
  const stepSpecs = [
    // Step 1: R pinned, L swings forward to stomp at z = -1.25
    { stance: 'R', stA0: 0.22, stA1: -0.32, swA0: -0.30, swA1: 0.36, gather: false },
    // Step 2: L pinned at -1.25, R swings forward past L
    { stance: 'L', stA0: 0.36, stA1: -0.32, swA0: -0.32, swA1: 0.36, gather: false },
    // Step 3: R pinned, L swings forward past R
    { stance: 'R', stA0: 0.36, stA1: -0.32, swA0: -0.32, swA1: 0.36, gather: false },
    // Step 4: L pinned, R swings up near crater rim
    { stance: 'L', stA0: 0.36, stA1: -0.22, swA0: -0.32, swA1: 0.22, gather: false },
    // Gather: R stays pinned at crater rim while L steps neatly alongside R (both symmetric at 0.08)
    { stance: 'R', stA0: 0.22, stA1: 0.04, swA0: -0.22, swA1: 0.04, gather: true },
  ];

  // Solve exact chained pinZ values backward/forward from Step 1 landing Foot.L at -1.25
  const pinZs = [];
  if (bones.footL && bones.footR) {
    // 1. At end of Step 1 (s = 1.0), measure local Foot.L - Foot.R delta so Foot.L = -1.25
    applyStepGaitPose('R', 1.0, stepSpecs[0].stA0, stepSpecs[0].stA1, stepSpecs[0].swA0, stepSpecs[0].swA1, false);
    karsRoot.position.set(baseX, 0, 0);
    karsRoot.updateMatrixWorld(true);
    bones.footL.getWorldPosition(tmpL);
    bones.footR.getWorldPosition(tmpR);
    pinZs[0] = -1.25 + (tmpR.z - tmpL.z); // Foot.R pin during Step 1
    pinZs[1] = -1.25; // Foot.L pin during Step 2 (exact stomp target!)

    for (let k = 1; k < stepSpecs.length - 1; k++) {
      const sp = stepSpecs[k];
      applyStepGaitPose(sp.stance, 1.0, sp.stA0, sp.stA1, sp.swA0, sp.swA1, sp.gather);
      const stBone = sp.stance === 'R' ? bones.footR : bones.footL;
      const swBone = sp.stance === 'R' ? bones.footL : bones.footR;
      pinStanceFootAndGround(stBone, pinZs[k]);
      swBone.getWorldPosition(tmpL);
      pinZs[k + 1] = tmpL.z;
    }
  } else {
    pinZs.push(-1.82, -1.25, -0.78, -0.40, -0.24);
  }

  // Final standing Z at crater edge when Step 4 + Gather finish
  let craterEdgeZ = -0.24;
  if (bones.footR) {
    const gSp = stepSpecs[4];
    applyStepGaitPose(gSp.stance, 1.0, gSp.stA0, gSp.stA1, gSp.swA0, gSp.swA1, true);
    pinStanceFootAndGround(bones.footR, pinZs[4]);
    craterEdgeZ = karsRoot.position.z;
  }

  /**
   * Evaluates full body & bone poses deterministically for any timeline timestamp t.
   */
  function updateAtTimeline(t, beats) {
    const stompT = beats.karsBootStomp ?? 39.45;
    const kneelT = beats.karsKneelStart ?? 43.5;
    const grabT = beats.tabletGrab ?? 44.35;
    const gazeT = beats.karsGazeStart ?? 45.2;
    const windupT = beats.karsWindupStart ?? 47.6;
    const throwT = beats.tabletThrow ?? 48.45;
    const freezeEndT = beats.timeFreezeComplete ?? 51.3;

    if (t < kneelT) {
      // Exact step timing schedule: Step 1 ends on stompT (39.45s)
      const stepDur = 1.25;
      const tStep1Start = stompT - stepDur; // 38.20s
      const step2End = stompT + stepDur; // 40.70s
      const step3End = step2End + stepDur; // 41.95s
      const step4End = step3End + stepDur; // 43.20s

      let spIdx = 0;
      let s = 0;
      if (t < stompT) {
        spIdx = 0;
        s = THREE.MathUtils.clamp((t - tStep1Start) / stepDur, 0, 1);
      } else if (t < step2End) {
        spIdx = 1;
        s = THREE.MathUtils.clamp((t - stompT) / stepDur, 0, 1);
      } else if (t < step3End) {
        spIdx = 2;
        s = THREE.MathUtils.clamp((t - step2End) / stepDur, 0, 1);
      } else if (t < step4End) {
        spIdx = 3;
        s = THREE.MathUtils.clamp((t - step3End) / stepDur, 0, 1);
      } else {
        spIdx = 4;
        s = THREE.MathUtils.clamp((t - step4End) / Math.max(0.1, kneelT - step4End), 0, 1);
      }

      const sp = stepSpecs[spIdx];
      applyStepGaitPose(sp.stance, s, sp.stA0, sp.stA1, sp.swA0, sp.swA1, sp.gather);
      const stBone = sp.stance === 'R' ? bones.footR : bones.footL;
      pinStanceFootAndGround(stBone, pinZs[spIdx]);
      return;
    }

    if (t < gazeT) {
      // Phase B: Kneel & Pick up Stone Tablet from the crater
      const p = THREE.MathUtils.clamp((t - kneelT) / Math.max(0.1, gazeT - kneelT), 0, 1);
      const clipTime = THREE.MathUtils.lerp(1.40, 2.48, THREE.MathUtils.smoothstep(p, 0, 0.72));
      applyClipTime(clipTime);

      const reachPeak = grabT <= kneelT ? 0.5 : (grabT - kneelT) / (gazeT - kneelT);
      const bell = p <= reachPeak
        ? Math.sin((p / Math.max(0.01, reachPeak)) * (Math.PI * 0.5))
        : Math.cos(((p - reachPeak) / Math.max(0.01, 1 - reachPeak)) * (Math.PI * 0.5));
      const crouch = Math.pow(THREE.MathUtils.clamp(bell, 0, 1), 1.15);

      if (bones.hips) {
        bones.hips.position.y -= 0.42 * crouch;
        bones.hips.position.z *= 1 - crouch;
      }
      if (bones.thighL && bones.shinL) {
        bones.thighL.rotateX(-0.62 * crouch);
        bones.shinL.rotateX(0.92 * crouch);
      }
      if (bones.thighR && bones.shinR) {
        bones.thighR.rotateX(-0.52 * crouch);
        bones.shinR.rotateX(0.80 * crouch);
      }
      if (bones.spine && bones.chest) {
        bones.spine.rotateX(0.48 * crouch);
        bones.chest.rotateX(0.24 * crouch);
      }
      if (bones.upperArmR && bones.forearmR) {
        bones.upperArmR.rotateZ(0.42 * crouch);
        bones.upperArmR.rotateX(-0.55 * crouch);
        bones.forearmR.rotateX(-0.22 * crouch);
      }
      if (bones.head) {
        bones.head.rotateX(0.24 * crouch);
      }

      groundLowestFootAt(baseX, craterEdgeZ);
      return;
    }

    if (t < windupT) {
      // Phase C: Hold up the Stone Tablet and Gaze at it intently (~2.4s duration)
      const p = THREE.MathUtils.clamp((t - gazeT) / Math.max(0.1, windupT - gazeT), 0, 1);
      const clipTime = THREE.MathUtils.lerp(2.48, 2.94, THREE.MathUtils.smoothstep(p, 0, 1));
      applyClipTime(clipTime);

      const breathe = Math.sin(p * Math.PI * 2) * 0.018;
      if (bones.chest) bones.chest.rotateX(breathe);
      if (bones.head) {
        bones.head.rotateY(-0.18);
        bones.head.rotateX(0.08 + Math.sin(p * Math.PI) * 0.06);
      }

      groundLowestFootAt(baseX, craterEdgeZ);
      return;
    }

    // Phase D: Wind-up -> Skyward Throw -> Slow Time-Dilation Follow-through
    let clipTime;
    if (t <= throwT) {
      const p = THREE.MathUtils.clamp((t - windupT) / Math.max(0.05, throwT - windupT), 0, 1);
      clipTime = THREE.MathUtils.lerp(2.94, 3.67, p);
    } else {
      const pAfter = THREE.MathUtils.clamp((t - throwT) / Math.max(0.1, freezeEndT - throwT), 0, 1);
      const slowCurve = 1 - Math.pow(1 - pAfter, 2.4);
      clipTime = THREE.MathUtils.lerp(3.67, 4.30, slowCurve);
    }

    applyClipTime(clipTime);
    groundLowestFootAt(baseX, craterEdgeZ);
  }

  return {
    updateAtTimeline,
  };
}
