"use client";
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';

export default function FaceVerification({ enroll = false, onSuccess }: { enroll?: boolean; onSuccess: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
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
    const current = ++generation.current;
    setBusy(true);
    try {
      const capture = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false });
      if (current !== generation.current) { capture.getTracks().forEach(track => track.stop()); return; }
      stream.current = capture;
      setOpen(true);
      if (video.current) { video.current.srcObject = capture; await video.current.play(); }
    } catch { stop(); toast.error('Camera unavailable. Use email verification.'); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    if (!video.current?.videoWidth) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
      canvas.getContext('2d')?.drawImage(video.current, 0, 0);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      stop();
      if (!blob) throw new Error('Capture failed.');
      const body = new FormData(); body.append('image', blob, 'capture.jpg');
      await api(enroll ? '/api/users/image-upload/' : '/api/users/verify-face/', { method: 'POST', body });
      onSuccess(); toast.success(enroll ? 'Face verification enrolled.' : 'Face verified.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Face verification failed.'); }
    finally { stop(); setBusy(false); }
  };
  return <section className="space-y-4 p-6 bg-gray-800 rounded-lg border border-gray-700">
    <h3 className="text-xl font-semibold">{enroll ? 'Enroll face verification' : 'Face verification'}</h3>
    <p className="text-gray-400">Camera-based demo verification has no liveness detection. It is not Apple Face ID or a passkey. Captures are processed on the server and discarded.</p>
    <video ref={video} muted autoPlay playsInline hidden={!open} className="w-full max-w-md rounded-lg" />
    {!open ? <button disabled={busy} onClick={start} className="btn-modern btn-primary">Start camera</button> : <div className="flex gap-3">
      <button disabled={busy} onClick={submit} className="btn-modern btn-primary">Capture and {enroll ? 'enroll' : 'verify'}</button>
      <button onClick={stop} className="btn-modern bg-gray-700">Cancel</button>
    </div>}
  </section>;
}
