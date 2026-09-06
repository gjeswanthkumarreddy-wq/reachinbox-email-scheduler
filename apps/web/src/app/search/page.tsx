'use client';
import { useState } from 'react';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ErrorMessage } from '@/components/ErrorMessage';
import { api } from '@/lib/api';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault(); if(!query.trim())return;
    setLoading(true);setError('');setSearched(false);
    try{ const r = await api.emails.search(query); setResults(r as any[]); setSearched(true); }
    catch(err:any){ setError(err.message); }
    finally{ setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar/>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Search Emails</h1>
        <form onSubmit={handleSearch} className="flex gap-3 mb-6">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by recipient, name or subject..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"/>
          <button type="submit" disabled={loading||!query.trim()} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">Search</button>
        </form>
        {error&&<ErrorMessage message={error}/>}
        {loading&&<LoadingSpinner message="Searching..."/>}
        {searched&&!loading&&results.length===0&&<div className="text-center py-12 text-gray-500 text-sm">No results for "<strong>{query}</strong>"</div>}
        {results.length>0&&(
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b text-xs text-gray-500">{results.length} result{results.length!==1?'s':''}</div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Recipient','Subject','Status','Sent At'].map(h=><th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {results.map((j:any,i:number)=>(
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{j.recipientEmail||j.recipient_email}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-xs">{j.subject}</td>
                    <td className="px-4 py-3"><StatusBadge status={j.status||'sent'}/></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{j.sentAt?new Date(j.sentAt).toLocaleString():'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!searched&&!loading&&<div className="text-center py-16 text-gray-400 text-sm">Powered by Elasticsearch — searches recipient email, name, and subject</div>}
      </div>
    </div>
  );
}
