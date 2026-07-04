import { ReactNode, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { C } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A single circular progress ring with optional centered content. Progress may
 * exceed 1 (it's clamped for the arc). Animates to its value over 700ms.
 * Shared by the calorie card and the macro cards.
 */
export function ProgressRing({
  size,
  stroke,
  progress,
  color,
  track = C.hairline,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = useSharedValue(0);

  useEffect(() => {
    pct.value = withTiming(Math.min(Math.max(progress, 0), 1), { duration: 700 });
  }, [progress, pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - pct.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
