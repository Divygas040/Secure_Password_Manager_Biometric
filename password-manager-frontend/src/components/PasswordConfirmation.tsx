"use client";
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, ApiError, formError } from '@/lib/api';
import { runPasswordConfirmation, validateCurrentPassword } from '@/lib/enrollment';
import FieldFeedback from '@/components/FieldFeedback';

export default function PasswordConfirmation({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current) return;
    const invalid = validateCurrentPassword(password);
    setError(invalid || '');
    if (invalid) return;
    setBusy(true);
    try {
      const confirmed = await runPasswordConfirmation(password, pending,
        value => api('/api/users/confirm-password/', { method: 'POST', body: JSON.stringify({ password: value }) }),
        () => setPassword(''));
      if (confirmed) onSuccess();
    } catch (error) {
      const result = formError(error, ['password']);
      if (error instanceof ApiError && error.status === 400) setError(result.fields.password || result.message);
      else if (result.message) toast.error(result.message);
    } finally { setBusy(false); }
  };
  return <form noValidate onSubmit={submit} className="space-y-4 p-6 bg-gray-800 rounded-lg border border-gray-700">
    <p id="confirmation-help">Confirm your current password to set up face verification. Authorization lasts five minutes and is used once.</p>
    <label htmlFor="current-password" className="block">Current Password</label>
    <input id="current-password" type="password" autoComplete="current-password" required minLength={1} maxLength={128}
      value={password} onChange={event => setPassword(event.target.value)} disabled={busy}
      className="input-modern" aria-invalid={Boolean(error)} aria-describedby="confirmation-help confirmation-error" />
    <FieldFeedback id="confirmation-error" error={error} />
    <button type="submit" disabled={busy} className="btn-modern btn-primary">{busy ? 'Confirming…' : 'Confirm password'}</button>
  </form>;
}
