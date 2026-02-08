import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class TBarRowAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'T-Bar Row';
    private biomechanics = new RowBiomechanics();
    private repCounter = new RepCounter();

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        const elbowAngle = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const normalizedPos = Math.min(1, Math.max(0, (170 - elbowAngle) / 90));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (view === 'Side') {
            // Posture Check (Hip Hinge Angle)
            if (pillarScores.posture < 50) {
                messages.push("Bend Over ~45Â°"); // Too upright
            } else if (pillarScores.posture < 60) {
                messages.push("Not So Flat"); // Too bent
            }

            // Bracing Check (Spine & Elbow)
            if (pillarScores.bracing < 60) {
                // Differentiate errors based on severity
                if (pillarScores.bracing < 50) {
                    messages.push("Straighten Back"); // Rounded spine
                } else {
                    messages.push("Tuck Elbows"); // Duck Row - elbows flared
                }
            }
        } else {
            // Front View
            if (pillarScores.stability < 70) messages.push("Even Pull");
        }

        const totalScore = (
            pillarScores.posture * 0.4 +
            pillarScores.bracing * 0.3 +
            pillarScores.rom * 0.3
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

class RowBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'RowBiomechanics';
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

    // Pillar 3: Posture - Torso Angle (Hip Hinge)
    // Target: Torso at 45Â° angle to floor (range 30-60Â°)
    protected calculatePosture(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        const shoulder = current[12];
        const hip = current[24];

        // Calculate torso angle from horizontal
        // dx = horizontal distance, dy = vertical distance
        const dx = Math.abs(shoulder.x - hip.x);
        const dy = Math.abs(shoulder.y - hip.y);

        // Angle in degrees from horizontal
        // atan2(dy, dx) gives angle where 0 = horizontal, 90 = vertical
        const angleFromHorizontal = Math.atan2(dy, dx) * (180 / Math.PI);

        // Target range: 30-60 degrees from horizontal
        // Too upright (>70Â°): Becomes a shrug, not a row
        // Too flat (<20Â°): Too much stress on lower back

        if (angleFromHorizontal > 70) {
            // Too upright - signal "Bend Over ~45Â°"
            return 40;
        }
        if (angleFromHorizontal < 20) {
            // Too flat - signal "Not so bent"
            return 50;
        }
        if (angleFromHorizontal >= 30 && angleFromHorizontal <= 60) {
            // Perfect range
            return 100;
        }
        // Acceptable but not ideal (20-30 or 60-70)
        return 80;
    }

    // Pillar 5: Bracing (Spine & Elbow Tuck)
    protected calculateBracing(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        // Check 1: Spine Neutrality (Ear-Shoulder-Hip line)
        // Even when bent over, these 3 points should form a straight line.
        const ear = current[8];
        const shoulder = current[12];
        const hip = current[24];
        const spineAngle = this.calculateAngle(ear, shoulder, hip);

        if (Math.abs(180 - spineAngle) > 20) return 50; // Rounded back or looking up too much

        // Check 2: Elbow Tuck (User cue: "roughly 30â€“45 degrees from your ribs")
        // Angle between Upper Arm (12-14) and Torso (12-24).
        const elbowTuck = this.calculateAngle(hip, shoulder, current[14]);

        // Target: 30-45.
        // If > 60 -> "Tuck Elbows" (Flare / Duck Row).
        if (elbowTuck > 60) return 60; // "The Duck Row" error

        return 100;
    }

    protected calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Side') return 100;
        // Symmetry
        return 100;
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number { return 100; }
}
