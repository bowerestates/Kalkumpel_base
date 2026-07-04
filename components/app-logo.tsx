import { StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { C, font } from '@/constants/theme';

/** The MacroLens wordmark: a leaf glyph in a soft chip + the name. */
export function AppLogo() {
  return (
    <View style={styles.wrap}>
      <View style={styles.chip}>
        <IconSymbol name="leaf.fill" size={18} color={C.card} />
      </View>
      <Text style={styles.word}>MacroLens</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderCurve: 'continuous',
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: { fontSize: 20, color: C.ink, fontFamily: font.extrabold, letterSpacing: -0.3 },
});
