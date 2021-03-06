# Bifrost: A bridge bringing web apps raw socket
* The word `raw socket` is from [this web API](https://www.w3.org/TR/tcp-udp-sockets/).
    * It is not really raw. It is TCP or UDP sockets.

## How it works

### via Web socket
* Use `/tunnels/<protocol>/<host>/<port>` to establish a new tunnel.
    * exp, `/tunnels/TCP/example.com/443`.
    * All data will be passed as is.

    ```js
    const ws = new WebSocket('wss://<bifrost_server>/tunnels/TCP/example.com/80');
    ws.onmessage = event=>event.data.text().then(t=>console.log(t));
    ws.send('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');
    ```

### via HTTP
* Although `CONNECT` is the best method for tunnels, it is not supported by XHR and fetch.
* Instead, we use `POST` to create a tunnel. A tunnel creating request might look like this:
```
POST /tunnels HTTP/1.1
Content-Type: application/json

{"protocol":"TCP","host":"example.com","port":3306}

HTTP/1.1 201 Created
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow_Headers: Content-Type
Content-Type: application/json

{"location":"/tunnels/sth-like-an-id","token":"sth-like-a-token"}
```
* After a tunnel is created:
    * Client side can listen to the event stream at `/tunnels/sth-like-an-id/events`.
        * A `data` event is emit once some new data is received.
        * A `close` event is emit once the tunnel is closed.
        * This is not that necessary indeed.
        * The token should be passed through query string, `?token=sth-like-a-token`.
            * Although the token might be seen somewhere in that case, using cookie with `Access-Control-Allow-Credentials` is even worse.
    * Client side can read the tunnel through `GET` request, this time as `/tunnels/sth-like-an-id`.
        * Again, pass the token through query string.
    * Client side can write to the tunnel through `POST` request.
    * Client side can close the tunnel through `DELETE` request.

    ```js
    tunReq = new XMLHttpRequest();
    tunReq.open('POST', 'https://bifrost.yw662.dynu.net/tunnels');
    tunReq.onreadystatechange = function () {
        if (tunReq.readyState !== 4) return;
        tun = JSON.parse(tunReq.response);
        console.log(tun);
        ev = new EventSource('https://bifrost.yw662.dynu.net' + tun.location + '/events?token=' + tun.token);
        ev.onmessage = function(e) {
            recvReq = new XMLHttpRequest();
            recvReq.open('GET', 'https://bifrost.yw662.dynu.net' + tun.location + '?token=' + tun.token);
            recvReq.onreadystatechange = function() {
                if(recvReq.readyState !== 4) return;
                console.log(recvReq.response);
            }
            recvReq.send();
        }
        sendReq = new XMLHttpRequest();
        sendReq.open('POST', 'https://bifrost.yw662.dynu.net' + tun.location + '?token=' + tun.token);
        sendReq.send('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');
    }
    tunReq.send(JSON.stringify({ protocol: "TCP", host: "example.com", port: 80 }));
    ```

## Use cases
* As a frontend developer, you might need a backend just to relay requests to somewhere else, you can now use some public nodes instead.
    * You can then put it on github pages and let your own server have some rest.

## Note
* Requests to private addresses, or `127.0/8`, `10.0/8` and `192.168.0/16`, is filtered.
* The proxy itself is anyway a MITM and **should not be trusted**.
    * That is to say, the underlying traffic needs to be **end-to-end** secured.
* This should not be a solution for normal client-server communication.
    * Instead, it is designed to help frontend-only web apps to access somewhere else.
* For the HTTP bridge, why not just one `POST` request ?
    * It needs `TE: chunked`, which is tricky to work with in frontend.
* Nginx may require additional configuration for web socket or SSE to work.
    * For ws, these lines are required:
        * `proxy_set_header Upgrade $http_upgrade;`
        * `proxy_set_header Connection "upgrade";`
    * For SSE, several of these lines might be useful, but not necessarily required:
        * `proxy_set_header Connection "";`
        * `chunked_transfer_encoding off;`
        * `proxy_buffering off;`

## Public node list
* Nodes run by us 
    * https://bifrost.yw662.dynu.net/, with HTTP/2 support
    * wss://bifrost.yw662.dynu.net/
* Node list maintained by us
    * https://bifrost.yw662.dynu.net/nodes.lst