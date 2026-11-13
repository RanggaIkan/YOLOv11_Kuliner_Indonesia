"use strict";

const { handleRequest } = require("../server.js");

async function handler(req, res) {
  if (req && req.url) {
    const parsed = new URL(req.url, "http://localhost");
    const rewrittenPath = parsed.searchParams.get("__path");
    if (rewrittenPath !== null) {
      parsed.searchParams.delete("__path");
      const qs = parsed.searchParams.toString();
      req.url = `/api/${rewrittenPath}${qs ? `?${qs}` : ""}`;
    }
  }
  return handleRequest(req, res);
}

handler.config = {
  api: {
    bodyParser: false,
  },
};

module.exports = handler;
