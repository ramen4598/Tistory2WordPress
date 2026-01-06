export interface BookmarkTemplateData {
  url: string;
  title?: string;
  description?: string;
  featuredImage?: string;
}

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function styleToString(styles: Record<string, string | number | undefined>): string {
  return Object.entries(styles)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${camelToKebab(key)}: ${value}`)
    .join('; ');
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCardStyles(): Record<string, string> {
  return {
    border: '1px solid #e5e7eb',
    borderRadius: '10px',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    margin: '12px 0',
    minHeight: '80px',
  };
}

function getImageContainerStyles(): Record<string, string> {
  return {
    position: 'relative',
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  };
}

function getImageStyles(): Record<string, string> {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  };
}

function getContentContainerStyles(): Record<string, string> {
  return {
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  };
}

function getTitleStyles(): Record<string, string> {
  return {
    margin: '0 0 4px 0',
    fontSize: '0.95rem',
    fontWeight: '500',
    color: '#111827',
    lineHeight: '1.3',
  };
}

function getCardLinkStyles(): Record<string, string> {
  return {
    display: 'grid',
    gridTemplateColumns: '30% 70%',
    gap: '14px',
    alignItems: 'stretch',
    textDecoration: 'none',
    color: '#111827',
  };
}

function getDescriptionStyles(): Record<string, string> {
  return {
    margin: '4px 0 0 0',
    fontSize: '0.85rem',
    color: '#6b7280',
    lineHeight: '1.4',
    maxHeight: '3.6em',
    overflow: 'hidden',
  };
}

function cardStylesForImage(): string {
  return styleToString(getImageContainerStyles());
}

export function renderBookmarkHTML(data: BookmarkTemplateData): string {
  const cardStyles = styleToString(getCardStyles());

  const displayTitle = data.title && data.title.trim().length > 0 ? data.title : data.url;

  const imageHtml = data.featuredImage
    ? `<div class="bookmark-featured-image" style="${cardStylesForImage()}">
        <img src="${escapeHtml(data.featuredImage)}" alt="${escapeHtml(
          displayTitle
        )}" style="${styleToString(getImageStyles())}" />
      </div>`
    : '';

  const descriptionHtml = data.description
    ? `<p class="bookmark-description" style="${styleToString(
        getDescriptionStyles()
      )}">${escapeHtml(data.description)}</p>`
    : '';

  const contentHtml = `${imageHtml}<div class="bookmark-content" style="${styleToString(
    getContentContainerStyles()
  )}">
      <h3 class="bookmark-title" style="${styleToString(getTitleStyles())}">
        ${escapeHtml(displayTitle)}
      </h3>
      ${descriptionHtml}
    </div>`;

  return `<figure class="bookmark-card" style="${cardStyles}">
    <a href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer" style="${styleToString(
      getCardLinkStyles()
    )}">${contentHtml}</a>
  </figure>`;
}
