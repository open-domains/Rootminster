import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { rootminster } from "@/api/rootminsterClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, LogIn, Mail, Lock, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { usePublicConfig } from '@/lib/public-config';

export default function Login() {
  const [searchParams] = useSearchParams();
  const { config } = usePublicConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await rootminster.auth.loginViaEmailPassword(email, password);
      const returnTo = searchParams.get('return_to');
      window.location.href = returnTo?.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/user-dashboard';
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={LogIn}
      title="Welcome back"
      subtitle="Log in to your account"
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {(config.oauth.google || config.oauth.github) && (
        <>
          <div className="mb-4 space-y-2">
            {config.oauth.google && (
              <Button type="button" variant="outline" className="w-full h-12 font-medium flex items-center gap-3" onClick={() => rootminster.auth.loginWithProvider('google', searchParams.get('return_to') || '/user-dashboard')}>
                <GoogleIcon /> Continue with Google
              </Button>
            )}
            {config.oauth.github && (
              <Button type="button" variant="outline" className="w-full h-12 font-medium flex items-center gap-3" onClick={() => rootminster.auth.loginWithProvider('github', searchParams.get('return_to') || '/user-dashboard')}>
                <Github className="h-5 w-5" /> Continue with GitHub
              </Button>
            )}
          </div>
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">or continue with email</span></div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            "Log in"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
