#! /usr/bin/env node
if (!process.argv[2]) {
    console.log(`Usage: ${process.argv[1]} 'config'`);
    console.log('config is in json and with the schema:');
    console.log('{');
    console.log('  http?: {');
    console.log('    port: number,');
    console.log('    host?: string');
    console.log('  },');
    console.log('  ws?: {');
    console.log('    port: number,');
    console.log('    host?: string');
    console.log('  } | boolean,');
    console.log('  setuid?: string')
    console.log('}');
    console.log(`example: ${process.argv[1]} \n\
     '{"http":{"port":2847,"host":"0.0.0.0"},"ws": true,"setuid":"nobody"}'`)
    process.exit(0);
}
// listen(process.argv[2], process.argv[3] || '0.0.0.0');
const config = JSON.parse(process.argv[2]);

if (config.http) {
    config.http.server = require('./server/httpServer.js');
    config.http.server.listen(config.http.port, config.http.host);
}
if (config.ws) {
    if (config.ws === true) {
        if (!config.http) {
            console.log('ws server is configuration ');
        }
        require('./server/wsServer.js')({ server: config.http.server });
    } else {
        require('./server/wsServer.js')({ port: config.ws.port, host: config.ws.host });
    }
}

if (config.setuid) {
    if (process.getuid() !== 0) {
        console.warn('About to setuid but we are not root.');
    }
    process.setuid(config.setuid);
}