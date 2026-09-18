"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import PasswordConfirmation from '@/components/PasswordConfirmation';
import { startEnrollment, advanceEnrollment } from '@/lib/enrollment';
import type { EnrollmentStep } from '@/lib/enrollment';
import FaceVerification from '@/components/FaceID';

export default function DashboardPage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<EnrollmentStep>('closed');
  useEffect(() => { if (!loading && !user) router.replace('/auth/login'); }, [loading, user, router]);
  if (!user) return <p className="p-8">Checking session…</p>;
  return <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
    <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center"><h1 className="text-2xl font-bold">Biopass Password Manager</h1>
      <button className="btn-modern bg-red-600" onClick={async () => { try { await logout(); router.replace('/auth/login'); } catch { toast.error('Logout failed. Please retry.'); } }}>Logout</button>
    </header>
    <main className="max-w-4xl mx-auto px-4 py-12"><div className="glass-card p-8 space-y-6">
      <h2 className="text-3xl font-bold">Welcome, {user.username}</h2>
      <div className="flex flex-wrap gap-4"><Link href="/password/show" className="btn-modern btn-primary">Unlock vault</Link><Link href="/password/add" className="btn-modern btn-outline">Add password</Link></div>
      <p className="text-gray-400">{user.face_enrolled ? 'Face verification is enrolled. Verify your face to unlock the vault.' : 'Set up face verification to unlock your vault.'}</p>
      <button className="btn-modern bg-gray-700" onClick={() => setStep(step === 'closed' ? startEnrollment(user.face_enrolled) : advanceEnrollment(step, 'cancelled'))}>{step !== 'closed' ? 'Cancel enrollment' : user.face_enrolled ? 'Replace face enrollment' : 'Set up face verification'}</button>
      {step !== 'closed' && <div className="space-y-6">
        {step === 'confirm-password' && <PasswordConfirmation onSuccess={() => setStep(current => advanceEnrollment(current, 'password-confirmed'))} />}
        {step === 'verify-current-face' && <><p>Verify your current enrolled face before capturing its replacement.</p><FaceVerification onSuccess={() => setStep(current => advanceEnrollment(current, 'face-verified'))} /></>}
        {step === 'capture' && <><p>Capture your face. After enrollment, verify it again to unlock your vault.</p><FaceVerification enroll onSuccess={() => { setStep(current => advanceEnrollment(current, 'completed')); void refreshUser(); toast.success('Face verification is set up. Verify your face to unlock the vault.'); }} /></>}
      </div>}
    </div></main>
  </div>;
}
