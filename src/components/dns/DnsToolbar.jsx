import { Search, RotateCcw, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { BASE_RECORD_TYPES } from './dnsConfig';

export default function DnsToolbar({
  search, setSearch, typeFilter, setTypeFilter, proxyFilter, setProxyFilter,
  cols, setCols, onReset, recordCount,
}) {
  const toggleCol = (key) => setCols(c => ({ ...c, [key]: !c[key] }));

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2.5 px-3 py-2.5 border-b border-border">
      {/* Search */}
      <div className="relative flex-1 min-w-0 max-w-xs">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search DNS records…"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All types</SelectItem>
            {BASE_RECORD_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Proxy filter */}
        <Select value={proxyFilter} onValueChange={setProxyFilter}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Proxy" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All</SelectItem>
            <SelectItem value="proxied" className="text-xs">Proxied</SelectItem>
            <SelectItem value="dns" className="text-xs">DNS only</SelectItem>
          </SelectContent>
        </Select>

        {/* Display options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-transparent text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <SlidersHorizontal size={13} /> Display
              <ChevronDown size={12} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel className="text-xs">Columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { key: 'type', label: 'Type' },
              { key: 'content', label: 'Content' },
              { key: 'proxy', label: 'Proxy' },
              { key: 'ttl', label: 'TTL' },
              { key: 'status', label: 'Status' },
            ].map(c => (
              <DropdownMenuItem key={c.key} onClick={(e) => { e.preventDefault(); toggleCol(c.key); }} className="text-xs cursor-pointer gap-2">
                <span className={cnCheck(cols[c.key])}>{cols[c.key] ? '☑' : '☐'}</span>
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          onClick={onReset}
          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw size={13} /> Reset
        </button>

        <span className="text-xs text-muted-foreground ml-auto lg:ml-1 tabular-nums shrink-0">{recordCount} records</span>
      </div>
    </div>
  );
}

function cnCheck(v) { return v ? 'text-primary' : 'text-muted-foreground'; }