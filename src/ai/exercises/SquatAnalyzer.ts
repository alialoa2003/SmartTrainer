import { ExerciseAnalyzer, Feedback, PoseLandmark } from '../ExerciseAnalyzer';
import { BiomechanicalAnalyzer, CameraView } from '../analysis/BiomechanicalAnalyzer';
import { RepCounter, RepPhase } from '../reps/RepCounter';

/**
 * SquatAnalyzer - Biomechanical analysis for barbell/bodyweight squats
 * 
 * The squat is a fundamental multi-joint movement utilizing a closed kinetic chain
 * targeting the entire lower body and core. Movement occurs primarily in the sagittal plane.
 * 
 * Joint Actions:
 * - Hips: Extension (concentric) / Flexion (eccentric)
 * - Knees: Extension (concentric) / Flexion (eccentric)  
 * - Ankles: Plantarflexion (concentric) / Dorsiflexion (eccentric)
 * - Spine: Isometric stabilization
 * 
 * Expected ROM (Competition Depth):
 * - Hip: 180° (start) → 45-60° (bottom)
 * - Knee: 180° (start) → 60-80° (bottom)
 * - Ankle: 90° (start) → 60-70° (bottom, i.e., 20-30° dorsiflexion)
 */
export class SquatAnalyzer extends ExerciseAnalyzer {
    exerciseName = 'Squat';
    private biomechanics = new SquatBiomechanics();
    private repCounter = new RepCounter('EccentricFirst'); // Descent first

    // Baseline heel Y for lift detection
    private baselineHeelY: number | null = null;
    private framesSinceStart = 0;

    analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback {
        if (landmarks.length < 33) return this.emptyFeedback();

        this.framesSinceStart++;

        // 1. Detect Camera View
        const view = this.biomechanics.detectView(landmarks);

        // 2. Calculate Key Joint Angles
        const angles = this.calculateSquatAngles(landmarks);

        // 3. Rep Counting using Hip Y-position relative to Knee
        // This approach is more robust than angle-based for depth detection
        // 0.0 (Start): Hip Y above Knee Y (standing)
        // 1.0 (Peak): Hip Y at or below Knee Y (depth achieved)
        const normalizedPos = this.calculateNormalizedPosition(landmarks, angles);
        const repState = this.repCounter.update(normalizedPos, timestamp);

        // 4. Biomechanical Analysis
        const pillarScores = this.biomechanics.analyzePillars(landmarks, repState.phase, view);

        // Update posture score based on actual torso angle
        pillarScores.posture = this.biomechanics.calculatePosture(landmarks, view);

        // 5. Quality Flags & Feedback Generation
        let messages: string[] = [];
        let qualityFlags: string[] = [];

        // --- Heel Lift Detection (Ankle Mobility Issue) ---
        const heelLiftResult = this.detectHeelLift(landmarks);
        if (heelLiftResult.isLifted) {
            qualityFlags.push("Limited Ankle Mobility");
            if (repState.phase === 'Eccentric' || repState.phase === 'Bottom') {
                messages.push("Heels Down!");
            }
        }

        // --- Movement Phase Specific Feedback ---
        switch (repState.phase) {
            case 'Rest':
            case 'Top':
                // Setup Phase - Check stance and bracing
                if (angles.knee < 160) {
                    messages.push("Stand Tall");
                }
                break;

            case 'Eccentric':
                // Descent Phase - Check weight distribution and knee tracking
                if (view === 'Front') {
                    const valgusScore = this.biomechanics.checkValgus(landmarks);
                    if (valgusScore < 70) {
                        messages.push("Knees Out!");
                        qualityFlags.push("Knee Valgus");
                    }
                }
                if (view === 'Side' && pillarScores.posture < 60) {
                    messages.push("Chest Up");
                }
                break;

            case 'Bottom':
                // The Hole - Check depth and stretch position
                const depthScore = this.biomechanics.checkDepth(landmarks, view);
                if (depthScore < 100) {
                    messages.push("Go Deeper");
                    qualityFlags.push("Partial Depth");
                }
                // Check for butt wink (posterior pelvic tilt) at bottom
                if (this.detectButtWink(landmarks, view)) {
                    messages.push("Neutral Spine");
                    qualityFlags.push("Butt Wink");
                }
                break;

            case 'Concentric':
                // Ascent Phase - Check for hip rise without shoulders
                if (view === 'Side') {
                    const goodMorningScore = this.detectGoodMorning(landmarks);
                    if (goodMorningScore < 70) {
                        messages.push("Hips & Chest Together");
                        qualityFlags.push("Good Morning Pattern");
                    }
                }
                if (view === 'Front') {
                    const valgusScore = this.biomechanics.checkValgus(landmarks);
                    if (valgusScore < 70) messages.push("Knees Out!");
                }
                break;
        }

        // 6. Calculate Total Score
        const totalScore = (
            pillarScores.rom * 0.35 +      // Depth is crucial
            pillarScores.stability * 0.25 + // Knee tracking / Balance
            pillarScores.posture * 0.20 +   // Torso position
            pillarScores.bracing * 0.10 +   // Core stability
            pillarScores.efficiency * 0.10  // Movement efficiency
        );

        return {
            score: totalScore,
            breakdown: pillarScores,
            reps: repState.count,
            repPhase: repState.phase,
            message: messages.length > 0 ? messages[0] : this.getPhaseMessage(repState.phase),
            correction: messages.join(', '),
            isGoodForm: totalScore > 80 && qualityFlags.length === 0,
            jointAngles: {
                hip: angles.hip,
                knee: angles.knee,
                ankle: angles.ankle
            }
        };
    }

