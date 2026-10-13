import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';
import type { TacticalMode } from '../agent/types';

export interface AiCharacterProps {
  position: { x: number; z: number };
  targetPosition: { x: number; z: number };
  health: number;
  shield?: boolean;
  attacking: boolean;
  dash?: boolean;
  tactic?: TacticalMode;
  moving?: boolean;
}

export function AiCharacter({
  position,
  targetPosition,
  health,
  shield = false,
  attacking,
  dash = false,
  tactic = 'ENGAGE',
  moving = false,
}: AiCharacterProps) {
  const rootGroup = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const torsoGroup = useRef<Group>(null);
  const crescentBlade = useRef<Group>(null);

  // Facing angle tracking
  const currentRotation = useRef(-Math.PI / 2);

  useFrame((state, delta) => {
    if (!rootGroup.current) return;
    const time = state.clock.elapsedTime;

    const px = position?.x ?? 0;
    const pz = position?.z ?? 0;
    const tx = targetPosition?.x ?? 0;
    const tz = targetPosition?.z ?? 0;

    // Face towards player
    const dx = tx - px;
    const dz = tz - pz;
    const targetAngle = Math.atan2(dx, dz);

    let diff = targetAngle - currentRotation.current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    currentRotation.current += diff * Math.min(1, delta * 14);
    rootGroup.current.rotation.y = currentRotation.current;

    // Tactical stance adjustments
    const isFlanking = tactic === 'EVADE_FLANK';
    const isRepositioning = tactic === 'DEFEND_REPOSITION';
    const isMoving = moving || isFlanking || isRepositioning || dash;

    // Robotic Hydraulic Leg Cycle
    const strideFreq = dash ? 16 : isFlanking ? 14 : isMoving ? 11 : 2.8;
    const strideAmp = dash ? 0.65 : isFlanking ? 0.55 : isMoving ? 0.42 : 0.035;
    const legSwing = Math.sin(time * strideFreq) * strideAmp;

    if (leftLeg.current && rightLeg.current) {
      leftLeg.current.rotation.x = legSwing;
      rightLeg.current.rotation.x = -legSwing;
    }

    // Left Arm (Counter-swing or defensive guard)
    if (leftArm.current) {
      if (isFlanking) {
        leftArm.current.rotation.x = -0.45;
        leftArm.current.rotation.z = -0.35;
      } else if (isRepositioning) {
        leftArm.current.rotation.x = -0.3;
        leftArm.current.rotation.z = -0.2;
      } else {
        leftArm.current.rotation.x = -legSwing * 0.7;
        leftArm.current.rotation.z = -0.15;
      }
    }

    // Right Arm (Crescent Forearm Blade & Palm Blaster)
    if (rightArm.current) {
      if (attacking) {
        // High-velocity arm blade thrust & energy blast
        const attackThrust = Math.sin(time * 36);
        rightArm.current.rotation.x = -1.2 + attackThrust * 0.25;
        rightArm.current.rotation.y = -0.15;
        rightArm.current.rotation.z = 0.2;
      } else if (isFlanking) {
        // Agile flanking blade hold
        rightArm.current.rotation.x = -0.65;
        rightArm.current.rotation.y = 0.25;
        rightArm.current.rotation.z = 0.3;
      } else {
        // Natural robotic combat ready stance
        rightArm.current.rotation.x = legSwing * 0.35 - 0.3;
        rightArm.current.rotation.y = 0.1;
        rightArm.current.rotation.z = 0.15;
      }
    }

    // Crescent Forearm Blade pulsing animation
    if (crescentBlade.current) {
      const bladePulse = attacking ? 1.25 + Math.sin(time * 40) * 0.15 : 1.0;
      crescentBlade.current.scale.setScalar(bladePulse);
    }

    // Torso Pitch / Posture based on tactical mode
    if (torsoGroup.current) {
      // Flanking: lower athletic crouch; Reposition: slight backward defensive posture
      const targetPitch = dash ? 0.32 : isFlanking ? 0.22 : isRepositioning ? -0.08 : isMoving ? 0.1 : Math.sin(time * 2.0) * 0.015;
      torsoGroup.current.rotation.x = MathUtils.lerp(torsoGroup.current.rotation.x, targetPitch, delta * 8);
    }

    // Robotic hydraulic vertical bob
    const bob = Math.abs(Math.sin(time * strideFreq)) * (isMoving ? 0.05 : 0.015);
    rootGroup.current.position.y = bob;
  });

  return (
    <group ref={rootGroup} position={[position?.x ?? 0, 0, position?.z ?? 0]} scale={1.22}>
      {/* Defensive Energy Barrier (if active) */}
      {shield && (
        <group position={[0, 1.15, 0]}>
          <mesh>
            <sphereGeometry args={[1.35, 24, 16]} />
            <meshStandardMaterial
              color="#ff1fb8"
              emissive="#ff1fb8"
              emissiveIntensity={0.6}
              transparent
              opacity={0.22}
              wireframe
            />
          </mesh>
        </group>
      )}

      {/* Main Robot Body Assembly */}
      <group ref={torsoGroup}>
        {/* ==================== LOWER BODY & MECHANICAL LEGS ==================== */}
        {/* Left Mechanical Leg */}
        <group ref={leftLeg} position={[-0.23, 0.74, 0]}>
          {/* Armored Robotic Thigh */}
          <mesh castShadow position={[0, -0.22, 0]}>
            <boxGeometry args={[0.2, 0.36, 0.22]} />
            <meshStandardMaterial color="#101117" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Outer Thigh Armor Plate with Magenta Conduit */}
          <mesh castShadow position={[-0.11, -0.2, 0]}>
            <boxGeometry args={[0.03, 0.26, 0.16]} />
            <meshStandardMaterial color="#191a23" metalness={0.95} roughness={0.16} />
          </mesh>
          <mesh position={[-0.128, -0.2, 0]}>
            <boxGeometry args={[0.01, 0.22, 0.03]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Circular Mechanical Knee Pivot Joint */}
          <group position={[0, -0.4, 0.02]}>
            <mesh castShadow rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.08, 0.08, 0.22, 12]} />
              <meshStandardMaterial color="#222430" metalness={0.96} roughness={0.15} />
            </mesh>
            {/* Knee Armor Cap */}
            <mesh castShadow position={[0, 0, 0.1]}>
              <boxGeometry args={[0.16, 0.14, 0.06]} />
              <meshStandardMaterial color="#151720" metalness={0.92} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.132]}>
              <boxGeometry args={[0.09, 0.03, 0.01]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
          </group>

          {/* Lower Shin & Calf Armor */}
          <mesh castShadow position={[0, -0.58, -0.01]}>
            <boxGeometry args={[0.17, 0.28, 0.19]} />
            <meshStandardMaterial color="#101117" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Rear Calf Thruster Vent */}
          <mesh position={[0, -0.56, -0.11]}>
            <boxGeometry args={[0.1, 0.14, 0.04]} />
            <meshStandardMaterial color="#262936" metalness={0.9} />
          </mesh>
          <mesh position={[0, -0.56, -0.132]}>
            <boxGeometry args={[0.06, 0.02, 0.01]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Robotic Combat Foot with Stabilizer Clamps (Reference 2) */}
          <group position={[0, -0.74, 0.04]}>
            <mesh castShadow position={[0, 0, 0.04]}>
              <boxGeometry args={[0.22, 0.12, 0.38]} />
              <meshStandardMaterial color="#14151e" metalness={0.94} roughness={0.18} />
            </mesh>
            {/* Split Clamp Toes */}
            <mesh position={[-0.06, -0.02, 0.21]}>
              <boxGeometry args={[0.07, 0.08, 0.08]} />
              <meshStandardMaterial color="#222532" metalness={0.95} />
            </mesh>
            <mesh position={[0.06, -0.02, 0.21]}>
              <boxGeometry args={[0.07, 0.08, 0.08]} />
              <meshStandardMaterial color="#222532" metalness={0.95} />
            </mesh>
            {/* Heel Hydraulic Strut */}
            <mesh position={[0, 0.04, -0.14]}>
              <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
              <meshStandardMaterial color="#2c303f" metalness={0.98} />
            </mesh>
            {/* Magenta Glowing Sole Tread */}
            <mesh position={[0, -0.065, 0.04]}>
              <boxGeometry args={[0.2, 0.02, 0.36]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* Right Mechanical Leg */}
        <group ref={rightLeg} position={[0.23, 0.74, 0]}>
          {/* Armored Robotic Thigh */}
          <mesh castShadow position={[0, -0.22, 0]}>
            <boxGeometry args={[0.2, 0.36, 0.22]} />
            <meshStandardMaterial color="#101117" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Outer Thigh Armor Plate with Magenta Conduit */}
          <mesh castShadow position={[0.11, -0.2, 0]}>
            <boxGeometry args={[0.03, 0.26, 0.16]} />
            <meshStandardMaterial color="#191a23" metalness={0.95} roughness={0.16} />
          </mesh>
          <mesh position={[0.128, -0.2, 0]}>
            <boxGeometry args={[0.01, 0.22, 0.03]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Circular Mechanical Knee Pivot Joint */}
          <group position={[0, -0.4, 0.02]}>
            <mesh castShadow rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.08, 0.08, 0.22, 12]} />
              <meshStandardMaterial color="#222430" metalness={0.96} roughness={0.15} />
            </mesh>
            {/* Knee Armor Cap */}
            <mesh castShadow position={[0, 0, 0.1]}>
              <boxGeometry args={[0.16, 0.14, 0.06]} />
              <meshStandardMaterial color="#151720" metalness={0.92} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.132]}>
              <boxGeometry args={[0.09, 0.03, 0.01]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
          </group>

          {/* Lower Shin & Calf Armor */}
          <mesh castShadow position={[0, -0.58, -0.01]}>
            <boxGeometry args={[0.17, 0.28, 0.19]} />
            <meshStandardMaterial color="#101117" metalness={0.92} roughness={0.2} />
          </mesh>
          {/* Rear Calf Thruster Vent */}
          <mesh position={[0, -0.56, -0.11]}>
            <boxGeometry args={[0.1, 0.14, 0.04]} />
            <meshStandardMaterial color="#262936" metalness={0.9} />
          </mesh>
          <mesh position={[0, -0.56, -0.132]}>
            <boxGeometry args={[0.06, 0.02, 0.01]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Robotic Combat Foot with Stabilizer Clamps */}
          <group position={[0, -0.74, 0.04]}>
            <mesh castShadow position={[0, 0, 0.04]}>
              <boxGeometry args={[0.22, 0.12, 0.38]} />
              <meshStandardMaterial color="#14151e" metalness={0.94} roughness={0.18} />
            </mesh>
            {/* Split Clamp Toes */}
            <mesh position={[-0.06, -0.02, 0.21]}>
              <boxGeometry args={[0.07, 0.08, 0.08]} />
              <meshStandardMaterial color="#222532" metalness={0.95} />
            </mesh>
            <mesh position={[0.06, -0.02, 0.21]}>
              <boxGeometry args={[0.07, 0.08, 0.08]} />
              <meshStandardMaterial color="#222532" metalness={0.95} />
            </mesh>
            {/* Heel Hydraulic Strut */}
            <mesh position={[0, 0.04, -0.14]}>
              <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
              <meshStandardMaterial color="#2c303f" metalness={0.98} />
            </mesh>
            {/* Magenta Glowing Sole Tread */}
            <mesh position={[0, -0.065, 0.04]}>
              <boxGeometry args={[0.2, 0.02, 0.36]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* Pelvic Chassis / Waist Ring */}
        <group position={[0, 0.78, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.27, 0.24, 0.16, 8]} />
            <meshStandardMaterial color="#121319" metalness={0.95} roughness={0.18} />
          </mesh>
          {/* Angular Groin / Hip Shield Plate */}
          <mesh castShadow position={[0, 0, 0.14]} rotation-x={-0.2}>
            <boxGeometry args={[0.22, 0.16, 0.08]} />
            <meshStandardMaterial color="#1b1c26" metalness={0.96} roughness={0.15} />
          </mesh>
          {/* Hip Energy Seam Ring */}
          <mesh position={[0, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.275, 0.015, 6, 20]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>
        </group>

        {/* ==================== UPPER TORSO & CHASSIS (Reference 2) ==================== */}
        <group position={[0, 1.08, 0]}>
          {/* Abdominal Core Armor Plates */}
          <mesh castShadow position={[0, -0.02, 0]}>
            <boxGeometry args={[0.38, 0.24, 0.26]} />
            <meshStandardMaterial color="#111218" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Abdominal Muscle Conduits */}
          <mesh position={[0, -0.02, 0.135]}>
            <boxGeometry args={[0.16, 0.18, 0.01]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Heavy Angular Robotic Chestplate */}
          <mesh castShadow position={[0, 0.2, 0.02]}>
            <boxGeometry args={[0.56, 0.32, 0.32]} />
            <meshStandardMaterial color="#13141c" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Angular Pectoral Armor Facets */}
          <mesh castShadow position={[-0.14, 0.22, 0.18]} rotation-y={0.2} rotation-x={-0.15}>
            <boxGeometry args={[0.22, 0.24, 0.08]} />
            <meshStandardMaterial color="#1c1e28" metalness={0.96} roughness={0.15} />
          </mesh>
          <mesh castShadow position={[0.14, 0.22, 0.18]} rotation-y={-0.2} rotation-x={-0.15}>
            <boxGeometry args={[0.22, 0.24, 0.08]} />
            <meshStandardMaterial color="#1c1e28" metalness={0.96} roughness={0.15} />
          </mesh>

          {/* Glowing Magenta Diamond / Inverted Chevron Chest Core (Reference 2) */}
          <group position={[0, 0.22, 0.23]}>
            <mesh rotation-z={Math.PI / 4}>
              <boxGeometry args={[0.1, 0.1, 0.02]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
            <mesh rotation-z={Math.PI / 4}>
              <boxGeometry args={[0.06, 0.06, 0.025]} />
              <meshBasicMaterial color="#ffa6ee" toneMapped={false} />
            </mesh>
          </group>

          {/* Chest Light Emitting Conduits */}
          <mesh position={[-0.18, 0.1, 0.19]} rotation-z={0.35}>
            <boxGeometry args={[0.14, 0.02, 0.01]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>
          <mesh position={[0.18, 0.1, 0.19]} rotation-z={-0.35}>
            <boxGeometry args={[0.14, 0.02, 0.01]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* ==================== HIGH-TECH CONCENTRIC BACK CORE (Reference 2 Back View) ==================== */}
          <group position={[0, 0.18, -0.17]}>
            {/* Spinal Upper Armor Base Plate */}
            <mesh castShadow>
              <boxGeometry args={[0.34, 0.38, 0.08]} />
              <meshStandardMaterial color="#101117" metalness={0.94} roughness={0.18} />
            </mesh>

            {/* CONCENTRIC TARGET REACTOR CORE (Reference 2 "BACK CORE" Detail) */}
            {/* Outer Concentric Target Ring */}
            <mesh position={[0, 0.04, -0.042]} rotation-y={Math.PI}>
              <ringGeometry args={[0.11, 0.13, 24]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
            {/* Middle Concentric Target Ring */}
            <mesh position={[0, 0.04, -0.042]} rotation-y={Math.PI}>
              <ringGeometry args={[0.065, 0.085, 24]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
            {/* Central High-Intensity Emitter Node */}
            <mesh position={[0, 0.04, -0.043]}>
              <circleGeometry args={[0.038, 16]} />
              <meshBasicMaterial color="#ffa6ee" toneMapped={false} />
            </mesh>
            {/* 4 Radial Energy Channels */}
            {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle, idx) => (
              <mesh
                key={idx}
                position={[
                  Math.cos(angle) * 0.1,
                  0.04 + Math.sin(angle) * 0.1,
                  -0.042,
                ]}
                rotation-z={angle}
              >
                <boxGeometry args={[0.04, 0.012, 0.005]} />
                <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
              </mesh>
            ))}

            {/* Interlocking Segmented Vertebrae Column below the Core */}
            {[-0.1, -0.18].map((y, idx) => (
              <mesh key={idx} castShadow position={[0, y, -0.03]}>
                <boxGeometry args={[0.12, 0.06, 0.06]} />
                <meshStandardMaterial color="#20222e" metalness={0.96} roughness={0.15} />
              </mesh>
            ))}
            {[-0.1, -0.18].map((y, idx) => (
              <mesh key={`conduit-${idx}`} position={[0, y, -0.062]}>
                <boxGeometry args={[0.04, 0.025, 0.01]} />
                <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
              </mesh>
            ))}

            {/* Dual Scapula Thruster Exhaust Vents */}
            <mesh position={[-0.2, 0.14, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.06]} />
              <meshStandardMaterial color="#262836" metalness={0.9} />
            </mesh>
            <mesh position={[0.2, 0.14, 0]}>
              <boxGeometry args={[0.08, 0.12, 0.06]} />
              <meshStandardMaterial color="#262836" metalness={0.9} />
            </mesh>
          </group>
        </group>

        {/* ==================== ARMS & WEAPON BLADES (Reference 2) ==================== */}
        {/* Left Arm: Articulated Mechanical Arm & Palm Blaster */}
        <group ref={leftArm} position={[-0.44, 1.32, 0]}>
          {/* Spherical Shoulder Joint Armor with Magenta Perimeter Ring */}
          <mesh castShadow>
            <sphereGeometry args={[0.15, 14, 12]} />
            <meshStandardMaterial color="#161720" metalness={0.95} roughness={0.16} />
          </mesh>
          <mesh rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.155, 0.015, 6, 20]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Bicep Segment with Magenta Conduit */}
          <mesh castShadow position={[0, -0.22, 0]}>
            <boxGeometry args={[0.14, 0.28, 0.15]} />
            <meshStandardMaterial color="#111218" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[-0.075, -0.22, 0]}>
            <boxGeometry args={[0.01, 0.2, 0.03]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Mechanical Elbow Pin */}
          <mesh castShadow position={[0, -0.38, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.07, 0.07, 0.16, 10]} />
            <meshStandardMaterial color="#2a2d3c" metalness={0.96} roughness={0.12} />
          </mesh>

          {/* Forearm Armor Segment */}
          <mesh castShadow position={[0, -0.54, 0.02]}>
            <boxGeometry args={[0.15, 0.26, 0.16]} />
            <meshStandardMaterial color="#161722" metalness={0.94} roughness={0.16} />
          </mesh>

          {/* Mechanical Robotic Hand & Palm Blaster */}
          <mesh castShadow position={[0, -0.72, 0.03]}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color="#111219" metalness={0.9} />
          </mesh>
          {/* Articulated Metal Fingers */}
          {[-0.04, 0, 0.04].map((offset, idx) => (
            <mesh key={idx} castShadow position={[offset, -0.81, 0.04]}>
              <boxGeometry args={[0.03, 0.09, 0.04]} />
              <meshStandardMaterial color="#262936" metalness={0.95} />
            </mesh>
          ))}
          {/* Palm Energy Emitter */}
          <mesh position={[0, -0.72, 0.092]}>
            <circleGeometry args={[0.032, 10]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>
        </group>

        {/* Right Arm: Crescent Forearm Energy Blade & Pulse Blaster (Reference 2 Attack) */}
        <group ref={rightArm} position={[0.44, 1.32, 0]}>
          {/* Spherical Shoulder Joint Armor with Magenta Perimeter Ring */}
          <mesh castShadow>
            <sphereGeometry args={[0.15, 14, 12]} />
            <meshStandardMaterial color="#161720" metalness={0.95} roughness={0.16} />
          </mesh>
          <mesh rotation-y={Math.PI / 2}>
            <torusGeometry args={[0.155, 0.015, 6, 20]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Bicep Segment with Magenta Conduit */}
          <mesh castShadow position={[0, -0.22, 0]}>
            <boxGeometry args={[0.14, 0.28, 0.15]} />
            <meshStandardMaterial color="#111218" metalness={0.92} roughness={0.2} />
          </mesh>
          <mesh position={[0.075, -0.22, 0]}>
            <boxGeometry args={[0.01, 0.2, 0.03]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>

          {/* Mechanical Elbow Pin */}
          <mesh castShadow position={[0, -0.38, 0]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.07, 0.07, 0.16, 10]} />
            <meshStandardMaterial color="#2a2d3c" metalness={0.96} roughness={0.12} />
          </mesh>

          {/* Forearm Armor with Crescent Blade Emitter Mount */}
          <mesh castShadow position={[0, -0.54, 0.02]}>
            <boxGeometry args={[0.16, 0.28, 0.18]} />
            <meshStandardMaterial color="#161722" metalness={0.94} roughness={0.16} />
          </mesh>

          {/* ==================== CRESCENT FOREARM ENERGY BLADE (Reference 2) ==================== */}
          <group ref={crescentBlade} position={[0.09, -0.54, 0.12]}>
            {/* Blade Emitter Bracket */}
            <mesh position={[-0.01, 0, 0]}>
              <boxGeometry args={[0.04, 0.22, 0.08]} />
              <meshStandardMaterial color="#282b3a" metalness={0.96} roughness={0.15} />
            </mesh>
            {/* Curved Magenta Energy Arc Blade */}
            <mesh position={[0.02, 0.08, 0.26]} rotation-x={-0.35}>
              <boxGeometry args={[0.022, 0.08, 0.72]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
            {/* White-Hot Core Plasma Edge */}
            <mesh position={[0.02, 0.08, 0.26]} rotation-x={-0.35}>
              <boxGeometry args={[0.012, 0.04, 0.68]} />
              <meshBasicMaterial color="#ffa6ee" toneMapped={false} />
            </mesh>
            {/* Curved Tip Spike */}
            <mesh position={[0.02, -0.06, 0.64]} rotation={[-0.65, Math.PI / 4, 0]}>
              <coneGeometry args={[0.035, 0.22, 4]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
          </group>

          {/* Right Robotic Hand & Heavy Palm Blaster Emitter */}
          <mesh castShadow position={[0, -0.72, 0.03]}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color="#111219" metalness={0.9} />
          </mesh>
          {/* Heavy Rotary Barrel / Muzzle on Forearm for Range Attacks */}
          <mesh position={[0, -0.68, 0.18]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.038, 0.038, 0.18, 12]} />
            <meshStandardMaterial color="#242735" metalness={0.95} />
          </mesh>
          <mesh position={[0, -0.68, 0.275]}>
            <circleGeometry args={[0.032, 12]} />
            <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
          </mesh>
        </group>

        {/* ==================== ROBOTIC HELMET & V-VISOR (Reference 2 Head) ==================== */}
        <group position={[0, 1.52, 0]}>
          {/* Mechanical Articulated Neck */}
          <mesh castShadow position={[0, -0.06, 0.02]}>
            <cylinderGeometry args={[0.13, 0.15, 0.14, 8]} />
            <meshStandardMaterial color="#242736" metalness={0.96} roughness={0.15} />
          </mesh>
          {/* Neck Spinal Hydraulic Pistons */}
          <mesh position={[-0.06, -0.06, -0.06]}>
            <cylinderGeometry args={[0.02, 0.02, 0.12, 6]} />
            <meshStandardMaterial color="#363a4d" metalness={0.98} />
          </mesh>
          <mesh position={[0.06, -0.06, -0.06]}>
            <cylinderGeometry args={[0.02, 0.02, 0.12, 6]} />
            <meshStandardMaterial color="#363a4d" metalness={0.98} />
          </mesh>

          {/* Robotic Helmet Shell Base */}
          <group position={[0, 0.14, 0]}>
            {/* Aerodynamic Carbon-Metallic Skull Cap */}
            <mesh castShadow>
              <sphereGeometry args={[0.22, 18, 14]} />
              <meshStandardMaterial color="#111218" metalness={0.95} roughness={0.16} />
            </mesh>
            {/* Angular Cheek Guards */}
            <mesh castShadow position={[-0.14, -0.04, 0.08]} rotation-y={0.25}>
              <boxGeometry args={[0.08, 0.16, 0.18]} />
              <meshStandardMaterial color="#181a24" metalness={0.95} roughness={0.16} />
            </mesh>
            <mesh castShadow position={[0.14, -0.04, 0.08]} rotation-y={-0.25}>
              <boxGeometry args={[0.08, 0.16, 0.18]} />
              <meshStandardMaterial color="#181a24" metalness={0.95} roughness={0.16} />
            </mesh>
            {/* Angular Robotic Chin Plate */}
            <mesh castShadow position={[0, -0.12, 0.13]} rotation-x={-0.35}>
              <boxGeometry args={[0.12, 0.1, 0.12]} />
              <meshStandardMaterial color="#1a1c26" metalness={0.96} roughness={0.15} />
            </mesh>

            {/* DISTINCTIVE ANGULAR EAR FINS / SENSOR CRESTS (Reference 2 Key Trait) */}
            {/* Left Ear Fin pointing backwards and up */}
            <group position={[-0.22, 0.08, -0.04]} rotation-z={-0.38} rotation-y={-0.25} rotation-x={-0.45}>
              <mesh castShadow>
                <boxGeometry args={[0.04, 0.38, 0.14]} />
                <meshStandardMaterial color="#181a25" metalness={0.95} roughness={0.16} />
              </mesh>
              {/* Magenta Glowing Fin Edge */}
              <mesh position={[-0.022, 0, 0.05]}>
                <boxGeometry args={[0.008, 0.36, 0.02]} />
                <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
              </mesh>
            </group>

            {/* Right Ear Fin pointing backwards and up */}
            <group position={[0.22, 0.08, -0.04]} rotation-z={0.38} rotation-y={0.25} rotation-x={-0.45}>
              <mesh castShadow>
                <boxGeometry args={[0.04, 0.38, 0.14]} />
                <meshStandardMaterial color="#181a25" metalness={0.95} roughness={0.16} />
              </mesh>
              {/* Magenta Glowing Fin Edge */}
              <mesh position={[0.022, 0, 0.05]}>
                <boxGeometry args={[0.008, 0.36, 0.02]} />
                <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
              </mesh>
            </group>

            {/* GLOWING MAGENTA V-SHAPED CHEVRON VISOR (Reference 2 Face) */}
            {/* Left Arm of the V */}
            <mesh position={[-0.065, 0.04, 0.2]} rotation-z={-0.58} rotation-y={0.15}>
              <boxGeometry args={[0.038, 0.17, 0.025]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
            {/* Right Arm of the V */}
            <mesh position={[0.065, 0.04, 0.2]} rotation-z={0.58} rotation-y={-0.15}>
              <boxGeometry args={[0.038, 0.17, 0.025]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
            {/* V Bottom Point Core */}
            <mesh position={[0, -0.03, 0.215]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color="#ffa6ee" toneMapped={false} />
            </mesh>

            {/* Forehead Armor Crest */}
            <mesh castShadow position={[0, 0.16, 0.12]} rotation-x={-0.4}>
              <boxGeometry args={[0.16, 0.12, 0.1]} />
              <meshStandardMaterial color="#20222f" metalness={0.96} roughness={0.14} />
            </mesh>
            <mesh position={[0, 0.16, 0.17]} rotation-x={-0.4}>
              <boxGeometry args={[0.08, 0.02, 0.01]} />
              <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Floating Tactical Health Bar */}
      <group position={[0, 2.38, 0]}>
        <mesh>
          <boxGeometry args={[1.05, 0.07, 0.03]} />
          <meshBasicMaterial color="#100518" />
        </mesh>
        <mesh position={[-(1.05 - (Math.max(0, Math.min(100, health)) / 100) * 1.05) / 2, 0, 0.018]}>
          <boxGeometry args={[Math.max(0.001, (Math.max(0, Math.min(100, health)) / 100) * 1.05), 0.042, 0.01]} />
          <meshBasicMaterial color="#ff1fb8" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
