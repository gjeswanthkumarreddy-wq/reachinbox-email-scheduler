'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{name:string;email:string;avatar_url:string}|null>(null);

  useEffect(() => { api.me().then(setUser).catch(() => setUser(null)); }, []);

  const handleLogout = async () => { await api.logout().catch(()=>{}); router.push('/login'); };

  const links = [
    {href:'/dashboard',label:'Dashboard'},{href:'/campaigns/new',label:'New Campaign'},
    {href:'/scheduled',label:'Scheduled'},{href:'/sent',label:'Sent'},{href:'/search',label:'Search'},
  ];

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="font-bold text-blue-600 text-lg">ReachInbox</Link>
        {links.map(l=>(
          <Link key={l.href} href={l.href}
            className={'text-sm font-medium ' + (pathname?.startsWith(l.href)?'text-blue-600':'text-gray-600 hover:text-gray-900')}>
            {l.label}
          </Link>
        ))}
      </div>
      {user && (
        <div className="flex items-center gap-3">
          {user.avatar_url && <img src={user.avatar_url} className="w-7 h-7 rounded-full" alt={user.name} />}
          <span className="text-sm text-gray-700">{user.name||user.email}</span>
          <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 ml-2">Logout</button>
        </div>
      )}
    </nav>
  );
}
