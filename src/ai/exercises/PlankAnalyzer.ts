import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer } from '../analysis/BiomechanicalAnalyzer';

export class PlankAnalyzer extends BiomechanicalAnalyzer {
    exerciseName = 'Plank';

    // Time Tracking
    private accumulatedSeconds = 0;
    private lastFrameTime = 0;
    private isHolding = false;
    private bufferTime = 0; // Buffer to prevent flickering

    constructor() {
        super();
        // Removed weightings as it doesn't exist on base class yet
    }

    // Auto-Detect Helper: Start with pre-accumulated time
    setElapsedTime(seconds: number) {
        this.accumulatedSeconds = seconds;
        this.isHolding = true; // Assume good form if we locked it
    }

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        const now = Date.now();
        if (this.lastFrameTime === 0) this.lastFrameTime = now;
        const deltaTime = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        // 1. Detect View & Side
        // Base detectView returns 'Side', so we check visibility to know WHICH side.
        const leftHipVisibility = landmarks[23].visibility || 0;
        const rightHipVisibility = landmarks[24].visibility || 0;
        const isLeftSide = leftHipVisibility > rightHipVisibility;

        let shoulder, hip, knee, ankle, elbow;

        if (isLeftSide) {
            shoulder = landmarks[11];
            hip = landmarks[23];
            knee = landmarks[25];
            ankle = landmarks[27];
            elbow = landmarks[13];
        } else {
            shoulder = landmarks[12];
            hip = landmarks[24];
            knee = landmarks[26];
            ankle = landmarks[28];
            elbow = landmarks[14];
        }

        // Body Line (Shoulder - Hip - Knee) - Target 180
        const hipAngle = this.calculateAngle(shoulder, hip, knee);

        // Knee Line (Hip - Knee - Ankle) - Target 180 (Legs straight)
        const kneeAngle = this.calculateAngle(hip, knee, ankle);

        // 3. Analyze Form (The "Perfect Plank")
        let message = "Hold position";
        let correction = "";
        let isGoodForm = true;

        // A. Hip Analysis (Sagging vs Pike)
        // Pike: Hips significantly higher than the line connecting shoulder and knee (Angle < 165 usually)
        if (hipAngle < 165) {
            message = "Hips too high";
            correction = "Lower hips to form straight line";
            isGoodForm = false;
        }

        // Sagging: Hip Y is lower than the line between shoulder and heel/knee
        // We can check Hip Y relative to Shoulder Y. 
        // In a plank, Shoulder Y and Hip Y should be relatively close (horizontal body).
        // If Hip Y is much larger (lower on screen) than Shoulder Y, that's possible sagging or incline.
        // Better: Compare Hip Y to Midpoint(Shoulder Y, Knee Y).
        const midY = (shoulder.y + knee.y) / 2;
        // If Hip is significantly below the line (Y increases down)
        if (hip.y > midY + 0.05) {
            message = "Hips sagging";
            correction = "Lift hips & squeeze glutes";
            isGoodForm = false;
        }

        // B. Knee Analysis
        if (kneeAngle < 160) {
            message = "Legs bent";
            correction = "Straighten your legs";
            isGoodForm = false;
        }

        // 4. Timer Logic
        if (isGoodForm) {
            this.bufferTime += deltaTime;
            if (this.bufferTime > 0.5) { // 0.5s buffer to start counting
                this.isHolding = true;
                this.accumulatedSeconds += deltaTime;
                message = "Good Plank! Hold it!";
            } else {
                message = "Stabilizing...";
            }
        } else {
            this.isHolding = false;
            this.bufferTime = 0; // Reset buffer on break
        }

        // 5. Score Calculation
        const stabilityScore = isGoodForm ? 1.0 : 0.5;
        const postureScore = Math.max(0, 1 - (Math.abs(180 - hipAngle) / 40));

        return {
            score: (stabilityScore + postureScore) / 2,
            breakdown: {
                total: stabilityScore,
                stability: stabilityScore,
                rom: 0,
                posture: postureScore,
                efficiency: 1,
                bracing: isGoodForm ? 1 : 0.5
            },
            reps: Math.floor(this.accumulatedSeconds), // Seconds as Reps
            repPhase: this.isHolding ? 'Holding' : 'Resisted', // 'Rest' implies stopped, 'Resisted' implies working? Or just Rest.
            message: message,
            correction: correction,
            isGoodForm: isGoodForm,
            jointAngles: {
                hip: hipAngle,
                knee: kneeAngle
            }
        };
    }

    getRepTimestamps() {
        return []; // Plank uses time tracking, not rep counting
    }

    private recordingStartTime = 0;
    setRecordingStartTime(timestamp: number): void {
        this.recordingStartTime = timestamp;
    }
}
