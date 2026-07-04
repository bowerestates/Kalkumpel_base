// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chart.bar.fill': 'bar-chart',
  'gearshape.fill': 'settings',
  'camera.fill': 'photo-camera',
  'flame.fill': 'local-fire-department',
  'plus.circle.fill': 'add-circle',
  'trash': 'delete',
  'xmark': 'close',
  'bolt.fill': 'flash-on',
  'bolt.slash.fill': 'flash-off',
  'bolt.badge.a.fill': 'flash-auto',
  'plus': 'add',
  'minus': 'remove',
  'checkmark': 'check',
  'leaf.fill': 'eco',
  'fork.knife': 'restaurant',
  'photo.on.rectangle': 'photo-library',
  'barcode.viewfinder': 'qr-code-scanner',
  'doc.text.viewfinder': 'description',
  'square.and.pencil': 'edit',
  'scalemass.fill': 'monitor-weight',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'lock': 'lock',
  'envelope': 'mail-outline',
  'rectangle.portrait.and.arrow.right': 'logout',
  'person.crop.circle': 'account-circle',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
