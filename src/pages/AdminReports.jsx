import { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { rootminster } from '@/api/rootminsterClient';
import { usePublicConfig } from '@/lib/public-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { FileDown, FileText, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const DATASETS = [
  { id: 'users', entity: 'User', label: 'Users', description: 'Accounts, roles, status and registration dates', fields: ['email', 'full_name', 'role', 'status', 'created_date'] },
  { id: 'domains', entity: 'Domain', label: 'Root domains', description: 'Configured root domains and operational metadata', fields: ['name', 'domain', 'status', 'record_count', 'last_synced', 'created_date'] },
  { id: 'subdomains', entity: 'SubdomainOwnership', label: 'User domains', description: 'Allocated subdomains and owners', fields: ['full_name', 'subdomain', 'root_domain', 'owner_email', 'status', 'created_date'] },
  { id: 'requests', entity: 'SubdomainRequest', label: 'Requests', description: 'Subdomain request workflow and outcomes', fields: ['full_name', 'subdomain', 'root_domain', 'requester_email', 'status', 'created_date'] },
  { id: 'dns', entity: 'DnsRecord', label: 'DNS records', description: 'DNS inventory and record types', fields: ['name', 'type', 'record_type', 'value', 'record_value', 'owner_email', 'created_date'] },
  { id: 'abuse', entity: 'AbuseReport', label: 'Abuse reports', description: 'Moderation and abuse case activity', fields: ['domain', 'subdomain', 'category', 'status', 'reporter_email', 'created_date'] },
  { id: 'safety', entity: 'SafetyAssessment', label: 'Safety assessments', description: 'Risk and review outcomes', fields: ['domain', 'subdomain', 'status', 'risk_level', 'decision', 'created_date'] },
  { id: 'donations', entity: 'Donation', label: 'Donations', description: 'Donation activity and status', fields: ['email', 'amount', 'currency', 'status', 'created_date'] },
  { id: 'email', entity: 'EmailLog', label: 'Email logs', description: 'Outbound email delivery history', fields: ['to', 'recipient', 'subject', 'status', 'created_date'] },
  { id: 'audit', entity: 'AuditLog', label: 'Audit logs', description: 'Administrative and security-sensitive actions', fields: ['action', 'actor_email', 'target', 'entity_type', 'created_date'] },
  { id: 'sync', entity: 'SyncLog', label: 'Sync logs', description: 'DNS/provider synchronization history', fields: ['status', 'provider', 'message', 'created_date'] },
];

