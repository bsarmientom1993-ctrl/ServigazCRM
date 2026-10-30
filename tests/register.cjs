process.env.DISABLE_WEB_PUSH ||= '1';
const path = require("node:path");
const Module = require("node:module");
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: "CommonJS", moduleResolution: "Node", jsx: "react-jsx" });
require("ts-node/register/transpile-only");
const resolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, ...args) {
  if (request.startsWith("@/")) request = path.join(__dirname, "../src", request.slice(2));
  return resolve.call(this, request, parent, ...args);
};

