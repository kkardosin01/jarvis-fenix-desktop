import { AlertTriangle, CheckCircle2, FileKey2, FolderOpen, Pause, Play, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { NovaConta } from '../../../shared/esquemas'
import { tempoDesde } from 'jarvis-fenix-core/ptbr'
import type { Configuracoes, ContaEmailPublica, ContaPFPJ, TipoContaEmail } from 'jarvis-fenix-core/types'
import { Botao, Campo, Chip, Erro, Interruptor, Modal, Painel, classeEntrada, cx } from '../components/ui'
import { mensagemErro, useAcao, useAgora, useJarvis } from '../lib/estado'

const PROVEDORES: Record<Exclude<TipoContaEmail, 'outro'>, { servidor: string; porta: number }> = {
  gmail: { servidor: 'imap.gmail.com', porta: 993 },
  outlook: { servidor: 'outlook.office365.com', porta: 993 }
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <Painel className="p-6">
      <h3 className="text-xl font-bold">{titulo}</h3>
      {descricao && <p className="mt-1 text-base text-suave">{descricao}</p>}
      <div className="mt-4">{children}</div>
    </Painel>
  )
}

function Instrucoes({ tipo }: { tipo: TipoContaEmail }) {
  const abrir = (url: string) => () => void window.jarvis.abrirExterno(url)
  const link = (url: string, texto: string) => (
    <button type="button" onClick={abrir(url)} className="cursor-pointer font-semibold text-marca underline">
      {texto}
    </button>
  )
  if (tipo === 'gmail') {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-base">
        <li>Entre no Gmail pessoal pelo navegador.</li>
        <li>Abra {link('https://myaccount.google.com/signinoptions/twosv', 'Verificação em duas etapas')} e ative (é obrigatório para senha de app).</li>
        <li>Depois abra {link('https://myaccount.google.com/apppasswords', 'Senhas de app')}.</li>
        <li>Em “Nome do app”, escreva <strong>Jarvis Fênix</strong> e clique em <strong>Criar</strong>.</li>
        <li>O Google mostra 16 letras num quadro amarelo. Copie e cole no campo “Senha de app” aqui ao lado.</li>
        <li>Pronto. Essa senha só serve para o Jarvis ler e-mails; se quiser, dá para apagá-la depois no mesmo lugar.</li>
      </ol>
    )
  }
  if (tipo === 'outlook') {
    return (
      <ol className="list-decimal space-y-2 pl-5 text-base">
        <li>Entre na conta Microsoft (Outlook/Hotmail) pelo navegador.</li>
        <li>Abra {link('https://account.live.com/proofs/manage/additional', 'Opções de segurança avançadas')}.</li>
        <li>Ative a <strong>verificação em duas etapas</strong>, se ainda não estiver ligada.</li>
        <li>Na mesma página, em <strong>Senhas de aplicativo</strong>, clique em “Criar uma nova senha de aplicativo”.</li>
        <li>Copie a senha que aparece e cole no campo “Senha de app” aqui ao lado.</li>
        <li>
          Se a conta for do trabalho (Microsoft 365), a empresa precisa ter o IMAP liberado; se der erro, fale com quem cuida do e-mail.
        </li>
      </ol>
    )
  }
  return (
    <ul className="list-disc space-y-2 pl-5 text-base">
      <li>Peça ao provedor do e-mail os dados de <strong>IMAP</strong> (servidor e porta, normalmente 993).</li>
      <li>Use a senha do e-mail ou uma “senha de aplicativo”, se o provedor oferecer.</li>
      <li>O Jarvis só lê. Nunca envia, apaga ou marca e-mails como lidos.</li>
    </ul>
  )
}

