
import type { BehaviorProfile, PlayerEvent } from "./types";

export class BehaviorProfiler {
    analyze(events: PlayerEvent[]): BehaviorProfile {
        const attacks = events.filter(
            (event) => event.type === "ATTACK"
        );

        const dodges = events.filter(
            (event) => event.type === "DODGE"
        );

        const retreats = events.filter(
            (event) => event.type === "RETREAT"
        );

        // Count attacks whose direction points toward the AI.
        // Position snapshots are required to verify alignment.
        const frontalAttacks = attacks.filter((event) => {
            if (
                !event.direction ||
                !event.playerPosition ||
                !event.aiPosition
            ) {
                return false;
            }

            const dx =
                event.aiPosition.x - event.playerPosition.x;
            const dy =
                event.aiPosition.y - event.playerPosition.y;

            const distance = Math.sqrt(dx * dx + dy * dy);

            const directionMagnitude = Math.sqrt(
                event.direction.x * event.direction.x +
                event.direction.y * event.direction.y
            );

            if (distance === 0 || directionMagnitude === 0) {
                return false;
            }

            const dotProduct =
                event.direction.x * dx +
                event.direction.y * dy;

            const alignment =
                dotProduct / (directionMagnitude * distance);

            // Within 45 degrees of the direction toward the AI.
            return alignment >= Math.SQRT1_2;
        });

        const total = events.length;

        const frontalAttackRate =
            attacks.length > 0
                ? frontalAttacks.length / attacks.length
                : 0;

        const dodgeRate =
            total > 0 ? dodges.length / total : 0;

        const retreatRate =
            total > 0 ? retreats.length / total : 0;

        const evidenceCount = total;
        const hasEnoughEvidence = evidenceCount >= 8;

        let detectedPattern = "INSUFFICIENT_DATA";

        if (hasEnoughEvidence) {
            if (
                frontalAttackRate >= 0.6 &&
                attacks.length >= 4
            ) {
                detectedPattern = "REPEATED_ATTACKS";
            } else if (retreatRate >= 0.35) {
                detectedPattern = "FREQUENT_RETREAT";
            } else if (dodgeRate >= 0.35) {
                detectedPattern = "FREQUENT_DODGING";
            } else {
                detectedPattern = "MIXED_BEHAVIOR";
            }
        }

        const confidence = hasEnoughEvidence
            ? Math.min(1, evidenceCount / 20)
            : 0;

        return {
            frontalAttackRate,
            dodgeRate,
            retreatRate,
            evidenceCount,
            detectedPattern,
            confidence,
        };
    }
}
