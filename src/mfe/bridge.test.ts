import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MFEBridge } from './bridge';

/**
 * MFEBridge runs against window/postMessage, so these tests use jsdom.
 *
 * `isEmbedded` is decided in the constructor from `window.parent !== window`,
 * so we override `window.parent` *before* constructing the bridge.
 */

const ORIGIN = 'http://localhost:3000';
const realParent = window.parent;

function makeEmbedded(): ReturnType<typeof vi.fn> {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', { configurable: true, value: { postMessage } });
    return postMessage;
}

function makeStandalone(): void {
    Object.defineProperty(window, 'parent', { configurable: true, value: window });
}

function send(data: unknown, origin = ORIGIN): void {
    window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
    Object.defineProperty(window, 'parent', { configurable: true, value: realParent });
    vi.restoreAllMocks();
});

describe('standalone mode', () => {
    it('reports not embedded and emit is a no-op', () => {
        makeStandalone();
        const bridge = new MFEBridge({ mfeId: 'memory-cards' });
        bridge.init();

        expect(bridge.isEmbedded).toBe(false);
        // Should not throw and there's no parent to post to.
        expect(() => bridge.emit('win', { time: 1 })).not.toThrow();
    });
});

describe('embedded mode', () => {
    it('emit posts a well-formed envelope to the parent', () => {
        const post = makeEmbedded();
        const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
        bridge.init();

        bridge.emit('match', { value: 1, matched: 1, total: 4 });

        expect(post).toHaveBeenCalledTimes(1);
        const [message, targetOrigin] = post.mock.calls[0] as [Record<string, unknown>, string];
        expect(message).toMatchObject({
            source: 'memory-cards',
            type: 'match',
            payload: { value: 1, matched: 1, total: 4 },
        });
        expect(message.version).toBe(1);
        expect(targetOrigin).toBe(ORIGIN);
    });

    it('invokes a registered handler for a valid command', () => {
        makeEmbedded();
        const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
        bridge.init();
        const handler = vi.fn();
        bridge.on('pause', handler);

        send({ source: 'shell', version: 1, type: 'pause', payload: {} });

        expect(handler).toHaveBeenCalledTimes(1);
    });

    // Guards the union/runtime-Set desync that this project keeps hitting:
    // every command type in the protocol must also be in SHELL_COMMAND_TYPES,
    // or it is silently dropped here.
    it('accepts every known shell command type', () => {
        const commands = ['pause', 'resume', 'restart', 'mute', 'setVolume'] as const;
        for (const type of commands) {
            makeEmbedded();
            const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
            bridge.init();
            const handler = vi.fn();
            bridge.on(type, handler);

            send({ source: 'shell', version: 1, type, payload: {} });

            expect(handler, `command "${type}" should be accepted`).toHaveBeenCalledTimes(1);
            bridge.destroy();
        }
    });

    it('drops a message whose type is not a known command', () => {
        makeEmbedded();
        const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
        bridge.init();
        const handler = vi.fn();
        bridge.on('pause', handler);

        send({ source: 'shell', version: 1, type: 'frobnicate', payload: {} });

        expect(handler).not.toHaveBeenCalled();
    });

    it('ignores messages from a disallowed origin', () => {
        makeEmbedded();
        const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
        bridge.init();
        const handler = vi.fn();
        bridge.on('pause', handler);

        send({ source: 'shell', version: 1, type: 'pause', payload: {} }, 'http://evil.example');

        expect(handler).not.toHaveBeenCalled();
    });

    it('respects the target id when present', () => {
        makeEmbedded();
        const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
        bridge.init();
        const handler = vi.fn();
        bridge.on('pause', handler);

        send({ source: 'shell', target: 'other-mfe', version: 1, type: 'pause', payload: {} });
        expect(handler).not.toHaveBeenCalled();

        send({ source: 'shell', target: 'memory-cards', version: 1, type: 'pause', payload: {} });
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('stops invoking a handler after unsubscribe', () => {
        makeEmbedded();
        const bridge = new MFEBridge({ mfeId: 'memory-cards', allowedShellOrigins: [ORIGIN] });
        bridge.init();
        const handler = vi.fn();
        const off = bridge.on('pause', handler);

        off();
        send({ source: 'shell', version: 1, type: 'pause', payload: {} });

        expect(handler).not.toHaveBeenCalled();
    });
});
