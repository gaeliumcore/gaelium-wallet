// Renderer of the confirmation window. It receives what to show, it says when it
// has shown it, it sends back yes or no, and it has access to nothing else.
(function () {
  var bridge = window.gaeliumConfirm;
  var answered = false;

  function answer(ok) {
    if (answered) return;
    answered = true;
    if (bridge) bridge.answer(ok);
  }

  // Wired before anything else, so that no failure further down can leave the
  // buttons drawn and inert. If the bridge is absent or the payload never
  // arrives, the window still cancels on a click or on Escape.
  document.getElementById('ok').addEventListener('click', function () { answer(true); });
  document.getElementById('cancel').addEventListener('click', function () { answer(false); });
  // Enter and Escape both cancel, whatever has focus. Enter is the key people
  // press without reading, so it must never be the one that spends. Confirming
  // from the keyboard is Tab to the action and then Space, which the browser
  // activates by itself.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); answer(false); }
  });

  if (!bridge) return;

  bridge.onData(function (d) {
    document.getElementById('title').textContent = d.title || '';
    document.getElementById('message').textContent = d.message || '';
    document.getElementById('detail').textContent = d.detail || '';
    document.getElementById('ok').textContent = d.confirmLabel || 'Confirm';
    document.getElementById('cancel').textContent = d.cancelLabel || 'Cancel';
    // Focus starts on Cancel, so the first thing a keyboard reaches is the safe
    // answer.
    document.getElementById('cancel').focus();
    // Sent only once the text is in the document. The main process waits for
    // this: a window that loads but never fills itself gets closed and the
    // system box opens instead.
    bridge.ready();
  });
})();
