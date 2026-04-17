# Peer to Peer voice/video chat
by Ethan Goode

## Description
This experiment was an attempt at a client/server SFU architecture for voice and video.

## Results

This experiment was queued up and awaiting a README update before I posted it, but it looks like we're going with
 mediasoup instead. Because of that, I'll keep this brief. It was a bit of a headache due to me not reading the WebRTC
 documentation (whichever side wishes to add a new stream must also initiate re-negotiation), and some issues that 
 occurred with firefox browser not displaying an iPhone video stream that I didn't look into.

To test this yourself, first edit the HOST line in main.ts to be either localhost or your IP address, then do the compilation
 steps (`npm ci` and `tsc` or `npx tsc`), and finally `node build/main.ts`. Open up multiple browser tabs (they can be on separate 
 devices) and navigate to `https://{localhost-or-host-ip}:3000/`. Click the "sender" button in all of them, and you
 should be presented with a janky conference call.



## Resources:
[Article describing NodeJS WebRTC SFU servers] (https://cloudinary.com/guides/live-streaming-video/node-js-webrtc-video-stream)

[Mozilla WebRTC documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
