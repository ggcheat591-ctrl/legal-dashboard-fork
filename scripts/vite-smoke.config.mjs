import baseConfig from '../vite.config.js';

export default {
  ...baseConfig,
  server: {
    ...(baseConfig.server || {}),
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {},
  },
};
