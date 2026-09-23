import ThemeToggle from '@/components/ThemeToggle';
import { useAppearance } from '@/lib/ThemeContext';
import React from "react";
import { Component as GradientShader } from "@/components/ui/stripe-like-gradient-shader";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { style } = useAppearance();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-3 py-6 sm:px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        {style === 'classic' && <GradientShader />}
        <div className="absolute inset-0 bg-background/75" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex justify-end"><ThemeToggle /></div>
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
      </div>
    </div>
  );
}