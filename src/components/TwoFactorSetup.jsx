import { useTranslation } from "react-i18next";import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { rootminster } from '@/api/rootminsterClient';
import { toast } from 'sonner';

// Step definitions for the 2FA wizard
const STEPS_ENABLE = [
{ label: 'Scan', aria: 'Step 1: Scan QR Code' },
{ label: 'Verify', aria: 'Step 2: Enter Code' },
{ label: 'Done', aria: 'Step 3: Complete' }];


const ROTATE_WORDS_ENABLE = ['setting up', 'verifying', 'protected'];

// ── Stepper 2 ported to React (faithful to original: circles, connectors, sliding panels) ──
export default function TwoFactorSetup({ user, onUpdated }) {const { t } = useTranslation();
  const enabled = !!user?.totp_enabled;

  // Wizard state
  const [wizardOpen, setWizardOpen] = useState(false);
  const [current, setCurrent] = useState(1);
  const [completed, setCompleted] = useState(false);

  // 2FA data
  const [uri, setUri] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [qrError, setQrError] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pillRef = useRef(null);
  const trackRef = useRef(null);

  const total = STEPS_ENABLE.length;
  const words = ROTATE_WORDS_ENABLE;

  useEffect(() => {
    let active = true;
    if (!uri) {
      setQrCode('');
      setQrError('');
      return () => { active = false; };
    }
    QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 256, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((value) => { if (active) { setQrCode(value); setQrError(''); } })
      .catch(() => { if (active) { setQrCode(''); setQrError('Could not generate the QR code. Use the setup key below instead.'); } });
    return () => { active = false; };
  }, [uri]);

  // measure pill width & content height whenever state changes
  useEffect(() => {
    if (!wizardOpen) return;
    const idx = Math.min(current, words.length) - 1;
    if (trackRef.current) {
      trackRef.current.style.transform = `translateY(calc(var(--st2-rh) * ${-idx}))`;
    }
    if (pillRef.current && trackRef.current) {
      const word = trackRef.current.children[idx];
      if (word) pillRef.current.style.width = Math.ceil(word.getBoundingClientRect().width) + 24 + 'px';
    }

  }, [wizardOpen, current, completed, words.length]);

  // ── Actions ──
  const startSetup = async () => {
    setLoading(true);setError('');
    try {
      const res = await rootminster.functions.invoke('twoFactorAuth', { action: 'setup' });
      setUri(res.data.uri);setSecret(res.data.secret);
      setWizardOpen(true);setCurrent(1);setCompleted(false);setCode('');
    } catch {toast.error(t("operational.two_factor_setup.failed_to_start_2fa_setup_fe0f59"));} finally
    {setLoading(false);}
  };

  const confirmEnable = async () => {
    if (code.length !== 6) {setError('Please enter the 6-digit code from your authenticator app.');return;}
    setLoading(true);setError('');
    try {
      await rootminster.functions.invoke('twoFactorAuth', { action: 'enable', secret, code });
      setCompleted(true);
      onUpdated();
    } catch (e) {setError(e?.response?.data?.error || 'Invalid code — try again.');} finally
    {setLoading(false);}
  };

  const handleNext = () => {
    if (completed) {setWizardOpen(false);setCompleted(false);setCurrent(1);return;}
    if (current === 2) {confirmEnable();return;}
    if (current < total) setCurrent((c) => c + 1);else
    setCompleted(true);
  };

  const handleBack = () => {
    if (completed) {setCurrent(total);setCompleted(false);return;}
    if (current > 1) {setCurrent((c) => c - 1);setError('');}
  };

  const showBack = !completed && current > 1;

  // panel content for each step (enable flow)
  const enablePanels = [
  // step 1: scan
  <div key="scan">
      <h3 className="st2-h">{t("operational.two_factor_setup.scan_with_your_authenticator_57b3ce")}</h3>
      <p className="st2-p mb-3">{t("operational.two_factor_setup.open_google_authenticator_authy_or_1passwo_c77340")}</p>
      {qrCode && <div className="mb-4 flex justify-center"><div className="rounded-xl bg-white p-3 shadow-lg"><img src={qrCode} width="224" height="224" alt="Scan this QR code with your authenticator app" className="block h-56 w-56" /></div></div>}
      {!qrCode && uri && !qrError && <div className="mb-4 flex h-56 items-center justify-center text-sm" style={{ color: 'var(--st2-muted)' }}>Generating QR code…</div>}
      {qrError && <p className="mb-3 text-xs text-amber-300">{qrError}</p>}
      <p className="mb-3 text-center text-xs" style={{ color: 'var(--st2-muted)' }}>The QR code is generated locally in your browser. Your setup secret is never sent to another service.</p>
      <details className="text-xs" style={{ color: 'var(--st2-muted)' }}>
        <summary className="cursor-pointer hover:opacity-80 select-none">Authenticator setup key</summary>
        <code className="mt-2 block font-mono text-sm tracking-wider break-all select-all"
      style={{ background: '#0f172a', color: '#a5b4fc', padding: '10px 12px', borderRadius: 8, display: 'block', marginTop: 8 }}>
          {secret}
        </code>
      </details>
    </div>,
  // step 2: verify
  <div key="verify">
      <h3 className="st2-h">{t("operational.two_factor_setup.enter_your_6_digit_code_a114ed")}</h3>
      <p className="st2-p mb-3">{t("operational.two_factor_setup.type_the_code_shown_in_your_authenticator__f4884e")}</p>
      <input
      type="text"
      inputMode="numeric"
      value={code}
      onChange={(e) => {setCode(e.target.value.replace(/\D/g, '').slice(0, 6));setError('');}}
      onKeyDown={(e) => e.key === 'Enter' && handleNext()}
      placeholder="000000"
      maxLength={6}
      autoFocus
      style={{
        width: 140, textAlign: 'center', letterSpacing: '0.25em',
        fontSize: '1.25rem', fontFamily: 'monospace',
        padding: '8px 12px', borderRadius: 8,
        border: '1px solid rgba(99,102,241,0.4)',
        background: '#0f172a', color: '#e2e8f0', outline: 'none'
      }} />
    
      {error && <p style={{ color: '#f87171', fontSize: '0.82rem', marginTop: 8 }}>{error}</p>}
    </div>,
  // step 3: done
  <div key="done">
      <h3 className="st2-h">{t("operational.two_factor_setup.you_re_all_set_058a81")}</h3>
      <p className="st2-p">{t("operational.two_factor_setup.two_factor_authentication_is_now_active_yo_3297ae")}</p>
    </div>];


  const panels = enablePanels;
  const steps = STEPS_ENABLE;

  const nextLabel = completed ? 'Close' : loading ? 'Please wait…' : current === total ? 'Confirm' : 'Next';

  return (
    <>
      {/* ── CSS scoped to st2- ── */}
      <style>{`
        .st2-card {
          --st2-surface: #1e293b;
          --st2-circle-bg: #334155;
          --st2-lime: #a5b4fc;
          --st2-ink: #f1f5f9;
          --st2-muted: #94a3b8;
          --st2-rh: 1.55em;
          --st2-circle: 38px;
          width: 100%;
          background: var(--st2-surface);
          border-radius: 12px;
          padding: 24px;
          border: 1px solid rgba(99,102,241,0.2);
          color: var(--st2-ink);
          font-weight: 300;
        }
        .st2-rotate {
          display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
          margin: 0 0 28px; font-size: 1.3rem; font-weight: 300;
          letter-spacing: -.02em; line-height: 1.15;
          color: var(--st2-ink);
        }
        .st2-rotate-pill {
          display: inline-block; overflow: hidden; height: var(--st2-rh);
          padding: 0 12px; background: var(--st2-lime); border-radius: 10px;
          color: #0f172a; font-weight: 500; width: max-content;
          transition: width .4s cubic-bezier(.2,.8,.2,1);
        }
        .st2-rotate-track {
          display: inline-block; vertical-align: top;
          transition: transform .5s cubic-bezier(.2,.8,.2,1);
        }
        .st2-rotate-word {
          display: block; width: max-content; height: var(--st2-rh);
          line-height: var(--st2-rh); white-space: nowrap;
        }
        .st2-row { display: flex; align-items: center; margin-bottom: 24px; }
        .st2-step { appearance: none; border: 0; background: none; padding: 0; margin: 0; cursor: pointer; border-radius: 50%; outline: none; }
        .st2-step:focus-visible { outline: 2px solid var(--st2-lime); outline-offset: 2px; }
        .st2-badge {
          position: relative; width: var(--st2-circle); height: var(--st2-circle);
          border-radius: 50%; display: grid; place-items: center;
          background: var(--st2-circle-bg); color: var(--st2-ink);
          font-weight: 500; font-size: .88rem;
          transition: background .3s ease, transform .3s cubic-bezier(.2,.8,.2,1);
        }
        .st2-num { transition: opacity .2s ease; }
        .st2-check { position: absolute; width: 46%; height: 46%; opacity: 0; transition: opacity .2s ease; }
        @keyframes st2-float { 0%,100% { transform: scale(1.06) translateY(0); } 50% { transform: scale(1.06) translateY(-5px); } }
        .st2-step[data-st2-state="active"] .st2-badge { background: var(--st2-lime); color: #0f172a; animation: st2-float 2s ease-in-out infinite; }
        .st2-step[data-st2-state="complete"] .st2-badge { background: var(--st2-lime); color: #0f172a; }
        .st2-step[data-st2-state="complete"] .st2-num { opacity: 0; }
        .st2-step[data-st2-state="complete"] .st2-check { opacity: 1; }
        .st2-step:hover .st2-badge { transform: scale(1.1); }
        .st2-conn { flex: 1 1 auto; min-width: 10px; height: var(--st2-circle); display: flex; align-items: center; margin: 0 -4px; }
        .st2-conn-node { position: relative; flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%; background: var(--st2-circle-bg); border: 1.5px solid var(--st2-surface); z-index: 2; }
        .st2-conn-line { position: relative; flex: 1 1 auto; height: 2px; background-image: radial-gradient(circle, #475569 0.9px, transparent 1.4px); background-size: 7px 2px; background-repeat: repeat-x; background-position: center; }
        .st2-conn-fill { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 0; height: 2px; border-radius: 2px; background: var(--st2-lime); transition: width .45s cubic-bezier(.2,.8,.2,1); }
        .st2-conn.is-complete .st2-conn-fill { width: 100%; }
        .st2-conn.is-next .st2-conn-line { animation: st2-dotmarch 1s linear infinite; }
        .st2-content { position: relative; overflow: hidden; min-height: 80px; }
        .st2-panel-step { transition: transform .4s cubic-bezier(.2,.8,.2,1), opacity .4s ease; transform: translateX(100%); opacity: 0; pointer-events: none; display: none; }
        .st2-panel-step.is-active { transform: translateX(0); opacity: 1; pointer-events: auto; display: block; }
        .st2-panel-step.is-before { transform: translateX(-100%); opacity: 0; pointer-events: none; display: none; }
        .st2-panel-step.is-after  { transform: translateX(100%);  opacity: 0; pointer-events: none; display: none; }
        .st2-done-panel { transform: translateX(100%); opacity: 0; pointer-events: none; display: none; transition: transform .4s cubic-bezier(.2,.8,.2,1), opacity .4s ease; }
        .st2-done-panel.is-show { transform: translateX(0); opacity: 1; pointer-events: auto; display: block; }
        .st2-h { margin: 0 0 8px; font-size: 1.05rem; font-weight: 500; letter-spacing: -.01em; color: #f1f5f9; }
        .st2-p { margin: 0; font-size: .9rem; font-weight: 300; line-height: 1.55; color: #94a3b8; }
        .st2-footer { display: flex; align-items: center; margin-top: 24px; }
        .st2-footer.is-spread { justify-content: space-between; }
        .st2-footer.is-end { justify-content: flex-end; }
        .st2-back { appearance: none; border: 0; background: none; padding: 8px 6px; cursor: pointer; font-size: .9rem; font-weight: 400; color: var(--st2-muted); border-radius: 8px; transition: color .2s ease; }
        .st2-back:hover { color: var(--st2-ink); }
        .st2-next { appearance: none; border: 0; cursor: pointer; font-size: .9rem; font-weight: 500; letter-spacing: -.01em; color: #0f172a; background: var(--st2-lime); padding: 9px 20px; border-radius: 10px; transition: filter .2s ease; }
        .st2-next:hover { filter: brightness(.9); }
        .st2-next:disabled { opacity: .5; cursor: not-allowed; }
        @keyframes st2-dotmarch { from { background-position-x: 0; } to { background-position-x: 7px; } }
        @media (prefers-reduced-motion: reduce) { .st2-conn.is-next .st2-conn-line { animation: none; } }
      `}</style>

      {/* ── Status bar (outside wizard) ── */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 mt-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-700/50 border border-slate-600/30 flex items-center justify-center text-lg">
              🔐
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{t("operational.two_factor_setup.two_factor_authentication_7e60fa")}</p>
              <p className="text-slate-400 text-xs">
                {enabled ? '2FA is active on your account' : 'Secure your account with an authenticator app'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {enabled ?
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"> {t("operational.two_factor_setup.enabled_df174a")} 

            </span> :

            <button
              onClick={startSetup}
              disabled={loading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors">
              
                {loading ? 'Loading…' : 'Enable 2FA'}
              </button>
            }
          </div>
        </div>

        {/* ── Wizard ── */}
        {wizardOpen &&
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="st2-card" style={{ maxWidth: 480, width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
            {/* Rotating headline */}
            <p className="st2-rotate" aria-hidden="true">
              <span>{t("operational.two_factor_setup.you_re_b213ee")}</span>
              <span className="st2-rotate-pill" ref={pillRef}>
                <span className="st2-rotate-track" ref={trackRef}>
                  {words.map((w, i) => <span key={i} className="st2-rotate-word">{w}</span>)}
                </span>
              </span>
            </p>

            {/* Step indicators */}
            <div className="st2-row">
              {steps.map((s, i) => {
                const n = i + 1;
                const state = completed ? 'complete' : n === current ? 'active' : n < current ? 'complete' : 'inactive';
                return [
                <button key={`step-${i}`} type="button" className="st2-step" aria-label={s.aria}
                data-st2-state={state} aria-current={!completed && n === current ? 'step' : 'false'}
                onClick={() => {if (!completed && n <= current) setCurrent(n);}}>
                    <span className="st2-badge">
                      <span className="st2-num">{n}</span>
                      <svg className="st2-check" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </button>,
                i < steps.length - 1 &&
                <span key={`conn-${i}`}
                className={`st2-conn ${completed || current > n ? 'is-complete' : !completed && current === n ? 'is-next' : ''}`}>
                      <span className="st2-conn-node" />
                      <span className="st2-conn-line"><span className="st2-conn-fill" /></span>
                      <span className="st2-conn-node" />
                    </span>];


              })}
            </div>

            {/* Sliding content */}
            <div className="st2-content">
              {panels.map((panel, i) => {
                const n = i + 1;
                const isActive = !completed && n === current;
                const isBefore = completed || n < current;
                return (
                  <div key={i}
                  className={`st2-panel-step ${isActive ? 'is-active' : isBefore ? 'is-before' : 'is-after'}`}
                  role="group" aria-label={steps[i]?.aria}
                  aria-hidden={isActive ? 'false' : 'true'}>
                    {panel}
                  </div>);

              })}
              {/* Completion panel */}
              <div className={`st2-done-panel ${completed ? 'is-show' : ''}`}
              role="group" aria-label={t("operational.two_factor_setup.completed_1798b3")} aria-hidden={completed ? 'false' : 'true'}>
                <h3 className="st2-h">{t("operational.two_factor_setup.all_set_0e0ad7")}</h3>
                <p className="st2-p">{t("operational.two_factor_setup.two_factor_authentication_is_now_active_yo_27cc84")}</p>
              </div>
            </div>

            {/* Footer */}
            <div className={`st2-footer ${showBack ? 'is-spread' : 'is-end'}`}>
              {showBack &&
              <button type="button" className="st2-back" onClick={handleBack}>{t("operational.two_factor_setup.back_b52b36")}</button>
              }
              <button type="button" className="st2-next" onClick={handleNext} disabled={loading}>
                {nextLabel}
              </button>
            </div>
          </div>
          </div>
        }
      </div>
    </>);

}
