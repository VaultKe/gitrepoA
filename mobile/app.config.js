const dotenv = require('dotenv');

dotenv.config({ path: '.env' });

module.exports = ({ config }) => {
  const extra = {
    ...((config && config.extra) || {}),
    BACKEND_API_URL: process.env.BACKEND_API_URL || '',
    API_BASE_URL: process.env.API_BASE_URL || process.env.BACKEND_API_URL || '',
    REACT_APP_API_URL: process.env.REACT_APP_API_URL || process.env.BACKEND_API_URL || '',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || process.env.BACKEND_API_URL || '',
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || process.env.BACKEND_API_URL || '',
    NETWORK_IP: process.env.NETWORK_IP || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  return {
    ...config,
    extra,
  };
};
