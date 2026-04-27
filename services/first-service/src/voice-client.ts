import { Device } from 'mediasoup-client'
import type { Transport, Producer, Consumer } from 'mediasoup-client/types';
import { types } from 'mediasoup-client';
import { io, Socket } from 'socket.io-client';

class voiceConnection {
  socket?: Socket;

  device: Device = new Device();
  sendTransport?: Transport;
  recvTransport?: Transport;

  status: "disconnected" | "connecting" | "connected" = "disconnected"

  container: HTMLElement | null = null;
  connected_users: string[] = [];
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

    try {
      this.socket = io({path: "/voice"})

      let status = await this.socket.emitWithAck("authenticate", {token: token} )
      if(status !== "success") {
        throw new Error("voiceConnection: Permission Denied")
      }

      // 1. Get router RTP capabilities and load the Device
      const routerRtpCapabilities = await this.socket.emitWithAck('getRouterRtpCapabilities');
      await this.device.load({ routerRtpCapabilities });

      // Create our sending transport
      const params = await this.socket.emitWithAck('createSendTransport');

      this.sendTransport = this.device.createSendTransport(params);

      this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          // Spclet 
          await this.socket?.emitWithAck('connectSendTransport', { dtlsParameters });
          callback();
        } catch (err) {
          errback(err as Error);
        }
      });

      sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const { id, error } = await socket.emitWithAck('produce', { kind, rtpParameters });
          if (error) return errback(new Error(error));
          callback({ id });
        } catch (err) {
          errback(err as Error);
        }
      });

      sendTransport.on('connectionstatechange', (state) => {
        console.log('Send transport state:', state);
      });

      // TODO (left off here):
      // Connect to the socket
      // Construct the transports

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
    this.status = "disconnected"
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

async function init() {
  device = new Device();



  // 2. Create send and recv transports
  await createSendTransport();
  await createRecvTransport();

  // 3. Get any producers that already exist before we joined
  const existingProducers: { producerId: string; kind: string }[] = await socket.emitWithAck('getProducers');
  for (const { producerId } of existingProducers) {
    await consumeProducer(producerId);
  }

  // 4. Listen for new producers from other peers
  socket.on('newProducer', async ({ producerId }: { producerId: string }) => {
    await consumeProducer(producerId);
  });

  // 5. Listen for producers closing (e.g. peer left)
  socket.on('producerClosed', ({ consumerId }: { consumerId: string }) => {
    // Find and remove the associated media element
    const el = document.getElementById(consumerId);
    if (el) el.remove();
  });

  // 6. Start capturing and publishing local media
  await publishLocalMedia();
}

// ─── Send Transport ───────────────────────────────────────────────────────────

async function createSendTransport() {

}

// ─── Recv Transport ───────────────────────────────────────────────────────────

async function createRecvTransport() {
  const params = await socket.emitWithAck('createRecvTransport');

  recvTransport = device.createRecvTransport(params);

  recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
    try {
      await socket.emitWithAck('connectRecvTransport', { dtlsParameters });
      callback();
    } catch (err) {
      errback(err as Error);
    }
  });

  recvTransport.on('connectionstatechange', (state) => {
    console.log('Recv transport state:', state);
  });
}

// ─── Produce (send local media) ───────────────────────────────────────────────

async function publishLocalMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });

  // Show local preview
  const localVideo = document.createElement('video');
  localVideo.srcObject = stream;
  localVideo.autoplay = true;
  localVideo.muted = true; // Mute local preview to avoid echo
  localVideo.id = 'local';
  document.body.appendChild(localVideo);

  // Produce each track
  for (const track of stream.getTracks()) {
    const producer: Producer = await sendTransport.produce({ track });

    producer.on('trackended', () => {
      console.log(`${track.kind} track ended`);
      producer.close();
    });

    producer.on('transportclose', () => {
      console.log('Send transport closed');
    });
  }
}

// ─── Consume (receive remote media) ──────────────────────────────────────────

async function consumeProducer(producerId: string) {
  const result = await socket.emitWithAck('consume', {
    producerId,
    rtpCapabilities: device.recvRtpCapabilities,
  });

  if (result.error) {
    console.error('Failed to consume:', result.error);
    return;
  }

  const consumer: Consumer = await recvTransport.consume({
    id: result.id,
    producerId: result.producerId,
    kind: result.kind,
    rtpParameters: result.rtpParameters,
  });

  console.log('track readyState:', consumer.track.readyState); // should be 'live'
  console.log('track muted:', consumer.track.muted);           // should be false after resume
  console.log('track enabled:', consumer.track.enabled);       // should be true

  // Attach the track to a media element
  const stream = new MediaStream([consumer.track]);
  const el = document.createElement(consumer.kind === 'video' ? 'video' : 'audio');
  el.srcObject = stream;
  el.autoplay = true;
  el.id = consumer.id; // Used to remove element when producer closes
  document.body.appendChild(el);

  // Signal server that we're ready — it will resume the consumer
  const { error } = await socket.emitWithAck('resumeConsumer', { consumerId: consumer.id });
  if (error) {
    console.error('Failed to resume consumer:', error);
  }

  consumer.on('transportclose', () => {
    el.remove();
  });

}

// ─── Start ────────────────────────────────────────────────────────────────────

init().catch(console.error);