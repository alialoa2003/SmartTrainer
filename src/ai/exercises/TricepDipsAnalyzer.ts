import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class TricepDipsAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Tricep Dips';
    private biomechanics = new DipsBiomechanics();
    // EccentricFirst: Start High (Lockout), Go Low (Eccentric), Return High (Concentric)
    // Normalization: 0.0 (180 deg) -> 1.0 (90 deg)
    private repCounter = new RepCounter({
        mode: 'EccentricFirst',
        thresholdLow: 0.25, // Start descending when elbows bend past ~158 deg
        thresholdHigh: 0.65 // Hit bottom/turnaround when deeper than ~122 deg
    });

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // 1. Joint Angles
        const leftElbow = this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        const rightElbow = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const elbowAngle = (leftElbow + rightElbow) / 2; // Average for robustness

        // 2. Normalization
        // Start: 180 (Lockout) -> 0.0
        // End: 90 (Bottom) -> 1.0
        const normalizedPos = Math.min(1, Math.max(0, (180 - elbowAngle) / 90));

        // 3. Rep Counting
        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        // 4. Feedback Generation
        let messages: string[] = [];

        // Depth feedback
        if (repState.phase === 'Bottom' || repState.phase === 'Eccentric') {
            // If we are deep in the rep?
        }

        // "Go Deeper" if at turnaround but > 100 deg
        if (repState.phase === 'Bottom' && elbowAngle > 100) {
            messages.push("Go Deeper");
        }

        if (pillarScores.posture < 70) messages.push("Torso Upright");
        if (pillarScores.stability < 70) messages.push("Shoulders Down"); // Anti-Shrug
        if (pillarScores.efficiency < 70) messages.push("Elbows In");

        const totalScore = (
            pillarScores.rom * 0.4 +
            pillarScores.posture * 0.3 +
            pillarScores.stability * 0.3
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

class DipsBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'Tricep Dips';
    analyze(l: PoseLandmark[]) { return {} as any; } // Dummy impl

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view), // Elbow Width
            rom: this.calculateROM(landmarks, view),
            posture: this.calculatePosture(landmarks, view), // Lean
            efficiency: this.calculateEfficiency(landmarks, repPhase, view),
            bracing: 100
        };
    }

    // Stability: Shoulder Depression (Anti-Shrug)
    private checkShoulderDepression(current: PoseLandmark[]): number {
        // Compare Ear (7/8) to Shoulder (11/12) distance relative to Torso length
        // Low distance = Shrugged
        const leftEar = current[7];
        const leftShoulder = current[11];
        const leftHip = current[23];

        if (!leftEar || !leftShoulder || !leftHip) return 100;

        const torsoLen = Math.abs(leftShoulder.y - leftHip.y);
        const neckLen = Math.abs(leftEar.y - leftShoulder.y);

        // Heuristic: Neck length > 15% of torso
        if (neckLen < torsoLen * 0.15) return 60; // Shrugged
        return 100;
    }

    // Posture: Torso Lean (Side View)
    calculatePosture(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        const shoulder = current[11];
        const hip = current[23];
        if (!shoulder || !hip) return 100;

        // Vertical check
        const angle = this.calculateAngle({ x: hip.x, y: hip.y - 100, z: 0, visibility: 1 } as any, hip, shoulder);

        if (Math.abs(angle) > 45) return 60; // Allow 45 deg lean (was 30)
        return 100;
    }

    // Efficiency: Elbow Flare (Front View)
    calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        if (view === 'Side') return 100;

        const shoulder = current[11];
        const elbow = current[13];
        const hip = current[23];
        if (!shoulder || !elbow || !hip) return 100;

        const angle = this.calculateAngle(elbow, shoulder, hip);
        if (angle > 45) return 60;
        return 100;
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number { return 100; }


}
