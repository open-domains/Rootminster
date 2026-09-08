import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Layers, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { rootminster } from '@/api/rootminsterClient';
import TermsContent from '@/components/TermsContent';

function PublicNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600"><Layers size={16} className="text-white" /></div>
          <span className="font-bold text-white">Open Domains</span>
        </Link>
        <Link to="/dashboard"><Button size="sm" className="bg-indigo-600 text-white hover:bg-indigo-700">Get Started</Button></Link>
      </div>
    </nav>
  );
}

function displayDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date(value));
}

export default function TermsOfService() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedVersion = searchParams.get('version');
  const [terms, setTerms] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      requestedVersion ? rootminster.terms.getPublished(requestedVersion) : rootminster.terms.current(),
      rootminster.terms.published(),
    ]).then(([loadedTerms, rows]) => {
      if (!active) return;
      setTerms(loadedTerms);
      setVersions(rows);
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Could not load the Terms of Service.');
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [requestedVersion]);

  const currentVersion = versions.find((item) => item.is_current)?.version;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6 sm:py-20">
        {loading ? <div className="flex justify-center py-24"><Loader2 className="animate-spin text-slate-500" /></div> : error ? (
          <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-200">{error}</div>
        ) : (
          <>
            <div className="mb-10 border-b border-slate-800 pb-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                <div>
                  <h1 className="text-4xl font-bold text-white">{terms.title}</h1>
                  <p className="mt-2 text-sm text-slate-500">Version {terms.version} · Effective {displayDate(terms.effective_at || terms.published_at)}</p>
                  {!terms.is_current && <p className="mt-2 text-sm font-medium text-amber-400">You are viewing a previous version.</p>}
                </div>
                {versions.length > 1 && (
                  <label className="text-xs text-slate-400">
                    View version
                    <select value={terms.version} onChange={(event) => setSearchParams(event.target.value === currentVersion ? {} : { version: event.target.value })} className="mt-1 block min-w-44 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white">
                      {versions.map((item) => <option key={item.id} value={item.version}>{item.version}{item.is_current ? ' (current)' : ''}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {terms.summary && <p className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-300">{terms.summary}</p>}
            </div>

            <TermsContent className="text-base [--foreground:210_40%_98%] [--muted-foreground:215_20%_65%] [--primary:239_84%_67%]">{terms.content}</TermsContent>
          </>
        )}
      </main>
    </div>
  );
}
