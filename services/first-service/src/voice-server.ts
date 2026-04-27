import { Server, Socket } from "socket.io"
import * as mediasoup from "mediasoup"
import { Server as HttpsServer } from "https"
import jwt from "jsonwebtoken"
import type { JwtPayload, VerifyOptions } from "jsonwebtoken";

// Note:
// This code is super messy, in terms of component breakup.
// It will be hard to refactor, but right now we need something
//  functional and quick to use.

const options: VerifyOptions = {
  issuer: "myAuthService",
  audience: "beef-live",
  algorithms: ['HS256']
}

let worker: mediasoup.types.Worker;

let roomMap = new Map<String, VoiceRoom>();

class VoiceRoom {
  id?: String;
  members: String[] = [];
  transports = new Map<string, mediasoup.types.WebRtcTransport>();
  producers = new Map<string, mediasoup.types.Producer>();
  deletedProducers = new Map<string, string>();
  consumers = new Map<string, mediasoup.types.Consumer>();
  router?: mediasoup.types.Router;
  status: "idle" | "opening" | "open" = "idle"
  routerPromise?: Promise<mediasoup.types.Router>

  constructor(id: String) {
    this.id = id
  }

  join(userId: String) {
    this.members.push(userId)
  }

  leave(userId: String) {
    let index = this.members.findIndex(user => user === userId)
    if(index !== -1) this.members.splice(index, 1)
  }

  async active() {
    switch(this.status) {
      case "idle": // No router for the room
        this.status = "opening"
        this.routerPromise = worker.createRouter({
          mediaCodecs: [
            {
              kind: 'audio',
              mimeType: 'audio/opus',
              clockRate: 48000,
              channels: 2,
            }
          ],
        });
        try {
          this.router = await this.routerPromise
          this.status = "open"
          console.log("opening room ", this.id)
        } catch (err) {
          this.status = "idle"; // Reset so it can be retried
          throw err;
        }
        delete this.routerPromise;
        break;
      case "opening":
        await this.routerPromise
    }
  }

  isEmpty() {
    return this.transports.size == 0
  }

  
  close() {
    console.log("Closing room ", this.id)
    this.status = "idle"
    this.router?.close()
    delete this.router;
    // This should only be called if there are no participants
  }
  

  async createWebRtcTransport(): Promise<mediasoup.types.WebRtcTransport> {
    return await this.router!.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: '192.168.0.5' }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
    });
  }
}

export async function voice_init(server: HttpsServer) {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 10000,
    rtcMaxPort: 10100,
  });

  worker.on('died', () => {
    console.error('mediasoup Worker died');
  });

  const io = new Server(server, {path: "/voice"})

  // Authenticate connections and place them in the correct room
  io.use((socket, next) => {
    const token = socket.handshake.auth.token ?? "";

    if (!token) {
      return next(new Error('No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, options);
      socket.data.tokenData = decoded as JwtPayload;
    } catch (err) {
      console.log(`bad voice token: error ${err}`);
      return next(new Error("Invalid token, Permission Denied"))
    }

    if(socket.data.tokenData.type !== "Voice") {
      console.log("Non-voice token used as voice token")
      return next(new Error("Not a voice token"))
    }

    // Optionally attach data to the socket for use later
    socket.data.userId = socket.data.tokenData.sub
    const roomId = socket.data.tokenData.channel
    socket.data.roomId = roomId
    if(!roomMap.get(roomId)) {
      roomMap.set(roomId, new VoiceRoom(roomId))
    }
    socket.data.room = roomMap.get(roomId)
    socket.data.room.join(socket.data.userId)
    socket.join(roomId)

    next(); // Allow connection
  });

  io.on('connection', async (socket: Socket) => {
    console.log('Client connected:', socket.id);
    await socket.data.room.active() // Pause the connection until the room is entirely set up

    // 1. Client requests router RTP capabilities so it can load its Device
    socket.on('getRouterRtpCapabilities', (callback: Function) => {
      callback(socket.data.room.router.rtpCapabilities);
    });

    // 2. Client requests a transport for sending media (client → server)
    socket.on('createSendTransport', async (callback: Function) => {
      try {
        const transport = await socket.data.room.createWebRtcTransport();
        socket.data.room.transports.set(`${socket.id}-send`, transport);

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
        const transport = await socket.data.room.createWebRtcTransport();
        socket.data.room.transports.set(`${socket.id}-recv`, transport);

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
        const transport = socket.data.room.transports.get(`${socket.id}-send`);
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
        const transport = socket.data.room.transports.get(`${socket.id}-recv`);
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
        const transport = socket.data.room.transports.get(`${socket.id}-send`);
        if (!transport) return callback({ error: 'Send transport not found' });

        const producer = await transport.produce({ kind, rtpParameters });
        socket.data.room.producers.set(producer.id, producer);

        producer.on('transportclose', () => {
          socket.data.room.deletedProducers.set(producer.id, producer.appData.userId)
          socket.data.room.producers.delete(producer.id);
        });

        producer.appData.userId = socket.data.userId

        callback({ id: producer.id });

        // Notify all other connected clients that a new producer is available
        socket.to(socket.data.roomId).emit('newProducer', {
          producerId: producer.id,
          kind: producer.kind,
          userId: producer.appData.userId
        });
      } catch (err) {
        callback({ error: (err as Error).message });
      }
    });

    // 7. Client wants to consume a producer (server forwards media down to client)
    socket.on('consume', async ({ producerId, rtpCapabilities }: { producerId: string; rtpCapabilities: mediasoup.types.RtpCapabilities }, callback: Function) => {
      try {
        if (!socket.data.room.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ error: 'Cannot consume: incompatible RTP capabilities' });
        }

        const transport = socket.data.room.transports.get(`${socket.id}-recv`);
        if (!transport) return callback({ error: 'Recv transport not found' });

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: true, // Start paused until client signals ready
        });

        socket.data.room.consumers.set(consumer.id, consumer);

        consumer.on('transportclose', () => socket.data.room.consumers.delete(consumer.id));
        consumer.on('producerclose', () => {
          socket.data.room.consumers.delete(consumer.id);
          let userId = socket.data.room.deletedProducers.get(consumer.producerId) // Producer's userId
          socket.emit('producerClosed', { consumerId: consumer.id, userId: userId }); ////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
        const consumer = socket.data.room.consumers.get(consumerId);
        if (!consumer) return callback({ error: 'Consumer not found' });
        await consumer.resume();
        callback({});
      } catch (err) {
        callback({ error: (err as Error).message });
      }
    });

    // 9. Send existing producers to a newly joined client
    socket.on('getProducers', (callback: Function) => {
      const existingProducers = Array.from(
        (socket.data.room.producers as Map<string, mediasoup.types.Producer>).entries()
      ).filter(([id, producer]) => producer.appData.userId !== socket.data.userId)
      .map(([id, producer]) => ({
        producerId: id,
        kind: producer.kind,
        userId: producer.appData.userId
      }));
      callback(existingProducers);
    });

    // 10. Clean up when client disconnects
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      for (const [key, transport] of socket.data.room.transports.entries()) {
        if (key.startsWith(socket.id)) {
          transport.close();
          socket.data.room.transports.delete(key);
        }
      }

      socket.data.room.leave(socket.data.userId)

      if(socket.data.room.isEmpty()) {
        socket.data.room.close()
        roomMap.delete(socket.data.roomId)
      }

    });
  });

  console.log('mediasoup Worker created');
}
