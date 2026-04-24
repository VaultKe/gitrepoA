const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable fast refresh and hot reloading
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Optimize for development
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    // Disable minification in development for faster builds
    mangle: false,
    keep_fnames: true,
  },
};

// Enable fast refresh
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Enable CORS for development
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      return middleware(req, res, next);
    };
  },
};

// Improve watch performance
config.watchFolders = [__dirname];

module.exports = config;
