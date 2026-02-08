import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { PoseLandmark, Feedback } from '../ai/ExerciseAnalyzer';

interface Props {
    landmarks: PoseLandmark[];
    feedback: Feedback;
}

const CONNECTIONS = [
    [11, 12], // shoulders
    [11, 13], [13, 15], // left arm
    [12, 14], [14, 16], // right arm
    [11, 23], [12, 24], // torso
    [23, 24], // hips
    [23, 25], [25, 27], // left leg
    [24, 26], [26, 28]  // right leg
];

export const FormFeedbackOverlay = ({ landmarks, feedback }: Props) => {
    if (!landmarks || landmarks.length === 0) return null;

    const color = feedback.isGoodForm ? '#44FF44' : '#FF4444';
    const width = 2; // Stroke width

    // Mapping normalized coordinates (0-1) to screen size is handled by the parent 
    // or we assume full screen SVG. Landmarks from VisionCamera/MediaPipe might be normalized.

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg height="100%" width="100%" viewBox="0 0 100 100">
                {CONNECTIONS.map(([start, end], index) => {
                    const p1 = landmarks[start];
                    const p2 = landmarks[end];
                    if (!p1 || !p2) return null;

                    return (
                        <Line
                            key={index}
                            x1={p1.x * 100}
                            y1={p1.y * 100}
                            x2={p2.x * 100}
                            y2={p2.y * 100}
                            stroke={color}
                            strokeWidth={width / 10} // Scaled relative to viewBox
                        />
                    );
                })}
                {landmarks.map((lm, index) => (
                    index > 10 && ( // Skip face landmarks for cleaner look
                        <Circle
                            key={index}
                            cx={lm.x * 100}
                            cy={lm.y * 100}
                            r={0.5}
                            fill="white"
                        />
                    )
                ))}
            </Svg>
        </View>
    );
};
