'use strict';
const { TunnelStorage, TunnelStorageOverloadException } = require('./tunnels.js');

const tunnels = new TunnelStorage();

const html = () => '<!DOCTYPE html><html><head><title>Bifrost</title></head><body>Here is a rainbow bridge for frontend web apps.</body></html>';


const rootRequest = (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow_Headers', 'Content-Type');
    if (req.method !== 'POST') {
        return res.end();
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
        let options;
        try { options = JSON.parse(body); }
        catch (e) {
            res.writeHead(400);
            return res.end();
        }
        try {
            const key = await tunnels.insert(options);
            const token = tunnels.token(key);
            if (!key || !token) {
                res.writeHead(500);
                return res.end();
            }
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                location: `/tunnels/${key}`,
                token: token
            }))
            return;
        } catch (e) {
            if (e instanceof TunnelStorageOverloadException) {
                res.writeHead(503);
            } else {
                res.writeHead(504);
            }
            return res.end();
        }
    });
}

const tunnelRequest = (key, isEvent, req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow_Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.end();
    } else if (req.method === 'DELETE') {
        tunnels.delete(key);
        res.writeHead(204);
        return res.end();
    } else if (req.method === 'GET') {
        if (isEvent) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no'
            });
            if (!tunnels.empty(key)) res.write('data: data\n\n');
            if (tunnels.closed(key)) return res.end('event: close\ndata: close\n\n');
            const onData = () => res.write('data: data\n\n');
            const onClose = () => res.end('event: close\ndata: close\n\n');
            tunnels.on(key, 'data', onData);
            tunnels.on(key, 'close', onClose);
            const ping = setInterval(() => res.write('event: ping\ndata: ping\n\n'), 1000);
            res.on('close', () => {
                tunnels.removeListener(key, 'data', onData);
                tunnels.removeListener(key, 'close', onClose);
                clearInterval(ping);
            });
        } else {
            res.writeHead(200, {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            });
            const buffers = tunnels.read(key);
            for (const buf of buffers) { res.write(buf) }
            res.end();
        }
    } else if (req.method === 'POST') {
        req.on('data', data => tunnels.write(key, data));
        req.on('end', () => {
            res.writeHead(204);
            res.end();
        })
    }
}

module.exports = require('http').createServer((req, res) => {
    if (req.url.startsWith('/tunnels')) {
        if (req.url.length === 8) {
            return rootRequest(req, res);
        } else if (req.url[8] === '/') {
            const [path, token] = req.url.slice(9).split('?token=');
            const [key, isEvent] = path.split('/');
            if (tunnels.pending(key) || !tunnels.verify(key, token)) {
                res.writeHead(403);
                return res.end();
            }
            return tunnelRequest(key, isEvent, req, res);
        }
    }
    return res.end(html());
});