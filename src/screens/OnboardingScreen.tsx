import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

export default function OnboardingScreen({ onStart }: { onStart: () => void }) {
    // Use Require for local asset or URI
    // We copied startvid.mp4 to assets/videos/
    // In Expo, we often require it.
    const videoSource = require('../../assets/videos/startvid.mp4');

    return (
        <View style={styles.container}>
            <Video
                style={StyleSheet.absoluteFill}
                source={videoSource}
                resizeMode={ResizeMode.COVER}
                isLooping
                shouldPlay
                isMuted={true}
            />
            <View style={styles.overlay}>
                <Text style={styles.title}>SMART TRAINER</Text>
                <Text style={styles.subtitle}>Reference Level Training</Text>

                <TouchableOpacity style={styles.button} onPress={onStart}>
                    <Text style={styles.buttonText}>START WORKOUT</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 80, backgroundColor: 'rgba(0,0,0,0.3)' },
    title: { color: 'white', fontSize: 48, fontFamily: 'Michroma', fontWeight: 'bold', marginBottom: 10 },
    subtitle: { color: '#00D1FF', fontSize: 18, fontFamily: 'Metashift', marginBottom: 40, letterSpacing: 2 },
    button: { backgroundColor: '#00D1FF', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 30 },
    buttonText: { color: 'black', fontSize: 18, fontWeight: 'bold', fontFamily: 'Teko' }
});
