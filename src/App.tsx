import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Group } from 'three';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Crosshair, Gauge, HelpCircle, Pause, Play, RotateCcw, Settings, Sparkles, Target, X, Zap } from 'lucide-react';
import './index.css';
import playerReference from './assets/images/player/image.png';
import aiReference from './assets/images/ai/image.png';

type Screen = 'title' | 'intro' | 'mode' | 'match' | 'pause' | 'results' | 'settings' | 'howto' | 'leaderboard';
type Strategy = 'ENGAGE' | 'EVADE & FLANK' | 'DEFEND & REPOSITION' | 'COUNTER';
type Difficulty = 'SENTINEL' | 'ADAPTIVE' | 'NIGHTMARE';
type Vec = { x: number; z: number };
type WeaponMode = 'blade' | 'pulse' | 'burst';
type Projectile = { id: number; owner: 'player' | 'ai'; x: number; z: number; vx: number; vz: number; life: number; damage: number; kind: WeaponMode };
type Winner = 'player' | 'ai' | 'draw';

type MatchStats = { dealt: number; received: number; adaptations: number; startedAt: number; observations: number };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);
const normalize = (x: number, z: number): Vec => { const length = Math.hypot(x, z) || 1; return { x: x / length, z: z / length }; };
const cover = [{ x: -6, z: -3, halfX: 1.1, halfZ: .45 }, { x: 6, z: -3, halfX: 1.1, halfZ: .45 }, { x: -6, z: 3, halfX: 1.1, halfZ: .45 }, { x: 6, z: 3, halfX: 1.1, halfZ: .45 }];
const isBlocked = (position: Vec) => cover.some((obstacle) => Math.abs(position.x - obstacle.x) < obstacle.halfX + .45 && Math.abs(position.z - obstacle.z) < obstacle.halfZ + .45);
const moveAroundCover = (from: Vec, next: Vec) => isBlocked(next) ? from : next;

let sharedAudioContext: AudioContext | null = null;

function playTone(kind: 'hit' | 'dash' | 'shoot' | 'adapt' | 'win' | 'menu') {
  if (typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    sharedAudioContext ??= new AudioContextClass();
    const context = sharedAudioContext;
    if (context.state === 'suspended') void context.resume();

    const presets = {
      hit: { start: 145, end: 58, duration: 0.13, wave: 'sawtooth' as OscillatorType, volume: 0.075 },
      dash: { start: 260, end: 720, duration: 0.16, wave: 'triangle' as OscillatorType, volume: 0.045 },
      shoot: { start: 680, end: 210, duration: 0.11, wave: 'square' as OscillatorType, volume: 0.035 },
      adapt: { start: 380, end: 940, duration: 0.24, wave: 'sine' as OscillatorType, volume: 0.04 },
      win: { start: 440, end: 880, duration: 0.42, wave: 'triangle' as OscillatorType, volume: 0.055 },
      menu: { start: 300, end: 470, duration: 0.09, wave: 'sine' as OscillatorType, volume: 0.025 },
    };
    const preset = presets[kind];
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = preset.wave;
    oscillator.frequency.setValueAtTime(preset.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, preset.end), now + preset.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(preset.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.025);
  } catch {
    // Audio is optional; a browser audio-policy restriction must not break gameplay.
  }
}

function NeonRing({ color, radius = 1, y = 0.03 }: { color: string; radius?: number; y?: number }) {
  return <mesh rotation-x={-Math.PI / 2} position-y={y}>
    <torusGeometry args={[radius, 0.035, 8, 48]} />
    <meshBasicMaterial color={color} toneMapped={false} />
  </mesh>;
}

function Arena() {
  const cover = [[-6, -3], [6, -3], [-6, 3], [6, 3]];
  return <group>
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[28, 18]} />
      <meshStandardMaterial color="#071322" metalness={0.82} roughness={0.38} />
    </mesh>
    <gridHelper args={[28, 28, '#12345a', '#091b32']} rotation-x={Math.PI / 2} position-y={0.02} />
    <NeonRing color="#16d9ff" radius={2.1} />
    <NeonRing color="#f32bd8" radius={1.62} y={0.04} />
    <mesh rotation-x={-Math.PI / 2} position-y={0.045}>
      <circleGeometry args={[0.38, 4]} />
      <meshBasicMaterial color="#a9efff" toneMapped={false} />
    </mesh>
    {cover.map(([x, z]) => <group key={`${x}-${z}`} position={[x, 0.6, z]}>
      <mesh castShadow receiveShadow><boxGeometry args={[2.2, 1.2, 0.9]} /><meshStandardMaterial color="#102944" metalness={0.85} roughness={0.28} /></mesh>
      <mesh position-y={0.63}><boxGeometry args={[1.75, 0.06, 0.96]} /><meshBasicMaterial color={x < 0 ? '#10bde9' : '#ee2ed2'} toneMapped={false} /></mesh>
    </group>)}
    {[[-13, 1, 0], [13, 1, 0], [0, 1, -8], [0, 1, 8]].map(([x, y, z], index) => <group key={index} position={[x, y, z]}>
      <mesh><boxGeometry args={x === 0 ? [28, 2, 0.4] : [0.4, 2, 18]} /><meshStandardMaterial color="#09182b" metalness={0.95} roughness={0.25} /></mesh>
      <mesh position={x === 0 ? [0, 0, z > 0 ? -0.24 : 0.24] : [x > 0 ? -0.24 : 0.24, 0, 0]}><boxGeometry args={x === 0 ? [26, 0.09, 0.05] : [0.05, 0.09, 16]} /><meshBasicMaterial color={index % 2 === 0 ? '#18d9ff' : '#e82ddd'} toneMapped={false} /></mesh>
    </group>)}
    <ambientLight intensity={0.45} color="#41638c" />
    <pointLight position={[-7, 4, -3]} color="#13cfff" intensity={18} distance={13} />
    <pointLight position={[7, 4, 3]} color="#f226d4" intensity={20} distance={13} />
    <pointLight position={[0, 5, 0]} color="#274e86" intensity={12} distance={15} />
  </group>;
}

