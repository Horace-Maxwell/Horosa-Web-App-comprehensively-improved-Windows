const path = require('path');

function requireWithVendorFallback(moduleName, vendorRelativePath) {
  try {
    return require(moduleName);
  } catch (error) {
    if (!error || error.code !== 'MODULE_NOT_FOUND') {
      throw error;
    }
    return require(path.resolve(__dirname, vendorRelativePath));
  }
}

module.exports = {
  forge: requireWithVendorFallback('node-forge', './vendor/node-forge'),
  RSA: requireWithVendorFallback('js-rsa', './vendor/js-rsa.js'),
};
