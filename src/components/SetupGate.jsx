import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function SetupGate({ children }) {
  const location = useLocation();
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    rootminster.setup.status().then(setStatus).catch((err) => setError(err.message || 'Could not check setup status'));
  };

  useEffect(load, []);

  if (error) return <div className="fixed inset-0 grid place-items-center bg-background px-6"><div className="max-w-md rounded-xl border border-border bg-card p-6 text-center"><h1 className="text-lg font-semibold">Rootminster could not start</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button onClick={load} className="mt-5">Try again</Button></div></div>;
  if (!status || isLoadingAuth) return <div className="fixed inset-0 grid place-items-center bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  if (status.required && location.pathname !== '/setup') return <Navigate to="/setup" replace />;
  if (!status.required && location.pathname === '/setup') return <Navigate to={isAuthenticated ? '/user-dashboard' : '/login'} replace />;
  return children;
}
