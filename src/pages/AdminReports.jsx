import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { rootminster } from '@/api/rootminsterClient';
import { usePublicConfig } from '@/lib/public-config';
import { cn } from '@/lib/utils';
import { AdminHeader, AdminPage, AdminSection } from '@/components/AdminPageShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, FileDown, FileText, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

const DATASETS = [
  { id: 'users', entity: 'User', label: 'Users', description: 'Accounts, roles, status and registration dates', fields: ['email', 'full_name', 'role', 'status', 'created_date'] },
  { id: 'domains', entity: 'Domain', label: 'Root Domains', description: 'Configured root domains and operational metadata', fields: ['name', 'domain', 'status', 'record_count', 'last_synced', 'created_date'] },
  { id: 'subdomains', entity: 'SubdomainOwnership', label: 'User Domains', description: 'Allocated subdomains and owners', fields: ['full_name', 'subdomain', 'root_domain', 'owner_email', 'status', 'created_date'] },
  { id: 'requests', entity: 'SubdomainRequest', label: 'Requests', description: 'Subdomain request workflow and outcomes', fields: ['full_name', 'subdomain', 'root_domain', 'requester_email', 'status', 'created_date'] },
  { id: 'dns', entity: 'DnsRecord', label: 'DNS Records', description: 'DNS inventory and record types', fields: ['name', 'type', 'record_type', 'value', 'record_value', 'owner_email', 'created_date'] },
  { id: 'abuse', entity: 'AbuseReport', label: 'Abuse Reports', description: 'Moderation and abuse case activity', fields: ['domain', 'subdomain', 'category', 'status', 'reporter_email', 'created_date'] },
  { id: 'donations', entity: 'Donation', label: 'Donations', description: 'Donation activity and status', fields: ['email', 'amount', 'currency', 'status', 'created_date'] },
  { id: 'email', entity: 'EmailLog', label: 'Email Logs', description: 'Outbound email delivery history', fields: ['to', 'recipient', 'subject', 'status', 'created_date'] },
  { id: 'audit', entity: 'AuditLog', label: 'Audit Logs', description: 'Administrative and security-sensitive actions', fields: ['action', 'actor_email', 'target', 'entity_type', 'created_date'] },
  { id: 'sync', entity: 'SyncLog', label: 'Sync Logs', description: 'DNS/provider synchronization history', fields: ['status', 'provider', 'message', 'created_date'] },
];

const PRESETS = {
  executive: ['users', 'domains', 'subdomains', 'requests', 'abuse'],
  operations: ['domains', 'subdomains', 'requests', 'dns', 'sync'],
  security: ['users', 'abuse', 'audit', 'email'],
  full: DATASETS.map(d => d.id),
};

const PRESET_OPTIONS = [
  { id: 'executive', label: 'Executive' },
  { id: 'operations', label: 'Operations' },
  { id: 'security', label: 'Security' },
  { id: 'full', label: 'Everything' },
];

const MIN_ROWS = 10;
const MAX_ROWS = 500;
const DEFAULT_ROWS = 150;

function toInputDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toInputDate(date);
}

const RANGE_PRESETS = [
  { id: '7d', label: 'Last 7 Days', range: () => [daysAgo(6), toInputDate(new Date())] },
  { id: '30d', label: 'Last 30 Days', range: () => [daysAgo(29), toInputDate(new Date())] },
  { id: '90d', label: 'Last 90 Days', range: () => [daysAgo(89), toInputDate(new Date())] },
  { id: 'ytd', label: 'Year to Date', range: () => [`${new Date().getFullYear()}-01-01`, toInputDate(new Date())] },
  { id: 'all', label: 'All Time', range: () => ['', ''] },
];

