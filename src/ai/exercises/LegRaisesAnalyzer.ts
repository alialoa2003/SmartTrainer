import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class LegRaisesAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Leg Raises';
    private biomechanics = new LegRaiseBiomechanics();
    // ConcentricFirst: Start at Bottom (Ankle Y max), peek at Top (Ankle Y near Hip Y)
    // 0.0 = Start (Hip Angle 170)
    // 1.0 = Peak (Hip Angle 90)
    private repCounter = new RepCounter({
        mode: 'ConcentricFirst',
        thresholdHigh: 0.70, // Legs reach ~115 deg hip flexion
        thresholdLow: 0.30   // Legs return to ~145 deg
    });

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        // Movement is primarily Hip Flexion
        const leftHip = this.calculateAngle(landmarks[11], landmarks[23], landmarks[25]);
        const rightHip = this.calculateAngle(landmarks[12], landmarks[24], landmarks[26]);
        const hipAngle = (leftHip + rightHip) / 2;

        // Normalize: 170 (0) -> 90 (1)
        const normalizedPos = Math.min(1, Math.max(0, (170 - hipAngle) / 80));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (pillarScores.stability < 70) {
            messages.push(view === 'Side' ? "Control Swing" : "Keep Shoulders Down");
        }
        if (pillarScores.efficiency < 70) messages.push("Straighten Legs");
        if (repState.phase === 'Top' && hipAngle > 100) messages.push("Legs Higher");

        const totalScore = (
            pillarScores.rom * 0.3 +
            pillarScores.stability * 0.3 +
            pillarScores.efficiency * 0.2 +
            pillarScores.bracing * 0.2
        );

        return {
            score: totalScore,
            breakdown: pillarScores,
            reps: repState.count,
            repPhase: repState.phase,
            message: messages.length > 0 ? messages[0] : (repState.phase === 'Rest' ? 'Get Set' : repState.phase),
            correction: messages.join(', '),
            isGoodForm: totalScore > 80,
            jointAngles: { hip: hipAngle }
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

class LegRaiseBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'Leg Raises';

    analyze(landmarks: PoseLandmark[]): any {
        return {};
    }

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view), // Shrugging
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: this.calculateEfficiency(landmarks, repPhase, view), // Control
            bracing: 100
        };
    }

    // Pillar 1: Stability (Anti-Shrug & Anti-Swing)
    protected calculateStability(current: PoseLandmark[], view?: CameraView): number {
        // 1. Anti-Shrug: Shoulders shouldn't move up significantly in history
        if (this.history.length > 5) {
            const firstShoulderY = (this.history[0][11].y + this.history[0][12].y) / 2;
            const currentShoulderY = (current[11].y + current[12].y) / 2;
            const shoulderMovement = Math.abs(currentShoulderY - firstShoulderY);
            if (shoulderMovement > 0.05) return 60; // Flag shrugging/dropping
        }

        if (view === 'Side') {
            // Anti-Swing: Hips shouldn't travel significantly in X relative to shoulders
            const shoulderX = (current[11].x + current[12].x) / 2;
            const hipX = (current[23].x + current[24].x) / 2;
            if (Math.abs(shoulderX - hipX) > 0.15) return 70;
        }

        return 100;
    }

    // Pillar 2: ROM
    protected calculateROM(current: PoseLandmark[], view?: CameraView): number {
        const hipAngle = (this.calculateAngle(current[11], current[23], current[25]) +
            this.calculateAngle(current[12], current[24], current[26])) / 2;
        // Perfect = 90 deg or less
        if (hipAngle <= 90) return 100;
        if (hipAngle <= 110) return 85;
        if (hipAngle <= 130) return 60;
        return 40;
    }

    // Pillar 4: Efficiency (Leg Straightness)
    protected calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        const leftKnee = this.calculateAngle(current[23], current[25], current[27]);
        const rightKnee = this.calculateAngle(current[24], current[26], current[28]);
        const avgKnee = (leftKnee + rightKnee) / 2;

        // User requested straight legs for "Abs" emphasis
        if (avgKnee < 150) return 60; // Too much bend
        if (avgKnee < 165) return 85; // Slight bend
        return 100;
    }
}
