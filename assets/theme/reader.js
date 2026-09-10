/* 原生弹窗统一管理焦点、滚动和拖动；图片采用事件委托，兼容异步评论中的图片。 */
(() => {
  const dialogs = [...document.querySelectorAll("dialog[data-reader-dialog]")];
  if (!dialogs.length || typeof dialogs[0].showModal !== "function") return;
  const invokers = new WeakMap();
  const syncScroll = () =>
    document.body.classList.toggle(
      "reader-modal-open",
      dialogs.some((item) => item.open),
    );
  function openDialog(dialog, invoker) {
    if (!dialog || dialog.open) return;
    dialogs.forEach((item) => {
      if (item.open) item.close();
    });
    invokers.set(dialog, invoker || document.activeElement);
    dialog.style.transform = "";
    dialog.showModal();
    syncScroll();
    dialog.dispatchEvent(new CustomEvent("reader:open"));
  }
  for (const dialog of dialogs) {
    dialog.addEventListener("close", () => {
      syncScroll();
      // 在关闭事件执行前可能已打开另一弹窗，不能把焦点移到其外部。
      const invoker = invokers.get(dialog);
      if (!dialogs.some((item) => item.open) && invoker?.isConnected)
        invoker.focus({ preventScroll: true });
    });
    let outsideStart = false;
    const outside = (event) => {
      const box = dialog.getBoundingClientRect();
      return (
        event.clientX < box.left ||
        event.clientX > box.right ||
        event.clientY < box.top ||
        event.clientY > box.bottom
      );
    };
    dialog.addEventListener("pointerdown", (event) => {
      outsideStart = event.target === dialog && outside(event);
    });
    dialog.addEventListener("click", (event) => {
      if (
        event.target.closest("[data-close-dialog]") ||
        (outsideStart && event.target === dialog && outside(event))
      )
        dialog.close();
      outsideStart = false;
    });
    makeDraggable(dialog);
  }
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-open-dialog]");
    if (
      !trigger ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    const dialog = document.getElementById(trigger.dataset.openDialog);
    if (!dialogs.includes(dialog)) return;
    event.preventDefault();
    openDialog(dialog, trigger);
  });

  function makeDraggable(dialog) {
    const handle = dialog.querySelector(".reader-dialog-header");
    if (!handle) return;
    let drag,
      offsetX = 0,
      offsetY = 0;
    dialog.addEventListener("reader:open", () => {
      offsetX = 0;
      offsetY = 0;
    });
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, a, input, select")) return;
      drag = {
        x: event.clientX,
        y: event.clientY,
        box: dialog.getBoundingClientRect(),
        offsetX,
        offsetY,
      };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = Math.min(
        window.innerWidth - 8 - drag.box.right,
        Math.max(8 - drag.box.left, event.clientX - drag.x),
      );
      const dy = Math.min(
        window.innerHeight - 8 - drag.box.bottom,
        Math.max(8 - drag.box.top, event.clientY - drag.y),
      );
      offsetX = drag.offsetX + dx;
      offsetY = drag.offsetY + dy;
      dialog.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    });
    const finish = () => {
      drag = null;
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
    handle.addEventListener("lostpointercapture", finish);
    // 搜索结果或图片加载会改变弹窗尺寸，拖动后仍需保持标题和关闭按钮在窗口内。
    if (typeof ResizeObserver === "function") {
      new ResizeObserver(() => {
        if (!dialog.open || drag || (!offsetX && !offsetY)) return;
        const box = dialog.getBoundingClientRect();
        offsetX += box.left < 8 ? 8 - box.left : Math.min(0, window.innerWidth - 8 - box.right);
        offsetY += box.top < 8 ? 8 - box.top : Math.min(0, window.innerHeight - 8 - box.bottom);
        dialog.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
      }).observe(dialog);
    }
    window.addEventListener("resize", () => {
      finish();
      offsetX = 0;
      offsetY = 0;
      dialog.style.transform = "";
    });
  }

  const viewer = document.getElementById("image-viewer");
  const image = document.getElementById("viewer-image");
  const status = document.getElementById("image-status");
  const caption = document.getElementById("image-caption");
  const size = document.getElementById("image-size");
  const link = document.getElementById("image-link");
  if (viewer && image && status && caption && size && link) {
    const canvas = image.parentElement;
    let imageTimeout;
    viewer.addEventListener("close", () => clearTimeout(imageTimeout));
    const resetSize = () => {
      canvas.classList.remove("is-original");
      size.textContent = "原始大小";
      size.setAttribute("aria-pressed", "false");
      canvas.scrollTop = canvas.scrollLeft = 0;
    };
    const toggleSize = () => {
      if (size.disabled) return;
      const original = canvas.classList.toggle("is-original");
      size.textContent = original ? "适应窗口" : "原始大小";
      size.setAttribute("aria-pressed", String(original));
    };
    size.addEventListener("click", toggleSize);
    image.addEventListener("click", toggleSize);
    image.addEventListener("load", () => {
      clearTimeout(imageTimeout);
      if (!viewer.open) return;
      image.hidden = false;
      status.hidden = true;
      size.disabled = false;
    });
    image.addEventListener("error", () => {
      clearTimeout(imageTimeout);
      image.hidden = true;
      status.hidden = false;
      size.disabled = true;
      status.textContent = "图片暂时无法加载，请关闭后重试。";
    });
    function enlarge(source, invoker) {
      const src = source.currentSrc || source.src;
      if (!src) return false;
      resetSize();
      caption.textContent = source.alt || "";
      image.alt = source.alt || "图片预览";
      image.hidden = true;
      size.disabled = true;
      status.textContent = "正在加载图片…";
      status.hidden = false;
      const originalLink =
        source.closest("a[href]") || source.closest(".banner-slide")?.querySelector(".banner-link");
      link.hidden = true;
      link.removeAttribute("href");
      if (originalLink) {
        try {
          const url = new URL(originalLink.href, document.baseURI);
          if (url.protocol === "https:" || url.protocol === "http:") {
            link.href = url.href;
            link.hidden = false;
          }
        } catch {
          /* 无效自定义链接不进入预览弹窗。 */
        }
      }
      openDialog(viewer, invoker || source);
      clearTimeout(imageTimeout);
      imageTimeout = setTimeout(() => {
        if (viewer.open && image.hidden) status.textContent = "图片加载较慢，可以关闭后重新尝试。";
      }, 15000);
      image.src = src;
      if (image.complete && image.naturalWidth) {
        clearTimeout(imageTimeout);
        image.hidden = false;
        status.hidden = true;
        size.disabled = false;
      }
      return true;
    }
    const findImage = (target, event) => {
      if (target.closest("dialog")) return null;
      const direct = target.closest("img");
      if (direct) return direct;
      // 横幅的覆盖链接仍保留单独入口，其图片区域点击后放大。
      if (target.matches(".banner-link")) {
        const slide = target.closest(".banner-slide");
        return (
          document
            .elementsFromPoint(event.clientX, event.clientY)
            .find((item) => item.matches("img") && slide.contains(item)) ||
          slide.querySelector("img")
        );
      }
      return null;
    };
    document.addEventListener(
      "click",
      (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
          return;
        const source = findImage(event.target, event);
        if (source && enlarge(source, event.target.closest(".banner-link") || source)) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      },
      true,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          event.target.matches("img.reader-zoomable")
        ) {
          if (enlarge(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
        }
      },
      true,
    );
    const prepareImage = (item) => {
      if (item.closest("dialog") || item.classList.contains("reader-zoomable")) return;
      item.classList.add("reader-zoomable");
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-haspopup", "dialog");
      item.setAttribute("aria-label", item.alt ? `放大图片：${item.alt}` : "放大图片");
      if (!item.title) item.title = "点击放大图片";
    };
    document.querySelectorAll("img").forEach(prepareImage);
    const observer = new MutationObserver((changes) => {
      for (const change of changes)
        for (const node of change.addedNodes) {
          if (node.nodeType !== 1) continue;
          if (node.matches("img")) prepareImage(node);
          node.querySelectorAll("img").forEach(prepareImage);
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
  // 兼容历史搜索地址和书签，正常入口始终在当前页面弹窗。
  const auto = dialogs.find((dialog) => dialog.hasAttribute("data-auto-open"));
  if (auto) openDialog(auto, document.querySelector(".search-toggle"));
})();
