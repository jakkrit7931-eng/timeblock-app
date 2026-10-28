/* Keep the display awake only while an active session is visible. */
(function () {
  const key = 'momenta_keep_screen_awake';
  let enabled = true;
  try { enabled = localStorage.getItem(key) !== 'false'; } catch (_) {}
  const sources = new Set();
  let sentinel = null;
  let pending = false;
  let failed = false;
  const toggle = document.getElementById('momentaWakeToggle');
  const status = document.getElementById('momentaWakeStatus');
  const supported = !!navigator.wakeLock?.request;
  function wanted() { return enabled && supported && document.visibilityState === 'visible' && sources.size > 0; }
  function render() {
    if (toggle) toggle.checked = enabled;
    if (!status) return;
    status.textContent = !supported ? 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการเปิดหน้าจอค้างไว้' : !enabled ? 'ปิดการเปิดหน้าจอค้างไว้' : sentinel ? 'เปิดหน้าจอค้างไว้ระหว่างจับเวลา' : failed ? 'เปิดหน้าจอค้างไว้ไม่ได้ ตรวจโหมดประหยัดพลังงานหรือลองเปิดแอปอีกครั้ง' : sources.size ? 'กำลังขอเปิดหน้าจอค้างไว้' : 'หน้าจอจะเปิดค้างเมื่อเริ่มจับเวลา';
  }
  async function refresh() {
    if (!wanted()) {
      const old = sentinel;
      sentinel = null;
      if (old) { try { await old.release(); } catch (_) {} }
      render();
      return;
    }
    if (sentinel || pending || failed) { render(); return; }
    pending = true;
    render();
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (!wanted()) { await lock.release(); }
      else {
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel !== lock) return;
          sentinel = null;
          if (wanted()) failed = true;
          render();
        });
      }
    } catch (_) { failed = true; }
    finally { pending = false; render(); }
  }
  toggle?.addEventListener('change', () => {
    enabled = toggle.checked;
    failed = false;
    try { localStorage.setItem(key, String(enabled)); } catch (_) {}
    refresh();
  });
  document.addEventListener('visibilitychange', () => { failed = false; refresh(); });
  window.MomentaWake = {
    setActive(source, active) {
      const had = sources.has(source);
      if (active) sources.add(source); else sources.delete(source);
      if (had !== !!active) { failed = false; refresh(); }
    }
  };
  render();
})();
