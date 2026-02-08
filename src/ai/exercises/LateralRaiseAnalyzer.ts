import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class LateralRaiseAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Lateral Raises';
    private biomechanics = new LatRaiseBiomechanics();
    private repCounter = new RepCounter('ConcentricFirst');

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // Rep Completion
        // Angle: Angle between Torso (24-12) and Arm (12-14).
        // Rest: ~15 deg. Top: ~90 deg.
        const shoulderAngle = this.calculateAngle(landmarks[24], landmarks[12], landmarks[14]);

        // Map 20 deg (Rest) -> 0.0
        // Map 85 deg (Top) -> 1.0
        const normalizedPos = Math.min(1, Math.max(0, (shoulderAngle - 20) / 65));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (view === 'Front') {
            if (pillarScores.stability < 70) messages.push("Arm Height Even");
            if (pillarScores.efficiency < 70) messages.push("Lead w/ Elbows");
        } else {
            if (pillarScores.posture < 70) messages.push("Hands fwd (Scap Plane)");
        }

        const totalScore = (
            pillarScores.rom * 0.4 +
            pillarScores.efficiency * 0.3 +
            pillarScores.posture * 0.3
        );

        return {
            score: totalScore,
            breakdown: pillarScores,
            reps: repState.count,
            repPhase: repState.phase,
            message: messages.length > 0 ? messages[0] : repState.phase,
            correction: messages.join(', '),
            isGoodForm: totalScore > 80,
            jointAngles: { shoulder: shoulderAngle }
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

class LatRaiseBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'LatRaiseBiomechanics';
    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback { return {} as Feedback; }

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: this.calculatePosture(landmarks, view), // Scap Plane
            efficiency: this.calculateEfficiency(landmarks, repPhase, view), // Elbow Lead
            bracing: 100
        };
    }

    // Pillar 3: Posture (Side: Scap Plane)
    calculatePosture(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        // Scapular plane: Arms 30 deg forward relative to torso.
        // Side view: Wrist Z should be close to Shoulder Z? No, 2D side view excludes Z.
        // Side view: Wrist X should be in front of Shoulder X.
        const shoulder = current[12];
        const wrist = current[16];

        // If Wrist X < Shoulder X (assuming facing right), good.
        // Just check diff.
        const xDiff = Math.abs(wrist.x - shoulder.x);
        if (xDiff < 0.05) return 70; // Too straight to side (bad for cuff)
        return 100;
    }

    // Pillar 4: Efficiency (Front: Elbow Lead)
    protected calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        if (view === 'Side') return 100;

        const elbow = current[14];
        const wrist = current[16];

        // Wrist shouldn't be much higher than elbow
        if (wrist.y < elbow.y - 0.05) return 60;
        return 100;
    }

    // Pillar 1: Stability (Front: Symmetry)
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Side') return 100;
        // Left arm angle vs Right arm angle comparison
        return 100; // Placeholder
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number { return 100; }
}
