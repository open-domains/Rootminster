import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/lib/AuthContext';
import { Toaster as SonnerToaster } from 'sonner';

// Layout
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';
import SetupGate from '@/components/SetupGate';
import BrandRuntime from '@/components/BrandRuntime';
import AppErrorBoundary from '@/components/AppErrorBoundary';

const PageNotFound = lazy(() => import('./lib/PageNotFound'));

// Auth pages
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const Setup = lazy(() => import('@/pages/Setup'));

// Public pages (no layout)
const Landing = lazy(() => import('@/pages/Landing'));
const HowItWorks = lazy(() => import('@/pages/HowItWorks'));
const FAQ = lazy(() => import('@/pages/FAQ'));
const About = lazy(() => import('@/pages/About'));
const Contact = lazy(() => import('@/pages/Contact'));
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/TermsOfService'));
const ReportAbuse = lazy(() => import('@/pages/ReportAbuse'));
const RdapLookup = lazy(() => import('@/pages/RdapLookup'));
const Activate = lazy(() => import('@/pages/Activate'));
const ApiDocs = lazy(() => import('@/pages/ApiDocs'));

// Guides & Blog
const GuidesIndex = lazy(() => import('@/pages/GuidesIndex'));
const BlogIndex = lazy(() => import('@/pages/BlogIndex'));
// DNS Basics guides
const WhatIsDns = lazy(() => import('@/pages/guides/WhatIsDns'));
const WhatIsNameserver = lazy(() => import('@/pages/guides/WhatIsNameserver'));
const DnsPropagation = lazy(() => import('@/pages/guides/DnsPropagation'));
// DNS Record Types guides
const ARecord = lazy(() => import('@/pages/guides/ARecord'));
const AaaaRecord = lazy(() => import('@/pages/guides/AaaaRecord'));
const CnameRecord = lazy(() => import('@/pages/guides/CnameRecord'));
const MxRecord = lazy(() => import('@/pages/guides/MxRecord'));
const TxtRecord = lazy(() => import('@/pages/guides/TxtRecord'));
const NsRecord = lazy(() => import('@/pages/guides/NsRecord'));
const SrvRecord = lazy(() => import('@/pages/guides/SrvRecord'));
// Domain Management guides
const PointDomainToServer = lazy(() => import('@/pages/guides/PointDomainToServer'));
const ConnectToCloudflare = lazy(() => import('@/pages/guides/ConnectToCloudflare'));
const SubdomainsExplained = lazy(() => import('@/pages/guides/SubdomainsExplained'));
const WildcardDns = lazy(() => import('@/pages/guides/WildcardDns'));
// Hosting Providers guides
const CloudflarePages = lazy(() => import('@/pages/guides/CloudflarePages'));
const Vercel = lazy(() => import('@/pages/guides/Vercel'));
const Netlify = lazy(() => import('@/pages/guides/Netlify'));
const GithubPages = lazy(() => import('@/pages/guides/GithubPages'));
const VpsNginx = lazy(() => import('@/pages/guides/VpsNginx'));
// Troubleshooting guides
const DnsNotResolving = lazy(() => import('@/pages/guides/DnsNotResolving'));
const SslIssues = lazy(() => import('@/pages/guides/SslIssues'));
const CloudflareProxyProblems = lazy(() => import('@/pages/guides/CloudflareProxyProblems'));
const IncorrectRecords = lazy(() => import('@/pages/guides/IncorrectRecords'));
// Blog posts
const SetupWebsiteForFree = lazy(() => import('@/pages/blog/SetupWebsiteForFree'));
const BestFreeHosting = lazy(() => import('@/pages/blog/BestFreeHosting'));
const CommonDnsMistakes = lazy(() => import('@/pages/blog/CommonDnsMistakes'));
const CloudflareProTips = lazy(() => import('@/pages/blog/CloudflareProTips'));
const WhatIsSubdomain = lazy(() => import('@/pages/blog/WhatIsSubdomain'));
const FreeVsPaidHosting = lazy(() => import('@/pages/blog/FreeVsPaidHosting'));
const HowToSecureDomain = lazy(() => import('@/pages/blog/HowToSecureDomain'));
const UnderstandingSsl = lazy(() => import('@/pages/blog/UnderstandingSsl'));
const BeginnersGuideHosting = lazy(() => import('@/pages/blog/BeginnersGuideHosting'));
const TopDomainTools = lazy(() => import('@/pages/blog/TopDomainTools'));

