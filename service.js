"use strict";

const FPACKET = require("./fep/fpacket");
const FERROR = require("./fep/ferror");
const NODECHILD = require("child_process");
const FTRACE = include("JTrace.js");
const server = require("../Serverhttp");
const fcmServer = require("./FcmPush");

function Send(Ssocket, packet_buff) {
  Ssocket.write(packet_buff);
}
module.exports.sendw = Send;

function on_Recv(data, socket, websocket) {
  var RecvData = data;
  convertPacketToJson(RecvData, pushsend, function (result, gun) {
    if (gun === "9") {
      // 해당내용에따라 접속끊기
      FTRACE.log("FEP에러", result.Phead);
    } else if (gun === "0") {
      if (JConfig.log_check < 1) {
        FTRACE.log("FEP Hearbeat Check");
      }
      returnResponse(result, gun, function (packet_buff, errors) {
        if (errors !== null) {
          FTRACE.log(errors);
        } else {
          Send(socket, packet_buff);
        }
      });
    } else if (gun === "1") {
      // 초기 접속시  스킵
      //FTRACE.log('FEP접속', result.Phead);
    } else {
      if (JConfig.log_check < 1) {
        // date datetime,
        // csno char(10) PRIMARY KEY,
        // cust_telno char(11),
        // uuid varchar(32),
        // tokenid varchar(256),
        // msg_title varchar(256),
        // msg_contents varchar(1024),
        // d_servicename char(16),
        // push_grp_id char(16)

        FTRACE.log("FEP패킷헤더", result.Phead);
        FTRACE.log("FEP데이터헤더", result.Dhead[0].Dhead);
        FTRACE.log("FEP데이터메세지", result.Dhead[0].Dmsg);
        FTRACE.log("FEP데이터", result.Dhead[0].Data);
        let query = "Insert into db_msg values ";
        result.Dhead[0].Data.map((item, idx) => {
          let values =
            "(NULL, '" +
            result.Dhead[0].Dmsg.sndn_rsev_hour +
            "','" +
            item.csno +
            "','" +
            item.cust_telno +
            "','" +
            result.Dhead[0].Dmsg.uuid_id +
            "','" +
            item.device_id +
            "','" +
            item.msg_title +
            "','" +
            item.msg_contents +
            "','" +
            result.Dhead[0].Dhead.D_servicename +
            "','" +
            result.Dhead[0].Dmsg.push_grp_id +
            "',NULL,'" +
            result.Dhead[0].Dmsg.sndn_rsev_hour +
            "',NULL)" +
            (idx == result.Dhead[0].Data.length - 1 ? ";" : ",");
          query += values;
        });
        server.sendQuery(query);
      }
      returnResponse(result, gun, function (packet_buff, errors) {
        if (errors !== null) {
          FTRACE.log(errors);
        } else {
          Send(socket, packet_buff);
        }
      });
    }
  });
}

function convertPacketToJson(data, callbackR, callbackS) {
  var jsonData = {
    Phead: {},
    body: {},
    Dhead: [
      {
        Dhead: {},
        Dmsg: {},
        Data: [],
      },
    ],
    packet: data,
  };
  FPACKET.buildHead(jsonData);
  callbackR(jsonData, callbackS);
}

function pushsend(pushData, callback) {
  var count, gun, pushcount;
  var errcode = FERROR.getError(pushData.Phead.P_ResponseCode);
  if (errcode.code !== null) {
    gun = "9";
  } else if (pushData.Phead.P_TransactionType === "D") {
    for (count = 0; count < pushData.Phead.P_RecordCount; count++) {
      var msgs = [];
      for (
        pushcount = 0;
        pushcount < pushData.Dhead[count].Dmsg.send_cnt;
        pushcount++
      ) {
        var msg_push = {};
        msg_push = pushData.Dhead[count].Data[pushcount];
        if (JConfig.type_check === "0") msg_push["type"] = "1";
        msg_push["msg_title"] = pushData.Dhead[count].Dmsg.msg_title;
        msg_push["msg_contents"] = pushData.Dhead[count].Dmsg.msg_contents;
        var args = {
          push_grp_id: pushData.Dhead[count].Dmsg.push_grp_id,
          device_id: msg_push.device_id,
          csno: msg_push.csno,
          rcms_cnrp_name: msg_push.rcms_cnrp_name,
          type: msg_push.type,
          msg_title: msg_push.msg_title,
          msg_contents: msg_push.msg_contents,
        };
        msgs.push(args);
      }
      fcmServer.sendToFCM_Recursive(msgs, 0);
    }
    gun = "2";
  } else if (pushData.Phead.P_TransactionType === "A") {
    gun = "1";
  } else {
    gun = "0";
  }
  callback(pushData, gun);
}

