import { useEffect, useMemo, useState } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertTriangle, AtSign, ChevronRight, CircleUserRound, Database,
  Globe2, Search, Server, ShieldCheck, UserRound,
} from 'lucide-react';

const normalize = value => String(value || '').trim().toLowerCase().replace(/\.+$/, '');
const belongsTo = (record, ownership) => {
  const recordName = normalize(record.name);
  const ownedName = normalize(ownership.full_name);
  return record.owner_id === ownership.owner_id &&
    (recordName === ownedName || recordName.endsWith(`.${ownedName}`));
};

function StatusPill({ status }) {
  const suspended = status === 'suspended';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${
      suspended
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
        : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
    }`}>
      {suspended ? <AlertTriangle size={11} /> : <ShieldCheck size={11} />}
      {suspended ? 'Suspended' : 'Active'}
    </span>
  );
}

function RecordTable({ records }) {
  if (!records.length) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
        <Database size={26} className="mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">No DNS records</p>
        <p className="mt-1 text-xs text-muted-foreground">This subdomain currently has no managed records.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/25 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">Name</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Value</th>
              <th className="px-3 py-2 text-left font-medium">TTL</th>
              <th className="px-3 py-2 text-left font-medium">Proxy</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map(record => (
              <tr key={record.id} className="border-b border-border/70 last:border-0">
                <td className="px-3 py-3 font-mono text-xs text-foreground">{record.name}</td>
                <td className="px-3 py-3">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{record.record_type}</span>
                </td>
                <td className="max-w-[240px] break-all px-3 py-3 font-mono text-xs text-muted-foreground">{record.content}</td>
                <td className="px-3 py-3 text-xs tabular-nums text-muted-foreground">{record.ttl || 1}s</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{record.proxied ? 'Yes' : 'No'}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{record.status || 'active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminSubdomains() {
  const [ownerships, setOwnerships] = useState([]);
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [owned, dns, userResponse] = await Promise.all([
          rootminster.entities.SubdomainOwnership.list('full_name', 10000),
          rootminster.entities.DnsRecord.filter({ managed: true }, 'name', 10000),
          rootminster.functions.invoke('adminListUsers', {}),
        ]);
        if (!active) return;
        setOwnerships(owned);
        setRecords(dns);
        setUsers(userResponse.data?.users || []);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const userById = useMemo(() => new Map(users.map(user => [user.id, user])), [users]);

  const subdomains = useMemo(() => ownerships.map(ownership => {
    const ownedRecords = records.filter(record => belongsTo(record, ownership));
    return {
      ...ownership,
      user: userById.get(ownership.owner_id),
      records: ownedRecords,
    };
  }).sort((a, b) => normalize(a.full_name).localeCompare(normalize(b.full_name))), [ownerships, records, userById]);

  const zones = useMemo(
    () => [...new Set(subdomains.map(item => item.root_domain).filter(Boolean))].sort(),
    [subdomains]
  );

  const filtered = useMemo(() => {
    const needle = normalize(search);
    return subdomains.filter(item => {
      const matchesSearch = !needle || [
        item.full_name,
        item.owner_email,
        item.user?.display_name,
        item.user?.full_name,
        item.owner_id,
      ].some(value => normalize(value).includes(needle));
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesZone = zoneFilter === 'all' || item.root_domain === zoneFilter;
      return matchesSearch && matchesStatus && matchesZone;
    });
  }, [subdomains, search, statusFilter, zoneFilter]);

  const activeCount = subdomains.filter(item => item.status !== 'suspended').length;
  const suspendedCount = subdomains.length - activeCount;
  const recordCount = subdomains.reduce((total, item) => total + item.records.length, 0);
  const selectedItem = selected ? subdomains.find(item => item.id === selected.id) || selected : null;
  const selectedUser = selectedItem?.user;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-5">
        <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Platform ownership</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">User subdomains</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          View every owned subdomain, its account holder, and the DNS records inside its namespace.
        </p>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card lg:grid-cols-4">
          {[
            { label: 'Subdomains', value: subdomains.length, icon: Globe2 },
            { label: 'Active', value: activeCount, icon: ShieldCheck },
            { label: 'Suspended', value: suspendedCount, icon: AlertTriangle },
            { label: 'DNS records', value: recordCount, icon: Database },
          ].map((item, index) => (
            <div key={item.label} className={`${index > 0 ? 'border-l border-border' : ''} px-4 py-3.5`}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <item.icon size={13} />
                <span className="text-[10px] font-medium uppercase tracking-wide">{item.label}</span>
              </div>
              <p className="mt-1.5 text-xl font-semibold tabular-nums text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 lg:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search subdomain, owner, email or user ID…"
            className="h-8 pl-9 text-xs"
          />
        </div>
        <Select value={zoneFilter} onValueChange={setZoneFilter}>
          <SelectTrigger className="h-8 w-full text-xs lg:w-52"><SelectValue placeholder="All zones" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All zones</SelectItem>
            {zones.map(zone => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-full text-xs lg:w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted-foreground">
            <span><strong className="font-medium text-foreground">{filtered.length}</strong> of {subdomains.length} subdomains</span>
            <span>Click a row for ownership and record details</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-medium">Subdomain</th>
                  <th className="px-4 py-2.5 text-left font-medium">Owner</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-left font-medium">Records</th>
                  <th className="px-4 py-2.5 text-left font-medium">Zone</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const ownerName = item.user?.display_name || item.user?.full_name;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelected(item)}
                      className="group cursor-pointer border-b border-border/70 last:border-0 hover:bg-muted/35"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                            <Globe2 size={14} />
                          </span>
                          <span className="font-mono text-sm font-medium text-foreground">{item.full_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm text-foreground">{ownerName || item.owner_email}</p>
                        {ownerName && <p className="mt-0.5 text-xs text-muted-foreground">{item.owner_email}</p>}
                      </td>
                      <td className="px-4 py-3.5"><StatusPill status={item.status} /></td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Server size={13} /> {item.records.length}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{item.root_domain}</td>
                      <td className="px-4 py-3.5 text-right">
                        <ChevronRight size={15} className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <div className="px-6 py-14 text-center">
              <Search size={28} className="mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No subdomains match these filters.</p>
            </div>
          )}
        </div>
      )}

      <Sheet open={Boolean(selectedItem)} onOpenChange={open => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          {selectedItem && (
            <div className="space-y-6">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2">
                  <StatusPill status={selectedItem.status} />
                  <span className="font-mono text-xs text-muted-foreground">{selectedItem.root_domain}</span>
                </div>
                <SheetTitle className="break-all font-mono text-xl">{selectedItem.full_name}</SheetTitle>
                <SheetDescription>Ownership and DNS information for this platform subdomain.</SheetDescription>
              </SheetHeader>

              <section className="rounded-lg border border-border bg-card p-4">
                <div className="mb-4 flex items-center gap-2">
                  <CircleUserRound size={16} className="text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Owner</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Account</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-foreground">
                      <UserRound size={13} className="text-muted-foreground" />
                      {selectedUser?.display_name || selectedUser?.full_name || 'No display name'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Email</p>
                    <p className="mt-1 flex items-center gap-2 break-all text-sm text-foreground">
                      <AtSign size={13} className="text-muted-foreground" />
                      {selectedItem.owner_email}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">User ID</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{selectedItem.owner_id}</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">DNS records</h2>
                    <p className="mt-1 text-xs text-muted-foreground">All managed records at or below this owned subdomain.</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{selectedItem.records.length} total</span>
                </div>
                <RecordTable records={selectedItem.records} />
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
