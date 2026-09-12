/* 首页连续阅读：跟随模板给出的静态页面地址，按原顺序追加文章。 */
(() => {
  const stream = document.querySelector('.home-shell .home-stream');
  const list = document.querySelector('.home-shell .article-list');
  if (!stream || !list || !window.fetch || !window.DOMParser || !window.AbortController) return;
  const status = stream.querySelector('.home-stream-status');
  const retry = stream.querySelector('.home-stream-retry');
  const fallback = stream.querySelector('.home-stream-fallback');
  if (!status || !retry || !fallback) return;

  // XBlog 上传预览使用不透明来源沙箱，且禁止读取后续 HTML。
  // 此时保留模板中的真实阅读链接，不发出注定失败的请求。
  if (window.origin === 'null') return;

  // 使用系统已经改写的原生链接，避免读取遗留的 data-next 地址。
  let next = fallback.href;
  let busy = false;
  let paused = false;
  let stopped = false;
  let controller;
  const articleURLs = new Set([...list.querySelectorAll('.article-card h2 a[href]')].map(a => a.href));
  const pageURL = (value, base = location.href) => {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol) || url.origin !== location.origin) throw new Error('Invalid page origin');
    url.hash = '';
    return url.href;
  };
  const visited = new Set([pageURL(location.href)]);
  const continuation = (doc, base) => {
    const anchor = doc.querySelector('.home-stream-fallback[href]')
      || doc.querySelector('.pagination a[rel~="next"][href]')
      || [...doc.querySelectorAll('.pagination a[href]')].find(a => a.textContent.includes('下一页'));
    const value = anchor?.getAttribute('href') || doc.querySelector('.home-stream')?.dataset.next;
    return value ? pageURL(value, base) : '';
  };

  async function load() {
    if (!next || busy || paused || stopped) return;
    busy = true;
    status.hidden = false;
    status.textContent = '正在加载更多文章…';
    retry.hidden = true;
    fallback.hidden = true;
    controller = new AbortController();
    const timer = setTimeout(() => controller?.abort(), 15000);
    try {
      const url = pageURL(next);
      if (visited.has(url)) throw new Error('Repeated page');
      const response = await fetch(url, { signal: controller.signal, credentials: 'same-origin', headers: { Accept: 'text/html' } });
      if (!response.ok) throw new Error('Page unavailable');
      const sourceURL = pageURL(response.url || url);
      if (visited.has(sourceURL)) throw new Error('Redirected to a visited page');
      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const source = doc.querySelector('#main .article-list, .home-shell .article-list');
      if (!source) throw new Error('Missing article list');
      const baseHref = doc.querySelector('base[href]')?.getAttribute('href');
      const contentBase = baseHref ? pageURL(baseHref, sourceURL) : sourceURL;
      const following = continuation(doc, contentBase);
      if (following && (visited.has(following) || following === url || following === sourceURL)) throw new Error('Repeated continuation');
      const fragment = document.createDocumentFragment();
      const discovered = [];
      for (const card of source.querySelectorAll(':scope > .article-card')) {
        const titleLink = card.querySelector('h2 a[href]');
        if (!titleLink) continue;
        const articleURL = new URL(titleLink.getAttribute('href'), contentBase).href;
        if (articleURLs.has(articleURL) || discovered.includes(articleURL)) continue;
        const copy = document.importNode(card, true);
        copy.querySelectorAll('a[href]').forEach(a => a.href = new URL(a.getAttribute('href'), contentBase).href);
        fragment.append(copy);
        discovered.push(articleURL);
      }
      if (stopped) return;
      list.append(fragment);
      discovered.forEach(url => articleURLs.add(url));
      visited.add(url);
      visited.add(sourceURL);
      next = following;
      stream.dataset.next = next;
      status.hidden = true;
      if (next) fallback.href = next;
      else stream.hidden = true;
    } catch {
      if (stopped) return;
      paused = true;
      status.textContent = '后续文章暂时无法加载，请重试。';
      retry.hidden = false;
      fallback.hidden = false;
    } finally {
      clearTimeout(timer);
      controller = null;
      busy = false;
      requestAnimationFrame(checkPosition);
    }
  }

  function checkPosition() {
    if (!next || paused || stopped || busy) return;
    if (stream.getBoundingClientRect().top < window.innerHeight + 800) load();
  }
  retry.addEventListener('click', () => { paused = false; load(); });
  // 保留真实链接作为脚本不可用或请求失败时的阅读入口。
  fallback.hidden = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) checkPosition();
    }, { rootMargin: '800px 0px' }).observe(stream);
  } else window.addEventListener('scroll', checkPosition, { passive: true });
  window.addEventListener('resize', checkPosition);
  window.addEventListener('pagehide', () => { stopped = true; controller?.abort(); });
  window.addEventListener('pageshow', () => { stopped = false; checkPosition(); });
  checkPosition();
})();
