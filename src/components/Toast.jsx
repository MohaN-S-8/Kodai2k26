function Toast({ toast, onClose }) {
  if (!toast) {
    return null;
  }

  return (
    <div className={`toast toast-${toast.type}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" aria-label="Close notification" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

export default Toast;
