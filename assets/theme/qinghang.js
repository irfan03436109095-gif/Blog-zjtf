/* 青航：正文由服务端输出；此脚本增强目录高亮并标记推广邀请链接。 */
(() => {
  const articleScroll = document.querySelector('.article-scroll');
  let disposeOutline = () => {};
  function setupOutline() {
    disposeOutline();
    if (!articleScroll) return;
    const links = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
    const entries = [];
    const seen = new Set();
    links.forEach((link) => {
      let id;
      try { id = decodeURIComponent(link.hash.slice(1)); } catch { return; }
      const heading = document.getElementById(id);
      if (heading && !seen.has(id)) { entries.push({ id, heading }); seen.add(id); }
    });
    if (!entries.length) return;
    let pending = 0;
    let active = '';
    const update = () => {
      pending = 0;
      const top = articleScroll.getBoundingClientRect().top + 80;
      let current = entries[0].id;
      for (const item of entries) {
        if (item.heading.getBoundingClientRect().top <= top) current = item.id;
        else break;
      }
      if (current === active) return;
      active = current;
      links.forEach((link) => {
        let selected = false;
        try { selected = decodeURIComponent(link.hash.slice(1)) === current; } catch {}
        if (selected) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    };
    const schedule = () => { if (!pending) pending = requestAnimationFrame(update); };
    articleScroll.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule, { once: true });
    disposeOutline = () => {
      if (pending) cancelAnimationFrame(pending);
      articleScroll.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('load', schedule);
    };
    update();
  }
  document.querySelector('.qh-content')?.addEventListener('click', (event) => {
    const link = event.target.closest?.('.qh-mobile-toc .toc a');
    if (link) link.closest('details').open = false;
  });
  setupOutline();

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
