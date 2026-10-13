
import type {
    AgentDecision,
    BehaviorProfile,
    GameState,
    TacticalMode,
} from "./types";

export class StrategyPlanner {
    chooseStrategy(
        state: GameState,
        profile: BehaviorProfile
    ): AgentDecision {
        const distance = state.distanceToPlayer;

        let tactic: TacticalMode = "ENGAGE";
        let reason = "Analyzing player behavior: maintaining combat pressure.";

        // Protect the AI when its health is critically low.
        if (state.aiHealth <= 25) {
            tactic = "DEFEND_REPOSITION";
            reason = "AI health is low, so repositioning is safer.";
        } else if (
            profile.detectedPattern === "REPEATED_ATTACKS" &&
            profile.evidenceCount >= 8
        ) {
            tactic = "EVADE_FLANK";
            reason = "Repeated attacks were observed, so the AI will evade and flank.";
        } else if (
            profile.detectedPattern === "FREQUENT_DODGING" &&
            profile.evidenceCount >= 8
        ) {
            tactic = "DEFEND_REPOSITION";
            reason = "Frequent dodging was observed, so the AI will reposition.";
        } else if (
            profile.detectedPattern === "FREQUENT_RETREAT" &&
            profile.evidenceCount >= 8
        ) {
            tactic = "ENGAGE";
            reason = "Frequent retreating was observed, so the AI will maintain pressure.";
        } else if (profile.evidenceCount >= 8 && (distance > 250 || state.obstaclesNearby)) {
            tactic = "DEFEND_REPOSITION";
            reason = state.obstaclesNearby
                ? "Nearby obstacles make repositioning useful."
                : "The player is far away, so the AI will reposition.";
        } else if (profile.evidenceCount < 8) {
            tactic = "ENGAGE";
            reason = `Gathering trace (${profile.evidenceCount}/8 required). Probing player defense.`;
        }

        const targetPosition = this.getTargetPosition(
            state,
            tactic
        );

        const shouldAttack =
            state.aiHealth > 0 &&
            state.playerHealth > 0 &&
            (
                (tactic === "ENGAGE" && distance <= 160) ||
                (tactic === "EVADE_FLANK" && distance <= 170) ||
                (tactic === "DEFEND_REPOSITION" && distance <= 110)
            );

        return {
            tactic,
            targetPosition,
            shouldAttack,
            reason,
            confidence: Math.max(
                0,
                Math.min(1, profile.confidence)
            ),
        };
    }

    private getTargetPosition(
        state: GameState,
        tactic: TacticalMode
    ): { x: number; y: number } {
        const player = state.playerPosition;
        const ai = state.aiPosition;

        const dx = player.x - ai.x;
        const dy = player.y - ai.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;

        if (tactic === "ENGAGE") {
            return { x: player.x, y: player.y };
        }

        if (tactic === "EVADE_FLANK") {
            return {
                x: player.x - (dy / distance) * 120,
                y: player.y + (dx / distance) * 120,
            };
        }

        // Move away from the player to create space.
        return {
            x: ai.x - (dx / distance) * 100,
            y: ai.y - (dy / distance) * 100,
        };
    }
}

