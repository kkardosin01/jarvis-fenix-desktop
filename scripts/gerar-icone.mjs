// Gera os ícones do Jarvis Fênix com a identidade do site: fênix dourada sobre preto.
// Fonte: assets/fenix-emblema.png (mesmo emblema de comercial-fenix/public/brand).
// Saída: build/icon.png (512), build/icon.ico (16–256), resources/icon.png (256),
//        resources/tray.png (32) e resources/tray@2x.png (64) — a bandeja usa só a fênix, sem fundo.
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const FUNDO = '#0a0a0a'
const EMBLEMA = 'assets/fenix-emblema.png'

async function icone(tam, fracao, { cantos = 0.2, fundo = true } = {}) {
  const largura = Math.max(1, Math.round(tam * fracao))
  const emblema = await sharp(EMBLEMA).trim().resize({ width: largura, height: largura, fit: 'inside' }).toBuffer({ resolveWithObject: true })
  const left = Math.round((tam - emblema.info.width) / 2)
  const top = Math.round((tam - emblema.info.height) / 2 - (fundo ? tam * 0.02 : 0))
  const camadas = [{ input: emblema.data, left, top }]
  if (fundo && cantos) {
    const r = Math.round(tam * cantos)
    camadas.push({ input: Buffer.from(`<svg width="${tam}" height="${tam}"><rect width="${tam}" height="${tam}" rx="${r}" fill="#fff"/></svg>`), blend: 'dest-in' })
  }
  const base = sharp({ create: { width: tam, height: tam, channels: 4, background: fundo ? FUNDO : { r: 0, g: 0, b: 0, alpha: 0 } } })
  return base.composite(camadas).png().toBuffer()
}

/** .ico com PNGs embutidos (aceito pelo Windows Vista em diante e pelo electron-builder). */
function ico(imagens) {
  const cab = Buffer.alloc(6)
  cab.writeUInt16LE(0, 0)
  cab.writeUInt16LE(1, 2)
  cab.writeUInt16LE(imagens.length, 4)
  let offset = 6 + 16 * imagens.length
  const entradas = imagens.map(({ tam, png }) => {
    const e = Buffer.alloc(16)
    e[0] = tam >= 256 ? 0 : tam
    e[1] = tam >= 256 ? 0 : tam
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    return e
  })
  return Buffer.concat([cab, ...entradas, ...imagens.map((i) => i.png)])
}

mkdirSync('build', { recursive: true })
mkdirSync('resources', { recursive: true })
writeFileSync('build/icon.png', await icone(512, 0.8))
// Nos tamanhos pequenos o emblema ocupa mais espaço para continuar legível
const tamanhos = [16, 24, 32, 48, 64, 128, 256]
writeFileSync('build/icon.ico', ico(await Promise.all(tamanhos.map(async (t) => ({ tam: t, png: await icone(t, t <= 32 ? 0.94 : 0.82, { cantos: t <= 32 ? 0.15 : 0.2 }) })))))
writeFileSync('resources/icon.png', await icone(256, 0.8))
writeFileSync('resources/tray.png', await icone(32, 0.98, { fundo: false }))
writeFileSync('resources/tray@2x.png', await icone(64, 0.98, { fundo: false }))
console.log('Ícones gerados.')
