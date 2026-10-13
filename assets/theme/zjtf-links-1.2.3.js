/* 推广链接标记；正文插图完全来自文章编辑器。 */
(() => {
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

})();
