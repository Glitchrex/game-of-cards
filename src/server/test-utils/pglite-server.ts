/**
 * Test-only: serves an in-process PGlite database over the Postgres wire
 * protocol on 127.0.0.1, so the PRODUCTION Postgres path — `connect()` →
 * postgres-js pool → drizzle-orm/postgres-js → migrations → repository — can
 * run in Vitest without a Postgres server.
 *
 * PGlite is a single backend session, so the bridge gives one client
 * connection at a time ownership of it, from its first message until the
 * backend reports "idle" again (ReadyForQuery 'I'). Transactions from
 * different pooled connections therefore run one after another instead of
 * interleaving — the observable behaviour of a real server for the
 * repository, whose concurrent work on one post is serialised by row locks.
 */
import net from 'node:net';
import { PGlite } from '@electric-sql/pglite';

const SSL_REQUEST = 80877103;
const CANCEL_REQUEST = 80877102;
const GSSENC_REQUEST = 80877104;
const TERMINATE = 0x58; // 'X'
const READY_FOR_QUERY = 0x5a; // 'Z'

export interface PgliteServer {
  /** postgres:// URL for `connect()` / DATABASE_URL. */
  url: string;
  db: PGlite;
  close(): Promise<void>;
}

interface Job {
  socket: net.Socket;
  /** A protocol message, or 'release': roll back and free the session (socket closed). */
  message: Uint8Array | 'release';
}

/** Transaction status from the last ReadyForQuery in a backend reply, if any. */
function lastReadyStatus(reply: Buffer): string | null {
  let status: string | null = null;
  let offset = 0;
  while (offset + 5 <= reply.length) {
    const type = reply[offset];
    const length = reply.readInt32BE(offset + 1);
    if (type === READY_FOR_QUERY && offset + 5 < reply.length) {
      status = String.fromCharCode(reply[offset + 5] ?? 0);
    }
    offset += 1 + length;
  }
  return status;
}

export async function startPgliteServer(): Promise<PgliteServer> {
  const db = new PGlite();
  await db.waitReady;

  const sockets = new Set<net.Socket>();
  const queue: Job[] = [];
  let owner: net.Socket | null = null;
  let busy = false;

  const release = async (socket: net.Socket) => {
    if (owner !== socket) return;
    // A client that vanished mid-transaction must not leave the session open.
    try {
      await db.exec('ROLLBACK');
    } catch {
      // Not in a transaction: nothing to undo.
    }
    owner = null;
  };

  const pump = (): void => {
    if (busy) return;
    const index = queue.findIndex((job) => owner === null || job.socket === owner);
    if (index < 0) return;
    const [job] = queue.splice(index, 1);
    if (!job) return;
    busy = true;
    void (async () => {
      try {
        if (job.message === 'release') {
          await release(job.socket);
          return;
        }
        if (job.socket.destroyed) return;
        if (job.message[0] === TERMINATE) {
          await release(job.socket);
          job.socket.end();
          return;
        }
        owner = job.socket;
        const reply = Buffer.from(await db.execProtocolRaw(job.message));
        if (lastReadyStatus(reply) === 'I') owner = null;
        if (reply.length > 0 && !job.socket.destroyed) job.socket.write(reply);
      } catch {
        await release(job.socket);
        job.socket.destroy();
      } finally {
        busy = false;
        pump();
      }
    })();
  };

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setNoDelay(true); // many tiny replies: don't let Nagle + delayed ACK stall them
    let pending = Buffer.alloc(0);
    let started = false;
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      sockets.delete(socket);
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i]?.socket === socket) queue.splice(i, 1);
      }
      if (owner === socket) {
        queue.push({ socket, message: 'release' });
        pump();
      }
    });
    socket.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      for (;;) {
        if (!started) {
          // Startup-phase messages: int32 length (including itself) + payload.
          if (pending.length < 8) break;
          const length = pending.readInt32BE(0);
          if (pending.length < length) break;
          const code = pending.readInt32BE(4);
          const message = pending.subarray(0, length);
          pending = pending.subarray(length);
          if (code === SSL_REQUEST || code === GSSENC_REQUEST) {
            socket.write('N'); // no encryption; the client sends the real startup next
            continue;
          }
          if (code === CANCEL_REQUEST) {
            socket.end();
            return;
          }
          started = true;
          queue.push({ socket, message: new Uint8Array(message) });
          continue;
        }
        // Regular messages: 1-byte type + int32 length (including itself) + payload.
        if (pending.length < 5) break;
        const length = pending.readInt32BE(1);
        if (pending.length < length + 1) break;
        queue.push({ socket, message: new Uint8Array(pending.subarray(0, length + 1)) });
        pending = pending.subarray(length + 1);
      }
      pump();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PGlite server has no TCP port');

  return {
    url: `postgres://postgres@127.0.0.1:${address.port}/postgres`,
    db,
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    },
  };
}
