import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MathUtils } from 'three';

export interface PlayerCharacterProps {
  position: { x: number; z: number };
  targetPosition: { x: number; z: number };
  health: number;
  shield: boolean;
  attacking: boolean;
  dash: boolean;
  weapon: 'blade' | 'pulse' | 'burst';
  moving?: boolean;
}

export function PlayerCharacter({
  position,
  targetPosition,
  health,
  shield,
  attacking,
  dash,
  weapon,
  moving = false,
}: PlayerCharacterProps) {
  const rootGroup = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const weaponGroup = useRef<Group>(null);
  const dashRing = useRef<Group>(null);
  const torsoGroup = useRef<Group>(null);

  // Target facing angle in radians
  const currentRotation = useRef(Math.PI / 2);

  useFrame((state, delta) => {
    if (!rootGroup.current) return;
    const time = state.clock.elapsedTime;

    const px = position?.x ?? 0;
    const pz = position?.z ?? 0;
    const tx = targetPosition?.x ?? 0;
    const tz = targetPosition?.z ?? 0;

    // Calculate facing towards target (AI)
    const dx = tx - px;
    const dz = tz - pz;
    const targetAngle = Math.atan2(dx, dz);

    // Smooth rotational slerp/lerp
    let diff = targetAngle - currentRotation.current;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    currentRotation.current += diff * Math.min(1, delta * 14);
    rootGroup.current.rotation.y = currentRotation.current;

    // Walking / Running / Idle animation
    const isMoving = moving || dash;
    const strideFreq = dash ? 16 : isMoving ? 10 : 2.5;
    const strideAmp = dash ? 0.65 : isMoving ? 0.45 : 0.04;
    const legSwing = Math.sin(time * strideFreq) * strideAmp;

    if (leftLeg.current && rightLeg.current) {
      leftLeg.current.rotation.x = legSwing;
      rightLeg.current.rotation.x = -legSwing;
    }

    // Arm swing counter-balanced to legs
    if (leftArm.current) {
      leftArm.current.rotation.x = -legSwing * 0.75 + (dash ? 0.35 : 0);
    }

    // Right Arm (Weapon wielding) & Attack action
    if (rightArm.current) {
      if (attacking) {
        if (weapon === 'blade') {
          // Dynamic melee slash
          const slashProgress = Math.sin(time * 30);
          rightArm.current.rotation.x = -0.7 + slashProgress * 0.9;
          rightArm.current.rotation.y = -0.3 + slashProgress * 0.5;
          rightArm.current.rotation.z = -0.4;
        } else {
          // Blaster recoil kick
          rightArm.current.rotation.x = -0.9 + Math.sin(time * 35) * 0.15;
          rightArm.current.rotation.y = 0.1;
          rightArm.current.rotation.z = -0.15;
        }
      } else {
        // Natural tactical weapon hold
        rightArm.current.rotation.x = legSwing * 0.4 - (isMoving ? 0.4 : 0.2);
        rightArm.current.rotation.y = 0.05;
        rightArm.current.rotation.z = -0.1;
      }
    }

    // Torso breathing and forward sprint lean
    if (torsoGroup.current) {
      const targetPitch = dash ? 0.28 : isMoving ? 0.12 : Math.sin(time * 2.2) * 0.02;
      torsoGroup.current.rotation.x = MathUtils.lerp(torsoGroup.current.rotation.x, targetPitch, delta * 10);
    }

    // Dash Ring spinning holographic animation
    if (dashRing.current) {
      dashRing.current.rotation.z += delta * (dash ? 15 : 3);
      const ringScale = dash ? 1.4 + Math.sin(time * 20) * 0.1 : 1.0;
      dashRing.current.scale.setScalar(ringScale);
    }

    // Character vertical bob
    const bob = Math.abs(Math.sin(time * strideFreq)) * (isMoving ? 0.06 : 0.02);
    rootGroup.current.position.y = bob;
  });

  return (
    <group ref={rootGroup} position={[position?.x ?? 0, 0, position?.z ?? 0]} scale={1.22}>
      {/* Phase Shield Bubble (Q ability) */}
      {shield && (
        <group position={[0, 1.1, 0]}>
          <mesh>
            <sphereGeometry args={[1.35, 24, 16]} />
            <meshStandardMaterial
              color="#14d8ff"
              emissive="#14d8ff"
              emissiveIntensity={0.6}
              transparent
              opacity={0.22}
              wireframe
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[1.32, 16, 12]} />
            <meshBasicMaterial color="#14d8ff" transparent opacity={0.08} />
          </mesh>
        </group>
      )}

      {/* Main Character Assembly */}
      <group ref={torsoGroup}>
        {/* ==================== LOWER BODY & LEGS ==================== */}
        {/* Left Leg (Dark navy cargo techwear with dangling cyan straps) */}
        <group ref={leftLeg} position={[-0.22, 0.72, 0]}>
          {/* Upper Thigh */}
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.13, 0.32, 6, 8]} />
            <meshStandardMaterial color="#0c1422" roughness={0.65} metalness={0.25} />
          </mesh>
          {/* Cargo Pocket (outer thigh) */}
          <mesh castShadow position={[-0.13, -0.18, 0]}>
            <boxGeometry args={[0.06, 0.18, 0.14]} />
            <meshStandardMaterial color="#09101b" roughness={0.7} />
          </mesh>
          {/* Dangling Cyan Tactical Straps / Ribbons (Reference 1 key trait!) */}
          <mesh position={[-0.15, -0.26, 0.02]} rotation-z={-0.15}>
            <boxGeometry args={[0.02, 0.28, 0.04]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>
          <mesh position={[-0.13, -0.32, -0.02]} rotation-z={-0.08}>
            <boxGeometry args={[0.015, 0.22, 0.03]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>

          {/* Knee Reinforcement Patch */}
          <mesh position={[0, -0.38, 0.11]}>
            <boxGeometry args={[0.16, 0.12, 0.06]} />
            <meshStandardMaterial color="#142135" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, -0.38, 0.14]}>
            <boxGeometry args={[0.1, 0.02, 0.015]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>

          {/* Lower Shin / Calf */}
          <mesh castShadow position={[0, -0.52, -0.01]}>
            <capsuleGeometry args={[0.11, 0.26, 6, 8]} />
            <meshStandardMaterial color="#0c1422" roughness={0.65} metalness={0.25} />
          </mesh>
          {/* Ankle Cuff */}
          <mesh position={[0, -0.66, 0]}>
            <cylinderGeometry args={[0.115, 0.125, 0.06, 10]} />
            <meshStandardMaterial color="#080e18" />
          </mesh>

          {/* Futuristic High-Top Sneaker / Combat Boot */}
          <group position={[0, -0.73, 0.05]}>
            <mesh castShadow position={[0, 0, 0.05]}>
              <boxGeometry args={[0.22, 0.15, 0.38]} />
              <meshStandardMaterial color="#09101a" roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Sneaker Toe Cap */}
            <mesh position={[0, -0.02, 0.2]}>
              <boxGeometry args={[0.2, 0.11, 0.1]} />
              <meshStandardMaterial color="#152438" roughness={0.5} metalness={0.5} />
            </mesh>
            {/* Cyan Glowing Sole Tread */}
            <mesh position={[0, -0.08, 0.06]}>
              <boxGeometry args={[0.23, 0.025, 0.4]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
            {/* Cyan Heel Accent Light */}
            <mesh position={[0, 0.02, -0.14]}>
              <boxGeometry args={[0.16, 0.04, 0.02]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* Right Leg (Dark navy cargo techwear with dangling cyan straps) */}
        <group ref={rightLeg} position={[0.22, 0.72, 0]}>
          {/* Upper Thigh */}
          <mesh castShadow position={[0, -0.22, 0]}>
            <capsuleGeometry args={[0.13, 0.32, 6, 8]} />
            <meshStandardMaterial color="#0c1422" roughness={0.65} metalness={0.25} />
          </mesh>
          {/* Cargo Pocket (outer thigh) */}
          <mesh castShadow position={[0.13, -0.18, 0]}>
            <boxGeometry args={[0.06, 0.18, 0.14]} />
            <meshStandardMaterial color="#09101b" roughness={0.7} />
          </mesh>
          {/* Dangling Cyan Tactical Straps / Ribbons */}
          <mesh position={[0.15, -0.26, 0.02]} rotation-z={0.15}>
            <boxGeometry args={[0.02, 0.28, 0.04]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>
          <mesh position={[0.13, -0.32, -0.02]} rotation-z={0.08}>
            <boxGeometry args={[0.015, 0.22, 0.03]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>

          {/* Knee Reinforcement Patch */}
          <mesh position={[0, -0.38, 0.11]}>
            <boxGeometry args={[0.16, 0.12, 0.06]} />
            <meshStandardMaterial color="#142135" roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh position={[0, -0.38, 0.14]}>
            <boxGeometry args={[0.1, 0.02, 0.015]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>

          {/* Lower Shin / Calf */}
          <mesh castShadow position={[0, -0.52, -0.01]}>
            <capsuleGeometry args={[0.11, 0.26, 6, 8]} />
            <meshStandardMaterial color="#0c1422" roughness={0.65} metalness={0.25} />
          </mesh>
          {/* Ankle Cuff */}
          <mesh position={[0, -0.66, 0]}>
            <cylinderGeometry args={[0.115, 0.125, 0.06, 10]} />
            <meshStandardMaterial color="#080e18" />
          </mesh>

          {/* Futuristic High-Top Sneaker / Combat Boot */}
          <group position={[0, -0.73, 0.05]}>
            <mesh castShadow position={[0, 0, 0.05]}>
              <boxGeometry args={[0.22, 0.15, 0.38]} />
              <meshStandardMaterial color="#09101a" roughness={0.4} metalness={0.6} />
            </mesh>
            {/* Sneaker Toe Cap */}
            <mesh position={[0, -0.02, 0.2]}>
              <boxGeometry args={[0.2, 0.11, 0.1]} />
              <meshStandardMaterial color="#152438" roughness={0.5} metalness={0.5} />
            </mesh>
            {/* Cyan Glowing Sole Tread */}
            <mesh position={[0, -0.08, 0.06]}>
              <boxGeometry args={[0.23, 0.025, 0.4]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
            {/* Cyan Heel Accent Light */}
            <mesh position={[0, 0.02, -0.14]}>
              <boxGeometry args={[0.16, 0.04, 0.02]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* Pelvis / Waist / Tactical Belt */}
        <group position={[0, 0.76, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.28, 0.25, 0.18, 12]} />
            <meshStandardMaterial color="#0a121f" roughness={0.6} />
          </mesh>
          {/* Utility Belt */}
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.3, 0.3, 0.07, 12]} />
            <meshStandardMaterial color="#111c2c" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* Cyber Buckle with Cyan Inset */}
          <mesh position={[0, 0.04, 0.3]}>
            <boxGeometry args={[0.09, 0.06, 0.03]} />
            <meshStandardMaterial color="#1c2d44" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.04, 0.316]}>
            <boxGeometry args={[0.045, 0.025, 0.01]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>
        </group>

        {/* ==================== UPPER BODY & JACKET ==================== */}
        <group position={[0, 1.05, 0]}>
          {/* Inner Light/White Athletic Shirt */}
          <mesh castShadow position={[0, 0.08, 0.04]}>
            <cylinderGeometry args={[0.26, 0.24, 0.44, 12]} />
            <meshStandardMaterial color="#dbe6f5" roughness={0.7} />
          </mesh>

          {/* Cyan Tactical Cross / Harness Straps (Reference 1: X/V Chest Harness) */}
          <mesh position={[0, 0.14, 0.24]} rotation-z={0.42}>
            <boxGeometry args={[0.035, 0.32, 0.015]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.14, 0.24]} rotation-z={-0.42}>
            <boxGeometry args={[0.035, 0.32, 0.015]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>
          {/* Central Harness Ring / Node */}
          <mesh position={[0, 0.14, 0.25]}>
            <circleGeometry args={[0.035, 12]} />
            <meshBasicMaterial color="#b5f7ff" toneMapped={false} />
          </mesh>

          {/* Outer Dark Navy Futuristic Jacket / Techwear Hoodie */}
          {/* Jacket Back & Sides Wrap */}
          <mesh castShadow position={[0, 0.08, -0.04]}>
            <cylinderGeometry args={[0.31, 0.29, 0.46, 12, 1, false, Math.PI * 0.7, Math.PI * 1.6]} />
            <meshStandardMaterial color="#0c1524" roughness={0.6} metalness={0.25} />
          </mesh>
          {/* Left Jacket Flap */}
          <mesh castShadow position={[-0.2, 0.08, 0.14]} rotation-y={0.25}>
            <boxGeometry args={[0.16, 0.44, 0.12]} />
            <meshStandardMaterial color="#0c1524" roughness={0.6} metalness={0.25} />
          </mesh>
          {/* Right Jacket Flap */}
          <mesh castShadow position={[0.2, 0.08, 0.14]} rotation-y={-0.25}>
            <boxGeometry args={[0.16, 0.44, 0.12]} />
            <meshStandardMaterial color="#0c1524" roughness={0.6} metalness={0.25} />
          </mesh>

          {/* Vertical Cyan Piping Lines along Jacket Zipper Margins */}
          <mesh position={[-0.11, 0.08, 0.21]}>
            <boxGeometry args={[0.018, 0.4, 0.015]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>
          <mesh position={[0.11, 0.08, 0.21]}>
            <boxGeometry args={[0.018, 0.4, 0.015]} />
            <meshBasicMaterial color="#14d8ff" toneMapped={false} />
          </mesh>

          {/* Shoulder Pauldrons / Pads with Cyan Triangle Emblem (Reference 1) */}
          {/* Left Shoulder */}
          <group position={[-0.38, 0.28, 0]} rotation-z={-0.12}>
            <mesh castShadow>
              <boxGeometry args={[0.18, 0.12, 0.24]} />
              <meshStandardMaterial color="#142135" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Cyan Inverted Triangular Insignia */}
            <mesh position={[-0.095, 0, 0]} rotation-y={-Math.PI / 2} rotation-z={Math.PI}>
              <circleGeometry args={[0.045, 3]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
          </group>

          {/* Right Shoulder */}
          <group position={[0.38, 0.28, 0]} rotation-z={0.12}>
            <mesh castShadow>
              <boxGeometry args={[0.18, 0.12, 0.24]} />
              <meshStandardMaterial color="#142135" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Cyan Inverted Triangular Insignia */}
            <mesh position={[0.095, 0, 0]} rotation-y={Math.PI / 2} rotation-z={Math.PI}>
              <circleGeometry args={[0.045, 3]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
          </group>

          {/* ==================== TACTICAL BACKPACK (Reference 1 Back View) ==================== */}
          <group position={[0, 0.08, -0.25]}>
            {/* Main Backpack Pack */}
            <mesh castShadow>
              <boxGeometry args={[0.36, 0.42, 0.22]} />
              <meshStandardMaterial color="#0b1220" roughness={0.55} metalness={0.35} />
            </mesh>
            {/* Top Equipment Roll / Flap */}
            <mesh castShadow position={[0, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 0.34, 10]} />
              <meshStandardMaterial color="#111c2e" roughness={0.6} />
            </mesh>
            {/* Side Pouches */}
            <mesh position={[-0.2, -0.04, 0]}>
              <boxGeometry args={[0.06, 0.2, 0.14]} />
              <meshStandardMaterial color="#080e18" />
            </mesh>
            <mesh position={[0.2, -0.04, 0]}>
              <boxGeometry args={[0.06, 0.2, 0.14]} />
              <meshStandardMaterial color="#080e18" />
            </mesh>
            {/* Glowing Cyan Inverted Triangle Emblem on Rear Backpack Surface! */}
            <mesh position={[0, 0.04, -0.115]} rotation-z={Math.PI}>
              <circleGeometry args={[0.075, 3]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.04, -0.118]} rotation-z={Math.PI}>
              <ringGeometry args={[0.082, 0.1, 3]} />
              <meshBasicMaterial color="#6cf5ff" toneMapped={false} />
            </mesh>
          </group>
        </group>

        {/* ==================== ARMS & WEAPONS ==================== */}
        {/* Left Arm: Forearm with Holographic Dash Device (Reference 1) */}
        <group ref={leftArm} position={[-0.42, 1.28, 0]}>
          {/* Upper Arm Sleeve */}
          <mesh castShadow position={[0, -0.18, 0]}>
            <capsuleGeometry args={[0.1, 0.28, 5, 8]} />
            <meshStandardMaterial color="#0c1524" roughness={0.6} />
          </mesh>
          {/* Elbow Guard */}
          <mesh position={[0, -0.32, -0.06]}>
            <boxGeometry args={[0.12, 0.1, 0.05]} />
            <meshStandardMaterial color="#142135" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Forearm Sleeve */}
          <mesh castShadow position={[0, -0.46, 0.02]}>
            <capsuleGeometry args={[0.09, 0.24, 5, 8]} />
            <meshStandardMaterial color="#09101b" roughness={0.6} />
          </mesh>

          {/* DASH DEVICE: Cybernetic Wrist Ring Emitter (Reference 1 Tools) */}
          <group ref={dashRing} position={[0, -0.56, 0.02]} rotation-x={Math.PI / 2}>
            <mesh>
              <torusGeometry args={[0.13, 0.025, 8, 24]} />
              <meshStandardMaterial color="#142438" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh>
              <torusGeometry args={[0.145, 0.012, 6, 24]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
            {/* Micro Emitter Nodes */}
            {[0, 1, 2, 3].map((idx) => (
              <mesh
                key={idx}
                position={[
                  Math.cos((idx * Math.PI) / 2) * 0.15,
                  Math.sin((idx * Math.PI) / 2) * 0.15,
                  0,
                ]}
              >
                <sphereGeometry args={[0.02, 6, 6]} />
                <meshBasicMaterial color="#6cf5ff" toneMapped={false} />
              </mesh>
            ))}
          </group>

          {/* Left Tactical Glove Hand */}
          <mesh castShadow position={[0, -0.66, 0.03]}>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshStandardMaterial color="#0e1724" roughness={0.5} metalness={0.4} />
          </mesh>
          {/* Skin visible at fingers (Anime human character) */}
          <mesh position={[0, -0.73, 0.04]}>
            <capsuleGeometry args={[0.045, 0.06, 4, 6]} />
            <meshStandardMaterial color="#fedbc5" roughness={0.7} />
          </mesh>
        </group>

        {/* Right Arm: Weapon Wielder */}
        <group ref={rightArm} position={[0.42, 1.28, 0]}>
          {/* Upper Arm Sleeve */}
          <mesh castShadow position={[0, -0.18, 0]}>
            <capsuleGeometry args={[0.1, 0.28, 5, 8]} />
            <meshStandardMaterial color="#0c1524" roughness={0.6} />
          </mesh>
          {/* Elbow Guard */}
          <mesh position={[0, -0.32, -0.06]}>
            <boxGeometry args={[0.12, 0.1, 0.05]} />
            <meshStandardMaterial color="#142135" metalness={0.5} roughness={0.4} />
          </mesh>
          {/* Forearm Sleeve */}
          <mesh castShadow position={[0, -0.46, 0.02]}>
            <capsuleGeometry args={[0.09, 0.24, 5, 8]} />
            <meshStandardMaterial color="#09101b" roughness={0.6} />
          </mesh>
          {/* Right Tactical Glove Hand */}
          <mesh castShadow position={[0, -0.64, 0.03]}>
            <sphereGeometry args={[0.075, 8, 8]} />
            <meshStandardMaterial color="#0e1724" roughness={0.5} metalness={0.4} />
          </mesh>

          {/* ==================== DYNAMIC WEAPON ATTACHMENT ==================== */}
          <group ref={weaponGroup} position={[0, -0.66, 0.1]} rotation-x={Math.PI / 2}>
            {weapon === 'blade' && (
              /* ENERGY BLADE: Reference 1 Primary Weapon */
              <group>
                {/* Hilt / Grip */}
                <mesh position={[0, 0, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.03, 0.035, 0.24, 8]} />
                  <meshStandardMaterial color="#0c1626" metalness={0.8} roughness={0.3} />
                </mesh>
                {/* Crossguard Emitter */}
                <mesh position={[0, 0, 0.02]}>
                  <boxGeometry args={[0.22, 0.05, 0.05]} />
                  <meshStandardMaterial color="#162942" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0, 0.02]}>
                  <boxGeometry args={[0.16, 0.02, 0.052]} />
                  <meshBasicMaterial color="#14d8ff" toneMapped={false} />
                </mesh>
                {/* Double-Edged Cyan Energy Plasma Blade */}
                <mesh position={[0, 0, 0.54]}>
                  <boxGeometry args={[0.065, 0.015, 0.98]} />
                  <meshBasicMaterial color="#14d8ff" toneMapped={false} />
                </mesh>
                {/* Inner White-Hot Plasma Core */}
                <mesh position={[0, 0, 0.54]}>
                  <boxGeometry args={[0.03, 0.022, 0.92]} />
                  <meshBasicMaterial color="#e0fbff" toneMapped={false} />
                </mesh>
                {/* Blade Tip Diamond */}
                <mesh position={[0, 0, 1.08]} rotation={[-Math.PI / 2, Math.PI / 4, 0]}>
                  <coneGeometry args={[0.05, 0.16, 4]} />
                  <meshBasicMaterial color="#14d8ff" toneMapped={false} />
                </mesh>
                <pointLight position={[0, 0, 0.5]} color="#14d8ff" intensity={4} distance={2.5} />
              </group>
            )}

            {weapon === 'pulse' && (
              /* TACTICAL TECH PISTOL: Reference 1 Secondary Weapon */
              <group rotation-x={-Math.PI / 2}>
                {/* Grip */}
                <mesh position={[0, -0.08, -0.04]} rotation-x={0.25}>
                  <boxGeometry args={[0.05, 0.16, 0.06]} />
                  <meshStandardMaterial color="#09101c" roughness={0.4} />
                </mesh>
                {/* Receiver / Frame */}
                <mesh position={[0, 0.02, 0.08]}>
                  <boxGeometry args={[0.07, 0.1, 0.32]} />
                  <meshStandardMaterial color="#14243a" metalness={0.85} roughness={0.25} />
                </mesh>
                {/* Top Cyan Glowing Rail */}
                <mesh position={[0, 0.08, 0.08]}>
                  <boxGeometry args={[0.04, 0.025, 0.28]} />
                  <meshBasicMaterial color="#14d8ff" toneMapped={false} />
                </mesh>
                {/* Heavy Barrel */}
                <mesh position={[0, 0.02, 0.26]} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.03, 0.03, 0.14, 10]} />
                  <meshStandardMaterial color="#09121f" metalness={0.9} />
                </mesh>
                {/* Muzzle Glow */}
                <mesh position={[0, 0.02, 0.34]}>
                  <circleGeometry args={[0.025, 10]} />
                  <meshBasicMaterial color="#6cf5ff" toneMapped={false} />
                </mesh>
              </group>
            )}

            {weapon === 'burst' && (
              /* BURST TECH RIFLE */
              <group rotation-x={-Math.PI / 2}>
                {/* Stock & Grip */}
                <mesh position={[0, -0.06, -0.12]}>
                  <boxGeometry args={[0.06, 0.16, 0.22]} />
                  <meshStandardMaterial color="#09101c" roughness={0.4} />
                </mesh>
                {/* Heavy Chassis */}
                <mesh position={[0, 0.04, 0.1]}>
                  <boxGeometry args={[0.09, 0.12, 0.44]} />
                  <meshStandardMaterial color="#13243a" metalness={0.85} roughness={0.25} />
                </mesh>
                {/* Dual Barrels */}
                <mesh position={[-0.03, 0.04, 0.36]} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
                  <meshStandardMaterial color="#0a1220" metalness={0.9} />
                </mesh>
                <mesh position={[0.03, 0.04, 0.36]} rotation-x={Math.PI / 2}>
                  <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
                  <meshStandardMaterial color="#0a1220" metalness={0.9} />
                </mesh>
                {/* Dual Muzzle Flash Accents */}
                <mesh position={[-0.03, 0.04, 0.46]}>
                  <circleGeometry args={[0.02, 8]} />
                  <meshBasicMaterial color="#14d8ff" toneMapped={false} />
                </mesh>
                <mesh position={[0.03, 0.04, 0.46]}>
                  <circleGeometry args={[0.02, 8]} />
                  <meshBasicMaterial color="#14d8ff" toneMapped={false} />
                </mesh>
              </group>
            )}
          </group>
        </group>

        {/* ==================== HEAD, FACE & HOOD (Reference 1) ==================== */}
        <group position={[0, 1.48, 0]}>
          {/* Human Neck Connection */}
          <mesh castShadow position={[0, -0.06, 0.02]}>
            <cylinderGeometry args={[0.11, 0.13, 0.14, 10]} />
            <meshStandardMaterial color="#fedbc5" roughness={0.7} />
          </mesh>
          {/* High Structured Cowl / Collar */}
          <mesh position={[0, -0.03, 0.02]}>
            <cylinderGeometry args={[0.22, 0.24, 0.12, 12, 1, true]} />
            <meshStandardMaterial color="#0d1728" roughness={0.6} />
          </mesh>

          {/* Anime Human Face */}
          <group position={[0, 0.12, 0.04]}>
            {/* Head Core */}
            <mesh castShadow>
              <sphereGeometry args={[0.18, 16, 14]} />
              <meshStandardMaterial color="#fedbc5" roughness={0.7} />
            </mesh>
            {/* Defined Chin / Jaw Contour */}
            <mesh position={[0, -0.08, 0.08]} rotation-x={-0.35}>
              <coneGeometry args={[0.11, 0.14, 8]} />
              <meshStandardMaterial color="#fedbc5" roughness={0.7} />
            </mesh>

            {/* Glowing Cyan Anime Eyes (Reference 1) */}
            <mesh position={[-0.062, 0.02, 0.165]}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
            <mesh position={[0.062, 0.02, 0.165]}>
              <sphereGeometry args={[0.026, 8, 8]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
            {/* Eye Pupil / Sparkle */}
            <mesh position={[-0.062, 0.025, 0.186]}>
              <sphereGeometry args={[0.01, 6, 6]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>
            <mesh position={[0.062, 0.025, 0.186]}>
              <sphereGeometry args={[0.01, 6, 6]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} />
            </mesh>

            {/* Dark Spiky Anime Hair Tufts (peeking out from under the hood) */}
            {/* Center Fringe */}
            <mesh position={[0, 0.12, 0.16]} rotation-x={-0.3}>
              <coneGeometry args={[0.04, 0.14, 5]} />
              <meshStandardMaterial color="#0e131d" roughness={0.8} />
            </mesh>
            {/* Left Fringe Spikes */}
            <mesh position={[-0.08, 0.11, 0.15]} rotation-z={0.3} rotation-x={-0.2}>
              <coneGeometry args={[0.04, 0.13, 5]} />
              <meshStandardMaterial color="#0e131d" roughness={0.8} />
            </mesh>
            <mesh position={[-0.13, 0.05, 0.13]} rotation-z={0.5}>
              <coneGeometry args={[0.035, 0.12, 5]} />
              <meshStandardMaterial color="#0e131d" roughness={0.8} />
            </mesh>
            {/* Right Fringe Spikes */}
            <mesh position={[0.08, 0.11, 0.15]} rotation-z={-0.3} rotation-x={-0.2}>
              <coneGeometry args={[0.04, 0.13, 5]} />
              <meshStandardMaterial color="#0e131d" roughness={0.8} />
            </mesh>
            <mesh position={[0.13, 0.05, 0.13]} rotation-z={-0.5}>
              <coneGeometry args={[0.035, 0.12, 5]} />
              <meshStandardMaterial color="#0e131d" roughness={0.8} />
            </mesh>
          </group>

          {/* Volumetric Futuristic Hood Surrounding Head (Reference 1) */}
          <group position={[0, 0.12, -0.02]}>
            {/* Outer Hood Dome (top & back) */}
            <mesh castShadow>
              <sphereGeometry args={[0.26, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.72]} />
              <meshStandardMaterial color="#0c1422" roughness={0.65} metalness={0.25} />
            </mesh>
            {/* Hood Back Volume Extrusion */}
            <mesh castShadow position={[0, -0.04, -0.08]}>
              <sphereGeometry args={[0.24, 16, 12]} />
              <meshStandardMaterial color="#0c1422" roughness={0.65} metalness={0.25} />
            </mesh>
            {/* Outer Hood Rim Frame */}
            <mesh position={[0, 0.04, 0.12]} rotation-x={0.25}>
              <torusGeometry args={[0.24, 0.032, 10, 24, Math.PI * 1.5]} />
              <meshStandardMaterial color="#101c2e" roughness={0.6} />
            </mesh>
            {/* Cyan Accent Trim along Hood Margin */}
            <mesh position={[0, 0.04, 0.13]} rotation-x={0.25}>
              <torusGeometry args={[0.245, 0.012, 6, 24, Math.PI * 1.4]} />
              <meshBasicMaterial color="#14d8ff" toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>

      {/* Floating Tactical Health & Status Bar */}
      <group position={[0, 2.38, 0]}>
        <mesh>
          <boxGeometry args={[1.05, 0.07, 0.03]} />
          <meshBasicMaterial color="#050d18" />
        </mesh>
        <mesh position={[-(1.05 - (Math.max(0, Math.min(100, health)) / 100) * 1.05) / 2, 0, 0.018]}>
          <boxGeometry args={[Math.max(0.001, (Math.max(0, Math.min(100, health)) / 100) * 1.05), 0.042, 0.01]} />
          <meshBasicMaterial color="#14d8ff" toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
