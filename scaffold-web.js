const fs = require('fs');
const path = require('path');
const r = 'C:/Users/user/OneDrive/Desktop/reachinbox-email-scheduler/reachinbox-email-scheduler';
function w(p, s) {
  const full = path.join(r, p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s.trim() + '\n', 'utf8');
  console.log('wrote', p);
}
const Q = '`';
const DQ = '"';

// ── StatusBadge ──────────────────────────────────────────────────────────────
w('apps/web/src/components/StatusBadge.tsx', `
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    running: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-green-100 text-green-700',
    paused: 'bg-orange-100 text-orange-700',
    cancelled: 'bg-red-100 text-red-700',
    failed: 'bg-red-100 text-red-700',
    sent: 'bg-green-100 text-green-700',
    queued: 'bg-blue-100 text-blue-700',
    rate_limited: 'bg-orange-100 text-orange-700',
    processing: 'bg-purple-100 text-purple-700',
    pending: 'bg-gray-100 text-gray-600',
  };
  const cls = map[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={${Q}inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${Q}{cls}${Q}${Q}}>
      {status.replace('_', ' ')}
    </span>
  );
}
`);