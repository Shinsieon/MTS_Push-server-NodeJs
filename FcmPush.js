"use strict";
require("../JGlobal.js");

const Admin = require("firebase-admin");
const FTRACE = include("JTrace.js");
let serAccount = JConfig.fcmToken;
const server = require("../Serverhttp");
Admin.initializeApp({
  credential: Admin.credential.cert(serAccount),
});

const successFunc = (response, data) => {
  const nowTime =
    new Date().toISOString().slice(0, 10) +
    " " +
    new Date().toLocaleTimeString("en-GB");
  const query =
    "Update db_msg SET fcm_send_yn = 'Y', fcm_sent_time = '" +
    nowTime +
    "' " +
    ", result= '" +
    response +
    "' WHERE push_grp_id = '" +
    data["push_grp_id"] +
    "' and csno= '" +
    data["csno"] +
    "';";
  server.sendQuery(query, (res) => console.log(res));
  if (JConfig.log_check <= 1)
    FTRACE.log(__filename, `Firebase Success: `, response);
};

const failFunc = (err, data) => {
  const query =
    "Update db_msg SET fcm_send_yn = 'N', result = '" +
    JSON.stringify(err).substring(0, 200) +
    "' WHERE push_grp_id = '" +
    data["push_grp_id"] +
    "' and csno= '" +
    data["csno"] +
    "';";
  server.sendQuery(query, (res) => console.log(res));
  if (JConfig.log_check <= 1) FTRACE.log(__filename, `Firebase Error: `, err);
};
const sendToFCM_Recursive = (data, idx) => {
  if (idx == data.length) return;
  let target_token = data[idx].device_id;
  delete data[idx]["device_id"];

  var message = {
    token: target_token,
    data: data[idx],
    apns: {
      payload: {
        aps: {
          contentAvailable: true,
          alert: {
            title: data[idx]["msg_title"],
            body: data[idx]["msg_contents"],
          },
        },
        badge: 1,
      },
    },
  };
  try {
    Admin.messaging()
      .send(message)
      .then(function (response) {
        successFunc(response, data[idx]);
        sendToFCM_Recursive(data, idx + 1);
      })
      .catch(function (err) {
        failFunc(err, data[idx]);
        sendToFCM_Recursive(data, idx + 1);
      });
  } catch (err) {
    console.log(err);
    return;
  }
};
module.exports.sendToFCM_Recursive = sendToFCM_Recursive;
