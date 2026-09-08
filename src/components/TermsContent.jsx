import ReactMarkdown from 'react-markdown';

const components = {
  h1: ({ children }) => <h1 className="mb-4 mt-8 text-2xl font-bold text-foreground first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-3 mt-8 text-lg font-semibold text-foreground first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-base font-semibold text-foreground">{children}</h3>,
  p: ({ children }) => <p className="mb-3 leading-relaxed text-muted-foreground">{children}</p>,
  ul: ({ children }) => <ul className="mb-4 ml-5 list-disc space-y-1 text-muted-foreground">{children}</ul>,
  ol: ({ children }) => <ol className="mb-4 ml-5 list-decimal space-y-1 text-muted-foreground">{children}</ol>,
  li: ({ children }) => <li className="pl-1 leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="my-4 border-l-2 border-primary pl-4 italic text-muted-foreground">{children}</blockquote>,
  a: ({ href, children }) => <a href={href} className="text-primary underline-offset-4 hover:underline">{children}</a>,
};

export default function TermsContent({ children, className = '' }) {
  return <div className={`text-sm ${className}`}><ReactMarkdown components={components}>{children}</ReactMarkdown></div>;
}
