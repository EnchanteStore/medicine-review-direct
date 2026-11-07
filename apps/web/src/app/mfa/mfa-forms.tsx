'use client';

import { Alert, Button, FormField, Input } from '@mrd/ui';
import { useActionState } from 'react';
import { startEnrolmentAction, verifyCodeAction, type MfaState } from './actions';

function CodeForm({
  factorId,
  error,
  action,
}: {
  factorId: string;
  error?: string;
  action: (fd: FormData) => void;
}) {
  return (
    <form action={action} noValidate className="space-y-4">
      <input type="hidden" name="factorId" value={factorId} />
      <FormField id="code" label="6-digit code" errors={error ? [error] : undefined}>
        {(aria) => (
          <Input
            {...aria}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            className="w-40"
          />
        )}
      </FormField>
      <Button type="submit">Verify</Button>
    </form>
  );
}

export function EnrolMfa() {
  const [state, start] = useActionState<MfaState, FormData>(startEnrolmentAction, {
    status: 'idle',
  });
  const [verifyState, verify] = useActionState<MfaState, FormData>(verifyCodeAction, {
    status: 'idle',
  });
  const enrolling = state.status === 'enrolling' ? state : null;
  if (!enrolling) {
    return (
      <form action={start} className="space-y-4">
        {state.status === 'error' ? (
          <Alert tone="danger">
            <p>{state.message}</p>
          </Alert>
        ) : null}
        <Button type="submit">Set up an authenticator app</Button>
      </form>
    );
  }
  const err = verifyState.status === 'error' ? verifyState.message : undefined;
  return (
    <div className="space-y-4">
      <p>Scan this QR code with an authenticator app, then enter the 6-digit code it shows.</p>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URI from Supabase Auth */}
      <img
        src={enrolling.qrCode}
        alt="QR code for your authenticator app"
        width={192}
        height={192}
        className="bg-white p-2"
      />
      <p className="text-sm">
        Or enter this key manually:{' '}
        <code data-testid="mfa-secret" className="break-all font-mono">
          {enrolling.secret}
        </code>
      </p>
      <CodeForm factorId={enrolling.factorId} error={err} action={verify} />
    </div>
  );
}

export function VerifyMfa({ factorId }: { factorId: string }) {
  const [state, verify] = useActionState<MfaState, FormData>(verifyCodeAction, { status: 'idle' });
  return (
    <CodeForm
      factorId={factorId}
      error={state.status === 'error' ? state.message : undefined}
      action={verify}
    />
  );
}
