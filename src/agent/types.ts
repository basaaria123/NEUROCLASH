
export type TacticalMode =
    | "ENGAGE"
    | "EVADE_FLANK"
    | "DEFEND_REPOSITION";

export type PlayerActionType =
    | "ATTACK"
    | "MOVE"
    | "DODGE"
    | "RETREAT";


export interface PlayerEvent {
    type: PlayerActionType;
    timestamp: number;
    direction?: { x: number; y: number };
    playerPosition?: { x: number; y: number };
    aiPosition?: { x: number; y: number };
    distanceToAI?: number;
    health?: number;
}


export interface GameState {
    playerPosition: { x: number; y: number };
    aiPosition: { x: number; y: number };
    playerHealth: number;
    aiHealth: number;
    distanceToPlayer: number;
    obstaclesNearby: boolean;
}

export interface BehaviorProfile {
    frontalAttackRate: number;
    dodgeRate: number;
    retreatRate: number;
    evidenceCount: number;
    detectedPattern: string;
    confidence: number;
}

export interface AgentDecision {
    tactic: TacticalMode;
    targetPosition: { x: number; y: number };
    shouldAttack: boolean;
    reason: string;
    confidence: number;
}
