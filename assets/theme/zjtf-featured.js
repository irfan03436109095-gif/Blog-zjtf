/* 首篇的两张旧图片随主题提供，避免旧正文图片地址失效。 */
(() => {
  const body = document.body;
  const assetBase = body.dataset.qhAssets;
  if (!assetBase) return;

  document.querySelectorAll('a[href]').forEach((link) => {
    let url;
    try { url = new URL(link.getAttribute('href'), location.href); } catch { return; }
    if (!['https:', 'http:'].includes(url.protocol) || url.origin === location.origin) return;
    const routeQuery = new URLSearchParams(url.hash.split('?')[1] || '');
    const registration = url.pathname.includes('/register') || url.hash.startsWith('#/register?');
    const invitation = ['code', 'ref', 'aff', 'affiliate'].some((key) => url.searchParams.has(key) || routeQuery.has(key));
    if (registration && invitation) link.relList.add('sponsored');
    if (link.target === '_blank') link.relList.add('noopener', 'noreferrer');
  });

  const feature = document.querySelector('[data-home-article][data-article-slug="jctj"]');
  const articlePage = body.dataset.qhArticleSlug === 'jctj';
  const prose = feature?.querySelector('.prose') || (articlePage ? document.querySelector('article[data-pagefind-body] .prose') : null);
  if (!prose) return;

  const images = [
    { file: 'flybit.png', legacy: '820da874-3338-46d3-9f28-d0d9c4760bf4', heading: /flybit/i, alt: 'FlyBit 标志' },
    { file: '99ba.png', legacy: 'b25f588b-927d-4482-9339-9e532567481e', heading: /99吧/, alt: '99吧标志' },
  ];
  images.forEach((item) => {
    const src = new URL(item.file, new URL(assetBase, document.baseURI)).href;
    const existing = Array.from(prose.querySelectorAll('img')).find((img) => {
      const current = img.getAttribute('src') || '';
      return current.includes(item.legacy) || current.endsWith('/' + item.file);
    });
    if (existing) {
      existing.src = src;
      existing.alt = existing.alt || item.alt;
      existing.loading = 'lazy';
      existing.decoding = 'async';
      existing.classList.add('qh-restored-image');
      return;
    }

    const heading = Array.from(prose.querySelectorAll('h2')).find((node) => item.heading.test(node.textContent || ''));
    if (!heading) return;
    const figure = document.createElement('figure');
    figure.className = 'qh-restored-figure';
    const img = document.createElement('img');
    img.src = src;
    img.alt = item.alt;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.className = 'qh-restored-image';
    figure.append(img);
    heading.after(figure);
  });

})();
