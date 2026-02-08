/**
 * Post-Workout Analytics API Service
 * Communicates with the AI feedback model to analyze workout form
 */

// API Configuration
const API_BASE_URL = 'http://192.168.1.2:8000';
const ANALYZE_ENDPOINT = `${API_BASE_URL}/api/analyze-form`;

// Types matching API response structure
export interface PillarResult {
    score: number;
    feedback: string;
    solution: string | null;
}

export interface AnalyticsResult {
    exercise: string;
    reps_analyzed: number;
    overall_score: number;
    pillars: {
        stability: PillarResult;
        posture: PillarResult;
        range_of_motion: PillarResult;
        movement_quality: PillarResult;
        bracing_core: PillarResult;
    };
    summary: string;
    solutions: string[];
}

export interface RepTimestamp {
    start: number;
    mid: number;
    end: number;
}

// Upload progress callback type
export type UploadProgressCallback = (progress: number) => void;

// Status updates for UI
export type AnalysisPhase = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';

/**
 * Upload workout video and get AI analysis
 */
export async function analyzeWorkout(
    videoPath: string,
    exerciseName: string,
    repCount: number,
    repTimestamps?: RepTimestamp[],
    onProgress?: UploadProgressCallback
): Promise<AnalyticsResult> {
    const formData = new FormData();

    // Add video file
    formData.append('video', {
        uri: videoPath.startsWith('file://') ? videoPath : `file://${videoPath}`,
        type: 'video/mp4',
        name: 'workout.mp4',
    } as any);

    // Add metadata
    formData.append('exercise_name', exerciseName);
    formData.append('rep_count', repCount.toString());

    // Add rep timestamps for tempo/movement quality analysis
    if (repTimestamps && repTimestamps.length > 0) {
        formData.append('rep_timestamps', JSON.stringify(repTimestamps));
    }

    try {
        // Report upload started
        onProgress?.(0);

        const response = await fetch(ANALYZE_ENDPOINT, {
            method: 'POST',
            body: formData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        // Report upload complete
        onProgress?.(100);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const result: AnalyticsResult = await response.json();
        return result;

    } catch (error) {
        if (error instanceof Error) {
            // Check for network errors
            if (error.message.includes('Network request failed')) {
                throw new Error('Cannot connect to analysis server. Make sure:\n• Your phone is on the same WiFi\n• The server is running on your friend\'s laptop');
            }
            throw error;
        }
        throw new Error('Unknown error occurred during analysis');
    }
}

/**
 * Check if the analytics server is reachable
 */
export async function checkServerConnection(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(API_BASE_URL, {
            method: 'GET',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
        return response.ok || response.status === 404; // 404 means server is up but no root handler
    } catch {
        return false;
    }
}
