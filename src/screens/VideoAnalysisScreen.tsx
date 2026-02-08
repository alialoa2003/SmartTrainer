import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, Platform } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import Svg, { Path } from 'react-native-svg';
import PostRecordingModal from '../components/PostRecordingModal';
import AnalysisLoadingScreen from '../components/AnalysisLoadingScreen';
import { analyzeWorkout, AnalyticsResult, AnalysisPhase } from '../services/AnalyticsService';
import { ExerciseType, Feedback } from '../ai/ExerciseAnalyzer';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { PoseDetectionOnImage } from 'react-native-mediapipe';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { GeometricRuleEngine } from '../ai/GeometricRuleEngine';
import { RepTimestamp } from '../ai/reps/RepCounter';
import { FormFeedbackOverlay } from '../components/FormFeedbackOverlay';
import { PoseLandmark } from '../ai/ExerciseAnalyzer';

const FRAME_INTERVAL_MS = 166; // 6 FPS for analysis (increased from 3 FPS for better accuracy)

const clearCache = async () => {
    // Suppress deprecated warnings from expo-file-system temporarily to see real errors
    const originalWarn = console.warn;
    console.warn = (...args) => {
        if (args[0] && typeof args[0] === 'string' && args[0].includes('deleteAsync')) return;
        originalWarn(...args);
    };

    try {
        // @ts-ignore: cacheDirectory exists on FileSystem despite type definition issue
        if (FileSystem.cacheDirectory) {
            // @ts-ignore
            const thumbDir = FileSystem.cacheDirectory + 'VideoThumbnails/';
            const info = await FileSystem.getInfoAsync(thumbDir);
            if (info.exists) {
                await FileSystem.deleteAsync(thumbDir, { idempotent: true });
            }
        }
    } catch (e) {
        // Silent fail
    }
};



interface Props {
    videoUri: string;
    exerciseType: ExerciseType;
    onBack: () => void;
    onAnalysisComplete?: (result: AnalyticsResult) => void;
}

const defaultFeedback: Feedback = {
    score: 0,
    breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
    reps: 0,
    repPhase: 'Processing',
    message: 'Analyzing video...',
    isGoodForm: false
};

