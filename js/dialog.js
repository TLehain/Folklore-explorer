// Accessible modal dialog: focus moves in, Tab stays inside, Escape closes,
// and focus returns to the element that opened it.
import { escapeHtml } from './util.js';

const stack = [];

export function openDialog({ id, title, bodyHtml, footerHtml = '', dismissible = true, onClose }) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();

  const previouslyFocused = document.activeElement;
  const titleId = `${id}-title`;

  const root = document.createElement('div');
  root.id = id;
  root.className = 'story-modal';
  root.innerHTML = `
    <div class="modal-backdrop" ${dismissible ? 'data-action="dismiss"' : ''}></div>
    <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal-header">
        <h2 id="${titleId}">${escapeHtml(title)}</h2>
        ${dismissible ? '<button class="close-btn" data-action="dismiss" aria-label="Close">×</button>' : ''}
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;

  let closed = false;
  const api = { root, close };

  function close() {
    if (closed) return;
    closed = true;
    const index = stack.indexOf(api);
    if (index !== -1) stack.splice(index, 1);
    root.remove();
    document.removeEventListener('keydown', onKeyDown);
    if (!stack.length) document.body.style.overflow = '';
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
    if (onClose) onClose();
  }

  function focusableElements() {
    const selector = 'button, [href], input, select, textarea, audio[controls], [tabindex]:not([tabindex="-1"])';
    return Array.from(root.querySelectorAll(selector))
      .filter(element => !element.disabled && element.offsetParent !== null);
  }

  function onKeyDown(event) {
    if (stack[stack.length - 1] !== api) return; // only the top dialog responds

    if (event.key === 'Escape' && dismissible) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = focusableElements();
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (!root.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  root.addEventListener('click', event => {
    if (event.target.closest('[data-action="dismiss"]')) close();
  });

  root.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
  `;

  document.body.appendChild(root);
  document.body.style.overflow = 'hidden';
  stack.push(api);
  document.addEventListener('keydown', onKeyDown);

  const initial = root.querySelector('[data-autofocus]') || focusableElements()[0];
  if (initial) initial.focus();

  return api;
}
