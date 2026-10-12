
import { describe, it, expect } from "vitest";
import { NeuroClashAgent } from "./NeuroClashAgent";
import type { GameState, PlayerEvent } from "./types";

const gameState: GameState = {
    playerPosition: { x: 200, y: 200 },
    aiPosition: { x: 100, y: 200 },
    playerHealth: 100,
    aiHealth: 100,
    distanceToPlayer: 100,
    obstaclesNearby: false,
};

describe("NeuroClashAgent", () => {
    it("does not switch tactics with insufficient evidence", () => {
        const agent = new NeuroClashAgent();

        agent.recordPlayerEvent({
            type: "ATTACK",
            timestamp: 1,
            direction: { x: -1, y: 0 },
            playerPosition: { x: 200, y: 200 },
            aiPosition: { x: 100, y: 200 },
            distanceToAI: 100,
        });

        expect(agent.getDecision(gameState).tactic).toBe("ENGAGE");
    });

    it("switches to evasion after repeated frontal attacks", () => {
        const agent = new NeuroClashAgent();

        for (let i = 0; i < 8; i++) {
            const event: PlayerEvent = {
                type: "ATTACK",
                timestamp: i + 1,
                direction: { x: -1, y: 0 },
                playerPosition: { x: 200, y: 200 },
                aiPosition: { x: 100, y: 200 },
                distanceToAI: 100,
            };

            agent.recordPlayerEvent(event);
        }

        const decision = agent.getDecision(gameState);

        expect(decision.tactic).toBe("EVADE_FLANK");
        expect(decision.reason).toContain("Repeated attacks");
    });

    it("does not classify attacks aimed away from the AI as frontal", () => {
        const agent = new NeuroClashAgent();

        for (let i = 0; i < 8; i++) {
            agent.recordPlayerEvent({
                type: "ATTACK",
                timestamp: i + 1,
                direction: { x: 1, y: 0 },
                playerPosition: { x: 200, y: 200 },
                aiPosition: { x: 100, y: 200 },
                distanceToAI: 100,
            });
        }

        expect(agent.getDecision(gameState).tactic).toBe("ENGAGE");
    });

    it("repositions when AI health is critically low", () => {
        const agent = new NeuroClashAgent();

        const decision = agent.getDecision({
            ...gameState,
            aiHealth: 20,
        });

        expect(decision.tactic).toBe("DEFEND_REPOSITION");
    });
    it("returns an insufficient-data profile when no events have been recorded", () => {
        const agent = new NeuroClashAgent();

        const profile = agent.getBehaviorProfile();

        expect(profile.detectedPattern).toBe("INSUFFICIENT_DATA");
        expect(profile.evidenceCount).toBe(0);
        expect(profile.confidence).toBe(0);
    });
});
