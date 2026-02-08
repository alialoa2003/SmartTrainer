export type RepPhase = 'Rest' | 'Eccentric' | 'Bottom' | 'Concentric' | 'Top';
export type CountMode = 'EccentricFirst' | 'ConcentricFirst';

export interface RepTimestamp {
    start: number;
    mid: number;
    end: number;
}

export class RepCounter {
    private count = 0;
    private currentPhase: RepPhase = 'Rest';
    private lastPhaseTimestamp = 0;
    // More forgiving thresholds for video analysis (where range may vary)
    private thresholdHigh = 0.55; // Target range (Top of Pull Up, Bottom of Squat)
    private thresholdLow = 0.35;  // Start range (Bottom of Pull Up, Standing Squat)
    private mode: CountMode;

    // Timestamp tracking for analytics
    private repTimestamps: RepTimestamp[] = [];
    private currentRepStartTime: number | null = null;
    private currentRepMidTime: number | null = null;
    private recordingStartTime: number = 0;

    constructor(options: CountMode | { mode?: CountMode; thresholdHigh?: number; thresholdLow?: number } = 'EccentricFirst') {
        if (typeof options === 'string') {
            this.mode = options;
        } else {
            this.mode = options.mode || 'EccentricFirst';
            if (options.thresholdHigh !== undefined) this.thresholdHigh = options.thresholdHigh;
            if (options.thresholdLow !== undefined) this.thresholdLow = options.thresholdLow;
        }
    }

    // Set the recording start time for relative timestamps
    setRecordingStartTime(time: number) {
        this.recordingStartTime = time;
    }

    update(completion: number, timestamp?: number): { count: number; phase: RepPhase } {
        const now = timestamp ?? Date.now();
        const currentMs = (now - this.recordingStartTime); // Staying in Milliseconds (Integer)

        if (this.mode === 'EccentricFirst') {
            // Squat, Bench, Pushup (Start 0 -> Down 1 -> Up 0)
            switch (this.currentPhase) {
                case 'Rest':
                case 'Top': // Conceptually Start
                    if (completion > this.thresholdLow) {
                        this.currentPhase = 'Eccentric'; // Descending
                        // Start tracking rep time
                        if (this.currentRepStartTime === null) {
                            this.currentRepStartTime = currentMs;
                        }
                    }
                    break;
                case 'Eccentric':
                    if (completion >= this.thresholdHigh) {
                        this.currentPhase = 'Bottom'; // Deepest point
                        this.lastPhaseTimestamp = now;
                        this.currentRepMidTime = currentMs; // Peak of descent
                    } else if (completion < this.thresholdLow) {
                        this.currentPhase = 'Top'; // False start
                        this.currentRepStartTime = null;
                        this.currentRepMidTime = null;
                    }
                    break;
                case 'Bottom':
                    if (completion < this.thresholdHigh - 0.1) {
                        this.currentPhase = 'Concentric'; // Ascending
                    }
                    break;
                case 'Concentric':
                    if (completion <= this.thresholdLow) {
                        this.count++;
                        this.currentPhase = 'Top';
                        this.lastPhaseTimestamp = now;
                        // Record completed rep timestamp
                        if (this.currentRepStartTime !== null) {
                            this.repTimestamps.push({
                                start: this.currentRepStartTime,
                                mid: this.currentRepMidTime || currentMs, // Fallback to current if mid wasn't caught
                                end: currentMs
                            });
                            this.currentRepStartTime = null;
                            this.currentRepMidTime = null;
                        }
                    } else if (completion > this.thresholdHigh) {
                        this.currentPhase = 'Bottom'; // Failed, sank back down
                    }
                    break;
            }
        } else {
            // ConcentricFirst: Curl, Pullup, Lat Raise (Start 0 -> Up 1 -> Down 0)
            switch (this.currentPhase) {
                case 'Rest':
                case 'Bottom': // Conceptually Start (Arms Down)
                    if (completion > this.thresholdLow) {
                        this.currentPhase = 'Concentric'; // Lifting
                        // Start tracking rep time
                        if (this.currentRepStartTime === null) {
                            this.currentRepStartTime = currentMs;
                        }
                    }
                    break;
                case 'Concentric':
                    if (completion >= this.thresholdHigh) {
                        this.currentPhase = 'Top'; // Peak Contraction
                        this.lastPhaseTimestamp = now;
                        this.currentRepMidTime = currentMs; // Peak of contraction
                    } else if (completion < this.thresholdLow) {
                        this.currentPhase = 'Bottom'; // False start
                        this.currentRepStartTime = null;
                        this.currentRepMidTime = null;
                    }
                    break;
                case 'Top':
                    if (completion < this.thresholdHigh - 0.1) {
                        this.currentPhase = 'Eccentric'; // Lowering
                    }
                    break;
                case 'Eccentric':
                    if (completion <= this.thresholdLow) {
                        this.count++;
                        this.currentPhase = 'Bottom';
                        this.lastPhaseTimestamp = now;
                        // Record completed rep timestamp
                        if (this.currentRepStartTime !== null) {
                            this.repTimestamps.push({
                                start: this.currentRepStartTime,
                                mid: this.currentRepMidTime || currentMs, // Fallback
                                end: currentMs
                            });
                            this.currentRepStartTime = null;
                            this.currentRepMidTime = null;
                        }
                    } else if (completion > this.thresholdHigh) {
                        this.currentPhase = 'Top'; // Failed, went back up
                    }
                    break;
            }
        }

        return { count: this.count, phase: this.currentPhase };
    }

    getCount() { return this.count; }
    getRepTimestamps() { return [...this.repTimestamps]; }
    reset() {
        this.count = 0;
        this.currentPhase = 'Rest';
        this.repTimestamps = [];
        this.currentRepStartTime = null;
        this.currentRepMidTime = null;
    }
}

