import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { COLORS, FONTS, SPACING } from '../constants/theme';

interface Props {
    visible: boolean;
    repCount: number;
    duration: number;
    exerciseName?: string; // Detected exercise name for display
    onAnalyze: () => void;
    onDiscard: () => void;
}

export default function PostRecordingModal({ visible, repCount, duration, exerciseName, onAnalyze, onDiscard }: Props) {
    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    {/* Success Icon */}
                    <View style={styles.iconContainer}>
                        <Svg width="60" height="60" viewBox="0 0 60 60">
                            <Circle cx="30" cy="30" r="28" stroke={COLORS.success} strokeWidth="3" fill="none" />
                            <Path
                                d="M20 30L27 37L42 22"
                                stroke={COLORS.success}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                            />
                        </Svg>
                    </View>

                    {/* Title */}
                    <Text style={styles.title}>WORKOUT RECORDED!</Text>
                    <Text style={styles.subtitle}>
                        {exerciseName ? `${exerciseName} detected` : 'Great session! Ready for AI analysis?'}
                    </Text>

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        {exerciseName && (
                            <>
                                <View style={styles.statItem}>
                                    <Text style={styles.exerciseNameValue}>{exerciseName}</Text>
                                    <Text style={styles.statLabel}>EXERCISE</Text>
                                </View>
                                <View style={styles.statDivider} />
                            </>
                        )}
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{repCount}</Text>
                            <Text style={styles.statLabel}>REPS</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{formatDuration(duration)}</Text>
                            <Text style={styles.statLabel}>DURATION</Text>
                        </View>
                    </View>

                    {/* Description */}
                    <Text style={styles.description}>
                        Send your video to the AI coach for detailed form analysis with scores on stability, posture, range of motion, and more.
                    </Text>

                    {/* Buttons */}
                    <TouchableOpacity style={styles.analyzeButton} onPress={onAnalyze}>
                        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
                            <Path
                                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
                                fill={COLORS.background}
                            />
                        </Svg>
                        <Text style={styles.analyzeButtonText}>ANALYZE MY FORM</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.discardButton} onPress={onDiscard}>
                        <Text style={styles.discardButtonText}>Skip Analysis</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal >
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: SPACING.l,
    },
    modalContainer: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: SPACING.xl,
        width: '100%',
        maxWidth: 350,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 240, 255, 0.2)',
    },
    iconContainer: {
        marginBottom: SPACING.m,
    },
    title: {
        color: COLORS.text,
        fontSize: 22,
        fontFamily: FONTS.title,
        letterSpacing: 2,
        marginBottom: SPACING.xs,
    },
    subtitle: {
        color: COLORS.textDim,
        fontSize: 14,
        marginBottom: SPACING.l,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.l,
        paddingHorizontal: SPACING.m,
    },
    statItem: {
        alignItems: 'center',
        paddingHorizontal: SPACING.l,
    },
    statValue: {
        color: COLORS.primary,
        fontSize: 32,
        fontFamily: FONTS.title,
    },
    exerciseNameValue: {
        color: COLORS.primary,
        fontSize: 16,
        fontFamily: FONTS.title,
        textAlign: 'center',
    },
    statLabel: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    description: {
        color: COLORS.textDim,
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: SPACING.l,
        paddingHorizontal: SPACING.s,
    },
    analyzeButton: {
        flexDirection: 'row',
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.m,
        paddingHorizontal: SPACING.xl,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        marginBottom: SPACING.m,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    analyzeButtonText: {
        color: COLORS.background,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    discardButton: {
        paddingVertical: SPACING.s,
    },
    discardButtonText: {
        color: COLORS.textDim,
        fontSize: 14,
    },
});
