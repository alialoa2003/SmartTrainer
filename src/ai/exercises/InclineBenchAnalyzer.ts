import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

export class InclineBenchAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Incline Bench Press';
    private biomechanics = new InclineBiomechanics();
    private repCounter = new RepCounter({
        mode: 'EccentricFirst',
        thresholdHigh: 0.75, // Bottom: Must reach ~95 deg
        thresholdLow: 0.25   // Top: Must reset to ~145 deg
    });

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        const view = this.biomechanics.detectView(landmarks);

        const leftElbow = this.calculateAngle(landmarks[11], landmarks[13], landmarks[15]);
        const rightElbow = this.calculateAngle(landmarks[12], landmarks[14], landmarks[16]);
        const elbowAngle = (leftElbow + rightElbow) / 2;

        const normalizedPos = Math.min(1, Math.max(0, (170 - elbowAngle) / 100));

        const repState = this.repCounter.update(normalizedPos, timestamp);
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        let messages: string[] = [];
        if (view === 'Front') {
            if (pillarScores.efficiency < 70) messages.push("Tuck Elbows");
        } else {
            if (pillarScores.efficiency < 70) messages.push("Touch Upper Chest");
        }

        const totalScore = (
            pillarScores.stability * 0.3 +
            pillarScores.efficiency * 0.3 +
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

class InclineBiomechanics extends BiomechanicalAnalyzer {
    exerciseName = 'Incline Bench Press';

    analyze(landmarks: PoseLandmark[]): any {
        return {};
    }

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: 100,
            efficiency: this.calculateEfficiency(landmarks, repPhase, view), // Elbow Flare
            bracing: 100
        };
    }

    // Pillar 4: Efficiency (Side: Bar Path, Front: Elbow Flare)
    protected calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        if (view === 'Front') {
            // Elbow Tuck: 45-60 deg as per user request
            const leftShoulder = current[11];
            const leftElbow = current[13];
            const leftHip = current[23];
            const leftAngle = this.calculateAngle(leftElbow, leftShoulder, leftHip);

            const rightShoulder = current[12];
            const rightElbow = current[14];
            const rightHip = current[24];
            const rightAngle = this.calculateAngle(rightElbow, rightShoulder, rightHip);

            const angle = (leftAngle + rightAngle) / 2;
            // "Elbows should be tucked at a 45° to 60° angle"
            if (angle > 70) return 60; // Flag if flaring > 70
            if (angle < 30) return 70; // Flag if too narrow (though rare)
            return 100;
        } else {
            // Side View: Path should be slight arc toward face
            // ROM check below handles depth
            return 100;
        }
    }

    protected calculateROM(current: PoseLandmark[], view?: CameraView): number {
        // "Starting/Lockout Position (Top): Elbow Angle: 180°"
        // "Bottom Position (The Touch): Elbow Angle: Typically 30° to 45°"
        const leftElbow = this.calculateAngle(current[11], current[13], current[15]);
        const rightElbow = this.calculateAngle(current[12], current[14], current[16]);
        const elbowAngle = (leftElbow + rightElbow) / 2;

        if (elbowAngle < 45) return 100; // Perfect depth
        if (elbowAngle < 60) return 85;
        if (elbowAngle < 90) return 60;
        return 40;
    }
}
