// Toast notifications

function showToast(message, className, role, background, zIndex) {
  const toast = document.createElement('div');
  toast.className = className;
  toast.setAttribute('role', role);
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${background};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: ${zIndex};
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    max-width: 90%;
    text-align: center;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

export function showError(message) {
  showToast(message, 'error-notification', 'alert', '#b3261e', 3000);
}

export function showSuccess(message) {
  showToast(message, 'success-notification', 'status', '#2e7d32', 3000);
}
