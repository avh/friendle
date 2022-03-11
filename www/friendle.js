// cleanup
// robot
// shake animation

var version = "0.1";

var ours = {
    version: version,
    name: "You",
    state: null,
    words: ["     "],
    row: 0,
    col: 0,
    count: 0,
    wins: 0,
};
var theirs = {
    version: version,
    name: "Friend",
    state: null,
    words: ["     "],
    row: 0,
    col: 0,
    count: 0,
    wins: 0,
};

var server = null;
var peer = null;
var words = new Set()

let params = new URLSearchParams(window.location.search);
let game = params.get('game') == null ? 'anyone' : params.get('game');
console.log('game=', game);

var currentState = "unknown";
var last_key = null;
var last_key_class = "up";
var word = ""
//var sound = new Audio("dong.wav");

function setState(state, msg) {
    currentState = state;
    $('#msg').text(msg);
}

function connectServer() {
    setState('connecting', 'Connecting...');

    let protocol = location.protocol;
    var host = location.host;
    let i = host.indexOf(':');
    if (i > 0) {
        host = host.substring(0, i) + ":" + (parseInt(host.substring(i+1)) + 81);
    }
    try {
        server = io(protocol + "//" + host + "/");
        server.on('connect', () => {
            console.log("connect: " + server.id);
            server.emit('join', game);
        });
        server.on('welcome:', (version, waiting, active, connected) => {
            console.log('welcome', version, waiting, active, connected);
        });
        server.on('wait', (active) => {
            console.log("wait: " + game + ", " + active);
            msg = "Waiting for a friend to play..."
            if (active > 0) {
                msg += " (" + active + " active players)";
            }
            setState('waiting', msg);
        });
        server.on('peer', (id, conf) => {
            console.log("peer:", id, JSON.stringify(conf));
            peer = new SimplePeer(conf);
            peer.on('signal', msg => {
                //console.log('peer signal:', id, JSON.stringify(msg));
                server.emit('relay', id, msg)
            });
            peer.on('connect', () => {
                console.log('peer connect:', id);
                peer.send(JSON.stringify(ours));
                setState('playing', "Now try to guess their starting word...");
                $.cookie('friendle.count', ours.count + 1);
                //sound.play();
            });
            peer.on('data', data => {
                msg = JSON.parse(data);
                //console.log('peer data:', id, JSON.stringify(msg));
                theirs = msg
                updateGame();
            });
            peer.on('error', err => {
                console.log('peer error', err);
            });
            peer.on('close', () => {
                console.log('peer close', msg);
                peer = null;
                server.emit('unpeer');
                if (ours.state == null) {
                    ours.state = 'win';
                    theirs.state = 'forfeit';
                }
                updateGame();
            });
        });
        server.on('relay', (id,  msg) => {
	    //console.log("server relay", id, JSON.stringify(msg));
            if (peer != null) {
                peer.signal(msg);
            }
        });
        server.on('unpeer', (id) => {
            console.log("server, unpeer:", id);
            if (peer != null) {
                peer.destroy();
                peer = null;
            }
            if (ours.state == null) {
                ours.state = 'win';
                theirs.state = 'forfeit';
            }
            updateGame();
        });
        server.on('disconnect', () => {
            if (currentState != 'finish') {
                setState('nonetwork', "Server connection lost...");
            }
        });
    } catch {
        setState('nonetwork', "No Network...");
    }
}

function colorKey(key, color) {
    if (currentState == 'playing') {
        old = $('#' + key).attr('class');
        if ((old != 'green' && old != color) || (color == 'gray' && old == 'down')) {
            $('#' + key).attr('class', color)
        }
    }
}

function updateWord(player, r, word, goal=null, hide=false, default_style='gray') {
    var colors = Array(5).fill(default_style);

    if (goal !== null) {
        goal = goal.split('');
        for (var c = 0 ; c < word.length ; c++) {
            if (word[c] == goal[c]) {
                colors[c] = 'green';
                goal[c] = '_';
            } else {
                var i = goal.indexOf(word[c]);
                if (i >= 0 && goal[i] != word[i]) {
                    colors[c] = 'yellow';
                    goal[i] = '_';
                }
            }
        }
    }

    for (var c = 0 ; c < word.length ; c++) {
        var ch = hide && word[c] != ' ' ? '?' : word[c];
        $("#" + player + "" + r + "" + c).text(ch).attr('class', ch == ' ' ? "empty" : colors[c]);
        if (player == 0 && ch >= 'A' && ch <= 'Z' && colors[c] != 'typed') {
            colorKey(ch, colors[c]);
        }
    }
}

