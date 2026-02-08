import React, { useState, useEffect } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { Camera } from 'react-native-vision-camera';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CameraScreen from './src/CameraScreen';
import HomeScreen from './src/screens/HomeScreen';
import AnalyticsResultScreen from './src/screens/AnalyticsResultScreen';
import VideoAnalysisScreen from './src/screens/VideoAnalysisScreen';
import { ExerciseType } from './src/ai/ExerciseAnalyzer';
import { AnalyticsResult } from './src/services/AnalyticsService';
import { COLORS } from './src/constants/theme';

type ScreenType = 'Onboarding' | 'Home' | 'Camera' | 'VideoAnalysis' | 'Analytics';

export default function App() {
    const [currentScreen, setCurrentScreen] = useState<ScreenType>('Onboarding');
    const [selectedExercise, setSelectedExercise] = useState<ExerciseType>('Squat');
    const [analyticsResult, setAnalyticsResult] = useState<AnalyticsResult | null>(null);
    const [uploadedVideoUri, setUploadedVideoUri] = useState<string | null>(null);

    const [fontsLoaded] = useFonts({
        'Michroma': require('./assets/fonts/Michroma.ttf'),
        'Metashift': require('./assets/fonts/Metashift.otf'),
    });

    useEffect(() => {
        checkPermissions();
    }, []);

    const checkPermissions = async () => {
        const cameraPermission = await Camera.requestCameraPermission();
        const microphonePermission = await Camera.requestMicrophonePermission();
    };

    if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: COLORS.background }} />;

    const navigateToHome = () => setCurrentScreen('Home');

    const onSelectExercise = (exercise: ExerciseType) => {
        setSelectedExercise(exercise);
        setCurrentScreen('Camera');
    };

    const onBack = () => setCurrentScreen('Home');

    const onAnalysisComplete = (result: AnalyticsResult) => {
        setAnalyticsResult(result);
        setCurrentScreen('Analytics');
    };

    const onAnalyticsBack = () => {
        setAnalyticsResult(null);
        setUploadedVideoUri(null);
        setCurrentScreen('Home');
    };

    // Navigate to video analysis screen with uploaded video
    const onVideoSelected = (videoUri: string) => {
        setUploadedVideoUri(videoUri);
        setCurrentScreen('VideoAnalysis');
    };

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} translucent={false} />
            {currentScreen === 'Onboarding' && <OnboardingScreen onStart={navigateToHome} />}
            {currentScreen === 'Home' && <HomeScreen onSelectExercise={onSelectExercise} />}
            {currentScreen === 'Camera' && (
                <CameraScreen
                    exerciseType={selectedExercise}
                    onBack={onBack}
                    onAnalysisComplete={onAnalysisComplete}
                    onVideoSelected={onVideoSelected}
                />
            )}
            {currentScreen === 'VideoAnalysis' && uploadedVideoUri && (
                <VideoAnalysisScreen
                    videoUri={uploadedVideoUri}
                    exerciseType={selectedExercise}
                    onBack={onBack}
                    onAnalysisComplete={onAnalysisComplete}
                />
            )}
            {currentScreen === 'Analytics' && analyticsResult && (
                <AnalyticsResultScreen
                    result={analyticsResult}
                    onBack={onAnalyticsBack}
                />
            )}
        </>
    );
}
