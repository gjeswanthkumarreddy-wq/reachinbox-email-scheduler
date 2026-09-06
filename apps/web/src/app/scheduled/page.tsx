'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessage } from '@/components/ErrorMessage';
import { api } from '@/lib/api';

export default function ScheduledPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=>{ api.me().catch(()=>router.push('/login')); },[router]);

  useEffect(()=>{
    setLoading(true);
    api.emails.scheduled(page).then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[page]);

  const totalPages = data ? Math.ceil(data.total/data.limit) : 0;
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar/>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Emails</h1>
          {data&&<span className="text-sm text-gray-500">{data.total.toLocaleString()} total</span>}
        </div>
        {error&&<ErrorMessage message={error}/>}
        {loading?<LoadingSpinner/>:data?.jobs?.length===0?<EmptyState title="No scheduled emails" message="Schedule a campaign to see pending emails here."/>:(
          <>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Recipient','Campaign','Status','#','Scheduled At'].map(h=><th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.jobs?.map((j:any)=>(
                    <tr key={j.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium">{j.recipient_email}</div>{j.recipient_name&&<div className="text-xs text-gray-500">{j.recipient_name}</div>}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{j.campaign_name||j.campaign_id?.slice(0,8)}</td>
                      <td className="px-4 py-3"><StatusBadge status={j.status}/></td>
                      <td className="px-4 py-3 text-gray-500">{j.sequence_index+1}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{j.scheduled_at?new Date(j.scheduled_at).toLocaleString():'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages>1&&<div className="flex justify-center gap-2 mt-4">
              <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="px-3 py-1 text-sm border rounded disabled:opacity-40">← Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
              <button onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page===totalPages} className="px-3 py-1 text-sm border rounded disabled:opacity-40">Next →</button>
            </div>}
          </>
        )}
      </div>
    </div>
  );
}