function NovaContaModal({ aoFechar }: { aoFechar: () => void }) {
  const { setContas, mostrarAviso } = useJarvis()
  const [tipo, setTipo] = useState<TipoContaEmail>('gmail')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [servidor, setServidor] = useState(PROVEDORES.gmail.servidor)
  const [porta, setPorta] = useState(993)
  const [apelido, setApelido] = useState('Pessoal do Tulio')
  const [contaBoleto, setContaBoleto] = useState<ContaPFPJ>('PF')
  const [soConferencia, setSoConferencia] = useState(false)
  const [testeOk, setTesteOk] = useState(false)
  const eEmpresa = email.trim().toLowerCase() === 'fenix.hospitalares@gmail.com'

  const dados = (): NovaConta => ({
    tipo,
    email: email.trim(),
    senha: senha.replace(/\s+/g, tipo === 'gmail' ? '' : ' ').trim(),
    servidor: servidor.trim(),
    porta,
    apelido: apelido.trim(),
    contaBoleto,
    soConferencia: eEmpresa ? soConferencia : false
  })

  const teste = useAcao(async () => {
    setTesteOk(false)
    const r = await window.jarvis.contas.testar(dados())
    if (!r.ok) throw new Error(r.erro ?? 'Não conectou')
    setTesteOk(true)
  })
  const salvar = useAcao(async () => {
    setContas(await window.jarvis.contas.adicionar(dados()))
  })

  const escolherTipo = (t: TipoContaEmail): void => {
    setTipo(t)
    setTesteOk(false)
    if (t !== 'outro') {
      setServidor(PROVEDORES[t].servidor)
      setPorta(PROVEDORES[t].porta)
    } else setServidor('')
  }

  return (
    <Modal titulo="Adicionar conta de e-mail" aoFechar={aoFechar} largura="max-w-5xl">
      <div className="grid grid-cols-[1.1fr_1fr] gap-8">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void salvar.executar().then((ok) => {
              if (ok) {
                mostrarAviso('Conta adicionada. Procurando boletos…')
                aoFechar()
              }
            })
          }}
        >
          <div className="flex gap-2">
            {(['gmail', 'outlook', 'outro'] as const).map((t) => (
              <Chip key={t} ativo={tipo === t} onClick={() => escolherTipo(t)}>
                {t === 'gmail' ? 'Gmail' : t === 'outlook' ? 'Outlook / Hotmail' : 'Outro'}
              </Chip>
            ))}
          </div>
          <Campo rotulo="E-mail">
            <input type="email" required className={classeEntrada} value={email} onChange={(e) => (setEmail(e.target.value), setTesteOk(false))} placeholder="nome@gmail.com" />
          </Campo>
          {eEmpresa && (
            <div className="rounded-xl border border-alerta/40 bg-alerta-suave p-4 text-alerta">
              <p className="flex items-center gap-2 font-bold">
                <AlertTriangle className="size-5" aria-hidden /> Esta é a conta da empresa
              </p>
              <p className="mt-1 text-base">
                O resumo da nuvem já lê este e-mail todo dia. Adicionar aqui pode duplicar boletos.
              </p>
              <label className="mt-2 flex items-center gap-2 text-base font-semibold">
                <input type="checkbox" className="size-5" checked={soConferencia} onChange={(e) => setSoConferencia(e.target.checked)} />
                Ler só como conferência (não grava na planilha)
              </label>
            </div>
          )}
          <Campo rotulo={tipo === 'outro' ? 'Senha (ou senha de app)' : 'Senha de app'} dica="Fica guardada criptografada só neste computador.">
            <input type="password" required autoComplete="off" className={classeEntrada} value={senha} onChange={(e) => (setSenha(e.target.value), setTesteOk(false))} />
          </Campo>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Campo rotulo="Servidor IMAP">
              <input required className={classeEntrada} value={servidor} readOnly={tipo !== 'outro'} onChange={(e) => setServidor(e.target.value)} />
            </Campo>
            <Campo rotulo="Porta">
              <input type="number" required className={classeEntrada} value={porta} readOnly={tipo !== 'outro'} onChange={(e) => setPorta(Number(e.target.value))} />
            </Campo>
          </div>
          <Campo rotulo="Apelido" dica="Aparece na origem do boleto. Ex.: “E-mail Pessoal do Tulio”.">
            <input required className={classeEntrada} value={apelido} onChange={(e) => setApelido(e.target.value)} />
          </Campo>
          <div className="flex flex-col gap-1.5">
            <span className="text-base font-semibold">Boletos desta conta são da</span>
            <div className="flex gap-2">
              <Chip ativo={contaBoleto === 'PF'} onClick={() => setContaBoleto('PF')}>
                Pessoa física (PF)
              </Chip>
              <Chip ativo={contaBoleto === 'PJ'} onClick={() => setContaBoleto('PJ')}>
                Empresa (PJ)
              </Chip>
            </div>
          </div>
          {(teste.erro || salvar.erro) && <Erro texto={(teste.erro || salvar.erro)!} />}
          {testeOk && (
            <p className="flex items-center gap-2 rounded-xl bg-ok-suave px-4 py-3 font-semibold text-ok">
              <CheckCircle2 className="size-5" aria-hidden /> Conexão funcionando!
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Botao onClick={() => void teste.executar()} carregando={teste.ocupado} disabled={!email || !senha || !servidor}>
              Testar conexão
            </Botao>
            <Botao type="submit" variante="primario" carregando={salvar.ocupado} disabled={!testeOk}>
              Salvar conta
            </Botao>
          </div>
        </form>
        <aside className="rounded-2xl bg-superficie-2 p-5">
          <h4 className="mb-3 text-lg font-bold">
            {tipo === 'gmail' ? 'Como gerar a senha de app do Gmail' : tipo === 'outlook' ? 'Como gerar a senha de app do Outlook' : 'Outro provedor'}
          </h4>
          <Instrucoes tipo={tipo} />
        </aside>
      </div>
    </Modal>
  )
}

