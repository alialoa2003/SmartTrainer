import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, StatusBar, Image } from 'react-native';
import { COLORS, SPACING, FONTS } from '../constants/theme';
import { ExerciseType } from '../ai/ExerciseAnalyzer';

interface Props {
    onSelectExercise: (ex: ExerciseType) => void;
}

// Exercise thumbnail images from Unsplash (royalty-free fitness images)
const EXERCISE_IMAGES: Record<string, string> = {
    // Legs
    'Squat': 'https://hips.hearstapps.com/hmg-prod/images/man-training-with-weights-royalty-free-image-1718637105.jpg?crop=0.670xw:1.00xh;0.138xw,0&resize=1200:*',
    'Leg Extension': 'https://tecafitness.com/wp-content/uploads/2024/03/ETE100-Leg-Extension-6.webp',
    'Leg Raises': 'https://cdn11.bigcommerce.com/s-z6voly6yu7/images/stencil/1028x1028/products/2470/26524/IMGL0311__20416.1749485771.jpg?c=1',

    // Push
    'Push Up': 'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=200&h=200&fit=crop',
    'Bench Press': 'https://cdn.mos.cms.futurecdn.net/pLaRi5jXSHDKu6WRydetBo-1000-80.jpg',
    'Incline Bench Press': 'https://blogscdn.thehut.net/app/uploads/sites/478/2021/07/shutterstock_68880238opt_featured_1625232235_1200x672_acf_cropped.jpg',
    'Tricep Dips': 'https://cdn.shopify.com/s/files/1/2513/1876/files/Athlete_Performing_Dips_on_GORNATION_Dip_Bars.png?v=1734683960',
    'Chest Fly Machine': 'https://www.atxfitness.com/media/catalog/product/cache/207e23213cf636ccdef205098cf3c8a3/a/t/atx-pec-650-atmo06.jpg',

    // Pull
    'Pull Up': 'https://article.images.consumerreports.org/image/upload/w_652,f_auto,q_auto,ar_16:9,c_lfill/v1718991749/prod/content/dam/CRO-Images-2024/Rapid-Response/CR-RR-InlineHero-Pull-Up-Bars-0624',
    'Lat Pulldown': 'https://cdn.prod.website-files.com/66c501d753ae2a8c705375b6/6786c870ee8717d31a82f0a4_677e6acd61197024154c1738_AF_Blog_HERO_HowToUseTheLatPulldownMachine.jpeg',
    'T-Bar Row': 'https://motionsports.de/cdn/shop/files/VF24_LIFESTYLE_PL-FW_INCLINE-LEVER-ROW_male_pulling-upwards_front-angle.jpg?v=1721754109&width=2048',
    'Barbell Biceps Curl': 'https://gripzilla.co/cdn/shop/articles/barbell-bicep-curls-step-wise-guide-benefits-mistakes-to-avoid-965012.jpg?v=1708346720',

    'Lateral Raises': 'https://lh4.googleusercontent.com/proxy/kN7s7rbpPUUykzWIYneId6gGgYq5cetpPh9TvOdhlv4gR8_qcr08zxSAbF6yKrc-wDVTcBDL4mrc5bT8RuAXZ-ROggbEwbLe',

    // Core
    'Plank': 'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=200&h=200&fit=crop',
    'Russian Twist': 'https://i.ytimg.com/vi/ph1mHi0Ntb8/maxresdefault.jpg',

    // AI
    'Auto-Detect': 'https://static.vecteezy.com/system/resources/thumbnails/076/017/044/small/thinking-gymnastic-rings-and-olympics-with-a-man-gymnast-hanging-on-equipment-for-workout-in-gym-idea-fitness-and-exercise-with-a-male-athlete-training-in-gymnastics-for-health-or-power-photo.jpg',
};

const CATEGORIES = {
    'AI': ['Auto-Detect'],
    'Push': ['Push Up', 'Bench Press', 'Incline Bench Press', 'Tricep Dips', 'Chest Fly Machine'],
    'Pull': ['Pull Up', 'Lat Pulldown', 'T-Bar Row', 'Barbell Biceps Curl', 'Lateral Raises'],
    'Core': ['Plank', 'Russian Twist'],
    'Legs': ['Squat', 'Leg Extension', 'Leg Raises']
};

export default function HomeScreen({ onSelectExercise }: Props) {
    const [selectedCategory, setSelectedCategory] = useState('All');

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>AI COACH</Text>
                <Text style={styles.subtitle}>Select your workout</Text>
            </View>

            {/* Filter Chips */}
            <View style={styles.categories}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['All', ...Object.keys(CATEGORIES)].map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.chip, selectedCategory === cat && styles.chipActive]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[styles.chipText, selectedCategory === cat && styles.chipTextActive]}>
                                {cat.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Grid */}
            <ScrollView contentContainerStyle={styles.grid}>
                {Object.entries(CATEGORIES).map(([cat, exercises]) => {
                    if (selectedCategory !== 'All' && selectedCategory !== cat) return null;

                    return (
                        <View key={cat} style={styles.section}>
                            <Text style={styles.sectionTitle}>{cat}</Text>
                            <View style={styles.row}>
                                {exercises.map(ex => (
                                    <TouchableOpacity
                                        key={ex}
                                        style={styles.card}
                                        onPress={() => onSelectExercise(ex as ExerciseType)}
                                    >
                                        <View style={styles.imageContainer}>
                                            <Image
                                                source={{ uri: EXERCISE_IMAGES[ex] }}
                                                style={styles.exerciseImage}
                                                resizeMode="cover"
                                            />
                                            <View style={styles.imageOverlay} />
                                        </View>
                                        <Text style={styles.cardText}>{ex}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: SPACING.l, paddingTop: SPACING.xl },
    title: { color: COLORS.primary, fontSize: 32, fontFamily: FONTS.title, letterSpacing: 2 },
    subtitle: { color: COLORS.textDim, fontSize: 16, marginTop: SPACING.xs },

    categories: { flexDirection: 'row', paddingHorizontal: SPACING.l, marginBottom: SPACING.m, height: 50 },
    chip: {
        marginRight: SPACING.s, paddingHorizontal: SPACING.m, paddingVertical: SPACING.s,
        borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.surface
    },
    chipActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(0, 240, 255, 0.1)' },
    chipText: { color: COLORS.textDim, fontWeight: 'bold' },
    chipTextActive: { color: COLORS.primary },

    grid: { paddingHorizontal: SPACING.m, paddingBottom: SPACING.xl },
    section: { marginBottom: SPACING.l },
    sectionTitle: { color: COLORS.secondary, fontSize: 14, fontWeight: 'bold', marginBottom: SPACING.s, marginLeft: SPACING.xs },
    row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

    card: {
        width: '48%', backgroundColor: COLORS.surface, borderRadius: 12,
        marginBottom: SPACING.m, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)'
    },
    imageContainer: {
        width: '100%',
        height: 170,
        position: 'relative',
    },
    exerciseImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    cardText: {
        color: COLORS.text,
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600',
        paddingVertical: SPACING.s,
        paddingHorizontal: SPACING.xs,
    }
});
