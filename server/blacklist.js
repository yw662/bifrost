'use strict';
const net = require('net');

module.exports = ({ host }) => {
    // That is why you should deploy it with caution.
    if (
        // net.isIP(host) && (
        // net.isIP('127.1') is 0, so, you know...
        true && (
            host === '0.0.0.0' ||
            host.startsWith('127.') ||
            host.startsWith('10.') ||
            host.startsWith('192.168.')
        ) ||
        net.isIPv6(host) && (
            // while you know...
            // since ::1 can be ::0:1, ::0:0:1, and so on...
            // Let's just get rid of it for now...
            true ||
            host === '::1' ||
            host === '::0'
        ) ||
        host === 'localhost'
    ) {
        return true;
    }
    return false;
}