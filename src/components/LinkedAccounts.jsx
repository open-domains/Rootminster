import { useEffect, useState } from 'react';
import { Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import GoogleIcon from '@/components/GoogleIcon';
import Github from '@/components/GithubIcon';
import DiscordIcon from '@/components/DiscordIcon';

const ICONS = {
  google: () => <GoogleIcon className="h-5 w-5" />,
  github: () => <Github className="h-5 w-5" size={20} />,
  discord: () => <DiscordIcon className="h-5 w-5 text-[#5865F2]" />,
};

export const LINK_ERRORS = {
  in_use: 'That account is already linked to a different user. Sign in to that user and unlink it there first.',
  provider_taken: 'You already have an account linked for this provider. Unlink it before linking another one.',
  session: 'Your session changed while linking. Sign in again and retry from this page.',
  provider: 'The provider did not complete sign-in. Please try again.',
  cancelled: 'Linking was cancelled.',
};

export default function LinkedAccounts({ linkedProvider, linkError }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');

  const load = async () => setData(await rootminster.identities.list());

  useEffect(() => {
    load().catch(() => toast.error('Could not load linked accounts'));
  }, []);

  useEffect(() => {
    if (linkedProvider) toast.success('Account linked. You can now sign in with it.');
    else if (linkError) toast.error(LINK_ERRORS[linkError] || 'Could not link that account');
  }, [linkedProvider, linkError]);

  const link = async (provider) => {
    setBusy(provider);
    try {
      await rootminster.identities.startLink(provider);
    } catch (error) {
      toast.error(error.message || 'Could not start linking');
      setBusy('');
    }
  };

  const unlink = async (item) => {
    if (!window.confirm(`Unlink your ${item.label} account? You will no longer be able to sign in with it unless its email matches your account email.`)) return;
    setBusy(item.provider);
    try {
      await rootminster.identities.unlink(item.provider);
      await load();
      toast.success(`${item.label} account unlinked`);
    } catch (error) {
      toast.error(error.message || 'Could not unlink account');
    } finally {
      setBusy('');
    }
  };

  const linkedCount = data?.providers.filter((item) => item.linked).length || 0;
  const otherMethods = (data?.has_password ? 1 : 0) + (data?.passkeys || 0);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground"><Link2 size={14} /> Linked accounts</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">Sign in with any of these accounts, even if its email is different from your Rootminster email. Each account can only be linked to one user.</p>
      </div>
      <div className="space-y-2 p-5">
        {!data ? (
          <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
        ) : data.providers.map((item) => {
          const Icon = ICONS[item.provider];
          const isLast = item.linked && linkedCount === 1 && otherMethods === 0;
          if (!item.linked && !item.available) return null;
          return (
            <div key={item.provider} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/60">{Icon && <Icon />}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {item.linked
                      ? [item.linked.username || item.linked.email, `Linked ${new Date(item.linked.linked_at).toLocaleDateString()}`].filter(Boolean).join(' · ')
                      : 'Not linked'}
                  </p>
                </div>
              </div>
              {item.linked ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 sm:w-auto"
                  disabled={Boolean(busy) || isLast}
                  title={isLast ? 'This is your only sign-in method' : undefined}
                  onClick={() => unlink(item)}
                >
                  {busy === item.provider ? <Loader2 size={14} className="animate-spin" /> : <Unlink size={14} />} Unlink
                </Button>
              ) : (
                <Button size="sm" className="gap-2 sm:w-auto" disabled={Boolean(busy)} onClick={() => link(item.provider)}>
                  {busy === item.provider ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Link {item.label}
                </Button>
              )}
            </div>
          );
        })}
        {data && !data.providers.some((item) => item.linked || item.available) && (
          <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">No social sign-in providers are enabled on this server.</p>
        )}
        {data && linkedCount > 0 && otherMethods === 0 && linkedCount === 1 && (
          <p className="text-xs text-muted-foreground">This is your only way to sign in, so it can't be unlinked. Link another account, add a passkey, or set a password with “Forgot password” first.</p>
        )}
      </div>
    </section>
  );
}