function returnResponse(oParam, gun, callback) {
  var errors = null;
  var packet = FPACKET.makeHeader(oParam.Phead, gun, JConfig.con);
  if (oParam.Phead.P_TotalLength === 0) {
    errors = "9203";
  } else {
    if (
      oParam.Phead.P_TransactionType === "D" ||
      oParam.Phead.P_TransactionType === "H"
    ) {
      packet = FPACKET.setPacketLength(packet, packet.length);
    } else {
      errors = "9203";
    }
  }
  FTRACE.log(
    "RETURN",
    "returnAlive:[" + packet.length + ":" + packet.toString() + "]"
  );
  callback(packet, errors);
}

function onRecv_Data(
  data,
  onRecv_length,
  cdata,
  increase_length,
  standard_length,
  socket,
  websocket
) {
  var packet_length = 0;
  if (cdata === null) {
    packet_length = Number(data.slice(onRecv_length, onRecv_length + 6)) || 0;
    packet_length += 6;
    if (onRecv_length === 0) {
      increase_length += packet_length;
      standard_length += packet_length;
      cdata = data.slice(onRecv_length, packet_length);
    } else {
      if (packet_length !== onRecv_length) {
        packet_length =
          Number(data.slice(standard_length, standard_length + 6)) || 0;
        packet_length += 6;
        increase_length += packet_length;
        cdata = data.slice(standard_length, increase_length);
        standard_length += packet_length;
      } else {
        increase_length += onRecv_length;
        cdata = data.slice(standard_length, increase_length);
        standard_length += onRecv_length;
      }
    }
    if (cdata.length !== 0) {
      onRecvData_request(
        data,
        cdata,
        packet_length,
        onRecv_length,
        increase_length,
        standard_length,
        socket,
        websocket
      );
    } else {
      onRecv_length = 0;
      increase_length = 0;
      standard_length = 0;
      cdata = null;
      Jcdata = null;
      JpacketTotal_length = 0;
    }
  } else {
    var len = onRecv_length - cdata.length;
    cdata = Buffer.concat([cdata, data.slice(0, len)]);
    if (cdata.length === onRecv_length) {
      increase_length += len;
      standard_length += len;
      packet_length = onRecv_length;
      onRecvData_request(
        data,
        cdata,
        packet_length,
        onRecv_length,
        increase_length,
        standard_length,
        socket,
        websocket
      );
    }
  }
}

function onRecvData_request(
  data,
  cdata,
  packet_length,
  onRecv_length,
  increase_length,
  standard_length,
  socket,
  websocket
) {
  if (cdata.length === packet_length) {
    on_Recv(cdata, socket, websocket);
    cdata = null;
    onRecv_length = packet_length;
    onRecv_Data(
      data,
      onRecv_length,
      cdata,
      increase_length,
      standard_length,
      socket,
      websocket
    );
  } else if (cdata.length < packet_length) {
    Jcdata = cdata;
    JpacketTotal_length = packet_length;
  }
}

module.exports.connectSend = function (gun) {
  var packetAhead = {};
  return FPACKET.makeAconnect(packetAhead, gun);
};

module.exports.reconnect = function (resocket, callback, connect) {
  var recon = resocket;
  var callfun = callback;
  var connecttag = connect;
  setTimeout(function (resocket, callback) {
    recon.removeAllListeners();
    connecttag(recon, callfun);
  }, 1000 * JConfig.retime);
};

module.exports.onRecv_Data = onRecv_Data;
