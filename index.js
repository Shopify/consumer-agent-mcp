#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

const DEFAULT_LOG_DIR = path.join(process.env.HOME || process.env.USERPROFILE, 'bridge_logs');
const LOG_FILE = path.join(DEFAULT_LOG_DIR, 'bridge.log');

if (!fs.existsSync(DEFAULT_LOG_DIR)) {
  fs.mkdirSync(DEFAULT_LOG_DIR, { recursive: true });
}

try {
  fs.accessSync(LOG_FILE, fs.constants.W_OK);
} catch (err) {
  console.error(`Warning: Cannot write to ${LOG_FILE}. Check permissions or file system.`);
}

function logMessage(message, requestId = null) {
  if (fs.existsSync(LOG_FILE)) {
    const timestamp = new Date().toISOString();
    const serverPrefix = process.env.MCP_SERVER ? `[${process.env.MCP_SERVER}] ` : '';
    const requestIdPrefix = requestId ? `[RequestID: ${requestId}] ` : '';
    fs.appendFileSync(LOG_FILE, `${timestamp} ${serverPrefix}${requestIdPrefix}${message}\n\n`, 'utf8');
  }
}

function logRpcError(message, code = -32603, data = undefined, id = null, requestId = null) {
  logMessage(`Error: ${message}, Data: ${data}, Code: ${code}, ID: ${id}`, requestId);
  const errorResponse = {
    jsonrpc: "2.0",
    error: {
      code: code,
      message: message
    },
    id: id
  };

  if (data !== undefined) {
    errorResponse.error.data = data;
  }

  console.log(JSON.stringify(errorResponse));
}

if (!process.env.MCP_SERVER) {
  logRpcError("MCP_SERVER environment variable is not set", -32602);
  process.exit(1);
}

logMessage("Bridge started");

let buffer = '';

process.stdin.on('data', (data) => {
  logMessage("Received data from stdin");
  buffer += data.toString();

  processBufferedInput();
});

function processBufferedInput() {
  let startPos = 0;

  while (startPos < buffer.length) {
    try {
      const jsonStart = buffer.indexOf('{', startPos);
      if (jsonStart === -1) {
        buffer = buffer.substring(startPos);
        return;
      }

      let jsonEnd = -1;
      let depth = 0;
      let inString = false;
      let escaped = false;

      for (let i = jsonStart; i < buffer.length; i++) {
        const char = buffer[i];

        if (inString) {
          if (escaped) {
            escaped = false;
          } else if (char === '\\') {
            escaped = true;
          } else if (char === '"') {
            inString = false;
          }
        } else if (char === '"') {
          inString = true;
        } else if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) {
            jsonEnd = i;
            break;
          }
        }
      }

      if (jsonEnd === -1) {
        buffer = buffer.substring(startPos);
        return;
      }

      const jsonStr = buffer.substring(jsonStart, jsonEnd + 1);
      logMessage(`Processing JSON: ${jsonStr}`);

      try {
        const jsonObj = JSON.parse(jsonStr);
        processJsonRpcRequest(jsonStr, jsonObj);
      } catch (e) {
        logMessage(`Invalid JSON: ${jsonStr}`);
        logMessage(`Parse error details: ${e.message}`);
      }

      startPos = jsonEnd + 1;
    } catch (e) {
      logMessage(`Error in JSON processing: ${e.message}`);
      buffer = buffer.substring(startPos);
      return;
    }
  }

  buffer = '';
}

function processJsonRpcRequest(jsonStr, jsonObj) {
  const rpcId = jsonObj.id;

  if (process.env.BEARER_TOKEN && (process.env.USERNAME || process.env.PASSWORD)) {
    logRpcError("Both BEARER_TOKEN and USERNAME/PASSWORD are provided. Use only one authentication method.", -32602, undefined, rpcId);
    process.exit(1);
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (process.env.BEARER_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.BEARER_TOKEN}`;
  } else if (process.env.USERNAME && process.env.PASSWORD) {
    const basicAuth = Buffer.from(`${process.env.USERNAME}:${process.env.PASSWORD}`).toString('base64');
    headers['Authorization'] = `Basic ${basicAuth}`;
  }

  logMessage(`Processing request with ID: ${rpcId}`, null);

  const url = new URL(process.env.MCP_SERVER);

  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers,
  };

  const req = https.request(options, (res) => {
    let responseData = '';
    const requestId = res.headers['x-request-id'];

    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      try {
        if (!responseData.trim()) {
          logMessage(`Received empty response for RPC ID ${rpcId}`, requestId);
          if (rpcId !== undefined && rpcId !== null) {
            logRpcError("Empty response from server", -32603, "Server returned empty content", rpcId, requestId);
          }
          return;
        }

        const jsonResponse = JSON.parse(responseData);

        if (rpcId === undefined || rpcId === null) {
          logMessage(`Processed notification request successfully (no response needed)`, requestId);
          return;
        }

        logMessage(`Response for RPC ID ${rpcId}: ${JSON.stringify(jsonResponse)}`, requestId);
        console.log(JSON.stringify(jsonResponse));
      } catch (e) {
        if (rpcId !== undefined && rpcId !== null) {
          logRpcError("Invalid JSON response from server", -32603, responseData, rpcId, requestId);
        } else {
          logMessage(`Error processing notification response: ${e.message}`, requestId);
        }
      }
    });
  });

  req.on('error', (error) => {
    logMessage(`Request failed for RPC ID ${rpcId}`, null);
    logMessage(error.message, null);
    logRpcError("Request failed", -32603, error.message, rpcId);
  });

  req.write(jsonStr);
  req.end();
}

process.stdin.on('end', () => {
  logMessage("Bridge shutting down");
});