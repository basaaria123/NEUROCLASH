import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { Crosshair, Gauge, HelpCircle, Pause, Play, RotateCcw, Settings, Sparkles, Target, X, Zap } from 'lucide-react';
import './index.css';
import { PlayerCharacter } from './components/PlayerCharacter';
import { AiCharacter } from './components/AiCharacter';

// Role 2 Adaptive AI Agent Integration (AI_INTEGRATION.md)
import { NeuroClashAgent } from './agent/NeuroClashAgent';
import { isValidDecision } from './agent/ActionExecutor';
import type {
  AgentDecision,
  BehaviorProfile,
  GameState,
  PlayerActionType,
  PlayerEvent,
  TacticalMode,
} from './agent/types';

type Screen = 'title' | 'intro' | 'mode' | 'match' | 'pause' | 'results' | 'settings' | 'howto' | 'demo';
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

// Coordinate mapping between 3D Arena [-12..12, -7..7] and top-down AI Agent space
const toAgentPos = (p: Vec) => ({ x: 200 + p.x * 15, y: 200 + p.z * 15 });
const toAgentDist = (d: number) => d * 15;
const fromAgentPos = (p: { x: number; y: number }): Vec => ({ x: (p.x - 200) / 15, z: (p.y - 200) / 15 });

let sharedAudioContext: AudioContext | null = null;

export type SfxKind =
  | 'player_blade'
  | 'player_pulse'
  | 'player_burst'
  | 'ai_shoot'
  | 'hit'
  | 'dash'
  | 'shield'
  | 'weapon_switch'
  | 'adapt'
  | 'win'
  | 'defeat'
  | 'menu';

