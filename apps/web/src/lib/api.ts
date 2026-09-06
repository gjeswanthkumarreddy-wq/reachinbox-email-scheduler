const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'HTTP ' + res.status);
  }
  return res.json() as Promise<T>;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(API + path, { method: 'POST', credentials: 'include', body: formData });
  if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || 'HTTP ' + res.status); }
  return res.json() as Promise<T>;
}

export const api = {
  me: () => req<{name: string, email: string, avatar_url: string}>('/api/auth/me'),
  logout: () => req<{success: boolean}>('/api/auth/logout', { method: 'POST' }),
  campaigns: {
    list: () => req<any[]>('/api/campaigns'),
    get: (id: string) => req<any>('/api/campaigns/' + id),
    create: (data: any) => req<any>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    pause: (id: string) => req<any>('/api/campaigns/' + id + '/pause', { method: 'PATCH' }),
    resume: (id: string) => req<any>('/api/campaigns/' + id + '/resume', { method: 'PATCH' }),
    cancel: (id: string) => req<any>('/api/campaigns/' + id + '/cancel', { method: 'PATCH' }),
    uploadPreview: (id: string, file: File) => { const fd = new FormData(); fd.append('file', file); return upload<any>('/api/campaigns/' + id + '/upload', fd); },
    schedule: (id: string, file: File) => { const fd = new FormData(); fd.append('file', file); return upload<any>('/api/campaigns/' + id + '/schedule', fd); },
  },
  emails: {
    scheduled: (page=1) => req<any>('/api/emails/scheduled?page=' + page + '&limit=20'),
    sent: (page=1) => req<any>('/api/emails/sent?page=' + page + '&limit=20'),
    search: (q: string) => req<any>('/api/emails/search?q=' + encodeURIComponent(q)),
    stats: () => req<any>('/api/emails/stats'),
  },
};
