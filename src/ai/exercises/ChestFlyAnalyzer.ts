import { ExerciseAnalyzer, Feedback, PoseLandmark, ScoreBreakdown } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class ChestFlyAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Chest Fly Machine';
    private biomechanics = new FlyBiomechanics();
    private repCounter = new RepCounter();

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // Rep Logic: Use Angle of Adduction (Shoulder-to-Elbow vector against horizontal?)
        // Better: Angle between Left Arm vector and Right Arm vector.
        // Vector L: 11->13. Vector R: 12->14.

        // Simpler heuristic for 2D: Wrist Distance relative to Shoulder Width is robust if Z is handled.
        // Issue with previous logic: '3 * width' might be too wide.
        // Let's debug: Wide = 3x shoulder width. Closed = 0.5x shoulder width.

        const wristDist = Math.abs(landmarks[16].x - landmarks[15].x);
        let shoulderDist = Math.abs(landmarks[12].x - landmarks[11].x);
        if (shoulderDist === 0) shoulderDist = 0.1;

        // Ratio: 
        // Closed (Hands touching): Ratio ~ 0.
        // Open (Arms wide): Ratio ~ 3-4.

        const ratio = wristDist / shoulderDist;

        // Rep Start (Open): Ratio > 2.5
        // Rep End (Closed): Ratio < 0.5
        // Rep Progress (0 to 1): 1 - ((Ratio - 0.5) / 2.0)
        // If Ratio = 2.5 -> 1 - 1 = 0.
        // If Ratio = 0.5 -> 1 - 0 = 1.

        let normalizedPos = 1 - ((ratio - 0.5) / 2.0);
        normalizedPos = Math.max(0, Math.min(1, normalizedPos));

        const repState = this.repCounter.update(normalizedPos, timestamp);

        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (view === 'Side') {
            if (pillarScores.rom < 70) messages.push("Don't Press");
        } else {
            if (pillarScores.stability < 70) messages.push("Balance Arms");
        }

        const totalScore = (
            pillarScores.rom * 0.5 +
            pillarScores.stability * 0.5
        );

        return {
            score: totalScore,
            breakdown: pillarScores,
            reps: repState.count,
            repPhase: repState.phase,
            message: messages.length > 0 ? messages[0] : repState.phase,
            correction: messages.join(', '),
            isGoodForm: totalScore > 80,
            jointAngles: { elbow: 0 }
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

class FlyBiomechanics extends BiomechanicalAnalyzer {
    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view?: CameraView): ScoreBreakdown {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: 100,
            bracing: 100,
            total: 0
        };
    }

    // Pillar 2: ROM/Efficiency (Side: Elbow Angle)
    calculateROM(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        // Check Elbow Angle. Should be ~150-160 fixed.
        // If < 120, it's a press.
        // Side view: calculate angle for arm.
        const elbowAngle = this.calculateAngle(current[12], current[14], current[16]);

        if (elbowAngle < 120) return 50; // Turning fly into press
        return 100;
    }

    // Pillar 1: Stability (Front: Symmetry)
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Side') return 100;

        // Arm heights (Elbow Y)
        const diff = Math.abs(current[13].y - current[14].y);
        if (diff > 0.1) return 60;
        return 100;
    }

}
