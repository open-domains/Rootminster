import { useTranslation } from "react-i18next";import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Shield, Search, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const STATUS_COLORS = {
  open: 'bg-red-500/10 text-red-400',
  investigating: 'bg-amber-500/10 text-amber-400',
  resolved: 'bg-emerald-500/10 text-emerald-400',
  dismissed: 'bg-muted text-muted-foreground'
};

const STATUS_DOT = {
  open: 'bg-red-400',
  investigating: 'bg-amber-400',
  resolved: 'bg-emerald-400',
  dismissed: 'bg-muted-foreground'
};

const STATUS_LABELS = {
  open: 'Open',
  investigating: 'Investigating',
  resolved: 'Resolved',
  dismissed: 'Dismissed'
};

function AbuseReportRow({ report, onUpdated }) {const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState(report.status);
  const [notes, setNotes] = useState(report.admin_notes || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const me = await rootminster.auth.me();
      await rootminster.entities.AbuseReport.update(report.id, {
        status,
        admin_notes: notes,
        actioned_by: me.email
      });
      toast.success(t("operational.admin_abuse_reports.report_updated_3ddeb2"));
      onUpdated();
      setExpanded(false);
    } catch {
      toast.error(t("operational.admin_abuse_reports.failed_to_update_report_ae1e4e"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((e) => !e)}>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-mono text-primary font-semibold text-sm">{report.subdomain}</span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[report.status] || STATUS_COLORS.open}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[report.status] || STATUS_DOT.open}`} />
              {STATUS_LABELS[report.status] || report.status}
            </span>
            <span className="bg-muted text-muted-foreground inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium">
              {report.abuse_type}
            </span>
          </div>
          <p className="text-muted-foreground text-sm line-clamp-2">{report.description}</p>
          <p className="text-muted-foreground/70 text-xs mt-1">
            {report.reporter_email ? `From: ${report.reporter_email}` : 'Anonymous'} ·{' '}
            {new Date(report.created_date).toLocaleDateString()}
          </p>
        </div>
        <ChevronDown size={16} className={`text-muted-foreground shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded &&
      <div className="border-t border-border px-3 sm:px-5 py-4 space-y-4 bg-muted/30 max-h-[60vh] overflow-y-auto review-modal-scroll">
          <div>
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">{t("operational.admin_abuse_reports.full_description_b43e9e")}</p>
            <p className="text-foreground text-sm whitespace-pre-wrap">{report.description}</p>
          </div>

          {report.evidence &&
        <div>
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide mb-1">{t("operational.admin_abuse_reports.evidence_7ea014")}</p>
              <p className="text-foreground text-sm whitespace-pre-wrap break-all">{report.evidence}</p>
            </div>
        }

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t("operational.admin_abuse_reports.update_status_53007c")}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([val, label]) =>
                <SelectItem key={val} value={val}>{label}</SelectItem>
                )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">{t("operational.admin_abuse_reports.quick_actions_c40810")}</Label>
              <div className="flex flex-wrap gap-2">
                <a href={`https://${report.subdomain}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-muted/60 hover:bg-muted border border-border rounded-lg text-foreground transition-colors">
                  <ExternalLink size={12} /> {t("operational.admin_abuse_reports.visit_domain_54819a")} 
              </a>
                <a href={`/admin-subdomains`}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-muted/60 hover:bg-muted border border-border rounded-lg text-foreground transition-colors">
                  <Shield size={12} /> {t("operational.admin_abuse_reports.dns_records_daed33")} 
              </a>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">{t("operational.admin_abuse_reports.admin_notes_98da97")}</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("operational.admin_abuse_reports.internal_notes_about_this_report_4d2743")} className="resize-none h-20" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpanded(false)}>{t("operational.admin_abuse_reports.cancel_77dfd2")}</Button>
            <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Button>
          </div>
        </div>
      }
    </div>);

}

export default function AdminAbuseReports() {const { t } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const data = await rootminster.entities.AbuseReport.list('-created_date', 200);
      setReports(data);
    } catch {
      toast.error(t("operational.admin_abuse_reports.failed_to_load_abuse_reports_22ee9b"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {load();}, []);

  const filtered = reports.filter((r) => {
    const matchSearch = !search || r.subdomain?.toLowerCase().includes(search.toLowerCase()) ||
    r.abuse_type?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = reports.reduce((acc, r) => {acc[r.status] = (acc[r.status] || 0) + 1;return acc;}, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("operational.admin_abuse_reports.trust_safety_66c2b5")}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("operational.admin_abuse_reports.abuse_reports_eaaa70")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("operational.admin_abuse_reports.investigate_reports_record_actions_and_tra_4c5a31")}</p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${(counts.open || 0) > 0 ? 'bg-destructive' : 'bg-emerald-400'}`} />
          {(counts.open || 0) > 0 ? `${counts.open} open case${counts.open === 1 ? '' : 's'}` : 'Queue clear'}
        </div>
      </div>

      <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4">
        {Object.entries(STATUS_LABELS).map(([key, label], index) =>
        <button key={key} onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)} className={`${index > 0 ? 'border-l border-border' : ''} px-4 py-3 text-left transition-colors hover:bg-muted/30`}>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{counts[key] || 0}</p>
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("operational.admin_abuse_reports.search_domain_type_or_description_accb04")} className="h-8 pl-9 text-xs" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("operational.admin_abuse_reports.all_statuses_9cb29e")}</SelectItem>
            {Object.entries(STATUS_LABELS).map(([val, label]) =>
            <SelectItem key={val} value={val}>{label}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {loading ?
      <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div> :
      filtered.length === 0 ?
      <div className="text-center py-16 text-muted-foreground">
          <Shield size={32} className="mx-auto mb-3 opacity-40" />
          <p>{reports.length === 0 ? 'No abuse reports yet.' : 'No reports match your filters.'}</p>
        </div> :

      <div className="space-y-3">
          {filtered.map((r) =>
        <AbuseReportRow key={r.id} report={r} onUpdated={load} />
        )}
        </div>
      }
    </div>);

}
