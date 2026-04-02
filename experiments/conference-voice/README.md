# Peer to Peer voice/video chat
by Ethan Goode

## Description
The experiment was to set up a single WebRTC signalling server + client so that two devices (or browser tabs) could exchange data.

## Results
I've heard terrible things about WebRTC, but I am happy to report that it has been (so far) nearly hassle-free. To test
 it yourself, first edit the HOST line in main.ts to be either localhost or your IP address, then do the compilation
 steps (`tsc` or `npx tsc`), and finally `node build/main.ts`. Open up two browser tabs (they can be on separate devices)
 and navigate to `https://{localhost-or-host-ip}:3000/`. Click the "sender" button in one tab and the "receiver" button
 in the other. It doesn't have much effect on the call, it just controls who initiates the connection.

## Notes:
 - This is for peer to peer on a local network only. The conference-style calls we will eventually implement will
 likely require the server to function as one of the peers, before collecting the audio/video tracks and relaying them
 to the other participants (i.e. as an SFU).

 - Communicating over sockets hosted by an HTTPS endpoint requires that the sockets also be secure. This was relatively
 easy to implement here because we could reuse the certificates used by express. This may present a problem in the future.

 - The awaiting-retry logic here is very crude and is a byproduct of the signaling server not caching responses (i.e.
 if the sender attempts to call without a designated receiver, the signaling server drops the offer and the sender hangs).

## Resources:
[Article describing NodeJS WebRTC SFU servers] (https://cloudinary.com/guides/live-streaming-video/node-js-webrtc-video-stream)

[Mozilla WebRTC documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)