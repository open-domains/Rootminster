import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, CheckCircle, AlertCircle, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminMigrateModal({ open, onClose, onSuccess }) {
  const [githubEmail, setGithubEmail] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [result, setResult] = useState(null);
  const [step, setStep] = useState('form'); // 'form' | 'done'

  useEffect(() => {
    if (open) fetchUsers();
  }, [open]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const res = await rootminster.functions.invoke('adminListUsers', {});
    setUsers(res.data?.users || []);
    setLoadingUsers(false);
  };

  const filteredUsers = userSearch.trim()
    ? users.filter(u =>
        u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  const handleMigrate = async () => {
    if (!githubEmail.trim() || !selectedUser) return;
    setLoading(true);
    const res = await rootminster.functions.invoke('adminMigrateDomains', {
      github_email: githubEmail.trim(),
      target_user_id: selectedUser.id
    });
    const data = res.data;
    if (data.error) {
      toast.error(data.error);
    } else {
      setResult(data);
      setStep('done');
      if (data.imported > 0) onSuccess?.();
    }
    setLoading(false);
  };

  const handleClose = () => {
    setGithubEmail('');
    setUserSearch('');
    setSelectedUser(null);
    setResult(null);
    setStep('form');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto review-modal-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github size={18} className="text-slate-400" />
            Admin: Migrate GitHub Domains
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-5">
            {/* GitHub email */}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">GitHub Registration Email</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={githubEmail}
                onChange={e => setGithubEmail(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-500">Email used in the open-domains/register GitHub repository.</p>
            </div>

            {/* User picker */}
            <div className="space-y-2">
              <Label className="text-slate-300 text-xs">Assign To User</Label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search by name or email…"
                  value={userSearch}
                  onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); }}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 pl-8"
                />
              </div>

              {selectedUser ? (
                <div className="flex items-center justify-between bg-indigo-900/30 border border-indigo-700/40 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-white text-sm font-medium">{selectedUser.full_name || selectedUser.email}</p>
                    <p className="text-indigo-300 text-xs">{selectedUser.email}</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white text-xs">Change</button>
                </div>
              ) : (
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg max-h-48 overflow-y-auto review-modal-scroll divide-y divide-slate-700/30">
                  {loadingUsers ? (
                    <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
                  ) : filteredUsers.length === 0 ? (
                    <p className="text-slate-500 text-xs text-center py-4">No users found</p>
                  ) : filteredUsers.map(u => (
                    <button key={u.id} onClick={() => setSelectedUser(u)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-700/50 transition-colors text-left">
                      <div className="w-6 h-6 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                        {(u.full_name || u.email)?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white text-sm">{u.full_name || '—'}</p>
                        <p className="text-slate-400 text-xs">{u.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={handleClose} className="text-slate-400 hover:text-white">Cancel</Button>
              <Button onClick={handleMigrate} disabled={loading || !githubEmail.trim() || !selectedUser}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {loading
                  ? <><Loader2 size={14} className="animate-spin" /> Migrating…</>
                  : <><Github size={14} /> Run Migration</>}
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-center min-[420px]:grid-cols-3">
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-white">{result.found}</div>
                <div className="text-xs text-slate-400 mt-0.5">Found</div>
              </div>
              <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-lg p-3">
                <div className="text-2xl font-bold text-emerald-400">{result.imported}</div>
                <div className="text-xs text-slate-400 mt-0.5">Claimed</div>
              </div>
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-2xl font-bold text-slate-400">{result.skipped}</div>
                <div className="text-xs text-slate-400 mt-0.5">Skipped</div>
              </div>
            </div>

            {result.legacy_granted && (
              <div className="bg-purple-900/30 border border-purple-700/40 rounded-lg px-3 py-2 text-sm text-purple-300">
                💜 Legacy Donor status + NS unlock granted to {selectedUser?.email}
              </div>
            )}

            {result.found === 0 && (
              <p className="text-slate-400 text-sm text-center">{result.message || 'No domains found for this email.'}</p>
            )}

            {result.details?.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg max-h-52 overflow-y-auto review-modal-scroll divide-y divide-slate-700/30">
                {result.details.map((d, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      {d.status === 'imported'
                        ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                        : <AlertCircle size={12} className="text-slate-500 shrink-0" />}
                      <span className="font-mono text-slate-300">{d.full_name}</span>
                      {d.type && <span className="bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">{d.type}</span>}
                    </div>
                    {d.reason && <span className="text-slate-500 ml-2 text-right max-w-[140px]">{d.reason}</span>}
                    {d.status === 'imported' && <span className="text-emerald-400">Claimed</span>}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={handleClose} className="bg-indigo-600 hover:bg-indigo-700 text-white">Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}