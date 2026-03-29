const { captureProjects } = require('./capturer');
const { loadConfig } = require('./config');
const { optimizeImage } = require('./optimizer');

module.exports = {
  captureProjects,
  loadConfig,
  optimizeImage
};
