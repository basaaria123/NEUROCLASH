
import type { PlayerEvent } from "./types";

export class EventTracker {
    private readonly maxEvents: number;
    private events: PlayerEvent[] = [];

    constructor(maxEvents = 100) {
        this.maxEvents = Math.max(1, maxEvents);
    }

    record(event: PlayerEvent): void {
        if (!Number.isFinite(event.timestamp)) {
            return;
        }

        this.events.push(event);

        // Keep only the most recent events.
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
    }

    getRecentEvents(count = 20): PlayerEvent[] {
        const safeCount = Math.max(0, Math.floor(count));
        if (safeCount === 0) {
            return [];
        }
        return this.events.slice(-safeCount);
    }

    getAllEvents(): PlayerEvent[] {
        return [...this.events];
    }

    getEventCount(): number {
        return this.events.length;
    }

    clear(): void {
        this.events = [];
    }
}
