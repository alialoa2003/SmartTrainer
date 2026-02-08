import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { AnalyticsResult, PillarResult } from '../services/AnalyticsService';

const { width } = Dimensions.get('window');

interface Props {
    result: AnalyticsResult;
    onBack: () => void;
}

// Pillar icons and colors
const PILLAR_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    stability: { icon: '⚖️', color: '#00F0FF', label: 'STABILITY' },
    posture: { icon: '🧍', color: '#7000FF', label: 'POSTURE' },
    range_of_motion: { icon: '📐', color: '#FF6B00', label: 'RANGE OF MOTION' },
    movement_quality: { icon: '⚡', color: '#00FF88', label: 'MOVEMENT QUALITY' },
    bracing_core: { icon: '💪', color: '#FF0080', label: 'CORE BRACING' },
};

// Score color based on value
const getScoreColor = (score: number): string => {
    if (score >= 80) return COLORS.success;
    if (score >= 60) return '#FFB800';
    return COLORS.accent;
};

/**
 * Clean the AI summary text from JSON/markdown formatting
 * Sometimes the API returns raw JSON wrapped in code blocks
 */
const cleanSummaryText = (summary: string): string => {
    if (!summary) return 'Great workout!';

    let cleaned = summary;

    // Remove markdown code block wrappers (```json ... ``` or ``` ... ```)
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    cleaned = cleaned.trim();

    // Try to parse as JSON if it looks like JSON
    if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
        try {
            const parsed = JSON.parse(cleaned);

            // If it has a summary field, use that
            if (parsed.summary && typeof parsed.summary === 'string') {
                return parsed.summary;
            }

            // If it's just a string in the JSON, return it
            if (typeof parsed === 'string') {
                return parsed;
            }

            // Otherwise return the original (cleaned)
            return cleaned;
        } catch {
            // Not valid JSON, return as-is
            return cleaned;
        }
    }

    return cleaned;
};

// Circular progress component
const CircularScore = ({ score, size = 120 }: { score: number; size?: number }) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const color = getScoreColor(score);

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size}>
                {/* Background circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={COLORS.surface}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference - progress}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
            <View style={StyleSheet.absoluteFill}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={[styles.overallScoreValue, { color }]}>{Math.round(score)}</Text>
                    <Text style={styles.overallScoreLabel}>OVERALL</Text>
                </View>
            </View>
        </View>
    );
};

// Pillar card component
const PillarCard = ({ name, data }: { name: string; data: PillarResult }) => {
    const config = PILLAR_CONFIG[name] || { icon: '📊', color: COLORS.primary, label: name.toUpperCase() };
    const scoreColor = getScoreColor(data.score);

    return (
        <View style={[styles.pillarCard, { borderLeftColor: config.color }]}>
            <View style={styles.pillarHeader}>
                <Text style={styles.pillarIcon}>{config.icon}</Text>
                <View style={styles.pillarTitleContainer}>
                    <Text style={styles.pillarLabel}>{config.label}</Text>
                    <View style={styles.pillarScoreContainer}>
                        <Text style={[styles.pillarScore, { color: scoreColor }]}>{data.score}</Text>
                        <Text style={styles.pillarScoreMax}>/100</Text>
                    </View>
                </View>
            </View>
            <Text style={styles.pillarFeedback}>{data.feedback}</Text>
            {/* Score bar */}
            <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: `${data.score}%`, backgroundColor: config.color }]} />
            </View>
        </View>
    );
};

