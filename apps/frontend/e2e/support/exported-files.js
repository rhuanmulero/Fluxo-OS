import zlib from 'node:zlib';

// Sem dependência nova só para ler um .docx num teste: um .docx é um zip, e o
// Node já traz `zlib` para inflar o DEFLATE das entradas. Lê o End Of Central
// Directory, percorre a central directory até achar a entrada pedida e
// devolve seus bytes já descomprimidos.
export function readZipEntry(buffer, entryName) {
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_DIR_SIGNATURE = 0x02014b50;

  let eocdOffset = -1;

  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error('EOCD não encontrado: arquivo não parece um zip válido.');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error('Assinatura de central directory inválida.');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);

    if (name === entryName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const raw = buffer.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) return raw;
      if (compressionMethod === 8) return zlib.inflateRawSync(raw);

      throw new Error(`Método de compressão não suportado: ${compressionMethod}`);
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`Entrada não encontrada no zip: ${entryName}`);
}

// jsPDF, por padrão (sem `compress: true`), grava o content stream sem
// filtro — dá pra ler os operadores `Tj` direto dos bytes crus como latin1,
// a mesma técnica usada na verificação manual desta task.
export function pdfTextStrings(buffer) {
  const text = buffer.toString('latin1');
  const matches = [...text.matchAll(/\((?:[^()\\]|\\.)*\)\s*Tj/g)];

  return matches.map((match) => match[0].slice(1, match[0].lastIndexOf(')')));
}

export async function bufferOf(file) {
  const stream = await file.createReadStream();
  const chunks = [];

  for await (const chunk of stream) chunks.push(chunk);

  return Buffer.concat(chunks);
}

