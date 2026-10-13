
import { EventTracker } from "./EventTracker";
import { BehaviorProfiler } from "./BehaviorProfiler";
import { StrategyPlanner } from "./StrategyPlanner";
import type {
    AgentDecision,
    BehaviorProfile,
    GameState,
    PlayerEvent,
} from "./types";

export class NeuroClashAgent {
    private readonly eventTracker = new EventTracker(100);
    private readonly behaviorProfiler = new BehaviorProfiler();
    private readonly strategyPlanner = new StrategyPlanner();

    recordPlayerEvent(event: PlayerEvent): void {
        this.eventTracker.record(event);
    }

    getRecentEvents(count = 20): PlayerEvent[] {
        return this.eventTracker.getRecentEvents(count);
    }

    getDecision(state: GameState): AgentDecision {
        const events = this.eventTracker.getAllEvents();
        const profile = this.behaviorProfiler.analyze(events);

        return this.strategyPlanner.chooseStrategy(state, profile);
    }

    getBehaviorProfile(): BehaviorProfile {
        const events = this.eventTracker.getAllEvents();
        return this.behaviorProfiler.analyze(events);
    }

    reset(): void {
        this.eventTracker.clear();
    }
}
