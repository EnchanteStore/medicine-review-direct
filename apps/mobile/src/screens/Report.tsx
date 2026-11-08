import { StyleSheet, Text, View } from 'react-native';
import type { ReportSection } from '@mrd/domain';
import { EmergencyBanner } from '../ui';

export function ReportScreen({
  visible,
  message,
  sections,
}: {
  visible: boolean;
  message?: string;
  sections?: ReportSection[];
}) {
  if (!visible) {
    return (
      <View>
        <Text accessibilityRole="header" style={styles.title}>
          Your report
        </Text>
        <EmergencyBanner />
        <Text style={styles.body}>{message}</Text>
      </View>
    );
  }
  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        Your report
      </Text>
      <EmergencyBanner />
      <Text style={styles.note}>
        Clinical wording in this template is DRAFT pending clinical approval. It does not tell you
        to start, stop or change a medicine on your own.
      </Text>
      {(sections ?? []).map((section) => (
        <View key={section.title} style={styles.card}>
          <Text accessibilityRole="header" style={styles.section}>
            {section.title}
          </Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#10242b', marginBottom: 16 },
  note: { fontSize: 18, lineHeight: 26, marginBottom: 12, color: '#10242b' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d9d3c7',
  },
  section: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: '#10242b' },
  body: { fontSize: 18, lineHeight: 26, color: '#10242b' },
});