function Fighter({ position, team, health, shield, attacking, dash }: { position: Vec; team: 'player' | 'ai'; health: number; shield: boolean; attacking: boolean; dash: boolean }) {
  const cyan = team === 'player';
  const primary = cyan ? '#12d8ff' : '#f12ad4';
  const dark = cyan ? '#10283b' : '#24102f';
  const trim = cyan ? '#78f0ff' : '#ff9aee';
  const group = useRef<Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const time = state.clock.elapsedTime;
    group.current.position.y = 0.05 + Math.sin(time * 3.1 + (cyan ? 0 : 1)) * 0.045;
    // Keep each fighter facing the other, with a slight angle toward the camera.
    const facing = cyan ? 0.72 : -0.72;
    group.current.rotation.y = facing + Math.sin(time * 1.5) * 0.025 + (attacking ? (cyan ? 0.18 : -0.18) : 0);
    const targetScale = dash ? 1.42 : attacking ? 1.34 : 1.3;
    group.current.scale.setScalar(targetScale);
  });

  const armor = <meshStandardMaterial color={dark} metalness={0.82} roughness={0.28} emissive={primary} emissiveIntensity={0.12} />;
  const glow = <meshBasicMaterial color={primary} toneMapped={false} />;
  return <group ref={group} position={[position.x, 0, position.z]} scale={1.3}>
    {shield && <mesh position-y={1.15}><sphereGeometry args={[1.22, 24, 16]} /><meshBasicMaterial color={primary} transparent opacity={0.13} wireframe /></mesh>}

    {/* Boots and segmented legs */}
    {[-0.3, 0.3].map((x, i) => <group key={`leg-${i}`} position={[x, 0.46, 0]}>
      <mesh castShadow position-y={0.2}><capsuleGeometry args={[0.16, 0.45, 5, 8]} />{armor}</mesh>
      <mesh castShadow position={[0, -0.08, 0.13]}><boxGeometry args={[0.34, 0.2, 0.48]} />{armor}</mesh>
      <mesh position={[0, 0.43, 0.12]}><boxGeometry args={[0.23, 0.08, 0.05]} />{glow}</mesh>
    </group>)}

    {/* Waist, chest armour and luminous reactor */}
    <mesh castShadow position-y={0.98}><cylinderGeometry args={[0.31, 0.36, 0.28, 6]} />{armor}</mesh>
    <mesh castShadow position-y={1.43}><capsuleGeometry args={[0.4, 0.47, 5, 8]} />{armor}</mesh>
    <mesh castShadow position={[0, 1.48, 0.34]} rotation-x={-0.12}><boxGeometry args={[0.48, 0.34, 0.12]} />{glow}</mesh>
    <mesh position={[0, 1.46, 0.415]}><circleGeometry args={[0.09, 6]} /><meshBasicMaterial color={trim} toneMapped={false} /></mesh>
    <mesh position={[0, 1.12, 0.31]}><boxGeometry args={[0.27, 0.07, 0.08]} />{glow}</mesh>
    <mesh position={[0, 1.78, 0]}><cylinderGeometry args={[0.19, 0.23, 0.16, 6]} />{armor}</mesh>

    {/* Shoulder plates, articulated arms and forearm guards */}
    {[-1, 1].map((side) => <group key={`arm-${side}`} position={[side * 0.52, 1.55, 0]} rotation-z={side * (attacking ? -0.28 : 0.1)}>
      <mesh castShadow position-y={-0.02}><icosahedronGeometry args={[0.26, 1]} />{armor}</mesh>
      <mesh position={[0, -0.04, 0.19]}><boxGeometry args={[0.24, 0.12, 0.06]} />{glow}</mesh>
      <mesh castShadow position={[side * 0.02, -0.36, 0]} rotation-z={-side * 0.05}><capsuleGeometry args={[0.13, 0.42, 5, 8]} />{armor}</mesh>
      <mesh castShadow position={[side * 0.02, -0.64, 0.08]} rotation-z={-side * 0.08}><boxGeometry args={[0.23, 0.3, 0.27]} />{armor}</mesh>
      <mesh position={[side * 0.02, -0.64, 0.225]}><boxGeometry args={[0.15, 0.07, 0.025]} />{glow}</mesh>
      <mesh castShadow position={[side * 0.02, -0.82, 0.1]}><sphereGeometry args={[0.13, 8, 8]} />{armor}</mesh>
    </group>)}

    {/* Distinct helmet silhouettes: human operative visor vs AI crown */}
    <mesh castShadow position-y={2.05}><sphereGeometry args={[0.31, 12, 10]} />{armor}</mesh>
    <mesh position={[0, 2.06, 0.255]}><boxGeometry args={[0.43, 0.13, 0.1]} />{glow}</mesh>
    <mesh position={[0, 1.87, 0.18]}><boxGeometry args={[0.25, 0.07, 0.08]} />{armor}</mesh>
    {cyan ? <>
      <mesh castShadow position={[-0.22, 2.13, 0]} rotation-z={-0.22}><boxGeometry args={[0.09, 0.27, 0.3]} />{armor}</mesh>
      <mesh castShadow position={[0.22, 2.13, 0]} rotation-z={0.22}><boxGeometry args={[0.09, 0.27, 0.3]} />{armor}</mesh>
      <mesh position={[0, 2.34, -0.02]} rotation-z={0.12}><boxGeometry args={[0.12, 0.19, 0.12]} />{glow}</mesh>
    </> : <>
      <mesh castShadow position={[-0.22, 2.28, 0]} rotation-z={-0.42}><coneGeometry args={[0.12, 0.34, 5]} />{armor}</mesh>
      <mesh castShadow position={[0.22, 2.28, 0]} rotation-z={0.42}><coneGeometry args={[0.12, 0.34, 5]} />{armor}</mesh>
      <mesh position={[0, 2.08, 0.31]}><boxGeometry args={[0.16, 0.045, 0.04]} />{glow}</mesh>
    </>}

    {/* Wrist-mounted energy blade */}
    <group position={[0.72, 0.9, 0.16]} rotation-z={-0.25}>
      <mesh position-y={0.12}><boxGeometry args={[0.09, 0.22, 0.09]} />{armor}</mesh>
      <mesh position-y={0.48}><boxGeometry args={[0.055, 0.58, 0.055]} />{glow}</mesh>
      <mesh position-y={0.2}><boxGeometry args={[0.2, 0.055, 0.07]} />{glow}</mesh>
    </group>

    {attacking && <pointLight position={[0, 1.3, 0.4]} color={primary} intensity={5} distance={3.2} />}
    {dash && <pointLight position={[0, 0.8, -0.3]} color={primary} intensity={8} distance={4} />}
    <mesh position-y={2.68}><boxGeometry args={[1.05, 0.07, 0.04]} /><meshBasicMaterial color="#07101d" /></mesh>
    <mesh position={[-(1.05 - clamp(health, 0, 100) / 100 * 1.05) / 2, 2.68, 0.03]}><boxGeometry args={[Math.max(0.001, clamp(health, 0, 100) / 100 * 1.05), 0.04, 0.02]} /><meshBasicMaterial color={primary} toneMapped={false} /></mesh>
  </group>;
}

