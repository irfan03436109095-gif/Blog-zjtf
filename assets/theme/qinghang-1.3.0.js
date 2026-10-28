/* 青航：文章图片宽度与目录交互；正文由服务端直接输出。 */
(() => {
  const articleScroll = document.querySelector('.article-scroll');
  // 在图片的 Markdown 标题中写 "width=240"，首页和文章页都会按此宽度显示。
  function applyEditorImageWidths(root) {
    root.querySelectorAll('img[title]').forEach((image) => {
      const match = /^(?:width|宽度)\s*=\s*(\d{2,4})(?:px)?$/i.exec((image.getAttribute('title') || '').trim());
      if (!match) return;
      const width = Number(match[1]);
      if (width < 40 || width > 1600) return;
      image.style.width = `${width}px`;
      image.style.maxWidth = '100%';
      image.style.height = 'auto';
      image.removeAttribute('title');
    });
  }
  const articleProse = document.querySelector('.qh-article-main .prose');
  if (articleProse) applyEditorImageWidths(articleProse);
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
})();