const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function VideoAnalysisScreen({
    videoUri,
    exerciseType,
    onBack,
    onAnalysisComplete
}: Props) {
    const videoRef = useRef<Video>(null);
    const [engine] = useState(() => new GeometricRuleEngine());

    // Video state
    const [isPlaying, setIsPlaying] = useState(false);
    const [videoDuration, setVideoDuration] = useState(0);
    const [currentPosition, setCurrentPosition] = useState(0);
    const [isVideoLoaded, setIsVideoLoaded] = useState(false);
    const [hasFinished, setHasFinished] = useState(false);

    // Analysis state (REAL ANALYSIS)
    const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'processing' | 'ready'>('idle');
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processedFrames, setProcessedFrames] = useState<Map<number, Feedback>>(new Map());
    const [processedLandmarks, setProcessedLandmarks] = useState<Map<number, PoseLandmark[]>>(new Map());
    const [finalRepCount, setFinalRepCount] = useState(0);
    const [detectedExerciseName, setDetectedExerciseName] = useState<string | null>(null);
    const [repTimestamps, setRepTimestamps] = useState<RepTimestamp[]>([]);

    // Current feedback based on video position
    const [currentFeedback, setCurrentFeedback] = useState<Feedback>(defaultFeedback);
    const [currentLandmarks, setCurrentLandmarks] = useState<PoseLandmark[]>([]);

    // Modal and API state
    const [showPostRecordingModal, setShowPostRecordingModal] = useState(false);
    const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Initialize engine
    useEffect(() => {
        engine.setExercise(exerciseType);
    }, [engine, exerciseType]);

    // Start processing when video is loaded and duration is known
    useEffect(() => {
        if (isVideoLoaded && videoDuration > 0 && analysisStatus === 'idle') {
            processVideo();
        }
    }, [isVideoLoaded, videoDuration]);

    const processVideo = async () => {
        try {
            await clearCache();
            setAnalysisStatus('processing');
            console.log('Starting video processing...');

            // Frame extraction settings
            // 333ms = ~3 FPS - Balance between motion capture and memory stability
            const FRAME_INTERVAL_MS = 333;
            const durationMs = videoDuration;
            const totalFrames = Math.floor(durationMs / FRAME_INTERVAL_MS);

            let processedCount = 0;
            const results = new Map<number, Feedback>();
            const landmarksMap = new Map<number, PoseLandmark[]>();

            // Set recording start time for engine
            // For uploaded video, timestamps are 0-based relative to the file.
            engine.setRecordingStartTime(0);

            for (let time = 0; time < durationMs; time += FRAME_INTERVAL_MS) {
                let thumbnailUri = null;
                let resizedUri = null;

                try {
                    // 1. Generate thumbnail (High Quality Source)
                    console.log(`[${time}ms] Generating thumbnail...`);
                    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
                        time: time,
                        quality: 0.3, // Lowered from 0.4 for memory stability
                        headers: { pragma: 'no-cache' }
                    });
                    thumbnailUri = uri;

                    // 2. Resize to "Live Camera" dimensions (approx 360px width)
                    console.log(`[${time}ms] Resizing...`);
                    const maniResult = await ImageManipulator.manipulateAsync(
                        uri,
                        [{ resize: { width: 320 } }], // Lowered from 360
                        { compress: 0.4, format: ImageManipulator.SaveFormat.JPEG }
                    );
                    resizedUri = maniResult.uri;

                    // 3. Detect pose on the RESIZED image
                    console.log(`[${time}ms] Detecting pose...`);
                    const result = await PoseDetectionOnImage(resizedUri, 'pose_landmarker_lite.task', {
                        delegate: 0,
                        numPoses: 1
                    });

                    if (result.results && result.results.length > 0 && result.results[0].landmarks.length > 0) {
                        const person = result.results[0].landmarks[0];
                        const landmarks = person.map(p => ({
                            x: p.x,
                            y: p.y,
                            z: p.z,
                            visibility: p.visibility ?? 1.0
                        }));

                        const feedback = engine.analyzeFrame(landmarks, time);

                        // Capture detected exercise name for UI display
                        if (feedback.detectedExercise && !detectedExerciseName) {
                            setDetectedExerciseName(feedback.detectedExercise);
                        }

                        // Debug: Log wrist Y position AND Elbow Angle to verify skeleton is updating
                        const wristY = (landmarks[15].y + landmarks[16].y) / 2;
                        const elbowAngle = feedback.jointAngles?.elbow?.toFixed(1) ?? 'N/A';
                        console.log(`[${time}ms] WristY: ${wristY.toFixed(3)} | Elbow: ${elbowAngle} | ${feedback.detectedExercise} - Reps: ${feedback.reps} Ph: ${feedback.repPhase}`);

                        results.set(time, feedback);
                        landmarksMap.set(time, landmarks); // Store landmarks for playback sync
                        setCurrentFeedback(feedback);
                        setCurrentLandmarks(landmarks); // Update visual skeleton
                    } else {
                        console.warn(`[${time}ms] NO POSE DETECTED - MediaPipe returned empty`);
                    }
                } catch (e) {
                    console.warn(`Frame processing failed at ${time}ms`, e);
                } finally {
                    // 4. EXPLICIT CLEANUP: Delete both files (AWAIT to ensure cleanup before next frame)
                    try {
                        if (thumbnailUri) await FileSystem.deleteAsync(thumbnailUri, { idempotent: true });
                        if (resizedUri) await FileSystem.deleteAsync(resizedUri, { idempotent: true });
                    } catch (cleanupErr) {
                        // Ignore cleanup errors
                    }
                }

                processedCount++;
                setProcessingProgress(Math.round((processedCount / totalFrames) * 100));

                // 5. Yield to GC - Give more time every 5 frames
                if (processedCount % 5 === 0) {
                    await new Promise(r => setTimeout(r, 150));
                } else {
                    await new Promise(r => setTimeout(r, 30));
                }
            }

            // Processing complete
            setProcessedFrames(results);
            setProcessedLandmarks(landmarksMap); // Store all landmarks for playback
            setAnalysisStatus('ready');
            setProcessingProgress(100);

            // Get final stats from engine
            // Find the last feedback to get total reps
            let maxReps = 0;
            results.forEach(f => {
                if (f.reps > maxReps) maxReps = f.reps;
            });

            setFinalRepCount(maxReps);
            const timestamps = engine.getRepTimestamps();
            console.log('Video processing complete. Reps:', maxReps);
            console.log('Generated Rep Timestamps:', JSON.stringify(timestamps, null, 2));
            setRepTimestamps(timestamps);

            // Auto-play video after processing
            if (videoRef.current) {
                videoRef.current.playAsync();
                setIsPlaying(true);
            }

        } catch (error) {
            console.error('Video processing error:', error);
            Alert.alert('Processing Error', 'Could not analyze video frames.');
            setAnalysisStatus('ready'); // Fallback to allow playback
        }
    };

    const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
        if (!status.isLoaded) return;

        setCurrentPosition(status.positionMillis || 0);
        setVideoDuration(status.durationMillis || 0);
        setIsPlaying(status.isPlaying);

        // Update feedback from pre-processed results
        // Find closest frame result
        if (analysisStatus === 'ready') {
            const time = status.positionMillis;
            // Find closest key in map
            // Efficient enough for map size < 1000 items
            let closestTime = 0;
            let minDiff = Infinity;

            for (const key of processedFrames.keys()) {
                const diff = Math.abs(time - key);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestTime = key;
                }
            }

            // Only update if within reasonable range (e.g. 500ms)
            if (minDiff < 500) {
                const feedback = processedFrames.get(closestTime);
                const landmarks = processedLandmarks.get(closestTime);
                if (feedback) {
                    setCurrentFeedback(feedback);
                }
                if (landmarks) {
                    setCurrentLandmarks(landmarks); // Sync skeleton with video
                }
            }
        }

        // Video finished
        if (status.didJustFinish) {
            setHasFinished(true);
            setIsPlaying(false);

            // Show modal after short delay
            setTimeout(() => {
                setShowPostRecordingModal(true);
            }, 500);
        }
    }, [analysisStatus, processedFrames]);

    const handleVideoLoad = useCallback((status: AVPlaybackStatus) => {
        if (status.isLoaded) {
            setIsVideoLoaded(true);
            setVideoDuration(status.durationMillis || 0);
        }
    }, []);

    const togglePlayPause = async () => {
        if (!videoRef.current) return;

        if (isPlaying) {
            await videoRef.current.pauseAsync();
        } else {
            if (hasFinished) {
                await videoRef.current.replayAsync();
                setHasFinished(false);
            } else {
                await videoRef.current.playAsync();
            }
        }
    };

    const handleAnalyze = async () => {
        setShowPostRecordingModal(false);

        try {
            setAnalysisPhase('uploading');
            setUploadProgress(0);

            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 300);

            setTimeout(() => {
                clearInterval(progressInterval);
                setUploadProgress(100);
                setAnalysisPhase('analyzing');
            }, 2000);

            // Send to API with REAL rep count and timestamps from local analysis
            const result = await analyzeWorkout(
                videoUri,
                exerciseType,
                finalRepCount,
                repTimestamps,
                (progress) => setUploadProgress(progress)
            );

            setAnalysisPhase('complete');

            if (onAnalysisComplete) {
                onAnalysisComplete(result);
            }

        } catch (error) {
            console.error('Analysis error:', error);
            setAnalysisPhase('error');
            Alert.alert(
                'Analysis Failed',
                error instanceof Error ? error.message : 'Could not analyze workout',
                [{ text: 'OK', onPress: () => setAnalysisPhase('idle') }]
            );
        }
    };

    const handleDiscard = () => {
        setShowPostRecordingModal(false);
        onBack();
    };

    // Show loading screen during API analysis
    if (analysisPhase === 'uploading' || analysisPhase === 'analyzing') {
        return <AnalysisLoadingScreen phase={analysisPhase} uploadProgress={uploadProgress} />;
    }

    return (
        <View style={styles.container}>
            {/* Video Player */}
            <Video
                ref={videoRef}
                source={{ uri: videoUri }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
                onLoad={handleVideoLoad}
                shouldPlay={false} // Wait for processing
                isLooping={false}
            />

            {/* Skeleton Overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <FormFeedbackOverlay
                    feedback={currentFeedback}
                    landmarks={currentLandmarks} // Now using real landmarks
                />
            </View>

            {/* Processing Overlay */}
            {analysisStatus === 'processing' && (
                <View style={styles.processingOverlay}>
                    <Text style={styles.processingTitle}>ANALYZING VIDEO</Text>
                    <Text style={styles.processingText}>Extracting frames and detecting pose...</Text>
                    <View style={styles.processingBar}>
                        <View style={[styles.processingFill, { width: `${processingProgress}%` }]} />
                    </View>
                    <Text style={styles.processingPercent}>{processingProgress}%</Text>

                    {/* Live Preview of analysis */}
                    <View style={styles.previewContainer}>
                        <Text style={styles.previewText}>
                            Frame Reps: {currentFeedback.reps} • {currentFeedback.repPhase}
                        </Text>
                    </View>
                </View>
            )}

            {/* UI Overlay */}
            <View style={[styles.uiOverlay, analysisStatus === 'processing' && { opacity: 0.3 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M19 12H5M5 12L12 19M5 12L12 5"
                                stroke={COLORS.primary}
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.exerciseTitle}>
                            {(exerciseType === 'Auto-Detect' && detectedExerciseName)
                                ? detectedExerciseName.toUpperCase()
                                : exerciseType.toUpperCase()}
                        </Text>
                        <Text style={styles.subTitle}>📹 VIDEO ANALYSIS</Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${videoDuration ? (currentPosition / videoDuration) * 100 : 0}%` }
                            ]}
                        />
                    </View>
                    <Text style={styles.timeText}>
                        {formatTime(currentPosition)} / {formatTime(videoDuration)}
                    </Text>
                </View>

                {/* Center play/pause button */}
                {!isPlaying && isVideoLoaded && analysisStatus === 'ready' && (
                    <TouchableOpacity style={styles.playButton} onPress={togglePlayPause}>
                        <Svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                            <Path
                                d={hasFinished ? "M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" : "M8 5v14l11-7z"}
                                fill={COLORS.text}
                            />
                        </Svg>
                    </TouchableOpacity>
                )}

                {/* Score display */}
                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreLabel}>ANALYZING</Text>
                    <Text style={[styles.scoreValue, { color: COLORS.secondary }]}>
                        {Math.round(currentFeedback.score)}
                    </Text>
                </View>

                {/* Bottom Section */}
                <View style={styles.bottomSection}>
                    {/* Stats Footer */}
                    <View style={styles.footer}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>REPS</Text>
                            <Text style={styles.statValue}>{currentFeedback.reps}</Text>
                        </View>

                        <View style={[styles.statBox, styles.feedbackBox]}>
                            <Text style={styles.statLabel}>STATUS</Text>
                            <Text style={styles.phaseText}>{currentFeedback.repPhase}</Text>
                            <Text style={styles.feedbackText} numberOfLines={2}>
                                {currentFeedback.message}
                            </Text>
                        </View>

                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>PROGRESS</Text>
                            <Text style={styles.statValue}>
                                {videoDuration ? Math.round((currentPosition / videoDuration) * 100) : 0}%
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Post Recording Modal */}
            <PostRecordingModal
                visible={showPostRecordingModal}
                repCount={finalRepCount}
                duration={Math.floor(videoDuration / 1000)}
                exerciseName={detectedExerciseName || (exerciseType !== 'Auto-Detect' ? exerciseType : undefined)}
                onAnalyze={handleAnalyze}
                onDiscard={handleDiscard}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black'
    },
    video: {
        ...StyleSheet.absoluteFillObject,
    },
    uiOverlay: {
        flex: 1,
        justifyContent: 'space-between'
    },

    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    processingTitle: {
        color: COLORS.primary,
        fontFamily: FONTS.title,
        fontSize: 24,
        marginBottom: SPACING.m,
    },
    processingText: {
        color: COLORS.textDim,
        fontSize: 14,
        marginBottom: SPACING.l,
    },
    processingBar: {
        width: '80%',
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    processingFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
    },
    processingPercent: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: SPACING.m,
    },
    previewContainer: {
        marginTop: SPACING.l,
        padding: SPACING.m,
        backgroundColor: COLORS.surface,
        borderRadius: 8,
    },
    previewText: {
        color: COLORS.text,
        fontSize: 12,
    },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        backgroundColor: 'rgba(13, 17, 23, 0.6)'
    },
    backButton: { padding: SPACING.s },
    exerciseTitle: {
        color: COLORS.text,
        fontFamily: FONTS.title,
        fontSize: 18,
        textAlign: 'center',
    },
    subTitle: {
        color: COLORS.secondary,
        fontSize: 10,
        letterSpacing: 1,
        textAlign: 'center',
    },

    progressContainer: {
        paddingHorizontal: SPACING.m,
        paddingVertical: SPACING.s,
        backgroundColor: 'rgba(13, 17, 23, 0.6)',
    },
    progressBar: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
    },
    timeText: {
        color: COLORS.textDim,
        fontSize: 12,
        textAlign: 'center',
        marginTop: SPACING.xs,
    },

    playButton: {
        position: 'absolute',
        top: '45%',
        left: '50%',
        marginLeft: -40,
        marginTop: -40,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.text,
    },

    scoreContainer: {
        alignItems: 'center'
    },
    scoreLabel: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: 'bold'
    },
    scoreValue: {
        fontSize: 24,
        fontFamily: FONTS.title
    },

    bottomSection: {},

    footer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        paddingVertical: SPACING.l,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center'
    },
    statLabel: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: 'bold',
        marginBottom: 4
    },
    statValue: {
        color: COLORS.text,
        fontSize: 28,
        fontFamily: FONTS.title
    },
    phaseText: {
        color: COLORS.secondary,
        fontSize: 12,
        marginBottom: 4,
        fontWeight: 'bold'
    },
    feedbackText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        paddingHorizontal: SPACING.xs
    },
    feedbackBox: {
        flex: 2,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
});
