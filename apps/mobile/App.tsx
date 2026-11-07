import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { canPatientMessage, canPatientUploadDocument, type OrderStatus } from '@mrd/domain';
import {
  loadMessages,
  loadReport,
  loadReview,
  sendMessage,
  signInWithPassword,
  signOut,
  supabase,
} from './src/api';
import { APP_NAME, publicConfig } from './src/config';
import { logSafe } from './src/log';
import { appointmentLine, reportView, type ReportView } from './src/model';
import { previewHiddenReport, previewReleasedReport } from './src/preview-data';
import { uploadPatientDocument } from './src/upload';
import { DocumentsScreen } from './src/screens/Documents';
import { HomeScreen } from './src/screens/Home';
import { MessagesScreen, type MessageItem } from './src/screens/Messages';
import { ReportScreen } from './src/screens/Report';
import { SignInScreen } from './src/screens/SignIn';
import { BigButton } from './src/ui';

type ScreenName = 'sign-in' | 'home' | 'report' | 'report-hidden' | 'messages' | 'documents';

export default function App() {
  const config = publicConfig();
  if (config.preview) return <PreviewApp />;
  return <LiveApp />;
}

function LiveApp() {
  const config = publicConfig();
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [screen, setScreen] = useState<ScreenName>('home');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [appointment, setAppointment] = useState({
    startsAt: null as string | null,
    method: null as string | null,
    status: null as string | null,
  });
  const [report, setReport] = useState<ReportView>({
    visible: false,
    message: 'Your pharmacist has not released a report. Drafts are not shown here.',
  });
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  async function refresh() {
    const review = await loadReview();
    setOrderId(review.orderId);
    setStatus(review.status);
    setAppointment(review.appointment);
    if (!review.orderId) return;
    const loaded = await loadReport(review.orderId);
    const answers = loaded.questionnaire?.answers;
    const concern =
      answers &&
      typeof answers === 'object' &&
      !Array.isArray(answers) &&
      typeof (answers as { mainConcern?: unknown }).mainConcern === 'string'
        ? (answers as { mainConcern: string }).mainConcern
        : '';
    const medicines = Array.isArray(loaded.questionnaire?.medications)
      ? loaded.questionnaire.medications.flatMap((item) => {
          if (
            !item ||
            typeof item !== 'object' ||
            typeof (item as { name?: unknown }).name !== 'string'
          )
            return [];
          return [(item as { name: string }).name];
        })
      : [];
    setReport(
      reportView({
        status: loaded.report?.status ?? null,
        content: loaded.report?.content ?? null,
        patientName: [loaded.profile?.given_name, loaded.profile?.family_name]
          .filter(Boolean)
          .join(' '),
        dateOfBirth: loaded.profile?.date_of_birth ?? '',
        reviewDate: loaded.consultation?.occurred_at
          ? appointmentLine({
              startsAt: loaded.consultation.occurred_at,
              method: null,
              status: null,
            })
          : '',
        consultationMethod:
          loaded.consultation?.method === 'secure_video'
            ? 'Secure video'
            : loaded.consultation?.method === 'telephone'
              ? 'Telephone'
              : '',
        consultationWhen: loaded.consultation?.occurred_at
          ? appointmentLine({
              startsAt: loaded.consultation.occurred_at,
              method: loaded.consultation.method,
              status: null,
            })
          : '',
        consultationNotes: loaded.consultation?.clinical_notes ?? '',
        pharmacistName: loaded.report?.approver_display_name ?? '',
        gphcNumber: loaded.report?.approver_gphc_number ?? '',
        medicines,
        concerns: concern,
        documentsReviewed: (loaded.documents ?? [])
          .filter((doc) => doc.scan_status === 'clean')
          .map((doc) => doc.original_filename),
      }),
    );
    setMessages(
      (await loadMessages(review.orderId)).map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.createdAt,
        mine: row.mine,
      })),
    );
  }

  useEffect(() => {
    if (!config.configured) {
      setReady(true);
      return;
    }
    void supabase()
      .auth.getSession()
      .then(({ data }) => {
        setSignedIn(Boolean(data.session));
        setReady(true);
      })
      .catch(() => {
        logSafe('session.read_failed');
        setReady(true);
      });
  }, [config.configured]);

  useEffect(() => {
    if (signedIn) void refresh();
  }, [signedIn]);

  if (!config.configured) {
    return (
      <Shell>
        <Text style={styles.title}>{APP_NAME}</Text>
        <Text style={styles.body}>
          The local Supabase address is not set. This app is not connected.
        </Text>
      </Shell>
    );
  }
  if (!ready) {
    return (
      <Shell>
        <Text style={styles.body}>Loading</Text>
      </Shell>
    );
  }
  if (!signedIn) {
    return (
      <Shell testID="screen-sign-in">
        <SignInScreen
          onSubmit={async (email, password) => {
            const error = await signInWithPassword(email, password);
            if (!error) setSignedIn(true);
            return error;
          }}
        />
      </Shell>
    );
  }

  const known = isOrderStatus(status) ? status : null;
  return (
    <Shell testID={`screen-${screen}`}>
      {screen === 'home' ? (
        <HomeScreen
          status={status}
          orderId={orderId}
          siteUrl={config.siteUrl}
          appointment={appointment}
          onReport={() => setScreen('report')}
          onMessages={() => setScreen('messages')}
          onDocuments={() => setScreen('documents')}
          onSignOut={() => {
            void signOut().then(() => setSignedIn(false));
          }}
        />
      ) : null}
      {screen === 'report' ? (
        <ReportScreen
          visible={report.visible}
          message={report.visible ? undefined : report.message}
          sections={report.visible ? report.sections : undefined}
        />
      ) : null}
      {screen === 'messages' && orderId ? (
        <MessagesScreen
          open={known ? canPatientMessage(known) : false}
          messages={messages}
          onSend={async (body) => {
            const error = await sendMessage(orderId, body);
            if (!error)
              setMessages(
                await loadMessages(orderId).then((rows) =>
                  rows.map((row) => ({
                    id: row.id,
                    body: row.body,
                    createdAt: row.createdAt,
                    mine: row.mine,
                  })),
                ),
              );
            return error;
          }}
        />
      ) : null}
      {screen === 'documents' ? (
        <DocumentsScreen
          allowed={known ? canPatientUploadDocument(known) : false}
          notice={uploadNotice}
          onPick={() => {
            if (!orderId) return;
            void pickDocument(orderId).then(setUploadNotice);
          }}
        />
      ) : null}
      {screen !== 'home' ? <BigButton label="Back" onPress={() => setScreen('home')} /> : null}
    </Shell>
  );
}

