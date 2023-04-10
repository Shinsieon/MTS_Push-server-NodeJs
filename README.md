# Push-server-NodeJs
MTS Push Server from FEP to FCM by Nodejs

대용량 푸쉬 전송 데이터를 받아 FCM(Firebase Clound Messaging)에 전송하기 위한 미들서버.
Nodejs 기반 express 웹서버와 Net Socket 통신 구현.  
Used : Express.js, http Socket, Net Socket, MariaDB
*참고 : https://sieon-dev.tistory.com/69

1. Express Web Server and Net Socket with FEP  
-Serverhttp.js  

2. Packet processing(preprocession from buffer data)  
-Service.js, FPacket.js  

3. Send To FCM  
-FcmPush.js

