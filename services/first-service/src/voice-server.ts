import type {Request, Response} from "express"
import express from "express"
import path from "path"
import fs from "fs"
import https from "https"
import { Server, Socket } from "socket.io"
import * as mediasoup from "mediasoup"

const baseDir = path.join(import.meta.dirname, "../")

const HOST = "192.168.0.5"
const PORT = 3000
const key = fs.readFileSync(path.resolve(baseDir, "../../tools/dev-certs/devcert1.key")); // /services/first-service/src/main.ts -> /tools/dev-certs/devcert1.key
const cert = fs.readFileSync(path.resolve(baseDir, "../../tools/dev-certs/devcert1.crt"));

const myApp = express()
myApp.use(express.json())
myApp.use('/static', express.static(path.join(baseDir, "static")))

myApp.get('/', (req: Request, res:Response)=>{
  res.sendFile(path.join(baseDir, "static", "index.html"))
})

const server = https.createServer({key, cert}, myApp).listen(PORT, HOST, () => {
  console.log(`Server running at https://${HOST}:${PORT}/`);
});

//const wss = new WebSocketServer({server, path:"/voice"})
const io = new Server(server, {path: "/voice"})

let worker: mediasoup.types.Worker;
let router: mediasoup.types.Router;

// Store transports, producers, consumers per socket
const transports = new Map<string, mediasoup.types.WebRtcTransport>();
const producers = new Map<string, mediasoup.types.Producer>();
const consumers = new Map<string, mediasoup.types.Consumer>();

async function startMediasoup() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', () => {
    console.error('mediasoup Worker died, exiting...');
    process.exit(1);
  });

  router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
      },
    ],
  });

  console.log('mediasoup Worker and Router created');
}

await startMediasoup()

async function createWebRtcTransport(): Promise<mediasoup.types.WebRtcTransport> {
  return await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: '192.168.0.5' }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });
}

io.on('connection', (socket: Socket) => {
  console.log('Client connected:', socket.id);

  // 1. Client requests router RTP capabilities so it can load its Device
  socket.on('getRouterRtpCapabilities', (callback: Function) => {
    callback(router.rtpCapabilities);
  });

  // 2. Client requests a transport for sending media (client → server)
  socket.on('createSendTransport', async (callback: Function) => {
    try {
      const transport = await createWebRtcTransport();
      transports.set(`${socket.id}-send`, transport);

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err) {
      console.error('createSendTransport error:', err);
      callback({ error: (err as Error).message });
    }
  });

  // 3. Client requests a transport for receiving media (server → client)
  socket.on('createRecvTransport', async (callback: Function) => {
    try {
      const transport = await createWebRtcTransport();
      transports.set(`${socket.id}-recv`, transport);

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (err) {
      console.error('createRecvTransport error:', err);
      callback({ error: (err as Error).message });
    }
  });

  // 4. Client connects its send transport (sends DTLS params)
  socket.on('connectSendTransport', async ({ dtlsParameters }: { dtlsParameters: mediasoup.types.DtlsParameters }, callback: Function) => {
    try {
      const transport = transports.get(`${socket.id}-send`);
      if (!transport) return callback({ error: 'Send transport not found' });
      await transport.connect({ dtlsParameters });
      callback({});
    } catch (err) {
      callback({ error: (err as Error).message });
    }
  });

  // 5. Client connects its recv transport (sends DTLS params)
  socket.on('connectRecvTransport', async ({ dtlsParameters }: { dtlsParameters: mediasoup.types.DtlsParameters }, callback: Function) => {
    try {
      const transport = transports.get(`${socket.id}-recv`);
      if (!transport) return callback({ error: 'Recv transport not found' });
      await transport.connect({ dtlsParameters });
      callback({});
    } catch (err) {
      callback({ error: (err as Error).message });
    }
  });

  // 6. Client starts producing (sending media to the server)
  socket.on('produce', async ({ kind, rtpParameters }: { kind: mediasoup.types.MediaKind; rtpParameters: mediasoup.types.RtpParameters }, callback: Function) => {
    try {
      const transport = transports.get(`${socket.id}-send`);
      if (!transport) return callback({ error: 'Send transport not found' });

      const producer = await transport.produce({ kind, rtpParameters });
      producers.set(producer.id, producer);

      producer.on('transportclose', () => {
        producers.delete(producer.id);
      });

      callback({ id: producer.id });

      // Notify all other connected clients that a new producer is available
      socket.broadcast.emit('newProducer', {
        producerId: producer.id,
        kind: producer.kind,
      });
    } catch (err) {
      callback({ error: (err as Error).message });
    }
  });

  // 7. Client wants to consume a producer (server forwards media down to client)
  socket.on('consume', async ({ producerId, rtpCapabilities }: { producerId: string; rtpCapabilities: mediasoup.types.RtpCapabilities }, callback: Function) => {
    try {
      if (!router.canConsume({ producerId, rtpCapabilities })) {
        return callback({ error: 'Cannot consume: incompatible RTP capabilities' });
      }

      const transport = transports.get(`${socket.id}-recv`);
      if (!transport) return callback({ error: 'Recv transport not found' });

      const consumer = await transport.consume({
        producerId,
        rtpCapabilities,
        paused: false, // Start paused until client signals ready
      });

      consumers.set(consumer.id, consumer);

      consumer.on('transportclose', () => consumers.delete(consumer.id));
      consumer.on('producerclose', () => {
        consumers.delete(consumer.id);
        socket.emit('producerClosed', { consumerId: consumer.id });
      });

      callback({
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      });
    } catch (err) {
      callback({ error: (err as Error).message });
    }
  });

  // 8. Client signals it is ready to receive — resume the consumer
  socket.on('resumeConsumer', async ({ consumerId }: { consumerId: string }, callback: Function) => {
    try {
      const consumer = consumers.get(consumerId);
      if (!consumer) return callback({ error: 'Consumer not found' });
      await consumer.resume();
      callback({});
    } catch (err) {
      callback({ error: (err as Error).message });
    }
  });

  // 9. Send existing producers to a newly joined client
  socket.on('getProducers', (callback: Function) => {
    const existingProducers = Array.from(producers.entries()).map(([id, producer]) => ({
      producerId: id,
      kind: producer.kind,
    }));
    callback(existingProducers);
  });

  // 10. Clean up when client disconnects
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    for (const [key, transport] of transports.entries()) {
      if (key.startsWith(socket.id)) {
        transport.close();
        transports.delete(key);
      }
    }
  });
});