function updateGame() {
    if (ours.state == null && theirs.state != null) {
        if (theirs.state == 'forfeit') {
            ours.state = 'win';
        } else if (theirs.state == 'draw') {
            ours.state = 'draw';
        } else if (theirs.state == 'lose') {
            ours.state = 'win';
        } else if (theirs.state == 'win') {
            ours.state = 'lose';
        } else if (theirs.state == 'incompatible') {
            ours.state = 'incompatible';
        }
    }
    if (ours.state == null) {
        if (ours.row > 0 && theirs.row > 0 && ours.words[0] == theirs.words[0]) {
            ours.state = 'draw';
            theirs.state = 'draw';
        } else if (ours.row > 0 && ours.words[ours.row-1] == theirs.words[0]) {
            ours.state = 'win';
            theirs.state = 'lose';
        } else if (ours.row == 6 && theirs.row == 6) {
            ours.state = 'draw';
            theirs.state = 'draw';
    	}
    }

    if (ours.row == 0 || theirs.row == 0)  {
        updateWord(0, 0, ours.words[0], null, false, ours.row == 0 ? 'typed' : 'gray');
        updateWord(1, 0, theirs.words[0], null, true, 'typed');
    } else {
        if (currentState == 'playing') {
	    if (ours.row < 6) {
                $('#msg').text("Now guess " + theirs.name + "'s starting word...");
            } else {
                $('#msg').text("You have run out of space!");
            }
        }

        var ourgoal = theirs.words[0];
        updateWord(0, 0, ours.words[0], ourgoal);
        for (var r = 1 ; r < ours.row ; r++) {
            updateWord(0, r, ours.words[r], ourgoal);
        }
        updateWord(0, ours.row, ours.words[ours.row], null, false, 'typed');

        var theirgoal = ours.words[0];
        updateWord(1, 0, theirs.words[0], theirgoal, ours.state == null);
        for (var r = 1 ; r < theirs.row ; r++) {
            updateWord(1, r, theirs.words[r], theirgoal);
        }
        updateWord(1, theirs.row, theirs.words[theirs.row], null, false, 'typed');
    }

    $('#you').text(ours.name);
    if (currentState != 'naming' && ours.wins > 0 && ours.count > 0) {
        $('#youscore').text(Math.floor(100*ours.wins / ours.count) + "%");
    } else {
	$('#youscore').text("");
    }
    $('#friend').text(theirs.name);
    if (theirs.wins > 0 && theirs.count > 0) {
        $('#friendscore').text(Math.floor(100*theirs.wins / theirs.count) + "%");
    }

    if (currentState == 'playing' && ours.state != null) {
        finishGame();
    }
}

function showNotice(msg) {
    var oldMessage = $('#msg').text();
    var newMessage = msg;
    if (oldMessage != newMessage) {
        $('#msg').text(newMessage);
        setTimeout(function () {
            if ($('#msg').text() == newMessage) {
                $('#msg').text(oldMessage);
            }
        }, 1000);
    }
}

function keyPressed(key) {
    if (last_key != null && last_key != key) {
        keyReleased();
    }
    if (last_key == key) {
        return;
    }

    var action = "down";
    var wrong = false;
    //console.log("key pressed: '" + key + "'");

    if (currentState == 'naming') {
        if (key == 'enter') {
            if (ours.name.length > 3) {
                ours.name = ours.name.substring(0, ours.name.length-1);
                $('#you').text(ours.name);
                $.cookie('friendle.name', ours.name);
                setState('starting', "Enter your starting word...");
            } else {
                showNotice("Your name should be more than 3 letters...");
                action = "error";
            }
        } else if (key == 'backspace') {
            if (ours.name.length > 1) {
                ours.name = ours.name.substring(0, ours.name.length-2) + '_';
            } else {
                action = "error";
            }
        } else if (key < 'A' || key > 'Z') {
            action == "error";
        } else if (ours.name.length == 10) {
            action == "error";
            showNotice("Your name should be less than 10 letters...");
        } else {
            if (ours.name.length > 1) {
                key = key.toLowerCase();
            }
            ours.name = ours.name.substring(0, ours.name.length-1) + key + '_';
	    key = key.toUpperCase();
        }
    } else if (key == 'enter') {
        if (currentState == 'finish') {
            location.reload(ours.state == 'incompatible');
            return;
        }
        if (currentState == 'naming') {
            setState('starting', "Enter your starting word...");
            return;
        }
        if ((currentState != 'playing' && ours.row != 0) || ours.col < 5) {
            action = "error"
        } else if (!words.has(ours.words[ours.row])) {
            action = "error"
            showNotice("'" + ours.words[ours.row] + "' is not a valid word!");
	    wrong = true;
        } else {
            //console.log("word: '" + ours.words[ours.row] + "'")
            ours.row = ours.row + 1
            ours.col = 0
            ours.words.push("     ");
            if (currentState == 'starting') {
                connectServer();
            }
        }
    } else if (currentState == 'finish') {
        showNotice("Hit enter to continue...");
    } else if (key == 'backspace') {
        if (currentState == 'naming') {
            if  (ours.name.length > 0) {
                ours.name = ours.name.substring(0, ours.name.length-1);
            } else {
                action = "error";
            }
        } else if (ours.col == 0) {
            action = "error";
        } else {
            ours.col = ours.col - 1;
            ours.words[ours.row] = ours.words[ours.row].substring(0, ours.col) + "     ".substring(ours.col);
            $(".player #0" + ours.row + "" + ours.col).text("").attr("class", "empty");
        }
    } else if (ours.col >= 5 || ours.row > 5 || key < 'A' || key > 'Z' || (ours.row != 0 && server == null) || (ours.row > 0 && theirs.row == 0)) {
        action = "error";
    } else {
        var w = ours.words[ours.row];
        ours.words[ours.row] = w.substring(0, ours.col) + key + w.substring(ours.col+1);
        $(".player #0" + ours.row + "" + ours.col).text(key).attr("class", "typed")
        ours.col = ours.col + 1
    }
    last_key = key
    last_key_class = $("#" + key).attr("class")
    $("#" + key).attr("class", action + " pressed")

    updateGame();
    if (wrong) {
        for (var c = 0 ; c < 5 ; c++) {
	    $('#0' + ours.row + '' + c).addClass('wrong');
        }
    }

    if (server != null && peer != null && currentState == 'playing') {
        peer.send(JSON.stringify(ours));
    }
}

