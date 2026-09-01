import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { rootminster } from '@/api/rootminsterClient';
import TosModal from '@/components/TosModal';
import TwoFactorChallenge from '@/pages/TwoFactorChallenge';
import TwoFactorSetup from '@/components/TwoFactorSetup';
import CommandPalette from '@/components/CommandPalette';
import ThemeToggle from '@/components/ThemeToggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { CURRENT_TERMS_VERSION } from '@/lib/terms';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Activity, AlertTriangle, Ban, BarChart3, Bell, BookOpen, Boxes, ChevronDown, CircleHelp,
  FileCode2, GitPullRequest, Globe2, LayoutDashboard,
  LogOut, Menu, Newspaper, Search, Settings, Shield, Users, Wrench,
  X,
} from 'lucide-react';

const BRAND_ICON = 'https://media.rootminster.com/images/public/69b6e91dbe1cdaa155ba939d/4f138f748_icon.png';

const userNav = [
  { to: '/user-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/my-subdomains', icon: Globe2, label: 'My Domains' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/my-requests', icon: GitPullRequest, label: 'Requests' },
  { to: '/settings', icon: Settings, label: 'Account Settings' },
];

const resourceNav = [
  { to: '/api-docs', icon: FileCode2, label: 'API Docs' },
  { to: '/guides', icon: BookOpen, label: 'Guides' },
  { to: '/blog', icon: Newspaper, label: 'Blog' },
];

const adminNav = [
  { to: '/admin-dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/admin-requests', icon: GitPullRequest, label: 'Requests' },
  { to: '/admin-subdomains', icon: Globe2, label: 'User Domains' },
  { to: '/admin-users', icon: Users, label: 'Users', adminOnly: true },
  { to: '/admin-abuse-reports', icon: AlertTriangle, label: 'Abuse Reports' },
  { to: '/admin-audit-logs', icon: Activity, label: 'Audit Logs', adminOnly: true },
  { to: '/admin-settings', icon: Settings, label: 'Platform Settings', adminOnly: true },
  { to: '/admin-modules', icon: Boxes, label: 'Module Settings', adminOnly: true },
];

function NavItem({ item, active, onNavigate }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        'group flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary dark:bg-primary/15'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      <Icon size={16} strokeWidth={1.8} className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function ProductSidebar({ user, mobile, onClose }) {
  const location = useLocation();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const privileged = isAdmin || isStaff;
  const active = (to) => location.pathname === to || (to !== '/user-dashboard' && location.pathname.startsWith(to));
  const adminItems = adminNav.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className={cn(
      'flex h-full w-[244px] shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground',
      mobile ? 'w-[min(86vw,280px)] shadow-2xl' : 'hidden lg:flex'
    )}>
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <Link to="/user-dashboard" onClick={onClose} className="flex min-w-0 items-center gap-2.5">
          <img src={BRAND_ICON} alt="OpenDomains" className="h-8 w-8 rounded-md bg-white p-0.5 object-contain" />
          <span className="truncate text-sm font-semibold tracking-tight text-foreground">OpenDomains</span>
        </Link>
        {mobile && (
          <button onClick={onClose} className="ml-auto flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted" aria-label="Close navigation"><X size={17} /></button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {userNav.map(item => <NavItem key={item.to} item={item} active={active(item.to)} onNavigate={onClose} />)}
        </div>

        <div className="my-4 border-t border-sidebar-border" />
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground/70">Resources</p>
        <div className="space-y-1">
          {resourceNav.map(item => <NavItem key={item.to} item={item} active={active(item.to)} onNavigate={onClose} />)}
        </div>

        {privileged && (
          <>
            <div className="my-4 border-t border-sidebar-border" />
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[.14em] text-muted-foreground/70">{isAdmin ? 'Admin' : 'Staff'}</p>
            <div className="space-y-1">
              {adminItems.map(item => <NavItem key={item.to} item={item} active={active(item.to)} onNavigate={onClose} />)}
            </div>
          </>
        )}
      </div>

    </aside>
  );
}

export default function Layout() {
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [bannerText, setBannerText] = useState('');
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [showTos, setShowTos] = useState(false);
  const [tosIsUpdate, setTosIsUpdate] = useState(false);
  const [twoFaVerified, setTwoFaVerified] = useState(false);
  const [twoFaPending, setTwoFaPending] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';
  const isPrivileged = isAdmin || isStaff;

  useEffect(() => {
    rootminster.auth.me().then(async u => {
      setUser(u);
      setTwoFaVerified(Boolean(u.mfa_verified));
      setAuthChecked(true);
      if (u.tos_accepted_version !== CURRENT_TERMS_VERSION) {
        setTosIsUpdate(Boolean(u.tos_accepted_at));
        setShowTos(true);
      }
      if (u?.mfa_required && !u?.mfa_verified) {
        const trustedToken = localStorage.getItem('od_trusted_device');
        if (trustedToken) {
          setTwoFaPending(true);
          try {
            const res = await rootminster.functions.invoke('twoFactorAuth', { action: 'verify_trusted', device_token: trustedToken });
            if (res.data?.valid) {
              sessionStorage.setItem('2fa_verified', '1');
              setTwoFaVerified(true);
            } else localStorage.removeItem('od_trusted_device');
          } catch {
            localStorage.removeItem('od_trusted_device');
          }
          setTwoFaPending(false);
        }
      }
    }).catch(() => rootminster.auth.redirectToLogin(window.location.href));

    rootminster.entities.PlatformSettings.filter({ key: 'maintenance_mode' }).then(r => setMaintenanceMode(r?.[0]?.value === 'true'));
    rootminster.entities.PlatformSettings.filter({ key: 'maintenance_message' }).then(r => setMaintenanceMessage(r?.[0]?.value || ''));
    rootminster.entities.PlatformSettings.filter({ key: 'notification_banner_enabled' }).then(r => setBannerEnabled(r?.[0]?.value === 'true'));
    rootminster.entities.PlatformSettings.filter({ key: 'notification_banner_text' }).then(r => setBannerText(r?.[0]?.value || ''));
  }, []);

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!authChecked || twoFaPending) return <div className="fixed inset-0 flex items-center justify-center bg-background"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  if (isPrivileged && !user?.totp_enabled) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card"><Shield size={23} className="text-primary" /></div>
          <h1 className="text-xl font-semibold text-foreground">2FA Required</h1>
          <p className="mt-2 text-sm text-muted-foreground">Staff and admin accounts must enable two-factor authentication.</p>
        </div>
        <TwoFactorSetup user={user} onUpdated={() => { setUser(u => ({ ...u, totp_enabled: true, mfa_verified: true })); setTwoFaVerified(true); }} />
        <button onClick={() => rootminster.auth.logout()} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">Sign out</button>
      </div>
    </div>
  );

  if (user?.totp_enabled && !twoFaVerified) return <TwoFactorChallenge onVerified={() => setTwoFaVerified(true)} onLogout={() => { sessionStorage.removeItem('2fa_verified'); rootminster.auth.logout(); }} />;

  if (user?.status === 'disabled') return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6 text-center">
      <Ban size={32} className="mb-5 text-destructive" /><h1 className="text-xl font-semibold">Account Disabled</h1><p className="mt-2 max-w-md text-sm text-muted-foreground">Your account has been disabled. Contact support if you think this is a mistake.</p>
      <button onClick={() => rootminster.auth.logout()} className="mt-6 text-sm text-muted-foreground underline">Sign out</button>
    </div>
  );

  if (maintenanceMode && !isAdmin) return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6 text-center">
      <Wrench size={30} className="mb-5 text-primary" /><h1 className="text-xl font-semibold">Maintenance</h1><p className="mt-2 max-w-md text-sm text-muted-foreground">{maintenanceMessage || 'OpenDomains is temporarily unavailable while maintenance is completed.'}</p>
      <button onClick={() => rootminster.auth.logout()} className="mt-6 text-sm text-muted-foreground underline">Sign out</button>
    </div>
  );

  const initials = ((user?.display_name || user?.full_name || user?.email || 'U')[0] || 'U').toUpperCase();
  const displayName = user?.display_name || user?.full_name || 'User';
  const cmdItems = [...userNav, ...resourceNav, ...(isPrivileged ? adminNav.filter(i => !i.adminOnly || isAdmin) : [])];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TosModal open={showTos} isUpdate={tosIsUpdate} onAccepted={() => setShowTos(false)} />

      <div className="flex min-h-screen">
        <ProductSidebar user={user} />

        {mobileNav && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileNav(false)} />
            <div className="relative"><ProductSidebar user={user} mobile onClose={() => setMobileNav(false)} /></div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/92 px-3 backdrop-blur-xl sm:h-16 sm:gap-3 sm:px-6 lg:px-7">
            <button onClick={() => setMobileNav(true)} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" aria-label="Open navigation"><Menu size={18} /></button>

            <button onClick={() => setCmdOpen(true)} className="flex h-9 w-9 min-w-0 flex-none items-center justify-center gap-2.5 rounded-md border border-border bg-card px-0 text-sm text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted/30 min-[480px]:w-auto min-[480px]:flex-1 min-[480px]:justify-start min-[480px]:px-3 sm:max-w-md">
              <Search size={15} className="shrink-0" /><span className="hidden truncate min-[480px]:inline">Search domains...</span><kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
            </button>

            <div className="ml-auto flex items-center gap-1.5">
              <ThemeToggle compact className="hidden min-[390px]:inline-flex" />
              <div className="hidden xl:block"><LanguageSwitcher /></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Bell size={17} />
                    {bannerEnabled && bannerText && !bannerDismissed && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Notifications</DropdownMenuLabel><DropdownMenuSeparator />
                  {bannerEnabled && bannerText ? <div className="px-2 py-2 text-sm">{bannerText}</div> : <div className="px-2 py-3 text-sm text-muted-foreground">You're all caught up.</div>}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ml-0 flex items-center gap-2 rounded-md p-0.5 hover:bg-muted sm:ml-1 sm:p-1 sm:pr-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">{initials}</span>
                    <span className="hidden text-left sm:block"><span className="block max-w-[120px] truncate text-xs font-medium text-foreground">{displayName}</span><span className="block text-[10px] capitalize text-muted-foreground">{user?.role || 'user'}</span></span>
                    <ChevronDown size={13} className="hidden text-muted-foreground sm:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel><DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/settings"><Settings size={14} className="mr-2" />Settings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/contact"><CircleHelp size={14} className="mr-2" />Support</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => rootminster.auth.logout()} className="text-destructive"><LogOut size={14} className="mr-2" />Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {bannerEnabled && bannerText && !bannerDismissed && (
            <div className="border-b border-primary/20 bg-primary/5 px-4 py-2.5 text-xs text-foreground sm:px-6 lg:px-7">
              <div className="flex items-center gap-3"><span className="flex-1">{bannerText}</span><button onClick={() => setBannerDismissed(true)} className="text-muted-foreground hover:text-foreground">Dismiss</button></div>
            </div>
          )}

          <main className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-6 sm:py-6 lg:px-7 lg:py-7">
            <Outlet />
          </main>
        </div>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} items={cmdItems} />
    </div>
  );
}
