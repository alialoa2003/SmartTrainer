import { Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer } from '../analysis/BiomechanicalAnalyzer';
import { RepTimestamp, RepPhase } from '../reps/RepCounter';

export class RussianTwistAnalyzer extends BiomechanicalAnalyzer {
    exerciseName = 'Russian Twist';

    // State for Rep Counting (Custom Logic for side-to-side motion)
    private lastXOffset = 0;
    private direction: 'left' | 'right' | 'center' = 'center';
    private repCount = 0;
    private crossedCenter = false;
    private lastPeakTime = 0;
    private currentMidTime = 0;
    private repTimestamps: RepTimestamp[] = [];

    constructor() {
        super();
        this.lastPeakTime = Date.now();
    }

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        // 1. Detect View (Front/Side) - inherited from BiomechanicalAnalyzer
        const view = this.detectView(landmarks);

        // Key Landmarks
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];

        // Midpoints
        const hipCenterX = (leftHip.x + rightHip.x) / 2;
        const wristCenterX = (leftWrist.x + rightWrist.x) / 2;

        let message = "Twist side to side";
        let isGoodForm = true;
        let correction = "";

        // 3. Twist Logic
        // Metric: Horizontal distance of Wrists from Hip Center
        const xOffset = wristCenterX - hipCenterX;

        // Threshold for a "Valid Twist" (must go far enough)
        const twistThreshold = Math.abs(leftShoulder.x - rightShoulder.x) * 0.5;

        // State Machine
        const now = timestamp || Date.now();
        if (Math.abs(xOffset) > twistThreshold) {
            const currentDir = xOffset > 0 ? 'left' : 'right';

            if (currentDir !== this.direction) {
                // Direction Change (Peak)
                if (this.crossedCenter && (now - this.lastPeakTime > 500)) {
                    this.repCount++;
                    this.direction = currentDir;
                    this.crossedCenter = false;

                    // Store timestamp
                    if (this.lastPeakTime > 0) {
                        this.repTimestamps.push({
                            start: this.lastPeakTime,
                            mid: this.currentMidTime || Math.floor((this.lastPeakTime + now) / 2),
                            end: now
                        });
                    }
                    this.lastPeakTime = now;
                    this.currentMidTime = 0;
                }
                this.direction = currentDir;
            }
        }

        // Check Center Crossing
        if ((this.lastXOffset > 0 && xOffset < 0) || (this.lastXOffset < 0 && xOffset > 0)) {
            this.crossedCenter = true;
            this.currentMidTime = now;
        }

        this.lastXOffset = xOffset;

        return {
            score: 100,
            breakdown: { total: 100, stability: 100, rom: 100, posture: 100, efficiency: 100, bracing: 100 },
            reps: this.repCount,
            repPhase: this.direction === 'left' ? 'Twisting Left' : 'Twisting Right',
            message: message,
            correction: correction,
            isGoodForm: isGoodForm,
            detectedExercise: 'Russian Twist'
        };
    }

    private emptyFeedback(): Feedback {
        return {
            score: 0,
            breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
            reps: 0,
            repPhase: 'Rest',
            message: "No Pose",
            isGoodForm: false,
            detectedExercise: 'Russian Twist'
        };
    }

    getRepTimestamps(): RepTimestamp[] {
        return this.repTimestamps;
    }

    private recordingStartTime = 0;
    setRecordingStartTime(timestamp: number): void {
        this.recordingStartTime = timestamp;
    }
}
