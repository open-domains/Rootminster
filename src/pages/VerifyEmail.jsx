import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, MailWarning } from 'lucide-react';
import { rootminster } from '@/api/rootminsterClient';
import AuthLayout from '@/components/AuthLayout';
import { Button } from '@/components/ui/button';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your email address…');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    rootminster.auth.verifyEmail(token)
      .then(() => {
        setStatus('success');
        setMessage('Your email is verified and your account is ready.');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.message || 'This verification link is invalid or has expired.');
      });
  }, [params]);

  const icon = status === 'loading' ? Loader2 : status === 'success' ? CheckCircle2 : MailWarning;
  return (
    <AuthLayout icon={icon} title={status === 'success' ? 'Email verified' : status === 'error' ? 'Verification failed' : 'Verifying email'} subtitle={message}>
      {status === 'loading' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />}
      {status === 'success' && <Button asChild className="w-full h-12"><Link to="/user-dashboard">Continue to dashboard</Link></Button>}
      {status === 'error' && <Button asChild variant="outline" className="w-full h-12"><Link to="/login">Back to login</Link></Button>}
    </AuthLayout>
  );
}
