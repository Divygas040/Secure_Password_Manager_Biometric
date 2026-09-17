"use client";
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, ApiError, formError } from '@/lib/api';
import { validateFaceImage } from '@/lib/validation';
import FieldFeedback from '@/components/FieldFeedback';

export default function FaceVerification({ enroll = false, onSuccess }: { enroll?: boolean; onSuccess: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const submitting = useRef(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const stop = () => {
    generation.current += 1;
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setOpen(false);
  };
  useEffect(() => {
    const stopHidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', stopHidden);
    return () => {
      document.removeEventListener('visibilitychange', stopHidden);
      generation.current += 1;
      stream.current?.getTracks().forEach(track => track.stop());
    };
  }, []);
  const start = async () => {
    if (submitting.current) return;
    submitting.current = true; setError('');
    const current = ++generation.current;
    setBusy(true);
    try {
      const capture = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      if (current !== generation.current) { capture.getTracks().forEach(track => track.stop()); return; }
      stream.current = capture;
      setOpen(true);
      if (video.current) { video.current.srcObject = capture; await video.current.play(); }
    } catch { stop(); toast.error('Camera unavailable. Use email verification.'); }
    finally { submitting.current = false; setBusy(false); }
  };
  const submit = async () => {
    if (submitting.current || !video.current?.videoWidth) return;
    submitting.current = true; setError('');
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
      canvas.getContext('2d')?.drawImage(video.current, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      stop();
      if (!blob) { setError('Capture failed. Please try again.'); return; }
      const imageError = validateFaceImage(blob);
      if (imageError) { setError(imageError); return; }
      const body = new FormData(); body.append('image', blob, 'capture.jpg');
      await api(enroll ? '/api/users/image-upload/' : '/api/users/verify-face/', { method: 'POST', body });
      onSuccess(); toast.success(enroll ? 'Face verification enrolled.' : 'Face verified.');
    } catch (error) {
      const result = formError(error, ['image']);
      if (error instanceof ApiError && error.status === 400) setError(result.fields.image || result.message);
      else if (result.message) toast.error(result.message);
    }
    finally { stop(); submitting.current = false; setBusy(false); }
  };
  return <section className="space-y-4 p-6 bg-gray-800 rounded-lg border border-gray-700">
    <h3 className="text-xl font-semibold">{enroll ? 'Enroll face verification' : 'Face verification'}</h3>
    <p className="text-gray-400">Camera-based demo verification has no liveness detection. It is not Apple Face ID or a passkey. Captures are processed on the server and discarded.</p>
    <p id="face-help" className="text-gray-400">Keep one clear face visible. JPEG or PNG captures only, up to 2 MB and 4 million pixels.</p>
    <FieldFeedback id="face-feedback" error={error} />
    <video aria-describedby="face-help face-feedback" ref={video} muted autoPlay playsInline hidden={!open} className="w-full max-w-md rounded-lg" />
    {!open ? <button disabled={busy} onClick={start} className="btn-modern btn-primary">Start camera</button> : <div className="flex gap-3">
      <button disabled={busy} onClick={submit} className="btn-modern btn-primary">Capture and {enroll ? 'enroll' : 'verify'}</button>
      <button onClick={stop} className="btn-modern bg-gray-700">Cancel</button>
    </div>}
  </section>;
}
