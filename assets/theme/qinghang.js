/* 青航：首页正文随 HTML 一起输出，使用随主题打包的 Markdown 排版器，无需请求文章页面。 */
(() => {
  const home = document.querySelector('[data-home-article]');
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
  if (!home) return;

  const content = document.getElementById('qh-home-prose');
  const source = home.querySelector('[data-home-markdown]');
  const sourceLink = home.querySelector('.qh-home-source');
  const articleList = document.getElementById('qh-home-articles');
  const followHash = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!id) return;
    if (id === 'qh-home-articles' && articleList) articleList.open = true;
    document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  window.addEventListener('hashchange', followHash);
  followHash();

  function prepareCodeCopy(prose) {
    prose.querySelectorAll('pre').forEach((block) => {
      const code = block.querySelector('code');
      if (!code || block.querySelector('.code-copy')) return;
      const button = document.createElement('button');
      button.className = 'code-copy';
      button.type = 'button';
      button.textContent = '复制';
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(code.textContent || '');
          button.textContent = '已复制';
          setTimeout(() => { button.textContent = '复制'; }, 1500);
        } catch { button.textContent = '请手动复制'; }
      });
      block.append(button);
    });
  }

  function mountTOC(prose) {
    const headings = Array.from(prose.querySelectorAll('h2,h3,h4,h5,h6'));
    const used = new Set();
    const toc = document.createElement('aside');
    toc.className = 'toc';
    toc.setAttribute('data-pagefind-ignore', '');
    const label = document.createElement('div');
    label.textContent = '此页内容';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '文章目录');
    headings.forEach((heading) => {
      const title = heading.textContent.trim();
      const slug = title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
      let id = slug;
      let n = 1;
      while (used.has(id) || document.getElementById(id)) id = slug + '-' + n++;
      used.add(id);
      heading.id = id;
      const link = document.createElement('a');
      link.href = '#' + encodeURIComponent(id);
      link.textContent = title || '未命名章节';
      link.className = 'level-' + heading.tagName.slice(1);
      nav.append(link);
    });
    toc.append(label, nav);
    document.querySelectorAll('[data-home-toc]').forEach((target) => {
      target.replaceChildren();
      target.hidden = !headings.length;
      if (headings.length) target.append(toc.cloneNode(true));
    });
    const mobileTOC = document.querySelector('.qh-home-mobile-toc');
    if (mobileTOC) mobileTOC.hidden = !headings.length;
  }

  // 没有脚本或排版器加载失败时，模板中的完整原文仍然可读。
  if (!source || !content || typeof window.markdownit !== 'function') return;
  try {
    const markdown = window.markdownit({ html: false, linkify: true, breaks: true });
    const fragment = document.createElement('div');
    fragment.innerHTML = markdown.render(source.textContent || '');
    // 页面主标题由文章元数据提供，正文一级标题统一降为二级。
    fragment.querySelectorAll('h1').forEach((heading) => {
      const replacement = document.createElement('h2');
      replacement.append(...heading.childNodes);
      heading.replaceWith(replacement);
    });
    let baseURL;
    try { baseURL = new URL(home.dataset.articleUrl, document.baseURI); } catch {}
    fragment.querySelectorAll('[src],[href]').forEach((node) => {
      for (const attr of ['src', 'href']) {
        const value = node.getAttribute(attr);
        if (!value || value.startsWith('#') || !baseURL) continue;
        try { node.setAttribute(attr, new URL(value, baseURL).href); } catch {}
      }
      if (node.tagName === 'IMG') {
        node.loading = 'lazy';
        node.decoding = 'async';
      }
    });
    mountTOC(fragment);
    content.replaceChildren(...fragment.childNodes);
    prepareCodeCopy(content);
    document.querySelectorAll('.qh-index-links a').forEach((link) => {
      if (link.href === sourceLink?.href) link.setAttribute('aria-current', 'page');
    });
    home.dataset.loaded = 'true';
    setupOutline();
    followHash();
  } catch {
    // 保留已经随页面输出的完整文本，不回退到摘要，也不发起网络重试。
  }
})();
