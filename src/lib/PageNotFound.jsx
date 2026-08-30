import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Home, BookOpen, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Component as GradientShader } from '@/components/ui/stripe-like-gradient-shader';

export default function PageNotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background — same as landing hero */}
      <div className="absolute inset-0 pointer-events-none">
        <GradientShader />
        <div className="absolute inset-0 bg-slate-950/70" />
      </div>

      <div className="relative text-center max-w-lg">
        {/* 404 number */}
        <p className="text-[120px] sm:text-[160px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-indigo-400/60 to-slate-800 select-none">
          404
        </p>

        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 mb-3">
          Page not found
        </h1>
        <p className="text-slate-400 leading-relaxed mb-8">
          The page{' '}
          <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-sm">
            {location.pathname}
          </span>{' '}
          doesn't exist or may have been moved.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
          <Link to="/">
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 w-full sm:w-auto">
              <Home size={15} /> Go Home
            </Button>
          </Link>
          <Link to="/guides">
            <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800 bg-transparent gap-2 w-full sm:w-auto">
              <BookOpen size={15} /> Browse Guides
            </Button>
          </Link>
        </div>

        {/* Quick links */}
        <div className="border-t border-slate-800 pt-8">
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-4">Popular pages</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { to: '/HowItWorks', label: 'How It Works' },
              { to: '/FAQ', label: 'FAQ' },
              { to: '/blog', label: 'Blog' },
              { to: '/api-docs', label: 'API Docs' },
              { to: '/Contact', label: 'Contact' },
            ].map(link => (
              <Link key={link.to} to={link.to} className="text-slate-400 hover:text-indigo-400 text-sm transition-colors flex items-center gap-1">
                {link.label} <ArrowRight size={11} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}