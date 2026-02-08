import { usePoseDetection } from 'react-native-mediapipe';
import { Delegate, RunningMode } from 'react-native-mediapipe';
import { runOnJS } from 'react-native-reanimated';
import { GeometricRuleEngine } from './GeometricRuleEngine';
import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Feedback, ExerciseType } from './ExerciseAnalyzer';

export function usePoseEstimator(exerciseType: ExerciseType) {
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [landmarks, setLandmarks] = useState<any[]>([]);
    const [fps, setFps] = useState(0);

    // Keep one engine instance
    const engine = useMemo(() => new GeometricRuleEngine(), []);

    // Update engine when exercise type changes
    useEffect(() => {
        engine.setExercise(exerciseType);
    }, [engine, exerciseType]);

    // Throttle updates to UI
    const lastUpdate = useRef(0);
    const frameCount = useRef(0);
    const lastFpsUpdate = useRef(0);

    const pipe = usePoseDetection(
        {
            onResults: (result) => {
                'worklet';
                if (result.results && result.results.length > 0 && result.results[0].landmarks && result.results[0].landmarks.length > 0) {
                    const person = result.results[0].landmarks[0];
                    runOnJS(processFeedback)(person);
                }
            },
            onError: (error) => {
                console.error('MediaPipe Error:', error);
            }
        },
        RunningMode.LIVE_STREAM,
        'pose_landmarker_lite.task',
        {
            delegate: Delegate.GPU,
            minPoseDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
            numPoses: 1
        }
    );

    function processFeedback(detectedLandmarks: any[]) {
        const timestamp = Date.now();
        frameCount.current++;

        // Calculate FPS every second
        if (timestamp - lastFpsUpdate.current >= 1000) {
            setFps(frameCount.current);
            frameCount.current = 0;
            lastFpsUpdate.current = timestamp;
        }

        // Update Analysis at ~15fps (every 66ms)
        if (timestamp - lastUpdate.current > 66) {
            // Manual 90-degree CW Rotation (Head Left -> Head Top)
            // x' = 1 - y
            // y' = x
            const rotatedLandmarks = detectedLandmarks.map(lm => ({
                ...lm,
                x: 1 - lm.y,
                y: lm.x
            }));

            const result = engine.analyzeFrame(rotatedLandmarks);
            setFeedback(result);
            setLandmarks(rotatedLandmarks);
            lastUpdate.current = timestamp;
        }
    }

    // Expose rep timestamp methods from engine
    const getRepTimestamps = useCallback(() => {
        return engine.getRepTimestamps();
    }, [engine]);

    const setRecordingStartTime = useCallback((time: number) => {
        engine.setRecordingStartTime(time);
    }, [engine]);

    return {
        frameProcessor: pipe.frameProcessor,
        feedback,
        landmarks,
        fps,
        getRepTimestamps,
        setRecordingStartTime,
        resizeModeChangeHandler: pipe.resizeModeChangeHandler,
        cameraDeviceChangeHandler: pipe.cameraDeviceChangeHandler,
        cameraOrientationChangedHandler: pipe.cameraOrientationChangedHandler,
        cameraViewLayoutChangeHandler: pipe.cameraViewLayoutChangeHandler
    };
}
