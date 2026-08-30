import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function DataTable({ columns, data, searchKeys = [], emptyMessage = 'No records found', pageSize = 20 }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const filtered = searchKeys.length
    ? data.filter(row => searchKeys.some(k => String(row[k] || '').toLowerCase().includes(search.toLowerCase())))
    : data;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
      {searchKeys.length > 0 && (
        <div className="p-3 sm:p-4 border-b border-border">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-8 text-sm"
            />
          </div>
        </div>
      )}
      <div className="overflow-x-auto overscroll-x-contain review-modal-scroll" role="region" aria-label="Scrollable data table" tabIndex={0}>
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border">
              {columns.map(col => (
                <th key={col.key} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-4 py-3 whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginated.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center text-muted-foreground py-12">{emptyMessage}</td></tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={row.id || i} className="hover:bg-muted/50 transition-colors">
                  {columns.map(col => (
                    <td key={col.key} className="px-4 py-3 text-foreground">
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex flex-col gap-3 px-3 py-3 border-t border-border sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <span className="text-xs text-muted-foreground">{filtered.length} records · Page {page + 1} of {totalPages}</span>
          <div className="flex w-full justify-end gap-1 sm:w-auto">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              aria-label="Previous page"
              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              aria-label="Next page"
              className="min-h-9 min-w-9 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}