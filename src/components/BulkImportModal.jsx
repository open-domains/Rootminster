import { useTranslation } from "react-i18next";import { useState, useRef } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, Download, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

const REQUIRED_COLS = ['zone_id', 'zone_name', 'record_type', 'name', 'content'];
const VALID_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA', 'PTR'];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => {obj[h] = vals[i] ?? '';});
    return obj;
  });
  return { headers, rows };
}

function validateRow(row, i) {
  const errors = [];
  REQUIRED_COLS.forEach((col) => {if (!row[col]) errors.push(`Missing ${col}`);});
  if (row.record_type && !VALID_TYPES.includes(row.record_type.toUpperCase())) {
    errors.push(`Invalid record_type "${row.record_type}"`);
  }
  return errors.length ? `Row ${i + 2}: ${errors.join(', ')}` : null;
}

const TEMPLATE_CSV = `zone_id,zone_name,record_type,name,subdomain,content,proxied,ttl,managed,owner_email,owner_id
abc123,example.com,A,sub.example.com,sub,1.2.3.4,false,3600,true,user@example.com,
abc123,example.com,CNAME,blog.example.com,blog,myblog.github.io,false,3600,true,user@example.com,`;

export default function BulkImportModal({ open, onClose, onImported }) {const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef();

  const reset = () => {
    setFile(null);
    setPreview(null);
    setErrors([]);
    setResult(null);
  };

  const handleClose = () => {reset();onClose();};

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const { headers, rows } = parseCSV(e.target.result);
      const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
      if (missing.length) {
        setErrors([`Missing required columns: ${missing.join(', ')}`]);
        setPreview(null);
        return;
      }
      const rowErrors = rows.map((r, i) => validateRow(r, i)).filter(Boolean);
      setErrors(rowErrors);
      setPreview({ headers, rows: rows.slice(0, 5), total: rows.length, allRows: rows });
    };
    reader.readAsText(f);
  };

  const handleImport = async () => {
    if (!preview || errors.length) return;
    setImporting(true);
    let succeeded = 0;
    let failed = 0;
    const failDetails = [];

    // Process in batches of 50
    const rows = preview.allRows;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50).map((row) => ({
        zone_id: row.zone_id,
        zone_name: row.zone_name,
        record_type: row.record_type?.toUpperCase(),
        name: row.name,
        subdomain: row.subdomain || '',
        content: row.content,
        proxied: row.proxied === 'true',
        ttl: row.ttl ? parseInt(row.ttl) : 3600,
        managed: row.managed === 'true',
        owner_email: row.owner_email || '',
        owner_id: row.owner_id || '',
        status: 'active'
      }));
      try {
        await rootminster.entities.DnsRecord.bulkCreate(batch);
        succeeded += batch.length;
      } catch (err) {
        failed += batch.length;
        failDetails.push(err.message);
      }
    }

    setResult({ succeeded, failed, failDetails });
    setImporting(false);
    if (succeeded > 0) {
      toast.success(`Imported ${succeeded} records successfully`);
      onImported?.();
    }
    if (failed > 0) toast.error(`${failed} records failed to import`);
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dns_records_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Upload size={18} className="text-indigo-400" /> {t("operational.bulk_import_modal.bulk_import_dns_records_f5e5a0")} 
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <div className="flex items-center justify-between bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3">
            <p className="text-slate-400 text-sm">{t("operational.bulk_import_modal.download_the_csv_template_to_get_started_0eb7cb")}</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent gap-2">
              <Download size={13} /> {t("operational.bulk_import_modal.template_3ec1ae")} 
            </Button>
          </div>

          {/* File drop zone */}
          {!result &&
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {e.preventDefault();handleFile(e.dataTransfer.files[0]);}}
            className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors">
            
              <Upload size={28} className="text-slate-500 mx-auto mb-2" />
              <p className="text-slate-300 text-sm font-medium">{file ? file.name : 'Click or drag a CSV file here'}</p>
              <p className="text-slate-500 text-xs mt-1">{t("operational.bulk_import_modal.csv_files_only_fbf0a6")}</p>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            </div>
          }

          {/* Validation errors */}
          {errors.length > 0 &&
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 space-y-1 max-h-40 overflow-y-auto review-modal-scroll">
              <p className="text-red-400 text-xs font-semibold flex items-center gap-1"><AlertTriangle size={13} /> {t("operational.bulk_import_modal.validation_errors_e54ca4")}</p>
              {errors.map((e, i) => <p key={i} className="text-red-300 text-xs">{e}</p>)}
            </div>
          }

          {/* Preview */}
          {preview && errors.length === 0 && !result &&
          <div>
              <p className="text-slate-400 text-xs mb-2">{t("operational.bulk_import_modal.preview_first_5_of_50ec1a")} {preview.total} {t("operational.bulk_import_modal.rows_f565b6")}</p>
              <div className="overflow-x-auto rounded-lg border border-slate-700/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-800">
                      {['name', 'record_type', 'content', 'zone_name', 'managed'].map((h) =>
                    <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium">{h}</th>
                    )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) =>
                  <tr key={i} className="border-t border-slate-700/50">
                        <td className="px-3 py-2 font-mono text-indigo-400">{row.name}</td>
                        <td className="px-3 py-2 text-slate-300">{row.record_type}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[120px]">{row.content}</td>
                        <td className="px-3 py-2 text-slate-400">{row.zone_name}</td>
                        <td className="px-3 py-2 text-slate-400">{row.managed}</td>
                      </tr>
                  )}
                  </tbody>
                </table>
              </div>
            </div>
          }

          {/* Result */}
          {result &&
          <div className="space-y-2">
              {result.succeeded > 0 &&
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-300 text-sm">
                  <CheckCircle size={16} /> {result.succeeded} {t("operational.bulk_import_modal.records_imported_successfully_379da9")} 
            </div>
            }
              {result.failed > 0 &&
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
                  <div className="flex items-center gap-2"><XCircle size={16} /> {result.failed} {t("operational.bulk_import_modal.records_failed_57c815")}</div>
                  {result.failDetails.map((d, i) => <p key={i} className="text-xs mt-1 text-red-400">{d}</p>)}
                </div>
            }
            </div>
          }

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={handleClose}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent">
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && preview && errors.length === 0 &&
            <Button onClick={handleImport} disabled={importing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
                {importing ? <><Loader2 size={14} className="animate-spin" /> {t("operational.bulk_import_modal.importing_b7353a")}</> : <><Upload size={14} /> {t("operational.bulk_import_modal.import_d6fbc9")} {preview.total} {t("operational.bulk_import_modal.records_e51c55")}</>}
              </Button>
            }
            {result && <Button onClick={reset} className="bg-indigo-600 hover:bg-indigo-700 text-white">{t("operational.bulk_import_modal.import_another_798202")}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>);

}
