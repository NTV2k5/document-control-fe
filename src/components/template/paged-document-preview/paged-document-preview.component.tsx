'use client';

import { useMemo } from 'react';

interface IPagedDocumentPreviewProps {
  html: string;
  emptyMessage?: string;
}

const PAGE_BREAK_HTML_PATTERN =
  /<div\b[^>]*(?:class=(["'])[^"']*\bpage-break\b[^"']*\1|style=(["'])[^"']*(?:page-break-after|break-after)\s*:\s*(?:always|page)[^"']*\2)[^>]*>[\s\S]*?<\/div>|<br\b[^>]*style=(["'])[^"']*page-break-before\s*:\s*always[^"']*\3[^>]*\/?>/gi;

const hasRenderableContent = (html: string) => {
  const textContent = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return textContent.length > 0 || /<(img|table|hr|ul|ol|figure|svg)\b/i.test(html);
};

const splitHtmlByPageBreak = (html: string) => {
  const parts = html.split(PAGE_BREAK_HTML_PATTERN).filter((part) => part && !/^['"]$/.test(part));
  const pages = parts.filter(hasRenderableContent);
  return pages.length > 0 ? pages : [html];
};

export const PagedDocumentPreview = ({ html, emptyMessage }: IPagedDocumentPreviewProps) => {
  const pages = useMemo(() => splitHtmlByPageBreak(html), [html]);

  if (!html.trim()) {
    return (
      <div className="paged-document-preview">
        <div className="paged-document-preview__empty">{emptyMessage || 'No content to preview.'}</div>
      </div>
    );
  }

  return (
    <div className="paged-document-preview">
      {pages.map((pageHtml, index) => (
        <section key={`page-${index + 1}`} className="paged-document-preview__page">
          <div className="paged-document-preview__page-number">{index + 1}</div>
          <div
            className="paged-document-preview__content ck-content"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: preview renders trusted editor HTML from the current document.
            dangerouslySetInnerHTML={{ __html: pageHtml }}
          />
        </section>
      ))}
    </div>
  );
};
