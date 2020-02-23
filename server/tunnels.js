'use strict';
const crypto = require('crypto');
const tcp = require('net');
const udp = require('dgram');
const EventEmitter = require('events');

const blacklist = require('./blacklist.js');

class TunnelBlackListException {
    constructor() {
        this.name = 'TunnelBlackListException';
        this.message = 'The tunnel request is blacklisted';
    }
}

class TunnelUnknownProtocolException {
    constructor(protocol) {
        this.name = 'TunnelUnknownProtocolException';
        this.message = `Tunnel cannot handle requested protocol ${protocol}`;
    }
}

class TunnelStorageOverloadException {
    constructor() {
        this.name = 'TunnelStorageOverloadException';
        this.message = 'Tunnel storage not willing to accept more tunnels';
    }
}

class Tunnel {
    constructor(options) {
        if (blacklist(options)) throw new TunnelBlackListException();

        Object.defineProperty(this, 'protocol', {
            value: options.protocol,
            writable: false
        });
        Object.defineProperty(this, 'emitter', {
            value: new EventEmitter(),
            writable: false
        })
        if (this.protocol === 'TCP') {
            Object.defineProperty(this, 'socket', {
                value: tcp.connect(options.port, options.host),
                writable: false
            });
            this.socket.on('data', (...args) => this.emitter.emit('data', ...args));
        } else if (this.protocol === 'UDP') {
            Object.defineProperty(this, 'socket', {
                value: tcp.isIPv6(options.host) ?
                    udp.createSocket('udp6') :
                    udp.createSocket('udp4'),
                writable: false
            });
            this.socket.connect(options.port, options.host);
            this.socket.on('message', (...args) => this.emitter.emit('data', ...args));
        } else {
            throw new TunnelUnknownProtocolException(this.protocol);
        }
        this.socket.on('error', (...args) => this.emitter.emit('error', ...args));
        this.socket.on('connect', (...args) => this.emitter.emit('connect', ...args));
        this.socket.on('close', (...args) => this.emitter.emit('close', ...args));
    }
    get pending() {
        if (this.protocol === 'TCP') return this.socket.pending;
        if (this.protocol === 'UDP') {
            try {
                this.socket.remoteAddress();
                return false;
            } catch (e) {
                return true;
            }
        }
        throw new TunnelUnknownProtocolException(this.protocol);
    }
    close() {
        if (this.protocol === 'TCP') return this.socket.destroy();
        if (this.protocol === 'UDP') return this.socket.close();
        throw new TunnelUnknownProtocolException(this.protocol);
    }
    write(data) {
        if (this.protocol === 'TCP') return this.socket.write(data);
        if (this.protocol === 'UDP') return this.socket.send(data);
        throw new TunnelUnknownProtocolException(this.protocol);
    }
    on(...args) { this.emitter.on(...args) }
    once(...args) { this.emitter.once(...args) }
    off(...args) { this.emitter.off(...args) }
    removeListener(...args) { this.emitter.removeListener(...args) }
}

class TunnelStorage {
    constructor() { }
    async insert(options) { // no need for this async, just a reminder to await.
        let key = crypto.randomBytes(32).toString('hex');
        for (let i = 0; this[key] && i < 4; i++) {
            key = crypto.randomBytes(32).toString('hex');
        }
        if (this[key]) throw new TunnelStorageOverloadException();

        const tunnel = new Tunnel(options);
        this[key] = {
            token: crypto.randomBytes(32).toString('hex'),
            tunnel,
            pending: true,
            buffer: [],
            closed: false
        };
        tunnel.once('close', () => {
            if (this[key] && this[key].tunnel === tunnel) {
                if (this[key].buffer.length === 0) delete this[key];
                else {
                    this[key].closed = true;
                    setTimeout(() => {
                        if (this[key] && this[key].tunnel === tunnel) {
                            delete this[key];
                        }
                    }, 100);
                }
            }
        });
        tunnel.on('data', data => this[key].buffer.push(data));

        let resolve;
        let reject;
        let connected;
        const onerror = () => {
            if (reject) reject();
            else connected = false;
        };
        tunnel.once('error', onerror);
        tunnel.once('connect', () => {
            this[key].pending = false;
            tunnel.removeListener('error', onerror);
            if (resolve) resolve(key);
            else connected = true;
        });

        return new Promise((res, rej) => {
            if (connected === undefined) {
                resolve = res;
                reject = rej;
            } else {
                if (connected) resolve(key);
                else reject();
            }
        });
    }
    delete(key) {
        if (!this[key]) return;
        this[key].tunnel.close();
        delete this[key];
    }
    token(key) { return this[key] && this[key].token }
    verify(key, token) { return this[key] && this[key].token === token }
    write(key, data) { return this[key] && this[key].tunnel.write(data) }
    read(key) {
        if (!this[key]) return;
        const r = this[key].buffer;
        this[key].buffer = [];
        if (this[key].closed) delete this[key];
        return r;
    }
    pending(key) { return !this[key] || this[key].pending }
    empty(key) { return !this[key] || this[key].buffer.length === 0 }
    closed(key) { return !this[key] || this[key].closed }
    on(key, ...args) { this[key] && this[key].tunnel.on(...args) }
    once(key, ...args) { this[key] && this[key].tunnel.once(...args) }
    off(key, ...args) { this[key] && this[key].tunnel.off(...args) }
    removeListener(key, ...args) { this[key] && this[key].tunnel.removeListener(...args) }
}

module.exports = {
    Tunnel,
    TunnelStorage,
    TunnelBlackListException,
    TunnelUnknownProtocolException,
    TunnelStorageOverloadException
};