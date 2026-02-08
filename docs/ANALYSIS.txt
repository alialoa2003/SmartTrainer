# Gym Trainer App - Technical Analysis & Documentation

## 1. Application Overview

**Gym Trainer** is a mobile fitness coaching application built with React Native. Its primary purpose is to provide real-time, AI-assisted feedback on exercise form using the device's camera.

*   **Core Feature**: Computer Vision-based form analysis.
*   **Target Users**: Trainees who want automated feedback on their lifting technique without human supervision.
*   **Role of "Vibe Coding"**: The application implements a highly responsive "Hybrid AI" approach, combining state-of-the-art pose estimation with rigid biomechanical rules to deliver instant coaching cues.

## 2. Architecture & System Design

The application follows a **Hybrid Intelligence Architecture**:

1.  **Vision Layer (The "Eyes")**:
    *   Uses **MediaPipe** (via `react-native-mediapipe`) to perform real-time Pose Estimation.
    *   Runs on the GPU/NPU for high performance.
    *   Converts raw camera frames into 33 standard skeletal landmarks (x, y, z coordinates).

2.  **Logic Layer (The "Brain")**:
    *   This is **NOT** an end-to-end Machine Learning model. It does not "guess" if form is good based on training data.
    *   Instead, it uses a **Geometric Rule Engine**.
    *   It calculates vectors, angles, and relative distances between landmarks.
    *   It compares these metrics against biomechanical thresholds (e.g., "Elbow angle < 90 degrees").

3.  **UI/Feedback Layer**:
    *   React Native UI with SVG overlays (`react-native-svg`).
    *   Provides visual skeletons and text feedback strings.

### Key Components Diagram
```mermaid
graph TD
    Camera[Camera Frame] -->|RGB Data| MediaPipe[MediaPipe (GPU)]
    MediaPipe -->|33 Landmarks| Worklet[Frame Processor Worklet]
    Worklet -->|JS Bridge| RuleEngine[GeometricRuleEngine (JS)]
    RuleEngine -->|Landmarks| Classifier[ExerciseClassifier]
    RuleEngine -->|Landmarks| Analyzer[Specific Exercise Analyzer]
    Analyzer -->|Feedback/Score| UI[React UI Overlay]
```

## 3. Project Structure

The project is structured as a standard Expo / React Native app using TypeScript.

*   **Root Level**:
    *   `App.tsx`: Main entry point. Handles navigation (Onboarding -> Home -> Camera) and permissions.
    *   `package.json`: Dependencies (Notable: `react-native-vision-camera`, `react-native-mediapipe`).

*   **`src/ai` ( The Core Intelligence)**:
    *   `PoseEstimator.ts`: Hook that configures MediaPipe and manages the frame processing loop.
    *   `GeometricRuleEngine.ts`: The central controller. Manages state, locking, and routing to specific analyzers.
    *   `ExerciseClassifier.ts`: Heuristic logic to guess *which* exercise the user is doing.
    *   `ExerciseAnalyzer.ts`: Base class for all exercise logic.
    *   `reps/RepCounter.ts`: State machine for counting reps (Eccentric/Concentric phases).
    *   `exercises/`: Individual files for each exercise (e.g., `LatPulldownAnalyzer.ts`, `SquatAnalyzer.ts`).

*   **`src/screens`**:
    *   `CameraScreen.tsx`: The active coaching view. Renders the camera and the feedback overlay.

## 4. Core Logic & Business Rules

### How Workouts are "Understood"
The app does not use a database of workout plans. It operates in two modes:
1.  **Auto-Detect**: The `ExerciseClassifier` uses a decision tree of heuristics to guess the exercise.
    *   Example: "Standing + Hands moving up = Shoulder Press".
    *   Example: "Inclined torso + Hands below shoulders + Knee Angle > 130 = T-Bar Row".
    *   Example: "Lying down + Hips extended + Knees bent = Hip Thrust".
2.  **Manual Selection**: The user selects "Squat", and the engine forces the `SquatAnalyzer`.

