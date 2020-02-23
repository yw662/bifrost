
'use strict';
const ws = require('ws');
const { Tunnel } = require('./tunnels.js');

module.exports = options => {
    const server = new ws.Server(options);
    server.on('connection', (socket, req) => {
        try {
            const [, shouldBeTunnel, protocol, host, port] = req.url.split('/');
            if (shouldBeTunnel !== 'tunnels') {
                return socket.close();
            }
            const tun = new Tunnel({ protocol, host, port });
            try {
                socket.on('close', () => tun.close());
                tun.on('close', () => socket.close());
                tun.on('error', () => tun.close());
                socket.on('message', data => tun.write(data));
                tun.on('data', data => socket.send(data));
            } catch (e) {
                tun.close();
                throw e;
            }
        } catch (e) {
            socket.close();
            throw e;
        }
    });
    return server;
}