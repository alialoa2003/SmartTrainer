# Smart Trainer - Complete Technical Documentation

> A real-time AI fitness coach using computer vision for exercise form analysis and rep counting.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture & System Design](#2-architecture--system-design)
3. [Project Structure](#3-project-structure)
4. [Core Logic & Business Rules](#4-core-logic--business-rules)
5. [AI / Smart Features Analysis](#5-ai--smart-features-analysis)
6. [Data Flow](#6-data-flow)
7. [Technologies & Dependencies](#7-technologies--dependencies)
8. [Execution & Runtime Behavior](#8-execution--runtime-behavior)
9. [Strengths & Weaknesses](#9-strengths--weaknesses)
10. [How to Explain This App](#10-how-to-explain-this-app)

---

## 1. Application Overview

### What the App Does

**Smart Trainer** is a mobile fitness coaching application that provides **real-time exercise form analysis** using your phone's camera. It tracks your workout performance, counts reps automatically, and gives instant feedback on your exercise technique.

### Target Users

- **Gym trainees** who want to improve their form without a personal trainer
- **Home workout enthusiasts** looking for automated coaching
- **Fitness beginners** who need guidance on proper exercise technique
- **Experienced lifters** who want objective feedback on their form

### Core Features

1. **15 Supported Exercises** across 4 categories:
   - **Legs**: Squat, Leg Extension, Leg Raises
   - **Push**: Push Up, Bench Press, Incline Bench Press, Tricep Dips, Chest Fly Machine
   - **Pull**: Pull Up, Lat Pulldown, T-Bar Row, Barbell Biceps Curl, Lateral Raises
   - **Core**: Plank, Russian Twist

2. **Auto-Detect Mode**: Automatically identifies which exercise you're performing

3. **Real-Time Form Analysis**: 
   - Live skeleton overlay on camera feed
   - Color-coded feedback (green = good form, red = needs correction)
   - Instant coaching cues ("Chest Up", "Knees Out", "Full Extension")

4. **Automatic Rep Counting**: Tracks reps with phase detection (Eccentric, Concentric, Bottom, Top)

5. **Form Scoring System**: 0-100 score based on 5 biomechanical pillars:
   - Stability (wobble, knee valgus)
   - Range of Motion (depth, full extension)
   - Posture (joint stacking, torso angle)
   - Efficiency (bar path, tempo)
   - Bracing (spinal integrity)

---

## 2. Architecture & System Design

### Overall Application Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native App                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  UI Layer (Screens + Components)                      │  │
│  │  - OnboardingScreen                                   │  │
│  │  - HomeScreen (Exercise Selection)                    │  │
│  │  - CameraScreen (Live Workout)                        │  │
│  │  - FormFeedbackOverlay (Skeleton Visualization)       │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Camera Processing Pipeline                           │  │
│  │  - react-native-vision-camera (Camera Access)         │  │
│  │  - Frame Processor (Worklet - runs on GPU thread)     │  │
│  │  - 90° Rotation Transform (Portrait Mode)             │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Pose Estimation Layer                                │  │
│  │  - react-native-mediapipe                             │  │
│  │  - pose_landmarker_lite.task (TFLite Model)           │  │
│  │  - GPU Delegate for acceleration                      │  │
│  │  - Outputs: 33 body landmarks (x, y, z, visibility)   │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Analysis Engine (Pure JavaScript Logic)              │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ GeometricRuleEngine                             │  │  │
│  │  │ - Exercise Selection / Auto-Detection           │  │  │
│  │  │ - Locking Mechanism (prevents flickering)       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ ExerciseClassifier (Functional)                 │  │  │
│  │  │ - 280+ lines of geometric heuristics             │  │  │
│  │  │ - Orientation detection (Standing/Lying)        │  │  │
│  │  │ - Joint angle calculations                      │  │  │
│  │  │ - Exercise-specific rules                       │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ Exercise Analyzers (15 classes)                 │  │  │
│  │  │ - SquatAnalyzer, BicepCurlAnalyzer, etc.        │  │  │
│  │  │ - Each extends BiomechanicalAnalyzer            │  │  │
│  │  │ - Rep counting + Form scoring                   │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ RepCounter (State Machine)                      │  │  │
│  │  │ - Phase tracking (Rest→Eccentric→Bottom→        │  │  │
│  │  │   Concentric→Top)                               │  │  │
│  │  │ - Threshold-based counting                      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Feedback Output                                      │  │
│  │  - Score (0-100)                                      │  │
│  │  - Rep Count                                          │  │
│  │  - Phase ("Eccentric", "Concentric", etc.)            │  │
│  │  - Message ("Chest Up", "Go Deeper", etc.)            │  │
│  │  - isGoodForm (boolean for color coding)              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Is There Any AI Involved?

**YES, it's a multi-tier hybrid approach:**

#### 1. Real-Time Processing (On-Device AI + Heuristics)
- **Pose Detection (AI)**: **MediaPipe Pose Landmarker** (Google's pre-trained TensorFlow Lite model).
  - Detects 33 body keypoints in real-time.
  - Runs on-device using GPU acceleration.
- **Exercise Classification**: 100% rule-based geometric heuristics.
- **Form Analysis (Real-Time)**: Biomechanical rules and angle calculations for instant cues.
- **Rep Counting**: State machine with threshold detection.

#### 2. Comprehensive Post-Workout Analysis (Remote AI Model)
- **Final Feedback Model**: A specialized deep learning model hosted on a remote server.
- **FastAPI Integration**: The application sends workout data to a **FastAPI-powered backend** for deep analysis.
- **Pillar-Based Scoring**: The remote model analyzes the entire set across **5 Biomechanical Pillars**:
  - **Stability**: Overall body control and joint stability.
  - **Posture**: Joint stacking and torso alignment.
  - **Range of Motion**: Depth of movement and full extension.
  - **Movement Quality**: Tempo, efficiency, and smoothness.
  - **Core Bracing**: Spinal integrity and bracing efficiency.
- **AI Summary**: The server returns custom summary feedback and specific solutions for improvement.

### How Decisions and Recommendations Are Generated

**Exercise Detection Flow:**
```
Landmarks → Calculate Joint Angles → Apply Geometric Rules → Classify Exercise
```

**Example: Detecting a Squat**
```javascript
// 1. Check orientation (Standing vs Lying)
const isStanding = shoulderY < hipY && verticalDiff > horizontalDiff * 0.5;

// 2. Calculate joint angles
const kneeAngle = calculateAngle(hip, knee, ankle);
const hipAngle = calculateAngle(shoulder, hip, knee);

// 3. Apply rules
if (isStanding && kneeAngle < 140 && hipAngle < 140) {
    return 'Squat';
}
```

**Form Feedback Flow:**
```
Landmarks → Biomechanical Analysis → Score Calculation → Feedback Message
```

**Example: Squat Depth Check**
```javascript
// Check if hips are below knees (good depth)
if (hip.y >= knee.y - 0.05) {
    depthScore = 100; // Good depth
} else {
    depthScore = 60;  // Partial rep
    message = "Go Deeper";
}
```

---

## 3. Project Structure

### Root Directory (`GymScoreClone/`)

```
GymScoreClone/
├── android/              # Android native build files
├── assets/               # Static resources
│   ├── fonts/            # Michroma.ttf, Metashift.otf
│   ├── videos/           # startvid.mp4 (onboarding)
│   └── icon.png, splash.png
├── src/                  # Source code (see below)
├── node_modules/         # Dependencies
├── App.tsx               # Root component (navigation logic)
├── index.js              # Entry point (registers App)
├── package.json          # Dependencies & scripts
├── app.json              # Expo configuration
├── babel.config.js       # Babel transpiler config
└── tsconfig.json         # TypeScript config
```

### Source Code Structure (`src/`)

```
src/
├── ai/                   # Core intelligence layer
│   ├── ExerciseAnalyzer.ts          # Base class + interfaces
│   ├── ExerciseClassifier.ts        # Exercise detection (280+ lines)
│   ├── GeometricRuleEngine.ts       # Main orchestrator
│   ├── PoseEstimator.ts             # MediaPipe integration
│   ├── exercises/                   # 15 exercise-specific analyzers
│   │   ├── SquatAnalyzer.ts
│   │   ├── BicepCurlAnalyzer.ts
│   │   ├── PlankAnalyzer.ts
│   │   └── ... (12 more)
│   ├── analysis/
│   │   └── BiomechanicalAnalyzer.ts # Base class for form analysis
│   └── reps/
│       └── RepCounter.ts            # State machine for rep counting
├── components/
│   └── FormFeedbackOverlay.tsx      # Skeleton visualization
├── screens/
│   ├── OnboardingScreen.tsx         # Welcome screen with video
│   ├── HomeScreen.tsx               # Exercise selection grid
│   └── (CameraScreen.tsx is in src/)
├── constants/
│   └── theme.ts                     # Colors, spacing, fonts
└── CameraScreen.tsx                 # Main workout screen
```

### Key Files Explained

#### Entry Points
- **`index.js`**: Registers the React Native app
- **`App.tsx`**: Root component managing screen navigation (Onboarding → Home → Camera)

#### Configuration
- **`app.json`**: Expo config (app name, permissions, plugins)
- **`package.json`**: Dependencies (React Native, Expo, MediaPipe, Vision Camera)
- **`babel.config.js`**: Enables Reanimated plugin for worklets

#### Core AI Files
- **`PoseEstimator.ts`**: Hooks into MediaPipe, processes frames at ~15fps
- **`ExerciseClassifier.ts`**: Pure function with geometric rules for exercise detection
- **`GeometricRuleEngine.ts`**: Manages exercise selection, auto-detection, locking
- **`BiomechanicalAnalyzer.ts`**: Abstract base class for 5-pillar form analysis
- **`RepCounter.ts`**: Generic state machine for counting reps

#### Exercise Analyzers
Each analyzer (e.g., `SquatAnalyzer.ts`) follows this pattern:
1. Extends `BiomechanicalAnalyzer`
2. Calculates normalized position (0-1) for rep counting
3. Analyzes form using 5 pillars
4. Generates feedback messages
5. Returns `Feedback` object with score, reps, phase, message

---

## 4. Core Logic & Business Rules

### How Workout Plans Are Created

**This app does NOT create workout plans.** It's a **real-time form coach**, not a workout planner. Users manually select exercises from a predefined list.

### How Exercises, Sets, Reps, Rest Times Are Handled

#### Exercise Selection
- User selects from 15 exercises OR chooses "Auto-Detect"
- Selection happens in `HomeScreen.tsx` via category filters (Legs, Push, Pull, Core)

#### Sets
- **Not tracked**. The app focuses on individual reps within a single set.
- Users manually track sets externally.

#### Reps
- **Automatically counted** using `RepCounter.ts`
- State machine tracks phases: `Rest → Eccentric → Bottom → Concentric → Top`
- Rep increments when full cycle completes (e.g., Squat: Standing → Bottom → Standing)

**Rep Counting Logic:**
```typescript
// Normalized position: 0 = start, 1 = peak
// Example: Squat knee angle 170° → 0.0, 90° → 1.0
const normalizedPos = (170 - kneeAngle) / 80;

// State machine
if (phase === 'Eccentric' && normalizedPos >= 0.8) {
    phase = 'Bottom'; // Hit depth
}
if (phase === 'Concentric' && normalizedPos <= 0.2) {
    repCount++; // Completed rep
    phase = 'Top';
}
```

#### Rest Times
- **Not tracked**. App provides continuous feedback during active exercise.

### Progress Tracking Logic

**No persistent progress tracking.** The app is session-based:
- Rep count resets when you leave the camera screen
- No workout history or analytics
- No user profiles or saved data

### Personalization Logic

**No personalization.** The app uses universal biomechanical standards:
- Same depth requirements for all users (e.g., hips below knees for squats)
- Same angle thresholds for form scoring
- No adaptation based on user height, flexibility, or experience level

---

## 5. AI / Smart Features Analysis

### Does the App Use AI?

**Partially.** It's a **hybrid system**:

| Component | Type | Details |
|-----------|------|---------|
| **Pose Detection** | ✅ AI (Deep Learning) | MediaPipe Pose Landmarker (TFLite model) |
| **Exercise Classification** | ❌ Rule-Based | 280+ lines of geometric heuristics |
| **Form Analysis** | ❌ Rule-Based | Biomechanical angle calculations |
| **Rep Counting** | ❌ Rule-Based | State machine with thresholds |
| **Feedback Generation** | ❌ Rule-Based | Conditional logic |

### Where Intelligence Comes From

#### 1. MediaPipe Pose Landmarker (AI)
- **What it does**: Detects 33 body keypoints from camera frames
- **How it works**: 
  - Pre-trained TensorFlow Lite model (Google)
  - Trained on millions of labeled images
  - Runs on-device using GPU acceleration
  - Outputs: `{x, y, z, visibility}` for each landmark
- **Model file**: `pose_landmarker_lite.task` (bundled with react-native-mediapipe)

#### 2. Exercise Classification (Rule-Based)
- **What it does**: Identifies which exercise you're performing
- **How it works**: 
  - Calculates joint angles from landmarks
  - Applies geometric rules (e.g., "if elbows are bent AND hands are at shoulder height AND knees are straight → Bicep Curl")
  - Uses orientation detection (standing vs lying)
  - Checks body proportions and limb positions

**Example Rule (Bicep Curl):**
```typescript
const elbowAngle = calculateAngle(shoulder, elbow, wrist);
const isCurl = elbowAngle < 170;
const elbowsTucked = elbowWidth < shoulderWidth * 1.3;
const elbowsLow = elbowY > shoulderY + 0.05;

if (isCurl && elbowsTucked && elbowsLow) {
    return 'Barbell Biceps Curl';
}
```

#### 3. Form Analysis (Rule-Based)
- **What it does**: Scores your form on 5 pillars
- **How it works**:
  - **Stability**: Checks for wobble (e.g., knee valgus in squats)
  - **ROM**: Validates depth/extension (e.g., hips below knees)
  - **Posture**: Checks joint stacking (e.g., torso angle)
  - **Efficiency**: Analyzes bar path (mostly placeholder)
  - **Bracing**: Checks spinal integrity (mostly placeholder)

**Example (Squat Depth):**
```typescript
if (hip.y >= knee.y - 0.05) {
    return 100; // Good depth
} else {
    return 60;  // Partial rep
    message = "Go Deeper";
}
```

#### 4. Rep Counting (Rule-Based)
- **What it does**: Counts reps automatically
- **How it works**:
  - Normalizes joint angle to 0-1 range
  - State machine tracks phases
  - Increments count on full cycle completion

### Limitations of the Current Approach

#### AI Limitations (MediaPipe)
- **2D Pose Estimation**: No true 3D depth (z-values are relative, not absolute)
- **Occlusion Issues**: Loses tracking if body parts are hidden
- **Lighting Sensitivity**: Poor performance in low light
- **Single Person**: Can only track one person at a time
- **No Object Detection**: Can't see barbells, dumbbells, or equipment

#### Rule-Based Limitations
- **Brittle Rules**: Hard-coded thresholds may not work for all body types
- **No Learning**: Can't adapt to individual users or improve over time
- **Camera Angle Dependency**: Requires specific viewing angles (side/front)
- **False Positives**: Similar exercises can be confused (e.g., Chest Fly vs Lateral Raise)
- **No Context Awareness**: Can't distinguish between warm-up and working sets

#### Specific Issues (from conversation history)
- **Exercise Confusion**: Chest Fly misclassified as Lateral Raise when knees are bent
- **Detection Hesitation**: Auto-detect mode can be slow to lock onto an exercise
- **Posture Sensitivity**: Bent legs or seated positions can confuse classification

---

## 6. Data Flow

### From User Input → Processing → Output

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER INPUT                                                │
│    - User selects exercise (or "Auto-Detect")                │
│    - User positions themselves in camera frame               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. CAMERA CAPTURE                                            │
│    - react-native-vision-camera captures frames              │
│    - Frame Processor (Worklet) runs on GPU thread            │
│    - ~30fps capture rate                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. POSE ESTIMATION                                           │
│    - MediaPipe processes frame                               │
│    - Outputs 33 landmarks (x, y, z, visibility)              │
│    - Landmarks rotated 90° for portrait mode                 │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. THROTTLING (Performance Optimization)                     │
│    - Updates throttled to ~15fps (every 66ms)                │
│    - Prevents UI overload                                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. EXERCISE DETECTION (if Auto-Detect)                       │
│    - ExerciseClassifier.classifyExercise(landmarks)          │
│    - Returns detected exercise or null                       │
│    - Locking mechanism (15-60 frames) prevents flickering    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. EXERCISE ANALYSIS                                         │
│    - GeometricRuleEngine selects appropriate analyzer        │
│    - Analyzer calculates:                                    │
│      • Normalized position (for rep counting)                │
│      • Joint angles (elbow, knee, hip, etc.)                 │
│      • 5-pillar scores (stability, ROM, posture, etc.)       │
│      • Feedback messages                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. REP COUNTING                                              │
│    - RepCounter.update(normalizedPos)                        │
│    - State machine transitions (Rest→Eccentric→Bottom→       │
│      Concentric→Top)                                         │
│    - Increments count on full cycle                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. FEEDBACK GENERATION                                       │
│    - Combines scores, phase, and messages                    │
│    - Returns Feedback object:                                │
│      {                                                        │
│        score: 85,                                             │
│        reps: 5,                                               │
│        repPhase: "Concentric",                                │
│        message: "Chest Up",                                   │
│        isGoodForm: true                                       │
│      }                                                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. UI UPDATE                                                 │
│    - CameraScreen receives feedback                          │
│    - FormFeedbackOverlay draws skeleton (green/red)          │
│    - Score, reps, phase, message displayed                   │
│    - Updates at ~15fps                                       │
└─────────────────────────────────────────────────────────────┘
```

### State Management

**No global state library** (Redux, MobX, etc.). State is managed locally:

#### App-Level State (`App.tsx`)
```typescript
const [currentScreen, setCurrentScreen] = useState('Onboarding');
const [selectedExercise, setSelectedExercise] = useState('Squat');
```

#### Camera Screen State (`CameraScreen.tsx`)
```typescript
const [cameraPosition, setCameraPosition] = useState('back');
```

#### Pose Estimator State (`PoseEstimator.ts`)
```typescript
const [feedback, setFeedback] = useState<Feedback | null>(null);
const [landmarks, setLandmarks] = useState([]);
const [fps, setFps] = useState(0);
```

#### Exercise Analyzer State (per analyzer)
```typescript
private repCounter = new RepCounter();
private biomechanics = new SquatBiomechanics();
private history: PoseLandmark[][] = []; // Last 30 frames
```

### Database or Storage Usage

**None.** The app is entirely in-memory:
- No SQLite, AsyncStorage, or file system writes
- No workout history persistence
- No user profiles
- All data resets when app closes

### How User Progress Is Stored and Retrieved

**It isn't.** The app is session-based:
- Rep count resets when leaving camera screen
- No workout logs or analytics
- No cloud sync or data export

---

## 7. Technologies & Dependencies

### Frameworks

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.5 | Cross-platform mobile framework |
| **Expo** | ~54.0.33 | Development toolchain & native modules |
| **TypeScript** | ~5.9.2 | Type safety |

### Core Libraries

| Library | Version | Purpose | Why Chosen |
|---------|---------|---------|------------|
| **react-native-vision-camera** | ^4.7.3 | Camera access & frame processing | Industry standard for high-performance camera in RN |
| **react-native-mediapipe** | ^0.6.0 | Pose estimation | Google's state-of-the-art pose detection |
| **react-native-reanimated** | ~4.1.1 | Worklets (GPU thread execution) | Required for frame processors |
| **react-native-worklets** | 0.5.1 | Worklet runtime | Enables JS on GPU thread |
| **react-native-svg** | 15.12.1 | Skeleton overlay rendering | Vector graphics for smooth scaling |
| **expo-av** | ^16.0.8 | Video playback (onboarding) | Expo's video component |
| **expo-font** | ^14.0.11 | Custom fonts (Michroma, Metashift) | Branding |

### Why These Technologies Were Chosen

#### React Native + Expo
- **Cross-platform**: Single codebase for iOS & Android
- **Fast iteration**: Hot reload, easy debugging
- **Native performance**: Direct access to camera & GPU
- **Expo ecosystem**: Simplified build & deployment

#### MediaPipe
- **Accuracy**: Google's state-of-the-art pose model
- **Speed**: Optimized for mobile (lite model)
- **On-device**: No cloud dependency, works offline
- **Free**: Open-source, no API costs

#### Vision Camera
- **Performance**: 30fps+ capture with frame processors
- **Worklets**: JS runs on GPU thread (no bridge overhead)
- **Flexibility**: Supports custom frame processing

#### Reanimated + Worklets
- **Required**: Vision Camera frame processors need worklets
- **Performance**: Avoids React Native bridge bottleneck
- **Smooth UI**: Animations run at 60fps even during heavy processing

---

## 8. Execution & Runtime Behavior

### How the App Starts

```
1. index.js
   └─> Registers App component with AppRegistry

2. App.tsx
   └─> Loads fonts (Michroma, Metashift)
   └─> Requests camera & microphone permissions
   └─> Shows OnboardingScreen

3. OnboardingScreen.tsx
   └─> Plays background video (startvid.mp4)
   └─> User taps "START WORKOUT"
   └─> Navigates to HomeScreen

4. HomeScreen.tsx
   └─> Displays 22 exercises in grid
   └─> User selects exercise
   └─> Navigates to CameraScreen

5. CameraScreen.tsx
   └─> Initializes camera
   └─> Starts MediaPipe pose detection
   └─> Begins real-time analysis loop
```

### What Happens on First Launch

1. **Permission Requests**:
   - Camera permission (required)
   - Microphone permission (requested but not used)

2. **Font Loading**:
   - Michroma.ttf (title font)
   - Metashift.otf (subtitle font)
   - App shows black screen until fonts load

3. **MediaPipe Initialization**:
   - Loads `pose_landmarker_lite.task` model (~3MB)
   - Initializes GPU delegate
   - First frame takes ~500ms to process

### How Main Features Are Triggered

#### Exercise Selection
```
User taps exercise card
  → onSelectExercise(exerciseType)
  → setSelectedExercise(exerciseType)
  → setCurrentScreen('Camera')
  → CameraScreen mounts
  → usePoseEstimator(exerciseType) initializes
  → GeometricRuleEngine.setExercise(exerciseType)
```

#### Auto-Detection
```
User selects "Auto-Detect"
  → GeometricRuleEngine enters auto-detect mode
  → Every frame:
      1. classifyExercise(landmarks) → detected exercise
      2. Consecutive frame check (15-60 frames)
      3. Lock onto exercise when stable
      4. Start analysis with locked exercise
```

#### Rep Counting
```
Every frame (~15fps):
  1. Calculate joint angle (e.g., knee angle)
  2. Normalize to 0-1 range
  3. RepCounter.update(normalizedPos)
  4. State machine transitions
  5. Increment count on full cycle
```

#### Form Feedback
```
Every frame (~15fps):
  1. Analyzer.analyze(landmarks)
  2. Calculate 5-pillar scores
  3. Generate feedback message
  4. Return Feedback object
  5. UI updates (skeleton color, score, message)
```

### Error Handling and Edge Cases

#### No Pose Detected
```typescript
if (!landmarks || landmarks.length === 0) {
    return {
        score: 0,
        reps: 0,
        message: "No pose detected",
        isGoodForm: false
    };
}
```

#### Camera Permission Denied
- App shows "No Device" message
- User must manually enable in system settings

#### Exercise Classification Fails (Auto-Detect)
```typescript
if (!detected) {
    return {
        message: "Get in position...",
        repPhase: "Scanning..."
    };
}
```

#### Partial Body Visibility
- MediaPipe still outputs landmarks (with low visibility scores)
- Analyzers may produce inaccurate results
- No explicit handling for occlusion

#### Low Light
- MediaPipe performance degrades
- Pose detection may fail entirely
- No fallback or warning

---

## 9. Strengths & Weaknesses

### Strengths

#### ✅ Well-Designed Aspects

1. **Clean Architecture**
   - Clear separation of concerns (UI, pose estimation, analysis)
   - Modular exercise analyzers (easy to add new exercises)
   - Reusable base classes (`BiomechanicalAnalyzer`, `ExerciseAnalyzer`)

2. **Performance Optimizations**
   - Worklets for GPU-thread processing
   - Throttled updates (15fps analysis vs 30fps capture)
   - Efficient state machine for rep counting

3. **User Experience**
   - Real-time feedback (no lag)
   - Color-coded skeleton (intuitive)
   - Clear coaching cues ("Chest Up", "Knees Out")
   - Auto-detect mode (beginner-friendly)

4. **On-Device Processing**
   - No cloud dependency (works offline)
   - No API costs
   - Privacy-friendly (no data leaves device)

5. **Comprehensive Exercise Coverage**
   - 15 exercises across all major muscle groups
   - Supports both compound and isolation movements

#### 🎯 Technical Highlights

- **Functional Exercise Classifier**: Pure function (no class instance issues in worklets)
- **Locking Mechanism**: Prevents flickering in auto-detect mode
- **View Detection**: Adapts analysis based on camera angle (front/side/45°)
- **Dual Rep Modes**: Supports eccentric-first (squat) and concentric-first (curl)

### Weaknesses

#### ❌ Fragile or Hard-Coded Aspects

1. **Brittle Geometric Rules**
   - Hard-coded thresholds (e.g., `kneeAngle < 140`)
   - May not work for all body types (tall/short, flexible/stiff)
   - No adaptation to individual users

2. **Camera Angle Dependency**
   - Requires specific viewing angles (side for squats, front for curls)
   - No guidance on optimal camera placement
   - Poor performance from diagonal angles

3. **No Persistent Data**
   - No workout history or progress tracking
   - Can't review past sessions
   - No analytics or trends

4. **Limited Form Analysis**
   - Efficiency and Bracing pillars are mostly placeholders
   - No bar path tracking (can't see equipment)
   - No tempo analysis (speed of reps)

5. **Exercise Confusion**
   - Similar exercises can be misclassified (Chest Fly ↔ Lateral Raise)
   - Requires very specific postures for accurate detection
   - Auto-detect can be slow to lock on

6. **No Personalization**
   - Same standards for all users
   - No adjustment for experience level
   - No customizable depth/ROM targets

7. **Incomplete Biomechanical Analysis**
   - Only 2/5 pillars are fully implemented (Stability, ROM)
   - Posture, Efficiency, Bracing are basic or placeholder

#### ⚠️ Scalability Concerns

1. **Maintainability**
   - 280+ line classification function is hard to debug
   - Adding new exercises requires modifying multiple files
   - No unit tests for geometric rules

2. **Performance**
   - MediaPipe runs on every frame (battery drain)
   - No adaptive frame rate based on device capability
   - No optimization for low-end devices

3. **Extensibility**
   - Hard to add new features (e.g., workout plans, social sharing)
   - No plugin system for custom exercises
   - Tightly coupled components

---

## 10. How to Explain This App to Others

### Simple High-Level Explanation

> **"Smart Trainer is like having a personal trainer in your pocket. Point your phone's camera at yourself while working out, and it automatically counts your reps and tells you if your form is good or bad. It uses Google's AI to track your body movements, then applies biomechanical rules to give you instant coaching cues like 'Chest Up' or 'Go Deeper'. It works completely offline and supports 22 different exercises."**

### Technical Explanation

> **"GymScore is a React Native mobile app that performs real-time exercise form analysis using computer vision. It uses MediaPipe Pose Landmarker (a TensorFlow Lite model) to detect 33 body keypoints at 30fps, then applies geometric heuristics to classify exercises and analyze form. The system uses a hybrid approach: AI for pose estimation, rule-based logic for everything else. It features a state machine for rep counting, a 5-pillar biomechanical scoring system, and an auto-detection mode with a locking mechanism to prevent classification flickering. All processing happens on-device using GPU acceleration via React Native Worklets. Currently supports 15 exercises across 4 categories."**

### How to Defend the Design in a Discussion

#### Why Rule-Based Instead of ML for Classification?

**Pros:**
- ✅ **Explainable**: You can debug why an exercise was misclassified
- ✅ **No Training Data**: Don't need thousands of labeled exercise videos
- ✅ **Fast Iteration**: Can tweak rules in minutes, no retraining
- ✅ **Deterministic**: Same input always produces same output
- ✅ **Lightweight**: No additional ML models to bundle

**Cons:**
- ❌ **Brittle**: Hard-coded thresholds don't generalize well
- ❌ **Maintenance**: 330-line function is hard to maintain
- ❌ **Limited Accuracy**: Can't learn from edge cases

**Defense:**
> "For a v1 MVP, rule-based classification was the right choice. It allowed rapid prototyping and iteration based on real-world testing. The geometric rules are based on biomechanical principles, making them interpretable and debuggable. If we needed higher accuracy, we could collect labeled data and train a custom classifier, but for 15 exercises with distinct movement patterns, heuristics work surprisingly well."

#### Why No Workout History?

**Defense:**
> "This app is a real-time form coach, not a workout tracker. The core value is instant feedback during your set, not long-term analytics. Adding persistence would require database design, sync logic, and privacy considerations. For v1, we focused on nailing the real-time experience. Workout tracking can be added later as a separate feature."

#### Why MediaPipe Instead of Custom Model?

**Defense:**
> "MediaPipe is Google's state-of-the-art pose estimation model, trained on millions of images. Building a custom model would require massive datasets, GPU clusters, and months of training. MediaPipe gives us production-quality pose detection out of the box, optimized for mobile, with GPU acceleration. It's the industry standard for a reason."

#### Why No Cloud/Backend?

**Defense:**
> "On-device processing has three major advantages: (1) Works offline, (2) No API costs, (3) Privacy-friendly (no data leaves device). For a fitness app, these are critical. Users want to work out anywhere, even in gyms with poor WiFi. The trade-off is no cross-device sync, but that's acceptable for v1."

---

## Appendix: Code Examples

### Example: Exercise Classification Rule (Squat)

```typescript
// From ExerciseClassifier.ts
if (isStanding) {
    const kneeAngle = getAvgAngle(landmarks, 23, 25, 27, 24, 26, 28);
    const hipAngle = getAvgAngle(landmarks, 11, 23, 25, 12, 24, 26);
    
    if (kneeAngle < 140 && hipAngle < 140) {
        return 'Squat';
    }
}
```

### Example: Rep Counting State Machine

```typescript
// From RepCounter.ts
switch (this.currentPhase) {
    case 'Rest':
        if (completion > this.thresholdLow) {
            this.currentPhase = 'Eccentric'; // Start descending
        }
        break;
    case 'Eccentric':
        if (completion >= this.thresholdHigh) {
            this.currentPhase = 'Bottom'; // Hit depth
        }
        break;
    case 'Bottom':
        if (completion < this.thresholdHigh - 0.1) {
            this.currentPhase = 'Concentric'; // Start ascending
        }
        break;
    case 'Concentric':
        if (completion <= this.thresholdLow) {
            this.count++; // Rep complete!
            this.currentPhase = 'Top';
        }
        break;
}
```

### Example: Form Analysis (Squat Depth)

```typescript
// From SquatAnalyzer.ts
checkDepth(current: PoseLandmark[], view: CameraView): number {
    const hip = current[24];
    const knee = current[26];
    
    // Hip should be at or below knee level (Y increases downward)
    if (hip.y >= knee.y - 0.05) {
        return 100; // Good depth
    }
    return 60; // Partial rep
}
```

---

## Conclusion

**Smart Trainer** is a well-architected real-time fitness coach that cleverly combines Google's MediaPipe AI with rule-based biomechanical analysis. While it has limitations (no workout tracking, brittle rules, camera angle dependency), it delivers on its core promise: **instant, actionable form feedback during your workout**. The hybrid approach (AI for pose, rules for logic) was the right choice for rapid development and on-device performance.

**Key Takeaway:** This is NOT a "pure AI" app. It's a **computer vision app with smart heuristics**. The intelligence comes from well-designed geometric rules, not machine learning models. Understanding this distinction is critical for evaluating its strengths and limitations.
