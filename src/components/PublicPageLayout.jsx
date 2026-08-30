import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeToggle from '@/components/ThemeToggle';

export function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://media.rootminster.com/images/public/69b6e91dbe1cdaa155ba939d/4f138f748_icon.png" alt="Open Domains" className="w-8 h-8 rounded-md object-contain bg-white p-0.5" />
          <span className="hidden min-[360px]:inline font-semibold text-foreground tracking-tight">Open Domains</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
          <Link to="/how-it-works" className="hover:text-foreground transition-colors">{t('nav.howItWorks')}</Link>
          <Link to="/guides" className="hover:text-foreground transition-colors">{t('nav.guides')}</Link>
          <Link to="/blog" className="hover:text-foreground transition-colors">{t('nav.blog')}</Link>
          <Link to="/faq" className="hover:text-foreground transition-colors">{t('nav.faq')}</Link>
          <Link to="/about" className="hover:text-foreground transition-colors">{t('nav.about')}</Link>
          <a href="https://discord.gg/rRjgTNxhx9" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
            {t('nav.discord')}
          </a>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle compact className="hidden sm:inline-flex" />
          <LanguageSwitcher className="hidden md:flex" />
          <Link to="/dashboard" className="hidden sm:block">
            <Button variant="ghost" size="sm">{t('nav.signIn')}</Button>
          </Link>
          <Link to="/dashboard">
            <Button size="sm">{t('nav.getStarted')}</Button>
          </Link>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-colors ml-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
            </svg>
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-background px-3 py-3 space-y-1">
          <Link to="/how-it-works" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.howItWorks')}</Link>
          <Link to="/guides" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.guides')}</Link>
          <Link to="/blog" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.blog')}</Link>
          <Link to="/faq" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.faq')}</Link>
          <Link to="/about" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.about')}</Link>
          <a href="https://discord.gg/rRjgTNxhx9" target="_blank" rel="noopener noreferrer" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.discord')}</a>
          <Link to="/dashboard" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-foreground hover:text-foreground hover:bg-muted rounded-md text-sm transition-colors">{t('nav.signIn')}</Link>
          <div className="px-3 py-2"><LanguageSwitcher /></div>
        </div>
      )}
    </nav>
  );
}

export function PublicFooter() {
  const { t } = useTranslation();
  return (
    <footer className="mt-20 border-t border-border bg-card py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-5 gap-y-8 sm:gap-8 mb-10">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img src="https://media.rootminster.com/images/public/69b6e91dbe1cdaa155ba939d/4f138f748_icon.png" alt="Open Domains" className="w-7 h-7 rounded-md object-contain bg-white p-0.5" />
              <span className="font-semibold text-foreground text-sm">Open Domains</span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed">{t('footer.tagline')}</p>
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold mb-3">{t('footer.platform')}</p>
            <div className="space-y-2">
              <Link to="/how-it-works" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.howItWorks')}</Link>
              <Link to="/faq" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.faq')}</Link>
              <Link to="/dashboard" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.dashboard')}</Link>
            </div>
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold mb-3">{t('footer.learn')}</p>
            <div className="space-y-2">
              <Link to="/guides" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.allGuides')}</Link>
              <Link to="/blog" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('nav.blog')}</Link>
              <Link to="/guides/dns-basics/what-is-dns" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.whatIsDns')}</Link>
            </div>
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold mb-3">{t('footer.company')}</p>
            <div className="space-y-2">
              <Link to="/about" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('nav.about')}</Link>
              <Link to="/contact" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.contact')}</Link>
              <Link to="/report-abuse" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.reportAbuse')}</Link>
              <a href="https://discord.gg/rRjgTNxhx9" target="_blank" rel="noopener noreferrer" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('nav.discord')}</a>
            </div>
          </div>
          <div>
            <p className="text-foreground text-sm font-semibold mb-3">{t('footer.legal')}</p>
            <div className="space-y-2">
              <Link to="/privacy-policy" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.privacyPolicy')}</Link>
              <Link to="/terms-of-service" className="block text-muted-foreground hover:text-foreground text-xs transition-colors">{t('footer.termsOfService')}</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-muted-foreground text-xs">{t('footer.rights')}</p>
          <p className="text-muted-foreground text-xs">{t('footer.poweredBy')}</p>
        </div>
      </div>
    </footer>
  );
}

const PUB_ID = "ca-pub-3119327652471615";

export function AdSenseBanner({ slot = "0000000000" }) {
  return (
    <div className="my-4 flex justify-center overflow-hidden">
      <ins className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={PUB_ID}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true" />
    </div>
  );
}

export function ArticleAdSense({ slot = "0000000001" }) {
  return (
    <div className="my-8 flex justify-center overflow-hidden">
      <ins className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-client={PUB_ID}
        data-ad-slot={slot}
        data-ad-format="fluid"
        data-ad-layout="in-article" />
    </div>
  );
}