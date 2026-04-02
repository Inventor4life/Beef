import express from "express";
import type {Request, Response, NextFunction} from "express";
import https from "https"
import path from "path";
import fs from "fs"
import { WebSocket, WebSocketServer } from "ws";
import wrtc = require("wrtc")
const { RTCPeerConnection, MediaStream, RTCSessionDescription } = wrtc

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


// From https://medium.com/@ashubhai/webrtc-applications-with-node-js-and-react-js-7f4d4313bace
const wss = new WebSocketServer({server:server, path: "/voice"})

interface Participant {
  ws: WebSocket,
  pc: undefined | RTCPeerConnection,
  incomingStream: undefined | MediaStream,
  alive: boolean,
  keepalive: NodeJS.Timeout,
  state: "pending" | "connected" | "renegotiate"
}

let participants: Map<WebSocket, Participant> = new Map();

function heartbeat(ws: WebSocket) {
  // Check if Participant is healthy
  console.log("Heartbeat called")
  //console.log(participants)
  let thisParticipant = participants.get(ws)
  if(!thisParticipant) {
    console.log("Error: Participant not found (HEARTBEAT)")
    return
  }

  if(!thisParticipant.alive) {
    console.log("participant died")
    clearInterval(thisParticipant.keepalive)
    ws.terminate()
    // TODO: Remove this stream from other clients
    participants.delete(ws)
  }
  thisParticipant.alive = false
  ws.ping();
}

function initPeer(par: Participant) {
  par.state = "pending"
  // Create new peer connection
  par.pc = new RTCPeerConnection({
    iceServers:[] // Ice servers (if any) go here
  }) as RTCPeerConnection

  // Add ICE candidate event handler to new PC
  par.pc.addEventListener('icecandidate', (event : RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      par.ws.send(JSON.stringify({
        type: "iceCandidate",
        candidate: event.candidate
      }));
    }
  })

  // TODO: Renegotiation logic. Will not add this for now, to see what happens.
  par.pc.addEventListener('negotiationneeded', async (event : Event) => {
    console.log("Negotiation Needed")
    /*
    if(par.state === "connected") {
      par.state = "pending"
      const offer = await (par.pc as RTCPeerConnection).createOffer()
      await (par.pc as RTCPeerConnection).setLocalDescription(offer)
      par.ws.send(JSON.stringify({
        type: "createOffer",
        sdp: offer
      }))
    }*/
    par.state = "renegotiate"
  })

  // Add ontrack event handler for incoming tracks of new participant
  par.pc.addEventListener('track', (event: RTCTrackEvent)=> {
    par.incomingStream = event.streams[0]
    console.log("track event streams:", event.streams.length)
    console.log("track event streams[0]:", event.streams[0]?.id)
    console.log("track kind:", event.track.kind)
    // TODO: Some handler here for multiple streams, or a handler for removing inactive streams
    /*
    if(!par.incomingStream) {

    }
    */
    // DEBUG:
    //const stream = new MediaStream([event.track])

    // Add new stream to existing connections (this isn't working yet.)
    participants.forEach(i_par => {
      console.log("participant found");
      if(i_par !== par) {
        if(i_par.pc) {
          console.log("Adding new track to existing connections");
          (i_par.pc as RTCPeerConnection).addTrack(event.track, par.incomingStream as MediaStream)
        }
      }
      console.log("Peer senders:", i_par?.pc?.getSenders())
    })
  })

  
  console.log("Adding existing streams to new connection")
  // Add existing streams to new connection
  participants.forEach(i_par => {
    if(i_par !== par) {
      if(i_par.incomingStream) {
        i_par.incomingStream.getTracks().forEach(track => {
          (par.pc as RTCPeerConnection).addTrack(track, i_par.incomingStream as MediaStream)
        });
      }
    }
  })
}

// DEBUG (FUUUUUUUUCK)
setInterval(()=>{
  console.log("Beginning renegotiations")
  participants.forEach(async (i_par) => {
    if(i_par.state === "renegotiate") {
      const offer = await (i_par.pc as RTCPeerConnection).createOffer()
      await (i_par.pc as RTCPeerConnection).setLocalDescription(offer)
      i_par.ws.send(JSON.stringify({
        type: "createOffer",
        sdp: offer
      }))
      i_par.state ="connected"
    }
  })
}, 20000)

wss.on('connection', (ws) => {
  // DEBUG
  console.log("New Connection")
  ws.on('close', () => {
    console.log("Websocket Closed");
  })
  // /DEBUG

  if(!participants.has(ws)) { // Not sure if this would ever be false, but just to be sure.
    console.log("Created participant")
    participants.set(ws, {
      ws: ws,
      alive: true,
      keepalive: setInterval(heartbeat, 20000, ws),
      pc: undefined,
      incomingStream: undefined,
      state: "pending"
    })
    //console.log(participants)
  }
  let thisParticipant = participants.get(ws)
  if(!thisParticipant) {
    console.log("Error: Participant not found (CONNECT)")
    return;
  }

  // Heartbeat
  ws.on('pong', ()=> {
    if(!thisParticipant) {
      console.log("Error: Participant not found (PONG)")
      return;
    }
    thisParticipant.alive = true
  })

  ws.on('message', async (data)=> {
    let message = undefined
    try {
      message = JSON.parse(data.toString())
    } catch (err) {
      console.log("Socket message error", err)
      return
    }
    console.log("Message type:", message.type)
    switch(message.type) {
      case "createOffer": // Offer received from client
        if(!thisParticipant.pc) {
          initPeer(thisParticipant)
        }

        // Set remote description and generate answer
        // Sorry for the typecasts. There may be a case where thisParticipant.pc is undefined,
        //  but I need to get this to work before I worry about it.
        var remoteDesc = new RTCSessionDescription(message.sdp)
        await (thisParticipant.pc as RTCPeerConnection).setRemoteDescription(remoteDesc)
        const answer = await (thisParticipant.pc as RTCPeerConnection).createAnswer()
        await (thisParticipant.pc as RTCPeerConnection).setLocalDescription(answer)
        ws.send(JSON.stringify({
          type: "createAnswer",
          sdp: answer
        }))
        break;

      case "createAnswer":
        // Needed for renegotiation
        var remoteDesc = new RTCSessionDescription(message.sdp)
        await (thisParticipant.pc as RTCPeerConnection).setRemoteDescription(remoteDesc)
        thisParticipant.state="connected"
        break;
      case "iceCandidate":
        // Sharing ice candidates
        try {
          await (thisParticipant.pc as RTCPeerConnection).addIceCandidate(message.candidate);
        } catch (err) {
          console.error('Error adding received ice candidate', err);
        }
        break;
      default:
        console.log("unknown message type", message.type)
    }
  })
})

/*
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
*/
