import { Link, Tabs } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { C, font } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarActiveTintColor: C.ink,
          tabBarInactiveTintColor: C.faint,
          tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
          tabBarStyle: {
            backgroundColor: C.card,
            borderTopColor: C.hairline,
            borderTopWidth: StyleSheet.hairlineWidth,
            ...Platform.select({ android: { height: 64 + insets.bottom, paddingTop: 8, paddingBottom: insets.bottom + 8 } }),
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Today',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="progress"
          options={{
            title: 'Progress',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <IconSymbol size={26} name="gearshape.fill" color={color} />,
          }}
        />
      </Tabs>

      {/* Floating capture button — the snap→log entry point. Dynamic position
          lives on this wrapper so the Link child keeps a single static style
          (react-native-web breaks on array styles applied to an <a>). */}
      <View style={[styles.fabWrap, { bottom: insets.bottom + 74 }]} pointerEvents="box-none">
        <Link href="/camera" asChild>
          <Pressable style={styles.fab} hitSlop={8}>
            <IconSymbol name="plus" size={30} color={C.card} />
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fabWrap: { position: 'absolute', right: 22 },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
  },
});
