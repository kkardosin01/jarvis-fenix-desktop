// Gera o ícone do Jarvis Fênix (quadrado verde-petróleo com "F" branco), legível em 16 px.
// Saída: build/icon.png (512), build/icon.ico (16–256), resources/icon.png (256), resources/tray.png (32), resources/tray@2x.png (64)
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const FUNDO = [15, 92, 86] // #0F5C56
const LETRA = [255, 255, 255]
const DESTAQUE = [245, 158, 11] // âmbar (chama)

function crc32(buf) {
  let c
  const tabela = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = tabela[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(tipo, dados) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(dados.length)
  const td = Buffer.concat([Buffer.from(tipo), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function png(tam, pixel) {
  const linhas = []
  for (let y = 0; y < tam; y++) {
    const l = Buffer.alloc(1 + tam * 4)
    for (let x = 0; x < tam; x++) {
      const [r, g, b, a] = pixel(x, y, tam)
      l.set([r, g, b, a], 1 + x * 4)
    }
    linhas.push(l)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(tam, 0)
  ihdr.writeUInt32BE(tam, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(linhas), { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** Cor do ponto (u, v) em coordenadas 0–1, sem antisserrilhado. */
function amostra(u, v) {
  // Quadrado com cantos arredondados
  const r = 0.2
  const dx = Math.max(r - u, 0, u - (1 - r))
  const dy = Math.max(r - v, 0, v - (1 - r))
  if (dx * dx + dy * dy > r * r) return null
  // "F" grosso
  const haste = u >= 0.28 && u <= 0.45 && v >= 0.14 && v <= 0.7
  const topo = u >= 0.28 && u <= 0.74 && v >= 0.14 && v <= 0.29
  const meio = u >= 0.28 && u <= 0.64 && v >= 0.37 && v <= 0.5
  if (haste || topo || meio) return LETRA
  // Faixa âmbar na base (a "chama" da Fênix)
  if (v >= 0.77 && v <= 0.87 && u >= 0.28 && u <= 0.74) return DESTAQUE
  return FUNDO
}

function pixel(x, y, tam) {
  // Supersampling 4x4 para bordas suaves
  let r = 0
  let g = 0
  let b = 0
  let a = 0
  const n = 4
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = amostra((x + (i + 0.5) / n) / tam, (y + (j + 0.5) / n) / tam)
      if (c) {
        r += c[0]
        g += c[1]
        b += c[2]
        a += 255
      }
    }
  }
  const t = n * n
  const alfa = a / t
  return alfa === 0 ? [0, 0, 0, 0] : [Math.round(r / (a / 255)), Math.round(g / (a / 255)), Math.round(b / (a / 255)), Math.round(alfa)]
}

function ico(tamanhos) {
  const imagens = tamanhos.map((t) => png(t, pixel))
  const cab = Buffer.alloc(6)
  cab.writeUInt16LE(0, 0)
  cab.writeUInt16LE(1, 2)
  cab.writeUInt16LE(imagens.length, 4)
  const entradas = []
  let offset = 6 + 16 * imagens.length
  imagens.forEach((img, i) => {
    const e = Buffer.alloc(16)
    const t = tamanhos[i]
    e[0] = t >= 256 ? 0 : t
    e[1] = t >= 256 ? 0 : t
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(img.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += img.length
    entradas.push(e)
  })
  return Buffer.concat([cab, ...entradas, ...imagens])
}

mkdirSync('build', { recursive: true })
mkdirSync('resources', { recursive: true })
writeFileSync('build/icon.png', png(512, pixel))
writeFileSync('build/icon.ico', ico([16, 24, 32, 48, 64, 128, 256]))
writeFileSync('resources/icon.png', png(256, pixel))
writeFileSync('resources/tray.png', png(32, pixel))
writeFileSync('resources/tray@2x.png', png(64, pixel))
console.log('Ícones gerados.')
