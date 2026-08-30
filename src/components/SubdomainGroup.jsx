import { useState } from 'react';
import { ChevronDown, ChevronRight, Edit, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { format } from 'date-fns';

function DnsVerifiedBadge({ record }) {
  if (record.dns_verified === true) {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-xs" title="DNS verified">
        <CheckCircle2 size={12} /> Verified
      </span>
    );
  }
  if (record.dns_verified === false) {
    return (
      <span className="flex items-center gap-1 text-red-400 text-xs" title={record.dns_mismatch_reason || 'DNS mismatch'}>
        <AlertTriangle size={12} /> Mismatch
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-slate-500 text-xs">
      <HelpCircle size={12} /> Unchecked
    </span>
  );
}

export default function SubdomainGroup({ subdomain, records, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  const hasMismatch = records.some(r => r.dns_verified === false);
  const allVerified = records.length > 0 && records.every(r => r.dns_verified === true);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      {/* Group header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors text-left"
      >
        {expanded ? <ChevronDown size={15} className="text-slate-400 shrink-0" /> : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
        <span className="font-mono text-indigo-400 font-semibold text-sm flex-1">{subdomain}</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">{records.length} record{records.length !== 1 ? 's' : ''}</span>
          {hasMismatch && (
            <span className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> DNS issue
            </span>
          )}
          {allVerified && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={10} /> All verified
            </span>
          )}
        </div>
      </button>

      {/* Records list */}
      {expanded && (
        <div className="border-t border-slate-700/50 divide-y divide-slate-700/30">
          {records.map(record => (
            <div key={record.id} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="font-mono text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300 shrink-0">{record.record_type}</span>
              <span className="font-mono text-xs text-slate-300 truncate max-w-[200px] flex-1">{record.content}</span>
              <div className="flex items-center gap-3 ml-auto shrink-0">
                <span className={record.proxied ? 'text-orange-400 text-xs' : 'text-slate-500 text-xs'}>
                  {record.proxied ? '☁ Proxied' : '○ Direct'}
                </span>
                <span className="text-slate-400 text-xs">{record.ttl}s</span>
                <StatusBadge status={record.status} />
                <DnsVerifiedBadge record={record} />
                {record.dns_last_checked && (
                  <span className="text-slate-600 text-xs hidden sm:inline">
                    checked {format(new Date(record.dns_last_checked), 'MMM d')}
                  </span>
                )}
                <Button size="sm" variant="ghost" onClick={() => onEdit(record, records)}
                  className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 text-xs gap-1">
                  <Edit size={12} /> Edit
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}