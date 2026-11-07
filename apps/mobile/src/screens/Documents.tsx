import { StyleSheet, Text, View } from 'react-native';
import { BigButton, EmergencyBanner } from '../ui';

export function DocumentsScreen({
  allowed,
  notice,
  onPick,
}: {
  allowed: boolean;
  notice: string | null;
  onPick: () => void;
}) {
  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        Documents
      </Text>
      <EmergencyBanner />
      <Text style={styles.body}>
        This app does not scan files and does not claim that a file is safe. Uploads stay waiting
        for a scanner. A pharmacist cannot see a file until it is marked clean.
      </Text>
      {allowed ? (
        <>
          <Text style={styles.body}>
            You can add a PDF, JPG or PNG while your questionnaire is open.
          </Text>
          <BigButton label="Choose a document" onPress={onPick} />
        </>
      ) : (
        <Text style={styles.body}>
          Documents can only be added while the questionnaire is open, which is the same rule as the
          website. This review is not at that stage.
        </Text>
      )}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#10242b', marginBottom: 16 },
  body: { fontSize: 18, lineHeight: 26, color: '#10242b', marginBottom: 8 },
  notice: { fontSize: 18, lineHeight: 26, marginTop: 12, color: '#10242b' },
});
