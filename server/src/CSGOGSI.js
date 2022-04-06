const http = require("http");
const EventEmitter = require("events");

class CSGOGSI extends EventEmitter {
    constructor({ authToken = [] }) {
        super();
        let tokens = authToken;
        if (!Array.isArray(tokens)) {
            tokens = [];
        }

        this.authToken = tokens;
        this.app = http.createServer((req, res) => {
            if (req.method !== "POST") {
                res.writeHead(404, { "Content-Type": "text/plain" });
                return res.end("404 Not Found");
            }

            this.body = "";
        });

        this.bombTime = 40;
        this.isBombPlanted = false;
        this.bombTimer = null;
    }

    processJson(json) {
        try {
            let data = JSON.parse(json);
            if (!this.isAuthenticated(data)) return;
            this.emit("all", data);
            this.process(data);
        } catch (error) { }
    }

    isAuthenticated(data) {
        return this.authToken.length < 1 || (data["auth"]["token"] && this.authToken.length > 0 && this.authToken.includes(data["auth"]["token"]))
    }

    process(data) {
        //console.log(data)
        //console.log("bruh22")
        //console.log(data["player"])
        //console.log(data["provider"])
        console.log(data["allplayers_state"]);
        for (var i = 0; i < data["allplayers_match_stats"].length; i++) {
            //console.log(data[allplayers_match_stats][i])
        }
        if (data["map"]) {
            this.emit("gameMap", data["map"]["name"]);
            this.emit("gamePhase", data["map"]["phase"]); //warmup etc
            this.emit("gameRounds", data["map"]["round"]);
            this.emit("gameCTscore", data["map"]["team_ct"]);
            this.emit("gameTscore", data["map"]["team_t"]);
        }

        if (data["round_wins"]) {
            this.emit("roundWins", data["round_wins"]);
        }

        if (data["player"]) {
            this.emit("player", data["player"]);
        }

        if (data["round"]) {
            this.emit("roundPhase", data["round"]["phase"]);
            switch (data["round"]["phase"]) {
                case "live":
                    break;
                case "freezetime":
                    break;
                case "over":
                    if (this.isBombPlanted) {
                        this.isBombPlanted = false;
                        this.stopC4Countdown();
                    }

                    this.emit("roundWinTeam", data["round"]["win_team"]);
                    break;
            }

            if (data["round"]["bomb"]) {
                this.emit("bombState", data["round"]["bomb"]);
                switch (data["round"]["bomb"]) {
                    case "planted":
                        if (!this.isBombPlanted) {
                            this.isBombPlanted = true;
                            let timeleft = this.bombTime - (new Date().getTime() / 1000 - data["provider"]["timestamp"]);
                            this.emit("bombTimeStart", timeleft);
                            this.startC4Countdown(timeleft);
                        }

                        break;
                    case "defused":
                    case "exploded":
                        this.isBombPlanted = false;
                        this.stopC4Countdown();
                        break;
                }
            }

        }
    }

    stopC4Countdown() {
        if (this.bombTimer) clearInterval(this.bombTimer);
    }

    startC4Countdown(time) {
        this.bombTimer = setInterval(() => {
            time = time - 1;
            if (time <= 0) {
                this.stopC4Countdown()
                this.isBombPlanted = false;
                return this.emit("bombExploded");
            }

            this.emit("bombTimeLeft", time);
        }, 1000);
    }
}

module.exports = CSGOGSI;
