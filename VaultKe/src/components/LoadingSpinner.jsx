import React from 'react';

const LoadingSpinner = ({ size = 'medium', text = 'Loading...' }) => {
  const sizeClass = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12',
  }[size] || 'w-8 h-8';

  return (
    <div className="flex-center" style={{ minHeight: '200px' }}>
      <div className="spinner-container">
        <div className={`spinner ${sizeClass}`}></div>
        {text && <p className="text-muted mt-2 text-sm">{text}</p>}
      </div>
    </div>
  );
};

const spinnerCSS = `
  .spinner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const SpinnerWithStyles = () => {
  return (
    <div dangerouslySetInnerHTML={{ __html: spinnerCSS }} />
  );
};

LoadingSpinner.SpinnerCSS = SpinnerWithStyles;

export default LoadingSpinner;
