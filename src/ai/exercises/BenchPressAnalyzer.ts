import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class BenchPressAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Bench Press';
    private biomechanics = new BenchPressBiomechanics();
    private repCounter = new RepCounter();

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        // 1. Detect View
        const view = this.biomechanics.detectView(landmarks);

        // 2. Rep Completion (Elbow Extension)
        // Relaxed ROM: 160Â° (Lockout) â†’ 0, 100Â° (Bottom) â†’ 1
        // Previous: (170-angle)/80 was too strict for camera angles.
        const elbowAngle = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const normalizedPos = Math.min(1, Math.max(0, (160 - elbowAngle) / 60));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        // 3. Messages
        let messages: string[] = [];

        if (view === 'Front') {
            // Elbow Flare
            if (pillarScores.efficiency < 70) messages.push("Tuck Elbows");
            // Grip
            if (pillarScores.stability < 70) messages.push("Uneven Grip");
        } else {
            // Side (Bar Path)
            if (pillarScores.efficiency < 70) messages.push("Fix Bar Path");
        }

        const totalScore = (
            pillarScores.stability * 0.3 +
            pillarScores.efficiency * 0.3 + // Flare / Path
            pillarScores.rom * 0.2 +
            pillarScores.bracing * 0.2
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

class BenchPressBiomechanics extends BiomechanicalAnalyzer {
    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: this.calculateEfficiency(landmarks, repPhase, view), // Flare / Path
            bracing: 100
        };
    }

    // Pillar 4: Efficiency (Flare and Path)
    calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        const shoulder = current[12];
        const elbow = current[14];
        const hip = current[24];

        if (view === 'Front') {
            // Angle(Elbow, Shoulder, Hip) aka Arm-Torso angle.
            // 90 = T-pose (Flared). 0 = Arms at sides.
            // Ideal bench: 45-75 degrees.
            const flareAngle = this.calculateAngle(elbow, shoulder, hip);
            if (flareAngle > 75) return 60; // Too flared
            if (flareAngle < 30) return 80; // Too tucked (Tricep heavy)
            return 100;
        } else if (view === 'Side') {
            // Bar Path - Hard single frame. 
            // Check if elbow is directly under wrist? (Forearm vertical)
            // Wrist X vs Elbow X.
            const wrist = current[16];
            const xDiff = Math.abs(wrist.x - elbow.x);
            // If X matches, vertical forearm.
            if (xDiff > 0.1) return 70; // Forearms angled
            return 100;
        }
        return 100;
    }

    // Pillar 1: Stability (Grip Balance)
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') {
            const leftWrist = current[15];
            const rightWrist = current[16];
            // Y level check
            if (Math.abs(leftWrist.y - rightWrist.y) > 0.05) return 60;
        }
        return 100;
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number { return 100; }
}
