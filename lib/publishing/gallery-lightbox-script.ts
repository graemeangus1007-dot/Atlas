/**
 * Inline gallery lightbox runtime for published static sites.
 * Self-contained — no editor dependencies.
 */

export function renderGalleryLightboxScript(): string {
  // Compact, dependency-free lightbox controller.
  const body = `
(function () {
  var root = document.querySelector("[data-atlas-gallery-lightbox]");
  if (!root) return;
  var dialog = root.querySelector("[data-lightbox-dialog]");
  var img = root.querySelector("[data-lightbox-img]");
  var caption = root.querySelector("[data-lightbox-caption]");
  var counter = root.querySelector("[data-lightbox-counter]");
  var btnClose = root.querySelector("[data-lightbox-close]");
  var btnPrev = root.querySelector("[data-lightbox-prev]");
  var btnNext = root.querySelector("[data-lightbox-next]");
  var triggers = Array.prototype.slice.call(
    document.querySelectorAll("[data-gallery-lightbox-trigger]")
  );
  if (!dialog || !img || triggers.length === 0) return;

  var index = 0;
  var lastFocus = null;
  var items = triggers.map(function (btn) {
    return {
      src: btn.getAttribute("data-full-src") || "",
      alt: btn.getAttribute("data-alt") || "",
      title: btn.getAttribute("data-title") || "",
      caption: btn.getAttribute("data-caption") || ""
    };
  });

  function setBodyLock(on) {
    document.documentElement.style.overflow = on ? "hidden" : "";
    document.body.style.overflow = on ? "hidden" : "";
  }

  function render() {
    var item = items[index];
    if (!item) return;
    img.setAttribute("src", item.src);
    img.setAttribute("alt", item.alt || item.title || "Gallery photo");
    if (caption) {
      var parts = [];
      if (item.title) parts.push(item.title);
      if (item.caption) parts.push(item.caption);
      caption.textContent = parts.join(" — ");
      caption.hidden = parts.length === 0;
    }
    if (counter) counter.textContent = index + 1 + " / " + items.length;
    // preload neighbors
    [-1, 1].forEach(function (delta) {
      var n = (index + delta + items.length) % items.length;
      if (items[n] && items[n].src) {
        var pre = new Image();
        pre.src = items[n].src;
      }
    });
  }

  function openAt(i, focusEl) {
    index = i;
    lastFocus = focusEl || null;
    dialog.hidden = false;
    root.hidden = false;
    setBodyLock(true);
    render();
    if (btnClose) btnClose.focus();
  }

  function close() {
    dialog.hidden = true;
    root.hidden = true;
    setBodyLock(false);
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  function go(delta) {
    index = (index + delta + items.length) % items.length;
    render();
  }

  triggers.forEach(function (btn, i) {
    btn.addEventListener("click", function () {
      openAt(i, btn);
    });
  });
  if (btnClose) btnClose.addEventListener("click", close);
  if (btnPrev) btnPrev.addEventListener("click", function () { go(-1); });
  if (btnNext) btnNext.addEventListener("click", function () { go(1); });
  root.addEventListener("click", function (e) {
    if (e.target === root || e.target === dialog) close();
  });
  document.addEventListener("keydown", function (e) {
    if (root.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  });

  // Basic swipe
  var touchX = null;
  img.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0] ? e.changedTouches[0].screenX : null;
  }, { passive: true });
  img.addEventListener("touchend", function (e) {
    if (touchX == null || !e.changedTouches[0]) return;
    var dx = e.changedTouches[0].screenX - touchX;
    if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1);
    touchX = null;
  }, { passive: true });
})();
`.trim();

  return `<script data-atlas-gallery-lightbox-runtime>\n${body}\n</script>`;
}

export function renderGalleryLightboxShell(input: {
  navigation: boolean;
}): string {
  const nav = input.navigation
    ? `<button type="button" class="atlas-lightbox-nav atlas-lightbox-prev" data-lightbox-prev aria-label="Previous photo">‹</button>
    <button type="button" class="atlas-lightbox-nav atlas-lightbox-next" data-lightbox-next aria-label="Next photo">›</button>`
    : "";

  return `<div class="atlas-lightbox-root" data-atlas-gallery-lightbox hidden>
  <div class="atlas-lightbox-dialog" data-lightbox-dialog role="dialog" aria-modal="true" aria-label="Photo viewer" hidden>
    <div class="atlas-lightbox-toolbar">
      <span class="atlas-lightbox-counter" data-lightbox-counter></span>
      <button type="button" class="atlas-lightbox-close" data-lightbox-close aria-label="Close photo viewer">Close</button>
    </div>
    <div class="atlas-lightbox-stage">
      ${nav}
      <img data-lightbox-img class="atlas-lightbox-image" alt="" />
    </div>
    <p class="atlas-lightbox-caption" data-lightbox-caption hidden></p>
  </div>
</div>`;
}