const PRESETS = {
  executive: ['users', 'domains', 'subdomains', 'requests', 'abuse'],
  operations: ['domains', 'subdomains', 'requests', 'dns', 'sync'],
  security: ['users', 'abuse', 'safety', 'audit', 'email'],
  full: DATASETS.map(d => d.id),
};

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
  const [subtitle, setSubtitle] = useState('Administrative overview');
  const [notes, setNotes] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [includeDetails, setIncludeDetails] = useState(true);
  const [includeDistributions, setIncludeDistributions] = useState(true);
  const [maxRows, setMaxRows] = useState(150);
  const [loading, setLoading] = useState(false);
  const [lastSummary, setLastSummary] = useState(null);

  const selectedDatasets = useMemo(() => DATASETS.filter(dataset => selected.includes(dataset.id)), [selected]);

  const toggle = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const applyPreset = preset => setSelected(PRESETS[preset]);

  const generate = async () => {
    if (!selectedDatasets.length) return toast.error('Choose at least one data section.');
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
      doc.text(subtitle || 'Administrative report', 14, 61);

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
      y = drawSectionHeader(doc, 'Executive summary', 'A quick pulse-check of the selected Rootminster data.', y);
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
          y = drawTable(doc, dataset.rows.slice(0, Math.max(1, Math.min(Number(maxRows) || 150, 500))), fields, y);
          if (dataset.rows.length > maxRows) {
            doc.setFontSize(7.5);
            doc.setTextColor(105, 113, 128);
            doc.text(`Detail table limited to ${maxRows} rows. Summary count includes all ${dataset.rows.length} matching records.`, 14, y);
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
        doc.text(`${platformName} • Administrative report`, 14, 294);
        doc.text(`Page ${page} of ${pages}`, 196, 294, { align: 'right' });
      }

      const filename = `${safeFilename(title)}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
      setLastSummary({ filename, generatedAt, sections: datasets.length, records: datasets.reduce((sum, d) => sum + d.rows.length, 0), pages });
      toast.success('PDF report generated.');
    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Could not generate the report.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2"><Badge variant="secondary"><Sparkles size={12} className="mr-1" />Built-in module</Badge><Badge variant="outline"><ShieldCheck size={12} className="mr-1" />Admin only</Badge></div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Build polished PDF reports from live Rootminster data. Choose exactly what goes in, set a reporting window, and export a presentation-ready document.</p>
        </div>
        <Button onClick={generate} disabled={loading || !selected.length} className="gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
          {loading ? 'Building report…' : 'Generate PDF'}
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>What should this report include?</CardTitle><CardDescription>Select individual data sources or start with a preset.</CardDescription></CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => applyPreset('executive')}>Executive</Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('operations')}>Operations</Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('security')}>Security</Button>
                <Button variant="outline" size="sm" onClick={() => applyPreset('full')}>Everything</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Clear</Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {DATASETS.map(dataset => {
                  const checked = selected.includes(dataset.id);
                  return (
                    <label key={dataset.id} className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                      <Checkbox checked={checked} onCheckedChange={() => toggle(dataset.id)} className="mt-0.5" />
                      <span><span className="block text-sm font-medium">{dataset.label}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{dataset.description}</span></span>
                    </label>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Report content</CardTitle><CardDescription>Give the PDF a purpose and a little polish.</CardDescription></CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2"><Label htmlFor="report-title">Title</Label><Input id="report-title" value={title} onChange={e => setTitle(e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="report-subtitle">Subtitle</Label><Input id="report-subtitle" value={subtitle} onChange={e => setSubtitle(e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="report-notes">Admin notes</Label><Textarea id="report-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional context, decisions, observations or handover notes…" rows={4} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Report window</CardTitle><CardDescription>Leave blank to include the full available history.</CardDescription></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="grid gap-2"><Label htmlFor="report-from">From</Label><Input id="report-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
              <div className="grid gap-2"><Label htmlFor="report-to">To</Label><Input id="report-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Layout options</CardTitle><CardDescription>Control how detailed the exported PDF becomes.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-start gap-3"><Checkbox checked={includeDistributions} onCheckedChange={value => setIncludeDistributions(Boolean(value))} /><span><span className="block text-sm font-medium">Visual breakdowns</span><span className="text-xs text-muted-foreground">Add compact status, role and record-type charts.</span></span></label>
              <label className="flex items-start gap-3"><Checkbox checked={includeDetails} onCheckedChange={value => setIncludeDetails(Boolean(value))} /><span><span className="block text-sm font-medium">Detail tables</span><span className="text-xs text-muted-foreground">Include record-level tables after each summary.</span></span></label>
              {includeDetails && <div className="grid gap-2"><Label htmlFor="max-rows">Maximum detail rows per section</Label><Input id="max-rows" type="number" min="10" max="500" value={maxRows} onChange={e => setMaxRows(Number(e.target.value))} /></div>}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-muted/30"><CardTitle className="flex items-center gap-2"><FileText size={17} />Export preview</CardTitle><CardDescription>{selected.length} sections selected</CardDescription></CardHeader>
            <CardContent className="space-y-3 pt-5">
              {selectedDatasets.map(dataset => <div key={dataset.id} className="flex items-center justify-between text-sm"><span>{dataset.label}</span><Badge variant="outline">Included</Badge></div>)}
              {!selected.length && <p className="text-sm text-muted-foreground">Choose some data sections to get started.</p>}
            </CardContent>
          </Card>

          {lastSummary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader><CardTitle className="text-base">Last export</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm"><p className="font-medium">{lastSummary.filename}</p><p className="text-muted-foreground">{lastSummary.records.toLocaleString()} records • {lastSummary.sections} sections • {lastSummary.pages} pages</p><p className="text-xs text-muted-foreground">{lastSummary.generatedAt.toLocaleString()}</p></CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
