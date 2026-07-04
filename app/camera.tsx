import { CameraView, FlashMode, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { font } from '@/constants/theme';

type Edge = 'bottom' | 'left' | 'right';

// The screen rotates with the device (orientation: 'all'), so in landscape the
// whole control cluster moves to the short edge that sits at the phone's
// original bottom — i.e. under the thumb. Portrait keeps the bottom bar.
function useControlsEdge(): Edge {
  const [edge, setEdge] = useState<Edge>('bottom');
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return; // no real device rotation on web
    let active = true;
    const apply = (o: ScreenOrientation.Orientation) => {
      if (!active) return;
      // ponytail: if the rail lands on the wrong side on-device, swap 'left'/'right'.
      if (o === ScreenOrientation.Orientation.LANDSCAPE_LEFT) setEdge('left');
      else if (o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT) setEdge('right');
      else setEdge('bottom');
    };
    ScreenOrientation.getOrientationAsync().then(apply);
    const sub = ScreenOrientation.addOrientationChangeListener((e) =>
      apply(e.orientationInfo.orientation),
    );
    return () => {
      active = false;
      ScreenOrientation.removeOrientationChangeListener(sub);
    };
  }, []);
  return edge;
}

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('off');
  const insets = useSafeAreaInsets();
  const edge = useControlsEdge();

  const flashIcon =
    flash === 'on' ? 'bolt.fill' : flash === 'auto' ? 'bolt.badge.a.fill' : 'bolt.slash.fill';
  const cycleFlash = () => setFlash((f) => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'));

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera access needed</Text>
        <Text style={styles.permBody}>
          We use the camera to photograph your meals and estimate their nutrition.
        </Text>
        <Pressable style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant access</Text>
        </Pressable>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  async function snap() {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) router.replace({ pathname: '/review', params: { uri: photo.uri } });
    } finally {
      setCapturing(false);
    }
  }

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    if (!res.canceled && res.assets[0]?.uri) {
      router.replace({ pathname: '/review', params: { uri: res.assets[0].uri } });
    }
  }

  const shutter = (
    <Pressable style={styles.shutter} onPress={snap} disabled={capturing}>
      {capturing ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
    </Pressable>
  );
  const scanPill = (
    <View style={styles.scanPill}>
      <IconSymbol name="camera.fill" size={16} color="#000" />
      <Text style={styles.scanText}>Scan Food</Text>
    </View>
  );
  const gallery = (
    <Pressable style={styles.galleryBtn} onPress={pickFromLibrary} hitSlop={10}>
      <IconSymbol name="photo.on.rectangle" size={24} color="#fff" />
    </Pressable>
  );

  // Keep the corner buttons clear of the side rail: in landscape both sit on the
  // edge opposite the rail (stacked); portrait keeps close-left / flash-right.
  const topY = insets.top + 12;
  const closePos = edge === 'left' ? { top: topY, right: 20 } : { top: topY, left: 20 };
  const flashPos =
    edge === 'bottom'
      ? { top: topY, right: 20 }
      : edge === 'right'
        ? { top: topY + 56, left: 20 }
        : { top: topY + 56, right: 20 };

  return (
    <View style={styles.flex}>
      <CameraView ref={cameraRef} style={styles.flex} facing="back" flash={flash} />

      <Pressable style={[styles.iconBtn, closePos]} onPress={() => router.back()} hitSlop={12}>
        <IconSymbol name="xmark" size={26} color="#fff" />
      </Pressable>
      <Pressable style={[styles.iconBtn, flashPos]} onPress={cycleFlash} hitSlop={12}>
        <IconSymbol name={flashIcon} size={24} color={flash === 'off' ? '#fff' : '#FFD60A'} />
      </Pressable>

      {edge === 'bottom' ? (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          {scanPill}
          <View style={styles.shutterRow}>
            {gallery}
            {shutter}
            {/* Transparent spacer balances the gallery button so the shutter stays centered. */}
            <View style={styles.spacer} />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.rail,
            edge === 'left'
              ? { left: 0, paddingLeft: insets.left + 16 }
              : { right: 0, paddingRight: insets.right + 16 },
          ]}>
          {scanPill}
          <View style={styles.shutterCol}>
            {gallery}
            {shutter}
            <View style={styles.spacer} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, backgroundColor: '#000' },
  permTitle: { color: '#fff', fontSize: 20, fontFamily: font.bold },
  permBody: { color: '#bbb', textAlign: 'center', lineHeight: 20, fontFamily: font.regular },
  permButton: { backgroundColor: '#fff', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24, borderCurve: 'continuous', marginTop: 8 },
  permButtonText: { color: '#000', fontFamily: font.bold },
  cancelText: { color: '#888', marginTop: 8, fontFamily: font.medium },
  iconBtn: { position: 'absolute', width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 22 },
  rail: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 24 },
  shutterCol: { alignItems: 'center', gap: 28 },
  scanPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  scanText: { color: '#000', fontSize: 13, fontFamily: font.semibold },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 44 },
  galleryBtn: { width: 48, height: 48, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.35)' },
  spacer: { width: 48, height: 48 },
  shutter: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff' },
});
