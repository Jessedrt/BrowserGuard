// Builds deploy/browserguard-site.zip for drag-and-drop hosting (Netlify Drop,
// Cloudflare Pages upload, or emailing the site to a reviewer).
import {readdir, mkdir, readFile, writeFile} from 'node:fs/promises';
import {join, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = join(ROOT, 'site');
const OUT = join(ROOT, 'deploy', 'browserguard-site.zip');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const target = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

// Minimal ZIP writer: stored or deflated entries, no external dependencies.
const CRC_TABLE = Array.from({length: 256}, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xEDB88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc32(buffer) {
  let crc = 0xFFFFFFFF;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

const files = (await walk(SITE)).sort();
const locals = [];
const central = [];
let offset = 0;
for (const file of files) {
  const name = relative(SITE, file).split('\\').join('/');
  const data = await readFile(file);
  const deflated = deflateRawSync(data, {level: 9});
  const useDeflate = deflated.length < data.length;
  const payload = useDeflate ? deflated : data;
  const crc = crc32(data);
  const nameBytes = Buffer.from(name, 'utf8');
  const time = new Date();
  const dosTime = ((time.getHours() << 11) | (time.getMinutes() << 5) | (time.getSeconds() / 2)) & 0xFFFF;
  const dosDate = (((time.getFullYear() - 1980) << 9) | ((time.getMonth() + 1) << 5) | time.getDate()) & 0xFFFF;

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6);
  local.writeUInt16LE(useDeflate ? 8 : 0, 8);
  local.writeUInt16LE(dosTime, 10);
  local.writeUInt16LE(dosDate, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);
  locals.push(local, nameBytes, payload);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(useDeflate ? 8 : 0, 10);
  entry.writeUInt16LE(dosTime, 12);
  entry.writeUInt16LE(dosDate, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(payload.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(nameBytes.length, 28);
  entry.writeUInt16LE(0, 30);
  entry.writeUInt16LE(0, 32);
  entry.writeUInt16LE(0, 34);
  entry.writeUInt16LE(0, 36);
  entry.writeUInt32LE(0, 38);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, nameBytes);

  offset += local.length + nameBytes.length + payload.length;
}

const centralSize = central.reduce((total, buffer) => total + buffer.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(0, 4);
end.writeUInt16LE(0, 6);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);
end.writeUInt16LE(0, 20);

await mkdir(dirname(OUT), {recursive: true});
const zip = Buffer.concat([...locals, ...central, end]);
await writeFile(OUT, zip);
console.log(`Wrote ${relative(ROOT, OUT)} — ${files.length} files, ${(zip.length / 1024).toFixed(0)} KB`);
