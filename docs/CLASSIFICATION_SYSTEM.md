# Technical Deep Dive: Exercise Classification System

This document provides an in-depth analysis of the exercise classification logic in GymScore AI.

## Table of Contents

1. [Classification Architecture](#classification-architecture)
2. [Geometric Rules Breakdown](#geometric-rules-breakdown)
3. [Exercise Detection Examples](#exercise-detection-examples)
4. [Common Pitfalls and Edge Cases](#common-pitfalls-and-edge-cases)
5. [Optimization Strategies](#optimization-strategies)

---

## Classification Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Exercise Classification Flow               │
└─────────────────────────────────────────────────────────────┘

Input: 33 Pose Landmarks (x, y, z, visibility)
  │
  ├─> Step 1: Orientation Detection
  │   ├─> Calculate shoulder-hip alignment
  │   ├─> Vertical vs Horizontal body position
  │   └─> Output: isStanding, isLying, isPushupPosition
  │
  ├─> Step 2: Joint Angle Calculation
  │   ├─> Elbow angle (shoulder-elbow-wrist)
  │   ├─> Hip angle (shoulder-hip-knee)
  │   ├─> Knee angle (hip-knee-ankle)
  │   └─> Output: elbowAngle, hipAngle, kneeAngle
  │
  ├─> Step 3: Body Proportion Analysis
  │   ├─> Shoulder width
  │   ├─> Elbow width
  │   ├─> Wrist width
  │   └─> Output: Width ratios
  │
  ├─> Step 4: Positional Checks
  │   ├─> Hand position relative to shoulders
  │   ├─> Elbow position relative to shoulders
  │   ├─> Knee position relative to hips
  │   └─> Output: Positional flags
  │
  └─> Step 5: Rule Application
      ├─> Priority-based rule matching
      ├─> Conflict resolution
      └─> Output: ExerciseType | null
```

### Classification Priority Order

The classifier applies rules in this order (highest priority first):

1. **T-Bar Row** (Whole body incline check)
2. **Bicep Curl** (Strict tuck + low elbows)
3. **Overhead Exercises** (Hands above nose)
   - Lateral Raises (arms extended out)
   - Pull Up (feet off floor, wide grip)
   - Shoulder Press (elbows tucked)
4. **Chest Fly vs Lateral Raise** (Knee angle check)
5. **Leg Motions** (Squat)
6. **Lying Exercises** (Bench Press, Plank, Push Up)
7. **Russian Twist** (V-sit position)

---

## Geometric Rules Breakdown

### Rule 1: Orientation Detection

**Purpose:** Determine if user is standing, lying, or in plank position

```typescript
// Standing Detection
const shoulderY = (landmarks[11].y + landmarks[12].y) / 2;
const hipY = (landmarks[23].y + landmarks[24].y) / 2;
const shoulderX = (landmarks[11].x + landmarks[12].x) / 2;
const hipX = (landmarks[23].x + landmarks[24].x) / 2;

const verticalDiff = Math.abs(shoulderY - hipY);
const horizontalDiff = Math.abs(shoulderX - hipX);

const upright = shoulderY < hipY; // Shoulder above hip
const isStanding = upright && (verticalDiff > horizontalDiff * 0.5);

// Lying Detection
const isLying = horizontalDiff > verticalDiff * 0.7;
```

**Thresholds Explained:**
- `verticalDiff > horizontalDiff * 0.5`: Body is at least 50% more vertical than horizontal
- `horizontalDiff > verticalDiff * 0.7`: Body is at least 70% more horizontal than vertical
- These thresholds allow for camera angle variations

### Rule 2: T-Bar Row Detection

**Biomechanics:** Entire body is inclined forward at an angle, hands below shoulders

```typescript
const torsoHorizontalOffset = Math.abs(shoulderX - hipX);
const torsoVerticalSpan = Math.abs(shoulderY - hipY);
const isInclined = torsoHorizontalOffset > torsoVerticalSpan * 0.3;

const wristY = (landmarks[15].y + landmarks[16].y) / 2;
const handsBelowShoulders = wristY > shoulderY;

const kneeY = (landmarks[25].y + landmarks[26].y) / 2;
const notSitting = kneeY > hipY - 0.1;

if (isInclined && handsBelowShoulders && notSitting) {
    return 'T-Bar Row';
}
```

**Why This Works:**
- T-Bar Row is unique: body leans forward as a unit (not just torso)
- Hands stay below shoulder level (pulling motion)
- Not seated (legs are down)

### Rule 3: Bicep Curl Detection

**Biomechanics:** Elbows tucked, low position, arms bent

```typescript
const avgElbowAngle = (
    calculateAngle(landmarks[11], landmarks[13], landmarks[15]) + 
    calculateAngle(landmarks[12], landmarks[14], landmarks[16])
) / 2;
const isCurl = avgElbowAngle < 170;

const elbowWidth = Math.abs(landmarks[13].x - landmarks[14].x);
const shoulderWidth = Math.abs(landmarks[11].x - landmarks[12].x);
const elbowsTucked = elbowWidth < shoulderWidth * 1.3;

const elbowY = (landmarks[13].y + landmarks[14].y) / 2;
const elbowsLow = elbowY > shoulderY + 0.05;

if (isCurl && elbowsTucked && elbowsLow) {
    // Anti-Russian Twist check
    const kneeY = (landmarks[25].y + landmarks[26].y) / 2;
    const legsAreDown = (kneeY > hipY + 0.1) || (ankleY > 0.75);
    
    if (!legsAreDown) return 'Russian Twist';
    return 'Barbell Biceps Curl';
}
```

**Critical Checks:**
1. **Elbow angle < 170°**: Arms are bent (not straight)
2. **Elbow width < 1.3× shoulder width**: Elbows stay close to body
3. **Elbows below shoulders**: Distinguishes from Chest Fly (elbows high)
4. **Legs down**: Prevents confusion with Russian Twist (V-sit)

### Rule 4: Overhead Exercise Detection

**Biomechanics:** Hands above nose level

```typescript
const wristY = (landmarks[15].y + landmarks[16].y) / 2;
const noseY = landmarks[0].y;

if (wristY < noseY) {
    const wristWidth = Math.abs(landmarks[15].x - landmarks[16].x);
    const elbowX = (landmarks[13].x + landmarks[14].x) / 2;
    const wristX = (landmarks[15].x + landmarks[16].x) / 2;
    const armIsExtendedOut = Math.abs(wristX - elbowX) > 0.15;
    
    // Lateral Raise: Arms extended out, elbows NOT tucked
    if (armIsExtendedOut && !elbowsTucked) {
        return 'Lateral Raises';
    }
    
    // Pull Up: Feet off floor, wide grip
    const ankleY = (landmarks[27].y + landmarks[28].y) / 2;
    const feetOnFloor = ankleY > 0.85;
    
    if (!feetOnFloor) {
        if (wristWidth > shoulderWidth * 1.25) return 'Pull Up';
        if (elbowWidth > shoulderWidth * 1.4) return 'Pull Up';
    }
    
    // Shoulder Press: Elbows tucked, hands high
    return 'Shoulder Press';
}
```

**Decision Tree:**
```
Hands above nose?
├─ Yes → Overhead exercise
│   ├─ Arms extended out + elbows NOT tucked → Lateral Raise
│   ├─ Feet off floor + wide grip → Pull Up
│   └─ Elbows tucked → Shoulder Press
└─ No → Continue to next rule
```

### Rule 5: Chest Fly vs Lateral Raise

**Biomechanics:** Both have elbows at shoulder level, differentiated by knee angle

```typescript
const elbowsAtShoulderLevel = 
    Math.abs(landmarks[13].y - landmarks[11].y) < 0.15 && 
    Math.abs(landmarks[14].y - landmarks[12].y) < 0.15;

if (elbowsAtShoulderLevel) {
    const handsAtShoulderHeight = Math.abs(wristY - shoulderY) < 0.2;
    
    if (handsAtShoulderHeight) {
        const kneesBent = kneeAngle < 150;
        const kneesStraight = kneeAngle >= 150;
        
        // BENT KNEES → CHEST FLY (Seated)
        if (kneesBent) {
            // Exception: V-Sit with narrow hands → Russian Twist
            const isVSit = kneeY < hipY - 0.05;
            const handsNarrow = wristWidth < shoulderWidth * 0.9;
            if (isVSit && handsNarrow) return 'Russian Twist';
            
            return 'Chest Fly Machine';
        }
        
        // STRAIGHT KNEES → LATERAL RAISE (Standing)
        if (kneesStraight) {
            const handsWideEnough = wristWidth > shoulderWidth * 1.1;
            if (handsWideEnough) return 'Lateral Raises';
        }
    }
}
```

**Key Insight:**
- Chest Fly is done seated (bent knees)
- Lateral Raise is done standing (straight knees)
- This simple check resolves the confusion

### Rule 6: Lying Exercise Detection

**Biomechanics:** Distinguish Bench Press, Plank, Push Up

```typescript
if (isLying) {
    const wristY = (landmarks[15].y + landmarks[16].y) / 2;
    const shoulderY = (landmarks[11].y + landmarks[12].y) / 2;
    
    // Prone (face down) vs Supine (face up)
    const isProne = wristY > shoulderY; // Wrists on floor
    
    const noseY = landmarks[0].y;
    const faceIsUp = noseY < shoulderY + 0.1;
    
    const elbowAngle = (
        calculateAngle(landmarks[11], landmarks[13], landmarks[15]) + 
        calculateAngle(landmarks[12], landmarks[14], landmarks[16])
    ) / 2;
    const elbowsBent = elbowAngle < 150;
    
    if (isProne && !faceIsUp && !elbowsBent) {
        // Plank or Push Up
        const elbowY = (landmarks[13].y + landmarks[14].y) / 2;
        if (Math.abs(wristY - elbowY) < 0.1) {
            return 'Plank'; // Forearms flat
        }
        return 'Push Up';
    } else {
        return 'Bench Press'; // Supine
    }
}
```

**Decision Tree:**
```
Lying position?
├─ Prone (face down)
│   ├─ Forearms flat → Plank
│   └─ Arms extended → Push Up
└─ Supine (face up) → Bench Press
```

---

## Exercise Detection Examples

### Example 1: Squat Detection

**Input Landmarks:**
```
Shoulder: {x: 0.5, y: 0.3}
Hip: {x: 0.5, y: 0.6}
Knee: {x: 0.5, y: 0.8}
Ankle: {x: 0.5, y: 0.95}
```

**Analysis:**
```typescript
// Step 1: Orientation
verticalDiff = |0.3 - 0.6| = 0.3
horizontalDiff = |0.5 - 0.5| = 0.0
isStanding = true (0.3 > 0.0 * 0.5)

// Step 2: Joint Angles
kneeAngle = calculateAngle(hip, knee, ankle) = 120°
hipAngle = calculateAngle(shoulder, hip, knee) = 130°

// Step 3: Rule Application
if (isStanding && kneeAngle < 140 && hipAngle < 140) {
    return 'Squat'; ✓
}
```

### Example 2: Bicep Curl Detection

**Input Landmarks:**
```
Shoulder: {x: 0.5, y: 0.3}
Elbow: {x: 0.52, y: 0.5}
Wrist: {x: 0.5, y: 0.35}
Hip: {x: 0.5, y: 0.6}
Knee: {x: 0.5, y: 0.8}
```

**Analysis:**
```typescript
// Step 1: Elbow Angle
elbowAngle = calculateAngle(shoulder, elbow, wrist) = 100°
isCurl = true (100 < 170)

// Step 2: Elbow Width
elbowWidth = 0.04 (assuming left elbow at 0.48)
shoulderWidth = 0.05
elbowsTucked = true (0.04 < 0.05 * 1.3)

// Step 3: Elbow Position
elbowY = 0.5
shoulderY = 0.3
elbowsLow = true (0.5 > 0.3 + 0.05)

// Step 4: Leg Check
kneeY = 0.8
hipY = 0.6
legsAreDown = true (0.8 > 0.6 + 0.1)

// Result
return 'Barbell Biceps Curl'; ✓
```

### Example 3: Chest Fly vs Lateral Raise

**Scenario A: Chest Fly (Seated)**
```
Elbow: {y: 0.3} (at shoulder level)
Wrist: {y: 0.32} (at shoulder level)
Knee angle: 110° (bent - seated)
→ Result: 'Chest Fly Machine' ✓
```

**Scenario B: Lateral Raise (Standing)**
```
Elbow: {y: 0.3} (at shoulder level)
Wrist: {y: 0.32} (at shoulder level)
Knee angle: 175° (straight - standing)
Wrist width: 0.6 (wide)
→ Result: 'Lateral Raises' ✓
```

---

## Common Pitfalls and Edge Cases

### Pitfall 1: Exercise Confusion

**Problem:** Similar body positions can be misclassified

**Examples:**
- Chest Fly ↔ Lateral Raise (both have arms out)
- Bicep Curl ↔ Russian Twist (both have bent elbows)
- T-Bar Row ↔ Lateral Raise (both can have inclined torso)

**Solutions:**
- **Knee angle check**: Seated vs standing
- **Leg position check**: Legs down vs V-sit
- **Hand position check**: Below vs above shoulders

### Pitfall 2: Camera Angle Dependency

**Problem:** Rules assume specific camera angles

**Example:**
```
Front view: Can see knee valgus, can't see torso lean
Side view: Can see depth, can't see knee alignment
45° view: Compromise, but less accurate for both
```

**Mitigation:**
- View detection logic (`BiomechanicalAnalyzer.detectView()`)
- Adaptive analysis based on detected view
- Relaxed thresholds to accommodate angle variations

### Pitfall 3: Body Type Variations

**Problem:** Hard-coded thresholds don't work for all users

**Examples:**
- Tall users: Longer limbs → different proportions
- Short users: Shorter limbs → different angles
- Flexible users: Can achieve deeper ROM
- Stiff users: Limited ROM may be flagged as poor form

**Current Limitation:**
- No personalization or calibration
- Same standards for all users

**Potential Solution:**
- Calibration phase (measure user's baseline ROM)
- Adaptive thresholds based on user's proportions

### Pitfall 4: Occlusion and Partial Visibility

**Problem:** MediaPipe still outputs landmarks with low visibility

**Example:**
```
User's hand is behind their back
→ MediaPipe estimates hand position (low confidence)
→ Classifier uses inaccurate data
→ Misclassification
```

**Current Handling:**
- No explicit visibility checks in classifier
- Assumes all landmarks are valid

**Potential Solution:**
- Filter landmarks by visibility threshold
- Return null if critical landmarks are occluded

---

## Optimization Strategies

### Strategy 1: Locking Mechanism

**Problem:** Classification can flicker between exercises

**Solution:** Require consecutive frames before locking

```typescript
// From GeometricRuleEngine.ts
if (detected) {
    if (this.consecutiveFramesMatches(detected)) {
        this.consecutiveFrames++;
    } else {
        this.consecutiveFrames = 1;
        this.potentialExercise = detected;
    }
    
    let lockThreshold = 20; // ~0.6s at 30fps
    if (detected === 'Plank') lockThreshold = 60; // 2s for static
    if (detected === 'Pull Up') lockThreshold = 15; // 0.5s for dynamic
    
    if (this.consecutiveFrames > lockThreshold) {
        this.isLocked = true;
        this.lockedExercise = detected;
    }
}
```

**Benefits:**
- Prevents flickering in auto-detect mode
- Gives user time to settle into position
- Different thresholds for static vs dynamic exercises

### Strategy 2: Priority-Based Rule Matching

**Problem:** Multiple rules can match the same pose

**Solution:** Apply rules in priority order

```typescript
// High priority: Unique biomechanics
if (isInclined && handsBelowShoulders) return 'T-Bar Row';
if (isCurl && elbowsTucked && elbowsLow) return 'Bicep Curl';

// Medium priority: Overhead exercises
if (wristY < noseY) {
    if (armIsExtendedOut && !elbowsTucked) return 'Lateral Raises';
    if (!feetOnFloor) return 'Pull Up';
    return 'Shoulder Press';
}

// Low priority: Generic leg motions
if (kneeAngle < 140 && hipAngle < 140) return 'Squat';
```

**Benefits:**
- Resolves conflicts deterministically
- Prioritizes exercises with unique signatures
- Falls back to generic rules

### Strategy 3: Threshold Tuning

**Problem:** Hard-coded thresholds may not generalize

**Current Approach:**
```typescript
const elbowsTucked = elbowWidth < shoulderWidth * 1.3;
const elbowsLow = elbowY > shoulderY + 0.05;
const kneesBent = kneeAngle < 150;
```

**Tuning Process:**
1. Test with real users
2. Identify false positives/negatives
3. Adjust thresholds iteratively
4. Document rationale in comments

**Example from code:**
```typescript
// Relaxed to 0.05 (was 0.1) to allow for higher elbows 
// or lower camera angle.
const elbowsLow = elbowY > shoulderY + 0.05;
```

---

## Future Improvements

### 1. Machine Learning Classifier

**Replace rule-based logic with trained model:**

```
Landmarks → Feature Extraction → ML Model → Exercise Type
```

**Pros:**
- Better generalization
- Learns from edge cases
- Less manual tuning

**Cons:**
- Requires labeled dataset (thousands of videos)
- Black box (less interpretable)
- Larger app size (model file)

### 2. Temporal Analysis

**Use sequence of frames instead of single frame:**

```
Landmarks[t-5:t] → LSTM/Transformer → Exercise Type
```

**Benefits:**
- Captures movement patterns (not just static poses)
- More robust to momentary occlusions
- Can distinguish exercises with similar poses but different motions

### 3. Equipment Detection

**Detect barbells, dumbbells, machines:**

```
Camera Frame → Object Detection → Equipment Type
Landmarks + Equipment → Exercise Type
```

**Benefits:**
- More accurate classification
- Can distinguish Barbell Curl vs Dumbbell Curl
- Enables exercise-specific coaching (e.g., "Bar too far forward")

### 4. Personalized Calibration

**Measure user's baseline ROM:**

```
User performs 3 reps → Record max/min angles → Adaptive thresholds
```

**Benefits:**
- Accounts for individual flexibility
- Fair scoring for all body types
- Progressive overload tracking

---

## Conclusion

The exercise classification system in GymScore AI is a **sophisticated rule-based engine** that leverages geometric heuristics to identify 22 exercises. While it has limitations (brittle thresholds, camera angle dependency), it demonstrates that **well-designed rules can achieve impressive accuracy** for a v1 product.

**Key Takeaways:**
1. **Hybrid approach works**: AI for pose, rules for logic
2. **Priority matters**: Apply rules in order of uniqueness
3. **Locking prevents flicker**: Require consecutive frames
4. **Thresholds need tuning**: Iterative testing is critical
5. **Future is ML**: Trained classifier would improve accuracy

This system is a **proof of concept** that validates the core idea: real-time exercise coaching is possible with on-device computer vision. The next evolution would involve collecting labeled data and training a custom classifier.
