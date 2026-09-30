#!/usr/bin/env node
/*
 Simple smoke tests for auth-server using in-memory server.
 Validates app-based access rules for /verify-token and /check-auth.
*/

const http = require('http');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = require('../server');

function startInMemoryServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function httpRequest({ method = 'GET', url, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname, search } = new URL(url);
    const data = body ? Buffer.from(JSON.stringify(body)) : undefined;

    const req = http.request(
      {
        hostname,
        port,
        path: pathname + (search || ''),
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data ? data.length : 0,
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const json = raw ? JSON.parse(raw) : {};
            resolve({ status: res.statusCode, headers: res.headers, json });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, text: raw });
          }
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function signToken(email) {
  const secret = process.env.JWT_SECRET || 'your_secret_key';
  return jwt.sign({ email, name: 'Test User' }, secret, { expiresIn: '1h' });
}

async function run() {
  const { server, baseUrl } = await startInMemoryServer();
  const results = [];

  const publicApps = (process.env.PUBLIC_APPS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const expectedPublic = ['wall', 'events'];
  const expectedInternal = ['bus', 'openhouse'];

  // Assert env matches expectations for this test
  const envOk = expectedPublic.every((a) => publicApps.includes(a));
  if (!envOk) {
    console.error('PUBLIC_APPS in .env does not include expected public apps:', expectedPublic, 'Got:', publicApps);
  }

  const users = [
    { email: 'external.user@gmail.com', label: 'external', allowedPublic: true, allowedInternal: false },
    { email: 'alice@vnrvjiet.in', label: 'internal', allowedPublic: true, allowedInternal: true },
  ];

  async function testVerifyToken(appName, email, expectValid) {
    const token = signToken(email);
    const res = await httpRequest({
      method: 'POST',
      url: `${baseUrl}/verify-token`,
      body: { token, app: appName },
    });
    const pass = res.status === (expectValid ? 200 : 403) && (!!res.json?.valid) === expectValid;
    results.push({ endpoint: 'verify-token', app: appName, email, expectValid, status: res.status, json: res.json, pass });
    return pass;
  }

  async function testCheckAuth(appName, email, expectLoggedIn) {
    const token = signToken(email);
    const res = await httpRequest({
      method: 'GET',
      url: `${baseUrl}/check-auth?app=${encodeURIComponent(appName)}`,
      headers: { Cookie: `userToken=${token}` },
    });
    const pass = (!!res.json?.logged_in) === expectLoggedIn;
    results.push({ endpoint: 'check-auth', app: appName, email, expectLoggedIn, status: res.status, json: res.json, pass });
    return pass;
  }

  let allPass = true;

  for (const user of users) {
    for (const appName of expectedPublic) {
      const ok1 = await testVerifyToken(appName, user.email, user.allowedPublic);
      const ok2 = await testCheckAuth(appName, user.email, user.allowedPublic);
      allPass = allPass && ok1 && ok2;
    }
    for (const appName of expectedInternal) {
      const ok1 = await testVerifyToken(appName, user.email, user.allowedInternal);
      const ok2 = await testCheckAuth(appName, user.email, user.allowedInternal);
      allPass = allPass && ok1 && ok2;
    }
  }

  // Pretty print results
  for (const r of results) {
    const tag = r.pass ? 'PASS' : 'FAIL';
    console.log(`[${tag}] ${r.endpoint} app=${r.app} email=${r.email} -> status=${r.status} body=${JSON.stringify(r.json)}`);
  }

  server.close();
  if (!allPass) {
    console.error('One or more smoke tests failed');
    process.exit(1);
  } else {
    console.log('All smoke tests passed');
  }
}

run().catch((e) => {
  console.error('Smoke test error:', e);
  process.exit(1);
});
