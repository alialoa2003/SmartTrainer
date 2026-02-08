import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class BicepCurlAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Bicep Curl';
    private biomechanics = new CurlBiomechanics();
    private repCounter = new RepCounter();

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // Rep Completion
        const elbowAngle = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const normalizedPos = Math.min(1, Math.max(0, (160 - elbowAngle) / 100));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (view === 'Side') {
            if (pillarScores.stability < 70) messages.push("Pin Elbows"); // Drift
        } else {
            if (pillarScores.efficiency < 70) messages.push("Elbows In"); // Flare
        }

        if (repState.phase === 'Bottom' && normalizedPos > 0.1) messages.push("Full Extension");

        const totalScore = (
            pillarScores.rom * 0.4 +
            pillarScores.stability * 0.4 +
            pillarScores.efficiency * 0.2
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

    getRepTimestamps() {
        return this.repCounter.getRepTimestamps();
    }

    setRecordingStartTime(timestamp: number): void {
        this.repCounter.setRecordingStartTime(timestamp);
    }

    private emptyFeedback(): Feedback {
        return { score: 0, breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 }, reps: 0, repPhase: 'Rest', message: "No Pose", isGoodForm: false };
    }
}

class CurlBiomechanics extends BiomechanicalAnalyzer {
    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: this.calculateEfficiency(landmarks, repPhase, view), // Elbow Flare
            bracing: 100
        };
    }

    // Pillar 1: Stability (Side: Elbow Swing)
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        // Elbow X relative to Shoulder X. Should remain relatively fixed.
        // If Elbow moves forward significantly > swing.
        const shoulder = current[12];
        const elbow = current[14];

        // Difference in X
        const diff = Math.abs(shoulder.x - elbow.x);

        // Threshold depends on arm length, but say 0.15 is too much.
        if (diff > 0.15) return 60;
        return 100;
    }

    // Pillar 4: Efficiency (Side: Elbow stability)
    calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        if (view === 'Side') return 100;

        const shoulder = current[12];
        const elbow = current[14];
        const hip = current[24];
        const angle = this.calculateAngle(elbow, shoulder, hip);

        if (angle > 30) return 60; // Flared out
        return 100;
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number { return 100; }
}
