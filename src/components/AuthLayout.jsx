import ThemeToggle from '@/components/ThemeToggle';
import { useAppearance } from '@/lib/ThemeContext';
import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CookieSettingsButton } from "@/components/SiteFooter";
import { Component as GradientShader } from "@/components/ui/stripe-like-gradient-shader";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { style } = useAppearance();
  const { t } = useTranslation();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-3 py-6 sm:px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {style === 'classic' && <GradientShader />}
        <div className="absolute inset-0 bg-background/75" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
            <Icon className="w-7 h-7 text-primary-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-xl sm:rounded-2xl shadow-sm border border-border p-4 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
        <nav aria-label="Footer" className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">{t('footer.home')}</Link>
          <Link to="/privacy-policy" className="transition-colors hover:text-foreground">{t('footer.privacy')}</Link>
          <Link to="/terms-of-service" className="transition-colors hover:text-foreground">{t('footer.terms')}</Link>
          <Link to="/contact" className="transition-colors hover:text-foreground">{t('footer.contact')}</Link>
          <span aria-hidden="true" className="hidden h-3 w-px bg-border sm:block" />
          <CookieSettingsButton />
          <ThemeToggle variant="link" align="center" side="top" />
        </nav>
      </div>
    </div>
  );
}