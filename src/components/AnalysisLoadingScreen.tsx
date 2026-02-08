import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { AnalysisPhase } from '../services/AnalyticsService';

const { width } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
    phase: AnalysisPhase;
    uploadProgress?: number;
}

// Fun loading messages
const UPLOAD_MESSAGES = [
    "Uploading your gains...",
    "Sending to the AI coach...",
    "Packaging your workout...",
    "Almost there...",
];

const ANALYSIS_MESSAGES = [
    "AI is watching your form... 👀",
    "Counting the perfect reps...",
    "Analyzing muscle engagement...",
    "Checking your stability...",
    "Evaluating range of motion...",
    "Preparing your feedback...",
    "Almost ready with insights...",
];

export default function AnalysisLoadingScreen({ phase, uploadProgress = 0 }: Props) {
    const spinValue = useRef(new Animated.Value(0)).current;
    const pulseValue = useRef(new Animated.Value(1)).current;
    const waveValue = useRef(new Animated.Value(0)).current;
    const [messageIndex, setMessageIndex] = useState(0);

    // Spinning animation
    useEffect(() => {
        const spin = Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        );
        spin.start();
        return () => spin.stop();
    }, [spinValue]);

    // Pulse animation
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, {
                    toValue: 1.2,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseValue, {
                    toValue: 1,
                    duration: 800,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseValue]);

    // Wave animation for analyzing phase
    useEffect(() => {
        if (phase === 'analyzing') {
            const wave = Animated.loop(
                Animated.timing(waveValue, {
                    toValue: 1,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                })
            );
            wave.start();
            return () => wave.stop();
        }
    }, [phase, waveValue]);

    // Cycle through messages
    useEffect(() => {
        const messages = phase === 'uploading' ? UPLOAD_MESSAGES : ANALYSIS_MESSAGES;
        const interval = setInterval(() => {
            setMessageIndex(prev => (prev + 1) % messages.length);
        }, 2500);
        return () => clearInterval(interval);
    }, [phase]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const messages = phase === 'uploading' ? UPLOAD_MESSAGES : ANALYSIS_MESSAGES;
    const currentMessage = messages[messageIndex];

    return (
        <View style={styles.container}>
            {/* Background gradient effect */}
            <View style={styles.gradientOverlay} />

            {/* Main animation container */}
            <Animated.View style={[styles.animationContainer, { transform: [{ scale: pulseValue }] }]}>
                {phase === 'uploading' ? (
                    // Upload animation - circular progress
                    <View style={styles.circleContainer}>
                        <Svg width={150} height={150} viewBox="0 0 150 150">
                            {/* Background circle */}
                            <Circle
                                cx="75"
                                cy="75"
                                r="60"
                                stroke={COLORS.surface}
                                strokeWidth="8"
                                fill="none"
                            />
                            {/* Progress circle */}
                            <Circle
                                cx="75"
                                cy="75"
                                r="60"
                                stroke={COLORS.primary}
                                strokeWidth="8"
                                fill="none"
                                strokeDasharray={`${2 * Math.PI * 60}`}
                                strokeDashoffset={2 * Math.PI * 60 * (1 - uploadProgress / 100)}
                                strokeLinecap="round"
                                transform="rotate(-90 75 75)"
                            />
                        </Svg>
                        {/* Upload icon */}
                        <View style={styles.iconOverlay}>
                            <Svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M12 16V4M12 4L8 8M12 4L16 8M4 20H20"
                                    stroke={COLORS.primary}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </View>
                        <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
                    </View>
                ) : (
                    // Analysis animation - AI brain spinner
                    <Animated.View style={{ transform: [{ rotate: spin }] }}>
                        <Svg width={150} height={150} viewBox="0 0 150 150">
                            {/* Outer spinning ring */}
                            <Circle
                                cx="75"
                                cy="75"
                                r="65"
                                stroke={COLORS.primary}
                                strokeWidth="3"
                                fill="none"
                                strokeDasharray="20 10"
                                opacity={0.8}
                            />
                            {/* Inner ring */}
                            <Circle
                                cx="75"
                                cy="75"
                                r="50"
                                stroke={COLORS.secondary}
                                strokeWidth="2"
                                fill="none"
                                strokeDasharray="15 5"
                                opacity={0.6}
                            />
                            {/* Center brain icon placeholder */}
                            <G transform="translate(45, 45)">
                                <Path
                                    d="M30 5C20 5 15 15 15 20C10 20 5 25 5 35C5 45 15 50 25 50L35 50C45 50 55 45 55 35C55 25 50 20 45 20C45 15 40 5 30 5Z"
                                    stroke={COLORS.accent}
                                    strokeWidth="2"
                                    fill="none"
                                />
                                <Path
                                    d="M30 15V35M20 25H40"
                                    stroke={COLORS.primary}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </G>
                        </Svg>
                    </Animated.View>
                )}
            </Animated.View>

            {/* Phase indicator */}
            <View style={styles.phaseContainer}>
                <Text style={styles.phaseTitle}>
                    {phase === 'uploading' ? '📤 UPLOADING VIDEO' : '🧠 AI ANALYZING'}
                </Text>
                <Text style={styles.phaseMessage}>{currentMessage}</Text>
            </View>

            {/* Steps indicator */}
            <View style={styles.stepsContainer}>
                <View style={[styles.step, phase === 'uploading' && styles.stepActive]}>
                    <View style={[styles.stepDot, phase === 'uploading' && styles.stepDotActive]} />
                    <Text style={[styles.stepText, phase === 'uploading' && styles.stepTextActive]}>Upload</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={[styles.step, phase === 'analyzing' && styles.stepActive]}>
                    <View style={[styles.stepDot, phase === 'analyzing' && styles.stepDotActive]} />
                    <Text style={[styles.stepText, phase === 'analyzing' && styles.stepTextActive]}>Analyze</Text>
                </View>
                <View style={styles.stepLine} />
                <View style={styles.step}>
                    <View style={styles.stepDot} />
                    <Text style={styles.stepText}>Results</Text>
                </View>
            </View>

            {/* Tip text */}
            <Text style={styles.tipText}>
                {phase === 'uploading'
                    ? 'Stay connected to WiFi for faster upload'
                    : 'This usually takes 5-15 seconds'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.xl,
    },
    gradientOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: COLORS.background,
        opacity: 0.9,
    },
    animationContainer: {
        width: 180,
        height: 180,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    circleContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconOverlay: {
        position: 'absolute',
        top: 35,
    },
    progressText: {
        position: 'absolute',
        bottom: 35,
        color: COLORS.primary,
        fontSize: 18,
        fontWeight: 'bold',
    },
    phaseContainer: {
        alignItems: 'center',
        marginBottom: SPACING.xl,
    },
    phaseTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontFamily: FONTS.title,
        letterSpacing: 2,
        marginBottom: SPACING.s,
    },
    phaseMessage: {
        color: COLORS.textDim,
        fontSize: 16,
        textAlign: 'center',
    },
    stepsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.xl,
        paddingHorizontal: SPACING.l,
    },
    step: {
        alignItems: 'center',
    },
    stepActive: {
        opacity: 1,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.surface,
        marginBottom: SPACING.xs,
    },
    stepDotActive: {
        backgroundColor: COLORS.primary,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 5,
    },
    stepText: {
        color: COLORS.textDim,
        fontSize: 12,
    },
    stepTextActive: {
        color: COLORS.primary,
        fontWeight: 'bold',
    },
    stepLine: {
        width: 40,
        height: 2,
        backgroundColor: COLORS.surface,
        marginHorizontal: SPACING.xs,
        marginBottom: SPACING.m,
    },
    tipText: {
        color: COLORS.textDim,
        fontSize: 12,
        textAlign: 'center',
        fontStyle: 'italic',
    },
});