export default function AnalyticsResultScreen({ result, onBack }: Props) {
    return (
        <View style={styles.container}>
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
                    <Text style={styles.headerTitle}>WORKOUT ANALYSIS</Text>
                    <Text style={styles.headerSubtitle}>{result.exercise} • {result.reps_analyzed} reps</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Overall Score */}
                <View style={styles.overallContainer}>
                    <CircularScore score={result.overall_score} size={140} />
                </View>

                {/* AI Summary Card */}
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryIcon}>🤖</Text>
                    <Text style={styles.summaryTitle}>Smart Trainer Says:</Text>
                    <Text style={styles.summaryText}>"{cleanSummaryText(result.summary)}"</Text>
                </View>

                {/* 5 Pillars */}
                <Text style={styles.sectionTitle}>FORM ANALYSIS</Text>
                {Object.entries(result.pillars).map(([pillarName, pillarData]) => (
                    <PillarCard key={pillarName} name={pillarName} data={pillarData} />
                ))}

                {/* Solutions */}
                {result.solutions && result.solutions.length > 0 && (
                    <>
                        <Text style={styles.sectionTitle}>HOW TO IMPROVE</Text>
                        <View style={styles.solutionsCard}>
                            {result.solutions.map((solution, index) => (
                                <View key={index} style={styles.solutionItem}>
                                    <Text style={styles.solutionNumber}>{index + 1}</Text>
                                    <Text style={styles.solutionText}>{solution}</Text>
                                </View>
                            ))}
                        </View>
                    </>
                )}

                {/* Back button */}
                <TouchableOpacity style={styles.doneButton} onPress={onBack}>
                    <Text style={styles.doneButtonText}>BACK TO HOME</Text>
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: SPACING.m,
        paddingTop: SPACING.l,
        backgroundColor: 'rgba(13, 17, 23, 0.9)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    backButton: {
        padding: SPACING.s,
    },
    headerTitle: {
        color: COLORS.text,
        fontSize: 18,
        fontFamily: FONTS.title,
        letterSpacing: 1,
        textAlign: 'center',
    },
    headerSubtitle: {
        color: COLORS.primary,
        fontSize: 11,
        letterSpacing: 1,
        textAlign: 'center',
    },
    scrollContent: {
        padding: SPACING.m,
        paddingBottom: SPACING.xl * 2,
    },
    overallContainer: {
        alignItems: 'center',
        marginVertical: SPACING.l,
    },
    overallScoreValue: {
        fontSize: 48,
        fontFamily: FONTS.title,
    },
    overallScoreLabel: {
        color: COLORS.textDim,
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 2,
    },
    summaryCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: SPACING.l,
        marginBottom: SPACING.l,
        borderWidth: 1,
        borderColor: 'rgba(112, 0, 255, 0.3)',
    },
    summaryIcon: {
        fontSize: 28,
        marginBottom: SPACING.s,
    },
    summaryTitle: {
        color: COLORS.secondary,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: SPACING.xs,
    },
    summaryText: {
        color: COLORS.text,
        fontSize: 16,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    sectionTitle: {
        color: COLORS.textDim,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 2,
        marginBottom: SPACING.m,
        marginTop: SPACING.s,
    },
    pillarCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: SPACING.m,
        marginBottom: SPACING.m,
        borderLeftWidth: 4,
    },
    pillarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: SPACING.s,
    },
    pillarIcon: {
        fontSize: 24,
        marginRight: SPACING.m,
    },
    pillarTitleContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pillarLabel: {
        color: COLORS.text,
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
    pillarScoreContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    pillarScore: {
        fontSize: 24,
        fontFamily: FONTS.title,
    },
    pillarScoreMax: {
        color: COLORS.textDim,
        fontSize: 12,
    },
    pillarFeedback: {
        color: COLORS.textDim,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: SPACING.s,
    },
    scoreBar: {
        height: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    scoreBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    solutionsCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: SPACING.m,
        marginBottom: SPACING.l,
    },
    solutionItem: {
        flexDirection: 'row',
        marginBottom: SPACING.m,
    },
    solutionNumber: {
        color: COLORS.primary,
        fontSize: 16,
        fontFamily: FONTS.title,
        marginRight: SPACING.m,
        width: 24,
    },
    solutionText: {
        flex: 1,
        color: COLORS.text,
        fontSize: 14,
        lineHeight: 20,
    },
    doneButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: SPACING.m,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: SPACING.m,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    doneButtonText: {
        color: COLORS.background,
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
});
