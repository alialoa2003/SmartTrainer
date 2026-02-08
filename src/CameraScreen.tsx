import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { useCameraDevice, Camera, useFrameProcessor } from 'react-native-vision-camera';
import { usePoseEstimator } from './ai/PoseEstimator';
import { FormFeedbackOverlay } from './components/FormFeedbackOverlay';
import { ExerciseType, Feedback } from './ai/ExerciseAnalyzer';
import { COLORS, FONTS, SPACING } from './constants/theme';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import PostRecordingModal from './components/PostRecordingModal';
import AnalysisLoadingScreen from './components/AnalysisLoadingScreen';
import { analyzeWorkout, AnalyticsResult, AnalysisPhase } from './services/AnalyticsService';
import { RepTimestamp } from './ai/reps/RepCounter';
import * as ImagePicker from 'expo-image-picker';

interface Props {
    exerciseType: ExerciseType;
    onBack: () => void;
    onAnalysisComplete?: (result: AnalyticsResult) => void;
    onVideoSelected?: (videoUri: string) => void;
}

const defaultFeedback: Feedback = {
    score: 0,
    breakdown: { total: 0, stability: 0, rom: 0, posture: 0, efficiency: 0, bracing: 0 },
    reps: 0,
    repPhase: 'Ready',
    message: 'Position yourself in frame...',
    isGoodForm: false
};

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function CameraScreen({ exerciseType, onBack, onAnalysisComplete, onVideoSelected }: Props) {
    const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('back');
    const device = useCameraDevice(cameraPosition);
    const camera = useRef<Camera>(null);

    // Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordedVideoPath, setRecordedVideoPath] = useState<string | null>(null);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const recordingStartTime = useRef<number>(0);
    const durationInterval = useRef<NodeJS.Timeout | null>(null);

    // Modal and analysis state
    const [showPostRecordingModal, setShowPostRecordingModal] = useState(false);
    const [analysisPhase, setAnalysisPhase] = useState<AnalysisPhase>('idle');
    const [uploadProgress, setUploadProgress] = useState(0);

    // Store rep data at recording stop time
    const [finalRepCount, setFinalRepCount] = useState(0);
    const [finalExerciseName, setFinalExerciseName] = useState<string | null>(null);
    const [repTimestamps, setRepTimestamps] = useState<RepTimestamp[]>([]);

    // For uploaded video (no rep count from live detection)
    const [isUploadedVideo, setIsUploadedVideo] = useState(false);

    // USE REF to track latest rep count (avoids stale closure in callbacks)
    const latestRepCount = useRef(0);
    const latestExerciseName = useRef(exerciseType);

    const {
        frameProcessor,
        landmarks,
        feedback: rawFeedback,
        fps,
        cameraDeviceChangeHandler,
        cameraOrientationChangedHandler,
        cameraViewLayoutChangeHandler,
        getRepTimestamps,
        setRecordingStartTime,
    } = usePoseEstimator(exerciseType);

    useEffect(() => {
        if (device) {
            cameraDeviceChangeHandler(device);
        }
    }, [device, cameraDeviceChangeHandler]);

    useEffect(() => {
        cameraOrientationChangedHandler('portrait');
    }, [cameraOrientationChangedHandler]);

    // Cleanup duration interval
    useEffect(() => {
        return () => {
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
            }
        };
    }, []);

    const feedback = rawFeedback || defaultFeedback;

    // Keep refs updated with latest values
    useEffect(() => {
        latestRepCount.current = feedback.reps;
        if (feedback.detectedExercise) {
            latestExerciseName.current = feedback.detectedExercise;
        }
    }, [feedback.reps, feedback.detectedExercise]);

    if (!device) return <Text style={{ color: 'white' }}>No Device</Text>;

    const toggleCamera = () => {
        setCameraPosition(p => p === 'front' ? 'back' : 'front');
    };

    const startRecording = async () => {
        if (camera.current && !isRecording) {
            try {
                setIsRecording(true);
                recordingStartTime.current = Date.now();
                setRecordingDuration(0);

                // Tell rep counter about recording start time
                setRecordingStartTime?.(recordingStartTime.current);

                // Start duration counter
                durationInterval.current = setInterval(() => {
                    setRecordingDuration(Math.floor((Date.now() - recordingStartTime.current) / 1000));
                }, 1000);

                camera.current.startRecording({
                    onRecordingFinished: (video) => {
                        console.log('Video saved:', video.path);
                        console.log('Final rep count from ref:', latestRepCount.current);
                        setRecordedVideoPath(video.path);

                        // Store final rep data FROM REF (not stale closure)
                        setFinalRepCount(latestRepCount.current);
                        setFinalExerciseName(latestExerciseName.current);
                        const timestamps = getRepTimestamps?.() || [];
                        console.log('Rep timestamps:', timestamps);
                        setRepTimestamps(timestamps);

                        // Show post-recording modal
                        setShowPostRecordingModal(true);
                    },
                    onRecordingError: (error) => {
                        console.error('Recording error:', error);
                        Alert.alert('Recording Error', error.message);
                        setIsRecording(false);
                    },
                });
            } catch (error) {
                console.error('Failed to start recording:', error);
                setIsRecording(false);
            }
        }
    };

    const stopRecording = async () => {
        if (camera.current && isRecording) {
            // Stop duration counter
            if (durationInterval.current) {
                clearInterval(durationInterval.current);
                durationInterval.current = null;
            }

            await camera.current.stopRecording();
            setIsRecording(false);
        }
    };

    // Pick video from gallery
    const pickVideo = async () => {
        try {
            // Request permission
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert('Permission Required', 'Please allow access to your photo library to upload videos.');
                return;
            }

            // Launch picker with updated API
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'], // New API format
                allowsEditing: false,
                quality: 1,
                videoMaxDuration: 120,
                legacy: false, // Use new photo picker on Android
            });

            if (!result.canceled && result.assets[0]) {
                const video = result.assets[0];
                console.log('Selected video:', video.uri);

                // Navigate to VideoAnalysisScreen to process the video
                if (onVideoSelected) {
                    onVideoSelected(video.uri);
                }
            }
        } catch (error) {
            console.error('Error picking video:', error);
            Alert.alert('Error', 'Failed to select video');
        }
    };

    const handleAnalyze = async () => {
        setShowPostRecordingModal(false);

        if (!recordedVideoPath) {
            Alert.alert('Error', 'No video recorded');
            return;
        }

        console.log('Sending to API - Reps:', finalRepCount, 'Timestamps:', repTimestamps);

        try {
            // Start upload phase
            setAnalysisPhase('uploading');
            setUploadProgress(0);

            // Simulate upload progress (actual progress would come from XHR)
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => {
                    if (prev >= 90) {
                        clearInterval(progressInterval);
                        return 90;
                    }
                    return prev + 10;
                });
            }, 300);

            // Switch to analyzing phase after a short delay
            setTimeout(() => {
                clearInterval(progressInterval);
                setUploadProgress(100);
                setAnalysisPhase('analyzing');
            }, 2000);

            // Use the detected exercise name or fallback to selected
            const exerciseName = latestExerciseName.current || exerciseType;

            // Call API with actual rep count and timestamps
            const result = await analyzeWorkout(
                recordedVideoPath,
                exerciseName,
                finalRepCount,
                repTimestamps,
                (progress) => setUploadProgress(progress)
            );

            setAnalysisPhase('complete');

            // Call completion handler
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
        setRecordedVideoPath(null);
        setFinalRepCount(0);
        setRepTimestamps([]);
        setIsUploadedVideo(false);
    };

    // Show loading screen during analysis
    if (analysisPhase === 'uploading' || analysisPhase === 'analyzing') {
        return <AnalysisLoadingScreen phase={analysisPhase} uploadProgress={uploadProgress} />;
    }

    return (
        <View style={styles.container}>
            <Camera
                ref={camera}
                style={StyleSheet.absoluteFill}
                device={device}
                isActive={true}
                frameProcessor={frameProcessor}
                pixelFormat="rgb"
                video={true}
                audio={false}
                onLayout={cameraViewLayoutChangeHandler}
            />

            {/* Overlay */}
            <FormFeedbackOverlay landmarks={landmarks} feedback={feedback} />

            {/* UI Layer */}
            <View style={styles.uiOverlay}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton} disabled={isRecording}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <Path d="M19 12H5M5 12L12 19M5 12L12 5" stroke={isRecording ? COLORS.textDim : COLORS.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.exerciseTitle}>{exerciseType.toUpperCase()}</Text>
                        <Text style={[styles.subTitle, isRecording && { color: COLORS.accent }]}>
                            {isRecording ? '🔴 RECORDING' : 'AI COACH ACTIVE'}
                        </Text>
                    </View>

                    {/* Camera Toggle Button */}
                    <TouchableOpacity onPress={toggleCamera} style={styles.backButton} disabled={isRecording}>
                        <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <Path d="M20 5H17L15 3H9L7 5H4C2.9 5 2 5.9 2 7V19C2 20.1 2.9 21 4 21H20C21.1 21 22 20.1 22 19V7C22 5.9 21.1 5 20 5ZM12 18C9.24 18 7 15.76 7 13C7 10.24 9.24 8 12 8C14.76 8 17 10.24 17 13C17 15.76 14.76 18 12 18ZM12 16C13.66 16 15 14.66 15 13C15 11.34 13.66 10 12 10C10.34 10 9 11.34 9 13C9 14.66 10.34 16 12 16Z" fill={isRecording ? COLORS.textDim : COLORS.primary} />
                        </Svg>
                    </TouchableOpacity>
                </View>

                {/* Recording Timer (when recording) */}
                {isRecording && (
                    <View style={styles.timerContainer}>
                        <View style={styles.recordingDot} />
                        <Text style={styles.timerText}>{formatTime(recordingDuration)}</Text>
                    </View>
                )}

                <View style={styles.scoreContainer}>
                    <Text style={styles.scoreLabel}>SCORE</Text>
                    <Text style={[styles.scoreValue, { color: feedback.isGoodForm ? COLORS.success : COLORS.accent }]}>
                        {Math.round(feedback.score)}
                    </Text>
                </View>

                {/* Bottom Section */}
                <View style={styles.bottomSection}>
                    {/* Action Buttons - Record & Upload */}
                    <View style={styles.actionButtonsRow}>
                        {/* Upload Button */}
                        <TouchableOpacity
                            style={styles.uploadButton}
                            onPress={pickVideo}
                            disabled={isRecording}
                        >
                            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15"
                                    stroke={isRecording ? COLORS.textDim : COLORS.primary}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <Path
                                    d="M17 8L12 3L7 8"
                                    stroke={isRecording ? COLORS.textDim : COLORS.primary}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <Path
                                    d="M12 3V15"
                                    stroke={isRecording ? COLORS.textDim : COLORS.primary}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                            <Text style={[styles.uploadLabel, isRecording && { color: COLORS.textDim }]}>UPLOAD</Text>
                        </TouchableOpacity>

                        {/* Record Button */}
                        <TouchableOpacity
                            style={[styles.recordButton, isRecording && styles.recordButtonActive]}
                            onPress={isRecording ? stopRecording : startRecording}
                        >
                            {isRecording ? (
                                <View style={styles.stopIcon} />
                            ) : (
                                <View style={styles.recordIcon} />
                            )}
                        </TouchableOpacity>

                        {/* Spacer to balance the layout */}
                        <View style={styles.uploadButton}>
                            <Text style={styles.uploadLabel}>{isRecording ? 'REC' : 'LIVE'}</Text>
                        </View>
                    </View>

                    {/* Footer Stats */}
                    <View style={styles.footer}>
                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>
                                {(exerciseType === 'Plank' || feedback.detectedExercise === 'Plank') ? 'TIME' : 'REPS'}
                            </Text>
                            <Text style={styles.statValue}>
                                {(exerciseType === 'Plank' || feedback.detectedExercise === 'Plank')
                                    ? formatTime(feedback.reps)
                                    : feedback.reps}
                            </Text>
                        </View>

                        {/* Feedback Text Box */}
                        <View style={[styles.statBox, styles.feedbackBox]}>
                            <Text style={styles.statLabel}>FEEDBACK</Text>
                            <Text style={styles.phaseText}>{feedback.repPhase}</Text>
                            <Text style={styles.feedbackText} numberOfLines={2}>{feedback.message}</Text>
                        </View>

                        <View style={styles.statBox}>
                            <Text style={styles.statLabel}>PHASE</Text>
                            <Text style={styles.statValue}>{feedback.repPhase.substring(0, 3)}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Post Recording Modal */}
            <PostRecordingModal
                visible={showPostRecordingModal}
                repCount={finalRepCount}
                duration={recordingDuration}
                exerciseName={finalExerciseName || (exerciseType !== 'Auto-Detect' ? exerciseType : undefined)}
                onAnalyze={handleAnalyze}
                onDiscard={handleDiscard}
            />
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    uiOverlay: { flex: 1, justifyContent: 'space-between' },

    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: SPACING.m, backgroundColor: 'rgba(13, 17, 23, 0.6)'
    },
    backButton: { padding: SPACING.s },
    exerciseTitle: { color: COLORS.text, fontFamily: FONTS.title, fontSize: 18 },
    subTitle: { color: COLORS.primary, fontSize: 10, letterSpacing: 1 },

    timerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 59, 48, 0.2)',
        paddingVertical: SPACING.s,
        paddingHorizontal: SPACING.m,
        borderRadius: 20,
        alignSelf: 'center',
    },
    recordingDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.accent,
        marginRight: SPACING.s,
    },
    timerText: {
        color: COLORS.accent,
        fontSize: 16,
        fontFamily: FONTS.title,
        letterSpacing: 1,
    },

    scoreContainer: { alignItems: 'center' },
    scoreLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: 'bold' },
    scoreValue: { fontSize: 24, fontFamily: FONTS.title },

    bottomSection: {
        // Container for record button + footer
    },

    actionButtonsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.l,
        backgroundColor: 'rgba(13, 17, 23, 0.6)',
    },
    uploadButton: {
        width: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadLabel: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
        letterSpacing: 1,
    },
    recordButtonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: SPACING.m,
        backgroundColor: 'rgba(13, 17, 23, 0.6)',
    },
    recordButton: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'transparent',
        borderWidth: 4,
        borderColor: COLORS.text,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recordButtonActive: {
        borderColor: COLORS.accent,
    },
    recordIcon: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.accent,
    },
    stopIcon: {
        width: 24,
        height: 24,
        backgroundColor: COLORS.accent,
        borderRadius: 4,
    },

    footer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        paddingVertical: SPACING.l,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    statBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    statLabel: { color: COLORS.textDim, fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    statValue: { color: COLORS.text, fontSize: 28, fontFamily: FONTS.title },

    phaseText: { color: COLORS.secondary, fontSize: 12, marginBottom: 4, fontWeight: 'bold' },
    feedbackText: { color: COLORS.text, fontSize: 14, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: SPACING.xs },
    feedbackBox: {
        flex: 2,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
});
