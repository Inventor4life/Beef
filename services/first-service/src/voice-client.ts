import { Device } from 'mediasoup-client'
import type { Transport, Producer, Consumer } from 'mediasoup-client/types';
import { io, Socket } from 'socket.io-client';

// Note:
// This code is super messy, in terms of component breakup.
// It will be hard to refactor, but right now we need something
//  functional and quick to use.

// Note 2:
// THIS FILE IS BUNDLED USING WEBPACK. CHANGES HERE WILL NOT BE REFLECTED FOR THE CLIENT UNLESS THE FOLLOWING HAPPENS:
//  1. Use 'tsc' or 'npx tsc' in the terminal to compile from typescript to javascript
//  2. Use 'webpack' or 'npx webpack' to take the javascript library and bundle it for the client.

type VoiceStatus = "disconnected" | "connecting" | "connected";
type UserID = string;
type UserListCallback = (users: UserID[]) => void;
type VoiceActivityMonitor = {
  userId: UserID;
  context: AudioContext;
  intervalId: number;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  data: Uint8Array<ArrayBuffer>;
  speaking: boolean;
  quietFrames: number;
};

const SPEAKING_RMS_THRESHOLD = 0.035;
const QUIET_FRAMES_BEFORE_INACTIVE = 4;

function decodeUserIDFromToken(token: string): UserID | null {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;

    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(paddedBase64)) as { sub?: unknown };

    return typeof payload.sub === "string" ? payload.sub : null;
  } catch (err) {
    console.log("Unable to decode voice token user ID", err);
    return null;
  }
}

export default class voiceConnection {
  socket?: Socket;

  device?: Device;
  sendTransport?: Transport;
  recvTransport?: Transport;
  consumedProducers = new Set<string>();

  status: VoiceStatus = "disconnected"

  container: HTMLElement | null = null;
  connected_users: UserID[] = [];
  speaking_users = new Set<UserID>();
  localMediaStream?: MediaStream;
  voiceActivityMonitors = new Map<string, VoiceActivityMonitor>();
  userActivityMonitorKeys = new Map<UserID, Set<string>>();
  connect_callback?: UserListCallback;
  disconnect_callback?: UserListCallback;
  speaking_callback?: UserListCallback;

  constructor(container: HTMLElement) {
    if(!container) {
      console.log("Error: voiceConnection constructor not provided with containing element")
    }
    this.container = container
  }

