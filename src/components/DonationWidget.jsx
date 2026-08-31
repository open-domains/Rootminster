import { useState, useEffect } from 'react';
import { rootminster } from '@/api/rootminsterClient';
import { Button } from '@/components/ui/button';
import { Heart, Unlock, CreditCard, CheckCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { usePublicConfig } from '@/lib/public-config';

const AMOUNTS = [
  { pence: 100, label: '£1.00' },
  { pence: 200, label: '£2.00' },
  { pence: 500, label: '£5.00' },
  { pence: 1000, label: '£10.00' },
];

export default function DonationWidget({ user }) {
  const { config } = usePublicConfig();
  const donationsEnabled = config.features.donations;
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(200);

  const load = async () => {
    try {
      const all = await rootminster.entities.Donation.filter({ user_email: user.email, status: 'succeeded' });
      setDonations(all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (donationsEnabled && user?.email) load();
    if (!donationsEnabled) setLoading(false);
  }, [donationsEnabled, user?.email]);

  const totalPence = donations.reduce((s, d) => s + (d.amount_pence || 0), 0);
  const nsUnlocked = user?.ns_unlocked || totalPence >= 200;
  const remaining = Math.max(0, 200 - totalPence);

  const handleDonate = async () => {
    setDonating(true);
    try {
      const res = await rootminster.functions.invoke('createDonationSession', {
        amount_pence: selectedAmount
      });
      if (res.data?.url) {
        window.location.href = res.data.url;
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to create donation session. Check Stripe is configured.');
    } finally {
      setDonating(false);
    }
  };

  if (!donationsEnabled) return null;
  if (loading) return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4">
      {/* NS unlock status */}
      <div className={`rounded-xl border p-4 ${nsUnlocked ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
        <div className="flex items-center gap-3">
          {nsUnlocked ? (
            <CheckCircle size={20} className="text-emerald-400 shrink-0" />
          ) : (
            <Unlock size={20} className="text-indigo-400 shrink-0" />
          )}
          <div>
            <p className={`font-semibold text-sm ${nsUnlocked ? 'text-emerald-300' : 'text-indigo-300'}`}>
              {nsUnlocked ? 'NS Records Unlocked!' : 'Unlock NS Records'}
            </p>
            <p className={`text-xs mt-0.5 ${nsUnlocked ? 'text-emerald-400/70' : 'text-indigo-400/70'}`}>
              {nsUnlocked
                ? `You've donated £${(totalPence / 100).toFixed(2)} total. NS records are available in the request form.`
                : remaining > 0
                  ? `Donate £${(remaining / 100).toFixed(2)} more to unlock NS record requests (total: £${(totalPence / 100).toFixed(2)}/£2.00)`
                  : 'Donate £2 total to unlock NS record delegation.'}
            </p>
          </div>
        </div>
      </div>

      {/* Donation form */}
      {!nsUnlocked && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-pink-400" />
            <h3 className="text-white font-semibold text-sm">Make a Donation</h3>
          </div>
          <p className="text-slate-400 text-xs">Donations help keep Open Domains running. Donate £2+ total to unlock NS record requests.</p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AMOUNTS.map(a => (
              <button
                key={a.pence}
                type="button"
                onClick={() => setSelectedAmount(a.pence)}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-all ${
                  selectedAmount === a.pence
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-indigo-500/50'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>

          <Button onClick={handleDonate} disabled={donating}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            {donating ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            {donating ? 'Redirecting to Stripe…' : `Donate £${(selectedAmount / 100).toFixed(2)}`}
          </Button>
        </div>
      )}

      {/* Donation history */}
      {donations.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <h3 className="text-white font-semibold text-sm">Donation History</h3>
          </div>
          <div className="divide-y divide-slate-700/30">
            {donations.map(d => (
              <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-white text-sm font-medium">£{(d.amount_pence / 100).toFixed(2)}</p>
                  <p className="text-slate-500 text-xs">{d.created_date ? format(new Date(d.created_date), 'MMM d, yyyy') : '—'}</p>
                </div>
                <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Succeeded
                </span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-900/30">
            <p className="text-slate-300 text-sm">Total donated: <span className="text-white font-semibold">£{(totalPence / 100).toFixed(2)}</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
