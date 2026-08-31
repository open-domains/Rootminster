import React, { useState } from "react";
import { Link } from "react-router-dom";
import { rootminster } from "@/api/rootminsterClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Github, UserPlus, Mail, Lock, Loader2, User } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import GoogleIcon from "@/components/GoogleIcon";
import { toast } from "@/components/ui/use-toast";
import { usePublicConfig } from '@/lib/public-config';

export default function Register() {
  const { config } = usePublicConfig();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const result = await rootminster.auth.register({ firstName, email, password });
      if (result?.verified) window.location.href = "/user-dashboard";
      else setAwaitingVerification(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await rootminster.auth.resendVerification(email);
      toast({
        title: "Verification link sent",
        description: "Check your inbox for a fresh link.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  if (awaitingVerification) {
    return (
      <AuthLayout
        icon={Mail}
        title="Verify your email"
        subtitle={`We sent a verification link to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        <p className="text-sm text-muted-foreground text-center mb-6">Open the email and click the button inside. The link is single-use and expires after 24 hours.</p>
        <Button asChild className="w-full h-12 font-medium"><Link to="/login">Back to login</Link></Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the email?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">
            Log in
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
              <Button type="button" variant="outline" className="w-full h-12 font-medium flex items-center gap-3" onClick={() => rootminster.auth.loginWithProvider('google', '/user-dashboard')}>
                <GoogleIcon /> Continue with Google
              </Button>
            )}
            {config.oauth.github && (
              <Button type="button" variant="outline" className="w-full h-12 font-medium flex items-center gap-3" onClick={() => rootminster.auth.loginWithProvider('github', '/user-dashboard')}>
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
          <Label htmlFor="firstName">First name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input id="firstName" name="given-name" autoComplete="given-name" autoFocus maxLength={80} placeholder="Andy" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="pl-10 h-12" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
