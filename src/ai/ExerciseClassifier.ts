import { PoseLandmark, ExerciseType } from './ExerciseAnalyzer';

/**
 * Detects the exercise type based on pose landmarks.
 * Pure function to avoid Worklet context issues with Class instances.
 */
export function classifyExercise(landmarks: PoseLandmark[]): ExerciseType | null {
    if (landmarks.length < 33) return null;

    // --- REUSABLE COORDINATES & MEASUREMENTS ---
    const shoulderY = (landmarks[11].y + landmarks[12].y) / 2;
    const hipY = (landmarks[23].y + landmarks[24].y) / 2;
    const wristY = (landmarks[15].y + landmarks[16].y) / 2;
    const kneeY = (landmarks[25].y + landmarks[26].y) / 2;
    const ankleY = (landmarks[27].y + landmarks[28].y) / 2;
    const noseY = landmarks[0].y;

    const shoulderX = (landmarks[11].x + landmarks[12].x) / 2;
    const hipX = (landmarks[23].x + landmarks[24].x) / 2;
    const ankleX = (landmarks[27].x + landmarks[28].x) / 2;
    const wristX = (landmarks[15].x + landmarks[16].x) / 2;

    const torsoHeight = Math.abs(shoulderY - hipY);
    const verticalDiff = torsoHeight;
    const horizontalDiff = Math.abs(shoulderX - hipX);
    const reclineRatio = horizontalDiff / Math.max(0.001, verticalDiff);
    const reclineAngleDeg = Math.atan(reclineRatio) * 180 / Math.PI;

    // Orientation
    const upright = shoulderY < hipY;
    const isStanding = upright && (verticalDiff > horizontalDiff * 0.5);
    const isLying = horizontalDiff > verticalDiff * 0.7;

    // Limb Angles
    const elbowAngle = getAvgAngle(landmarks, 11, 13, 15, 12, 14, 16);
    const hipAngle = getAvgAngle(landmarks, 11, 23, 25, 12, 24, 26);
    const kneeAngle = getAvgAngle(landmarks, 23, 25, 27, 24, 26, 28);

    // Common Booleans
    const feetOnFloor = ankleY > 0.72;
    // Robust handsOverhead: Use nose as primary, but shoulder as fallback for back views
    const handsOverhead = (wristY < noseY) || (wristY < shoulderY - 0.15);
    const wristTorsoDistanceX = Math.abs(wristX - shoulderX);
    const elbowWidth = Math.abs(landmarks[13].x - landmarks[14].x);
    const wristWidth = Math.abs(landmarks[15].x - landmarks[16].x);
    const elbowsTucked = elbowWidth < torsoHeight * 1.0;

    // === GLOBAL T-BAR ROW CHECK ===
    const bodyStraightness = Math.abs(180 - hipAngle);
    const legStraightness = Math.abs(180 - kneeAngle);
    const bodyDy = Math.abs(shoulderY - ankleY);
    const bodyDx = Math.abs(shoulderX - ankleX);
    const bodyInclinationDeg = Math.atan2(bodyDx, bodyDy) * (180 / Math.PI);

    const isBodyStraight = bodyStraightness < 30 && legStraightness < 30;
    const isInclinedHypotenuse = bodyInclinationDeg > 20 && bodyInclinationDeg < 80;
    const handsAreLow = wristY > shoulderY;

    if (isBodyStraight && isInclinedHypotenuse && handsAreLow) {
        return 'T-Bar Row';
    }

    const torsoInclined = Math.abs(shoulderX - hipX) > Math.abs(shoulderY - hipY) * 0.3;
    const isHinging = bodyStraightness > 30;
    const kneesBentRange = kneeAngle < 165 && kneeAngle > 70;

    if (upright && torsoInclined && handsAreLow && kneesBentRange && feetOnFloor && isHinging) {
        return 'T-Bar Row';
    }

    // === GLOBAL RUSSIAN TWIST CHECK ===
    // Russian Twist is UNIQUE: Reclined torso + bent knees + hands at torso level
    // Key: V-sit position (shoulders higher than hips OR reclined angle)
    const hipCenterX = hipX;
    const wristCenterX = wristX;
    const handsOffsetFromHips = Math.abs(wristCenterX - hipCenterX);
    const isHandsToOneSide = handsOffsetFromHips > torsoHeight * 0.1; // Lowered threshold
    const isReclined = reclineAngleDeg > 10 && reclineAngleDeg < 80; // Wider range
    const kneesBentForTwist = kneeAngle < 150; // Relaxed
    const handsAtTorsoLevel = wristY < hipY + 0.2 && wristY > shoulderY - 0.15;
    const isVSitPosture = shoulderY < hipY; // Shoulders higher than hips (reclined)

    // Trigger if: NOT upright + reclined posture + bent knees + hands at torso level
    // Exclude upright positions (like Tricep Dips where skeleton is vertical)
    if (!upright && (isReclined || isVSitPosture) && kneesBentForTwist && handsAtTorsoLevel) {
        return 'Russian Twist';
    }

    // === CHEST FLY MACHINE ===
    const thighIsHorizontalCF = Math.abs(kneeY - hipY) < torsoHeight * 0.25;
    const isSeatedCF = kneeAngle < 155 && hipAngle < 150 && thighIsHorizontalCF;
    const isWideArmSpan = (elbowWidth > torsoHeight * 1.0) || (wristWidth > torsoHeight * 0.9);
    const isWideSpanSideView = wristTorsoDistanceX > torsoHeight * 0.4;

    // Chest height requirement (Cannot be overhead)
    const handsBelowShoulders = wristY > shoulderY - 0.05;
    const handsAboveHips = wristY < hipY - (torsoHeight * 0.1);
    const handsInChestZone = handsBelowShoulders && handsAboveHips;

    // CRITICAL: Chest Fly machine has a vertical backrest (!torsoInclined)
    if (upright && !handsOverhead && !torsoInclined && isSeatedCF && handsInChestZone) {
        if (isWideArmSpan || isWideSpanSideView) {
            return 'Chest Fly Machine';
        }
    }


    // --- 2. STANDING / SEATED EXERCISES ---
    if (isStanding) {
        // T-Bar Row Check fallback
        const isBentOverHighKnee = kneeAngle < 150 && wristY > hipY;
        if ((torsoInclined || isBentOverHighKnee) && wristY > shoulderY && kneeY > hipY + 0.1) {
            if (kneeAngle > 90) return 'T-Bar Row';
        }

        // === LEG EXTENSION (Seated Machine - Inclined Body) ===
        const thighIsHorizontal = Math.abs(kneeY - hipY) < torsoHeight * 0.25;
        const handsAtSides = wristTorsoDistanceX < torsoHeight * 0.45;
        const handsNearSeat = Math.abs(wristY - hipY) < torsoHeight * 0.4;
        const hipFlexedLE = hipAngle < 160;
        // V-Sit exclusion (Russian Twist): In a Leg Extension, shoulders are NOT higher than hips
        const notVSit = shoulderY >= hipY - 0.05;

        // CRITICAL: Leg extension requires feet on floor/machine and NOT in V-sit position
        if (torsoInclined && hipFlexedLE && thighIsHorizontal && handsNearSeat && handsAtSides && feetOnFloor && notVSit) {
            return 'Leg Extension';
        }

        // Tricep Dips
        const feetVisible = (landmarks[27].visibility || 0) > 0.5;
        const handsInDipZone = wristY > (shoulderY - 0.1) && wristY < (hipY + 0.2);

        if (handsInDipZone) {
            if (feetVisible && !feetOnFloor) return 'Tricep Dips';
            if (!torsoInclined && kneeAngle < 150 && elbowsTucked) {
                return 'Tricep Dips';
            }
        }

        // === SQUAT DETECTION (Strict) ===
        const wristsElevated = wristY < shoulderY + 0.15;
        const wristsNearShoulders = Math.abs(wristY - shoulderY) < 0.2;
        const isDeepSquat = kneeAngle < 120 && hipAngle < 120;

        // Barbell Squat
        if (torsoInclined && kneeAngle < 140 && hipAngle < 150 && (wristsElevated || wristsNearShoulders) && feetOnFloor) {
            return 'Squat';
        }

        // Bodyweight Squat (Feet MUST be flat)
        if (isDeepSquat && feetOnFloor && !thighIsHorizontal) {
            return 'Squat';
        }



        // === BARBELL BICEPS CURL (Strictly Standing) ===
        const elbowsLow = (landmarks[13].y + landmarks[14].y) / 2 > shoulderY + 0.05;
        // Bicep Curl MUST have straight legs. If legs are moving, it's not a standing curl.
        const isLegMoving = kneeAngle < 160 || hipAngle < 160;
        const legsStraightish = !isLegMoving;

        if (!torsoInclined && !handsOverhead && elbowAngle < 170 && elbowsTucked && elbowsLow && legsStraightish) {
            return 'Barbell Biceps Curl';
        }

        // === LEG RAISES ON PARALLEL BARS (Straight Body) ===
        const wristNearHips = Math.abs(wristY - hipY) < 0.25;
        const elbowsLocked = elbowAngle > 150;
        if (!torsoInclined && wristNearHips && elbowsLocked && elbowsTucked) {
            const ankleAboveKnee = ankleY < kneeY - 0.05;
            const hipFlexed = hipAngle < 155; // Legs lifting

            // For Leg Raises, the upper body is straight, unlike Leg Extension machine
            if (ankleAboveKnee || hipFlexed) {
                return 'Leg Raises';
            }
        }

        // === LATERAL RAISES (Standing) ===
        const isStandingStraight = kneeAngle > 165 && hipAngle > 165;
        const handsBelowShouldersLR = wristY > shoulderY - 0.05;

        // "Wide Arc" Rule: Wrists must be significantly wider than elbows to be a Raise (bird wings)
        const isWideArc = wristWidth > elbowWidth * 1.2;
        const armIsExtendedLR = ((wristWidth > torsoHeight * 0.7) || (wristTorsoDistanceX > torsoHeight * 0.35)) && isWideArc;

        if (isStandingStraight && armIsExtendedLR && handsBelowShouldersLR && !handsOverhead) {
            return 'Lateral Raises';
        }

        // === OVERHEAD EXERCISES ===
        if (handsOverhead) {
            const armIsExtendedOut = wristTorsoDistanceX > 0.15;

            if (armIsExtendedOut && !elbowsTucked && (feetOnFloor || hipAngle > 160)) return 'Lateral Raises';

            const thighIsHorizontal = Math.abs(kneeY - hipY) < torsoHeight * 0.25;
            const anklesBelowKnees = ankleY > kneeY + 0.05;
            // Perspective Fix (Back View): If thighs are horizontal and feet are down, user is seated regardless of 2D hipAngle
            const isSeatedOnMachine = (hipAngle < 135 || (thighIsHorizontal && anklesBelowKnees)) && (feetOnFloor || thighIsHorizontal);
            const handsAboveShoulders = wristY < shoulderY - 0.05;

            // 1. Incline Bench Press Check (Seated but reclined)
            const avgShoulderFlexion = (calculateAngle(landmarks[23], landmarks[11], landmarks[15]) + calculateAngle(landmarks[24], landmarks[12], landmarks[16])) / 2;
            if (reclineAngleDeg >= 25 && reclineAngleDeg <= 65 && avgShoulderFlexion < 160 && handsAboveShoulders) {
                return 'Incline Bench Press';
            }

            // 2. Lat Pulldown requires sitting (bent hips) and horizontal thighs/feet down
            if (isSeatedOnMachine && handsAboveShoulders) return 'Lat Pulldown';

            // 3. Pull Up: Hands above shoulders, NOT seated on machine, and feet dangling
            if (handsAboveShoulders && !isSeatedOnMachine && !feetOnFloor) return 'Pull Up';
        }

        return null;
    }

    // --- 3. LYING EXERCISES ---
    if (isLying) {
        const legsAreVertical = kneeY > hipY + 0.15;
        const shouldersHigherThanHips = shoulderY < hipY - 0.05;

        // === RUSSIAN TWIST (Priority) ===
        // In a Russian Twist, knees are bent, shoulders are higher than hips (V-sit), and body is reclined
        const kneesBentRT = kneeAngle < 140;
        const isVSitPosition = shouldersHigherThanHips && kneesBentRT && !legsAreVertical;
        // Relaxed conditions: Don't require elbowsTucked (arms can be extended holding weight)
        if (isVSitPosition && reclineAngleDeg > 15 && reclineAngleDeg < 70) {
            return 'Russian Twist';
        }

        if (legsAreVertical) return 'T-Bar Row';

        const isProne = wristY > shoulderY;
        const faceIsUp = noseY < shoulderY + 0.1;
        const kneesBent = kneeAngle < 135;
        const legsStraight = kneeAngle > 150;


        // === PUSH UP / PLANK ===
        const legsHorizontal = Math.abs(kneeY - hipY) < 0.15;
        const bodyIsFlat = Math.abs(shoulderY - ankleY) < 0.15;

        if (!legsHorizontal) return 'T-Bar Row';
        if (shouldersHigherThanHips && !bodyIsFlat) return 'T-Bar Row';

        if (legsStraight && legsHorizontal && bodyIsFlat) {
            const avgElbow = (calculateAngle(landmarks[11], landmarks[13], landmarks[15]) + calculateAngle(landmarks[12], landmarks[14], landmarks[16])) / 2;
            if (Math.abs(wristY - (landmarks[13].y + landmarks[14].y) / 2) < 0.15 && avgElbow < 130) return 'Plank';
            return 'Push Up';
        }

        if (isProne && !faceIsUp && !kneesBent && legsHorizontal && bodyIsFlat) return 'Push Up';

        if (kneesBent || !isProne) {
            if (reclineAngleDeg <= 65) return 'Incline Bench Press';
            return 'Bench Press';
        }

        if (isProne && legsHorizontal && bodyIsFlat) return 'Push Up';
        if (reclineAngleDeg <= 65) return 'Incline Bench Press';
        return 'Bench Press';
    }

    return null;
}

// --- Helper Functions (Pure) ---

function getAvgAngle(lm: PoseLandmark[], a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): number {
    return (calculateAngle(lm[a1], lm[b1], lm[c1]) + calculateAngle(lm[a2], lm[b2], lm[c2])) / 2;
}

function calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}
