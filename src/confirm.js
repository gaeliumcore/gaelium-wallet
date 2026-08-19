// Renderer of the confirmation window. It receives what to show, it sends back
// yes or no, and it has access to nothing else.
(function () {
  var answered = false;
  function answer(ok) {
    if (answered) return;
    answered = true;
    window.confirm.answer(ok);
  }
  window.confirm.onData(function (d) {
    document.getElementById('title').textContent = d.title || '';
    document.getElementById('message').textContent = d.message || '';
    document.getElementById('detail').textContent = d.detail || '';
    document.getElementById('ok').textContent = d.confirmLabel || 'Confirm';
    document.getElementById('cancel').textContent = d.cancelLabel || 'Cancel';
    // Focus starts on Cancel, so the first thing a keyboard reaches is the safe
    // answer.
    document.getElementById('cancel').focus();
  });
  document.getElementById('ok').addEventListener('click', function () { answer(true); });
  document.getElementById('cancel').addEventListener('click', function () { answer(false); });
  // Enter and Escape both cancel, whatever has focus. Enter is the key people
  // press without reading, so it must never be the one that spends. Confirming
  // from the keyboard is Tab to the action and then Space, which the browser
  // activates by itself.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); answer(false); }
  });
})();
