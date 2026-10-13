
import type { AgentDecision, GameState } from "./types";

/**
 * Contract between the AI agent and the game integration.
 * The game layer is responsible for validating and executing actions.
 */
export interface ActionExecutor {
    execute(
        decision: AgentDecision,
        state: GameState
    ): void;
}

/**
 * Basic validation before a decision is passed to the game layer.
 */
export function isValidDecision(
    decision: AgentDecision,
    state: GameState
): boolean {
    const { x, y } = decision.targetPosition;

    return (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(decision.confidence) &&
        decision.confidence >= 0 &&
        decision.confidence <= 1 &&
        state.aiHealth > 0 &&
        state.playerHealth > 0
    );
}
