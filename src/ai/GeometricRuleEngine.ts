import { ExerciseAnalyzer, Feedback, PoseLandmark, ExerciseType } from './ExerciseAnalyzer';
import { SquatAnalyzer } from './exercises/SquatAnalyzer';
import { PushUpAnalyzer } from './exercises/PushupAnalyzer';
import { BenchPressAnalyzer } from './exercises/BenchPressAnalyzer';
import { PullUpAnalyzer } from './exercises/PullUpAnalyzer';
import { BicepCurlAnalyzer } from './exercises/BicepCurlAnalyzer';
import { PlankAnalyzer } from './exercises/PlankAnalyzer';
import { RussianTwistAnalyzer } from './exercises/RussianTwistAnalyzer';
import { LegExtensionAnalyzer } from './exercises/LegExtensionAnalyzer';
import { LegRaisesAnalyzer } from './exercises/LegRaisesAnalyzer';
import { InclineBenchAnalyzer } from './exercises/InclineBenchAnalyzer';
import { ChestFlyAnalyzer } from './exercises/ChestFlyAnalyzer';
import { TricepDipsAnalyzer } from './exercises/TricepDipsAnalyzer';
import { TBarRowAnalyzer } from './exercises/TBarRowAnalyzer';
import { LatPulldownAnalyzer } from './exercises/LatPulldownAnalyzer';
import { LateralRaiseAnalyzer } from './exercises/LateralRaiseAnalyzer';

import { classifyExercise } from './ExerciseClassifier';

export class GeometricRuleEngine {
    private analyzers: Record<ExerciseType, ExerciseAnalyzer>;
    private currentExercise: ExerciseType = 'Squat';

    // Locking Mechanism
    private isLocked: boolean = false;
    private lockedExercise: ExerciseType | null = null;
    private consecutiveFrames: number = 0;
    private potentialExercise: ExerciseType | null = null;
    private shoulderHistory: number[] = [];

    constructor() {
        this.analyzers = {
            // Legs
            'Squat': new SquatAnalyzer(),
            'Leg Extension': new LegExtensionAnalyzer(),
            'Leg Raises': new LegRaisesAnalyzer(),

            // Push
            'Push Up': new PushUpAnalyzer(),
            'Bench Press': new BenchPressAnalyzer(),
            'Incline Bench Press': new InclineBenchAnalyzer(),
            'Chest Fly Machine': new ChestFlyAnalyzer(),
            'Tricep Dips': new TricepDipsAnalyzer(),

            // Pull
            'Pull Up': new PullUpAnalyzer(),
            'Lat Pulldown': new LatPulldownAnalyzer(),
            'T-Bar Row': new TBarRowAnalyzer(),
            'Barbell Biceps Curl': new BicepCurlAnalyzer(),
            'Lateral Raises': new LateralRaiseAnalyzer(),

            // Core
            'Plank': new PlankAnalyzer(),
            'Russian Twist': new RussianTwistAnalyzer(),
            'Auto-Detect': new SquatAnalyzer(),
        } as unknown as Record<ExerciseType, ExerciseAnalyzer>;
    }

    setExercise(exercise: ExerciseType) {
        this.currentExercise = exercise;
        this.isLocked = false;
        this.lockedExercise = null;
        this.consecutiveFrames = 0;
        this.potentialExercise = null;
    }

    setRecordingStartTime(timestamp: number) {
        Object.values(this.analyzers).forEach(analyzer => {
            analyzer.setRecordingStartTime(timestamp);
        });
    }

