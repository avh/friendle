
let startingwords = [
    "JAUNT", "JUMPS", "FLOAT", "FRIED", "BOAST", "DAIRY", "ADIEU", "BAGEL", "BOAST",
    "FENDS", "EAVES", "BEAST", "WEIRD", "TIRED", "SPITS", "BLOND", "BORED", "TOWER",
    "SMART", "ROBOT", "BURNS", "STICK", "ALTER", "QUEER", "SKIPS", "UNDER", "STUMP",
    "LAYER", "YOGAS", "STORM", "WORST", "GORGE", "SMORE", "UNION", "FILER", "PROXY",
    "AQUAS", "ROUND", "SLURP", "ZEBRA", "WORST", "ANEAL", "JAMES", "THOSE", "TWATS",
];


var speed = params.get('speed') == null ? 2.0 : parseFloat(params.get('speed'));
var robotState = "picking";
let restartTime = [1000, 5000];
let pickTime = [1000, 4000];
let typeTime = [100, 2000];
let thinkTime = [1000, 5000];
let hesitateTime = [100, 1000];
var possibleWords = null;
var disallowedChars = null;
var requiredChars = null;
var possibleChars = null;
var timeout = null;

function resetPossibilities() {
    possibleWords = Array.from(words);
    disallowedChars = new Set();
    requiredChars = new Set();
    possibleChars = []
    for (var i = 0 ; i < 6 ; i++) {
        possibleChars.push(new Set());
    }
    for (var ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        for (var i = 0 ; i < 6 ; i++) {
            possibleChars[i].add(ch);
        }
    }
}

function randomInt(vals) {
    return Math.floor(vals[0] + Math.random()  * (vals[1] - vals[0] + 1));
}
function randomTimeout(tms, func) {
    if (timeout != null) {
        clearTimeout(timeout);
    }
    timeout = setTimeout(func, randomInt([tms[0]*speed, tms[1]*speed]));
}

function typeWord(word, i=0) {
    //console.log('robot: type', word, i);
    if (ours.col != i) {
        console.log("COL MISMATCH", ours.col, i, word);
    }
    if (i == 5) {
        keyPressed('enter');
        keyReleased();
        waitTurn(function() {
            pickNext();
        });
    } else {
        randomTimeout(typeTime, function() {
            if (i > 0 && randomInt([0, 10]) < 1) {
                keyPressed('backspace');
                keyReleased();
                typeWord(word, i-1);
            } else if (ours.col < 5 && randomInt([0, 10]) < 1) {
                let j = randomInt([0, 25]);
                let ch = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".substring(j,j+1);
                keyPressed(ch);
                keyReleased();
                randomTimeout(hesitateTime, function() {
                    keyPressed('backspace');
                    keyReleased();
                    typeWord(word, i);
                });
            } else {
                keyPressed(word[i]);
                keyReleased();
                typeWord(word, i+1);
            }
        });
    }
}

function waitTurn(cont) {
    if (ours.state == null && theirs.row == 0) {
        randomTimeout(thinkTime, function() {
            waitTurn(cont);
        });
    } else if (ours.state == null && ours.col < 6) {
        n = Math.max(1, ours.row - theirs.row + 1);
        randomTimeout([thinkTime[0]*n, thinkTime[1]*n], cont);
    } else {
        robotState = 'done';
    }
}

function pickNext() {
    if (ours.row == 6) {
        return;
    }
    // REMIND: Adjust legalChars and possibleChars

    for (var i = 0 ; i < 5 ; i++) {
        id = '#0' + (ours.row-1) + '' + i;
        ch = $(id).text();
        let c = $(id).attr('class');
        if (c == 'green') {
            possibleChars[i] = new Set([ch]);
            requiredChars.add(ch);
            disallowedChars.delete(ch);
        } else if (c == 'yellow') {
            requiredChars.add(ch);
            possibleChars[i].delete(ch);
            disallowedChars.delete(ch);
        } else if (c == 'gray') {
            possibleChars[i].delete(ch);
            if (!requiredChars.has(ch)) {
                disallowedChars.add(ch);
            }
        }
    }

    if (false) {
        console.log("requiredChars", requiredChars);
        console.log("disallowedChars", disallowedChars);
        for (var i = 0 ; i < 5 ; i++) {
            console.log("possibleChars", i, possibleChars[i]);
        }
    }

    var newlist = []
    var nearlist = []
    for (word of possibleWords) {
        var cool = true;
        for (var i = 0 ; i < 5 ; i++) {
            if (disallowedChars.has(word[i])) {
                cool = false;
            }
            if (!possibleChars[i].has(word[i])) {
                cool = false;
            }
        }
        if (cool) {
            nearlist.push(word);
        }
        for (var rch of requiredChars) {
            cool = cool && word.includes(rch);
        }
        if (cool) {
            newlist.push(word);
        }
    }
    possibleWords = newlist;
    console.log("robot: remain", possibleWords.length);

    for (var i = 0 ; i < randomInt([0,Math.min(10, possibleWords.length/2)]) ; i++) {
        possibleWords.push(nearlist[randomInt([0, nearlist.length-1])]);
    }

    if (possibleWords.length == 0) {
        possibleWords = Array.from(words);
    }
    typeWord(possibleWords[randomInt([0, possibleWords.length-1])]);
}

//
// patch updateGame
//
reallyUpdateGame = updateGame;
updateGame = function() {
    reallyUpdateGame();

    // end state
    if (ours.state != null && currentState == 'finish' && robotState != 'finish') {
        console.log("robot", ours.state);
        robotState = 'finish';
        randomTimeout(restartTime, function() {
            robotState = 'picking';
            roboWord = null;
            keyPressed('enter');
            keyReleased();
        });
    }

    // dont bother if we are not connected
    if (peer == null) {
        return;
    }

    // kick off a new session
    if (robotState == 'picking') {
        resetPossibilities();
        let robotWord = startingwords[randomInt([0, startingwords.length-1])];
        console.log('robot: picked', robotWord);
        robotState = 'typing';
        randomTimeout(pickTime, function() {
            typeWord(robotWord);
        });
    }
}
