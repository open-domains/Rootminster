import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Globe, GitPullRequest, CheckCircle, XCircle, Plus, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import StatsCard from '@/components/StatsCard';
import StatusBadge from '@/components/StatusBadge';
import PageHeader from '@/components/PageHeader';
import RequestModal from '@/components/RequestModal';
import { format } from 'date-fns';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [ownedRecords, setOwnedRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const u = await rootminster.auth.me();
      setUser(u);
      const [records, reqs] = await Promise.all([
        rootminster.entities.DnsRecord.filter({ owner_email: u.email }),
        rootminster.entities.SubdomainRequest.filter({ requester_email: u.email })
      ]);
      setOwnedRecords(records);
      setRequests(reqs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const pending = requests.filter(r => r.status === 'pending').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;
  const recent = [...requests].sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back${user?.full_name ? ', ' + user.full_name.split(' ')[0] : ''}`}
        description="Manage your subdomains and track your requests"
        action={
          <Button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <Plus size={16} /> Request Subdomain
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard title="Owned Subdomains" value={ownedRecords.length} icon={Globe} color="indigo" />
        <StatsCard title="Pending Requests" value={pending} icon={GitPullRequest} color="amber" />
        <StatsCard title="Approved" value={approved} icon={CheckCircle} color="emerald" />
        <StatsCard title="Rejected" value={rejected} icon={XCircle} color="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <h2 className="text-white font-semibold text-sm">Recent Requests</h2>
            <Link to="/my-requests" className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-700/30">
            {recent.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-500 text-sm">No requests yet</p>
                <Button onClick={() => setShowModal(true)} variant="link" className="text-indigo-400 text-xs mt-1 p-0 h-auto">
                  Request your first subdomain →
                </Button>
              </div>
            ) : recent.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{r.subdomain}.{r.root_domain}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{r.record_type} · {format(new Date(r.created_date), 'MMM d, yyyy')}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Owned Subdomains */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-700/50">
            <h2 className="text-white font-semibold text-sm">My Subdomains</h2>
            <Link to="/my-subdomains" className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="divide-y divide-slate-700/30">
            {ownedRecords.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-slate-500 text-sm">No owned subdomains yet</p>
                <p className="text-slate-600 text-xs mt-1">Approved requests will appear here</p>
              </div>
            ) : ownedRecords.slice(0, 5).map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium font-mono">{r.name}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{r.record_type} → {r.content}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <RequestModal open={showModal} onClose={() => setShowModal(false)} onSuccess={load} />
    </div>
  );
}