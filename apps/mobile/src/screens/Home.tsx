import { Linking, StyleSheet, Text, View } from 'react-native';
import { APP_NAME } from '../config';
import { appointmentLine, homeActions, type WebsiteLink } from '../model';
import { BigButton, EmergencyBanner } from '../ui';

export function HomeScreen({
  status,
  orderId,
  siteUrl,
  appointment,
  onReport,
  onMessages,
  onDocuments,
  onSignOut,
}: {
  status: string | null;
  orderId: string | null;
  siteUrl: string;
  appointment: { startsAt: string | null; method: string | null; status: string | null };
  onReport: () => void;
  onMessages: () => void;
  onDocuments: () => void;
  onSignOut: () => void;
}) {
  const known = isKnownStatus(status) ? status : null;
  const view = homeActions({
    siteUrl,
    orderId,
    status: known,
    hasAppointment: Boolean(appointment.startsAt),
  });

  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        {APP_NAME}
      </Text>
      <EmergencyBanner />
      <Text style={styles.section}>Your review</Text>
      <Text style={styles.body}>{view.summary}</Text>
      {view.actions.map((action) => (
        <View key={action.id} style={styles.card}>
          <Text style={styles.cardTitle}>{action.label}</Text>
          <Text style={styles.body}>{action.detail}</Text>
        </View>
      ))}
      <Text style={styles.section}>Appointment</Text>
      <Text style={styles.body}>{appointmentLine(appointment)}</Text>
      {known === 'report_released' ? (
        <BigButton label="Read your report" onPress={onReport} />
      ) : null}
      {known && view.actions.some((action) => action.id === 'messages') ? (
        <BigButton label="Messages" onPress={onMessages} />
      ) : null}
      {known && view.actions.some((action) => action.id === 'documents') ? (
        <BigButton label="Add a document" onPress={onDocuments} />
      ) : null}
      {view.links.map((link) => (
        <WebsiteButton key={link.url} link={link} />
      ))}
      <BigButton label="Sign out" onPress={onSignOut} />
    </View>
  );
}

function WebsiteButton({ link }: { link: WebsiteLink }) {
  return <BigButton label={link.label} onPress={() => void Linking.openURL(link.url)} />;
}

function isKnownStatus(
  status: string | null,
): status is NonNullable<Parameters<typeof homeActions>[0]['status']> {
  return (
    status === 'draft' ||
    status === 'safety_emergency_excluded' ||
    status === 'safety_urgent_hold' ||
    status === 'intake' ||
    status === 'questionnaire_submitted' ||
    status === 'awaiting_payment' ||
    status === 'paid' ||
    status === 'consultation_booked' ||
    status === 'in_review' ||
    status === 'report_released' ||
    status === 'declined' ||
    status === 'cancelled' ||
    status === 'refunded' ||
    status === 'completed'
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#10242b', marginBottom: 16 },
  section: { fontSize: 22, fontWeight: '700', marginTop: 8, marginBottom: 8, color: '#10242b' },
  body: { fontSize: 18, lineHeight: 26, color: '#10242b' },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d9d3c7',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4, color: '#10242b' },
});
