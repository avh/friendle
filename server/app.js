// based on https://github.com/lisajamhoury/simple-peer-server
class TwoWayMap extends Map {
    set(key, val) {
        super.set(key, val);
        super.set(val, key);
    }
    del(key) {
        var val = super.get(key);
        super.delete(key);
        super.delete(val);
        return val;
    }
    count() {
        return this.size/2;
    }
}

class SimpleGameServer {
    constructor(httpServer) {
        this.waiting = new TwoWayMap();
        this.peers = new TwoWayMap();
        this.debug = true;
        this.init(httpServer);
    }

    init(httpServer) {
        const server = require('socket.io')(httpServer, {
            cors: {
                origin: '*',
            },
        });

        server.sockets.on('connection', (socket) => {
            this._handleConnect(server, socket);
            socket.on('join', (game) => this._handleJoin(server, socket, game));
            socket.on('signal', (msg) => this._handleSignal(server, socket, msg));
            socket.on('unpeer', () => this._unpeer(server, socket));
            socket.on('disconnect', () => this._handleDisconnect(server, socket));
        });
    }

    _handleConnect(server, socket) {
        if (this.debug) {
            console.log("connect: " + socket.id);
        }
    }

    _handleJoin(server, socket, game) {
        if (this.debug) {
            console.log("join: " + socket.id + ", " + game);
        }
        this._unpeer(server, socket);
        if (this.waiting.has(game)) {
            var waiter = this.waiting.get(game);
            if (socket.id == waiter) {
                console.log("still wait for " + game);
                socket.emit('wait', server.sockets.sockets.size - 1);
            } else if (server.sockets.sockets.has(waiter)) {
                console.log("peer " + game + ", " + waiter);
                this.waiting.del(game);
                this.peers.set(socket.id, waiter);
                socket.emit('peer', waiter);
                server.sockets.sockets.get(waiter).emit('peer', socket.id);
            } else {
                console.log("wait for " + game);
                this.waiting.set(game, socket.id);
                socket.emit('wait', server.sockets.sockets.size - 1);
            }
        } else {
            console.log("wait for " + game);
            this.waiting.set(game, socket.id);
            socket.emit('wait', server.sockets.sockets.size - 1);
        }
    }

    _handleSignal(server, socket, msg) {
        if (this.peers.has(socket.id) && server.sockets.sockets.has(msg.target)) {
            console.log("signal:", JSON. stringify(msg));
            server.sockets.sockets.get(msg.target).emit('signal', msg);
        } else {
            console.log("failed to signal: " + msg)
            socket.emit('unpeer', msg.target);
            this.peers.del(socket.id);
        }
    }

    _unpeer(server, socket) {
        if (this.peers.has(socket.id)) {
            var other = this.peers.del(socket.id);
            console.log("unpeer " + other + " from " + socket.id);
            server.sockets.sockets.get(other).emit('unpeer', socket.id);
        }
    }

    _handleDisconnect(server, socket) {
        if (this.debug) {
            console.log("disconnect: " + socket.id);
        }
        this._unpeer(server, socket);
        this.waiting.del(socket.id);
    }
}

const http = require('http');
const server = http.createServer();
const gameServer = new SimpleGameServer(server);

port = 8081;
console.log("listening on " + port);
server.listen(port);
