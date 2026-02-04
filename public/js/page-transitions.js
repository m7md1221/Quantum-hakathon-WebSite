// Page transitions helper
(function () {
  function navigateWithTransition(url) {
    try {
      document.body.classList.add('page-exit');
      window.setTimeout(() => {
        window.location.href = url;
      }, 180);
    } catch (e) {
      window.location.href = url;
    }
  }

  function isSameOriginLink(link) {
    try {
      const url = new URL(link.href, window.location.href);
      return url.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('page-ready');

    document.addEventListener('click', (event) => {
      const anchor = event.target.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('data-no-transition')) return;
      if (anchor.hasAttribute('download')) return;
      if (anchor.href && anchor.href.startsWith('blob:')) return;
      if (!isSameOriginLink(anchor)) return;

      event.preventDefault();
      navigateWithTransition(anchor.href);
    });
  });

  window.navigateWithTransition = navigateWithTransition;
  window.goTo = navigateWithTransition;
})();
