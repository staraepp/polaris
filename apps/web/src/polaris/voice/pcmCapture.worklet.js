// Polaris voice capture: forwards mono Float32 frames to the main thread.
// Served as a same-origin asset so the app's script-src policy allows it.
class PolarisPcmCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    // A worklet's MessagePort has no target origin to pass.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    if (channel && channel.length > 0) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor("polaris-pcm-capture", PolarisPcmCapture);