function formatInputDate(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function clampRows(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_ROWS;
  return Math.min(MAX_ROWS, Math.max(MIN_ROWS, number));
}

function sameSelection(a, b) {
  return a.length === b.length && a.every(id => b.includes(id));
}

function cleanValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function dateValue(row) {
  const raw = row.created_date || row.created_at || row.updated_date;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inRange(row, from, to) {
  const date = dateValue(row);
  if (!date) return true;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59.999`)) return false;
  return true;
}

function safeFilename(name) {
  return String(name || 'rootminster-report').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rootminster-report';
}

function addWrappedText(doc, text, x, y, width, options = {}) {
  const lines = doc.splitTextToSize(String(text || ''), width);
  doc.text(lines, x, y, options);
  return y + lines.length * 4.6;
}

function ensureSpace(doc, y, needed = 20) {
  if (y + needed <= 282) return y;
  doc.addPage();
  return 18;
}

function drawSectionHeader(doc, title, subtitle, y) {
  y = ensureSpace(doc, y, 24);
  doc.setFillColor(246, 248, 252);
  doc.roundedRect(14, y, 182, 18, 3, 3, 'F');
  doc.setTextColor(18, 24, 38);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(title, 19, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(92, 101, 117);
  doc.text(subtitle, 19, y + 13);
  return y + 24;
}

function drawTable(doc, rows, fields, y) {
  const pageWidth = 182;
  const cols = Math.max(1, fields.length);
  const colWidth = pageWidth / cols;
  const headerHeight = 8;
  const cellLineHeight = 3.4;

  const drawHeader = (headerY) => {
    doc.setFillColor(28, 36, 54);
    doc.rect(14, headerY, pageWidth, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    fields.forEach((field, index) => {
      const label = field.replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
      doc.text(doc.splitTextToSize(label, colWidth - 3)[0] || label, 15.5 + index * colWidth, headerY + 5.2);
    });
    return headerY + headerHeight;
  };

  y = ensureSpace(doc, y, 18);
  y = drawHeader(y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);

  rows.forEach((row, rowIndex) => {
    const linesByField = fields.map(field => doc.splitTextToSize(cleanValue(row[field]), colWidth - 3).slice(0, 3));
    const rowHeight = Math.max(8, Math.max(...linesByField.map(lines => lines.length)) * cellLineHeight + 3);
    if (y + rowHeight > 282) {
      doc.addPage();
      y = drawHeader(18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.8);
    }
    if (rowIndex % 2 === 0) {
      doc.setFillColor(249, 250, 252);
      doc.rect(14, y, pageWidth, rowHeight, 'F');
    }
    doc.setDrawColor(226, 230, 238);
    doc.line(14, y + rowHeight, 196, y + rowHeight);
    doc.setTextColor(44, 52, 67);
    linesByField.forEach((lines, index) => doc.text(lines, 15.5 + index * colWidth, y + 4.6));
    y += rowHeight;
  });
  return y + 6;
}

function countBy(rows, field) {
  const counts = new Map();
  rows.forEach(row => {
    const key = cleanValue(row[field]);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function drawDistribution(doc, title, pairs, y) {
  if (!pairs.length) return y;
  y = ensureSpace(doc, y, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 58, 72);
  doc.text(title, 14, y);
  y += 5;
  const max = Math.max(...pairs.map(([, value]) => value), 1);
  pairs.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(82, 91, 108);
    doc.text(doc.splitTextToSize(String(label), 42)[0], 14, y + 3.5);
    doc.setFillColor(232, 236, 244);
    doc.roundedRect(58, y, 110, 4.5, 2, 2, 'F');
    doc.setFillColor(55, 95, 246);
    doc.roundedRect(58, y, Math.max(2, 110 * (value / max)), 4.5, 2, 2, 'F');
    doc.setTextColor(55, 63, 79);
    doc.text(String(value), 172, y + 3.5);
    y += 7;
  });
  return y + 3;
}

export default function AdminReports() {
  const { config } = usePublicConfig();
  const branding = config?.branding || {};
  const [selected, setSelected] = useState(PRESETS.executive);
  const [title, setTitle] = useState('Rootminster Platform Report');
  const [subtitle, setSubtitle] = useState('Administrative Overview');
  const [notes, setNotes] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeDistributions, setIncludeDistributions] = useState(true);
  const [maxRows, setMaxRows] = useState(String(DEFAULT_ROWS));
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);

  const selectedDatasets = useMemo(() => DATASETS.filter(dataset => selected.includes(dataset.id)), [selected]);
  const activePreset = PRESET_OPTIONS.find(preset => sameSelection(selected, PRESETS[preset.id]))?.id;
  const activeRange = RANGE_PRESETS.find(preset => {
    const [presetFrom, presetTo] = preset.range();
    return presetFrom === from && presetTo === to;
  })?.id;
  const rangeInvalid = Boolean(from && to && from > to);
  const rowLimit = clampRows(maxRows);
  const windowSummary = from || to
    ? `${formatInputDate(from) || 'Beginning'} – ${formatInputDate(to) || 'Today'}`
    : 'All available records';

  const toggle = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const applyPreset = preset => setSelected(PRESETS[preset]);
  const applyRange = preset => {
    const [nextFrom, nextTo] = preset.range();
    setFrom(nextFrom);
    setTo(nextTo);
  };

  const generate = async () => {
    if (!selectedDatasets.length) return toast.error('Choose at least one data section.');
    if (rangeInvalid) return toast.error('The start date must be on or before the end date.');
    setLoading(true);
    try {
      const datasets = [];
      for (const dataset of selectedDatasets) {
        try {
          const rows = await rootminster.entities[dataset.entity].list('-created_date', 10000);
          datasets.push({ ...dataset, rows: (rows || []).filter(row => inRange(row, from, to)) });
        } catch (error) {
          if (dataset.id === 'donations' && error?.status === 404) datasets.push({ ...dataset, rows: [], unavailable: true });
          else throw error;
        }
      }

      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const generatedAt = new Date();
      const platformName = branding.platform_name || branding.short_name || 'Rootminster';

      doc.setFillColor(18, 24, 38);
      doc.rect(0, 0, 210, 74, 'F');
      doc.setFillColor(55, 95, 246);
      doc.circle(184, 18, 30, 'F');
      doc.setFillColor(96, 72, 255);
      doc.circle(200, 52, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(platformName.toUpperCase(), 14, 18);
      doc.setFontSize(24);
      doc.text(doc.splitTextToSize(title, 150), 14, 34);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(211, 218, 232);
      doc.text(subtitle || 'Administrative Report', 14, 61);

      doc.setTextColor(38, 46, 61);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('REPORT WINDOW', 14, 89);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const rangeLabel = from || to ? `${from || 'Beginning'} to ${to || 'Today'}` : 'All available records';
      doc.text(rangeLabel, 14, 96);
      doc.text(`Generated ${generatedAt.toLocaleString()}`, 14, 102);
      doc.text(`${datasets.length} data sections selected`, 14, 108);

      if (notes.trim()) {
        doc.setFillColor(246, 248, 252);
        doc.roundedRect(14, 116, 182, 30, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('ADMIN NOTES', 19, 124);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(76, 85, 101);
        addWrappedText(doc, notes, 19, 131, 170);
      }

      let y = notes.trim() ? 158 : 120;
      y = drawSectionHeader(doc, 'Executive Summary', 'A quick pulse-check of the selected Rootminster data.', y);
      const summaryItems = datasets.map(dataset => [dataset.label, dataset.rows.length]);
      const cardWidth = 57;
      summaryItems.forEach(([label, value], index) => {
        if (index > 0 && index % 3 === 0) y += 26;
        y = ensureSpace(doc, y, 25);
        const x = 14 + (index % 3) * 62;
        doc.setFillColor(250, 251, 253);
        doc.setDrawColor(226, 230, 238);
        doc.roundedRect(x, y, cardWidth, 20, 3, 3, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(28, 36, 54);
        doc.text(String(value), x + 4, y + 8);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.3);
        doc.setTextColor(95, 104, 120);
        doc.text(doc.splitTextToSize(label, cardWidth - 8)[0], x + 4, y + 14);
      });
      y += 31;

      for (const dataset of datasets) {
        y = drawSectionHeader(doc, dataset.label, `${dataset.rows.length} records${dataset.unavailable ? ' • module unavailable' : ''}`, y);
        if (dataset.unavailable) {
          doc.setFontSize(8.5);
          doc.setTextColor(105, 113, 128);
          doc.text('This data source is disabled or not installed on this Rootminster instance.', 14, y);
          y += 10;
          continue;
        }
        if (!dataset.rows.length) {
          doc.setFontSize(8.5);
          doc.setTextColor(105, 113, 128);
          doc.text('No matching records for the selected report window.', 14, y);
          y += 10;
          continue;
        }

        if (includeDistributions) {
          const distributionField = dataset.rows.some(r => r.status !== undefined) ? 'status'
            : dataset.rows.some(r => r.role !== undefined) ? 'role'
              : dataset.rows.some(r => r.type !== undefined || r.record_type !== undefined) ? (dataset.rows.some(r => r.type !== undefined) ? 'type' : 'record_type')
                : null;
          if (distributionField) y = drawDistribution(doc, `Breakdown by ${distributionField.replaceAll('_', ' ')}`, countBy(dataset.rows, distributionField), y);
        }

        if (includeDetails) {
          const availableFields = dataset.fields.filter(field => dataset.rows.some(row => row[field] !== undefined && row[field] !== null));
          const fields = (availableFields.length ? availableFields : Object.keys(dataset.rows[0]).filter(key => !['id'].includes(key))).slice(0, 5);
          y = drawTable(doc, dataset.rows.slice(0, rowLimit), fields, y);
          if (dataset.rows.length > rowLimit) {
            doc.setFontSize(7.5);
            doc.setTextColor(105, 113, 128);
            doc.text(`Detail table limited to ${rowLimit} rows. Summary count includes all ${dataset.rows.length} matching records.`, 14, y);
            y += 8;
          }
        }
      }

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(229, 232, 238);
        doc.line(14, 289, 196, 289);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(125, 132, 146);
        doc.text(`${platformName} • Administrative Report`, 14, 294);
        doc.text(`Page ${page} of ${pages}`, 196, 294, { align: 'right' });
      }

      const filename = `${safeFilename(title)}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      setLastSummary({ filename, generatedAt, sections: datasets.length, records: datasets.reduce((sum, d) => sum + d.rows.length, 0), pages });
      toast.success('PDF report generated.');
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      toast.error(error?.message || 'Could not generate the report.');
    } finally {
      setLoading(false);
    }
  };

  const generateButton = className => (
    <Button onClick={generate} disabled={loading || !selected.length || rangeInvalid} className={className}>
      {loading ? <Loader2 className="animate-spin" /> : <FileDown />}
      {loading ? 'Building Report…' : 'Generate PDF'}
    </Button>
  );

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Built-In Module"
        title="Reports"
        meta="Admin Only"
        description="Build polished PDF reports from live Rootminster data. Choose exactly what goes in, set a reporting window, and export a presentation-ready document."
        actions={generateButton('w-full sm:w-auto')}
      />

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,380px)]">
        <div className="min-w-0 space-y-6">
          <AdminSection
            title="Data Sections"
            description="Select individual data sources or start with a preset."
            action={<span className="text-xs font-medium tabular-nums text-muted-foreground">{selected.length} of {DATASETS.length} Selected</span>}
          >
            <div className="space-y-4">
              <div role="group" aria-label="Section presets" className="flex flex-wrap items-center gap-2">
                {PRESET_OPTIONS.map(preset => {
                  const active = activePreset === preset.id;
                  return (
                    <Button
                      key={preset.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-pressed={active}
                      onClick={() => applyPreset(preset.id)}
                      className={cn(active && 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary')}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelected([])} disabled={!selected.length} className="text-muted-foreground">Clear</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DATASETS.map(dataset => {
                  const checked = selected.includes(dataset.id);
                  return (
                    <label
                      key={dataset.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring',
                        checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/20 hover:bg-muted/40'
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggle(dataset.id)} className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium leading-5 text-foreground">{dataset.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{dataset.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </AdminSection>

          <AdminSection title="Report Content" description="Give the PDF a purpose and a little polish.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="report-title">Title</Label>
                <Input id="report-title" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="report-subtitle">Subtitle</Label>
                <Input id="report-subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor="report-notes">Admin Notes</Label>
                <Textarea id="report-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context, decisions, observations or handover notes…" rows={4} />
                <p className="text-xs text-muted-foreground">Shown on the cover page when provided.</p>
              </div>
            </div>
          </AdminSection>
        </div>

        <div className="min-w-0 space-y-6">
          <AdminSection title="Report Window" description="Leave blank to include the full available history.">
            <div className="space-y-4">
              <div role="group" aria-label="Quick date ranges" className="flex flex-wrap gap-1.5">
                {RANGE_PRESETS.map(preset => {
                  const active = activeRange === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => applyRange(preset)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="report-from">From</Label>
                  <DateInput id="report-from" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} aria-invalid={rangeInvalid || undefined} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="report-to">To</Label>
                  <DateInput id="report-to" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} aria-invalid={rangeInvalid || undefined} />
                </div>
              </div>
              {rangeInvalid && <p role="alert" className="text-xs text-destructive">The start date must be on or before the end date.</p>}
            </div>
          </AdminSection>

          <AdminSection title="Layout Options" description="Control how detailed the exported PDF becomes.">
            <div className="divide-y divide-border">
              <div className="flex items-start justify-between gap-4 pb-3">
                <div className="min-w-0">
                  <Label htmlFor="opt-distributions" className="cursor-pointer">Visual Breakdowns</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Add compact status, role and record-type charts.</p>
                </div>
                <Switch id="opt-distributions" checked={includeDistributions} onCheckedChange={value => setIncludeDistributions(Boolean(value))} className="mt-0.5" />
              </div>
              <div className={cn('flex items-start justify-between gap-4 pt-3', includeDetails && 'pb-3')}>
                <div className="min-w-0">
                  <Label htmlFor="opt-details" className="cursor-pointer">Detail Tables</Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">Include record-level tables after each summary.</p>
                </div>
                <Switch id="opt-details" checked={includeDetails} onCheckedChange={value => setIncludeDetails(Boolean(value))} className="mt-0.5" />
              </div>
              {includeDetails && (
                <div className="grid gap-2 pt-3">
                  <Label htmlFor="max-rows">Maximum Detail Rows per Section</Label>
                  <Input
                    id="max-rows"
                    type="number"
                    inputMode="numeric"
                    min={MIN_ROWS}
                    max={MAX_ROWS}
                    step="10"
                    value={maxRows}
                    onChange={e => setMaxRows(e.target.value)}
                    onBlur={() => setMaxRows(String(rowLimit))}
                    className="tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">Between {MIN_ROWS} and {MAX_ROWS} rows.</p>
                </div>
              )}
            </div>
          </AdminSection>

          <AdminSection title="Export Summary" description={`${selected.length} ${selected.length === 1 ? 'Section' : 'Sections'} Selected`}>
            <div className="space-y-4">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Window</dt>
                <dd className="text-right font-medium text-foreground tabular-nums">{windowSummary}</dd>
                <dt className="text-muted-foreground">Breakdowns</dt>
                <dd className="text-right font-medium text-foreground">{includeDistributions ? 'On' : 'Off'}</dd>
                <dt className="text-muted-foreground">Detail Rows</dt>
                <dd className="text-right font-medium text-foreground tabular-nums">{includeDetails ? `Up to ${rowLimit} per section` : 'Off'}</dd>
              </dl>

              {selectedDatasets.length ? (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {selectedDatasets.map(dataset => (
                    <li key={dataset.id} className="flex items-center justify-between gap-3 py-1.5 pl-3 pr-1.5 text-sm">
                      <span className="truncate">{dataset.label}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => toggle(dataset.id)} aria-label={`Remove ${dataset.label}`} className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground">
                        <X />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center">
                  <FileText size={18} className="text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Choose some data sections to get started.</p>
                </div>
              )}

              {generateButton('w-full')}

              {lastSummary && (
                <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0 space-y-0.5 text-xs">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Last Export</p>
                    <p className="truncate text-sm font-medium text-foreground" title={lastSummary.filename}>{lastSummary.filename}</p>
                    <p className="text-muted-foreground tabular-nums">{lastSummary.records.toLocaleString()} records • {lastSummary.sections} sections • {lastSummary.pages} pages</p>
                    <p className="text-muted-foreground tabular-nums">{lastSummary.generatedAt.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>
          </AdminSection>
        </div>
      </div>
    </AdminPage>
  );
}
