const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */

// Firebase subpackages that need to be resolved to their CJS builds
const FIREBASE_CJS_PACKAGES = [
  'app',
  'database',
  'auth',
  'storage',
  'firestore',
  'functions',
  'messaging',
  'analytics',
];

const config = {
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      // Redirect firebase/* subpath imports to their CJS dist files
      const match = moduleName.match(/^firebase\/(.+)$/);
      if (match && FIREBASE_CJS_PACKAGES.includes(match[1])) {
        return {
          filePath: path.resolve(
            __dirname,
            `node_modules/firebase/${match[1]}/dist/index.cjs.js`,
          ),
          type: 'sourceFile',
        };
      }
      // Default resolution for everything else
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
