import {mkdir, writeFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';

const root = new URL('../assets/', import.meta.url);
await mkdir(root, {recursive:true});
const crcTable = Array.from({length:256}, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function chunk(type, data) {
  const name = Buffer.from(type);
  const payload = Buffer.concat([name,data]);
  let crc = 0xffffffff;
  for (const byte of payload) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length,0); name.copy(out,4); data.copy(out,8); out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, data.length + 8);
  return out;
}
function inside(poly,x,y) {
  let found = false;
  for (let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const [xi,yi]=poly[i], [xj,yj]=poly[j];
    if ((yi>y)!==(yj>y) && x<(xj-xi)*(y-yi)/(yj-yi)+xi) found=!found;
  }
  return found;
}
const shield = [[.5,.18],[.75,.29],[.73,.58],[.66,.72],[.5,.83],[.34,.72],[.27,.58],[.25,.29]];
const inner = [[.5,.25],[.68,.33],[.66,.57],[.61,.66],[.5,.74],[.39,.66],[.34,.57],[.32,.33]];
const check = [[.36,.52],[.44,.60],[.62,.42],[.66,.47],[.44,.67],[.32,.56]];
function color(x,y) {
  const radius=.18, cx=Math.max(radius,Math.min(1-radius,x)), cy=Math.max(radius,Math.min(1-radius,y));
  if ((x-cx)**2+(y-cy)**2>radius**2) return [0,0,0,0];
  if (inside(check,x,y)) return [255,255,255,255];
  if (inside(inner,x,y)) return [22,91,206,255];
  if (inside(shield,x,y)) return [255,255,255,255];
  return [22,91,206,255];
}
function png(size) {
  const raw=Buffer.alloc((size*4+1)*size);
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const samples=[[-.25,-.25],[.25,-.25],[-.25,.25],[.25,.25]];
    const mixed=[0,0,0,0];
    for(const [dx,dy] of samples) { const rgba=color((x+.5+dx)/size,(y+.5+dy)/size); rgba.forEach((v,i)=>mixed[i]+=v/4); }
    const offset=y*(size*4+1)+1+x*4;
    for(let i=0;i<4;i++) raw[offset+i]=Math.round(mixed[i]);
  }
  const header=Buffer.alloc(13); header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const size of [16,48,128]) await writeFile(new URL(`../assets/icon${size}.png`,import.meta.url),png(size));
console.log('Created BrowserGuard icons.');
