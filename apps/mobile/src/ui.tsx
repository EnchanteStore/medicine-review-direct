import { Pressable, StyleSheet, Text, View } from 'react-native';
import { emergencyBanner } from './model';

export function EmergencyBanner() {
  const banner = emergencyBanner();
  return (
    <View accessibilityRole="summary" style={styles.banner}>
      <Text style={styles.bannerHeading}>{banner.heading}</Text>
      <Text style={styles.bannerBody}>{banner.body}</Text>
    </View>
  );
}

export function BigButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fff4e5',
    borderColor: '#8a4b08',
    borderWidth: 2,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  bannerHeading: { fontSize: 18, fontWeight: '700', color: '#10242b', marginBottom: 8 },
  bannerBody: { fontSize: 18, lineHeight: 26, color: '#10242b' },
  button: {
    minHeight: 48,
    backgroundColor: '#0f5e63',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
});