    /**
     * Calculate all relevant squat angles
     */
    private calculateSquatAngles(landmarks: PoseLandmark[]): { hip: number; knee: number; ankle: number } {
        // Use right side for consistency (or average both sides)
        const shoulder = landmarks[12];
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];
        const toe = landmarks[32]; // Right foot index

        // Hip Angle: Shoulder-Hip-Knee (180° = standing, ~45-60° = bottom)
        const hipAngle = this.calculateAngle(shoulder, hip, knee);

        // Knee Angle: Hip-Knee-Ankle (180° = standing, ~60-80° = bottom)
        const kneeAngle = this.calculateAngle(hip, knee, ankle);

        // Ankle Angle: Knee-Ankle-Toe (90° = neutral, decreasing = dorsiflexion)
        // We calculate dorsiflexion as deviation from vertical shin
        const ankleAngle = this.calculateAngle(knee, ankle, toe);

        return {
            hip: hipAngle,
            knee: kneeAngle,
            ankle: ankleAngle
        };
    }

    /**
     * Calculate normalized position for rep counting
     * Uses a hybrid of knee angle and hip Y-position for robust detection
     */
    private calculateNormalizedPosition(landmarks: PoseLandmark[], angles: { hip: number; knee: number; ankle: number }): number {
        const hip = landmarks[24];
        const knee = landmarks[26];

        // Primary method: Y-coordinate comparison (hip crease vs knee)
        // In screen coords, Y increases downward
        // Standing: hip.y < knee.y
        // At depth: hip.y >= knee.y (hip crease at or below knee)

        // Calculate vertical distance normalized to body proportions
        const verticalDiff = knee.y - hip.y;

        // Secondary method: Knee angle
        // Standing: ~170-180°, Bottom: ~60-90°
        const angleNorm = Math.min(1, Math.max(0, (170 - angles.knee) / 80));

        // Y-position normalization
        // Positive = hip above knee (standing), Negative = hip at/below knee (depth)
        const yNorm = Math.min(1, Math.max(0, (0.05 - verticalDiff) / 0.15 + 0.5));

        // Weighted combination favoring Y-position for depth determination
        return angleNorm * 0.4 + yNorm * 0.6;
    }

    /**
     * Detect heel lift indicating ankle mobility limitation
     */
    private detectHeelLift(landmarks: PoseLandmark[]): { isLifted: boolean; amount: number } {
        const leftHeel = landmarks[29];
        const rightHeel = landmarks[30];
        const avgHeelY = (leftHeel.y + rightHeel.y) / 2;

        // Establish baseline in first few frames (standing)
        if (this.framesSinceStart < 10) {
            if (this.baselineHeelY === null) {
                this.baselineHeelY = avgHeelY;
            } else {
                // Rolling average for stability
                this.baselineHeelY = this.baselineHeelY * 0.8 + avgHeelY * 0.2;
            }
            return { isLifted: false, amount: 0 };
        }

        if (this.baselineHeelY === null) {
            return { isLifted: false, amount: 0 };
        }

        // Heel lift: Y decreases (moves up in screen coords)
        const liftAmount = this.baselineHeelY - avgHeelY;

        // Threshold: significant lift (normalized, ~0.02 is noticeable)
        const isLifted = liftAmount > 0.015;

        return { isLifted, amount: liftAmount };
    }

    /**
     * Detect "butt wink" - posterior pelvic tilt at bottom of squat
     * This is when the pelvis tucks under, causing lumbar flexion
     */
    private detectButtWink(landmarks: PoseLandmark[], view: CameraView): boolean {
        if (view === 'Front') return false; // Can't detect from front

        const shoulder = landmarks[12];
        const hip = landmarks[24];
        const knee = landmarks[26];

        // Calculate torso angle relative to vertical
        // Butt wink often manifests as excessive forward lean or pelvis rotation
        const torsoAngle = this.calculateAngle(
            { x: hip.x, y: hip.y - 0.2, z: 0, visibility: 1 } as PoseLandmark,
            hip,
            shoulder
        );

        // At bottom, some forward lean is expected (~30-45°)
        // Excessive lean (>60°) combined with deep position suggests compensation
        const hipToKneeAngle = this.calculateAngle(shoulder, hip, knee);

        // If hip angle is very closed AND torso is severely forward, likely butt wink
        return hipToKneeAngle < 50 && torsoAngle > 55;
    }

    /**
     * Detect "good morning" squat - hips rise faster than shoulders
     * Common fault during ascent indicating weak quads or poor bracing
     */
    private detectGoodMorning(landmarks: PoseLandmark[]): number {
        const shoulder = landmarks[12];
        const hip = landmarks[24];
        const knee = landmarks[26];

        // Calculate torso angle
        const torsoAngle = this.calculateAngle(
            { x: hip.x, y: hip.y - 0.2, z: 0, visibility: 1 } as PoseLandmark,
            hip,
            shoulder
        );

        // Also check hip-shoulder relationship
        // Good: shoulders and hips rise together
        // Bad: hips rise while shoulders stay down (forward pitch increases)

        // Use instantaneous torso angle as proxy
        // >55° during concentric is problematic
        if (torsoAngle > 60) return 40;
        if (torsoAngle > 50) return 70;
        return 100;
    }

    /**
     * Get user-friendly phase message
     */
    private getPhaseMessage(phase: RepPhase): string {
        switch (phase) {
            case 'Rest': return 'Ready';
            case 'Top': return 'Standing';
            case 'Eccentric': return 'Descending';
            case 'Bottom': return 'Hold';
            case 'Concentric': return 'Drive Up';
            default: return phase;
        }
    }

    getRepTimestamps() {
        return this.repCounter.getRepTimestamps();
    }

    setRecordingStartTime(timestamp: number): void {
        this.repCounter.setRecordingStartTime(timestamp);
    }

    reset() {
        this.repCounter.reset();
        this.biomechanics.reset();
        this.baselineHeelY = null;
        this.framesSinceStart = 0;
    }

    private emptyFeedback(): Feedback {
        return {
            score: 0,
            breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
            reps: 0,
            repPhase: 'Rest',
            message: "No Pose",
            isGoodForm: false
        };
    }
}

