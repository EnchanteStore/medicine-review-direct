import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { APP_NAME } from '../config';
import { BigButton, EmergencyBanner } from '../ui';

export function SignInScreen({
  onSubmit,
}: {
  onSubmit: (email: string, password: string) => Promise<string | null>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <View>
      <Text accessibilityRole="header" style={styles.title}>
        {APP_NAME}
      </Text>
      <EmergencyBanner />
      <Text style={styles.lead}>
        Sign in to see a review that has already been started on the website.
      </Text>
      <Text style={styles.label}>Email address</Text>
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        accessibilityLabel="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <BigButton
        label="Sign in"
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setError(null);
          void onSubmit(email.trim(), password).then((message) => {
            setError(message);
            setBusy(false);
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: '#10242b', marginBottom: 16 },
  lead: { fontSize: 18, lineHeight: 26, color: '#10242b', marginBottom: 16 },
  label: { fontSize: 18, fontWeight: '700', marginTop: 8, color: '#10242b' },
  input: {
    minHeight: 48,
    borderWidth: 2,
    borderColor: '#24343a',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 18,
    backgroundColor: '#ffffff',
    marginTop: 4,
  },
  error: { color: '#9b1c1c', fontSize: 18, marginTop: 12 },
});