function ProjectileMesh({ projectile }: { projectile: Projectile }) {
  const color = projectile.owner === 'player' ? '#22ddff' : '#ff32d7';
  const size = projectile.kind === 'blade' ? .24 : projectile.kind === 'burst' ? .2 : .15;
  return <group position={[projectile.x, 1.15, projectile.z]}>
    <mesh rotation-z={Math.PI / 2}><sphereGeometry args={[size, 10, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    <pointLight color={color} intensity={3} distance={2} />
  </group>;
}

function Scene({ player, ai, health, projectiles, attacking, aiAttacking, shield, dash, reducedFx }: { player: Vec; ai: Vec; health: { player: number; ai: number }; projectiles: Projectile[]; attacking: boolean; aiAttacking: boolean; shield: boolean; dash: boolean; reducedFx: boolean }) {
  return <Canvas shadows camera={{ position: [0, 15, 14], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
    <color attach="background" args={['#030711']} />
    <fog attach="fog" args={['#030711', 18, 40]} />
    <Arena />
    <Fighter position={player} team="player" health={health.player} shield={shield} attacking={attacking} dash={dash} />
    <Fighter position={ai} team="ai" health={health.ai} shield={false} attacking={aiAttacking} dash={false} />
    {projectiles.map((projectile) => <ProjectileMesh projectile={projectile} key={projectile.id} />)}
    {!reducedFx && <EffectComposer><Bloom luminanceThreshold={0.3} intensity={1.15} mipmapBlur /></EffectComposer>}
    <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
  </Canvas>;
}

function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [difficulty, setDifficulty] = useState<Difficulty>('ADAPTIVE');
  const [weapon, setWeapon] = useState<WeaponMode>('pulse');
  const [winner, setWinner] = useState<Winner | null>(null);
  const [reducedFx, setReducedFx] = useState(false);
  const [sound, setSound] = useState(true);
  const [player, setPlayer] = useState<Vec>({ x: -7, z: 0 });
  const [ai, setAi] = useState<Vec>({ x: 7, z: 0 });
  const [health, setHealth] = useState({ player: 100, ai: 100 });
  const [energy, setEnergy] = useState({ player: 100, ai: 100 });
  const [projectiles, setProjectiles] = useState<Projectile[]>([]);
  const [strategy, setStrategy] = useState<Strategy>('ENGAGE');
  const [decision, setDecision] = useState('Closing distance to test your response.');
  const [observations, setObservations] = useState(0);
  const [confidence, setConfidence] = useState(22);
  const [adaptations, setAdaptations] = useState(0);
  const [timer, setTimer] = useState(0);
  const [stats, setStats] = useState<MatchStats>({ dealt: 0, received: 0, adaptations: 0, startedAt: 0, observations: 0 });
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [attacking, setAttacking] = useState(false);
  const [aiAttacking, setAiAttacking] = useState(false);
  const [shield, setShield] = useState(false);
  const [dash, setDash] = useState(false);
  const [cooldowns, setCooldowns] = useState({ shot: 0, dash: 0, special: 0, aiShot: 0 });
  const [lastMove, setLastMove] = useState<'left' | 'right' | 'forward' | 'back'>('forward');
  const [lowHealth, setLowHealth] = useState(false);
  const mouseDown = useRef(false);
  const ended = useRef(false);
  const nextProjectile = useRef(1);
  const statsRef = useRef(stats);
  const behaviorRef = useRef({ shots: 0, leftDodges: 0, rightDodges: 0, stationary: 0, rushes: 0 });
  const keysRef = useRef(keys);
  const lastTime = useRef(0);
  const screenRef = useRef(screen);
  useEffect(() => { keysRef.current = keys; }, [keys]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

  const startMatch = useCallback(() => {
    setScreen('match'); setWinner(null); ended.current = false; setPlayer({ x: -7, z: 0 }); setAi({ x: 7, z: 0 }); setHealth({ player: 100, ai: 100 }); setEnergy({ player: 100, ai: 100 }); setProjectiles([]); setWeapon('pulse'); setStrategy('ENGAGE'); setDecision('Closing distance to test your response.'); setObservations(0); setConfidence(22); setAdaptations(0); setTimer(90); setStats({ dealt: 0, received: 0, adaptations: 0, startedAt: Date.now(), observations: 0 }); setCooldowns({ shot: 0, dash: 0, special: 0, aiShot: 0 }); behaviorRef.current = { shots: 0, leftDodges: 0, rightDodges: 0, stationary: 0, rushes: 0 }; if (sound) playTone('menu');
  }, [sound]);

  const finishMatch = useCallback((result: Winner) => { if (ended.current) return; ended.current = true; setWinner(result); setScreen('results'); setDecision(result === 'player' ? 'You broke the prediction loop. Neuro is recalibrating.' : result === 'ai' ? 'Neuro found a reliable opening and completed the adaptation.' : 'The clock expired before either mind could claim the arena.'); if (sound) playTone(result === 'player' ? 'win' : 'hit'); }, [sound]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { const key = event.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault(); setKeys((current) => ({ ...current, [key]: true })); if (key === '1') setWeapon('blade'); if (key === '2') setWeapon('pulse'); if (key === '3') setWeapon('burst'); if ((key === 'escape' || key === 'p') && screenRef.current === 'match') setScreen('pause'); };
    const onKeyUp = (event: KeyboardEvent) => setKeys((current) => ({ ...current, [event.key.toLowerCase()]: false }));
    const onMouseDown = (event: MouseEvent) => { if (event.button === 0) mouseDown.current = true; };
    const onMouseUp = (event: MouseEvent) => { if (event.button === 0) mouseDown.current = false; };
    window.addEventListener('keydown', onKeyDown); window.addEventListener('keyup', onKeyUp); window.addEventListener('mousedown', onMouseDown); window.addEventListener('mouseup', onMouseUp); return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('mousedown', onMouseDown); window.removeEventListener('mouseup', onMouseUp); };
  }, []);

  useEffect(() => {
    if (screen !== 'match') return;
    let frame = 0;
    const loop = (time: number) => {
      const delta = Math.min((time - (lastTime.current || time)) / 1000, 0.04); lastTime.current = time;
      setTimer((current) => { const next = Math.max(0, current - delta); if (next === 0) finishMatch(health.player === health.ai ? 'draw' : health.player > health.ai ? 'player' : 'ai'); return next; });
      setCooldowns((current) => ({ shot: Math.max(0, current.shot - delta), dash: Math.max(0, current.dash - delta), special: Math.max(0, current.special - delta), aiShot: Math.max(0, current.aiShot - delta) }));
      const currentKeys = keysRef.current;
      const dx = (currentKeys.d || currentKeys.arrowright ? 1 : 0) - (currentKeys.a || currentKeys.arrowleft ? 1 : 0); const dz = (currentKeys.s || currentKeys.arrowdown ? 1 : 0) - (currentKeys.w || currentKeys.arrowup ? 1 : 0);
      const moving = dx !== 0 || dz !== 0; const moveDir = normalize(dx, dz); const sprint = currentKeys.shift && energy.player > 0; const speed = sprint ? 7.2 : 4.8;
      if (moving) setPlayer((current) => moveAroundCover(current, { x: clamp(current.x + moveDir.x * speed * delta, -11.5, 11.5), z: clamp(current.z + moveDir.z * speed * delta, -6.5, 6.5) }));
      if (currentKeys.shift && cooldowns.dash <= 0 && moving) { setDash(true); setCooldowns((current) => ({ ...current, dash: 2.3 })); setPlayer((current) => ({ x: clamp(current.x + moveDir.x * 2.1, -11.5, 11.5), z: clamp(current.z + moveDir.z * 2.1, -6.5, 6.5) })); behaviorRef.current[moveDir.x < 0 ? 'leftDodges' : 'rightDodges'] += 1; if (sound) playTone('dash'); setTimeout(() => setDash(false), 160); }
      if (moving) setLastMove(Math.abs(moveDir.x) > Math.abs(moveDir.z) ? (moveDir.x > 0 ? 'right' : 'left') : (moveDir.z > 0 ? 'back' : 'forward'));
      if (sprint) setEnergy((current) => ({ ...current, player: Math.max(0, current.player - delta * 18) })); else setEnergy((current) => ({ ...current, player: Math.min(100, current.player + delta * 8) }));
      if (currentKeys.q && cooldowns.special <= 0) { setShield(true); setCooldowns((current) => ({ ...current, special: 7 })); setEnergy((current) => ({ ...current, player: Math.max(0, current.player - 28) })); setTimeout(() => setShield(false), 1400); if (sound) playTone('adapt'); }
      if ((currentKeys.e || currentKeys[' '] || mouseDown.current) && cooldowns.shot <= 0) { const weaponStats = { blade: { cooldown: .72, damage: 18, speed: 15, life: .48 }, pulse: { cooldown: .48, damage: 8, speed: 12, life: 1.8 }, burst: { cooldown: 1.05, damage: 5, speed: 11, life: 1.6 } }[weapon]; setCooldowns((current) => ({ ...current, shot: weaponStats.cooldown })); behaviorRef.current.shots += 1; const direction = normalize(ai.x - player.x, ai.z - player.z); const offsets = weapon === 'burst' ? [-.13, 0, .13] : [0]; setProjectiles((current) => [...current, ...offsets.map((offset) => ({ id: nextProjectile.current++, owner: 'player' as const, x: player.x, z: player.z, vx: (direction.x - direction.z * offset) * weaponStats.speed, vz: (direction.z + direction.x * offset) * weaponStats.speed, life: weaponStats.life, damage: weaponStats.damage, kind: weapon }))]); setAttacking(true); setTimeout(() => setAttacking(false), weapon === 'blade' ? 220 : 130); if (sound) playTone(weapon === 'blade' ? 'dash' : 'shoot'); }
      setAi((current) => {
        const toPlayer = normalize(player.x - current.x, player.z - current.z); const strafe = Math.sin(time / 850) > 0 ? 1 : -1; let vx = toPlayer.x; let vz = toPlayer.z;
        if (strategy === 'EVADE & FLANK' || strategy === 'COUNTER') { vx = toPlayer.x * 0.25 + -toPlayer.z * strafe * 0.95; vz = toPlayer.z * 0.25 + toPlayer.x * strafe * 0.95; }
        if (strategy === 'DEFEND & REPOSITION') { vx = -toPlayer.x; vz = -toPlayer.z; }
        const aiSpeed = difficulty === 'NIGHTMARE' ? 3.6 : difficulty === 'SENTINEL' ? 2.3 : 2.9;
        return moveAroundCover(current, { x: clamp(current.x + vx * aiSpeed * delta, -11.5, 11.5), z: clamp(current.z + vz * aiSpeed * delta, -6.5, 6.5) });
      });
      if (cooldowns.aiShot <= 0 && distance(ai, player) < 8.8 && Math.random() < delta * (difficulty === 'NIGHTMARE' ? 1.8 : 1.1)) { const direction = normalize(player.x - ai.x, player.z - ai.z); setProjectiles((current) => [...current, { id: nextProjectile.current++, owner: 'ai', x: ai.x, z: ai.z, vx: direction.x * 9, vz: direction.z * 9, life: 2, damage: 7, kind: 'pulse' }]); setCooldowns((current) => ({ ...current, aiShot: difficulty === 'SENTINEL' ? 1.9 : 1.35 })); setAiAttacking(true); setTimeout(() => setAiAttacking(false), 170); if (sound) playTone('shoot'); }
      setProjectiles((current) => current.map((shot) => ({ ...shot, x: shot.x + shot.vx * delta, z: shot.z + shot.vz * delta, life: shot.life - delta })).filter((shot) => shot.life > 0 && Math.abs(shot.x) < 13 && Math.abs(shot.z) < 8));
      setProjectiles((current) => { const hits = current.filter((shot) => shot.owner === 'player' && distance(shot, ai) < 0.9 || shot.owner === 'ai' && distance(shot, player) < 0.9); if (hits.length) { hits.forEach((shot) => { if (shot.owner === 'player') { setHealth((value) => ({ ...value, ai: Math.max(0, value.ai - shot.damage) })); setStats((value) => ({ ...value, dealt: value.dealt + shot.damage })); } else if (!shield) { setHealth((value) => ({ ...value, player: Math.max(0, value.player - shot.damage) })); setStats((value) => ({ ...value, received: value.received + shot.damage })); } if (sound) playTone('hit'); }); } return current.filter((shot) => !hits.some((hit) => hit.id === shot.id)); });
      setObservations((value) => value + (moving ? 0.018 : 0.01));
      if (moving && Math.random() < delta * 0.7) behaviorRef.current.stationary = Math.max(0, behaviorRef.current.stationary - 1); else behaviorRef.current.stationary += 0.02;
      if (Math.random() < delta * 0.28) { const b = behaviorRef.current; const next: Strategy = b.shots > 7 && (b.leftDodges + b.rightDodges) > 3 ? 'COUNTER' : health.player < 38 ? 'DEFEND & REPOSITION' : b.shots > 4 ? 'EVADE & FLANK' : 'ENGAGE'; if (next !== strategy) { setStrategy(next); setAdaptations((value) => value + 1); setDecision(next === 'COUNTER' ? `Repeated ${lastMove} movement detected — shifting attack angle.` : next === 'EVADE & FLANK' ? 'Ranged pressure detected — flanking through the open lane.' : next === 'DEFEND & REPOSITION' ? 'Your health is creating danger — forcing a reset.' : 'Testing your guard with measured forward pressure.'); setConfidence((value) => clamp(value + 7, 22, 94)); if (sound) playTone('adapt'); } setStats((value) => ({ ...value, observations: Math.round(observations), adaptations })); }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, [screen, ai, player, cooldowns, strategy, difficulty, health.player, health.ai, energy.player, shield, sound, observations, adaptations, lastMove, weapon, finishMatch]);

  useEffect(() => { setLowHealth(health.player < 30); if (health.player <= 0) finishMatch('ai'); else if (health.ai <= 0) finishMatch('player'); }, [health, finishMatch]);

  const topTendency = behaviorRef.current.shots > 5 ? 'Long-range pressure' : behaviorRef.current.leftDodges > behaviorRef.current.rightDodges ? 'Left dodge bias' : behaviorRef.current.rightDodges > 2 ? 'Right dodge bias' : 'Collecting evidence';
  const matchDuration = Math.floor(timer);
  const elapsed = Math.max(0, 90 - matchDuration);
  const launchFromTitle = () => { setScreen('intro'); if (sound) playTone('menu'); };
  const handleSettingsKey = (event: ReactKeyboardEvent<HTMLSelectElement>) => { if (event.key === 'Enter') event.currentTarget.blur(); };

  if (screen === 'title') return <main className="app-shell title-shell"><div className="title-bg" /><div className="title-copy"><div className="eyebrow"><span className="signal-dot" /> TACTICAL COMBAT SIMULATION // 01</div><h1>NEURO<span>CLASH</span><em>AI</em></h1><p className="tagline">YOU MAKE THE MOVE. <strong>IT LEARNS THE PATTERN.</strong></p><p className="title-description">A one-on-one adaptive combat experiment where every dodge, shot, and pause becomes part of the opponent's memory.</p><button className="primary-button" onClick={launchFromTitle}><Play size={16} fill="currentColor" /> Initiate match</button><div className="title-links"><button onClick={() => setScreen('howto')}><HelpCircle size={14} /> How to play</button><button onClick={() => setScreen('settings')}><Settings size={14} /> Settings</button></div></div><div className="title-art"><div className="art-card cyan-art"><img src={playerReference} alt="Human fighter concept art" /><span>YOU // HUMAN FIGHTER</span></div><div className="art-card magenta-art"><img src={aiReference} alt="Neuro opponent concept art" /><span>NEURO // AI OPPONENT</span></div></div><div className="title-footer"><span>OBSERVE</span><span>ANALYZE</span><span>ADAPT</span><span>DEFEAT</span><small>BUILD 01.06 // NO NETWORK REQUIRED</small></div></main>;

  if (screen === 'intro') return <main className="app-shell intro-shell"><div className="intro-grid" /><div className="intro-copy"><span className="eyebrow">MATCH PROTOCOL // ADAPTIVE ARENA</span><h2>Two minds.<br /><span>One pattern.</span></h2><p>Neuro does not cheat. It watches what you do, stores the evidence, and changes its strategy when you become predictable.</p><div className="vs-row"><div><b>YOU</b><small>CYAN OPERATIVE</small></div><span>VS</span><div><b>NEURO</b><small>ADAPTIVE COMBAT AI</small></div></div><button className="primary-button" onClick={() => setScreen('mode')}>Choose combat mode <Crosshair size={16} /></button></div></main>;

  if (screen === 'mode') return <main className="app-shell modal-shell"><div className="modal-card mode-card"><span className="eyebrow">MISSION SELECT // LOCAL SIMULATION</span><h2>Choose your<br /><span>combat mode.</span></h2><div className="mode-options"><button className={difficulty === 'SENTINEL' ? 'mode-option selected' : 'mode-option'} onClick={() => setDifficulty('SENTINEL')}><b>SENTINEL</b><small>Slower reactions. Learn the arena.</small></button><button className={difficulty === 'ADAPTIVE' ? 'mode-option selected' : 'mode-option'} onClick={() => setDifficulty('ADAPTIVE')}><b>ADAPTIVE</b><small>Balanced tactical opponent.</small></button><button className={difficulty === 'NIGHTMARE' ? 'mode-option selected' : 'mode-option'} onClick={() => setDifficulty('NIGHTMARE')}><b>NIGHTMARE</b><small>Fast reactions. No wasted openings.</small></button></div><button className="primary-button" onClick={startMatch}>Start 90-second round <Play size={16} fill="currentColor" /></button><button className="text-button" onClick={() => setScreen('title')}>Back to main menu</button></div></main>;

  if (screen === 'settings' || screen === 'howto') return <main className="app-shell modal-shell"><div className="modal-card"><button className="icon-button close-button" onClick={() => setScreen('title')}><X size={18} /></button>{screen === 'settings' ? <><span className="eyebrow">SYSTEM CONFIGURATION</span><h2>Settings</h2><div className="settings-list"><label>AI difficulty<select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} onKeyDown={handleSettingsKey}><option value="SENTINEL">Sentinel — forgiving</option><option value="ADAPTIVE">Adaptive — recommended</option><option value="NIGHTMARE">Nightmare — relentless</option></select></label><label>Reduced visual effects<button className={`toggle ${reducedFx ? 'on' : ''}`} onClick={() => setReducedFx((value) => !value)}>{reducedFx ? 'ON' : 'OFF'}</button></label><label>Combat audio<button className={`toggle ${sound ? 'on' : ''}`} onClick={() => setSound((value) => !value)}>{sound ? 'ON' : 'OFF'}</button></label></div><button className="secondary-button" onClick={() => setScreen('title')}>Save configuration</button></> : <><span className="eyebrow">FIELD MANUAL // QUICK START</span><h2>How to play</h2><div className="control-grid"><div><kbd>W A S D</kbd><span>Move around the arena</span></div><div><kbd>E / SPACE</kbd><span>Fire selected weapon</span></div><div><kbd>SHIFT</kbd><span>Sprint and dash while moving</span></div><div><kbd>Q</kbd><span>Activate phase shield</span></div><div><kbd>1 / 2 / 3</kbd><span>Switch weapons</span></div><div><kbd>ESC / P</kbd><span>Pause the match</span></div></div><p className="tip"><Sparkles size={16} /> Vary your movement and attack rhythm. Repeated habits become signals that Neuro can exploit.</p><button className="secondary-button" onClick={() => setScreen('title')}>Return to title</button></>}</div></main>;

  if (screen === 'results') return <main className="app-shell result-shell"><div className={`result-card ${winner === 'player' ? 'victory' : winner === 'draw' ? 'draw' : 'defeat'}`}><span className="eyebrow">MATCH COMPLETE // {elapsed}s</span><h2>{winner === 'player' ? 'VICTORY' : winner === 'draw' ? 'DRAW' : 'DEFEAT'}</h2><p>{decision}</p><div className="result-stats"><span><b>{stats.dealt}</b>Damage dealt</span><span><b>{stats.received}</b>Damage received</span><span><b>{adaptations}</b>Adaptations</span></div><div className="result-actions"><button className="primary-button" onClick={startMatch}><RotateCcw size={16} /> Rematch</button><button className="secondary-button" onClick={() => setScreen('title')}>Main menu</button></div></div></main>;

  return <main className={`app-shell match-shell ${lowHealth ? 'critical' : ''}`}><div className="match-canvas"><Scene player={player} ai={ai} health={health} projectiles={projectiles} attacking={attacking} aiAttacking={aiAttacking} shield={shield} dash={dash} reducedFx={reducedFx} /></div><header className="match-header"><div className="fighter-hud player-hud"><div className="hud-id"><span className="hud-icon cyan-icon"><Zap size={16} /></span><span><b>YOU</b><small>CYAN OPERATIVE</small></span></div><div className="health-track"><i style={{ width: `${health.player}%` }} /></div><div className="hud-values"><span>HP {Math.round(health.player)} / 100</span><span>ENERGY {Math.round(energy.player)}%</span></div></div><div className="match-clock"><span>ROUND 01</span><strong>{String(Math.floor(matchDuration / 60)).padStart(2, '0')}:{String(matchDuration % 60).padStart(2, '0')}</strong><small>NEUROCLASH PROTOCOL</small></div><div className="fighter-hud ai-hud"><div className="hud-id"><span><b>NEURO</b><small>ADAPTIVE AGENT</small></span><span className="hud-icon magenta-icon"><Target size={16} /></span></div><div className="health-track"><i style={{ width: `${health.ai}%` }} /></div><div className="hud-values"><span>HP {Math.round(health.ai)} / 100</span><span>THREAT ACTIVE</span></div></div></header><aside className="ai-dashboard"><div className="dash-heading"><span><Gauge size={15} /> AI ANALYSIS</span><span className="live-dot">LIVE</span></div><div className="strategy-label">CURRENT STRATEGY</div><h3>{strategy}</h3><p className="decision"><Sparkles size={14} /> {decision}</p><div className="confidence-row"><span>CONFIDENCE</span><b>{confidence}%</b></div><div className="confidence-track"><i style={{ width: `${confidence}%` }} /></div><div className="dash-data"><span><b>{Math.round(observations)}</b> observations</span><span><b>{topTendency}</b> tendency</span></div><div className="adaptation-count"><span>ADAPTATIONS</span><b>{adaptations}</b></div></aside><aside className="tactical-feed"><div className="feed-title"><span><Crosshair size={14} /> TACTICAL FEED</span><small>LIVE TRACE</small></div><div className="feed-visual"><div className="feed-grid" /><span className="feed-player" /><span className="feed-ai" /><i className="feed-line" /></div><div className="feed-row"><span>PLAYER VECTOR</span><b>{lastMove.toUpperCase()}</b></div><div className="feed-row"><span>NEURO RESPONSE</span><b>{strategy === 'COUNTER' ? 'ANGLE SHIFT' : strategy === 'EVADE & FLANK' ? 'FLANKING' : strategy === 'DEFEND & REPOSITION' ? 'RESETTING' : 'PRESSING'}</b></div><div className="feed-note">{adaptations > 0 ? `Memory updated ${adaptations} time${adaptations === 1 ? '' : 's'}.` : 'Collecting movement and attack evidence.'}</div></aside><div className="minimap"><div className="minimap-grid" /><span className="mini-player" style={{ left: `${((player.x + 12) / 24) * 100}%`, top: `${((player.z + 7) / 14) * 100}%` }} /><span className="mini-ai" style={{ left: `${((ai.x + 12) / 24) * 100}%`, top: `${((ai.z + 7) / 14) * 100}%` }} /><small>TACTICAL MAP</small></div><div className="combat-tools"><div className={`tool ${weapon === 'blade' ? 'active-tool' : ''}`}><span className="tool-key">1</span><span>ENERGY BLADE</span><i className={weapon === 'blade' && cooldowns.shot <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.shot / .72 * 100)}%` }} /></div><div className={`tool ${weapon === 'pulse' ? 'active-tool' : ''}`}><span className="tool-key">2</span><span>PULSE SHOT</span><i className={weapon === 'pulse' && cooldowns.shot <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.shot / .48 * 100)}%` }} /></div><div className={`tool ${weapon === 'burst' ? 'active-tool' : ''}`}><span className="tool-key">3</span><span>BURST SHOT</span><i className={weapon === 'burst' && cooldowns.shot <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.shot / 1.05 * 100)}%` }} /></div><div className="tool"><span className="tool-key">SHIFT</span><span>DODGE</span><i className={cooldowns.dash <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.dash / 2.3 * 100)}%` }} /></div></div><div className="match-tip">{shield ? 'PHASE SHIELD ACTIVE' : `1/2/3 switch weapons • Space or click fire • Q shield • ${weapon.toUpperCase()} selected`}</div><button className="pause-button" onClick={() => setScreen('pause')}><Pause size={16} /> Pause</button>{screen === 'pause' && <div className="pause-overlay"><div className="pause-card"><span className="eyebrow">SYSTEM HOLD</span><h2>Match paused</h2><p>The arena is frozen. Neuro is waiting for your next decision.</p><button className="primary-button" onClick={() => setScreen('match')}><Play size={16} /> Resume</button><button className="secondary-button" onClick={startMatch}>Restart match</button><button className="text-button" onClick={() => setScreen('title')}>Return to main menu</button></div></div>}</main>;
}

export default App;
