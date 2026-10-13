import { describe, it, expect } from "vitest";
import {
    isValidDecision,
} from "./ActionExecutor";
import type {
    AgentDecision,
    GameState,
} from "./types";

const gameState: GameState = {
    playerPosition: { x: 200, y: 200 },
    aiPosition: { x: 100, y: 200 },
    playerHealth: 100,
    aiHealth: 100,
    distanceToPlayer: 100,
    obstaclesNearby: false,
};

const validDecision: AgentDecision = {
    tactic: "ENGAGE",
    targetPosition: { x: 200, y: 200 },
    shouldAttack: true,
    reason: "Player is within attack range.",
    confidence: 0.8,
};

describe("isValidDecision", () => {
    it("accepts a valid decision", () => {
        expect(
            isValidDecision(validDecision, gameState)
        ).toBe(true);
    });

    it("rejects non-finite target coordinates", () => {
        const decision = {
            ...validDecision,
            targetPosition: { x: Number.NaN, y: 200 },
        };

        expect(
            isValidDecision(decision, gameState)
        ).toBe(false);
    });

    it("rejects confidence outside the 0 to 1 range", () => {
        const decision = {
            ...validDecision,
            confidence: 1.5,
        };

        expect(
            isValidDecision(decision, gameState)
        ).toBe(false);
    });

    it("rejects decisions when the AI is defeated", () => {
        expect(
            isValidDecision(validDecision, {
                ...gameState,
                aiHealth: 0,
            })
        ).toBe(false);
    });

    it("rejects decisions when the player is defeated", () => {
        expect(
            isValidDecision(validDecision, {
                ...gameState,
                playerHealth: 0,
            })
        ).toBe(false);
    });
});