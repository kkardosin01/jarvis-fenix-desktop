// E-mails FICTÍCIOS para os testes (nomes, valores e códigos inventados).

import { formatarComPontos, gerarLinhaArrecadacao, gerarLinhaBancaria, gerarPdf, gerarPix } from './gerador'

export function mime(opts: {
  de: string
  para?: string
  assunto: string
  corpo: string
  id: string
  data?: string
  pdf?: { nome: string; conteudo: Buffer }
}): Buffer {
  const cab = [
    `From: ${opts.de}`,
    `To: ${opts.para ?? 'Pessoa Teste <pessoa.teste@exemplo.com>'}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.assunto).toString('base64')}?=`,
    `Message-ID: ${opts.id}`,
    `Date: ${opts.data ?? 'Mon, 19 Oct 2026 10:00:00 -0300'}`,
    'MIME-Version: 1.0'
  ]
  const corpoB64 = Buffer.from(opts.corpo).toString('base64')
  if (!opts.pdf) {
    return Buffer.from(
      [...cab, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', corpoB64, ''].join('\r\n')
    )
  }
  const b = 'LIMITE-FICTICIO'
  return Buffer.from(
    [
      ...cab,
      `Content-Type: multipart/mixed; boundary="${b}"`,
      '',
      `--${b}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      corpoB64,
      `--${b}`,
      `Content-Type: application/pdf; name="${opts.pdf.nome}"`,
      `Content-Disposition: attachment; filename="${opts.pdf.nome}"`,
      'Content-Transfer-Encoding: base64',
      '',
      opts.pdf.conteudo.toString('base64').replace(/(.{76})/g, '$1\r\n'),
      `--${b}--`,
      ''
    ].join('\r\n')
  )
}

export const linhaLuz = gerarLinhaArrecadacao(23010)
export const linhaCondominio = gerarLinhaBancaria({ vencimento: '2026-10-22', centavos: 85000 })
export const linhaFutura = gerarLinhaBancaria({ vencimento: '2026-11-30', centavos: 12000 })
export const linhaFenix = gerarLinhaBancaria({ vencimento: '2026-10-21', centavos: 134000 })
export const pixEscola = gerarPix('financeiro@escola-ficticia.com.br', '450.00')

/** Boleto de condomínio com a linha digitável só no PDF. */
export const emailCondominio = mime({
  de: 'Administradora Exemplo <cobranca@administradora-exemplo.com.br>',
  assunto: 'Boleto do condomínio - outubro',
  corpo: 'Prezado condômino,\nsegue em anexo o boleto do mês.\nAtenciosamente.',
  id: '<condominio-001@exemplo>',
  pdf: {
    nome: 'boleto.pdf',
    conteudo: gerarPdf([
      'Beneficiario: Condominio Residencial Exemplo CNPJ 00.000.000/0001-00',
      'Pagador: Pessoa Teste',
      'Vencimento: 22/10/2026',
      'Valor do documento: R$ 850,00',
      formatarComPontos(linhaCondominio)
    ])
  }
})

/** Conta de luz (arrecadação) com vencimento no texto. */
export const emailLuz = mime({
  de: 'Energia Fictícia <fatura@energia-ficticia.com.br>',
  assunto: 'Sua conta de luz chegou',
  corpo: `Olá! Sua fatura de outubro está disponível.\nData de vencimento: 19/10/2026\nTotal a pagar: R$ 230,10\nCódigo de barras: ${linhaLuz}`,
  id: '<luz-002@exemplo>'
})

/** Mensalidade com PIX copia-e-cola. */
export const emailEscola = mime({
  de: '"Escola Fictícia" <financeiro@escola-ficticia.com.br>',
  assunto: 'Mensalidade de outubro',
  corpo: `Segue a mensalidade.\nVence em 25/10/2026.\nPIX copia e cola:\n${pixEscola}`,
  id: '<escola-003@exemplo>'
})

export const emailPropaganda = mime({
  de: 'Loja <marketing@loja-ficticia.com.br>',
  assunto: 'Promoção imperdível: cartão com anuidade zero!',
  corpo: 'Aproveite a oferta do nosso cartão. Pague o boleto da primeira compra com desconto.',
  id: '<promo-004@exemplo>'
})

export const emailComprovante = mime({
  de: 'Banco Fictício <avisos@banco-ficticio.com.br>',
  assunto: 'Comprovante de pagamento de boleto',
  corpo: 'Seu pagamento foi realizado. Vencimento 15/10/2026. Valor R$ 99,90.',
  id: '<comprovante-005@exemplo>'
})

/** Boleto que a própria Fênix emitiu para um cliente (cópia recebida): não é conta a pagar. */
export const emailFenixCliente = mime({
  de: 'Sistema de Cobrança <boletos@banco-ficticio.com.br>',
  assunto: 'Boleto emitido',
  corpo: `Beneficiário: Comercial Fênix SC Ltda\nPagador: Clínica Fictícia\nVencimento: 21/10/2026\n${formatarComPontos(linhaFenix)}`,
  id: '<fenix-006@exemplo>'
})

/** Fatura de cartão com PDF protegido por senha (só sabemos o vencimento pelo corpo). */
export const emailCartao = mime({
  de: 'Cartão Fictício <fatura@cartao-ficticio.com.br>',
  assunto: 'Fatura do cartão disponível',
  corpo: 'Sua fatura fecha hoje.\nVencimento: 26/10/2026\nA senha do PDF são os 5 primeiros dígitos do seu CPF.',
  id: '<cartao-007@exemplo>',
  pdf: { nome: 'fatura.pdf', conteudo: Buffer.from('%PDF-1.4\nnao e um pdf de verdade') }
})

/** Boleto com vencimento daqui a 6 semanas: guardado para depois. */
export const emailFuturo = mime({
  de: 'Seguradora Fictícia <cobranca@seguradora-ficticia.com.br>',
  assunto: 'Boleto do seguro',
  corpo: `Linha digitável: ${formatarComPontos(linhaFutura)}`,
  id: '<futuro-008@exemplo>'
})
