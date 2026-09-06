'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { api } from '@/lib/api';

export default function ScheduleCampaign() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [file, setFile] = useState<File|null>(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(()=>{
    api.campaigns.get(id).then(setCampaign).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[id]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if(!f)return;
    setFile(f);setPreview(null);setError('');setSuccess('');setPreviewing(true);
    try{ const p = await api.campaigns.uploadPreview(id,f); setPreview(p); }
    catch(err:any){ setError(err.message); }
    finally{ setPreviewing(false); }
  }

  async function handleSchedule() {
    if(!file)return;
    if(!confirm('Schedule ' + (preview?.valid?.length||0) + ' emails? This cannot be undone.'))return;
    setScheduling(true);setError('');
    try{
      const r = await api.campaigns.schedule(id,file);
      setSuccess('Scheduled ' + r.enqueued + ' emails!');
      setCampaign((c:any)=>c?{...c,status:'scheduled',recipient_count:r.enqueued}:c);
    }catch(err:any){setError(err.message);}
    finally{setScheduling(false);}
  }

  if(loading) return <div className="min-h-screen bg-gray-50"><Navbar/><LoadingSpinner/></div>;
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar/>
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Upload Recipients</h1>
            {campaign && <StatusBadge status={campaign.status}/>}
          </div>
          {campaign && <p className="text-gray-500 text-sm">{campaign.name} · {campaign.subject}</p>}
        </div>
        {error&&<div className="mb-4"><ErrorMessage message={error}/></div>}
        {success&&<div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">{success}</div>}
        {campaign?.status==='draft'?(
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">CSV File</label>
              <p className="text-xs text-gray-500 mb-3">Required column: <code>email</code>. Optional: <code>name</code>. First row must be headers.</p>
              <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile}
                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            </div>
            {previewing&&<LoadingSpinner message="Parsing CSV..."/>}
            {preview&&(
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[{l:'Valid',v:preview.valid.length,c:'green'},{l:'Invalid',v:preview.invalid.length,c:'red'},{l:'Duplicates',v:preview.duplicates.length,c:'yellow'}].map(s=>(
                    <div key={s.l} className={'bg-'+s.c+'-50 rounded-lg p-3 text-center border border-'+s.c+'-200'}>
                      <div className={'text-xl font-bold text-'+s.c+'-700'}>{s.v}</div>
                      <div className={'text-xs text-'+s.c+'-600'}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {preview.valid.length>0&&(
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">Preview (first 5)</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Email</th><th className="px-3 py-2 text-left">Name</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">
                          {preview.valid.slice(0,5).map((r:any)=>(
                            <tr key={r.email}><td className="px-3 py-1.5">{r.email}</td><td className="px-3 py-1.5 text-gray-500">{r.name||'—'}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {preview.invalid.length>0&&(
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-600 font-medium">{preview.invalid.length} invalid rows</summary>
                    <ul className="mt-2 space-y-1 text-gray-600">{preview.invalid.slice(0,10).map((r:any)=>(<li key={r.row}>Row {r.row}: {r.value||'(empty)'} — {r.reason}</li>))}</ul>
                  </details>
                )}
                {preview.valid.length>0&&(
                  <button onClick={handleSchedule} disabled={scheduling}
                    className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                    {scheduling?'Scheduling...':'Schedule ' + preview.valid.length.toLocaleString() + ' Emails'}
                  </button>
                )}
              </div>
            )}
          </div>
        ):(
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center text-gray-500">
            <p className="text-sm">Campaign is <strong>{campaign?.status}</strong> with <strong>{campaign?.recipient_count||0}</strong> recipients.</p>
            <button onClick={()=>router.push('/dashboard')} className="mt-4 text-blue-600 text-sm hover:underline">← Back to Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