function LinhaContaEmail({ c }: { c: ContaEmailPublica }) {
  const { setContas, mostrarAviso } = useJarvis()
  const agora = useAgora()
  const [confirmando, setConfirmando] = useState(false)
  const agir = async (f: () => Promise<ContaEmailPublica[] | unknown>, aviso?: string): Promise<void> => {
    try {
      const r = await f()
      if (Array.isArray(r)) setContas(r as ContaEmailPublica[])
      if (aviso) mostrarAviso(aviso)
    } catch (e) {
      mostrarAviso(mensagemErro(e))
    }
  }
  return (
    <li className="flex items-center gap-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold">
          {c.apelido} <span className="text-base font-normal text-suave">· {c.email}</span>
        </p>
        <p className="text-base text-suave">
          {c.contaBoleto} · {c.sincronizando ? 'Sincronizando agora…' : `Última sincronização: ${tempoDesde(c.ultimaSincronizacao, agora)}`} ·{' '}
          {c.boletosAchados} {c.boletosAchados === 1 ? 'boleto achado' : 'boletos achados'}
          {c.pausada && ' · Pausada'}
          {c.soConferencia && ' · Só conferência'}
        </p>
        {c.erro && <p className="mt-1 text-base font-semibold text-perigo">{c.erro}</p>}
      </div>
      <Botao
        onClick={() => void agir(() => window.jarvis.contas.sincronizar(c.id), 'Sincronização concluída')}
        carregando={c.sincronizando}
        disabled={c.pausada}
        icone={<RefreshCw className="size-5" aria-hidden />}
      >
        Sincronizar agora
      </Botao>
      <Botao
        onClick={() => void agir(() => window.jarvis.contas.atualizar(c.id, { pausada: !c.pausada }))}
        icone={c.pausada ? <Play className="size-5" aria-hidden /> : <Pause className="size-5" aria-hidden />}
      >
        {c.pausada ? 'Retomar' : 'Pausar'}
      </Botao>
      {confirmando ? (
        <>
          <Botao variante="perigo" onClick={() => void agir(() => window.jarvis.contas.remover(c.id), 'Conta removida')}>
            Remover mesmo
          </Botao>
          <Botao variante="fantasma" onClick={() => setConfirmando(false)}>
            Cancelar
          </Botao>
        </>
      ) : (
        <Botao variante="perigo" onClick={() => setConfirmando(true)} icone={<Trash2 className="size-5" aria-hidden />}>
          Remover
        </Botao>
      )}
    </li>
  )
}

