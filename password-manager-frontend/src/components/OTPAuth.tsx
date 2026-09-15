"use client";
import { useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function OTPAuth({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const send = async () => {
    if (Date.now() < resendAt) { toast.error('Wait a minute before resending.'); return; }
    setBusy(true);
    try {
      await api('/api/users/send-otp-email/', { method: 'POST' });
      setSent(true); setResendAt(Date.now() + 60_000);
      toast.success('Code sent to your email.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Email unavailable.'); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true);
    try {
      await api('/api/users/verify-otp/', { method: 'POST', body: JSON.stringify({ otp: code }) });
      setCode(''); onSuccess();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Verification failed.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 p-6 bg-gray-800 rounded-lg border border-gray-700">
    <h3 className="text-xl font-semibold">Email verification</h3>
    <p className="text-gray-400">Use the six-digit email code. It expires in five minutes and works once.</p>
    <button type="button" disabled={busy} className="btn-modern btn-primary" onClick={send}>{sent ? 'Resend code' : 'Send email code'}</button>
    {sent && <form onSubmit={verify} className="space-y-3">
      <label htmlFor="otp">Verification code</label>
      <input id="otp" className="input-modern" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
      <button disabled={busy} className="btn-modern btn-primary">Verify code</button>
    </form>}
  </section>;
}
