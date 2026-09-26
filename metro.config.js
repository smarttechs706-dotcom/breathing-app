const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');

const config = getDefaultConfig(__dirname);

// Proxies /api/* requests through Metro's dev server to the local
// breathing-app-api backend (localhost:3000). Needed when Expo is running
// in --tunnel mode: the tunnel only forwards Metro's own bundler port, so a
// LAN IP in EXPO_PUBLIC_API_BASE_URL is unreachable from a device that has
// no direct LAN path to this machine. Routing API calls through the same
// tunnel Metro already uses sidesteps that.
const BACKEND_PORT = 3000;
const originalEnhanceMiddleware = config.server.enhanceMiddleware;

config.server.enhanceMiddleware = (metroMiddleware, metroServer) => {
  const middleware = originalEnhanceMiddleware
    ? originalEnhanceMiddleware(metroMiddleware, metroServer)
    : metroMiddleware;

  return (req, res, next) => {
    if (req.url && req.url.startsWith('/api/')) {
      const proxyReq = http.request(
        {
          hostname: 'localhost',
          port: BACKEND_PORT,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (proxyRes) => {
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(res, { end: true });
        }
      );

      proxyReq.on('error', (err) => {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Backend proxy error', message: err.message }));
      });

      req.pipe(proxyReq, { end: true });
      return;
    }

    return middleware(req, res, next);
  };
};

module.exports = config;
