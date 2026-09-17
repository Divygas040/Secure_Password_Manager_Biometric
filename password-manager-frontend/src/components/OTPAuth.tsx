"use client";
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, ApiError, formError } from '@/lib/api';
import { normalizeOTP, validOTP } from '@/lib/validation';
import FieldFeedback from '@/components/FieldFeedback';

export default function OTPAuth({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [verifyAt, setVerifyAt] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!resendAt && !verifyAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [resendAt, verifyAt]);
  const resendWait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const verifyWait = Math.max(0, Math.ceil((verifyAt - now) / 1000));
  const send = async () => {
    if (submitting.current || Date.now() < resendAt) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      await api('/api/users/send-otp-email/', { method: 'POST' });
      setSent(true); setCode(''); setNow(Date.now()); setResendAt(Date.now() + 60_000);
      toast.success('Code sent to your email.');
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        setNow(Date.now()); setResendAt(Date.now() + (error.retryAfter ?? 60) * 1000); setSent(true);
      }
      toast.error(formError(error, []).message);
    } finally { submitting.current = false; setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || Date.now() < verifyAt) return;
    if (!validOTP(code)) { setError('Enter exactly 6 digits.'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      await api('/api/users/verify-otp/', { method: 'POST', body: JSON.stringify({ otp: code }) });
      setCode(''); onSuccess();
    } catch (error) {
      const result = formError(error, ['otp']);
      if (error instanceof ApiError && error.status === 400) setError(result.fields.otp || result.message);
      else {
        if (error instanceof ApiError && error.status === 429) {
          setNow(Date.now()); setVerifyAt(Date.now() + (error.retryAfter ?? 60) * 1000);
        }
        if (result.message) toast.error(result.message);
      }
    } finally { submitting.current = false; setBusy(false); }
  };
  return <section className="space-y-4 p-6 bg-gray-800 rounded-lg border border-gray-700">
    <h3 className="text-xl font-semibold">Email verification</h3>
    <p id="otp-help" className="text-gray-400">Enter the 6-digit code. It expires in 5 minutes.</p>
    <button type="button" disabled={busy || resendWait > 0} className="btn-modern btn-primary" onClick={send}>{resendWait > 0 ? `Resend in ${resendWait}s` : sent ? 'Resend code' : 'Send email code'}</button>
    {sent && <form noValidate onSubmit={verify} className="space-y-3">
      <label htmlFor="otp">Verification code</label>
      <input id="otp" className="input-modern" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} aria-invalid={Boolean(error)} aria-describedby="otp-help otp-feedback" onChange={e => { setCode(normalizeOTP(e.target.value)); setError(''); }} />
      <FieldFeedback id="otp-feedback" error={error} />
      <button disabled={busy || !validOTP(code) || verifyWait > 0} className="btn-modern btn-primary">{verifyWait > 0 ? `Try again in ${verifyWait}s` : 'Verify code'}</button>
    </form>}
  </section>;
}
