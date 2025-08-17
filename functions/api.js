const serverless = require('serverless-http');
const app = require('../server-minimal');

module.exports.handler = serverless(app);