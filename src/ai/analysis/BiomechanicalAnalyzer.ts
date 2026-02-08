import { PoseLandmark, ScoreBreakdown } from '../ExerciseAnalyzer';
import { RepPhase } from '../reps/RepCounter';

export type CameraView = 'Front' | 'Side' | '45' | 'Unknown';

export abstract class BiomechanicalAnalyzer {
    protected history: PoseLandmark[][] = [];
    protected readonly maxHistoryLength = 30; // 1 second @ 30fps

    // Detect View based on Shoulder alignment
    detectView(landmarks: PoseLandmark[]): CameraView {
        if (landmarks.length < 33) return 'Unknown';

        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];

        // Calculate 2D Width (X-axis separation)
        const xDiff = Math.abs(leftShoulder.x - rightShoulder.x);

        // Calculate 3D Depth (Z-axis separation, if available)
        // Visbility check? usually valid.
        // Note: MediaPipe Z is relative to hip center usually.
        const zDiff = Math.abs((leftShoulder.z || 0) - (rightShoulder.z || 0));

        // Ratio: Z / X
        // Front View: X is large, Z is small. Ratio ~ 0.
        // Side View: X is small, Z is large. Ratio > 1.

        if (xDiff === 0) return 'Side'; // Avoid divide by zero, highly likely side

        const ratio = zDiff / xDiff;

        // Thresholds need tuning.
        // Front: < 0.5
        // 45: 0.5 - 1.5
        // Side: > 1.5

        if (ratio < 0.5) return 'Front';
        if (ratio > 1.5) return 'Side';
        return '45';
    }

    // Reset analysis for a new set
    reset() {
        this.history = [];
    }

    // Core Analysis Method
    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view?: CameraView): ScoreBreakdown {
        // Maintain history for stability/efficiency calcs
        this.history.push(landmarks);
        if (this.history.length > this.maxHistoryLength) this.history.shift();

        return {
            total: 0, // Calculated by the specific Exercise class
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: this.calculatePosture(landmarks, view),
            efficiency: this.calculateEfficiency(landmarks, repPhase, view),
            bracing: this.calculateBracing(landmarks, view)
        };
    }

    // --- PILLAR 1: STABILITY (Wobble Detection) ---
    // Calculates lateral deviation of knees/elbows over time
    protected calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (this.history.length < 5) return 100;

        // Example Generic: Variance of Center of Mass X-coord
        // Specific exercises will override this (e.g., Squat checks Knee X-wobble)
        return 100;
    }

    // --- PILLAR 2: ROM (Range of Motion) ---
    // --- PILLAR 2: ROM (Range of Motion) ---
    protected calculateROM(current: PoseLandmark[], view?: CameraView): number {
        return 100;
    }

    // --- PILLAR 3: POSTURE (Joint Stacking) ---
    protected calculatePosture(current: PoseLandmark[], view?: CameraView): number {
        // Default: Vertical align of Head-Shoulder-Hip (Standing posture)
        const ear = current[8]; // Right Ear
        const shoulder = current[12];
        const hip = current[24];

        // Deviation from vertical line
        const angle = this.calculateAngle(ear, shoulder, hip);
        // Ideal is 180 (straight line)
        const deviation = Math.abs(180 - angle);
        return Math.max(0, 100 - (deviation * 2)); // Penalty
    }

    // --- PILLAR 4: EFFICIENCY (Bar Path / Tempo) ---
    protected calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        // Bar Path deviation (Straight line is usually efficient for compound lifts)
        return 100;
    }

    // --- PILLAR 5: BRACING (Spinal Integrity) ---
    protected calculateBracing(current: PoseLandmark[], view?: CameraView): number {
        // Check Hip hinge maintenance?
        // Check if chest collapses?
        return 100;
    }

    // --- UTILS ---
    protected calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
        const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs((radians * 180.0) / Math.PI);
        if (angle > 180.0) angle = 360 - angle;
        return angle;
    }
}
