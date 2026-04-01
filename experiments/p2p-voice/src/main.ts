import express from "express";
import type {Request, Response, NextFunction} from "express";
import https from "https"
import path from "path";
import fs from "fs"
import { WebSocket, WebSocketServer } from "ws";

const app = express()

const rootDir = path.resolve(import.meta.dirname, "../")
const PORT = 3000
const HOST = "192.168.0.5" // Or whatever your ip address may be
const key = fs.readFileSync(path.resolve(rootDir, "../../tools/dev-certs/devcert1.key")); // /services/first-service/src/main.ts -> /tools/dev-certs/devcert1.key
const cert = fs.readFileSync(path.resolve(rootDir, "../../tools/dev-certs/devcert1.crt"));

app.use(express.json())

app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.resolve(rootDir, "static/index.html"));
})

const server = https.createServer({key: key, cert: cert}, app).listen(PORT, HOST, ()=>{
  console.log("listening on", HOST, PORT)
})

const wss = new WebSocketServer({server:server})
let senderSocket: WebSocket | null = null;
let receiverSocket: WebSocket | null = null;

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log(message.type)
    if (message.type === 'sender') senderSocket = ws;
    else if (message.type === 'receiver') receiverSocket = ws;
    else if (message.type === 'createOffer' && ws === senderSocket)
      receiverSocket?.send(JSON.stringify({ type: 'createOffer', sdp: message.sdp }));
    else if (message.type === 'createAnswer' && ws === receiverSocket)
      senderSocket?.send(JSON.stringify({ type: 'createAnswer', sdp: message.sdp }));
    else if (message.type === 'iceCandidate') {
      const target = ws === senderSocket ? receiverSocket : senderSocket;
      target?.send(JSON.stringify({ type: 'iceCandidate', candidate: message.candidate }));
    }
  });
});