  async connect(token: string) {
    if (this.status !== "disconnected"){
      this.disconnect()
    }

    const thisUserID = decodeUserIDFromToken(token);
    this.status = "connecting"
    this.device = new Device();

    try {
      this.socket = io({
        path: "/voice",
        auth: { token: token }
      })

      this.socket.on('connect_error', (err) => {
        console.log("connection failed", err)
        this.disconnect()
      })

      this.socket.on("disconnect", () => {
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

      await this.#publishLocalMedia(thisUserID)

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

      // Register handler first so we don't miss any new producers.
      this.socket.on('newProducer', async ({ producerId, userId }: { producerId: string; userId: string }) => {
        if (this.consumedProducers.has(producerId)) return;
        this.consumedProducers.add(producerId)
        await this.#consumeProducer(producerId, userId);

        const joinedUsers = this.#rememberUsers([userId]);
        if (joinedUsers.length > 0) this.connect_callback?.(joinedUsers)
      });

      const existingUsers = this.#rememberUsers(thisUserID ? [thisUserID] : []);
      const existingProducers: { producerId: string; kind: string; userId: string }[] = await this.socket.emitWithAck('getProducers');

      for (const { producerId, userId } of existingProducers) {
        if (this.consumedProducers.has(producerId)) continue;
        this.consumedProducers.add(producerId);
        await this.#consumeProducer(producerId, userId);
        existingUsers.push(...this.#rememberUsers([userId]))
      }

      if(existingUsers.length > 0) this.connect_callback?.(existingUsers)

      // Add handler for deleted producers
      this.socket.on('producerClosed', ({ consumerId, userId }: { consumerId: string, userId?: string }) => {
        // Find and remove the associated media element
        const el = document.getElementById(consumerId);
        // Because we create the audio element within our container when a producer is created, this should only
        // affect elements within our container
        if (el) el.remove();

        this.#stopVoiceActivityMonitor(consumerId);

        if (typeof userId !== "string") return;

        const leavingUsers = this.#forgetUsers([userId]);
        if(leavingUsers.length > 0) this.disconnect_callback?.(leavingUsers)
      });

      this.status = "connected"
    } catch (err) {
      this.disconnect()
      console.log(err)
    }
  }

  getStatus(): VoiceStatus {
    return this.status
  }

  onUserJoin(connect_callback: UserListCallback) {
    this.connect_callback = connect_callback
  }

  onUserLeave(disconnect_callback: UserListCallback) {
    this.disconnect_callback = disconnect_callback
  }

  onUserSpeaking(speaking_callback: UserListCallback) {
    this.speaking_callback = speaking_callback
  }

  onUserConnect(connect_callback: UserListCallback) {
    this.onUserJoin(connect_callback)
  }

  onUserDisconnect(disconnect_callback: UserListCallback) {
    this.onUserLeave(disconnect_callback)
  }

  disconnect()  {
    if(this.status === "disconnected") return;

    const leavingUsers = [...this.connected_users];
    this.status = "disconnected"

    this.sendTransport?.close()
    this.recvTransport?.close()
    this.socket?.close()
    this.#stopAllVoiceActivityMonitors()
    this.localMediaStream?.getTracks().forEach(track => track.stop())
    delete this.localMediaStream
    this.connected_users = []
    if(this.container) { // Clear container <audio> elements
      this.container.innerHTML = ''
    }
    delete this.socket;
    delete this.sendTransport;
    delete this.recvTransport;
    this.consumedProducers.clear();

    if(leavingUsers.length > 0) this.disconnect_callback?.(leavingUsers)
  }

  #rememberUsers(users: UserID[]): UserID[] {
    const joinedUsers: UserID[] = [];

    for (const user of users) {
      if (!user || this.connected_users.includes(user)) continue;

      this.connected_users.push(user);
      joinedUsers.push(user);
    }

    return joinedUsers;
  }

  #forgetUsers(users: UserID[]): UserID[] {
    const leavingUsers: UserID[] = [];

    for (const user of users) {
      const index = this.connected_users.findIndex(connectedUser => connectedUser === user);
      if(index === -1) continue;

      this.connected_users.splice(index, 1)
      leavingUsers.push(user)
    }

    return leavingUsers;
  }

  #startVoiceActivityMonitor(userId: UserID | null, stream: MediaStream, monitorKey: string) {
    if (!userId || this.voiceActivityMonitors.has(monitorKey)) return;

    const AudioContextConstructor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor() as AudioContext;
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.25;

    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    void context.resume().catch(() => undefined);

    const monitor: VoiceActivityMonitor = {
      userId,
      context,
      intervalId: 0,
      source,
      analyser,
      data: new Uint8Array(new ArrayBuffer(analyser.fftSize)),
      speaking: false,
      quietFrames: 0,
    };

    monitor.intervalId = window.setInterval(() => {
      analyser.getByteTimeDomainData(monitor.data);

      let sumSquares = 0;
      for (const sample of monitor.data) {
        const centeredSample = (sample - 128) / 128;
        sumSquares += centeredSample * centeredSample;
      }

      const rms = Math.sqrt(sumSquares / monitor.data.length);
      const isLoud = rms > SPEAKING_RMS_THRESHOLD;

      if (isLoud) {
        monitor.quietFrames = 0;
      } else {
        monitor.quietFrames += 1;
      }

      const isSpeaking = isLoud || (monitor.speaking && monitor.quietFrames < QUIET_FRAMES_BEFORE_INACTIVE);
      if (monitor.speaking === isSpeaking) return;

      monitor.speaking = isSpeaking;
      this.#refreshUserSpeakingState(userId);
    }, 100);

    this.voiceActivityMonitors.set(monitorKey, monitor);

    const monitorKeys = this.userActivityMonitorKeys.get(userId) ?? new Set<string>();
    monitorKeys.add(monitorKey);
    this.userActivityMonitorKeys.set(userId, monitorKeys);
  }

  #stopVoiceActivityMonitor(monitorKey: string) {
    const monitor = this.voiceActivityMonitors.get(monitorKey);
    if (!monitor) return;

    window.clearInterval(monitor.intervalId);
    monitor.source.disconnect();
    void monitor.context.close().catch(() => undefined);
    this.voiceActivityMonitors.delete(monitorKey);

    const monitorKeys = this.userActivityMonitorKeys.get(monitor.userId);
    monitorKeys?.delete(monitorKey);

    if (!monitorKeys || monitorKeys.size === 0) {
      this.userActivityMonitorKeys.delete(monitor.userId);
    }

    this.#refreshUserSpeakingState(monitor.userId);
  }

  #stopAllVoiceActivityMonitors() {
    for (const monitorKey of Array.from(this.voiceActivityMonitors.keys())) {
      this.#stopVoiceActivityMonitor(monitorKey);
    }

    if (this.speaking_users.size > 0) {
      this.speaking_users.clear();
      this.speaking_callback?.([]);
    }
  }

  #refreshUserSpeakingState(userId: UserID) {
    const monitorKeys = this.userActivityMonitorKeys.get(userId);
    const isSpeaking = Array.from(monitorKeys ?? []).some(monitorKey => {
      return this.voiceActivityMonitors.get(monitorKey)?.speaking;
    });

    if (isSpeaking) {
      if (this.speaking_users.has(userId)) return;
      this.speaking_users.add(userId);
    } else {
      if (!this.speaking_users.delete(userId)) return;
    }

    this.speaking_callback?.(Array.from(this.speaking_users));
  }

  async #consumeProducer(producerId: string, userId: UserID) {
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
    this.#startVoiceActivityMonitor(userId, stream, consumer.id);

    // Signal server that we're ready -- it will resume the consumer
    const { error } = await this.socket!.emitWithAck('resumeConsumer', { consumerId: consumer.id });
    if (error) {
      console.error('Failed to resume consumer:', error);
    }

    // No transport close event. The elements are removed during our disconnect procedure

  }

  async #publishLocalMedia(thisUserID: UserID | null) {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    this.localMediaStream = stream;
    this.#startVoiceActivityMonitor(thisUserID, stream, "local");

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

(window as any).voiceConnection = voiceConnection;
(window as any).VoiceClient = voiceConnection;
