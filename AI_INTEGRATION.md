# NEUROCLASH AI — Integration Contract

## 1. Purpose

This document defines how Role 1 (Game Mechanics) and Role 3 (HUD, Memory & Integration) connect to Role 2's adaptive AI agent.

**Rule:** The game must provide real player events and current game state. The HUD must display actual agent outputs, not simulated detection messages.

## 2. Agent Files

All AI agent files are located in `src/agent/`.

- `types.ts` — Shared interfaces and types
- `EventTracker.ts` — Records recent player events
- `BehaviorProfiler.ts` — Detects behavior patterns
- `StrategyPlanner.ts` — Selects a tactical response
- `ActionExecutor.ts` — Action execution interface/logic
- `NeuroClashAgent.ts` — Main agent API
- `NeuroClashAgent.test.ts` — Agent tests
- `ActionExecutor.test.ts` — Action executor tests

## 3. Import the Agent

```ts
import { NeuroClashAgent } from "./agent/NeuroClashAgent";
import type {
    GameState,
    PlayerEvent,
} from "./agent/types";

const agent = new NeuroClashAgent();
```

Adjust the relative import path if the calling file is in a different directory.

## 4. Record Real Player Events

Whenever the player attacks, moves, dodges, or retreats, convert the actual game event into a `PlayerEvent` and record it.

```ts
const event: PlayerEvent = {
    type: "ATTACK",
    timestamp: Date.now(),
    direction: { x: -1, y: 0 },
    playerPosition: { x: 200, y: 200 },
    aiPosition: { x: 100, y: 200 },
    distanceToAI: 100,
    health: 100,
};

agent.recordPlayerEvent(event);
```

The values above are examples. The game must supply the real positions, direction, distance, and health.

Supported event types: `ATTACK`, `MOVE`, `DODGE`, `RETREAT`.

## 5. Provide the Current Game State

```ts
const state: GameState = {
    playerPosition: { x: 200, y: 200 },
    aiPosition: { x: 100, y: 200 },
    playerHealth: 100,
    aiHealth: 100,
    distanceToPlayer: 100,
    obstaclesNearby: false,
};
```

Replace the example values with the current game state on each decision update.

**Naming detail:** `GameState` uses `distanceToPlayer`; `PlayerEvent` uses `distanceToAI`. Map the appropriate distance into each object.

## 6. Request a Tactical Decision

```ts
const decision = agent.getDecision(state);

console.log(decision.tactic);
console.log(decision.targetPosition);
console.log(decision.shouldAttack);
console.log(decision.reason);
console.log(decision.confidence);
```

Available tactics:

- `ENGAGE`
- `EVADE_FLANK`
- `DEFEND_REPOSITION`

The game layer should translate the decision into movement and attack behavior. Do not assume that receiving a decision automatically moves the AI character.

## 7. Connect the HUD

Use the agent's real outputs:

```ts
const profile = agent.getBehaviorProfile();
const recentEvents = agent.getRecentEvents(10);
const decision = agent.getDecision(state);
```

The HUD can display:

- Current tactic: `decision.tactic`
- Decision explanation: `decision.reason`
- Confidence: `decision.confidence`
- Detected pattern: `profile.detectedPattern`
- Evidence count: `profile.evidenceCount`
- Frontal attack rate: `profile.frontalAttackRate`
- Dodge rate: `profile.dodgeRate`
- Retreat rate: `profile.retreatRate`
- Recent events: `recentEvents`

Display the actual values returned by the agent. Do not claim a pattern was detected before the profiler reports sufficient evidence.

## 8. Reset Between Rounds

Call this when a new round should start with a clean event history:

```ts
agent.reset();
```

If the project needs to preserve behavior between rounds, coordinate that separately. The current `reset()` method clears the agent's event history; it does not implement persistent memory.

## 9. Validation

From the project root, run:

```powershell
npx.cmd vitest run
```

Run the TypeScript check:

```powershell
npx.cmd tsc --noEmit --target ES2020 --module ESNext --moduleResolution bundler src/agent/types.ts src/agent/EventTracker.ts src/agent/BehaviorProfiler.ts src/agent/StrategyPlanner.ts src/agent/ActionExecutor.ts src/agent/NeuroClashAgent.ts
```

At the time this contract was prepared, all 10 tests passed and the listed agent files compiled without TypeScript errors.

## 10. Integration Responsibilities

**Role 1 — Game Mechanics**
- Supply real positions, health, distance, obstacle status, and player events.
- Apply the agent's selected target and attack recommendation to game mechanics.
- Keep rendering and strategic decision logic separate.

**Role 2 — AI Agent**
- Maintain behavior tracking, profiling, strategy selection, action logic, and tests.
- Coordinate changes to shared types before other roles depend on them.

**Role 3 — HUD, Memory & Integration**
- Display actual agent decisions and measured behavior.
- Connect the game loop to the agent and the agent to the HUD.
- Implement and test persistent memory separately if required.

## 11. Current Limitations

- The agent is not yet connected automatically to the Phaser game loop.
- Persistent behavior memory is not implemented by `NeuroClashAgent`.
- `getDecision()` selects a decision; the game must execute it.
- All integration values must come from actual game state and events.
