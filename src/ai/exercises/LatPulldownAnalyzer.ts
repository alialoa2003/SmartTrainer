import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class LatPulldownAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Lat Pulldown';
    private biomechanics = new LatBiomechanics();
    private repCounter = new RepCounter();

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        // 1. Detect View
        const view = this.biomechanics.detectView(landmarks);

        // 2. Rep Completion
        const elbowAngle = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const normalizedPos = Math.min(1, Math.max(0, (170 - elbowAngle) / 100));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        // 3. Messages
        let messages: string[] = [];
        if (view === 'Front') {
            if (pillarScores.stability < 70) messages.push("Pull Evenly"); // Symmetry
        } else {
            if (pillarScores.posture < 60) messages.push("Less Lean"); // Lean back
        }

        // Check Full Extension
        if (repState.phase === 'Top' && normalizedPos < 0.2 && elbowAngle < 150) messages.push("Full Stretch");

        const totalScore = (
            pillarScores.stability * 0.3 +
            pillarScores.posture * 0.3 +
            pillarScores.rom * 0.4
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

class LatBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'LatBiomechanics';
    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback { return {} as Feedback; }
    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: this.calculateEfficiency(landmarks, repPhase, view),
            bracing: 100
        };
    }

    // Pillar 3: Posture (Side: Lean)
    calculatePosture(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        // Lean angle
        const shoulder = current[12];
        const hip = current[24];

        // Angle vs Vertical
        const angle = this.calculateAngle({ x: hip.x, y: hip.y - 100, z: 0, visibility: 1 } as any, hip, shoulder);

        // Optimal: 10-20 deg.
        // If > 30, penalty.
        if (Math.abs(angle) > 30) return 40;
        return 100;
    }

    // Pillar 1: Stability (Front: Symmetry)
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Side') return 100;

        // Wrist Height diff
        const leftW = current[15];
        const rightW = current[16];

        if (Math.abs(leftW.y - rightW.y) > 0.05) return 60;
        return 100;
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number { return 100; }
}
