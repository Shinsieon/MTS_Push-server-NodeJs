"use strict";

const Net = require("net");
const FService = require("./routes/service.js");
const FTrace = include("JTrace.js");
var increase_length = 0,
  standard_length = 0;

/*        웹서버용                 */
const NodeExpress = require("express");
const NodeApp = NodeExpress();
var bodyParser = require("body-parser");
const mariadb = require("mariadb");
const wsModule = require("ws");
var http_server = null;
var webSocketServer = null;
var httpWss = null;

function shutdown_http() {
  FTrace.log(__filename, "Received kill signal, shutting down gracefully");
  if (http_server != null) {
    http_server.close(function (err) {
      FTrace.log(__filename, "Closed out remaining connections. ", err);
      process.exit(1);
    });

    setTimeout(function () {
      FTrace.log(
        __filename,
        "Could not close connections in time, forcefully shutting down."
      );
      process.exit(1);
    }, 30 * 1000);

    http_server = null;
  } else {
    FTrace.log(__filename, "force shutdown. ");
    process.exit(1);
  }
}
process.on("SIGTERM", shutdown_http);
process.on("SIGINT", shutdown_http);
// 실행
module.exports.runServer = function (host, port) {
  JConfig.host = host;
  JConfig.port = port;
  http_execute(fep_execute);
};

// 웹서버 실행
module.exports.runWebServer = function () {
  http_execute();
};

const pool = mariadb.createPool({
  host: JConfig.db_host,
  port: 3306,
  user: JConfig.db_user,
  password: JConfig.db_password,
  database: JConfig.db_database,
  connectionLimit: 5,
});
async function sendQuery(query, callback) {
  let conn;
  try {
    conn = await fetchConn();
    var rows = await get_contacts(conn, query);
    if (callback) callback(rows);
  } catch (err) {
    console.log(err);
  } finally {
    if (conn) conn.end();
  }
}
async function fetchConn() {
  let conn = await pool.getConnection();
  return conn;
}
async function get_contacts(conn, query) {
  return await conn.query(query);
}

module.exports.sendQuery = sendQuery;

function http_execute(runFepServerFunc) {
  try {
    NodeApp.use(NodeExpress.static(__dirname + "/bin"));
    NodeApp.set("view engine", "ejs");
    NodeApp.engine("html", require("ejs").renderFile);
    NodeApp.use(bodyParser.json());
    NodeApp.use(bodyParser.urlencoded({ extended: true }));
    var indexRouter = require("./routes/index"); // 웹 주소 치고 나오는

    NodeApp.use(indexRouter);

    // catch 404 and forward to error handler
    NodeApp.use((req, res, next) => {
      res.status(404).send("Not Found");
    });

    // error handler
    // NodeApp.use(function(err, req, res, next) {
    //   // set locals, only providing error in development
    //   res.locals.message = err.message;
    //   res.locals.error = req.app.get('env') === 'development' ? err : {};

    //   // render the error page
    //   res.status(err.status || 500);
    //   res.send(err);
    //   //res.render('error');
    // });
    // 서버 실행
    http_server = NodeApp.listen(JConfig.http_port, function () {
      console.log(`listening at ${JConfig.http_port}`);
      FTrace.log(__filename, `listening at ${JConfig.http_port}`);
    });
    webSocketServer = new wsModule.Server({
      server: http_server,
    });
    webSocketServer.on("connection", (ws, request) => {
      if (ws.readyState == ws.OPEN) {
        httpWss = ws;
        httpWss.send("socket connected");
        console.log(process.argv);
      }
    });
  } catch (err) {
    FTrace.log(err);
  } finally {
    runFepServerFunc();
  }
}

//  fep
function fep_execute() {
  console.log("FEP connection start");
  var tsocket = new Net.Socket();

  var packet_buffdata = null;
  connecttag(tsocket, function (result, err) {
    if (result) {
      packet_buffdata = FService.connectSend(JConfig.con);
      FService.sendw(tsocket, packet_buffdata);
    } else {
      FTrace.log(err);
    }
  });
}

// socket
function connecttag(tsocket, callback) {
  tsocket.connect({ host: JConfig.host, port: JConfig.port }, function () {
    callback(true, null);
  });
  const nowTime =
    new Date().toISOString().slice(0, 10) +
    " " +
    new Date().toLocaleTimeString("en-GB");
  tsocket.on("data", function (data) {
    // const insertquery = "Insert into sessionTBL values ('"+process.env.name + "', '1', '"+nowTime+
    // "') ON DUPLICATE KEY UPDATE Instance_Status='1', Connected_Time='"+nowTime+"';";
    // sendQuery(insertquery,(res)=>console.log(res));
    if (httpWss) {
      httpWss.send("소켓 타는중");
    }
    if (JConfig.log_check <= 1) {
      FTrace.log("FEP receive", data.length);
      this.pushLog = [];

      //FTRACE.log('datarecv중요', data.toString());
    }
    FService.onRecv_Data(
      data,
      JpacketTotal_length,
      Jcdata,
      increase_length,
      standard_length,
      tsocket,
      httpWss
    );
  });

  tsocket.on("end", function () {
    FTrace.log("Client disconnected");
  });

  tsocket.on("error", function (err) {
    callback(false, JSON.stringify(err));
  });

  tsocket.on("timeout", function () {
    FTrace.log("Socket Timed Out");
  });

  tsocket.on("close", function () {
    FService.reconnect(tsocket, callback, connecttag);
  });
}