function keyReleased() {
    if (last_key != null) {
        $("#" + last_key).attr("class", last_key_class)
        last_key = null
    }
}

function finishGame() {
    var msg = "Game over...";
    if (ours.state == 'win') {
        if (theirs.state == 'forfeit') {
            msg = theirs.name + " forfeits, so you win!";
        } else {
            msg = "Congrats " + ours.name + ", you win!";
        }
        $.cookie('friendle.wins', (ours.wins + 1).toString());
    } else if (ours.state == 'draw') {
        $.cookie('friendle.wins', (ours.count - 1).toString());
        msg = "Argh, it's a draw.";
    } else if (ours.state == 'incompatible') {
        $.cookie('friendle.wins', (ours.count - 1).toString());
        msg = "Oops, their version is not compatible.";
    } else if (ours.state == 'forfeit') {
        msg = "You forfeit, so you lose, sorry!";
    } else if (ours.state == 'lose') {
        msg = theirs.name + " wins!";
    } else {
        msg = "try again!";
    }
    setState('finish', msg);

    if (server != null) {
        if (peer != null) {
            peer.send(JSON.stringify(ours));
            peer.destroy();
            peer = null;
        }
        setTimeout(function() {
            console.log("closing");
            server.close();
            server = null;
        }, 1000);
    }
}


async function loadFriendle() {
    setState("loading", "Loading...");
    $(".keyboard .row div").attr("class", "up")

    let response = await fetch('words.txt')
    if (response.status == 200) {
        text = await response.text()
        for (word of text.split("\n")) {
            if (word.length == 5) {
                words.add(word);
            }
        }
        console.log("words: " + words.size);

        updateGame();

        $("body").keydown(function(event){
            if (event.metaKey || event.ctrlKey) {
                return;
            }
            var key = "unknown"
            var ch = event.keyCode | event.which;
            if (ch == 13) {
                key = "enter";
            } else if (ch == 8) {
                key = "backspace";
            } else {
                key = String.fromCharCode(ch).toUpperCase();
                if (key < 'A' || key > 'Z') {
                    key = "unknown";
                }
            }
            keyPressed(key);
        });

        $("body").keyup(function(event){
            keyReleased();
        });

        if ('ontouchstart' in document.documentElement) {
            $('.keyboard .row div').on('touchstart', function(event) {
                keyPressed($(this).attr('id'));
            });
            $('.keyboard .row div').on('touchend', function(event) {
                keyReleased();
            });
        } else {
            $('.keyboard .row div').on('mousedown', function(event) {
                keyPressed($(this).attr('id'));
            });
            $('.keyboard .row div').on('mouseup', function(event) {
                keyReleased();
            });
        }

        $('#you').on('click', function() {
            if (currentState == 'starting') {
                ours.name += '_';
                $('#you').text(ours.name);
                setState("naming", "Enter your name...");
            }
        });
        $('.game td').attr('class', 'empty');

        count = $.cookie('friendle.count');
        if (count != undefined) {
            ours.count = parseInt(count)
            wins = $.cookie('friendle.wins');
            if (wins != undefined) {
                ours.wins = parseInt(wins)
            }
        }

        ours.name = $.cookie('friendle.name');
        if (ours.name === undefined) {
            ours.name = "_";
            setState("naming", "Enter your name...");
        } else {
            $('#you').text(ours.name);
            setState("starting", "Enter your starting word...");
        }
	updateGame();
    }
}
$(document).ready(loadFriendle);
