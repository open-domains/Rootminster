import { Link } from 'react-router-dom';
import { PublicNav, PublicFooter, AdSenseBanner } from './PublicPageLayout';
import { Calendar, Tag, ArrowLeft } from 'lucide-react';

export default function BlogLayout({ children, title, description, author, date, category, tags, readTime }) {
  return (
    <div className="bg-slate-950 min-h-screen text-white">
      <PublicNav />
      <AdSenseBanner slot="3333333333" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/blog" className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-8">
          <ArrowLeft size={14} /> Back to Blog
        </Link>

        <header className="mb-10">
          {category && (
            <span className="inline-block bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 rounded-full px-3 py-1 text-xs font-medium mb-4">
              {category}
            </span>
          )}
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight">{title}</h1>
          {description && <p className="text-slate-400 text-lg leading-relaxed mb-6">{description}</p>}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>{date}</span>
            </div>
            {author && <span>By <span className="text-slate-300">{author}</span></span>}
            {readTime && <span>· {readTime} min read</span>}
          </div>
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-slate-800 text-slate-400 rounded-full px-3 py-1 text-xs">
                  <Tag size={10} /> {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="border-t border-slate-800 pt-8">
          {children}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}