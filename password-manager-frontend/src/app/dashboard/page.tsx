"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import OTPAuth from '@/components/OTPAuth';
import FaceVerification from '@/components/FaceID';

export default function DashboardPage() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [enrolling, setEnrolling] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  useEffect(() => { if (!loading && !user) router.replace('/auth/login'); }, [loading, user, router]);
  if (!user) return <p className="p-8">Checking session…</p>;
  return <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
    <header className="bg-gray-800 shadow-md p-4 flex justify-between items-center"><h1 className="text-2xl font-bold">Biopass Password Manager</h1>
      <button className="btn-modern bg-red-600" onClick={async () => { try { await logout(); router.replace('/auth/login'); } catch { toast.error('Logout failed. Please retry.'); } }}>Logout</button>
    </header>
    <main className="max-w-4xl mx-auto px-4 py-12"><div className="glass-card p-8 space-y-6">
      <h2 className="text-3xl font-bold">Welcome, {user.username}</h2>
      <div className="flex flex-wrap gap-4"><Link href="/password/show" className="btn-modern btn-primary">Unlock vault</Link><Link href="/password/add" className="btn-modern btn-outline">Add password</Link></div>
      <p className="text-gray-400">Face verification: {user.face_enrolled ? 'enrolled' : 'not enrolled'}. Email verification is always available.</p>
      <button className="btn-modern bg-gray-700" onClick={() => { setEnrolling(!enrolling); setEmailVerified(false); }}>{enrolling ? 'Cancel enrollment' : user.face_enrolled ? 'Replace face enrollment' : 'Set up face verification'}</button>
      {enrolling && <div className="space-y-6"><p>Verify your email before enrolling or replacing your face template.</p>
        {!emailVerified ? <OTPAuth onSuccess={() => setEmailVerified(true)} /> : <FaceVerification enroll onSuccess={() => { setEnrolling(false); setEmailVerified(false); void refreshUser(); }} />}
      </div>}
    </div></main>
  </div>;
}