function playTone(kind: SfxKind, isSoundEnabled = true) {
  if (!isSoundEnabled || typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    sharedAudioContext ??= new AudioContextClass();
    const context = sharedAudioContext;
    if (context.state === 'suspended') void context.resume();

    const now = context.currentTime;

    if (kind === 'shield') {
      // Harmonic forcefield barrier hum
      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      const gain = context.createGain();
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.exponentialRampToValueAtTime(560, now + 0.22);
      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.22);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.065, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(context.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
      return;
    }

    if (kind === 'defeat') {
      // Descending power-down drone
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.52);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.58);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.6);
      return;
    }

    if (kind === 'adapt') {
      // Ascending neural reconfiguration chime
      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      const gain = context.createGain();
      osc1.type = 'sine';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(340, now);
      osc1.frequency.exponentialRampToValueAtTime(760, now + 0.12);
      osc1.frequency.exponentialRampToValueAtTime(1180, now + 0.25);
      osc2.frequency.setValueAtTime(170, now);
      osc2.frequency.exponentialRampToValueAtTime(590, now + 0.25);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(context.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.3);
      osc2.stop(now + 0.3);
      return;
    }

    const presets: Record<string, { start: number; end: number; duration: number; wave: OscillatorType; volume: number }> = {
      player_blade: { start: 540, end: 120, duration: 0.13, wave: 'sawtooth', volume: 0.05 },
      player_pulse: { start: 720, end: 240, duration: 0.10, wave: 'square', volume: 0.035 },
      player_burst: { start: 860, end: 320, duration: 0.08, wave: 'triangle', volume: 0.04 },
      ai_shoot: { start: 240, end: 110, duration: 0.14, wave: 'sawtooth', volume: 0.045 },
      hit: { start: 145, end: 52, duration: 0.13, wave: 'sawtooth', volume: 0.075 },
      dash: { start: 260, end: 720, duration: 0.16, wave: 'triangle', volume: 0.045 },
      weapon_switch: { start: 620, end: 980, duration: 0.07, wave: 'sine', volume: 0.03 },
      win: { start: 440, end: 880, duration: 0.42, wave: 'triangle', volume: 0.055 },
      menu: { start: 300, end: 470, duration: 0.08, wave: 'sine', volume: 0.025 },
    };

    const preset = presets[kind] ?? presets.menu;
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
  const coverPoints = [[-6, -3], [6, -3], [-6, 3], [6, 3]];
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
    {coverPoints.map(([x, z]) => <group key={`${x}-${z}`} position={[x, 0.6, z]}>
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

function ProjectileMesh({ projectile }: { projectile: Projectile }) {
  const color = projectile.owner === 'player' ? '#22ddff' : '#ff32d7';
  const size = projectile.kind === 'blade' ? .24 : projectile.kind === 'burst' ? .2 : .15;
  return <group position={[projectile.x, 1.15, projectile.z]}>
    <mesh rotation-z={Math.PI / 2}><sphereGeometry args={[size, 10, 8]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
    <pointLight color={color} intensity={3} distance={2} />
  </group>;
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Canvas error caught by CanvasErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#030711',
          color: '#14d8ff',
          zIndex: 10,
        }}>
          <h3 style={{ margin: 0, letterSpacing: '2px' }}>NEUROCLASH ARENA SUBSYSTEM RECOVERING</h3>
          <p style={{ margin: 0, color: '#8899aa', fontSize: '13px' }}>WebGL canvas state recovered.</p>
          <button
            className="primary-button"
            onClick={() => this.setState({ hasError: false })}
          >
            RE-ENGAGE COMBAT
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Scene({
  player,
  ai,
  health,
  projectiles,
  attacking,
  aiAttacking,
  shield,
  dash,
  weapon,
  tactic,
  playerMoving,
  aiMoving,
  reducedFx,
}: {
  player: Vec;
  ai: Vec;
  health: { player: number; ai: number };
  projectiles: Projectile[];
  attacking: boolean;
  aiAttacking: boolean;
  shield: boolean;
  dash: boolean;
  weapon: WeaponMode;
  tactic: TacticalMode;
  playerMoving: boolean;
  aiMoving: boolean;
  reducedFx: boolean;
}) {
  return <Canvas shadows camera={{ position: [0, 15, 14], fov: 42 }} dpr={[1, 1.5]} gl={{ antialias: true }}>
    <color attach="background" args={['#030711']} />
    <fog attach="fog" args={['#030711', 18, 40]} />
    <Arena />
    <PlayerCharacter
      position={player ?? { x: -7, z: 0 }}
      targetPosition={ai ?? { x: 7, z: 0 }}
      health={health?.player ?? 100}
      shield={Boolean(shield)}
      attacking={Boolean(attacking)}
      dash={Boolean(dash)}
      weapon={weapon || 'pulse'}
      moving={Boolean(playerMoving)}
    />
    <AiCharacter
      position={ai ?? { x: 7, z: 0 }}
      targetPosition={player ?? { x: -7, z: 0 }}
      health={health?.ai ?? 100}
      attacking={Boolean(aiAttacking)}
      tactic={tactic || 'ENGAGE'}
      moving={Boolean(aiMoving)}
    />
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

  // Role 2 Agent Real Outputs state
  const agentRef = useRef<NeuroClashAgent>(new NeuroClashAgent());
  const [agentDecision, setAgentDecision] = useState<AgentDecision>({
    tactic: 'ENGAGE',
    targetPosition: { x: 200, y: 200 },
    shouldAttack: false,
    reason: 'Initial probe: analyzing player posture.',
    confidence: 0,
  });
  const [behaviorProfile, setBehaviorProfile] = useState<BehaviorProfile>({
    frontalAttackRate: 0,
    dodgeRate: 0,
    retreatRate: 0,
    evidenceCount: 0,
    detectedPattern: 'INSUFFICIENT_DATA',
    confidence: 0,
  });
  const [recentEvents, setRecentEvents] = useState<PlayerEvent[]>([]);
  const [adaptations, setAdaptations] = useState(0);

  // Optional AI Demonstration Scenario state
  const [demoMode, setDemoMode] = useState(false);
  const [demoStep, setDemoStep] = useState<1 | 2 | 3>(1);

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
  const keysRef = useRef(keys);
  const lastTime = useRef(0);
  const lastMoveEventTime = useRef(0);
  const lastDecisionTime = useRef(0);
  const lastTactic = useRef<TacticalMode>('ENGAGE');
  const screenRef = useRef(screen);
  const playerRef = useRef(player);
  const aiRef = useRef(ai);
  const healthRef = useRef(health);
  const energyRef = useRef(energy);
  const soundRef = useRef(sound);
  const decisionRef = useRef(agentDecision);
  const adaptationsRef = useRef(adaptations);

  useEffect(() => { keysRef.current = keys; }, [keys]);
  useEffect(() => { statsRef.current = stats; }, [stats]);
  useEffect(() => { screenRef.current = screen; }, [screen]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { aiRef.current = ai; }, [ai]);
  useEffect(() => { healthRef.current = health; }, [health]);
  useEffect(() => { energyRef.current = energy; }, [energy]);
  useEffect(() => { soundRef.current = sound; }, [sound]);
  useEffect(() => { decisionRef.current = agentDecision; }, [agentDecision]);
  useEffect(() => { adaptationsRef.current = adaptations; }, [adaptations]);

  const recordPlayerEvent = useCallback((type: PlayerActionType, dir?: Vec) => {
    const curPlayer = playerRef.current;
    const curAi = aiRef.current;
    const aim = dir ?? normalize(curAi.x - curPlayer.x, curAi.z - curPlayer.z);
    const dist = distance(curPlayer, curAi);

    const event: PlayerEvent = {
      type,
      timestamp: Date.now(),
      direction: { x: aim.x, y: aim.z },
      playerPosition: toAgentPos(curPlayer),
      aiPosition: toAgentPos(curAi),
      distanceToAI: toAgentDist(dist),
      health: healthRef.current.player,
    };

    agentRef.current.recordPlayerEvent(event);
    setRecentEvents(agentRef.current.getRecentEvents(5));
    const updatedProfile = agentRef.current.getBehaviorProfile();
    setBehaviorProfile(updatedProfile);

    // In demo mode, advance drill steps as player actions trigger adaptations
    if (demoMode && updatedProfile.evidenceCount >= 8) {
      if (updatedProfile.detectedPattern === 'REPEATED_ATTACKS') {
        setDemoStep(2);
      } else if (updatedProfile.detectedPattern === 'FREQUENT_RETREAT' || updatedProfile.detectedPattern === 'FREQUENT_DODGING') {
        setDemoStep(3);
      }
    }
  }, [demoMode]);

  const startMatch = useCallback((isDemo = false) => {
    // Reset agent event history between rounds (AI_INTEGRATION.md Section 8)
    agentRef.current.reset();

    const initialDecision: AgentDecision = {
      tactic: 'ENGAGE',
      targetPosition: { x: 200, y: 200 },
      shouldAttack: false,
      reason: 'Round initiated: analyzing player posture.',
      confidence: 0,
    };
    decisionRef.current = initialDecision;
    setAgentDecision(initialDecision);
    lastTactic.current = 'ENGAGE';
    setBehaviorProfile({
      frontalAttackRate: 0,
      dodgeRate: 0,
      retreatRate: 0,
      evidenceCount: 0,
      detectedPattern: 'INSUFFICIENT_DATA',
      confidence: 0,
    });
    setRecentEvents([]);
    setScreen('match');
    setDemoMode(isDemo);
    setDemoStep(1);
    setWinner(null);
    ended.current = false;
    setPlayer({ x: -7, z: 0 });
    setAi({ x: 7, z: 0 });
    setHealth({ player: 100, ai: 100 });
    setEnergy({ player: 100, ai: 100 });
    setProjectiles([]);
    setWeapon('pulse');
    setAdaptations(0);
    adaptationsRef.current = 0;
    setTimer(90);
    setStats({ dealt: 0, received: 0, adaptations: 0, startedAt: Date.now(), observations: 0 });
    setCooldowns({ shot: 0, dash: 0, special: 0, aiShot: 0 });
    lastMoveEventTime.current = 0;
    lastDecisionTime.current = 0;
    if (soundRef.current) playTone('menu', true);
  }, []);

  const startDemo = useCallback(() => {
    startMatch(true);
  }, [startMatch]);

  const runDemoScript = useCallback((targetPhase: 1 | 3) => {
    const curPlayer = playerRef.current;
    const curAi = aiRef.current;
    const dist = distance(curPlayer, curAi);

    if (targetPhase === 1) {
      // Phase 1: 8 real frontal attack events demonstrating pattern recognition
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const aim = normalize(curAi.x - curPlayer.x, curAi.z - curPlayer.z);
          const event: PlayerEvent = {
            type: 'ATTACK',
            timestamp: Date.now() + i,
            direction: { x: aim.x, y: aim.z },
            playerPosition: toAgentPos(curPlayer),
            aiPosition: toAgentPos(curAi),
            distanceToAI: toAgentDist(dist),
            health: healthRef.current.player,
          };
          agentRef.current.recordPlayerEvent(event);
          setRecentEvents(agentRef.current.getRecentEvents(5));
          const updated = agentRef.current.getBehaviorProfile();
          setBehaviorProfile(updated);
          if (soundRef.current) playTone('player_pulse', true);
          if (i === 7) setDemoStep(2);
        }, i * 130);
      }
    } else {
      // Phase 3: Player shifts to dodging & retreats demonstrating behavior counter-adaptation
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const isDodge = i % 2 === 0;
          const retreatDir = normalize(curPlayer.x - curAi.x, curPlayer.z - curAi.z);
          const event: PlayerEvent = {
            type: isDodge ? 'DODGE' : 'RETREAT',
            timestamp: Date.now() + i,
            direction: { x: retreatDir.x, y: retreatDir.z },
            playerPosition: toAgentPos(curPlayer),
            aiPosition: toAgentPos(curAi),
            distanceToAI: toAgentDist(dist + i * 2),
            health: healthRef.current.player,
          };
          agentRef.current.recordPlayerEvent(event);
          setRecentEvents(agentRef.current.getRecentEvents(5));
          const updated = agentRef.current.getBehaviorProfile();
          setBehaviorProfile(updated);
          if (soundRef.current) playTone(isDodge ? 'dash' : 'menu', true);
          if (i === 7) setDemoStep(3);
        }, i * 130);
      }
    }
  }, []);

  const finishMatch = useCallback((result: Winner) => {
    if (ended.current) return;
    ended.current = true;
    setWinner(result);
    setScreen('results');
    if (soundRef.current) playTone(result === 'player' ? 'win' : 'defeat', true);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
      setKeys((current) => ({ ...current, [key]: true }));
      if (key === '1') { setWeapon('blade'); if (soundRef.current) playTone('weapon_switch', true); }
      if (key === '2') { setWeapon('pulse'); if (soundRef.current) playTone('weapon_switch', true); }
      if (key === '3') { setWeapon('burst'); if (soundRef.current) playTone('weapon_switch', true); }
      if ((key === 'escape' || key === 'p') && screenRef.current === 'match') setScreen('pause');
    };
    const onKeyUp = (event: KeyboardEvent) => setKeys((current) => ({ ...current, [event.key.toLowerCase()]: false }));
    const onMouseDown = (event: MouseEvent) => { if (event.button === 0) mouseDown.current = true; };
    const onMouseUp = (event: MouseEvent) => { if (event.button === 0) mouseDown.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  // Main combat and AI integration loop
  useEffect(() => {
    if (screen !== 'match') return;
    let frame = 0;

    const loop = (time: number) => {
      const delta = Math.min((time - (lastTime.current || time)) / 1000, 0.04);
      lastTime.current = time;

      setTimer((current) => {
        const next = Math.max(0, current - delta);
        if (next === 0) {
          const curH = healthRef.current;
          finishMatch(curH.player === curH.ai ? 'draw' : curH.player > curH.ai ? 'player' : 'ai');
        }
        return next;
      });

      setCooldowns((current) => ({
        shot: Math.max(0, current.shot - delta),
        dash: Math.max(0, current.dash - delta),
        special: Math.max(0, current.special - delta),
        aiShot: Math.max(0, current.aiShot - delta),
      }));

      const currentKeys = keysRef.current;
      const dx = (currentKeys.d || currentKeys.arrowright ? 1 : 0) - (currentKeys.a || currentKeys.arrowleft ? 1 : 0);
      const dz = (currentKeys.s || currentKeys.arrowdown ? 1 : 0) - (currentKeys.w || currentKeys.arrowup ? 1 : 0);
      const moving = dx !== 0 || dz !== 0;
      const moveDir = normalize(dx, dz);
      const sprint = currentKeys.shift && energyRef.current.player > 0;
      const speed = sprint ? 7.2 : 4.8;

      let nextPlayer = playerRef.current;
      if (moving) {
        nextPlayer = moveAroundCover(nextPlayer, {
          x: clamp(nextPlayer.x + moveDir.x * speed * delta, -11.5, 11.5),
          z: clamp(nextPlayer.z + moveDir.z * speed * delta, -6.5, 6.5),
        });
        setPlayer(nextPlayer);
        setLastMove(Math.abs(moveDir.x) > Math.abs(moveDir.z) ? (moveDir.x > 0 ? 'right' : 'left') : (moveDir.z > 0 ? 'back' : 'forward'));

        // Periodically record real movement / retreat events (AI_INTEGRATION.md Section 4)
        if (time - lastMoveEventTime.current > 380) {
          lastMoveEventTime.current = time;
          const toAi = normalize(aiRef.current.x - nextPlayer.x, aiRef.current.z - nextPlayer.z);
          const alignment = moveDir.x * toAi.x + moveDir.z * toAi.z;
          recordPlayerEvent(alignment < -0.35 ? 'RETREAT' : 'MOVE', moveDir);
        }
      }

      // Player Dash / Dodge
      if (currentKeys.shift && cooldowns.dash <= 0 && moving) {
        setDash(true);
        setCooldowns((current) => ({ ...current, dash: 2.3 }));
        nextPlayer = { x: clamp(nextPlayer.x + moveDir.x * 2.1, -11.5, 11.5), z: clamp(nextPlayer.z + moveDir.z * 2.1, -6.5, 6.5) };
        setPlayer(nextPlayer);
        recordPlayerEvent('DODGE', moveDir);
        if (soundRef.current) playTone('dash', true);
        setTimeout(() => setDash(false), 160);
      }

      // Energy recovery
      if (sprint) {
        setEnergy((current) => ({ ...current, player: Math.max(0, current.player - delta * 18) }));
      } else {
        setEnergy((current) => ({ ...current, player: Math.min(100, current.player + delta * 8) }));
      }

      // Phase Shield
      if (currentKeys.q && cooldowns.special <= 0) {
        setShield(true);
        setCooldowns((current) => ({ ...current, special: 7 }));
        setEnergy((current) => ({ ...current, player: Math.max(0, current.player - 28) }));
        setTimeout(() => setShield(false), 1400);
        if (soundRef.current) playTone('shield', true);
      }

      // Player Attack
      if ((currentKeys.e || currentKeys[' '] || mouseDown.current) && cooldowns.shot <= 0) {
        const weaponStats = {
          blade: { cooldown: .72, damage: 18, speed: 15, life: .48 },
          pulse: { cooldown: .48, damage: 8, speed: 12, life: 1.8 },
          burst: { cooldown: 1.05, damage: 5, speed: 11, life: 1.6 },
        }[weapon];
        setCooldowns((current) => ({ ...current, shot: weaponStats.cooldown }));
        const direction = normalize(aiRef.current.x - nextPlayer.x, aiRef.current.z - nextPlayer.z);
        recordPlayerEvent('ATTACK', direction);

        const offsets = weapon === 'burst' ? [-.13, 0, .13] : [0];
        setProjectiles((current) => [
          ...current,
          ...offsets.map((offset) => ({
            id: nextProjectile.current++,
            owner: 'player' as const,
            x: nextPlayer.x,
            z: nextPlayer.z,
            vx: (direction.x - direction.z * offset) * weaponStats.speed,
            vz: (direction.z + direction.x * offset) * weaponStats.speed,
            life: weaponStats.life,
            damage: weaponStats.damage,
            kind: weapon,
          })),
        ]);
        setAttacking(true);
        setTimeout(() => setAttacking(false), weapon === 'blade' ? 220 : 130);
        if (soundRef.current) {
          playTone(weapon === 'blade' ? 'player_blade' : weapon === 'burst' ? 'player_burst' : 'player_pulse', true);
        }
      }

      // AI Decision Query (AI_INTEGRATION.md Section 5 & 6)
      if (time - lastDecisionTime.current > 220) {
        lastDecisionTime.current = time;
        const curAi = aiRef.current;
        const curPlayer = playerRef.current;
        const curHealth = healthRef.current;
        const dist = distance(curPlayer, curAi);
        const nearObstacles = cover.some((c) => distance(curAi, { x: c.x, z: c.z }) < 1.6);

        const gameState: GameState = {
          playerPosition: toAgentPos(curPlayer),
          aiPosition: toAgentPos(curAi),
          playerHealth: curHealth.player,
          aiHealth: curHealth.ai,
          distanceToPlayer: toAgentDist(dist),
          obstaclesNearby: nearObstacles,
        };

        const newDecision = agentRef.current.getDecision(gameState);
        if (isValidDecision(newDecision, gameState)) {
          decisionRef.current = newDecision;
          setAgentDecision(newDecision);
          const profile = agentRef.current.getBehaviorProfile();
          setBehaviorProfile(profile);

          if (newDecision.tactic !== lastTactic.current && profile.evidenceCount >= 8) {
            lastTactic.current = newDecision.tactic;
            adaptationsRef.current += 1;
            setAdaptations(adaptationsRef.current);
            if (soundRef.current) playTone('adapt', true);
          }

          setStats((prev) => ({
            ...prev,
            observations: profile.evidenceCount,
            adaptations: adaptationsRef.current,
          }));
        }
      }

      // AI Movement based on Agent's selected tactic and targetPosition (Role 1 & Role 2 Execution)
      const currentDecision = decisionRef.current;
      setAi((current) => {
        const curPlayer = playerRef.current;
        const targetWorld = fromAgentPos(currentDecision.targetPosition);
        const toTarget = normalize(targetWorld.x - current.x, targetWorld.z - current.z);
        const toPlayer = normalize(curPlayer.x - current.x, curPlayer.z - current.z);
        const distToPlayer = distance(curPlayer, current);
        const strafe = Math.sin(time / 650) > 0 ? 1 : -1;

        let vx = toTarget.x;
        let vz = toTarget.z;

        if (currentDecision.tactic === 'EVADE_FLANK') {
          // Flank and circle around player while evading repeated frontal fire
          vx = toTarget.x * 0.5 - toPlayer.z * strafe * 0.85;
          vz = toTarget.z * 0.5 + toPlayer.x * strafe * 0.85;
        } else if (currentDecision.tactic === 'DEFEND_REPOSITION') {
          // Reposition away from danger or reset spacing
          vx = toTarget.x * 0.95;
          vz = toTarget.z * 0.95;
        } else {
          // ENGAGE: maintain forward pressure while keeping sensible combat distance
          if (distToPlayer > 4.2) {
            vx = toTarget.x * 0.85 + toPlayer.x * 0.35;
            vz = toTarget.z * 0.85 + toPlayer.z * 0.35;
          } else if (distToPlayer < 2.6) {
            // Space back slightly to maintain optimal firing distance
            vx = -toPlayer.x * 0.6;
            vz = -toPlayer.z * 0.6;
          } else {
            // Circle/zone at optimal range
            vx = -toPlayer.z * strafe * 0.5;
            vz = toPlayer.x * strafe * 0.5;
          }
        }

        const aiSpeed = difficulty === 'NIGHTMARE' ? 3.7 : difficulty === 'SENTINEL' ? 2.4 : 3.0;
        return moveAroundCover(current, {
          x: clamp(current.x + vx * aiSpeed * delta, -11.5, 11.5),
          z: clamp(current.z + vz * aiSpeed * delta, -6.5, 6.5),
        });
      });

      // AI Attack Execution based on Agent Recommendation (decision.shouldAttack)
      const distToPlayer = distance(aiRef.current, playerRef.current);
      const shouldAiFire = currentDecision.shouldAttack && distToPlayer <= 11.5;
      if (cooldowns.aiShot <= 0 && shouldAiFire) {
        const direction = normalize(playerRef.current.x - aiRef.current.x, playerRef.current.z - aiRef.current.z);
        setProjectiles((current) => [
          ...current,
          {
            id: nextProjectile.current++,
            owner: 'ai',
            x: aiRef.current.x,
            z: aiRef.current.z,
            vx: direction.x * 9.5,
            vz: direction.z * 9.5,
            life: 2,
            damage: difficulty === 'NIGHTMARE' ? 9 : 7,
            kind: 'pulse',
          },
        ]);
        setCooldowns((current) => ({ ...current, aiShot: difficulty === 'SENTINEL' ? 1.75 : difficulty === 'NIGHTMARE' ? 1.15 : 1.35 }));
        setAiAttacking(true);
        setTimeout(() => setAiAttacking(false), 170);
        if (soundRef.current) playTone('ai_shoot', true);
      }

      // Projectiles Movement
      setProjectiles((current) =>
        current
          .map((shot) => ({ ...shot, x: shot.x + shot.vx * delta, z: shot.z + shot.vz * delta, life: shot.life - delta }))
          .filter((shot) => shot.life > 0 && Math.abs(shot.x) < 13 && Math.abs(shot.z) < 8)
      );

      // Hit Collisions
      setProjectiles((current) => {
        const curPlayer = playerRef.current;
        const curAi = aiRef.current;
        const hits = current.filter(
          (shot) => (shot.owner === 'player' && distance(shot, curAi) < 0.9) || (shot.owner === 'ai' && distance(shot, curPlayer) < 0.9)
        );

        if (hits.length) {
          hits.forEach((shot) => {
            if (shot.owner === 'player') {
              setHealth((value) => ({ ...value, ai: Math.max(0, value.ai - shot.damage) }));
              setStats((value) => ({ ...value, dealt: value.dealt + shot.damage }));
            } else if (!shield) {
              setHealth((value) => ({ ...value, player: Math.max(0, value.player - shot.damage) }));
              setStats((value) => ({ ...value, received: value.received + shot.damage }));
            }
            if (soundRef.current) playTone('hit', true);
          });
        }
        return current.filter((shot) => !hits.some((hit) => hit.id === shot.id));
      });

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [screen, difficulty, weapon, shield, cooldowns.shot, cooldowns.dash, cooldowns.special, cooldowns.aiShot, recordPlayerEvent, finishMatch]);

  useEffect(() => {
    setLowHealth(health.player < 30);
    if (health.player <= 0) finishMatch('ai');
    else if (health.ai <= 0) finishMatch('player');
  }, [health, finishMatch]);

  const matchDuration = Math.floor(timer);
  const elapsed = Math.max(0, 90 - matchDuration);
  const launchFromTitle = () => { setScreen('intro'); if (sound) playTone('menu'); };
  const handleSettingsKey = (event: ReactKeyboardEvent<HTMLSelectElement>) => { if (event.key === 'Enter') event.currentTarget.blur(); };

  // HUD Formatters for real Agent metrics
  const formatTactic = (tactic: TacticalMode) => {
    switch (tactic) {
      case 'EVADE_FLANK': return 'EVADE & FLANK';
      case 'DEFEND_REPOSITION': return 'DEFEND & REPOSITION';
      case 'ENGAGE':
      default:
        return 'ENGAGE';
    }
  };

  const formatPattern = (pattern: string) => {
    switch (pattern) {
      case 'REPEATED_ATTACKS': return 'Frontal assault';
      case 'FREQUENT_DODGING': return 'High mobility evasion';
      case 'FREQUENT_RETREAT': return 'Defensive spacing';
      case 'MIXED_BEHAVIOR': return 'Adaptive hybrid';
      case 'INSUFFICIENT_DATA':
      default:
        return `Gathering trace (${behaviorProfile.evidenceCount}/8)`;
    }
  };

  if (screen === 'title') {
    return <main className="app-shell title-shell">
      <div className="title-bg" />
      <div className="title-copy">
        <div className="eyebrow"><span className="signal-dot" /> TACTICAL COMBAT SIMULATION // 01</div>
        <h1>NEURO<span>CLASH</span><em>AI</em></h1>
        <p className="tagline">YOU MAKE THE MOVE. <strong>IT LEARNS THE PATTERN.</strong></p>
        <p className="title-description">A one-on-one adaptive combat experiment where real player actions feed directly into the AI profiler and tactical strategy planner.</p>
        <button className="primary-button" onClick={launchFromTitle}><Play size={16} fill="currentColor" /> Initiate match</button>
        <div className="title-links">
          <button onClick={() => setScreen('howto')}><HelpCircle size={14} /> How to play</button>
          <button onClick={() => setScreen('settings')}><Settings size={14} /> Settings</button>
          <button onClick={startDemo}><Sparkles size={14} /> AI Adaptation Demo</button>
        </div>
      </div>
      <div className="title-footer">
        <span>OBSERVE</span><span>ANALYZE</span><span>ADAPT</span><span>DEFEAT</span>
        <small>BUILD 01.07 // AGENT ROLE 1+2+3 INTEGRATED</small>
      </div>
    </main>;
  }

  if (screen === 'intro') {
    return <main className="app-shell intro-shell">
      <div className="intro-grid" />
      <div className="intro-copy">
        <span className="eyebrow">MATCH PROTOCOL // ADAPTIVE ARENA</span>
        <h2>Two minds.<br /><span>One pattern.</span></h2>
        <p>Neuro does not cheat. It records your actual events (attacks, dodges, retreats), analyzes behavioral tendencies with statistical evidence, and shifts tactical modes to counter you.</p>
        <div className="vs-row">
          <div><b>YOU</b><small>CYAN OPERATIVE</small></div>
          <span>VS</span>
          <div><b>NEURO</b><small>ADAPTIVE COMBAT AGENT</small></div>
        </div>
        <button className="primary-button" onClick={() => setScreen('mode')}>Choose combat mode <Crosshair size={16} /></button>
      </div>
    </main>;
  }

  if (screen === 'mode') {
    return <main className="app-shell modal-shell">
      <div className="modal-card mode-card">
        <span className="eyebrow">MISSION SELECT // LOCAL SIMULATION</span>
        <h2>Choose your<br /><span>combat mode.</span></h2>
        <div className="mode-options">
          <button className={difficulty === 'SENTINEL' ? 'mode-option selected' : 'mode-option'} onClick={() => setDifficulty('SENTINEL')}>
            <b>SENTINEL</b><small>Slower reactions. Ideal for learning arena mechanics.</small>
          </button>
          <button className={difficulty === 'ADAPTIVE' ? 'mode-option selected' : 'mode-option'} onClick={() => setDifficulty('ADAPTIVE')}>
            <b>ADAPTIVE</b><small>Balanced adaptive AI using real profiler heuristics.</small>
          </button>
          <button className={difficulty === 'NIGHTMARE' ? 'mode-option selected' : 'mode-option'} onClick={() => setDifficulty('NIGHTMARE')}>
            <b>NIGHTMARE</b><small>High velocity reactions. Punishes repetitive patterns ruthlessly.</small>
          </button>
        </div>
        <button className="primary-button" onClick={() => startMatch(false)}>Start 90-second round <Play size={16} fill="currentColor" /></button>
        <button className="text-button" onClick={() => setScreen('title')}>Back to main menu</button>
      </div>
    </main>;
  }

  if (screen === 'settings' || screen === 'howto') {
    return <main className="app-shell modal-shell">
      <div className="modal-card">
        <button className="icon-button close-button" onClick={() => setScreen('title')}><X size={18} /></button>
        {screen === 'settings' ? <>
          <span className="eyebrow">SYSTEM CONFIGURATION</span>
          <h2>Settings</h2>
          <div className="settings-list">
            <label>AI difficulty
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)} onKeyDown={handleSettingsKey}>
                <option value="SENTINEL">Sentinel — forgiving</option>
                <option value="ADAPTIVE">Adaptive — recommended</option>
                <option value="NIGHTMARE">Nightmare — relentless</option>
              </select>
            </label>
            <label>Reduced visual effects
              <button className={`toggle ${reducedFx ? 'on' : ''}`} onClick={() => setReducedFx((value) => !value)}>{reducedFx ? 'ON' : 'OFF'}</button>
            </label>
            <label>Combat audio
              <button className={`toggle ${sound ? 'on' : ''}`} onClick={() => setSound((value) => !value)}>{sound ? 'ON' : 'OFF'}</button>
            </label>
          </div>
          <button className="secondary-button" onClick={() => setScreen('title')}>Save configuration</button>
        </> : <>
          <span className="eyebrow">FIELD MANUAL // QUICK START</span>
          <h2>How to play</h2>
          <div className="control-grid">
            <div><kbd>W A S D</kbd><span>Move around the arena</span></div>
            <div><kbd>E / SPACE</kbd><span>Fire selected weapon</span></div>
            <div><kbd>SHIFT</kbd><span>Sprint and dash dodge</span></div>
            <div><kbd>Q</kbd><span>Activate phase shield</span></div>
            <div><kbd>1 / 2 / 3</kbd><span>Switch weapons</span></div>
            <div><kbd>ESC / P</kbd><span>Pause the match</span></div>
          </div>
          <p className="tip"><Sparkles size={16} /> The AI observes your attack direction, dodge frequency, and spacing. Vary your habits to prevent Neuro from locking in a counter-tactic.</p>
          <button className="secondary-button" onClick={() => setScreen('title')}>Return to title</button>
        </>}
      </div>
    </main>;
  }

  if (screen === 'results') {
    return <main className="app-shell result-shell">
      <div className={`result-card ${winner === 'player' ? 'victory' : winner === 'draw' ? 'draw' : 'defeat'}`}>
        <span className="eyebrow">MATCH COMPLETE // {elapsed}s</span>
        <h2>{winner === 'player' ? 'VICTORY' : winner === 'draw' ? 'DRAW' : 'DEFEAT'}</h2>
        <p>{winner === 'player' ? 'You broke the prediction loop. Neuro is recalibrating.' : agentDecision.reason}</p>
        <div className="result-stats">
          <span><b>{stats.dealt}</b>Damage dealt</span>
          <span><b>{stats.received}</b>Damage received</span>
          <span><b>{adaptations}</b>Adaptations</span>
        </div>
        <div style={{ margin: '14px 0', fontSize: '13px', color: '#88a8ba', borderTop: '1px solid #1c4758', paddingTop: '12px' }}>
          Final Profiler Pattern: <strong style={{ color: '#14dfff' }}>{behaviorProfile.detectedPattern.replace('_', ' ')}</strong> (Evidence: {behaviorProfile.evidenceCount} events)
        </div>
        <div className="result-actions">
          <button className="primary-button" onClick={() => startMatch(false)}><RotateCcw size={16} /> Rematch</button>
          <button className="secondary-button" onClick={() => setScreen('title')}>Main menu</button>
        </div>
      </div>
    </main>;
  }

  // Active Match Screen
  return <main className={`app-shell match-shell ${lowHealth ? 'critical' : ''}`}>
    <div className="match-canvas">
      <CanvasErrorBoundary>
        <Scene
          player={player}
          ai={ai}
          health={health}
          projectiles={projectiles}
          attacking={attacking}
          aiAttacking={aiAttacking}
          shield={shield}
          dash={dash}
          weapon={weapon}
          tactic={agentDecision.tactic}
          playerMoving={Boolean(keys.w || keys.a || keys.s || keys.d || keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight || dash)}
          aiMoving={true}
          reducedFx={reducedFx}
        />
      </CanvasErrorBoundary>
    </div>

    {/* Top Header HUD */}
    <header className="match-header">
      <div className="fighter-hud player-hud">
        <div className="hud-id">
          <span className="hud-icon cyan-icon"><Zap size={16} /></span>
          <span><b>YOU</b><small>CYAN OPERATIVE</small></span>
        </div>
        <div className="health-track"><i style={{ width: `${health.player}%` }} /></div>
        <div className="hud-values"><span>HP {Math.round(health.player)} / 100</span><span>ENERGY {Math.round(energy.player)}%</span></div>
      </div>

      <div className="match-clock">
        <span>ROUND 01</span>
        <strong>{String(Math.floor(matchDuration / 60)).padStart(2, '0')}:{String(matchDuration % 60).padStart(2, '0')}</strong>
        <small>NEUROCLASH PROTOCOL</small>
      </div>

      <div className="fighter-hud ai-hud">
        <div className="hud-id">
          <span><b>NEURO</b><small>ADAPTIVE AGENT</small></span>
          <span className="hud-icon magenta-icon"><Target size={16} /></span>
        </div>
        <div className="health-track"><i style={{ width: `${health.ai}%` }} /></div>
        <div className="hud-values"><span>HP {Math.round(health.ai)} / 100</span><span>THREAT ACTIVE</span></div>
      </div>
    </header>

    {/* Live AI Agent Analysis HUD (AI_INTEGRATION.md Section 7) */}
    <aside className="ai-dashboard">
      <div className="dash-heading">
        <span><Gauge size={15} /> AI ANALYSIS</span>
        <span className="live-dot" />
      </div>
      <div className="strategy-label">CURRENT TACTIC</div>
      <h3>{behaviorProfile.evidenceCount < 8 ? 'ANALYZING' : formatTactic(agentDecision.tactic)}</h3>
      <p className="decision"><Sparkles size={14} /> {behaviorProfile.evidenceCount < 8 ? `Analyzing combat behavior (${behaviorProfile.evidenceCount}/8 required).` : agentDecision.reason}</p>

      <div className="confidence-row">
        <span>CONFIDENCE</span>
        <b>{behaviorProfile.evidenceCount < 8 ? '—' : `${Math.round(agentDecision.confidence * 100)}%`}</b>
      </div>
      <div className="confidence-track">
        <i style={{ width: behaviorProfile.evidenceCount < 8 ? '0%' : `${Math.round(agentDecision.confidence * 100)}%` }} />
      </div>

      <div className="dash-data">
        <span><b>{behaviorProfile.evidenceCount} / 8</b> player events</span>
        <span><b>{formatPattern(behaviorProfile.detectedPattern)}</b></span>
      </div>

      <div className="adaptation-count">
        <span>ADAPTATIONS</span>
        <b>{adaptations}</b>
      </div>
    </aside>

    {/* Live Tactical Feed (AI_INTEGRATION.md Section 7) */}
    <aside className="tactical-feed">
      <div className="feed-title">
        <span><Crosshair size={14} /> TACTICAL FEED</span>
        <small>LIVE TRACE</small>
      </div>
      <div className="feed-visual">
        <div className="feed-grid" />
        <span className="feed-player" />
        <span className="feed-ai" />
        <i className="feed-line" />
      </div>
      <div className="feed-row"><span>PLAYER VECTOR</span><b>{lastMove.toUpperCase()}</b></div>
      <div className="feed-row"><span>NEURO TACTIC</span><b>{behaviorProfile.evidenceCount < 8 ? 'ANALYZING' : formatTactic(agentDecision.tactic)}</b></div>
      <div className="feed-row">
        <span>EVIDENCE TRACE</span>
        <b>{recentEvents.length > 0 ? recentEvents.slice(-3).map(e => e.type).join(' • ') : 'LISTENING'}</b>
      </div>
      <div className="feed-note">
        {behaviorProfile.detectedPattern === 'INSUFFICIENT_DATA'
          ? `Profiling player (${behaviorProfile.evidenceCount}/8 required for pattern lock).`
          : `Pattern locked: ${behaviorProfile.detectedPattern.replace('_', ' ')} (${Math.round(behaviorProfile.confidence * 100)}% confidence).`}
      </div>
    </aside>

    {/* Optional AI Adaptation Demo Scenario (Phase 9) */}
    {demoMode && (
      <div className="demo-banner">
        <div className="demo-banner-header">
          <span><Sparkles size={14} /> AI ADAPTATION DEMO (PHASE {demoStep} OF 3)</span>
          <button className="demo-exit-btn" onClick={() => setDemoMode(false)}>Exit Demo</button>
        </div>
        {demoStep === 1 && (
          <div>
            <p><strong>Phase 1: Profiling.</strong> Neuro is logging real actions. Fire 8 frontal attacks (or click <em>Simulate 8 Attacks</em>) to feed real data.</p>
            <div className="demo-banner-actions">
              <button className="demo-btn" onClick={() => runDemoScript(1)}>Simulate 8 Attacks</button>
            </div>
          </div>
        )}
        {demoStep === 2 && (
          <div>
            <p><strong>Phase 2: Tactical Adaptation.</strong> Neuro recognized <em>REPEATED_ATTACKS</em> and shifted into <em>EVADE &amp; FLANK</em>. Watch the robot flank away from your vector! Now dodge or retreat to alter your pattern.</p>
            <div className="demo-banner-actions">
              <button className="demo-btn" onClick={() => runDemoScript(3)}>Simulate 8 Evasions</button>
            </div>
          </div>
        )}
        {demoStep === 3 && (
          <div>
            <p><strong>Phase 3: Counter-Adaptation Verified.</strong> Neuro adapted to defensive mobility and shifted into <em>DEFEND &amp; REPOSITION</em>. Real pipeline verified from events to robot steering.</p>
            <div className="demo-banner-actions">
              <button className="demo-btn" onClick={() => runDemoScript(1)}>Re-test Attack Pattern</button>
            </div>
          </div>
        )}
      </div>
    )}

    {/* Minimap */}
    <div className="minimap">
      <div className="minimap-grid" />
      <span className="mini-player" style={{ left: `${((player.x + 12) / 24) * 100}%`, top: `${((player.z + 7) / 14) * 100}%` }} />
      <span className="mini-ai" style={{ left: `${((ai.x + 12) / 24) * 100}%`, top: `${((ai.z + 7) / 14) * 100}%` }} />
      <small>TACTICAL MAP</small>
    </div>

    {/* Combat Tools */}
    <div className="combat-tools">
      <div className={`tool ${weapon === 'blade' ? 'active-tool' : ''}`}>
        <span className="tool-key">1</span><span>ENERGY BLADE</span>
        <i className={weapon === 'blade' && cooldowns.shot <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.shot / .72 * 100)}%` }} />
      </div>
      <div className={`tool ${weapon === 'pulse' ? 'active-tool' : ''}`}>
        <span className="tool-key">2</span><span>PULSE SHOT</span>
        <i className={weapon === 'pulse' && cooldowns.shot <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.shot / .48 * 100)}%` }} />
      </div>
      <div className={`tool ${weapon === 'burst' ? 'active-tool' : ''}`}>
        <span className="tool-key">3</span><span>BURST SHOT</span>
        <i className={weapon === 'burst' && cooldowns.shot <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.shot / 1.05 * 100)}%` }} />
      </div>
      <div className="tool">
        <span className="tool-key">SHIFT</span><span>DODGE</span>
        <i className={cooldowns.dash <= 0 ? 'ready' : ''} style={{ width: `${Math.max(0, 100 - cooldowns.dash / 2.3 * 100)}%` }} />
      </div>
    </div>

    <div className="match-tip">
      {shield ? 'PHASE SHIELD ACTIVE' : `1/2/3 switch weapons • Space/Click fire • Q shield • ${weapon.toUpperCase()} active`}
    </div>

    <button className="pause-button" onClick={() => setScreen('pause')}><Pause size={16} /> Pause</button>

    {screen === 'pause' && <div className="pause-overlay">
      <div className="pause-card">
        <span className="eyebrow">SYSTEM HOLD</span>
        <h2>Match paused</h2>
        <p>The arena is frozen. Neuro is holding your last tactical state.</p>
        <button className="primary-button" onClick={() => setScreen('match')}><Play size={16} /> Resume</button>
        <button className="secondary-button" onClick={() => startMatch(false)}>Restart match</button>
        <button className="text-button" onClick={() => setScreen('title')}>Return to main menu</button>
      </div>
    </div>}
  </main>;
}

export default App;
