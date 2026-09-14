import React, { useEffect, useState } from 'react';

let toastCallback = null;

export const showToast = (message, type = 'info', duration = 4000) => {
  if (toastCallback) {
    toastCallback({ message, type, duration, id: Date.now() });
  }
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    toastCallback = ({ message, type, duration, id }) => {
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    return () => { toastCallback = null; };
  }, []);

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast show toast-${toast.type}`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