async function pickDocument(orderId: string): Promise<string> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/jpeg', 'image/png'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets[0]) return 'No file was chosen.';
  const asset = picked.assets[0];
  const response = await fetch(asset.uri);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const { data } = await supabase().auth.getUser();
  const userId = data.user?.id;
  if (!userId) return 'Sign in again before uploading.';
  return uploadPatientDocument({
    orderId,
    userId,
    name: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
    bytes,
  });
}

function PreviewApp() {
  const [screen, setScreen] = useState<ScreenName>('sign-in');
  const released = previewReleasedReport();
  const hidden = previewHiddenReport();
  return (
    <Shell testID={`screen-${screen}`}>
      <Text style={styles.preview}>Layout preview. Synthetic data. Not a patient record.</Text>
      <View style={styles.nav}>
        <BigButton label="Preview sign in" onPress={() => setScreen('sign-in')} />
        <BigButton label="Preview home" onPress={() => setScreen('home')} />
        <BigButton label="Preview report" onPress={() => setScreen('report')} />
        <BigButton label="Preview hidden report" onPress={() => setScreen('report-hidden')} />
        <BigButton label="Preview messages" onPress={() => setScreen('messages')} />
        <BigButton label="Preview documents" onPress={() => setScreen('documents')} />
      </View>
      {screen === 'sign-in' ? (
        <SignInScreen onSubmit={async () => 'This preview does not sign in.'} />
      ) : null}
      {screen === 'home' ? (
        <HomeScreen
          status="report_released"
          orderId="00000000-0000-4000-b000-000000000099"
          siteUrl="http://127.0.0.1:3000"
          appointment={{
            startsAt: '2026-11-12T10:00:00.000Z',
            method: 'telephone',
            status: 'booked',
          }}
          onReport={() => setScreen('report')}
          onMessages={() => setScreen('messages')}
          onDocuments={() => setScreen('documents')}
          onSignOut={() => setScreen('sign-in')}
        />
      ) : null}
      {screen === 'report' && released.visible ? (
        <ReportScreen visible sections={released.sections} />
      ) : null}
      {screen === 'report-hidden' && !hidden.visible ? (
        <ReportScreen visible={false} message={hidden.message} />
      ) : null}
      {screen === 'messages' ? (
        <MessagesScreen
          open
          messages={[
            {
              id: '1',
              mine: false,
              createdAt: '2026-11-07T10:00:00.000Z',
              body: 'Synthetic message: please read the released report in the app.',
            },
          ]}
          onSend={async () => null}
        />
      ) : null}
      {screen === 'documents' ? (
        <DocumentsScreen
          allowed
          notice="No scanner is connected. This preview does not upload a file."
          onPick={() => undefined}
        />
      ) : null}
    </Shell>
  );
}

function Shell({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <ScrollView contentContainerStyle={styles.page} testID={testID}>
      <StatusBar style="dark" />
      {children}
    </ScrollView>
  );
}

function isOrderStatus(value: string | null): value is OrderStatus {
  return (
    value === 'draft' ||
    value === 'safety_emergency_excluded' ||
    value === 'safety_urgent_hold' ||
    value === 'intake' ||
    value === 'questionnaire_submitted' ||
    value === 'awaiting_payment' ||
    value === 'paid' ||
    value === 'consultation_booked' ||
    value === 'in_review' ||
    value === 'report_released' ||
    value === 'completed' ||
    value === 'declined' ||
    value === 'cancelled' ||
    value === 'refunded'
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, backgroundColor: '#faf8f4' },
  title: { fontSize: 28, fontWeight: '700', color: '#10242b', marginBottom: 12 },
  body: { fontSize: 18, lineHeight: 26, color: '#10242b' },
  preview: {
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: '#e7f3f3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    color: '#10242b',
  },
  nav: { marginBottom: 12 },
});