export function TelaConfiguracoes() {
  const { info, contas, recarregarInfo, mostrarAviso, atualizar } = useJarvis()
  const [adicionando, setAdicionando] = useState(false)
  const [chaveIA, setChaveIA] = useState('')
  const [token, setToken] = useState('')
  const [avisoIA, setAvisoIA] = useState(false)
  const [planilhaId, setPlanilhaId] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  if (!info) return null
  const c = info.config

  const salvar = async (p: Partial<Configuracoes>): Promise<void> => {
    setErro(null)
    try {
      await window.jarvis.config.salvar(p)
      await recarregarInfo()
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  const escolherChave = async (): Promise<void> => {
    setErro(null)
    try {
      const s = await window.jarvis.config.escolherContaServico()
      await recarregarInfo()
      if (s.contaServico) {
        mostrarAviso('Chave guardada. Lendo a planilha…')
        void atualizar()
      }
    } catch (e) {
      setErro(mensagemErro(e))
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 pb-10">
      <h2 className="text-2xl font-bold">Configurações</h2>
      {erro && <Erro texto={erro} />}
      {!info.segredos.criptografiaDisponivel && (
        <Erro texto="A criptografia do sistema não está disponível neste computador. Não é possível guardar senhas com segurança." />
      )}

      <Secao titulo="Contas de e-mail" descricao="O Jarvis lê só os e-mails com boletos destas contas (somente leitura) e grava os boletos na planilha.">
        {contas.length === 0 ? (
          <p className="py-2 text-lg text-suave">Nenhuma conta ainda. Adicione o e-mail pessoal para o Jarvis achar os boletos que chegam lá.</p>
        ) : (
          <ul className="divide-y divide-borda">
            {contas.map((x) => (
              <LinhaContaEmail key={x.id} c={x} />
            ))}
          </ul>
        )}
        <div className="mt-4 flex items-center gap-4">
          <Botao grande variante="primario" onClick={() => setAdicionando(true)} icone={<Plus className="size-6" aria-hidden />}>
            Adicionar conta
          </Botao>
          <p className="text-base text-suave">O e-mail da empresa (fenix.hospitalares@gmail.com) não precisa: a nuvem já lê.</p>
        </div>
      </Secao>

      <Secao titulo="Planilha Jarvis_Fenix" descricao="Conexão com o Google por uma conta de serviço (chave JSON).">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <FileKey2 className="size-8 text-marca" aria-hidden />
            <div className="flex-1">
              {info.segredos.contaServico ? (
                <>
                  <p className="text-lg font-semibold">Chave configurada</p>
                  <p className="text-base text-suave">
                    Compartilhe a planilha como <strong>Editor</strong> com: <span className="font-mono">{info.segredos.contaServico}</span>
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-alerta">Nenhuma chave escolhida ainda.</p>
              )}
            </div>
            <Botao onClick={() => void escolherChave()} variante={info.segredos.contaServico ? 'secundario' : 'primario'}>
              {info.segredos.contaServico ? 'Trocar chave' : 'Escolher arquivo da chave'}
            </Botao>
          </div>
          <Campo rotulo="ID da planilha">
            <div className="flex gap-3">
              <input className={cx(classeEntrada, 'font-mono')} value={planilhaId ?? c.planilhaId} onChange={(e) => setPlanilhaId(e.target.value)} />
              <Botao disabled={!planilhaId || planilhaId === c.planilhaId} onClick={() => void salvar({ planilhaId: planilhaId! }).then(() => setPlanilhaId(null))}>
                Salvar
              </Botao>
            </div>
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Funcionamento">
        <div className="divide-y divide-borda">
          <Interruptor rotulo="Iniciar com o Windows" dica="Abre sozinho em tela cheia quando o computador liga." ligado={c.iniciarComWindows} aoMudar={(v) => void salvar({ iniciarComWindows: v })} />
          <Interruptor rotulo="Manter a tela ligada" dica="Evita que o monitor apague enquanto o Jarvis está aberto." ligado={c.manterTelaLigada} aoMudar={(v) => void salvar({ manterTelaLigada: v })} />
          <Interruptor rotulo="Notificações do Windows" dica="Bom dia às 9h05, novos boletos e lembrete às 14h. Nunca entre 22h e 7h." ligado={c.notificacoes} aoMudar={(v) => void salvar({ notificacoes: v })} />
          <div className="flex items-center justify-between gap-6 py-3">
            <div>
              <p className="text-base font-semibold">Horário da busca de e-mails</p>
              <p className="text-sm text-suave">A cada 15 minutos dentro deste horário.</p>
            </div>
            <div className="flex items-center gap-2">
              <select className={cx(classeEntrada, 'w-24')} value={c.syncInicio} onChange={(e) => void salvar({ syncInicio: Number(e.target.value) })} aria-label="Início">
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
              <span>até</span>
              <select className={cx(classeEntrada, 'w-24')} value={c.syncFim} onChange={(e) => void salvar({ syncFim: Number(e.target.value) })} aria-label="Fim">
                {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                  <option key={h} value={h}>
                    {h}h
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-6 py-3">
            <p className="text-base font-semibold">Seu nome na saudação</p>
            <input className={cx(classeEntrada, 'w-64')} defaultValue={c.nome} onBlur={(e) => e.target.value.trim() && e.target.value !== c.nome && void salvar({ nome: e.target.value.trim() })} />
          </div>
        </div>
      </Secao>

      <Secao titulo="Aparência">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold">Tema</p>
            <div className="flex gap-2">
              {(['sistema', 'claro', 'escuro'] as const).map((t) => (
                <Chip key={t} ativo={c.tema === t} onClick={() => void salvar({ tema: t })}>
                  {t === 'sistema' ? 'Igual ao Windows' : t === 'claro' ? 'Claro' : 'Escuro'}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold">Tamanho da letra</p>
            <div className="flex gap-2">
              {(['normal', 'grande', 'muito-grande'] as const).map((t) => (
                <Chip key={t} ativo={c.tamanhoFonte === t} onClick={() => void salvar({ tamanhoFonte: t })}>
                  {t === 'normal' ? 'Normal' : t === 'grande' ? 'Grande' : 'Muito grande'}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </Secao>

      <Secao titulo="Leitura de boletos com IA (opcional)" descricao="Ajuda quando o boleto vem num formato difícil. Desligada por padrão.">
        <Interruptor
          rotulo="Usar IA nos casos difíceis"
          dica={info.segredos.chaveIA ? 'Chave da Anthropic configurada.' : 'Precisa de uma chave da API da Anthropic.'}
          ligado={c.iaAtiva}
          aoMudar={(v) => {
            if (v) setAvisoIA(true)
            else void salvar({ iaAtiva: false })
          }}
        />
        {avisoIA && (
          <div className="mt-2 rounded-xl border border-alerta/40 bg-alerta-suave p-4 text-alerta">
            <p className="font-bold">Atenção: o texto desses e-mails será enviado à API da Anthropic</p>
            <p className="mt-1 text-base">
              Só o texto do e-mail ou PDF que parece um boleto, e só quando as regras automáticas não conseguirem ler. A caixa de entrada nunca é enviada
              inteira. Há um custo pequeno por uso, cobrado na conta da Anthropic.
            </p>
            <div className="mt-3 flex gap-3">
              <Botao variante="primario" onClick={() => void salvar({ iaAtiva: true }).then(() => setAvisoIA(false))}>
                Entendi, ativar
              </Botao>
              <Botao variante="fantasma" onClick={() => setAvisoIA(false)}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
        <div className="mt-3 grid grid-cols-[1fr_16rem] gap-4">
          <Campo rotulo="Chave da API da Anthropic" dica="Guardada criptografada neste computador.">
            <div className="flex gap-3">
              <input type="password" autoComplete="off" className={classeEntrada} placeholder={info.segredos.chaveIA ? '••••••• (já configurada)' : 'sk-ant-…'} value={chaveIA} onChange={(e) => setChaveIA(e.target.value)} />
              <Botao
                disabled={!chaveIA}
                onClick={() =>
                  void window.jarvis.config
                    .salvarChaveIA(chaveIA)
                    .then(() => (setChaveIA(''), recarregarInfo(), mostrarAviso('Chave guardada')))
                    .catch((e) => setErro(mensagemErro(e)))
                }
              >
                Salvar
              </Botao>
              {info.segredos.chaveIA && (
                <Botao variante="perigo" onClick={() => void window.jarvis.config.salvarChaveIA(null).then(() => recarregarInfo())}>
                  Apagar
                </Botao>
              )}
            </div>
          </Campo>
          <Campo rotulo="Modelo" dica="Rápido e barato.">
            <input className={cx(classeEntrada, 'font-mono')} defaultValue={c.iaModelo} onBlur={(e) => e.target.value !== c.iaModelo && void salvar({ iaModelo: e.target.value.trim() })} />
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Atualizações e suporte">
        <div className="flex flex-col gap-4">
          <Campo rotulo="Token de atualização (GitHub)" dica="Só leitura do repositório de versões. Configurado uma vez pelo Pedro.">
            <div className="flex gap-3">
              <input type="password" autoComplete="off" className={classeEntrada} value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" />
              <Botao disabled={!token} onClick={() => void window.jarvis.config.salvarTokenAtualizacao(token).then(() => (setToken(''), mostrarAviso('Token guardado')))}>
                Salvar
              </Botao>
            </div>
          </Campo>
          <div className="flex items-center justify-between">
            <p className="text-base text-suave">
              Versão {info.versao} · dados em <span className="font-mono text-sm">{info.pastaDados}</span>
            </p>
            <Botao onClick={() => void window.jarvis.abrirLogs()} icone={<FolderOpen className="size-5" aria-hidden />}>
              Abrir pasta de logs
            </Botao>
          </div>
        </div>
      </Secao>

      {adicionando && <NovaContaModal aoFechar={() => setAdicionando(false)} />}
    </div>
  )
}