### Rep Counting Logic (`RepCounter.ts`)
Rep counting is deterministic, based on a **Normalized Extension Metric (0.0 - 1.0)**.
*   **State Machine**: `Rest` -> `Eccentric` (Down) -> `Bottom` -> `Concentric` (Up) -> `Top`.
*   **Thresholds**:
    *   Standard: Rep starts at `0.8` (eccentric bottom) and counts at `0.2` (concentric top).
    *   **Configurable**: Some exercises use custom thresholds. For example, **Pull Ups** use a tighter range (`0.45` - `0.55`) to account for different biomechanics and reduced range of motion in drop-sets.
    *   Specific analyzers calculate this "completion" value based on relevant joints (e.g., Knee Angle for Squat, Elbow Angle for Curl/Pull Up).

### Personalization
Currently, there is **no personalization**.
*   Thresholds (e.g., "Depth < 90 deg") are hard-coded constants.
*   It does not adapt to user limb lengths or flexibility constraints.

## 5. AI / Smart Features Analysis (CRITICAL)

### ⚠️ Does it use AI? -> **YES, but only for VISION.**
*   **The AI**: The app uses a pre-trained Deep Learning model (MediaPipe Pose Landmarker) to find the human body in the video frame.
*   **The "Coach"**: The coaching logic is **NOT AI**. It is **Classical Programming** (Heuristics/Expert System).

### Where intelligence comes from:
*   **Detection**: Neural Network (learned features).
*   **Analysis**: Trigonometry & If/Else statements.
    *   *Example*: A "Good Squat" is defined as `knee_hip_angle < 90` and `back_angle > 60`.
    *   It does *not* "know" what a good squat looks like from examples; it only knows the mathematical definition provided by the developers.

### Limitations:
*   **Rigidity**: It forces everyone to move exactly the same way.
*   **Fragility**: If the camera angle is weird, the math breaks (e.g., 2D projection errors make distinct angles look seemingly incorrect).

## 6. Data Flow

1.  **Input**: The user stands in front of the camera.
2.  **Processing (60fps -> 15fps)**:
    *   Video flows at 60fps.
    *   MediaPipe processes frames as fast as possible (on GPU).
    *   `PoseEstimator` throttles the *logic* update to ~15fps (every 66ms) to save battery and performance.
3.  **State Management**:
    *   Uses React `useState` and `useRef` for transient data (current angle, rep count).
    *   **No persistent storage** (Database) was found in the analyzed files. Progress is lost when the app closes.

## 7. Technologies & Dependencies

*   **Framework**: **React Native (Expo)** - Cross-platform mobile dev.
*   **Vision**: **react-native-vision-camera** - Direct camera access.
*   **AI Model**: **react-native-mediapipe** - On-device ML inference.
*   **Language**: **TypeScript** - Strongly typed logic (critical for the complex math involved).
*   **Graphics**: **React Native SVG** - Drawing the skeleton overlay.

## 8. Execution & Runtime Behavior

1.  **Launch**: App requests Camera permissions immediately.
2.  **Selection**: User picks an exercise.
3.  **Inference Loop**:
    *   `usePoseEstimator` initializes the `GeometricRuleEngine`.
    *   Frames are continuously analyzed.
4.  **Feedback**:
    *   If `score < 80`, the specific issue (e.g., "Knees inward") is displayed.
    *   Visual feedback: The skeleton is drawn on screen.

## 9. Strengths & Weaknesses

### Strengths
*   **No Server Cost**: Everything runs on-device (Offline & Private).
*   **Low Latency**: Feedback is immediate, not waiting for an API call.
*   **Transparency**: The rules are code, so you can tweak the exact angle for "Good Depth".

### Weaknesses
*   **2D Limitation**: MediaPipe infers 3D from 2D, but it's imperfect. Side views work best for Squats; Front views define specific hidden limb issues.
*   **"Hard-Coded" Coaching**: It cannot adapt to injury or different body proportions (e.g., long femurs in squats) unless explicitly programmed.
*   **State Reset**: No database means no long-term progress tracking.

## 10. How to Explain This App
"This is a **Smart Camera** app for the Gym. It uses **Computer Vision** to see your body skeleton in 3D. Then, it uses a **Digital Rulebook** (coded by experts) to measure your angles. If you break a rule—like bending your back too much—it tells you instantly. It's like a calculator for your workout form."
