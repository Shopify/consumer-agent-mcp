#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { log } = require('console');

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

function logMessage(message) {
  if (fs.existsSync(LOG_FILE)) {
    fs.appendFileSync(LOG_FILE, `${message}\n`);
  }
}

if (!process.env.MCP_SERVER) {
  logMessage("Error: MCP_SERVER environment variable is not set.");
  process.exit(1);
}

logMessage("Bridge started");

process.stdin.on('data', async (data) => {
  logMessage("Received data from stdin");
  const line = data.toString().trim();
  logMessage(`Input JSON: ${line}`);

  try {
    JSON.parse(line);
  } catch (e) {
    logMessage(`Invalid JSON input: ${line}`);
    console.log(JSON.stringify({ error: "Invalid JSON input" }));
    return;
  }

  if (process.env.BEARER_TOKEN && (process.env.USERNAME || process.env.PASSWORD)) {
    logMessage("Error: Both BEARER_TOKEN and USERNAME/MCP_PASSWORD are provided. Use only one authentication method.");
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

  const config = {
    method: 'post',
    url: process.env.MCP_SERVER,
    headers,
    data: line,
  };

  try {
    const response = await axios(config);
    const jsonResponse = JSON.stringify(response.data)
    logMessage(`Response JSON: ${jsonResponse}`);
    console.log(jsonResponse);
  } catch (error) {
    logMessage("curl failed");
  }
});

process.stdin.on('end', () => {
  logMessage("Bridge shutting down");
});