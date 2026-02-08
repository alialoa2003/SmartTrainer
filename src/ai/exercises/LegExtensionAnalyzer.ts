import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter } from '../reps/RepCounter';

export class LegExtensionAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Leg Extension';
    private biomechanics = new LegExtBiomechanics();
    private repCounter = new RepCounter('ConcentricFirst');

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // 1. Rep Completion (Concentric First: 90 -> 180)
        // Standard Machine: Start at 90 deg (flexed), End at 180 deg (straight)
        const leftKneeAngle = this.calculateAngle(landmarks[23], landmarks[25], landmarks[27]);
        const rightKneeAngle = this.calculateAngle(landmarks[24], landmarks[26], landmarks[28]);

        // Use the leg that is more visible or active. For now, avg or max? 
        // Usually bilateral. Let's pick the side visible from camera view.
        // If Side view, pick closest side.
        let kneeAngle = (leftKneeAngle + rightKneeAngle) / 2;

        if (view === 'Side') {
            // Pick closer side based on visibility/z-index or view detection logic
            // Simple heuristic: which hip is more visible? or use view detection result implicit side
            // For simplicity in this codebase, we often use the average or dominant. 
            // Let's stick to the one providing larger range for now (active leg)
            kneeAngle = Math.max(leftKneeAngle, rightKneeAngle);
        }

        // Normalize: 90 degrees = 0.0, 155 degrees = 1.0 (Generous extension target)
        // Range = 65. 
        const normalizedPos = Math.min(1, Math.max(0, (kneeAngle - 90) / 65));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];

        // Feedback Logic
        if (repState.phase === 'Concentric' || repState.phase === 'Top') {
            // ROM feedback (Be more lenient: 145 degrees is sufficient for most)
            if (kneeAngle < 145 && normalizedPos > 0.8) {
                messages.push("Extend More");
            }
        }

        // Stability Feedback (Hips lifting)
        // Relaxed to 145 to accommodate reclined "slope" posture
        const leftHipAngle = this.calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
        const rightHipAngle = this.calculateAngle(landmarks[12], landmarks[24], landmarks[26]);
        const hipAngle = Math.max(leftHipAngle, rightHipAngle);

        if (hipAngle > 145) {
            messages.push("Keep Hips Down");
        }

        // Peak Contraction Tip (Ankle vs Knee Y level)
        // At peak (normalized > 0.9), ankle should be roughly level with knee
        if (normalizedPos > 0.9) {
            const kneeY = (landmarks[25].y + landmarks[26].y) / 2;
            const ankleY = (landmarks[27].y + landmarks[28].y) / 2;
            // In screen coordinates, Y increases downwards. 
            // If ankle is significantly lower than knee, they aren't fully extending.
            // Tolerance?
        }

        const totalScore = (
            pillarScores.rom * 0.4 +
            pillarScores.stability * 0.3 +
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
            jointAngles: { knee: kneeAngle }
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

class LegExtBiomechanics extends BiomechanicalAnalyzer {
    analyzePillars(landmarks: PoseLandmark[], repPhase: string, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: 100, // Seated, less relevant to track spine unless crunching
            efficiency: 100,
            bracing: 100
        };
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number {
        // Did they reach full extension?
        // We can check max extension in history for the current rep?
        // For simple real-time score, mapped to current extension if in contraction phase
        return 100; // Placeholder for complex logic
    }

    protected calculateStability(current: PoseLandmark[], view?: CameraView): number {
        // Penalize if Hips lift (Hip Angle > 130)
        const leftHipAngle = this.calculateAngle(current[11], current[23], current[25]);
        const rightHipAngle = this.calculateAngle(current[12], current[24], current[26]);
        const hipAngle = Math.max(leftHipAngle, rightHipAngle);

        if (hipAngle > 130) return 60; // Penalty
        return 100;
    }
}
