/**** Node.js libraries *****/
const path = require('path');

/**** External libraries ****/
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const cors = require('cors');

/**** Configuration ****/
const app = express();

const EventEmitter = require("events");

class CSGOGSI extends EventEmitter {
  constructor({ authToken = [] }) {
    super();
    let tokens = authToken;
    if (!Array.isArray(tokens)) {
      tokens = [];
    }

    this.authToken = tokens;
    this.body = "";
    this.data = null;

    this.bombTime = 40;
    this.isBombPlanted = false;
    this.bombTimer = null;
    this.gameMap = null;
    this.gameRounds = null;
    this.gameCTscore = null;
    this.gameTscore = null;
    this.roundWins = null;
    this.player = null;
    this.roundPhase = null;
    this.roundWinTeam = null;
  }

  processJson(json) {
    try {
      let data = json;
      this.isAuthenticated(data);
      if (!this.isAuthenticated(data)) return;
      this.emit("all", data);
      this.process(data);
    } catch (error) {
      console.log(error);
    }
  }

  isAuthenticated(data) {
    return this.authToken.length < 1 || (data["auth"]["token"] && this.authToken.length > 0 && this.authToken.includes(data["auth"]["token"]))
  }

  process(data) {
    console.log("WOOAH")
    this.data = data;
    console.log(this.data)
    //console.log("bruh22")
    //console.log(data["player"])
    //console.log(data["provider"])
    //console.log(data["player_match_stats"]);

    if (data["map"]) {
      this.gameMap = data["map"]["name"];
      this.gamePhase = data["map"]["phase"]; //warmup etc
      this.gameRounds = data["map"]["round"];
      this.gameCTscore = data["map"]["team_ct"];
      this.gameTscore = data["map"]["team_t"];
    }

    if (data["round_wins"]) {
      this.emit("roundWins", data["round_wins"]);
    }

    if (data["player"]) {
      this.player = data["player"];
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

let gsi = new CSGOGSI({
  authToken: ["Q79v5tcxVQ8u", "Team2Token", "Team2SubToken"] // this must match the cfg auth token
});


function createServer() {
  const routes = require("./routes")();

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(morgan('combined'));
  app.use(cors());
  app.use(express.static(path.resolve('..', 'client', 'build')));

  /**** Add routes ****/
  //app.use("/api", routes);

  // app.on("data", data => {
  //   gsi.body += data;
  //   console.log("data: " + data);
  // });

  // app.on("end", () => {
  //   console.log("end")
  //   gsi.processJson(gsi.body);
  // });

  app.post('/', (req, res) => {
    gsi.body = req.body;
    gsi.processJson(req.body);

    res.json({ data: gsi.data });
  });
  // "Redirect" all non-API GET requests to React's entry point (index.html)
  app.get('*', (req, res) => {

    //res.json(gsi.data);
    res.json({ data: gsi.data });
    //res.sendFile(path.resolve('..', 'client', 'build', 'index.html'));
  }
  );

  return app;
}

module.exports = createServer;