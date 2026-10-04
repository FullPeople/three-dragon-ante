// Test proxy lifecycle and public frame metadata. Application payloads are skipped, never retained.
export function finishWebSocketProxy(socket) {
  // Native destroySoon ends, waits for writable finish, then releases an upgraded half-open socket.
  if (!socket.destroyed) socket.destroySoon();
}

export function traceWebSocketFrames(socket, record, initialHead) {
  let header = [], remaining = 0, frame, closeBytes = [], payloadOffset = 0, mask, index = 0, disabled = false;
  const feed = chunk => {
    if (disabled) return;
    let offset = 0;
    while (offset < chunk.length) {
      if (!remaining) {
        header.push(chunk[offset++]);
        if (header.length < 2) continue;
        const size = header[1] & 127, masked = !!(header[1] & 128);
        const need = 2 + (size === 126 ? 2 : size === 127 ? 8 : 0) + (masked ? 4 : 0);
        if (header.length < need) continue;
        const value = Buffer.from(header);
        const bytes = size === 126 ? value.readUInt16BE(2) : size === 127 ? Number(value.readBigUInt64BE(2)) : size;
        if (!Number.isSafeInteger(bytes)) { disabled = true; header = []; return; }
        frame = { opcode: header[0] & 15, bytes, frameIndex: ++index };
        mask = masked ? value.subarray(need - 4) : undefined;
        remaining = bytes; payloadOffset = 0; closeBytes = []; header = [];
        if (!remaining) { if (index <= 2 || frame.opcode >= 8) record(frame); frame = undefined; continue; }
      }
      const count = Math.min(remaining, chunk.length - offset);
      if (frame.opcode === 8 && closeBytes.length < 2) {
        for (let position = 0; position < count && closeBytes.length < 2; position++) {
          closeBytes.push(chunk[offset + position] ^ (mask ? mask[(payloadOffset + position) % 4] : 0));
        }
      }
      offset += count; remaining -= count; payloadOffset += count;
      if (!remaining) {
        if (closeBytes.length === 2) frame.closeCode = closeBytes[0] * 256 + closeBytes[1];
        if (index <= 2 || frame.opcode >= 8) record(frame);
        frame = undefined; mask = undefined; closeBytes = [];
      }
    }
  };
  socket.on('data', feed);
  if (initialHead?.length) feed(initialHead);
}
