// One MutationObserver, work batched per animation frame. Added nodes are
// collected as they arrive and handed to onFlush once per frame, so a burst
// of fifty items costs one pass, not fifty.

export function createPipeline(target, onFlush, { raf = globalThis.requestAnimationFrame, ignore = () => false } = {}) {
  let pending = [];
  let scheduled = false;

  function flush() {
    scheduled = false;
    const batch = pending;
    pending = [];
    if (batch.length) onFlush(batch);
  }

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || ignore(n)) continue;
        pending.push(n);
      }
    }
    if (pending.length && !scheduled) {
      scheduled = true;
      raf(flush);
    }
  });
  observer.observe(target, { childList: true, subtree: true });

  return {
    flush,
    stop() { observer.disconnect(); },
  };
}
