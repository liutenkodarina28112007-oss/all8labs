/// <reference lib="webworker" />
self.onmessage=(event:MessageEvent<{positions:Float32Array}>)=>{const p=event.data.positions;for(let i=0;i<p.length;i+=2){p[i]=(p[i]??0)+0.01;p[i+1]=(p[i+1]??0)+0.01}self.postMessage(p,[p.buffer])};
export {};
