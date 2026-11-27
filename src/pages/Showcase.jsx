import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { PublicFooter, PublicNav } from '@/components/PublicPageLayout';
import { rootminster } from '@/api/rootminsterClient';

export default function Showcase() {
  const [listings, setListings] = useState(null);
  const [error, setError] = useState('');
  const [tag, setTag] = useState('');

  useEffect(() => {
    rootminster.functions.invoke('getShowcase', {})
      .then((response) => setListings(response.data?.listings || []))
      .catch(() => setError('The showcase could not be loaded. Try again shortly.'));
  }, []);

  const tags = useMemo(() => [...new Set((listings || []).flatMap((item) => item.tags))].sort(), [listings]);
  const shown = (listings || []).filter((item) => !tag || item.tags.includes(tag));

  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
        <h1 className="text-4xl font-bold text-white mb-3 flex items-center gap-3"><Sparkles size={28} className="text-indigo-400" /> Showcase</h1>
        <p className="text-slate-400 text-lg mb-8 max-w-2xl leading-relaxed">Projects people have built on Open Domains subdomains. Owners choose to be listed, and every listing is reviewed by our team.</p>

        {tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
            <button type="button" onClick={() => setTag('')} aria-pressed={!tag} className={`rounded-full border px-3 py-1 text-xs ${!tag ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>All</button>
            {tags.map((item) => (
              <button key={item} type="button" onClick={() => setTag(item)} aria-pressed={tag === item} className={`rounded-full border px-3 py-1 text-xs ${tag === item ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200' : 'border-slate-700 text-slate-400 hover:text-white'}`}>{item}</button>
            ))}
          </div>
        )}

        {error && <p role="alert" className="text-sm text-slate-300">{error}</p>}
        {!error && listings === null && <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>}
        {listings && listings.length === 0 && (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-8 text-center text-sm text-slate-400">
            Nothing is listed yet. If you host a project on Open Domains, you can submit it from your subdomain's DNS manager.
          </div>
        )}
        {shown.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((item) => (
              <li key={item.hostname} className="flex flex-col rounded-xl border border-slate-700/50 bg-slate-800/50 p-5">
                <h2 className="text-base font-semibold text-white">{item.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{item.description}</p>
                {item.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{item.tags.map((value) => <span key={value} className="rounded bg-slate-700/60 px-2 py-0.5 text-[11px] text-slate-300">{value}</span>)}</div>}
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-700/50 pt-3 text-xs">
                  <a href={item.url} target="_blank" rel="nofollow ugc noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 font-mono text-indigo-300 hover:underline">
                    <span className="truncate">{item.hostname}</span> <ExternalLink size={11} className="shrink-0" />
                  </a>
                  {item.owner && <span className="shrink-0 text-slate-500">by {item.owner}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-xs text-slate-500">Listed sites are run by their owners, not by Open Domains. See something wrong? <Link to="/report-abuse" className="text-indigo-300 hover:underline">Report it</Link>.</p>
      </main>
      <PublicFooter />
    </div>
  );
}
