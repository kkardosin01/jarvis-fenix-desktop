/** "(048) 3283-2293" → "554832832293". Retorna null se não parecer telefone brasileiro. */
export function normalizarTelefone(telefone: string): string | null {
  let d = telefone.replace(/\D/g, '')
  if (!d) return null
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) d = d.slice(2)
  // Tira o 0 do DDD (ou de operadora "0XX")
  while (d.startsWith('0')) d = d.slice(1)
  if (d.length === 12 || d.length === 13) d = d.slice(2) // código de operadora: 0 21 48 ...
  if (d.length !== 10 && d.length !== 11) return null
  return `55${d}`
}

export function linksWhatsApp(telefone: string, mensagem: string): { app: string; web: string } | null {
  const numero = normalizarTelefone(telefone)
  if (!numero) return null
  const texto = encodeURIComponent(mensagem)
  return {
    app: `whatsapp://send?phone=${numero}&text=${texto}`,
    web: `https://wa.me/${numero}?text=${texto}`
  }
}
