/* 首页正文直接来自模板；图片和排版在原有内容上渐进增强。 */
(() => {
  if (typeof window.markdownit !== 'function' || !window.DOMPurify?.isSupported) return;
  const parser = window.markdownit({ html: true, linkify: false, typographer: false });
  const articleImages = new Map();
  const safeURL = (value, base, protocols = ['http:', 'https:']) => {
    if (!value?.trim()) return '';
    try {
      const url = new URL(value, base);
      return protocols.includes(url.protocol) ? url.href : '';
    } catch { return ''; }
  };
  // 后台预览会重写首页链接，但转义的 Markdown 内仍保留 /assets/media/。
  // 以页面真实首页链接定位媒体目录，同时适配正式根域名与子目录部署。
  const homeURL = document.querySelector('.brand[href]')?.href || document.baseURI;
  const imageURL = (value, base) => {
    const media = value?.trim().match(/^\/?assets\/media\/(.+)$/);
    return safeURL(media ? new URL('assets/media/' + media[1], homeURL).href : value, base);
  };
  const render = text => window.DOMPurify.sanitize(parser.render(text), {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','b','i','s','del','blockquote','ul','ol','li','pre','code','a','img','figure','figcaption','table','thead','tbody','tr','th','td','div','span','sup','sub','kbd'],
    ALLOWED_ATTR: ['href','src','alt','title','width','height','start','colspan','rowspan','data-src'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false
  });

  // 列表没有系统已解析的图片字段。内部素材引用或失效相对路径只向
  // 这篇公开文章读取图片地址，不执行文章脚本，不请求任何管理接口。
  function publishedImages(base) {
    if (articleImages.has(base)) return articleImages.get(base);
    const pending = (async () => {
      if (window.origin === 'null' || new URL(base).origin !== location.origin) return [];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(base, { credentials: 'omit', signal: controller.signal, headers: { Accept: 'text/html' } });
        if (!response.ok || new URL(response.url || base).origin !== location.origin) return [];
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const content = doc.querySelector('article[data-pagefind-body] > .prose, main article > .prose');
        if (!content) return [];
        const contentBase = response.url || base;
        return [...content.querySelectorAll('img')].map(img => ({
          src: imageURL(img.getAttribute('src') || img.getAttribute('data-src'), contentBase),
          alt: img.getAttribute('alt') || ''
        }));
      } catch { return []; }
      finally { clearTimeout(timer); }
    })();
    articleImages.set(base, pending);
    return pending;
  }

  function prepareImage(img, index, base, onFailure) {
    const direct = imageURL(img.getAttribute('src') || img.getAttribute('data-src'), base);
    img.removeAttribute('data-src');
    img.removeAttribute('width');
    img.removeAttribute('height');
    img.loading = 'lazy';
    img.decoding = 'async';
    let recovered = false;
    const recover = async () => {
      if (recovered) { onFailure(); return; }
      recovered = true;
      const images = await publishedImages(base);
      const candidate = images[index];
      if (candidate?.src && candidate.src !== direct) {
        img.src = candidate.src;
        if (!img.alt) img.alt = candidate.alt;
      } else onFailure();
    };
    img.addEventListener('error', recover);
    if (direct) img.src = direct;
    else { img.removeAttribute('src'); recover(); }
  }

  const source = document.querySelector('[data-home-markdown]');
  if (source) {
    const original = source.textContent;
    try {
      const base = source.closest('.home-feature').querySelector('h2 a[href]').href;
      const fragment = render(original);
      let heading = 0;
      fragment.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(node => {
        const replacement = document.createElement('h' + Math.max(3, Number(node.tagName.slice(1))));
        replacement.id = 'home-feature-section-' + (++heading);
        replacement.append(...node.childNodes);
        node.replaceWith(replacement);
      });
      fragment.querySelectorAll('a[href]').forEach(link => {
        const url = safeURL(link.getAttribute('href'), base, ['http:', 'https:', 'mailto:', 'tel:']);
        if (!url) { link.replaceWith(...link.childNodes); return; }
        link.href = url;
        link.rel = 'noopener noreferrer';
      });
      fragment.querySelectorAll('img').forEach((img, index) => {
        prepareImage(img, index, base, () => {
          const link = document.createElement('a');
          link.className = 'home-image-unavailable';
          link.href = base;
          link.textContent = (img.alt ? img.alt + ' · ' : '') + '查看文章图片';
          img.replaceWith(link);
        });
      });
      source.replaceChildren(fragment);
      source.classList.add('is-rendered');
    } catch { source.textContent = original; }
  }

  function addCover(source) {
    try {
      const card = source.closest('.article-card');
      const title = card.querySelector('h2 a[href]');
      const fragment = render(source.content.textContent);
      const img = fragment.querySelector('img');
      source.remove();
      if (!img || !title) return;
      const link = document.createElement('a');
      link.className = 'card-image-link';
      link.dataset.cardImageLink = '';
      link.href = title.href;
      link.setAttribute('aria-label', '阅读全文：' + title.textContent);
      img.alt = img.alt || title.textContent;
      link.append(img);
      card.prepend(link);
      prepareImage(img, 0, title.href, () => link.remove());
    } catch { source.remove(); }
  }
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const source = entry.target.querySelector('[data-card-image-source]');
      if (source) addCover(source);
    });
  }, { rootMargin: '600px 0px' }) : null;
  function enhanceCards() {
    document.querySelectorAll('[data-card-image-source]:not([data-observed])').forEach(source => {
      source.dataset.observed = '';
      if (observer) observer.observe(source.closest('.article-card'));
      else addCover(source);
    });
  }
  enhanceCards();
  document.addEventListener('chengguang:articles-added', enhanceCards);
})();
