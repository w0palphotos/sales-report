export const reveal = {
  mounted(el, binding) {
    el.classList.add('reveal');
    if (typeof binding.value === 'number') {
      el.style.transitionDelay = `${binding.value * 80}ms`;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('visible');
            observer.disconnect();
          }
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);
    el._revealObserver = observer;
  },
  unmounted(el) {
    el._revealObserver?.disconnect();
  },
};
