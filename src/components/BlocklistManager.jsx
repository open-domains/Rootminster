import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ShieldOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

const RECORD_TYPES = ['ANY', 'A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS'];

const TYPE_COLORS = {
  ANY: 'bg-red-500/20 text-red-300 border-red-500/30',
  A: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  AAAA: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  CNAME: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  MX: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  TXT: 'bg-green-500/20 text-green-300 border-green-500/30',
  NS: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
};

export default function BlocklistManager({ currentUser }) {const { t } = useTranslation();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState({ value: '', is_regex: false, record_type: 'ANY', reason: '', notes: '' });

  const load = async () => {
    setLoading(true);
    const data = await rootminster.entities.BlocklistEntry.list('-created_date', 200);
    setEntries(data);
    setLoading(false);
  };

  useEffect(() => {load();}, []);

  const add = async (e) => {
    e.preventDefault();
    if (!form.value.trim()) return;
    setAdding(true);
    try {
      await rootminster.entities.BlocklistEntry.create({
        value: form.is_regex ? form.value.trim() : form.value.trim().toLowerCase(),
        is_regex: form.is_regex || false,
        record_type: form.record_type || 'ANY',
        reason: form.reason.trim(),
        notes: form.notes.trim(),
        added_by: currentUser?.email || ''
      });
      toast.success(t("operational.blocklist_manager.entry_added_to_blocklist_a53698"));
      setForm({ value: '', is_regex: false, record_type: 'ANY', reason: '', notes: '' });
      load();
    } catch {
      toast.error(t("operational.blocklist_manager.failed_to_add_entry_b8090c"));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id) => {
    setDeletingId(id);
    try {
      await rootminster.entities.BlocklistEntry.delete(id);
      toast.success(t("operational.blocklist_manager.entry_removed_2079fb"));
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast.error(t("operational.blocklist_manager.failed_to_remove_entry_7fdc70"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center">
            <ShieldOff size={16} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">{t("operational.blocklist_manager.add_blocklist_entry_cfdfa7")}</h2>
            <p className="text-slate-400 text-xs">{t("operational.blocklist_manager.block_a_specific_value_or_type_value_combo_8b6c74")}</p>
          </div>
        </div>

        <form onSubmit={add} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-slate-300 text-xs">{t("operational.blocklist_manager.value_to_block_600ed9")}</Label>
              <Input
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={t("operational.blocklist_manager.e_g_1_2_3_4_or_malicious_example_com_f3d420")}
                required
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" />
              
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">{t("operational.blocklist_manager.record_type_bdd640")}</Label>
              <Select value={form.record_type} onValueChange={(v) => setForm((f) => ({ ...f, record_type: v }))}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {RECORD_TYPES.map((t) =>
                  <SelectItem key={t} value={t} className="text-white focus:bg-slate-700">
                      {t === 'ANY' ? 'ANY (all types)' : t}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">{t("operational.blocklist_manager.reason_shown_to_user_1b7ed3")}</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={t("operational.blocklist_manager.e_g_phishing_spam_malware_75016f")}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" />
              
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">{t("operational.blocklist_manager.internal_notes_85ab57")}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("operational.blocklist_manager.optional_internal_reference_1929b4")}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-600" />
              
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-900/50 border border-slate-700/40 rounded-lg">
            <div>
              <p className="text-slate-300 text-sm font-medium">{t("operational.blocklist_manager.regex_pattern_6c75e5")}</p>
              <p className="text-slate-500 text-xs">{t("operational.blocklist_manager.match_using_a_regular_expression_e_g_066aa3")} <code className="text-slate-400">^192\.168\.</code></p>
            </div>
            <Switch checked={form.is_regex} onCheckedChange={(v) => setForm((f) => ({ ...f, is_regex: v }))} />
          </div>

          <Button type="submit" disabled={adding || !form.value.trim()}
          className="bg-red-600 hover:bg-red-700 text-white gap-2">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t("operational.blocklist_manager.add_to_blocklist_4557b2")} 

          </Button>
        </form>
      </div>

      {/* Entries list */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-sm">{t("operational.blocklist_manager.current_blocklist_312b27")}</h2>
          <span className="text-slate-400 text-xs">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>

        {loading ?
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-slate-400" /></div> :
        entries.length === 0 ?
        <p className="text-slate-500 text-sm text-center py-8">{t("operational.blocklist_manager.no_blocklist_entries_yet_d136ea")}</p> :

        <div className="space-y-2">
            {entries.map((entry) =>
          <div key={entry.id}
          className="flex items-center justify-between gap-3 p-3 bg-slate-900/50 border border-slate-700/40 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className={`shrink-0 text-xs border ${TYPE_COLORS[entry.record_type] || TYPE_COLORS.ANY}`}>
                    {entry.record_type || 'ANY'}
                  </Badge>
                  {entry.is_regex &&
              <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono">{t("operational.blocklist_manager.regex_d6a8e6")}</span>
              }
                  <code className="text-white text-sm font-mono truncate">{entry.value}</code>
                  {entry.reason &&
              <span className="text-slate-400 text-xs truncate hidden sm:block">— {entry.reason}</span>
              }
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {entry.added_by &&
              <span className="text-slate-600 text-xs hidden md:block">{entry.added_by}</span>
              }
                  <Button
                variant="ghost" size="icon"
                onClick={() => remove(entry.id)}
                disabled={deletingId === entry.id}
                aria-label={`Remove ${entry.value} from blocklist`}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 w-7 cursor-pointer">
                
                    {deletingId === entry.id ?
                <Loader2 size={13} className="animate-spin" /> :
                <Trash2 size={13} />}
                  </Button>
                </div>
              </div>
          )}
          </div>
        }
      </div>
    </div>);

}
