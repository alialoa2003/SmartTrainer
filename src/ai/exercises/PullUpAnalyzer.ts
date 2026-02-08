import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class PullUpAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Pull Up';
    private biomechanics = new PullUpBiomechanics();
    // Pull Up is ConcentricFirst: Start from hanging (Bottom), pull UP to bar (Top), then down
    // Elbow angle mapping: 170° (straight)=0.0, 50° (bent)=1.0
    // thresholdHigh=0.55 → elbow ~104° to reach Top (chin near bar)
    // thresholdLow=0.40 → elbow ~122° to count as Bottom (very forgiving for partial extensions)
    private repCounter = new RepCounter({
        mode: 'ConcentricFirst',
        thresholdHigh: 0.55, // elbow ~104° = Top (realistic pull up peak)
        thresholdLow: 0.40   // elbow ~122° = Bottom (very forgiving)
    });

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // Rep Completion
        const elbowAngle = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const normalizedPos = Math.min(1, Math.max(0, (170 - elbowAngle) / 120));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (view === 'Side') {
            if (pillarScores.stability < 70) messages.push("No Swinging");
            if (repState.phase === 'Top' && pillarScores.rom < 70) messages.push("Chest to Bar");
        } else {
            if (pillarScores.stability < 70) messages.push("Pull Evenly");
        }

        if (repState.phase === 'Bottom' && normalizedPos > 0.1) messages.push("Full Hang");

        const totalScore = (
            pillarScores.rom * 0.4 +
            pillarScores.stability * 0.3 +
            pillarScores.bracing * 0.3
        );

        return {
            score: totalScore,
            breakdown: pillarScores,
            reps: repState.count,
            repPhase: repState.phase,
            message: messages.length > 0 ? messages[0] : repState.phase,
            correction: messages.join(', '),
            isGoodForm: totalScore > 80,
            jointAngles: { elbow: elbowAngle }
        };
    }

    private emptyFeedback(): Feedback {
        return { score: 0, breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 }, reps: 0, repPhase: 'Rest', message: "No Pose", isGoodForm: false };
    }

    getRepTimestamps() {
        return this.repCounter.getRepTimestamps();
    }

    setRecordingStartTime(timestamp: number): void {
        this.repCounter.setRecordingStartTime(timestamp);
    }
}

class PullUpBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'Pull Up';

    // Required by base class but not used - Pull Up uses its own analyze in PullUpAnalyzer
    analyze(landmarks: PoseLandmark[]): any {
        return { score: 0, breakdown: {}, reps: 0, repPhase: 'Rest', message: '', isGoodForm: false };
    }

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view), // Swing / Sym
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: this.calculateEfficiency(landmarks, repPhase, view),
            bracing: 100
        };
    }

    // Pillar 1: Stability (Side: Swing, Front: Sym)
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Side') {
            // Check Hip Swing X-deviation
            // Hard without history.
            // Instant check: Hip X vs Shoulder X.
            // If Hip X is wildly far from Shoulder X, swinging.
            const shoulder = current[12];
            const hip = current[24];

            const xDiff = Math.abs(shoulder.x - hip.x);
            if (xDiff > 0.15) return 60; // Kipping
        } else if (view === 'Front') {
            const leftSh = current[11];
            const rightSh = current[12];
            if (Math.abs(leftSh.y - rightSh.y) > 0.05) return 70; // Shrug uneven
        }
        return 100;
    }

    // Pillar 2: ROM
    calculateROM(current: PoseLandmark[], view?: CameraView): number {
        // Chest to Bar (Side view estimate)
        // Chin vs Wrist Y
        const chin = current[2]; // Nose approx
        const wrist = current[16]; // Right wrist

        if (chin.y < wrist.y) return 100; // Chin over bar
        return 80;
    }
}
