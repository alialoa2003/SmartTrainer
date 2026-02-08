import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class PushUpAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Push Up';
    private biomechanics = new PushUpBiomechanics();
    // Push Up is EccentricFirst: Starts at Top (Arms Straight), Goes Down (Eccentric), Then Up (Concentric)
    // Mapping:
    // 0.0 (Top) = Elbows Extended (170°) - Relaxed anchor
    // 1.0 (Bottom) = Elbows Flexed (90°)
    private repCounter = new RepCounter({
        mode: 'EccentricFirst',
        thresholdHigh: 0.60, // Depth: Passed 60% of ROM (approx 122 deg elbow)
        thresholdLow: 0.35   // Top: Return to Top 35% (approx 142 deg elbow) - Much easier to reset
    });

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // Rep Completion Logic
        const leftElbow = this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        const rightElbow = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const elbowAngle = (leftElbow + rightElbow) / 2;

        // Normalize:
        // Angle 170 -> 0.0 (Top)
        // Angle 90 -> 1.0 (Bottom) (Divisor was 80, so 170-80 = 90)
        const normalizedPos = Math.min(1, Math.max(0, (170 - elbowAngle) / 80));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        // Feedback Logic
        if (pillarScores.bracing < 70) messages.push("Tighten Core"); // Hip Sag
        if (pillarScores.posture < 70) messages.push("Straight Body");
        if (repState.phase === 'Bottom' && pillarScores.rom < 70) messages.push("Go Lower");

        const totalScore = (
            pillarScores.rom * 0.3 +
            pillarScores.stability * 0.2 +
            pillarScores.bracing * 0.3 +
            pillarScores.posture * 0.2
        );

        return {
            score: totalScore,
            breakdown: pillarScores,
            reps: repState.count,
            repPhase: repState.phase,
            message: messages.length > 0 ? messages[0] : (repState.phase === 'Rest' ? 'Get Set' : repState.phase),
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

class PushUpBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'Push Up';

    analyze(landmarks: PoseLandmark[]): any {
        return {};
    }

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: this.calculatePosture(landmarks, view),
            efficiency: this.calculateEfficiency(landmarks, repPhase, view),
            bracing: this.calculateBracing(landmarks, view), // Core/Hips - Moving Plank
            total: 0
        };
    }

    // Pillar: Bracing (Anti-Extension)
    // "Moving Plank" - Hips should not sag
    calculateBracing(lm: PoseLandmark[], view?: CameraView): number {
        // Shoulder, Hip, Knee Alignment (Side View)
        // Angle should be ~180. < 160 means sagging hips.
        const leftHipAngle = this.calculateAngle(lm[11], lm[23], lm[25]);
        const rightHipAngle = this.calculateAngle(lm[12], lm[24], lm[26]);
        const hipAngle = (leftHipAngle + rightHipAngle) / 2;

        if (hipAngle < 150) return 60; // Sagging heavily
        if (hipAngle < 165) return 80; // Mild sag
        if (hipAngle > 190) return 70; // Pike (butt up)
        return 100;
    }

    // Pillar: ROM
    // Chest to floor or elbows 90 deg
    calculateROM(lm: PoseLandmark[], view?: CameraView): number {
        // We check if they are DEEP enough relative to strict pushup biomechanics
        const elbowAngle = (this.calculateAngle(lm[11], lm[13], lm[15]) + this.calculateAngle(lm[12], lm[14], lm[16])) / 2;
        // Ideally we'd track min elbow angle over the rep.
        // For static frame analysis, we assume 100 unless detected otherwise in a comprehensive manner.
        return 100;
    }

    // Pillar: Stability (Wobble)
    calculateStability(lm: PoseLandmark[], view?: CameraView): number {
        return 100;
    }
}
