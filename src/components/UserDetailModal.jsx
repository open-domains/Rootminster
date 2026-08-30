import { useTranslation } from "react-i18next";import { useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/StatusBadge';
import { Ban, CheckCircle, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function UserDetailModal({ user, subdomains, onClose, onUpdated }) {const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const isDisabled = user.status === 'disabled';

  const toggleDisable = async () => {
    const newStatus = isDisabled ? 'active' : 'disabled';
    const action = isDisabled ? 'enable' : 'disable';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} account for ${user.email}?`)) return;
    setLoading(true);
    await rootminster.functions.invoke('adminListUsers', { action: 'update_user', user_id: user.id, data: { status: newStatus } });
    toast.success(`User ${action}d`);
    setLoading(false);
    onUpdated();
    onClose();
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
              {(user.full_name || user.email)?.[0]?.toUpperCase()}
            </div>
            <div>
              <div>{user.full_name || '—'}</div>
              <div className="text-sm text-slate-400 font-normal">{user.email}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between py-2">
          <div className="flex gap-4 text-sm text-slate-400">
            <span>{t("operational.user_detail_modal.joined_4c0af4")} <span className="text-slate-300">{user.created_date ? format(new Date(user.created_date), 'MMM d, yyyy') : '—'}</span></span>
            <span>{t("operational.user_detail_modal.role_61e4c2")} <span className="text-slate-300 capitalize">{user.role}</span></span>
            {user.status === 'disabled' && <StatusBadge status="suspended" />}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleDisable}
            disabled={loading}
            className={isDisabled ?
            'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1' :
            'text-red-400 hover:text-red-300 hover:bg-red-500/10 gap-1'}>
            
            {isDisabled ? <><CheckCircle size={13} /> {t("operational.user_detail_modal.enable_account_bc6a32")}</> : <><Ban size={13} /> {t("operational.user_detail_modal.disable_account_bb27a5")}</>}
          </Button>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-300">{t("operational.user_detail_modal.subdomains_c20a2a")}{subdomains.length})</span>
          </div>

          {subdomains.length === 0 ?
          <p className="text-slate-500 text-sm py-4 text-center">{t("operational.user_detail_modal.no_subdomains_owned_by_this_user_46749d")}</p> :

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden max-h-72 overflow-y-auto review-modal-scroll">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800">
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2">{t("operational.user_detail_modal.name_709a23")}</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2">{t("operational.user_detail_modal.type_3deb74")}</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2">{t("operational.user_detail_modal.content_4f9be0")}</th>
                    <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2">{t("operational.user_detail_modal.status_bae7d5")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {subdomains.map((rec) =>
                <tr key={rec.id} className="hover:bg-slate-700/20">
                      <td className="px-4 py-2 font-mono text-indigo-400 text-xs">{rec.name}</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-xs bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{rec.record_type}</span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-400 max-w-[180px] truncate">{rec.content}</td>
                      <td className="px-4 py-2"><StatusBadge status={rec.status || 'active'} /></td>
                    </tr>
                )}
                </tbody>
              </table>
            </div>
          }
        </div>
      </DialogContent>
    </Dialog>);

}
