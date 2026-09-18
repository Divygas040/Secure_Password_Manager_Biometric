"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { NO_FACE_MESSAGE } from '@/lib/enrollment';
import FaceVerification from '@/components/FaceID';
interface Credential { id: number; domain_name: string; link: string; password: string; }

export default function ShowPasswords() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Credential[] | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const clear = useCallback(() => { setRows(null); setRevealed(null); }, []);
  useEffect(() => { if (!loading && !user) { clear(); router.replace('/auth/login'); } }, [loading, user, router, clear]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) { clear(); void api('/api/users/lock/', { method: 'POST' }).catch(() => {}); } };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, [clear]);
  useEffect(() => {
    if (rows === null) return;
    const timer = setTimeout(clear, 5 * 60_000);
    return () => clearTimeout(timer);
  }, [rows, clear]);
  const load = async () => {
    try { setRows(await api<Credential[]>('/api/users/passwords/')); }
    catch (error) { clear(); toast.error(error instanceof Error ? error.message : 'Vault is locked.'); }
  };
  if (!user) return <p className="p-8">Checking session…</p>;
  return <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
    <header className="bg-gray-800 p-4"><Link href="/dashboard">← Back to Dashboard</Link></header>
    <main className="max-w-4xl mx-auto px-4 py-12"><div className="glass-card p-8 space-y-6">
      <h1 className="text-3xl font-bold">Your vault</h1>
      {rows === null ? <><p className="text-gray-400">Verify to unlock for five minutes. Passwords are hidden when you leave this tab.</p>
        {user.face_enrolled ? <>
          <FaceVerification onSuccess={() => void load()} />
          <button className="btn-modern bg-gray-700" onClick={load}>Open recently unlocked vault</button>
        </> : <><p>{NO_FACE_MESSAGE}</p><Link className="btn-modern btn-primary" href="/dashboard">Set up face verification</Link></>}
      </> : <><div className="flex gap-4"><Link className="btn-modern btn-primary" href="/password/add">Add password</Link>
        <button className="btn-modern bg-gray-700" onClick={async () => { clear(); try { await api('/api/users/lock/', { method: 'POST' }); } catch { toast.error('Server lock failed; local credentials cleared.'); } }}>Lock vault</button></div>
        {rows.length === 0 && <p>No passwords saved yet.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Domain</th><th>Link</th><th>Password</th><th>Actions</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id} className="border-t border-gray-700"><td className="py-4">{row.domain_name}</td><td><a className="text-blue-400" href={/^https?:\/\//i.test(row.link) ? row.link : undefined} target="_blank" rel="noopener noreferrer">Open site</a></td>
            <td className="font-mono break-all">{revealed === row.id ? row.password : '••••••••'}</td>
            <td><button className="px-2" onClick={() => setRevealed(revealed === row.id ? null : row.id)}>{revealed === row.id ? 'Hide' : 'Reveal'}</button>
              <button className="px-2" onClick={async () => { try { await navigator.clipboard.writeText(row.password); toast.success('Copied. Clear your clipboard after use.'); } catch { toast.error('Clipboard unavailable.'); } }}>Copy</button>
              <button className="px-2 text-red-400" onClick={async () => { if (!window.confirm('Delete this saved credential?')) return; try { await api(`/api/users/passwords/${row.id}/`, { method: 'DELETE' }); await load(); } catch { toast.error('Delete failed. Unlock again if needed.'); } }}>Delete</button>
            </td></tr>)}</tbody></table></div>
        <p className="text-sm text-gray-400">Clipboard clearing cannot be guaranteed by browsers. Clear copied passwords manually.</p>
      </>}
    </div></main>
  </div>;
}
