import { RepTimestamp } from './reps/RepCounter';

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface ScoreBreakdown {
  total: number;
  stability: number; // Pillar 1
  rom: number;       // Pillar 2
  posture: number;   // Pillar 3
  efficiency: number;// Pillar 4
  bracing: number;   // Pillar 5
}

export type ExerciseType =
  | 'Barbell Biceps Curl' | 'Bench Press' | 'Chest Fly Machine'
  | 'Incline Bench Press'
  | 'Lat Pulldown' | 'Lateral Raises' | 'Leg Extension' | 'Leg Raises'
  | 'Plank' | 'Pull Up' | 'Push Up' | 'Russian Twist'
  | 'Squat' | 'T-Bar Row' | 'Tricep Dips' | 'Auto-Detect';

export interface Feedback {
  score: number;
  breakdown: ScoreBreakdown;
  reps: number;
  repPhase: string; // 'Eccentric', 'Concentric', 'Rest'
  message: string;
  correction?: string;
  isGoodForm: boolean;
  jointAngles?: Record<string, number>;
  detectedExercise?: ExerciseType;
}

export abstract class ExerciseAnalyzer {
  abstract exerciseName: string;
  abstract analyze(landmarks: PoseLandmark[], timestamp?: number): Feedback;

  protected calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  }

  // Optional interface for analytics
  setRecordingStartTime(timestamp: number): void {
    // Default no-op
  }

  getRepTimestamps(): RepTimestamp[] {
    return [];
  }
}
