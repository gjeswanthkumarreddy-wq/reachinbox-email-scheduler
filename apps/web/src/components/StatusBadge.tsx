export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700', scheduled: 'bg-blue-100 text-blue-700',
    running: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700',
    paused: 'bg-orange-100 text-orange-700', cancelled: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700', sent: 'bg-green-100 text-green-700',
    queued: 'bg-blue-100 text-blue-700', rate_limited: 'bg-orange-100 text-orange-700',
    processing: 'bg-purple-100 text-purple-700', pending: 'bg-gray-100 text-gray-600',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-600';
  return <span className={'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ' + cls}>{status.replace('_',' ')}</span>;
}
