import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ArticleAdSense } from './PublicPageLayout';
import { Link } from 'react-router-dom';

export function H2({ children }) {
  return <h2 className="text-2xl font-bold text-white mt-10 mb-4">{children}</h2>;
}
export function H3({ children }) {
  return <h3 className="text-lg font-semibold text-slate-200 mt-6 mb-2">{children}</h3>;
}
export function P({ children }) {
  return <p className="text-slate-400 leading-relaxed mb-4">{children}</p>;
}
export function UL({ children }) {
  return <ul className="text-slate-400 space-y-2 mb-4 list-none">{children}</ul>;
}
export function LI({ children }) {
  return <li className="flex items-start gap-2"><span className="text-indigo-400 mt-1 shrink-0">▸</span><span>{children}</span></li>;
}
export function Note({ children }) {
  return (
    <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3 my-6 text-sm text-indigo-300">
      <strong>Note:</strong> {children}
    </div>
  );
}
export function Warning({ children }) {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 my-6 text-sm text-amber-300">
      <strong>⚠ Warning:</strong> {children}
    </div>
  );
}
export function Tip({ children }) {
  return (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 my-6 text-sm text-emerald-300">
      <strong>💡 Tip:</strong> {children}
    </div>
  );
}

export function CodeBlock({ children, label }) {
  const [copied, setCopied] = useState(false);
  const text = typeof children === 'string' ? children : String(children);
  const handleCopy = () => {
    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-slate-700/50">
      <div className="flex items-center justify-between bg-slate-800/80 px-4 py-2">
        <span className="text-slate-400 text-xs font-mono">{label || 'Example'}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-slate-900 px-4 py-4 text-sm text-slate-300 overflow-x-auto font-mono leading-relaxed whitespace-pre">{text.trim()}</pre>
    </div>
  );
}

export function InlineCode({ children }) {
  return <code className="bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
}

export function Divider() {
  return <hr className="border-slate-800 my-8" />;
}

export function InArticleAd() {
  return <ArticleAdSense />;
}

export function RelatedArticles({ articles }) {
  return (
    <div className="mt-12 border-t border-slate-800 pt-8">
      <h3 className="text-lg font-semibold text-white mb-4">Related Articles</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {articles.map(a => (
          <Link key={a.href} to={a.href} className="block bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-indigo-500/40 transition-colors group">
            <p className="text-white text-sm font-medium group-hover:text-indigo-300 transition-colors">{a.title}</p>
            {a.desc && <p className="text-slate-500 text-xs mt-1">{a.desc}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}