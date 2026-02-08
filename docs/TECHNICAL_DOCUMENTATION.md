# Smart Trainer - Technical Documentation

> A Comprehensive Technical Analysis for Senior Developers

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
10. [How to Explain This App to Others](#10-how-to-explain-this-app-to-others)

---

## 1. Application Overview

### What the App Does

**Smart Trainer** is a mobile fitness application that provides real-time exercise form feedback using computer vision. It analyzes a user's body position during workouts and scores their form quality, counts repetitions, and offers corrective suggestions.

### Target Users

| User Type | Use Case |
|-----------|----------|
| **Trainees** | Self-monitor workout form without a personal trainer |
| **Fitness Enthusiasts** | Track rep counts and form quality over time |
| **Beginners** | Learn proper exercise technique with real-time guidance |
| **Home Gym Users** | Get coaching feedback without gym staff |

### Core Features

1. **Real-Time Pose Detection** - Live camera feed analyzes body position
2. **Auto-Detect Mode** - Automatically identifies which exercise is being performed
3. **15 Exercise Analyzers** - Specialized biomechanical analysis per exercise
4. **Rep Counting** - Automatic repetition counting with phase detection
5. **Form Scoring** - 5-pillar scoring system (Stability, ROM, Posture, Efficiency, Bracing)
6. **Video Upload Analysis** - Analyze pre-recorded workout videos
7. **Recording with Analysis** - Record and analyze workout sessions
8. **Visual Skeleton Overlay** - Shows detected pose landmarks on the user

### Supported Exercises

```
┌─────────────┬────────────────────────────────────────────────────────┐
│ Category    │ Exercises                                              │
├─────────────┼────────────────────────────────────────────────────────┤
│ Legs        │ Squat, Leg Extension, Leg Raises                       │
│ Push        │ Push Up, Bench Press, Incline Bench, Tricep Dips,      │
│             │ Chest Fly Machine                                      │
│ Pull        │ Pull Up, Lat Pulldown, T-Bar Row, Barbell Biceps Curl, │
│             │ Lateral Raises                                         │
│ Core        │ Plank, Russian Twist                                   │
│ AI          │ Auto-Detect (identifies exercise automatically)        │
└─────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. Architecture & System Design

### Overall Application Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Smart Trainer APPLICATION                            │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PRESENTATION LAYER                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐│    │
│  │  │ HomeScreen  │  │CameraScreen │  │VideoAnalysisScreen       ││    │
│  │  │ (Exercise   │  │(Live Feed   │  │(Uploaded Video           ││    │
│  │  │  Selection) │  │ + Recording)│  │ Frame-by-Frame Analysis) ││    │
│  │  └─────────────┘  └──────┬──────┘  └────────────┬─────────────┘│    │
│  └──────────────────────────┼──────────────────────┼───────────────┘    │
│                             │                      │                    │
│  ┌──────────────────────────┴──────────────────────┴───────────────┐    │
│  │                    AI / ANALYSIS LAYER                          │    │
│  │                                                                 │    │
│  │  ┌─────────────────┐    ┌─────────────────────────────────────┐│    │
│  │  │ PoseEstimator   │───▶│ GeometricRuleEngine                 ││    │
│  │  │ (MediaPipe Hook)│    │                                     ││    │
│  │  └─────────────────┘    │  ┌─────────────────────────────────┐││    │
│  │                         │  │ ExerciseClassifier              │││    │
│  │  ┌─────────────────┐    │  │ (Pure Geometric Classification) │││    │
│  │  │react-native-    │    │  └─────────────────────────────────┘││    │
│  │  │mediapipe        │    │                                     ││    │
│  │  │(Pose Detection) │    │  ┌─────────────────────────────────┐││    │
│  │  └─────────────────┘    │  │ Exercise Analyzers (x15)        │││    │
│  │                         │  │ • SquatAnalyzer                 │││    │
│  │                         │  │ • PushUpAnalyzer                │││    │
│  │                         │  │ • BenchPressAnalyzer            │││    │
│  │                         │  │ • ... (12 more)                 │││    │
│  │                         │  └─────────────────────────────────┘││    │
│  │                         └─────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    OPTIONAL BACKEND                             │    │
│  │  ┌─────────────────────────────────────────────────────────────┐│    │
│  │  │ AnalyticsService → POST /api/analyze-form                   ││    │
│  │  │ (Sends video + rep data for additional AI feedback)         ││    │
│  │  │ Server: http://192.168.1.2:8000 (Local Network)             ││    │
│  │  └─────────────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Is There Any AI Involved?

**YES, Smart Trainer uses a sophisticated multi-tier hybrid architecture:**

#### 1. Real-Time Processing (On-Device)
- **Pose Estimation (AI)**: Uses **MediaPipe Pose Landmarker**, a pre-trained deep learning model from Google.
  - Detects 33 body landmarks in real-time at 30fps.
  - Runs entirely on-device using GPU acceleration.
- **Rule-Based Logic**: Deterministic geometric heuristics for:
  - Exercise Classification (pattern matching body positions).
  - Rep Counting (state machine tracking movement phases).
  - Instant Feedback Cues (angle-based biomechanical checks).

#### 2. Advanced Form Analysis (Remote Model via FastAPI)
- **Deep Learning Model**: A specialized model hosted on a remote server for high-fidelity form analysis.
- **FastAPI Integration**: The application communicates with a **FastAPI backend** (configured at `http://192.168.1.2:8000`).
- **5-Pillar Feedback System**: The remote model performs a comprehensive analysis of each set across five critical biomechanical domains:
  - **Stability**: Measures balance and joint stability throughout the movement.
  - **Posture**: Analyzes joint stacking, torso alignment, and spinal neutrality.
  - **Range of Motion**: Validates movement depth and full joint extension.
  - **Movement Quality**: Assesses tempo, rhythm, and smoothness of execution.
  - **Core Bracing**: Evaluates spinal integrity and abdominal pressure management.
- **Personalized Recommendations**: The server returns an AI-generated summary, specific scores for each pillar, and actionable solutions for technique improvement.

### How Decisions and Recommendations Are Generated

```
┌──────────────────────────────────────────────────────────────────────┐
│                     DECISION GENERATION FLOW                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Camera Frame                                                       │
│        │                                                             │
│        ▼                                                             │
│   ┌─────────────────┐                                                │
│   │  MediaPipe SDK  │  ◀── Only ML component (pre-trained, Google)  │
│   │  (Pose Detect)  │                                                │
│   └────────┬────────┘                                                │
│            │ 33 Landmarks (x, y, z, visibility)                      │
│            ▼                                                         │
│   ┌─────────────────┐                                                │
│   │ ExerciseClassify│  ◀── Pure Math: angles, positions, ratios     │
│   │ (270+ lines of  │                                                │
│   │  if/else rules) │                                                │
│   └────────┬────────┘                                                │
│            │ ExerciseType                                            │
│            ▼                                                         │
│   ┌─────────────────┐                                                │
│   │ Analyzer[type]  │  ◀── Hardcoded thresholds per exercise        │
│   │ .analyze()      │                                                │
│   └────────┬────────┘                                                │
│            │                                                         │
│            ▼                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐│
│   │ FEEDBACK OBJECT                                                 ││
│   │ {                                                               ││
│   │   score: 85,              // Weighted avg of 5 pillars          ││
│   │   message: "Knees Out!",  // Hardcoded string from switch/case  ││
│   │   isGoodForm: true,       // score > 80 && no quality flags     ││
│   │   reps: 5                 // State machine counter              ││
│   │ }                                                               ││
│   └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Structure

### Root Directory

```
e:\SmartTrainer\
├── App.tsx                 # Main entry point, screen navigation
├── App.js                  # Thin wrapper (imports App.tsx)
├── index.js                # Expo entry point
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── babel.config.js         # Babel presets for Expo
├── app.json                # Expo app configuration
│
├── src/                    # Main source code
│   ├── CameraScreen.tsx    # Live camera + recording screen
│   ├── ai/                 # "AI" (geometric analysis) code
│   ├── screens/            # UI screens
│   ├── components/         # Reusable UI components
│   ├── services/           # Backend API services
│   └── constants/          # Theme and configuration
│
├── docs/                   # Documentation (this folder)
├── assets/                 # Fonts and static assets
│   └── fonts/
│       ├── Michroma.ttf
│       └── Metashift.otf
└── android/                # Android native code (auto-generated)
```

### Source Code Breakdown

#### `src/ai/` - The "AI" Engine (Pure Geometric Logic)

```
src/ai/
├── ExerciseAnalyzer.ts     # Base class + interfaces
│   • PoseLandmark interface
│   • ScoreBreakdown interface
│   • ExerciseType union type
│   • Feedback interface
│   • ExerciseAnalyzer abstract class
│
├── PoseEstimator.ts        # React hook for MediaPipe
│   • usePoseEstimator() - hooks into camera frame processor
│   • Manages FPS throttling (updates at ~15fps)
│   • Coordinates rotation for portrait mode
│
├── ExerciseClassifier.ts   # Exercise detection (270+ lines)
│   • classifyExercise() - pure function
│   • All detection via angle calculations
│   • Hardcoded thresholds for each pose signature
│
├── GeometricRuleEngine.ts  # Main analysis orchestrator
│   • Manages 15 exercise analyzers
│   • Auto-detection locking mechanism
│   • Frames-based confirmation before locking
│
├── analysis/
│   └── BiomechanicalAnalyzer.ts  # Base class for biomechanics
│       • 5-pillar scoring framework
│       • Camera view detection (Front/Side/45°)
│       • Common angle calculation utilities
│
├── reps/
│   └── RepCounter.ts       # Rep counting state machine
│       • EccentricFirst vs ConcentricFirst modes
│       • Phase tracking (Rest → Eccentric → Bottom → Concentric → Top)
│       • Rep timestamps for analytics
│
└── exercises/              # 15 exercise-specific analyzers
    ├── SquatAnalyzer.ts    # 542 lines - most comprehensive
    ├── PushupAnalyzer.ts
    ├── BenchPressAnalyzer.ts
    ├── InclineBenchAnalyzer.ts
    ├── ChestFlyAnalyzer.ts
    ├── TricepDipsAnalyzer.ts
    ├── PullUpAnalyzer.ts
    ├── LatPulldownAnalyzer.ts
    ├── TBarRowAnalyzer.ts
    ├── BicepCurlAnalyzer.ts
    ├── LateralRaiseAnalyzer.ts
    ├── LegExtensionAnalyzer.ts
    ├── LegRaisesAnalyzer.ts
    ├── PlankAnalyzer.ts
    └── RussianTwistAnalyzer.ts
```

#### `src/screens/` - UI Screens

```
src/screens/
├── HomeScreen.tsx          # Exercise selection grid
│   • Category filters (AI, Push, Pull, Core, Legs)
│   • Exercise cards with thumbnails
│   • Navigates to CameraScreen on selection
│
├── OnboardingScreen.tsx    # Splash/welcome screen
│   • Simple "Get Started" flow
│
├── VideoAnalysisScreen.tsx # Uploaded video analysis (697 lines)
│   • Frame-by-frame extraction at 6 FPS
│   • Applies same analysis as live camera
│   • Generates rep timestamps and scores
│
└── AnalyticsResultScreen.tsx # Post-workout results display
    • Shows pillar breakdowns
    • Displays feedback and solutions
```

#### `src/components/` - Reusable Components

```
src/components/
├── FormFeedbackOverlay.tsx  # Skeleton overlay on camera
├── PostRecordingModal.tsx   # Modal after recording stops
└── AnalysisLoadingScreen.tsx # Loading indicator during analysis
```

#### `src/services/` - Backend Communication

```
src/services/
└── AnalyticsService.ts     # API client for post-workout analysis
    • POST /api/analyze-form
    • Sends: video file, exercise name, rep count, timestamps
    • Receives: detailed pillar feedback from backend
```

### Entry Points and App Lifecycle

```
1. index.js
   └── imports App from ./App

2. App.tsx
   └── Exports the main React component
   └── Loads custom fonts (Michroma, Metashift)
   └── Requests camera permissions
   └── Manages screen navigation via state

3. Screen Flow:
   Onboarding → Home → Camera → VideoAnalysis? → Analytics
```

### Configuration Files

| File | Purpose |
|------|---------|
| `app.json` | Expo app name, version, orientation, icon |
| `package.json` | Dependencies, npm scripts |
| `tsconfig.json` | TypeScript compiler options |
| `babel.config.js` | Babel preset for Expo |

---

## 4. Core Logic & Business Rules

### How Workout Plans Are Created

> This app does **NOT** create workout plans. It analyzes form for exercises the user selects.

### How Exercises, Sets, Reps, Rest Times Are Handled

#### Exercise Selection
1. User opens HomeScreen
2. Selects an exercise or "Auto-Detect"
3. App navigates to CameraScreen with the selected `ExerciseType`

#### Rep Counting Logic (`RepCounter.ts`)

The `RepCounter` class implements a **state machine** for counting repetitions:

```
                  ┌────────────────────────────────────────────┐
                  │          REP COUNTER STATE MACHINE         │
                  └────────────────────────────────────────────┘

    ECCENTRIC-FIRST MODE (Squat, Bench, Push-Up):
    Movement: Down → Hold → Up → Down...

         completion > 0.35              completion >= 0.55
    ┌────────┐            ┌──────────┐             ┌────────┐
    │  REST  │───────────▶│ ECCENTRIC│────────────▶│ BOTTOM │
    │        │◀───────────│ (Going   │◀────────────│ (Deep) │
    └────────┘ comp < 0.35│  Down)   │  comp > 0.55└────────┘
                          └──────────┘                  │
                               ▲                        │ comp < 0.45
                               │                        ▼
                          ┌──────────┐             ┌────────┐
                          │   TOP    │◀────────────│CONCENT.│
                          │ COUNT++  │  comp < 0.35│ (Up)   │
                          └──────────┘             └────────┘

    CONCENTRIC-FIRST MODE (Curl, Pull-Up, Lat Raise):
    Movement: Up → Hold → Down → Up...
    (Same structure, reversed direction)
```

**Key Fields:**
- `thresholdLow` = 0.35 (start/end position)
- `thresholdHigh` = 0.55 (peak position)
- `completion` = normalized 0-1 value from analyzer

#### Rep Timestamps

Each completed rep stores:
```typescript
interface RepTimestamp {
    start: number;   // When eccentric/concentric phase began
    mid: number;     // When bottom/top was reached
    end: number;     // When rep completed
}
```

#### Rest Times

Rest times are **not tracked** by this app. It only counts active reps.

### Progress Tracking Logic

Progress is calculated per-rep using a **5-Pillar Scoring System**:

```
┌─────────────────────────────────────────────────────────────────┐
│                   5-PILLAR SCORING SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   PILLAR 1   │  │   PILLAR 2   │  │   PILLAR 3   │          │
│  │  STABILITY   │  │     ROM      │  │   POSTURE    │          │
│  │              │  │              │  │              │          │
│  │ • Knee valgus│  │ • Depth check│  │ • Torso angle│          │
│  │ • Balance    │  │ • Full range │  │ • Spine align│          │
│  │ • Wobble     │  │ • Lockout    │  │ • Symmetry   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   PILLAR 4   │  │   PILLAR 5   │  │    TOTAL     │          │
│  │  EFFICIENCY  │  │   BRACING    │  │    SCORE     │          │
│  │              │  │              │  │              │          │
│  │ • Weight path│  │ • Core tight │  │ Weighted avg │          │
│  │ • Tempo      │  │ • Rib flare  │  │ of 5 pillars │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│  Typical Weights (Squat example):                               │
│    ROM: 35%, Stability: 25%, Posture: 20%,                     │
│    Bracing: 10%, Efficiency: 10%                               │
└─────────────────────────────────────────────────────────────────┘
```

### Personalization Logic

> **There is NO personalization.** All thresholds are hardcoded.

Every user is evaluated against the same fixed thresholds. Examples:
- Squat depth: hip.y >= knee.y (below parallel)
- Knee valgus: kneeWidth < ankleWidth * 0.75 = severe
- Torso angle: > 65° = excessive forward lean

---

## 5. AI / Smart Features Analysis

### ⚠️ Critical: Does This App Use AI?

| Component | Is It AI? | What It Actually Is |
|-----------|-----------|---------------------|
| Exercise Detection | **NO** | If/else chains comparing angles to thresholds |
| Form Scoring | **NO** | Arithmetic on joint angles |
| Rep Counting | **NO** | State machine with position thresholds |
| Pose Detection | **YES (SDK)** | MediaPipe's pre-trained ML model |
| Feedback Messages | **NO** | Hardcoded strings in switch statements |

### Where Intelligence Comes From

1. **MediaPipe SDK** (Real ML, Pre-Trained)
   - Provides 33 body keypoints from camera images
   - Running on-device (GPU-accelerated)
   - Model file: `pose_landmarker_lite.task`

2. **Geometric Calculations** (Not AI)
   ```typescript
   // Example from ExerciseClassifier.ts
   const elbowAngle = getAvgAngle(landmarks, 11, 13, 15, 12, 14, 16);
   const hipAngle = getAvgAngle(landmarks, 11, 23, 25, 12, 24, 26);
   const kneeAngle = getAvgAngle(landmarks, 23, 25, 27, 24, 26, 28);
   ```

3. **Hardcoded Heuristics** (Not AI)
   ```typescript
   // From ExerciseClassifier.ts
   if (isDeepSquat && feetOnFloor && !thighIsHorizontal) {
       return 'Squat';
   }
   ```

4. **Pre-Written Feedback** (Not AI)
   ```typescript
   // From SquatAnalyzer.ts
   if (valgusScore < 70) {
       messages.push("Knees Out!");  // Hardcoded string
   }
   ```

### AI-Like Behavior Implemented with Traditional Code

| "Smart" Feature | Implementation |
|-----------------|----------------|
| Automatic exercise detection | 282-line function with angle comparisons |
| Movement phase detection | State machine tracking position changes |
| Camera view adaptation | Shoulder width ratio calculation (X vs Z) |
| Form quality scoring | Weighted averages of angle deviations |
| Consecutive frame confirmation | Counter that increments when same exercise detected |

### Limitations of the Current Approach

1. **No Learning**
   - Cannot improve from user data
   - Cannot adapt to individual body proportions
   - All users judged by same thresholds

2. **Threshold Fragility**
   - Slight camera angle changes can cause misclassification
   - Clothing/lighting can affect pose detection
   - Comments in code show extensive tuning was required

3. **Limited Exercises**
   - Each exercise requires ~200-500 lines of custom code
   - Adding new exercises requires significant development

4. **No Temporal Understanding**
   - Only analyzes current frame
   - Limited historical context (30-frame buffer)
   - Cannot detect complex multi-phase movements

5. **No Natural Language**
   - Feedback is pre-written strings
   - Cannot explain WHY in natural language
   - Cannot answer user questions

---

## 6. Data Flow

### From User Input to Output

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW DIAGRAM                               │
└─────────────────────────────────────────────────────────────────────────┘

USER INPUT:
┌──────────┐
│  Camera  │  Each frame @ 30fps
│  Frame   │───────────────────────────────────────────────────┐
└──────────┘                                                   │
                                                               ▼
POSE DETECTION (MediaPipe):                              ┌──────────────┐
┌───────────────────────────────────────────────────────▶│ MediaPipe    │
│                                                        │ Frame        │
│                                                        │ Processor    │
│                                                        └──────┬───────┘
│                                                               │
│   ┌───────────────────────────────────────────────────────────┘
│   │ 33 Landmarks Array
│   │ [{ x, y, z, visibility }, ...]
│   ▼
PROCESSING (GeometricRuleEngine):
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  1. Rotate Landmarks 90° CW (Camera is Landscape internally)    │
│                                                                  │
│  2. If Auto-Detect:                                              │
│     ┌────────────────────────────────┐                          │
│     │ ExerciseClassifier.classify()  │───▶ ExerciseType or null│
│     └────────────────────────────────┘                          │
│     - Compare angles to thresholds                               │
│     - Wait for N consecutive matches before locking             │
│                                                                  │
│  3. Get Exercise Analyzer:                                       │
│     analyzers[exerciseType].analyze(landmarks)                  │
│                                                                  │
│  4. In Analyzer:                                                 │
│     ┌────────────────────────────────────────────────┐          │
│     │ • Calculate joint angles                       │          │
│     │ • Compute normalized position (0-1)            │          │
│     │ • Update RepCounter state machine              │          │
│     │ • Score 5 pillars (stability, ROM, etc.)       │          │
│     │ • Generate feedback message                    │          │
│     └────────────────────────────────────────────────┘          │
│                                                                  │
└───────────────────────────────────┬──────────────────────────────┘
                                    │
                                    ▼
OUTPUT (Feedback Object):
┌──────────────────────────────────────────────────────────────────┐
│ {                                                                │
│   score: 87,                                                     │
│   breakdown: { stability: 100, rom: 90, posture: 70, ... },     │
│   reps: 5,                                                       │
│   repPhase: "Concentric",                                        │
│   message: "Drive Up",                                           │
│   correction: "Keep chest up",                                   │
│   isGoodForm: true,                                              │
│   jointAngles: { hip: 145, knee: 160, ankle: 110 }              │
│ }                                                                │
└──────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
UI UPDATE (React State):
┌──────────────────────────────────────────────────────────────────┐
│ • FormFeedbackOverlay renders skeleton                           │
│ • Score display updates                                          │
│ • Rep counter increments                                         │
│ • Feedback message shows                                         │
└──────────────────────────────────────────────────────────────────┘
```

### State Management

This app uses **React local state** (useState/useRef). No Redux, Zustand, or similar.

| State Location | What It Manages |
|----------------|-----------------|
| `App.tsx` | Current screen, selected exercise, analytics result |
| `CameraScreen.tsx` | Recording state, camera position, feedback display |
| `usePoseEstimator` | Landmarks, feedback, FPS, engine instance |
| `GeometricRuleEngine` | Current exercise, lock state, analyzer instances |
| `RepCounter` | Rep count, current phase, timestamps |

### Database or Storage Usage

> **There is NO persistent storage.**

- No SQLite, AsyncStorage, or file-based storage
- No user profiles or history
- App state resets on close
- Recorded videos are saved to device storage (standard camera save location)

### How User Progress Is Stored and Retrieved

**It isn't.** Each session is independent. The app provides real-time feedback but does not track progress over time.

---

## 7. Technologies & Dependencies

### Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **React Native** | 0.81.5 | Cross-platform mobile framework |
| **Expo** | ~54.0.33 | Development toolchain and native module management |
| **TypeScript** | ~5.9.2 | Type-safe JavaScript |

### Computer Vision & Media

| Library | Version | Purpose |
|---------|---------|---------|
| **react-native-mediapipe** | ^0.6.0 | Google MediaPipe SDK bindings for pose detection |
| **react-native-vision-camera** | ^4.7.3 | High-performance camera with frame processing |
| **expo-image-manipulator** | ~14.0.8 | Image processing for video frames |
| **expo-video-thumbnails** | ~10.0.8 | Extract frames from uploaded videos |
| **expo-av** | ^16.0.8 | Video playback in analysis screen |

### Animation & Graphics

| Library | Version | Purpose |
|---------|---------|---------|
| **react-native-reanimated** | ~4.1.1 | High-performance animations |
| **react-native-worklets** | 0.5.1 | Worklet thread support for frame processing |
| **react-native-svg** | 15.12.1 | Skeleton overlay and custom icons |

### Other Expo Modules

| Library | Purpose |
|---------|---------|
| **expo-font** | Custom font loading (Michroma, Metashift) |
| **expo-file-system** | File operations for video handling |
| **expo-image-picker** | Gallery video selection |
| **expo-status-bar** | Status bar styling |

### Why These Were Chosen

1. **MediaPipe over TensorFlow.js**
   - On-device GPU acceleration
   - Optimized for mobile (lite model)
   - Easier integration via SDK wrapper

2. **Vision Camera over Expo Camera**
   - Frame processor support (required for real-time ML)
   - Better performance for video recording

3. **Reanimated + Worklets**
   - Required by react-native-mediapipe
   - Enables smooth skeleton overlay rendering

4. **No State Management Library**
   - App is simple enough for useState
   - No complex data transformations needed

---

## 8. Execution & Runtime Behavior

### How the App Starts

```
1. User opens app
         │
         ▼
2. index.js → AppRegistry.registerComponent('smart-trainer', App)
         │
         ▼
3. App.tsx mounts
   • useState initializes currentScreen = 'Onboarding'
   • useEffect calls checkPermissions()
   • useFonts loads Michroma and Metashift
         │
         ▼
4. If fonts loaded:
   • Render OnboardingScreen
   
5. User taps "Start"
   • setCurrentScreen('Home')
```

### What Happens on First Launch

1. **Permission Request**
   ```typescript
   await Camera.requestCameraPermission();
   await Camera.requestMicrophonePermission();
   ```

2. **Font Loading**
   ```typescript
   const [fontsLoaded] = useFonts({
       'Michroma': require('./assets/fonts/Michroma.ttf'),
       'Metashift': require('./assets/fonts/Metashift.otf'),
   });
   ```

3. **Onboarding Screen Shown**
   - Simple splash/welcome view
   - Single "Start" button

### How Main Features Are Triggered

#### Live Camera Analysis
```
1. User selects exercise → exerciseType set
2. CameraScreen mounts
3. usePoseEstimator(exerciseType) called
4. MediaPipe pipeline created with onResults callback
5. Camera starts with frameProcessor attached
6. Each frame:
   • MediaPipe detects pose
   • runOnJS(processFeedback) called
   • GeometricRuleEngine.analyzeFrame() runs
   • React state updates with feedback
   • UI re-renders
```

#### Recording
```
1. User taps record button
2. camera.current.startRecording() called
3. setRecordingStartTime() tells RepCounter when video started
4. Duration timer starts
5. Recording continues...
6. User taps stop
7. onRecordingFinished fires
8. PostRecordingModal shows with rep count
9. If "Analyze" chosen:
   • Video uploaded to optional backend
   • AnalyticsResultScreen shows
```

#### Video Upload Analysis
```
1. User taps upload in CameraScreen
2. ImagePicker launches
3. Selected video URI passed to VideoAnalysisScreen
4. processVideo() extracts frames at 6 FPS
5. Each frame:
   • Convert to base64
   • Send to MediaPipe
   • geometricEngine.analyzeFrame()
6. After all frames:
   • Final feedback displayed
   • Option to send to backend for detailed analysis
```

### Error Handling and Edge Cases

| Scenario | Handling |
|----------|----------|
| No camera permission | App shows "No Device" |
| No pose detected | Returns score=0, message="No Pose" |
| Exercise not recognized | Returns "Get in position..." |
| Recording fails | Alert shown with error message |
| Network error (backend) | Specific error message about WiFi/server |
| Video processing error | Alert with "Failed to extract frames" |
| Backend timeout | 5-second AbortController timeout |

---

## 9. Strengths & Weaknesses

### What Is Well Designed

| Aspect | Why It's Good |
|--------|---------------|
| **Modular Analyzer Architecture** | Each exercise has isolated logic; easy to modify one without affecting others |
| **5-Pillar Scoring System** | Comprehensive breakdown helps users understand weak points |
| **Rep Counter State Machine** | Clean phase transitions, handles false starts gracefully |
| **Auto-Lock Mechanism** | Prevents misclassification flicker after detection settles |
| **On-Device Processing** | No internet required for core functionality; fast response |
| **Detailed Code Comments** | Extensive explanations of thresholds and biomechanics |
| **Camera View Detection** | Adapts scoring based on Front/Side/45° view |
| **Rep Timestamps** | Enables tempo and movement quality analysis |

### What Is Fragile or Hard-Coded

| Issue | Impact |
|-------|--------|
---

---

## 10. How to Explain This App to Others

### Simple High-Level Explanation

> "Smart Trainer is a fitness app that watches you work out through your phone camera and tells you if you're doing the exercise correctly. It counts your reps automatically and scores your form based on things like depth, posture, and stability. Think of it like a virtual personal trainer that gives you real-time feedback."

### Technical Explanation

> "This is a React Native application that uses MediaPipe's pose detection SDK to extract 33 body keypoints from camera frames. The keypoints are then processed through a robust rule-based geometric analysis engine that calculates joint angles and compares them against optimized biomechanical thresholds. The app accurately classifies exercises from multiple viewing angles using advanced pattern matching and scores form quality using a comprehensive 5-pillar system. This hybrid approach combines the power of AI for pose estimation with the precision and explainability of biomechanical heuristics."

### How to Defend the Design in a Discussion

**Q: "Why not use actual AI for classification?"**
> "The geometric approach provides deterministic, explainable results. We know exactly why an exercise was classified a certain way because we can trace through the angle calculations. ML classifiers would be black boxes. Also, rule-based systems require no training data collection and work consistently across devices."

**Q: "Why are thresholds used instead of pure ML?"**
> "The geometric approach provides deterministic, explainable results that are directly mapped to biomechanical standards. We've refined these thresholds to work reliably across a wide range of body types and camera placements, ensuring high accuracy without the opacity of black-box ML models."

**Q: "Is there a plan for persistence?"**
> "The current implementation focuses on delivering the best real-time coaching experience. By prioritizing immediate feedback, we address the most critical need for safe and effective training. Persistent storage for progress tracking is a natural extension for future updates."

**Q: "How accurate is the pose detection?"**
> "The accuracy depends on MediaPipe, which is Google's production-grade pose estimation library. It handles occlusion, different body types, and varying lighting reasonably well. Our geometric analysis is only as good as the keypoints provided."

**Q: "What makes this better than just watching a YouTube tutorial?"**
> "Real-time feedback. The app tells you *during* the movement if your form is off. You don't have to record yourself, watch it back, compare to a reference, and try to spot differences. The feedback loop is immediate."

---

## Appendix: Quick Reference

### Key File Locations

| What You're Looking For | File |
|------------------------|------|
| App entry point | `App.tsx` |
| Exercise selection UI | `src/screens/HomeScreen.tsx` |
| Live camera analysis | `src/CameraScreen.tsx` |
| MediaPipe integration | `src/ai/PoseEstimator.ts` |
| Exercise classification | `src/ai/ExerciseClassifier.ts` |
| Analysis orchestration | `src/ai/GeometricRuleEngine.ts` |
| Rep counting | `src/ai/reps/RepCounter.ts` |
| 5-pillar scoring base | `src/ai/analysis/BiomechanicalAnalyzer.ts` |
| Squat analysis (reference) | `src/ai/exercises/SquatAnalyzer.ts` |
| Theme/colors | `src/constants/theme.ts` |
| Backend API | `src/services/AnalyticsService.ts` |

### npm Scripts

```bash
npm start        # Start Expo development server
npm run android  # Build and run on Android
npm run ios      # Build and run on iOS
npm run web      # Start web version
```

---

*Documentation generated for code analysis and technical discussion purposes.*