/**
 * SquatBiomechanics - Specialized biomechanical analysis for squats
 * 
 * Key metrics analyzed:
 * 1. Stability: Knee valgus/varus, balance over midfoot
 * 2. ROM: Hip crease depth relative to knee
 * 3. Posture: Torso angle and spinal neutrality
 * 4. Efficiency: Bar path verticality (if applicable)
 * 5. Bracing: Core tension maintenance
 */
class SquatBiomechanics extends BiomechanicalAnalyzer {

    analyzePillars(landmarks: PoseLandmark[], repPhase: RepPhase, view: CameraView): any {
        return {
            stability: this.calculateStability(landmarks, view),
            rom: this.calculateROM(landmarks, view),
            posture: this.calculatePosture(landmarks, view),
            efficiency: this.calculateEfficiency(landmarks, repPhase, view),
            bracing: this.calculateBracing(landmarks, view)
        };
    }

    /**
     * Pillar 1: Stability
     * - Front View: Check for knee valgus (knees caving inward)
     * - Side View: Check for lateral sway / balance
     */
    calculateStability(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') {
            return this.checkValgus(current);
        } else if (view === 'Side') {
            // Side view: Check weight balance over midfoot
            return this.checkMidfootBalance(current);
        }
        return 100;
    }

    /**
     * Pillar 2: ROM (Range of Motion)
     * Primary: Hip crease depth below parallel
     * Secondary: Knee flexion angle
     */
    calculateROM(current: PoseLandmark[], view?: CameraView): number {
        return this.checkDepth(current, view || 'Side');
    }

    /**
     * Pillar 3: Posture
     * - Side View: Torso angle (should be 30-45° forward lean)
     * - Front View: Symmetry check
     */
    calculatePosture(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') {
            return this.checkSymmetry(current);
        }

        // Side/45 View: Hip Hinge / Torso Angle
        const shoulder = current[12];
        const hip = current[24];

        // Calculate angle from vertical
        const torsoAngle = this.calculateAngle(
            { x: hip.x, y: hip.y - 0.2, z: 0, visibility: 1 } as PoseLandmark,
            hip,
            shoulder
        );

        // Squat: Moderate forward lean expected (30-50°)
        // Too upright (<20°): May indicate mobility limitation
        // Too forward (>60°): Excessive lean / weak core
        if (torsoAngle > 65) return 40;  // Excessive forward lean
        if (torsoAngle > 55) return 60;  // Borderline
        if (torsoAngle < 15) return 70;  // Too upright (may limit depth)
        return 100;
    }

    /**
     * Pillar 4: Efficiency
     * - Side View: Check for consistent movement pattern
     * - Weight should stay over midfoot throughout
     */
    calculateEfficiency(current: PoseLandmark[], phase: RepPhase, view?: CameraView): number {
        if (view !== 'Side') return 100;

        // Simple check: toe/heel relationship shouldn't change drastically
        const knee = current[26];
        const ankle = current[28];
        const toe = current[32];

        // Knee should track forward appropriately
        // If knee is drastically behind ankle X-position, movement is inefficient
        if (phase === 'Bottom' || phase === 'Eccentric') {
            const kneeForwardness = knee.x - ankle.x;
            // Some forward knee travel is normal and healthy
            // Penalize if knees don't move forward at all (box squat pattern)
            // or if they're excessively forward
            if (Math.abs(kneeForwardness) > 0.15) return 70;
        }

        return 100;
    }

    /**
     * Pillar 5: Bracing
     * Check for core stability and spinal integrity
     */
    calculateBracing(current: PoseLandmark[], view?: CameraView): number {
        if (view === 'Front') return 100;

        // Check for excessive spinal extension (rib flare) or flexion
        const shoulder = current[12];
        const hip = current[24];
        const ear = current[8]; // Right ear

        // Head-Shoulder-Hip alignment
        const spinalAngle = this.calculateAngle(ear, shoulder, hip);

        // Should be relatively straight (150-180°)
        // Excessive deviation indicates poor bracing
        const deviation = Math.abs(180 - spinalAngle);
        if (deviation > 30) return 60;
        if (deviation > 20) return 80;
        return 100;
    }

    /**
     * Check for knee valgus (knees caving inward)
     * Critical fault that risks ACL injury
     */
    checkValgus(current: PoseLandmark[]): number {
        const leftHip = current[23];
        const leftKnee = current[25];
        const leftAnkle = current[27];

        const rightHip = current[24];
        const rightKnee = current[26];
        const rightAnkle = current[28];

        // Compare knee width vs ankle width
        const kneeWidth = Math.abs(leftKnee.x - rightKnee.x);
        const ankleWidth = Math.abs(leftAnkle.x - rightAnkle.x);
        const hipWidth = Math.abs(leftHip.x - rightHip.x);

        // Valgus: Knees collapse inward (knee width < ankle width)
        // Good form: Knees track over toes (knee width >= ankle width)
        if (kneeWidth < ankleWidth * 0.75) return 40;  // Severe valgus
        if (kneeWidth < ankleWidth * 0.85) return 60;  // Moderate valgus
        if (kneeWidth < hipWidth * 0.85) return 75;    // Minor valgus
        return 100;
    }

    /**
     * Check squat depth
     * Competition depth: Hip crease below top of knee
     */
    checkDepth(current: PoseLandmark[], view: CameraView): number {
        const hip = current[24];
        const knee = current[26];

        // Y-coordinate comparison (screen coords: Y increases downward)
        // Hip crease should be at or below knee level
        const hipKneeDiff = hip.y - knee.y;

        // Good depth: hip.y >= knee.y (diff >= 0)
        // Parallel: hip.y ~ knee.y (diff ~ 0)
        // Partial: hip.y < knee.y (diff < 0)

        if (hipKneeDiff >= 0.02) return 100;    // Below parallel (excellent)
        if (hipKneeDiff >= -0.02) return 90;    // Parallel (good)
        if (hipKneeDiff >= -0.05) return 70;    // Close to parallel
        return 50;                               // Partial rep
    }

    /**
     * Check if weight is balanced over midfoot (Side view)
     */
    private checkMidfootBalance(current: PoseLandmark[]): number {
        const hip = current[24];
        const ankle = current[28];
        const toe = current[32];
        const heel = current[30];

        // Midfoot is roughly between heel and toe
        const midfoot = (heel.x + toe.x) / 2;

        // Hip should be roughly over midfoot
        const deviation = Math.abs(hip.x - midfoot);

        if (deviation > 0.1) return 60;  // Significant forward/backward lean
        if (deviation > 0.05) return 80; // Minor imbalance
        return 100;
    }

    /**
     * Check left-right symmetry (Front view)
     */
    private checkSymmetry(current: PoseLandmark[]): number {
        const leftShoulder = current[11];
        const rightShoulder = current[12];
        const leftHip = current[23];
        const rightHip = current[24];

        // Shoulders should be level
        const shoulderTilt = Math.abs(leftShoulder.y - rightShoulder.y);
        // Hips should be level
        const hipTilt = Math.abs(leftHip.y - rightHip.y);

        if (shoulderTilt > 0.05 || hipTilt > 0.05) return 70;
        if (shoulderTilt > 0.03 || hipTilt > 0.03) return 85;
        return 100;
    }
}
