'use strict';

const { SMTPServer } = require('smtp-server');
const simpleParser = require('mailparser').simpleParser;
const WebSocket = require("ws");
const express = require("express");
const path = require('path');



const SMTP_SERVER_PORT = process.env.SMTP_SERVER_PORT  || 8025
const SERVER_PORT = process.env.SERVER_PORT || 8080
const WS_SERVER_PORT = process.env.WS_SERVER_PORT || 8081
const SERVER_HOST = process.env.SERVER_HOST || "localhost"
const WS_PROTOCOL = process.env.WS_PROTOCOL || "ws"
const WS_EX_PROTOCOL = process.env.WS_EX_PROTOCOL || "ws"
const WS_EX_SERVER_PORT = process.env.WS_EX_SERVER_PORT || 8081
const HTTP_PROTOCOL = process.env.HTTP_PROTOCOL || "http"
const INDEX = path.join(__dirname, "index.html"); // index address

const smtp_server = new SMTPServer({
    logger: false,

    banner: 'SMTP mock server, use UI to to check the actual message',

    disabledCommands: ['AUTH', 'STARTTLS'],

    onData(stream, session, callback) {
        //stream.pipe(process.stdout);
        simpleParser(stream, {skipHtmlToText: false, skipImageLinks: false, skipTextToHtml: false, skipTextLinks: false, keepCidLinks: true})
            .then(parsed => {
                console.log(parsed);
                broadCast(parsed);
            })
            .catch(err => {console.log("Error: Unknown Error in the Socket Server");});

        stream.on("end",  () => {
            console.log("OK we are done!")
            callback(null)
            
        });
    },
})

smtp_server.on('error', err => {
    console.log('Error: SMTP Error occurred ')
    console.log(err)
});

//Listen to the SMTP server
smtp_server.listen(SMTP_SERVER_PORT, SERVER_HOST)
console.log(`\x1b[33m SMTP Server Running on ${SERVER_HOST}:${SMTP_SERVER_PORT}\x1b[0m`)

const http_server = express()

//Set the route for index file
http_server.get('/', (req, res) => {
    res.sendFile(INDEX);
  });
  
//Set the route for configuration file
http_server.get('/config', (req, res) => {
    res.send({
        wsProtocol: WS_EX_PROTOCOL,
        wsPort: WS_EX_SERVER_PORT
     });
  });

//Listen to the http port
  http_server.listen(SERVER_PORT, () => {
    console.log(`\x1b[33m HTTP Server Running on http://${SERVER_HOST}:${SERVER_PORT}\x1b[0m`);
  })

  /**
   * Listen on the Socker Server & Process messages
   * */

const socketServer = new WebSocket.Server({port: WS_SERVER_PORT,
    perMessageDeflate: {
      zlibDeflateOptions: {
        // See zlib defaults.
        chunkSize: 1024,
        memLevel: 7,
        level: 3
      },
      zlibInflateOptions: {
        chunkSize: 10 * 1024
      },
      // Other options settable:
      clientNoContextTakeover: true, // Defaults to negotiated value.
      serverNoContextTakeover: true, // Defaults to negotiated value.
      serverMaxWindowBits: 10, // Defaults to negotiated value.
      // Below options specified as default values.
      concurrencyLimit: 10, // Limits zlib concurrency for perf.
      threshold: 1024 // Size (in bytes) below which messages
      // should not be compressed if context takeover is disabled.
    } });
console.log(`\x1b[33m Socket Server Running on ws://${SERVER_HOST}:${WS_SERVER_PORT}\x1b[0m`);

function heartbeat() {
    this.isAlive = true;
  }

socketServer.on('connection', (socketClient) => {
    console.log('connected');
    console.log('Number of clients: ', socketServer.clients.size);
    socketClient.isAlive = true;
    socketClient.on('pong', heartbeat);
    
    socketClient.on('message', (message) => {
      broadCast(message);
     
    });

    const interval = setInterval(function ping() {
        socketServer.clients.forEach(function each(ws) {
          if (ws.isAlive === false) return ws.terminate();
      
          ws.isAlive = false;
          ws.ping();
        });
      }, 30000);

    socketClient.on('close', (socketClient) => {
        clearInterval(interval);
        console.log('closed');
        console.log('Number of clients: ', socketServer.clients.size);
      
    });
  });


  /**
   * Broadcasts the mail to all the connected sockets
   * @param {*} message 
   */
  function broadCast(message){  
    socketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
  }