    analyzeFrame(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (!landmarks || landmarks.length === 0) {
            return {
                score: 0,
                breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
                reps: 0,
                repPhase: 'Rest',
                message: "No pose detected",
                isGoodForm: false
            };
        }

        let targetExercise = this.currentExercise;

        // GLOBAL MOVEMENT TRACKING (Runs every frame to detect breaking out of static locks)
        const shoulderY = (landmarks[11].y + landmarks[12].y) / 2;
        this.shoulderHistory.push(shoulderY);
        if (this.shoulderHistory.length > 30) this.shoulderHistory.shift();

        const minY = Math.min(...this.shoulderHistory);
        const maxY = Math.max(...this.shoulderHistory);
        const variance = maxY - minY;

        // Auto-Detection Logic with User's Tuned Thresholds
        if (targetExercise === 'Auto-Detect') {
            if (this.isLocked && this.lockedExercise) {
                // DYNAMIC UNLOCK: If locked to PLANK but User is MOVING -> Switch to PUSH UP
                if (this.lockedExercise === 'Plank' && variance > 0.05) {
                    console.log(`Locked Plank detecting movement (Var: ${variance.toFixed(3)}). Switching to Push Up.`);
                    this.lockedExercise = 'Push Up';
                }
                targetExercise = this.lockedExercise;
            } else {
                let detected = classifyExercise(landmarks);
                if (detected) {
                    if (detected === this.potentialExercise) {
                        this.consecutiveFrames++;
                    } else {
                        this.potentialExercise = detected;
                        this.consecutiveFrames = 1;
                    }

                    // Lock threshold varies by exercise
                    // VIDEO MODE: At 6 FPS, thresholds are doubled from 3 FPS
                    // Standard: 6 frames = 1 second
                    // Static (Plank/Twist): 30 frames = 5 seconds (Extremely conservative for Plank)
                    // Dynamic: 4 frames = 0.67 seconds
                    let lockThreshold = 6;
                    if (detected === 'Plank') lockThreshold = 30; // Wait 5s to confirm it's actually static
                    if (detected === 'Russian Twist') lockThreshold = 12;
                    if (detected === 'Lateral Raises') lockThreshold = 12; // Wait ~2s to confirm it's not just bar support
                    if (detected === 'Pull Up' || detected === 'Lat Pulldown' || detected === 'Bench Press' || detected === 'Leg Raises') lockThreshold = 4;

                    // Dynamic Movement Check (Push Up vs Plank Resolution)
                    const shoulderY = (landmarks[11].y + landmarks[12].y) / 2;
                    // (Global history used)

                    const minY = Math.min(...this.shoulderHistory);
                    const maxY = Math.max(...this.shoulderHistory);
                    const variance = maxY - minY;

                    // If we are seeing Plank or Push Up, check movement
                    if (detected === 'Plank' || detected === 'Push Up') {
                        // Any slight movement (> 0.05 height change) implies Push Up reps started or Setup
                        // Push Up stroke is usually ~0.2 - 0.3. 
                        // 0.05 is small enough to catch the start of descent or adjustment.
                        if (variance > 0.05) {
                            console.log(`Movement Detected (Var: ${variance.toFixed(3)})! Switching/Locking to Push Up`);
                            detected = 'Push Up';
                            lockThreshold = 4; // Lock quickly if confirmed moving

                            // Boost consecutive frames to speed up lock if we were already pending
                            if (this.potentialExercise === 'Push Up') {
                                this.consecutiveFrames += 2;
                            }
                        }
                    }

                    if (this.consecutiveFrames > lockThreshold) {
                        this.lockedExercise = detected;
                        this.isLocked = true;
                        targetExercise = detected;
                        console.log(`Auto-Locked Exercise: ${detected}`);

                        // Plank Optimization: Start with elapsed time
                        if (targetExercise === 'Plank') {
                            const plankAnalyzer = this.analyzers['Plank'] as unknown as PlankAnalyzer;
                            if (plankAnalyzer && 'setElapsedTime' in plankAnalyzer) {
                                // @ts-ignore
                                plankAnalyzer.setElapsedTime(lockThreshold / 6); // Set correct elapsed time
                            }
                        }
                    } else {
                        return {
                            score: 0,
                            breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
                            reps: 0,
                            repPhase: `Detecting ${this.potentialExercise}...`, // Show what we are checking
                            message: (detected === 'Plank') ? "Hold still for Plank..." : `Start moving for ${detected}...`,
                            isGoodForm: false,
                            detectedExercise: this.potentialExercise || undefined
                        };
                    }
                } else {
                    return {
                        score: 0,
                        breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
                        reps: 0,
                        repPhase: 'Scanning...',
                        message: "Get in position...",
                        isGoodForm: false
                    };
                }
            }
        }

        const analyzer = this.analyzers[targetExercise] || this.analyzers['Squat'];

        // Pass timestamp for Uploaded Video support (Crucial improvement over old version)
        const feedback = analyzer.analyze(landmarks, timestamp);

        // Inject detected exercise info into feedback for UI
        if (this.currentExercise === 'Auto-Detect') {
            feedback.message = `[${targetExercise}] ${feedback.message}`;
        }
        feedback.detectedExercise = this.lockedExercise || (this.currentExercise !== 'Auto-Detect' ? this.currentExercise : undefined);

        return feedback;
    }

    // Helper used in snippet
    private consecutiveFramesMatches(newExercise: ExerciseType): boolean {
        return this.potentialExercise === newExercise;
    }

    getRepTimestamps(): any[] {
        if (this.currentExercise === 'Auto-Detect' && this.lockedExercise) {
            return this.analyzers[this.lockedExercise]?.getRepTimestamps() || [];
        }
        return this.analyzers[this.currentExercise]?.getRepTimestamps() || [];
    }
}
