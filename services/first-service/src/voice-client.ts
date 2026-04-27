import { Device } from 'mediasoup-client'
import type { Transport, Producer, Consumer, DtlsParameters } from 'mediasoup-client/types';
import { types } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';

// Note:
// This code is super messy, in terms of component breakup.
// It will be hard to refactor, but right now we need something
//  functional and quick to use.

// Note 2:
// THIS FILE IS BUNDLED USING WEBPACK. CHANGES HERE WILL NOT BE REFLECTED FOR THE CLIENT UNLESS THE FOLLOWING HAPPENS:
//  1. Use 'tsc' or 'npx tsc' in the terminal to compile from typescript to javascript
//  2. Use 'webpack' or 'npx webpack' to take the javascript library and bundle it for the client.

class voiceConnection {
  socket?: Socket;

  device?: Device;
  sendTransport?: Transport;
  recvTransport?: Transport;
  consumedProducers = new Set<String>();

  status: "disconnected" | "connecting" | "connected" = "disconnected"

  container: HTMLElement | null = null;
  connected_users: String[] = [];
  connect_callback?: (users: String[]) => void;
  disconnect_callback?: (users: String[]) => void;

  constructor(container: HTMLElement) {
    if(!container) {
      console.log("Error: voiceConnection constructor not provided with containing element")
    }
    this.container = container
  }

  async connect(token: String) {
    if (this.status !== "disconnected"){
      this.disconnect()
    }
    this.status = "connecting"
    this.device = new Device();

    try {
      this.socket = io({
        path: "/voice",
        auth: { token: token }
      })

      this.socket.on('connect_error', (err) => {
        console.log("connection failed")
        this.disconnect()
      })

      this.socket.on("disconnect", (event) => {
        this.disconnect()
      })

      // Get router RTP capabilities and load the Device
      const routerRtpCapabilities = await this.socket.emitWithAck('getRouterRtpCapabilities');
      await this.device.load({ routerRtpCapabilities });

      // Create our sending transport
      const sparams = await this.socket.emitWithAck('createSendTransport');

      this.sendTransport = this.device.createSendTransport(sparams);

      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Spclet 
          await this.socket?.emitWithAck('connectSendTransport', { dtlsParameters });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });

      this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id, error } = await this.socket?.emitWithAck('produce', { kind, rtpParameters });
          if (error) return errback(new Error(error));
          callback({ id });
        } catch (err) {
          errback(err as Error);
        }
      });

      this.sendTransport.on('connectionstatechange', (state) => {
        console.log('Send transport state:', state);
      });

      await this.#publishLocalMedia()

      // Create our receiving transport
      const rparams = await this.socket.emitWithAck('createRecvTransport');

      this.recvTransport = this.device.createRecvTransport(rparams);

      this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await this.socket?.emitWithAck('connectRecvTransport', { dtlsParameters });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });

      this.recvTransport.on('connectionstatechange', (state) => {
        console.log('Recv transport state:', state);
      });

      // New code
      // Register handler FIRST so we don't miss any
      this.socket.on('newProducer', async ({ producerId, userId }: { producerId: string; userId: String }) => {
        if (this.consumedProducers.has(producerId)) return;
        this.consumedProducers.add(producerId)
        await this.#consumeProducer(producerId);
        if (this.connect_callback) this.connect_callback([userId])
        this.connected_users.push(userId)
      });

      // THEN fetch existing producers
      const existingUsers: String[] = []
      const existingProducers: { producerId: string; kind: string; userId: String }[] = await this.socket.emitWithAck('getProducers');
      for (const { producerId, userId } of existingProducers) {
        if (this.consumedProducers.has(producerId)) continue; // deduplicate
        this.consumedProducers.add(producerId);
        await this.#consumeProducer(producerId);
        this.connected_users.push(userId)
        existingUsers.push(userId)
      }

      if(this.connect_callback) this.connect_callback(existingUsers)

      /* Old code
      // Get and handle current producers
      const existingProducers: { producerId: string; kind: string; userId: String }[] = await this.socket.emitWithAck('getProducers');
      for (const { producerId } of existingProducers) {
        await this.#consumeProducer(producerId);
      }
      const existingUsers = existingProducers.map(producer => producer.userId)
      if(this.connect_callback) this.connect_callback(existingUsers)
      this.connected_users.push(...existingUsers)

      // Add handler for new producers
      this.socket.on('newProducer', async ({ producerId, userId }: { producerId: string; userId: String }) => {
        await this.#consumeProducer(producerId);
        if (this.connect_callback)this.connect_callback([userId])
        this.connected_users.push(userId)
      });
      */

      // Add handler for deleted producers
      this.socket.on('producerClosed', ({ consumerId, userId }: { consumerId: string, userId: String }) => {
        // Find and remove the associated media element
        const el = document.getElementById(consumerId);
        // Because we create the audio element within our container when a producer is created, this should only
        // affect elements within our container
        if (el) el.remove();
        if(this.disconnect_callback) this.disconnect_callback([userId])
        let index = this.connected_users.findIndex(user => user === userId)
        if(index !== -1) this.connected_users.splice(index, 1)
      });

      this.status = "connected"
    } catch (err) {
      this.disconnect()
      console.log(err)
    }
  }

  getStatus(): "disconnected" | "connecting" | "connected" {
    return this.status
  }

  onUserConnect(connect_callback: (users:String[])=>void) {
    this.connect_callback = connect_callback
  }

  onUserDisconnect(disconnect_callback: (users:String[])=>void) {
    this.disconnect_callback = disconnect_callback
  }

  disconnect()  {
    if(this.status !== "disconnected") {
      this.sendTransport?.close()
      this.recvTransport?.close()
      this.socket?.close()
      this.disconnect_callback?.(this.connected_users ?? [])
      this.connected_users = []
      if(this.container) { // Clear container <audio> elements
        this.container.innerHTML = ''
      }
      delete this.socket;
      delete this.sendTransport;
      delete this.recvTransport;
      this.consumedProducers.clear();
      this.status = "disconnected"
    }
  }

  async #consumeProducer(producerId: string) {
    const result = await this.socket?.emitWithAck('consume', {
      producerId,
      rtpCapabilities: this.device!.recvRtpCapabilities,
    });

    if (result.error) {
      console.error('Failed to consume:', result.error);
      return;
    }

    const consumer: Consumer = await this.recvTransport!.consume({
      id: result.id,
      producerId: result.producerId,
      kind: result.kind,
      rtpParameters: result.rtpParameters,
    });

    // Attach the track to a media element
    const stream = new MediaStream([consumer.track]);
    const el = document.createElement(consumer.kind === 'video' ? 'video' : 'audio');
    el.srcObject = stream;
    el.autoplay = true;
    el.id = consumer.id; // Used to remove element when producer closes
    if(this.container) this.container.appendChild(el);

    // Signal server that we're ready — it will resume the consumer
    const { error } = await this.socket!.emitWithAck('resumeConsumer', { consumerId: consumer.id });
    if (error) {
      console.error('Failed to resume consumer:', error);
    }

    // No transport close event. The elements are removed during our disconnect procedure

  }

  async #publishLocalMedia() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });

    // Produce audio track
    for (const track of stream.getTracks()) {
      const producer: Producer = await this.sendTransport!.produce({ track });

      producer.on('trackended', () => {
        console.log(`${track.kind} track ended`);
      });

      producer.on('transportclose', () => {
        this.disconnect()
        console.log('Send transport closed');
      });
    }
  }
}
