import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { C, font } from '@/constants/theme';
import { WeightEntry } from '@/lib/types';

const LINE = '#22C55E'; // Cal AI weight-progress green
const H = 170;
const PAD_Y = 18;

/**
 * Line chart of body-weight history. The parent passes the range-filtered entries
 * plus the time window [domainStart, domainEnd]; points are positioned along that
 * window, so switching the range visibly re-spreads the same points.
 */
export function WeightChart({
  weights,
  domainStart,
  domainEnd,
}: {
  weights: WeightEntry[];
  domainStart: number;
  domainEnd: number;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Safe on its own: Math.min/max over [] would yield ±Infinity and break the SVG.
  if (!weights.length) return null;

  const ys = weights.map((w) => w.kg);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const flat = maxY === minY; // single point or no change → draw at vertical center
  const span = maxY - minY || 1;
  const tSpan = domainEnd - domainStart || 1;

  const n = weights.length;
  // Position by timestamp within the selected window (clamped to the plot area).
  const x = (ts: number) => Math.max(0, Math.min(1, (ts - domainStart) / tSpan)) * width;
  const y = (kg: number) => (flat ? H / 2 : PAD_Y + (1 - (kg - minY) / span) * (H - PAD_Y * 2));

  const linePath =
    width > 0
      ? weights.map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(w.timestamp).toFixed(1)} ${y(w.kg).toFixed(1)}`).join(' ')
      : '';
  const areaPath =
    linePath && n > 1
      ? `${linePath} L ${x(weights[n - 1].timestamp).toFixed(1)} ${H} L ${x(weights[0].timestamp).toFixed(1)} ${H} Z`
      : '';

  const last = weights[n - 1];

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={H}>
          <Defs>
            <LinearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={LINE} stopOpacity={0.18} />
              <Stop offset="1" stopColor={LINE} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {areaPath ? <Path d={areaPath} fill="url(#weightFill)" /> : null}
          {linePath ? (
            <Path d={linePath} stroke={LINE} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {last ? <Circle cx={x(last.timestamp)} cy={y(last.kg)} r={5} fill={LINE} stroke={C.card} strokeWidth={2} /> : null}
        </Svg>
      ) : null}
      <View style={styles.minmax} pointerEvents="none">
        <Text style={styles.axis}>{maxY.toFixed(1)}</Text>
        <Text style={styles.axis}>{minY.toFixed(1)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: H, justifyContent: 'center' },
  minmax: { position: 'absolute', top: PAD_Y - 8, bottom: PAD_Y - 8, right: 0, justifyContent: 'space-between' },
  axis: { fontSize: 11, color: C.faint, fontFamily: font.medium, fontVariant: ['tabular-nums'], textAlign: 'right' },
});
