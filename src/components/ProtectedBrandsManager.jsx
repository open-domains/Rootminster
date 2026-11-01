import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { matchProtectedBrand, normaliseBrandList, parseBrandList } from '../../shared/brand-protection.js';

export default function ProtectedBrandsManager() {
  const [saved, setSaved] = useState('');
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testName, setTestName] = useState('');

  useEffect(() => {
    rootminster.functions.invoke('manageProtectedBrands', { action: 'get' })
      .then(({ data }) => { setSaved(data.value || ''); setDraft(data.value || ''); })
      .catch(() => toast.error('Could not load protected brands'))
      .finally(() => setLoading(false));
  }, []);

  const parsed = useMemo(() => parseBrandList(draft), [draft]);
  const dirty = normaliseBrandList(draft) !== saved;
  const testMatch = testName.trim() ? matchProtectedBrand(testName.trim().toLowerCase(), parsed) : null;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await rootminster.functions.invoke('manageProtectedBrands', { action: 'save', value: draft });
      setSaved(data.value || '');
      setDraft(data.value || '');
      toast.success('Protected brands saved');
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Could not save protected brands');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <BadgeCheck size={16} className="text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Protected brands</h2>
          <p className="text-xs text-muted-foreground">Users can't register subdomains that imitate these names. Staff and admins still can.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="protected-brands" className="text-xs">One brand per line</Label>
            <Textarea
              id="protected-brands"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={'minecraft\npaypal\n!pineapple'}
              className="min-h-[160px] font-mono text-sm"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              A brand blocks names that are the brand, start or end with it, or contain it as a word, including digit swaps like <code className="text-foreground/80">m1necraft</code>.
              Start a line with <code className="text-foreground/80">!</code> to allow one exact name, e.g. <code className="text-foreground/80">!pineapple</code> when <code className="text-foreground/80">apple</code> is protected.
            </p>
            <p className="text-xs text-muted-foreground">{parsed.brands.length} brand{parsed.brands.length === 1 ? '' : 's'} · {parsed.allowed.length} allowed name{parsed.allowed.length === 1 ? '' : 's'}</p>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
            <Label htmlFor="protected-brands-test" className="text-xs">Test a subdomain</Label>
            <Input
              id="protected-brands-test"
              value={testName}
              onChange={(event) => setTestName(event.target.value)}
              placeholder="e.g. minecraft-server"
              className="font-mono"
            />
            {testName.trim() && (
              <p className={`text-xs ${testMatch ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {testMatch ? `Blocked: looks like "${testMatch}".` : 'Allowed: no protected brand matches.'}
              </p>
            )}
          </div>

          <Button type="button" onClick={save} disabled={saving || !dirty} className="gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save protected brands
          </Button>
        </div>
      )}
    </div>
  );
}
