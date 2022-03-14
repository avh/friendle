// Simple game server, Arthur van Hoff, (c)2022 Artfahrt Inc.

let version = "0.2";

let conf1 = {
    trickle: false,
    config: {
        iceServers: [
	    {urls: 'stun:stun.l.google.com:19302'},
	    {urls: 'stun:stun1.l.google.com:19302'},
	    {urls: 'stun:stun.ekiga.net'},
	    {urls: 'stun:stun.voipstunt.com'},
	    {urls: 'turn:games.artfahrt.com', username:'friendle', credential:'turnmeon'},
        ],
    },
}
let conf2 = Object.assign({
    initiator:true
}, conf1);

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
        this.init(httpServer);
    }

    init(httpServer) {
        const server = require('socket.io')(httpServer, {
            cors: {
                origin: '*',
            },
	    pingInterval: 1000,
            pingTimeout: 2000,
        });

        server.sockets.on('connection', (socket) => {
            console.log("got connection");

            this._handleConnect(server, socket);
            socket.on('join', (game) => this._handleJoin(server, socket, game));
            socket.on('relay', (target, msg) => this._handleRelay(server, socket, target, msg));
            socket.on('unpeer', () => this._unpeer(server, socket));
            socket.on('disconnect', () => this._handleDisconnect(server, socket));
        });
    }

    _handleConnect(server, socket) {
	//console.log("connect: " + socket.id);
        socket.emit('welcome', version, this.waiting.count(), this.peers.count(), server.sockets.sockets.size);
    }

    _handleJoin(server, socket, game) {
        console.log("join: " + socket.id + ", " + game);
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
                socket.emit('peer', waiter, conf1);
                server.sockets.sockets.get(waiter).emit('peer', socket.id, conf2);
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

    _handleRelay(server, socket, target, msg) {
        if (this.peers.has(socket.id) && server.sockets.sockets.has(target)) {
	    //console.log("relay:", socket.id, target, JSON.stringify(msg));
            server.sockets.sockets.get(target).emit('relay', socket.id, msg);
        } else {
	    //console.log("failed to relay:", socket.id, target, JSON.stringify(msg))
            socket.emit('unpeer', target);
            this.peers.del(socket.id);
        }
    }

    _unpeer(server, socket) {
        if (this.peers.has(socket.id)) {
            var other = this.peers.del(socket.id);
            //console.log("unpeer " + other + " from " + socket.id);
            server.sockets.sockets.get(other).emit('unpeer', socket.id);
        }
    }

    _handleDisconnect(server, socket) {
	//console.log("disconnect: " + socket.id);
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
