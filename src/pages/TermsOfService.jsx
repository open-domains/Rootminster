import { PublicFooter, PublicNav } from '@/components/PublicPageLayout';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import TermsContent from '@/components/TermsContent';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';



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
                  <div className="text-xs text-slate-400">
                    <span id="terms-version-label">View Version</span>
                    <Select value={terms.version} onValueChange={(version) => setSearchParams(version === currentVersion ? {} : { version })}>
                      <SelectTrigger aria-labelledby="terms-version-label" className="mt-1 h-auto min-w-44 border-slate-700 bg-slate-900 py-2 text-sm text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-700 bg-slate-900 text-white">
                        {versions.map((item) => (
                          <SelectItem key={item.id} value={item.version} className="focus:bg-slate-800 focus:text-white">
                            {item.version}{item.is_current ? ' (current)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {terms.summary && <p className="mt-6 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm leading-relaxed text-slate-300">{terms.summary}</p>}
            </div>

            <TermsContent className="text-base [--foreground:210_40%_98%] [--muted-foreground:215_20%_65%] [--primary:239_84%_67%]">{terms.content}</TermsContent>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
