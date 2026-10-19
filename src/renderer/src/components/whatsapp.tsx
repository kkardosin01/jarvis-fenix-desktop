import { Copy, MessageCircle } from 'lucide-react'
import { normalizarTelefone } from '../../../shared/whatsapp'
import { mensagemErro, useJarvis } from '../lib/estado'
import { Botao } from './ui'

export function BotaoWhatsApp({ telefone, mensagem, compacto }: { telefone: string; mensagem: string; compacto?: boolean }) {
  const { mostrarAviso } = useJarvis()
  const valido = !!normalizarTelefone(telefone)
  const abrir = async (web: boolean): Promise<void> => {
    try {
      const como = await window.jarvis.abrirWhatsApp(telefone, mensagem, web)
      mostrarAviso(como === 'app' ? 'Abrindo o WhatsApp…' : 'Abrindo o WhatsApp no navegador…')
    } catch (e) {
      mostrarAviso(mensagemErro(e))
    }
  }
  return (
    <div className="flex items-center gap-2">
      <Botao
        variante="primario"
        disabled={!valido}
        title={valido ? 'Abrir no WhatsApp' : 'Telefone inválido'}
        onClick={() => void abrir(false)}
        icone={<MessageCircle className="size-5" aria-hidden />}
      >
        {compacto ? 'WhatsApp' : 'Abrir no WhatsApp'}
      </Botao>
      {!compacto && (
        <button
          type="button"
          disabled={!valido}
          onClick={() => void abrir(true)}
          className="cursor-pointer text-sm text-suave underline disabled:opacity-50"
        >
          pelo navegador
        </button>
      )}
    </div>
  )
}

export function BotaoCopiar({ texto, rotulo, aviso }: { texto: string; rotulo: string; aviso: string }) {
  const { mostrarAviso } = useJarvis()
  return (
    <Botao
      onClick={() => void window.jarvis.copiar(texto).then(() => mostrarAviso(aviso))}
      icone={<Copy className="size-5" aria-hidden />}
    >
      {rotulo}
    </Botao>
  )
}
