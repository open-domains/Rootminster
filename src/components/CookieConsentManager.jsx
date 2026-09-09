import { useEffect, useState } from 'react';
import { Cookie, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { disableAnalytics, enableAnalytics, trackConsentPageView } from '@/lib/consent-analytics';
import { readCookieConsent, saveCookieConsent } from '@/lib/cookie-consent';

export default function CookieConsentManager() {
  const location = useLocation();
  const [consent, setConsent] = useState(() => readCookieConsent());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(() => Boolean(readCookieConsent()?.analytics));

  useEffect(() => {
    const open = () => {
      setAnalytics(Boolean(readCookieConsent()?.analytics));
      setSettingsOpen(true);
    };
    window.addEventListener('rootminster:open-cookie-settings', open);
    return () => window.removeEventListener('rootminster:open-cookie-settings', open);
  }, []);

  useEffect(() => {
    if (consent?.analytics) enableAnalytics();
    else disableAnalytics();
  }, [consent]);

  useEffect(() => {
    if (consent?.analytics) trackConsentPageView(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search, consent?.analytics]);

  const choose = (allowAnalytics) => {
    const previous = consent;
    const saved = saveCookieConsent({ analytics: allowAnalytics });
    setConsent(saved);
    setAnalytics(allowAnalytics);
    setSettingsOpen(false);
    if (previous?.analytics && !allowAnalytics) {
      disableAnalytics();
      window.location.reload();
    }
  };

  return (
    <>
      {!consent && (
        <section role="dialog" aria-label="Cookie consent" aria-live="polite" className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-3xl rounded-xl border border-border bg-card p-5 shadow-2xl sm:bottom-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Cookie size={18} /></div>
              <div>
                <h2 className="font-semibold text-foreground">Your privacy choices</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">We use essential storage for sign-in and security. With your permission, we also use self-hosted Umami and Google Analytics to understand how the platform is used.</p>
                <Link to="/cookie-policy" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">Read the Cookie Policy</Link>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-2 md:w-72">
              <Button variant="outline" onClick={() => choose(false)}>Reject analytics</Button>
              <Button onClick={() => choose(true)}>Accept analytics</Button>
              <Button variant="ghost" onClick={() => setSettingsOpen(true)} className="col-span-2">Customise settings</Button>
            </div>
          </div>
        </section>
      )}

      {consent && (
        <button type="button" onClick={() => setSettingsOpen(true)} className="fixed bottom-3 left-3 z-40 inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground shadow-lg transition-colors hover:text-foreground" aria-label="Open cookie settings">
          <Cookie size={14} /> Cookie settings
        </button>
      )}

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Cookie size={17} /> Cookie settings</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Choose whether optional analytics may run. You can change this choice at any time.</p>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                <div><p className="text-sm font-medium text-foreground">Essential</p><p className="mt-1 text-xs text-muted-foreground">Authentication, security, consent, language and interface preferences. Always active.</p></div>
              </div>
              <span className="text-xs font-medium text-emerald-500">Always on</span>
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div><p className="text-sm font-medium text-foreground">Analytics</p><p className="mt-1 text-xs text-muted-foreground">Umami and Google Analytics. Helps us measure visits and improve Rootminster.</p></div>
              <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="Allow analytics" />
            </label>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Link to="/cookie-policy" onClick={() => setSettingsOpen(false)} className="self-center text-xs font-medium text-primary hover:underline">Full Cookie Policy</Link>
            <div className="flex gap-2"><Button variant="outline" onClick={() => choose(false)} className="flex-1">Reject analytics</Button><Button onClick={() => choose(analytics)} className="flex-1">Save choices</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
