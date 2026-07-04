import { useRef } from 'react';
import { ScrollView, View } from 'react-native';

/**
 * Zero-dependency "scroll focused field above the keyboard" helper for a ScrollView.
 * Android's keyboard mode can't be changed from app.json in Expo Go, and
 * automaticallyAdjustKeyboardInsets is iOS-only — so we scroll the focused field
 * into view ourselves.
 *
 * Register each field's row View via `ref`, then call `focusField(key)` on the
 * input's onFocus. We measure the row against the ScrollView's content
 * (measureLayout), so a row nested inside a sub-group (e.g. reminders far down the
 * page) scrolls to its TRUE content offset. The old approach stored onLayout's
 * `layout.y`, which is relative to the row's immediate parent — correct only for
 * rows that are direct children of the scroll content, and wrong (scrolls near the
 * top) for anything inside a nested group.
 *
 * Usage:
 *   const { scrollRef, registerField, focusField } = useKeyboardAwareScroll();
 *   <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" ... >
 *     <View ref={registerField('calories')}>
 *       <TextInput onFocus={() => focusField('calories')} ... />
 */
export function useKeyboardAwareScroll(offset = 100) {
  const scrollRef = useRef<ScrollView>(null);
  const nodes = useRef<Record<string, View | null>>({});

  const registerField = (key: string) => (node: View | null) => {
    nodes.current[key] = node;
  };

  const focusField = (key: string) => {
    const node = nodes.current[key];
    const scroll = scrollRef.current;
    if (!node || !scroll) return;
    // Fabric (new architecture) requires measureLayout's relative target to be a REF
    // to a native component — a numeric findNodeHandle()/getInnerViewNode() throws
    // "ref.measureLayout must be called with a ref to a native component". getNativeScrollRef()
    // returns the scroll view's underlying native host instance; measuring the row against
    // it gives the row's content offset (scroll-position independent) for scrollTo. On
    // react-native-web there's no native ref (and no keyboard to avoid) — bail out.
    const scrollNode = scroll.getNativeScrollRef?.();
    if (!scrollNode) return;
    node.measureLayout(
      scrollNode,
      (_x, y) => scroll.scrollTo({ y: Math.max(y - offset, 0), animated: true }),
      () => {}
    );
  };

  return { scrollRef, registerField, focusField };
}
