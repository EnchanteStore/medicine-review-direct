import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { MESSAGING_OUT_OF_HOURS_WARNING, formatLondon } from '@mrd/domain';
import { BigButton, EmergencyBanner } from '../ui';

export interface MessageItem {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

export function MessagesScreen({
  open,
  messages,
  onSend,
}: {
  open: boolean;
  messages: MessageItem[];
  onSend: (body: string) => Promise<string | null>;
}) {
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        Messages
      </Text>
      <EmergencyBanner />
      <View accessibilityRole="summary" style={styles.warning}>
        <Text style={styles.body}>{MESSAGING_OUT_OF_HOURS_WARNING}</Text>
      </View>
      {!open ? (
        <Text style={styles.body}>
          Messages are closed for this review. There is no attachment option.
        </Text>
      ) : null}
      {messages.map((message) => (
        <View key={message.id} style={styles.card}>
          <Text style={styles.meta}>
            {message.mine ? 'You' : 'Your pharmacist'} · {formatLondon(new Date(message.createdAt))}
          </Text>
          <Text style={styles.body}>{message.body}</Text>
        </View>
      ))}
      {open ? (
        <>
          <Text style={styles.label}>Message</Text>
          <TextInput
            accessibilityLabel="Message"
            multiline
            value={body}
            onChangeText={setBody}
            style={styles.input}
          />
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <BigButton
            label="Send message"
            onPress={() => {
              const text = body.trim();
              if (!text) return;
              void onSend(text).then((error) => {
                setNotice(error ?? 'Message sent. The email does not include what you wrote.');
                if (!error) setBody('');
              });
            }}
          />
          <Text style={styles.meta}>Attachments are not available.</Text>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#10242b', marginBottom: 16 },
  warning: {
    backgroundColor: '#fff4e5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d9d3c7',
  },
  label: { fontSize: 18, fontWeight: '700', marginTop: 12, color: '#10242b' },
  meta: { fontSize: 16, color: '#3d4c52', marginBottom: 4 },
  body: { fontSize: 18, lineHeight: 26, color: '#10242b' },
  input: {
    minHeight: 96,
    borderWidth: 2,
    borderColor: '#24343a',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    backgroundColor: '#ffffff',
    marginTop: 4,
  },
  notice: { fontSize: 18, marginTop: 8, color: '#10242b' },
});
