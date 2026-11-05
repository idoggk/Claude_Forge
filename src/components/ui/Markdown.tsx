import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { isSafeExternalUrl } from '@/lib/safeUrl';

/**
 * Safe Markdown: react-markdown never renders raw HTML (no rehype-raw), images are dropped so a
 * hostile catalog entry cannot trigger a tracking request, and links are only active for https URLs
 * (external, opened with rel="noopener noreferrer").
 */
const components: Components = {
  a({ href, children }) {
    if (isSafeExternalUrl(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          {children}
        </a>
      );
    }
    return <span>{children}</span>;
  },
  img: () => null,
  pre: ({ children }) => <pre tabIndex={0}>{children}</pre>,
  table: ({ children }) => (
    <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Table">
      <table>{children}</table>
    </div>
  ),
};

export function Markdown({ children, className = '' }: { children: string; className?: string }) {
  return (
    <div className={`prose-forge ${className}`}>
      <ReactMarkdown components={components} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}
