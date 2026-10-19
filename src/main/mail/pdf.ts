// Texto de anexos PDF com pdfjs-dist (JS puro, sem módulos nativos).

const MAX_PAGINAS = 6

export interface TextoPdf {
  texto: string
  ilegivel: boolean
}

export async function textoDoPdf(conteudo: Uint8Array | Buffer): Promise<TextoPdf> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Cópia: o pdfjs transfere o buffer para o worker
  const data = new Uint8Array(conteudo)
  try {
    const doc = await pdfjs.getDocument({
      data,
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      verbosity: 0
    }).promise
    const partes: string[] = []
    const paginas = Math.min(doc.numPages, MAX_PAGINAS)
    for (let p = 1; p <= paginas; p++) {
      const pagina = await doc.getPage(p)
      const conteudoTexto = await pagina.getTextContent()
      let linha = ''
      for (const item of conteudoTexto.items) {
        if (!('str' in item)) continue
        linha += item.str
        if (item.hasEOL) {
          partes.push(linha)
          linha = ''
        } else linha += ' '
      }
      if (linha.trim()) partes.push(linha)
    }
    await doc.destroy()
    return { texto: partes.join('\n'), ilegivel: false }
  } catch {
    // PDF com senha (comum em faturas de cartão) ou corrompido
    return { texto: '', ilegivel: true }
  }
}
