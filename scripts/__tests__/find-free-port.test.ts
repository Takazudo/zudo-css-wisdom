/**
 * Unit tests for `find-free-port.mjs` — the port auto-selection helper behind
 * the dev launcher.
 *
 * COPY-TEMPLATE: this test runs in a vitest-configured project. After copying,
 * adjust the relative import at the bottom to wherever you placed the helper
 * (helper at `scripts/lib/find-free-port.mjs`, test at `scripts/__tests__/`).
 *
 * Contract: `findFreePort(preferred)` returns `preferred` when it is free,
 * walks +1 per occupied port, and throws when `maxTries` is exhausted.
 *
 * Determinism: `node:net` is stubbed so port-freeness is driven by an
 * in-memory set instead of real OS sockets. Binding real ephemeral ports then
 * asserting on the exact number flakes under local port contention when the
 * just-freed port is stolen before the assertion. Stubbing removes the real
 * binds entirely, so the walk/exclude/throw contract is exercised
 * deterministically. (Real-socket probe behavior is covered in practice by
 * running the dev server itself.)
 *
 * The SUT consumes `connect` through `node:net`'s CJS-interop default export,
 * so the factory must override `connect` on BOTH the named export and
 * `default` — overriding only the named export leaves the SUT reading the real
 * socket. The fake `connect` is defined inside the (hoisted) factory; only the
 * `vi.hoisted` `busy` set may be referenced from it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Loopback families probed by the SUT's `isPortFree`, in `host:port` key form.
const V4 = '127.0.0.1';
const V6 = '::1';

// Sets of `host:port` keys, controlled per-test. Hoisted so the (hoisted)
// vi.mock factory closes over the same instances the tests mutate.
//   busy      → connect succeeds (a real listener answers)
//   timeouts  → connect hangs past the deadline (WSL2 closed-port behavior)
const { busy, timeouts } = vi.hoisted(() => ({
  busy: new Set<string>(),
  timeouts: new Set<string>(),
}));

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { EventEmitter } = await import('node:events');

  // Deterministic stand-in for a TCP connect probe: an occupied port accepts
  // the connection (`connect`), a "hanging" port emits `timeout`, and any other
  // port refuses (`error`).
  const connect = ({ host, port }: { host: string; port: number }) => {
    const socket = new EventEmitter() as EventEmitter & {
      unref: () => void;
      setTimeout: (ms: number) => void;
      destroy: () => void;
    };
    socket.unref = () => {};
    socket.setTimeout = () => {};
    socket.destroy = () => {};
    // Emit on a microtask so `canConnect` has attached its listeners first.
    queueMicrotask(() => {
      const key = `${host}:${port}`;
      if (timeouts.has(key)) socket.emit('timeout');
      else if (busy.has(key)) socket.emit('connect');
      else socket.emit('error', new Error('ECONNREFUSED'));
    });
    return socket;
  };

  const actualDefault = (actual.default ?? {}) as Record<string, unknown>;
  return { ...actual, connect, default: { ...actualDefault, connect } };
});

// @ts-expect-error - .mjs source has no TypeScript declarations and the project does not generate them; import shape is exercised at runtime.
import { findFreePort, isPortFree } from '../lib/find-free-port.mjs';

/** Mark a port occupied on the given loopback families (both by default). */
function occupy(port: number, families: Array<'v4' | 'v6'> = ['v4', 'v6']): void {
  for (const family of families) busy.add(`${family === 'v4' ? V4 : V6}:${port}`);
}

/** Mark a port as hanging (connect times out) on the given families. */
function timeoutOn(port: number, families: Array<'v4' | 'v6'> = ['v4', 'v6']): void {
  for (const family of families) timeouts.add(`${family === 'v4' ? V4 : V6}:${port}`);
}

describe('find-free-port', () => {
  beforeEach(() => {
    busy.clear();
    timeouts.clear();
  });

  it('isPortFree returns false for an occupied port and true for a free one', async () => {
    occupy(5000);

    expect(await isPortFree(5000)).toBe(false);
    expect(await isPortFree(6000)).toBe(true);
  });

  it('isPortFree treats a port busy on only one loopback family as occupied', async () => {
    // The SUT ANDs both families (`!v4Busy && !v6Busy`) precisely because a
    // macOS wildcard test-bind can look free on one family while in use — a
    // single-family hit must still report "busy".
    occupy(5000, ['v4']);

    expect(await isPortFree(5000)).toBe(false);
  });

  it('returns the preferred port when it is free', async () => {
    expect(await findFreePort(5000)).toBe(5000);
  });

  it('walks +1 when the preferred port is occupied', async () => {
    occupy(5000);

    expect(await findFreePort(5000)).toBe(5001);
  });

  it('walks past a contiguous run of occupied ports', async () => {
    occupy(5000);
    occupy(5001);
    occupy(5002);

    expect(await findFreePort(5000)).toBe(5003);
  });

  it('treats a connect timeout as free (WSL2: closed 127.0.0.1 hangs instead of refusing)', async () => {
    // The exact WSL2 failure mode: IPv4 connect to a closed port hangs to the
    // deadline while IPv6 refuses. A timeout must count as "not connected" =
    // free, or every probe would report busy and resolution would never finish.
    timeoutOn(5000, ['v4']); // v6 refuses (not in any set)

    expect(await isPortFree(5000)).toBe(true);
    expect(await findFreePort(5000)).toBe(5000);
  });

  it('still reports busy when a real listener answers on v4 even if v6 times out', async () => {
    // Only an ACTUAL connection marks busy — a timeout on the other family must
    // not flip a genuinely-occupied port to "free" (protects the shift-instead-
    // of-kill behavior for an existing dev server).
    occupy(5000, ['v4']);
    timeoutOn(5000, ['v6']);

    expect(await isPortFree(5000)).toBe(false);
  });

  it('skips excluded ports even when they are free', async () => {
    // 5000 is free but promised to another process this run — the next
    // candidate must be returned instead.
    expect(await findFreePort(5000, { exclude: [5000] })).toBe(5001);
  });

  it('throws when no free port exists within maxTries', async () => {
    occupy(5000);
    occupy(5001);

    await expect(findFreePort(5000, { maxTries: 2 })).rejects.toThrow(/No free port found/);
  });
});
