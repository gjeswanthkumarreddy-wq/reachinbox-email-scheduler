'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { api } from '@/lib/api';

export default function Dashboard() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState<string|null>(null);

  useEffect(() => {
    api.me().catch(() => router.push('/login'));
    Promise.all([api.campaigns.list(), api.emails.stats()])
      .then(([c,s]) => { setCampaigns(c); setStats(s); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  async function act(id: string, action: 'pause'|'resume'|'cancel') {
    setActionId(id);
    try { const u = await api.campaigns[action](id); setCampaigns(cs=>cs.map(c=>c.id===id?u:c)); }
    catch(e:any){alert(e.message);}
    finally{setActionId(null);}
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <Link href="/campaigns/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">+ New Campaign</Link>
        </div>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[
              {l:'Campaigns',v:stats.campaigns.total},{l:'Running',v:stats.campaigns.running},
              {l:'Completed',v:stats.campaigns.completed},{l:'Emails Sent',v:stats.emails.sent},
              {l:'Scheduled',v:stats.emails.queued},{l:'Rate Limited',v:stats.emails.rate_limited},
            ].map(s=>(
              <div key={s.l} className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
                <div className="text-2xl font-bold text-gray-900">{s.v}</div>
                <div className="text-xs text-gray-500 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        )}
        {loading && <LoadingSpinner message="Loading campaigns..." />}
        {error && <ErrorMessage message={error} />}
        {!loading && !error && campaigns.length === 0 && (
          <EmptyState title="No campaigns yet" message="Create your first email campaign."
            action={<Link href="/campaigns/new" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Create Campaign</Link>} />
        )}
        {campaigns.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Campaign','Status','Recipients','Scheduled','Actions'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {campaigns.map((c:any)=>(
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><div className="font-medium text-gray-900">{c.name}</div><div className="text-xs text-gray-500 truncate max-w-xs">{c.subject}</div></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status}/></td>
                    <td className="px-4 py-3">{(c.recipient_count||0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(c.scheduled_start).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {c.status==='draft'&&<Link href={'/campaigns/'+c.id+'/schedule'} className="text-blue-600 hover:underline text-xs">Schedule</Link>}
                        {['scheduled','running'].includes(c.status)&&<button onClick={()=>act(c.id,'pause')} disabled={actionId===c.id} className="text-orange-600 text-xs disabled:opacity-50">Pause</button>}
                        {c.status==='paused'&&<button onClick={()=>act(c.id,'resume')} disabled={actionId===c.id} className="text-green-600 text-xs disabled:opacity-50">Resume</button>}
                        {!['completed','cancelled'].includes(c.status)&&<button onClick={()=>{if(confirm('Cancel?'))act(c.id,'cancel');}} disabled={actionId===c.id} className="text-red-500 text-xs disabled:opacity-50">Cancel</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
