import { createServer, request } from 'node:http';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { finishWebSocketProxy, traceWebSocketFrames } from './site-websocket-fixture.mjs';
const root = process.cwd();
const evidenceBase = join(root, '.local-evidence', 'site-websocket-fixture');
mkdirSync(evidenceBase, { recursive: true });
const out = mkdtempSync(join(evidenceBase, 'run-'));
const { WebSocket, WebSocketServer } = createRequire(join(root, 'server/three-dragon/package.json'))('ws');
const traceFrames = (socket, direction, record, head) => traceWebSocketFrames(socket, frame => record({ direction, ...frame }), head);
async function probe(mode, bytes, pauseMs, writeDelayMs = 0, scenario = 'normal-fin') {
  const events = [], started = Date.now(), record = value => events.push({ ms: Date.now() - started, ...value });
  const upstream = createServer(), wss = new WebSocketServer({ server: upstream });
  wss.on('connection', socket => {
    socket.on('error', () => {});
    socket.on('message', () => {
      if (scenario === 'backend-reset') { socket._socket.resetAndDestroy(); return; }
      if (scenario === 'backend-abort') { socket.terminate(); return; }
      if (bytes) socket.send(Buffer.alloc(bytes), { binary: true });
      socket.close(1008, 'notAllowed');
      // Fault fixture: normal FIN immediately after a queued close frame, without waiting for its reply.
      socket._socket.end();
    });
  });
  await new Promise(done => upstream.listen(0, '127.0.0.1', done));
  const proxy = createServer();
  let pair;
  proxy.on('upgrade', (req, frontend, head) => {
    const forward = request({ hostname: '127.0.0.1', port: upstream.address().port, path: req.url, headers: req.headers });
    forward.on('upgrade', (response, backend, backendHead) => {
      pair = { frontend, backend };
      frontend.write('HTTP/1.1 101 Switching Protocols\r\n' + Object.entries(response.headers).map(([key, value]) => key + ': ' + value).join('\r\n') + '\r\n\r\n');
      // Controlled writable latency after the HTTP upgrade, without altering frame bytes.
      if (writeDelayMs) {
        const nativeWrite = frontend._write.bind(frontend);
        frontend._write = (chunk, encoding, callback) => setTimeout(() => {
          if (frontend.destroyed) { const error = new Error('Synthetic delayed write destroyed'); error.code = 'ERR_STREAM_DESTROYED'; callback(error); }
          else nativeWrite(chunk, encoding, callback);
        }, writeDelayMs);
      }
      if (backendHead.length) frontend.write(backendHead);
      if (head.length) backend.write(head);
      traceFrames(frontend, 'client-to-server', record, head); traceFrames(backend, 'server-to-client', record, backendHead);
      for (const event of ['end', 'finish', 'close']) for (const [name, socket] of Object.entries(pair)) {
        socket.on(event, () => record({ event: name + '-' + event, writableBytes: socket.writableLength, frontendQueuedBytes: frontend.writableLength, destroyed: socket.destroyed }));
      }
      frontend.on('error', error => { record({ event: 'frontend-error', code: error.code }); backend.destroy(); }); backend.on('error', error => { record({ event: 'backend-error', code: error.code }); frontend.destroy(); });
      frontend.on('close', () => backend.destroy());
      backend.on('close', () => mode === 'old' ? frontend.destroy() : finishWebSocketProxy(frontend));
      frontend.pipe(backend); backend.pipe(frontend);
    });
    forward.on('error', () => frontend.destroy()); forward.end();
  });
  await new Promise(done => proxy.listen(0, '127.0.0.1', done));
  const client = new WebSocket('ws://127.0.0.1:' + proxy.address().port);
  client.on('error', () => {});
  let messageBytes = 0;
  client.on('message', data => { messageBytes += data.length; });
  const result = await new Promise(resolve => {
    const timer = setTimeout(() => { client.terminate(); resolve({ closeCode: 'timeout' }); }, 3000);
    client.on('open', () => {
      if (scenario === 'frontend-reset') { client._socket.resetAndDestroy(); return; }
      if (scenario === 'frontend-abort') { client.terminate(); return; }
      if (scenario === 'frontend-end') { client._socket.end(); return; }
      if (pauseMs) { client._socket.pause(); setTimeout(() => client._socket.resume(), pauseMs); }
      client.send('synthetic-auth');
    });
    client.on('close', code => { clearTimeout(timer); resolve({ closeCode: code }); });
  });
  await new Promise(done => setTimeout(done, 30));
  const cleanupHealthy = !!pair?.frontend.destroyed && !!pair?.backend.destroyed && wss.clients.size === 0;
  const cleanup = { frontendDestroyed: pair?.frontend.destroyed, frontendEnded: pair?.frontend.writableEnded, frontendReadEnded: pair?.frontend.readableEnded, backendDestroyed: pair?.backend.destroyed, backendEnded: pair?.backend.writableEnded, backendReadEnded: pair?.backend.readableEnded, upstreamClients: wss.clients.size };
  pair?.frontend.destroy(); pair?.backend.destroy();
  await Promise.all([new Promise(done => proxy.close(done)), new Promise(done => upstream.close(done))]);
  wss.close();
  return { mode, scenario, bytes, pauseMs, writeDelayMs, ...result, messageBytes, cleanupHealthy, cleanup, events };
}
const results = [];
for (const bytes of [0, 1024 * 1024, 8 * 1024 * 1024]) for (const mode of ['old', 'graceful']) {
  const value = await probe(mode, bytes, bytes ? 120 : 0); results.push(value);
  if (!value.cleanupHealthy) console.log(JSON.stringify(value));
  assert.equal(value.closeCode, 1008); assert.equal(value.cleanupHealthy, true);
  assert.equal(value.messageBytes, bytes, 'Normal FIN must preserve the complete application frame.');
  console.log(JSON.stringify({ mode, bytes, closeCode: value.closeCode, messageBytes: value.messageBytes, maxWritableBytes: Math.max(...value.events.map(event => event.writableBytes || 0)), control: value.events.filter(event => event.opcode >= 8) }));
}
for (let index = 0; index < 8; index++) for (const mode of ['old', 'graceful']) {
  const value = await probe(mode, 0, 0, 80); results.push(value);
  assert.equal(value.closeCode, mode === 'old' ? 1006 : 1008); assert.equal(value.cleanupHealthy, true);
  console.log(JSON.stringify({ index, mode, writeDelayMs: 80, closeCode: value.closeCode, maxWritableBytes: Math.max(...value.events.map(event => event.frontendQueuedBytes || 0)), control: value.events.filter(event => event.opcode >= 8) }));
}
for (const scenario of ['backend-reset', 'backend-abort', 'frontend-reset', 'frontend-abort', 'frontend-end']) for (const mode of ['old', 'graceful']) {
  const value = await probe(mode, 0, 0, 0, scenario); results.push(value);
  assert.equal(value.closeCode, 1006); assert.equal(value.cleanupHealthy, true);
  console.log(JSON.stringify({ mode, scenario, closeCode: value.closeCode, cleanupHealthy: value.cleanupHealthy, errors: value.events.filter(event => event.event?.endsWith('-error')) }));
}
// Fragment each header/control payload byte, and test a 64-bit-sized application frame with no retained content.
const stream = new EventEmitter(), metadata = [];
traceWebSocketFrames(stream, frame => metadata.push(frame));
const binaryHeader = Buffer.from([0x82, 127, 0, 0, 0, 0, 0, 1, 0, 0]);
const maskedClose = Buffer.from([0x88, 0x82, 1, 2, 3, 4, 0x03 ^ 1, 0xf0 ^ 2]);
for (const chunk of [binaryHeader, Buffer.alloc(65536), Buffer.from([0x89, 0]), maskedClose]) {
  for (const byte of chunk) stream.emit('data', Buffer.from([byte]));
}
assert.deepEqual(metadata, [{ opcode: 2, bytes: 65536, frameIndex: 1 }, { opcode: 9, bytes: 0, frameIndex: 2 }, { opcode: 8, bytes: 2, frameIndex: 3, closeCode: 1008 }]);
console.log(JSON.stringify({ parser: 'fragmented-64bit-header-and-masked-close', metadata }));
writeFileSync(join(out, 'result.json'), JSON.stringify({ cases: results.length, results, parser: metadata }, null, 2));
console.log(out);
