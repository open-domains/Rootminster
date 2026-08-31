import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import { Toaster as SonnerToaster } from 'sonner';

// Layout
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleProtectedRoute from '@/components/RoleProtectedRoute';

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerifyEmail from '@/pages/VerifyEmail';

// Public pages (no layout)
import Landing from '@/pages/Landing';
import HowItWorks from '@/pages/HowItWorks';
import FAQ from '@/pages/FAQ';
import About from '@/pages/About';
import Contact from '@/pages/Contact';
import PrivacyPolicy from '@/pages/PrivacyPolicy';
import TermsOfService from '@/pages/TermsOfService';
import ReportAbuse from '@/pages/ReportAbuse';
import RdapLookup from '@/pages/RdapLookup';
import Activate from '@/pages/Activate';
import ApiDocs from '@/pages/ApiDocs';

// Guides & Blog
import GuidesIndex from '@/pages/GuidesIndex';
import BlogIndex from '@/pages/BlogIndex';
// DNS Basics guides
import WhatIsDns from '@/pages/guides/WhatIsDns';
import WhatIsNameserver from '@/pages/guides/WhatIsNameserver';
import DnsPropagation from '@/pages/guides/DnsPropagation';
// DNS Record Types guides
import ARecord from '@/pages/guides/ARecord';
import AaaaRecord from '@/pages/guides/AaaaRecord';
import CnameRecord from '@/pages/guides/CnameRecord';
import MxRecord from '@/pages/guides/MxRecord';
import TxtRecord from '@/pages/guides/TxtRecord';
import NsRecord from '@/pages/guides/NsRecord';
import SrvRecord from '@/pages/guides/SrvRecord';
// Domain Management guides
import PointDomainToServer from '@/pages/guides/PointDomainToServer';
import ConnectToCloudflare from '@/pages/guides/ConnectToCloudflare';
import SubdomainsExplained from '@/pages/guides/SubdomainsExplained';
import WildcardDns from '@/pages/guides/WildcardDns';
// Hosting Providers guides
import CloudflarePages from '@/pages/guides/CloudflarePages';
import Vercel from '@/pages/guides/Vercel';
import Netlify from '@/pages/guides/Netlify';
import GithubPages from '@/pages/guides/GithubPages';
import VpsNginx from '@/pages/guides/VpsNginx';
// Troubleshooting guides
import DnsNotResolving from '@/pages/guides/DnsNotResolving';
import SslIssues from '@/pages/guides/SslIssues';
import CloudflareProxyProblems from '@/pages/guides/CloudflareProxyProblems';
import IncorrectRecords from '@/pages/guides/IncorrectRecords';
// Blog posts
import SetupWebsiteForFree from '@/pages/blog/SetupWebsiteForFree';
import BestFreeHosting from '@/pages/blog/BestFreeHosting';
import CommonDnsMistakes from '@/pages/blog/CommonDnsMistakes';
import CloudflareProTips from '@/pages/blog/CloudflareProTips';
import WhatIsSubdomain from '@/pages/blog/WhatIsSubdomain';
import FreeVsPaidHosting from '@/pages/blog/FreeVsPaidHosting';
import HowToSecureDomain from '@/pages/blog/HowToSecureDomain';
import UnderstandingSsl from '@/pages/blog/UnderstandingSsl';
import BeginnersGuideHosting from '@/pages/blog/BeginnersGuideHosting';
import TopDomainTools from '@/pages/blog/TopDomainTools';

// User pages
import UserDashboard from '@/pages/UserDashboard';
import Dashboard from '@/pages/Dashboard';
import MySubdomains from '@/pages/MySubdomains.jsx';
import SubdomainDnsManager from '@/pages/SubdomainDnsManager.jsx';
import MyRequests from '@/pages/MyRequests';
import Settings from '@/pages/Settings';
import Analytics from '@/pages/Analytics';

// Admin pages
import AdminDashboard from '@/pages/AdminDashboard';
import AdminRequests from '@/pages/AdminRequests';
import AdminSubdomains from '@/pages/AdminSubdomains';
import AdminDomains from '@/pages/AdminDomains';
import AdminUsers from '@/pages/AdminUsers';
import AdminAuditLogs from '@/pages/AdminAuditLogs';
import AdminEmailLogs from '@/pages/AdminEmailLogs';
import AdminDonations from '@/pages/AdminDonations';
import AdminSettings from '@/pages/AdminSettings';
import AdminAbuseReports from '@/pages/AdminAbuseReports';

const AuthenticatedApp = () => {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />

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
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster theme="dark" position="top-right" richColors />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