// User pages
const UserDashboard = lazy(() => import('@/pages/UserDashboard'));
const MySubdomains = lazy(() => import('@/pages/MySubdomains.jsx'));
const SubdomainDnsManager = lazy(() => import('@/pages/SubdomainDnsManager.jsx'));
const MyRequests = lazy(() => import('@/pages/MyRequests'));
const Settings = lazy(() => import('@/pages/Settings'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const DiscordLink = lazy(() => import('@/pages/DiscordLink'));

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/AdminDashboard'));
const AdminRequests = lazy(() => import('@/pages/AdminRequests'));
const AdminSubdomains = lazy(() => import('@/pages/AdminSubdomains'));
const AdminDomains = lazy(() => import('@/pages/AdminDomains'));
const AdminUsers = lazy(() => import('@/pages/AdminUsers'));
const AdminAuditLogs = lazy(() => import('@/pages/AdminAuditLogs'));
const AdminEmailLogs = lazy(() => import('@/pages/AdminEmailLogs'));
const AdminDonations = lazy(() => import('@/pages/AdminDonations'));
const AdminSettings = lazy(() => import('@/pages/AdminSettings'));
const AdminAbuseReports = lazy(() => import('@/pages/AdminAbuseReports'));
const AdminModules = lazy(() => import('@/pages/AdminModules'));

const AuthenticatedApp = () => {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/discord-link" element={<DiscordLink />} />

      {/* Public routes (no auth required, no layout) */}
      <Route path="/" element={<Landing />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/report-abuse" element={<ReportAbuse />} />
      <Route path="/rdap" element={<RdapLookup />} />
      <Route path="/activate" element={<Activate />} />
      <Route path="/api-docs" element={<ApiDocs />} />

      {/* Guides */}
      <Route path="/guides" element={<GuidesIndex />} />
      <Route path="/guides/dns-basics/what-is-dns" element={<WhatIsDns />} />
      <Route path="/guides/dns-basics/what-is-a-nameserver" element={<WhatIsNameserver />} />
      <Route path="/guides/dns-basics/dns-propagation" element={<DnsPropagation />} />
      <Route path="/guides/dns-record-types/a-record" element={<ARecord />} />
      <Route path="/guides/dns-record-types/aaaa-record" element={<AaaaRecord />} />
      <Route path="/guides/dns-record-types/cname-record" element={<CnameRecord />} />
      <Route path="/guides/dns-record-types/mx-record" element={<MxRecord />} />
      <Route path="/guides/dns-record-types/txt-record" element={<TxtRecord />} />
      <Route path="/guides/dns-record-types/ns-record" element={<NsRecord />} />
      <Route path="/guides/dns-record-types/srv-record" element={<SrvRecord />} />
      <Route path="/guides/domain-management/point-domain-to-server" element={<PointDomainToServer />} />
      <Route path="/guides/domain-management/connect-to-cloudflare" element={<ConnectToCloudflare />} />
      <Route path="/guides/domain-management/subdomains-explained" element={<SubdomainsExplained />} />
      <Route path="/guides/domain-management/wildcard-dns" element={<WildcardDns />} />
      <Route path="/guides/hosting-providers/cloudflare-pages" element={<CloudflarePages />} />
      <Route path="/guides/hosting-providers/vercel" element={<Vercel />} />
      <Route path="/guides/hosting-providers/netlify" element={<Netlify />} />
      <Route path="/guides/hosting-providers/github-pages" element={<GithubPages />} />
      <Route path="/guides/hosting-providers/vps-nginx" element={<VpsNginx />} />
      <Route path="/guides/troubleshooting/dns-not-resolving" element={<DnsNotResolving />} />
      <Route path="/guides/troubleshooting/ssl-issues" element={<SslIssues />} />
      <Route path="/guides/troubleshooting/cloudflare-proxy-problems" element={<CloudflareProxyProblems />} />
      <Route path="/guides/troubleshooting/incorrect-records" element={<IncorrectRecords />} />

      {/* Blog */}
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/how-to-set-up-a-website-for-free" element={<SetupWebsiteForFree />} />
      <Route path="/blog/best-free-hosting-providers-2026" element={<BestFreeHosting />} />
      <Route path="/blog/common-dns-mistakes-beginners-make" element={<CommonDnsMistakes />} />
      <Route path="/blog/how-to-use-cloudflare-like-a-pro" element={<CloudflareProTips />} />
      <Route path="/blog/what-is-a-subdomain-and-why-use-one" element={<WhatIsSubdomain />} />
      <Route path="/blog/free-vs-paid-hosting" element={<FreeVsPaidHosting />} />
      <Route path="/blog/how-to-secure-your-domain" element={<HowToSecureDomain />} />
      <Route path="/blog/understanding-ssl-certificates" element={<UnderstandingSsl />} />
      <Route path="/blog/beginners-guide-to-web-hosting" element={<BeginnersGuideHosting />} />
      <Route path="/blog/top-tools-for-managing-domains" element={<TopDomainTools />} />

      {/* Authenticated routes with sidebar layout */}
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
      <Route element={<Layout />}>
        {/* User Routes */}
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/dashboard" element={<Navigate to="/user-dashboard" replace />} />
        <Route path="/my-subdomains" element={<MySubdomains />} />
        <Route path="/subdomain-dns-manager" element={<SubdomainDnsManager />} />
        <Route path="/my-requests" element={<MyRequests />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />

        {/* Staff + Admin Routes */}
        <Route element={<RoleProtectedRoute allowedRoles={['admin', 'staff']} />}>
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin-requests" element={<AdminRequests />} />
          <Route path="/admin-subdomains" element={<AdminSubdomains />} />
          <Route path="/admin-dns-records" element={<Navigate to="/admin-subdomains" replace />} />
        </Route>

        {/* Staff + Admin: Abuse Reports */}
        <Route element={<RoleProtectedRoute allowedRoles={['admin', 'staff']} />}>
          <Route path="/admin-abuse-reports" element={<AdminAbuseReports />} />
        </Route>

        {/* Admin-only Routes */}
        <Route element={<RoleProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin-domains" element={<AdminDomains />} />
          <Route path="/admin-users" element={<AdminUsers />} />
          <Route path="/admin-audit-logs" element={<AdminAuditLogs />} />
          <Route path="/admin-email-logs" element={<AdminEmailLogs />} />
          <Route path="/admin-donations" element={<AdminDonations />} />
          <Route path="/admin-settings" element={<AdminSettings />} />
          <Route path="/admin-modules" element={<AdminModules />} />
        </Route>
      </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppErrorBoundary>
            <BrandRuntime>
              <SetupGate>
                <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Loading Rootminster…</div>}>
                  <AuthenticatedApp />
                </Suspense>
              </SetupGate>
            </BrandRuntime>
          </AppErrorBoundary>
        </Router>
        <Toaster />
        <SonnerToaster theme="dark" position="top-right" richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
