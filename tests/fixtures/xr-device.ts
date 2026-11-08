// TEST ONLY: inject a Meta IWER device before the app loads. Never shipped to users.
import { XRDevice, metaQuest3 } from 'iwer';
const device = new XRDevice(metaQuest3, { stereoEnabled: false });
device.installRuntime({ forceInstall: true, polyfillLayers: false });
device.primaryInputMode = 'hand';
device.controllers.left!.connected = false;
device.controllers.right!.connected = false;
device.hands.left!.connected = false;
device.hands.right!.poseId = 'open';
device.hands.right!.position.set(0.38, 1.25, -0.25);
(window as unknown as { __xr: XRDevice }).__xr = device;

// IWER re-parents the application canvas; show its full XR framebuffer, not the desktop CSS size.
window.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent =
    '[data-webxr_runtime]{background:#e8ecdf}[data-webxr_runtime] canvas{width:100vw!important;height:100vh!important}';
  document.head.appendChild(style);
});
