'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { ErrorMessage } from '@/components/ErrorMessage';
import { api } from '@/lib/api';

export default function NewCampaign() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name:'', subject:'', body:'', fromName:'', fromEmail:'',
    delaySeconds:60, hourlyLimit:100,
    scheduledStart: new Date(Date.now()+60000).toISOString().slice(0,16),
  });

  function handle(e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) {
    const {name,value,type} = e.target;
    setForm(f=>({...f,[name]:type==='number'?Number(value):value}));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const c = await api.campaigns.create({...form, scheduledStart: new Date(form.scheduledStart).toISOString()});
      router.push('/campaigns/' + c.id + '/schedule');
    } catch(err:any){ setError(err.message); }
    finally{ setLoading(false); }
  }

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400";
  const lbl = "block text-sm font-medium text-gray-700 mb-1";
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Campaign</h1>
        {error && <div className="mb-4"><ErrorMessage message={error}/></div>}
        <form onSubmit={onSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div><label className={lbl}>Campaign Name *</label><input name="name" value={form.name} onChange={handle} required className={inp} placeholder="Q3 Newsletter"/></div>
          <div><label className={lbl}>From Name *</label><input name="fromName" value={form.fromName} onChange={handle} required className={inp} placeholder="Acme Corp"/></div>
          <div><label className={lbl}>From Email *</label><input name="fromEmail" type="email" value={form.fromEmail} onChange={handle} required className={inp} placeholder="hello@acme.com"/></div>
          <div><label className={lbl}>Subject *</label><input name="subject" value={form.subject} onChange={handle} required className={inp} placeholder="Your monthly update"/></div>
          <div><label className={lbl}>Email Body (HTML) *</label><textarea name="body" value={form.body} onChange={handle} required rows={6} className={inp+' resize-y font-mono'} placeholder="<p>Hello,</p>"/></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Delay Between Emails (s)</label>
              <input name="delaySeconds" type="number" min={0} value={form.delaySeconds} onChange={handle} className={inp}/>
              <p className="text-xs text-gray-400 mt-1">Seconds between individual sends</p>
            </div>
            <div>
              <label className={lbl}>Hourly Limit</label>
              <input name="hourlyLimit" type="number" min={1} value={form.hourlyLimit} onChange={handle} className={inp}/>
              <p className="text-xs text-gray-400 mt-1">Max emails per clock-hour</p>
            </div>
          </div>
          <div><label className={lbl}>Scheduled Start *</label><input name="scheduledStart" type="datetime-local" value={form.scheduledStart} onChange={handle} required className={inp}/></div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {loading?'Creating...':'Create Campaign & Upload Recipients →'}
          </button>
        </form>
      </div>
    </div>
  );
}
