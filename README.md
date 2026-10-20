# Jarvis Fênix — central de comando para Windows

Aplicativo que fica ligado 24 horas no computador do Tulio (Comercial Fênix SC Ltda). Ele mostra o painel do dia em tela cheia, lê os boletos que chegam nos **e-mails pessoais** e grava esses boletos na planilha **Jarvis_Fenix**, para aparecerem também no painel web e no celular.

O "cérebro" na nuvem continua igual: as duas tarefas agendadas (prospecção às 8h13 e briefing às 8h38) seguem reescrevendo a planilha. Este app **só escreve** nas abas `Boletos_Manual` e `Boletos_Outras_Contas`; as demais abas ele só lê.

---

## Sumário

1. [O que o app faz](#o-que-o-app-faz)
2. [Conectar a planilha (conta de serviço do Google)](#1-conectar-a-planilha-conta-de-serviço-do-google)
3. [Senha de app do Gmail pessoal](#2-senha-de-app-do-gmail-pessoal)
4. [Senha de app do Outlook / Hotmail](#3-senha-de-app-do-outlook--hotmail)
5. [Gerar o instalador e publicar uma versão](#4-gerar-o-instalador-e-publicar-uma-versão)
6. [Desenvolvimento](#desenvolvimento)
7. [Segurança e privacidade](#segurança-e-privacidade)
8. [Como funciona a leitura de boletos](#como-funciona-a-leitura-de-boletos)

---

## O que o app faz

| Tela | O que mostra |
|---|---|
| **Hoje** | Frase do dia, 5 cartões (vencem hoje, atrasados, clientes para ligar, e-mails importantes, rascunhos), prioridades, próximas contas e "ligar hoje". Cabe em 1920×1080 sem rolar. |
| **Contas a pagar** | Junta `Boletos` + `Boletos_Outras_Contas` + `Boletos_Manual` (não pagos). Filtros PJ/PF e origem, copiar linha digitável/PIX, abrir o e-mail, marcar como pago, lançar boleto, totais por dia e PF/PJ. |
| **Clientes** | Aba `Contatos` com WhatsApp (app ou navegador) e "copiar mensagem". |
| **E-mails** | Aba `Emails` por urgência, filtro por categoria e atalho para o Gmail da empresa. |
| **Prospecção** | Aba `Prospects` e atalho para os rascunhos no Gmail. |
| **Configurações** | Contas de e-mail, chave do Google, ID da planilha, IA opcional, início com o Windows, tela ligada, horários, notificações, tema e tamanho da letra. |

Funcionamento 24/7:

- Abre sozinho com o Windows, já em tela cheia (F11 alterna; Esc sai).
- Fica na bandeja (perto do relógio): **Abrir · Atualizar agora · Sincronizar e-mails agora · Modo tela cheia · Sair**. Fechar a janela só esconde.
- Relê a planilha a cada 5 minutos e sempre que a janela ganha foco.
- Busca boletos nos e-mails a cada 15 minutos, das 6h às 23h (ajustável).
- Sem internet, mostra os últimos dados salvos com o aviso "Sem conexão — mostrando dados de HH:MM".
- Notificações: bom dia às 9h05 (tenta de novo às 9h35 se o resumo ainda não chegou), novo boleto encontrado e lembrete às 14h se ainda houver conta vencendo hoje. Nunca entre 22h e 7h.

---

## 1. Conectar a planilha (conta de serviço do Google)

A conta de serviço é um "usuário robô" do Google que o app usa para ler e escrever a planilha. Faça uma vez:

1. Acesse <https://console.cloud.google.com/> com a conta Google da empresa.
2. No topo, clique no seletor de projeto → **Novo projeto** → nome `jarvis-fenix` → **Criar**.
3. Menu ☰ → **APIs e serviços → Biblioteca** → procure **Google Sheets API** → **Ativar**.
4. Menu ☰ → **IAM e administrador → Contas de serviço** → **Criar conta de serviço**.
   - Nome: `jarvis-desktop` → **Criar e continuar** → pule as permissões → **Concluir**.
5. Clique na conta criada → aba **Chaves** → **Adicionar chave → Criar nova chave → JSON → Criar**. Um arquivo `.json` será baixado.
   - Guarde esse arquivo num lugar seguro. **Não mande por e-mail nem coloque no GitHub.**
6. Copie o e-mail da conta de serviço (algo como `jarvis-desktop@jarvis-fenix.iam.gserviceaccount.com`).
7. Abra a planilha **Jarvis_Fenix** → **Compartilhar** → cole esse e-mail → permissão **Editor** → desmarque "Notificar" → **Compartilhar**.
8. No app: **Configurações → Planilha Jarvis_Fenix → Escolher arquivo da chave** e selecione o `.json`.
   O app criptografa o conteúdo com o Windows (DPAPI) e o painel carrega em seguida. Depois disso, pode apagar o `.json` do computador do Tulio.

> O ID da planilha já vem preenchido: `1krSssMZcSLsD7mmCOOGQp_foJMEJqhAS2t4ExjHZAVE`.

---

## 2. Senha de app do Gmail pessoal

O Gmail não deixa programas entrarem com a senha normal; é preciso uma **senha de app** (16 letras). Ela exige a verificação em duas etapas.

1. Entre no Gmail pessoal pelo navegador.
2. Abra <https://myaccount.google.com/signinoptions/twosv> e **ative a verificação em duas etapas** (celular).
3. Abra <https://myaccount.google.com/apppasswords>.
4. Em "Nome do app", escreva **Jarvis Fênix** → **Criar**.
5. Copie as 16 letras do quadro amarelo.
6. No app: **Configurações → Contas de e-mail → Adicionar conta → Gmail**, cole a senha, dê um apelido (ex.: "Pessoal do Tulio"), escolha **PF**, clique em **Testar conexão** e depois **Salvar conta**.

O IMAP já vem ligado no Gmail. Se o teste falhar com "IMAP desligado", ative em Gmail → ⚙️ → Ver todas as configurações → Encaminhamento e POP/IMAP → Ativar IMAP.

## 3. Senha de app do Outlook / Hotmail

1. Entre na conta Microsoft pelo navegador.
2. Abra <https://account.live.com/proofs/manage/additional>.
3. Ative a **verificação em duas etapas**.
4. Em **Senhas de aplicativo** → **Criar uma nova senha de aplicativo** → copie a senha.
5. No app: **Adicionar conta → Outlook / Hotmail** (servidor `outlook.office365.com`, porta 993 já preenchidos), cole a senha, teste e salve.

> Contas Microsoft 365 de empresa podem ter o IMAP bloqueado pelo administrador.

> O e-mail da empresa (`fenix.hospitalares@gmail.com`) **não precisa** ser adicionado: o briefing da nuvem já lê. Se for adicionado, o app avisa e oferece "Ler só como conferência" (não grava na planilha).

---

## 4. Gerar o instalador e publicar uma versão

### Gerar o `.exe` (funciona no Mac ou no Windows)

```bash
npm ci
npm run dist:win
```

Saída: `release/<versão>/Jarvis-Fenix-Setup-<versão>.exe`.

### Publicar uma versão com atualização automática

O app procura versões novas no GitHub Releases do repositório **privado** `kkardosin01/jarvis-fenix-desktop` (configurado em `electron-builder.yml`).

**Token para publicar** (só na máquina de quem publica):

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token.
2. Repository access: **Only select repositories** → `jarvis-fenix-desktop`.
3. Permissions → Repository → **Contents: Read and write**.
4. No terminal:

```bash
export GH_TOKEN=github_pat_xxx
```

5. Suba a versão em `package.json` (ex.: `0.1.0` → `0.1.1`), faça commit e rode:

```bash
npm run release:win
```

Isso cria uma release com o instalador, o `.blockmap` e o `latest.yml`. Os computadores com o app baixam a versão nova em segundo plano e instalam ao reiniciar.

**Token para o app baixar as atualizações** (repositório privado):

- Crie outro fine-grained token, só para `jarvis-fenix-desktop`, com **Contents: Read-only** e validade longa.
- No computador do Tulio: **Configurações → Atualizações e suporte → Token de atualização**. Fica criptografado.
- Alternativa sem token: publicar só os instaladores num repositório público separado (ex.: `jarvis-fenix-releases`) e trocar `repo`/`private` em `electron-builder.yml`.

### Assinatura do instalador

O instalador **não é assinado** por enquanto. Na primeira instalação, o Windows SmartScreen mostra "O Windows protegeu o computador" → clique em **Mais informações → Executar assim mesmo**. Para tirar esse aviso é preciso um certificado de assinatura de código (decisão pendente, ver lista de pendências).

---

## Desenvolvimento

Requisitos: Node 22+ e npm.

```bash
npm ci
npm run dev        # abre o app com recarregamento automático
npm run lint
npm run typecheck
npm test           # Vitest: parsers, datas, números, linha digitável, PIX, PDFs, deduplicação, sincronização, notificações
npm run test:e2e   # Playwright: abre a janela com dados fictícios
npm run icon       # regenera os ícones (build/ e resources/)
```

`.env.example` lista as variáveis **só de desenvolvimento** (`JARVIS_USER_DATA` para usar uma pasta de dados separada, `GH_TOKEN` para publicar). Em produção tudo é configurado pela tela de Configurações.

Estrutura:

```
src/
  main/            processo principal (único que acessa rede, disco e segredos)
    index.ts         janela, bandeja, IPC, agendador, notificações
    servico.ts       orquestra planilha, e-mails e estado local
    sheets.ts        Google Sheets por nome de coluna; trava de escrita nas 2 abas permitidas
    painel.ts        abas → dados do painel
    armazenamento.ts arquivos locais e segredos (safeStorage)
    regras-notificacao.ts
    mail/
      imap.ts        IMAP somente leitura (imapflow + mailparser)
      pdf.ts         texto de PDFs (pdfjs-dist)
      ia.ts          extração opcional com Claude (desligada por padrão)
      sync.ts        gravação em Boletos_Outras_Contas, deduplicação e limpeza
  preload/         ponte tipada (contextBridge)
  renderer/        React + Tailwind (sem acesso a Node)
  shared/          esquemas zod
vendor/            jarvis-fenix-core (tarball): tipos, conversões pt-BR, linha digitável/PIX,
                   extração de boletos e deduplicação — o mesmo núcleo do app web
tests/
  unit/            Vitest
  e2e/             Playwright (Electron)
  fixtures/        e-mails, PDFs e códigos FICTÍCIOS gerados no teste
```

O núcleo de boletos vive no repositório `jarvis-fenix-core` e entra aqui como devDependency (`file:vendor/…tgz`): o electron-vite o embute no bundle, então o electron-builder não precisa instalar nada nem de token. Para atualizar, rode `npm run entregar` no `jarvis-fenix-core` (veja o README de lá); não edite o núcleo aqui.

Pasta de dados no Windows: `%APPDATA%\Jarvis Fênix\` (configurações, cache do painel, estado da sincronização, `segredos.bin` criptografado e `logs\`).

---

## Segurança e privacidade

- **Nenhum segredo no repositório.** Chave do Google, senhas de app, chave da Anthropic e token de atualização ficam em `segredos.bin`, criptografado com `safeStorage` (DPAPI do Windows: só o usuário do Windows naquele PC consegue abrir).
- **E-mail somente leitura:** a caixa é aberta com `EXAMINE` (read-only) e as mensagens são baixadas com `BODY.PEEK`. O app nunca envia, apaga, move nem marca e-mails como lidos.
- **Para a planilha vão só os campos do boleto** (vencimento, beneficiário, valor, conta, origem, situação, como pagar, observação, conta de e-mail, Message-ID). O conteúdo do e-mail não vai.
- **Log** (`logs/jarvis.log`, 1 MB com rotação): só metadados e erros. E-mails, números longos e chaves são mascarados antes de gravar.
- **Renderer isolado:** `contextIsolation`, `sandbox`, `nodeIntegration: false`, CSP restrita, navegação e janelas novas bloqueadas, permissões negadas. Todas as chamadas passam por IPC com validação `zod`, e só a janela do app pode chamar.
- **Links externos** só para uma lista fechada (Gmail, Outlook, WhatsApp, páginas de conta Google/Microsoft).
- **Trava de escrita** em `sheets.ts`: qualquer tentativa de escrever fora de `Boletos_Manual` e `Boletos_Outras_Contas` gera erro (há teste para isso).
- **IA opcional:** desligada por padrão. Quando ligada, envia à API da Anthropic **só o texto do e-mail/PDF candidato**, e só quando as regras não acharam o vencimento. A resposta é validada (zod + DV da linha digitável + CRC do PIX).

---

## Como funciona a leitura de boletos

Para cada conta de e-mail, a cada 15 minutos:

1. Busca mensagens dos últimos **45 dias** (primeira vez) ou desde a última sincronização, na INBOX e, no Gmail, também em "Todos os e-mails", com palavras como boleto, fatura, vencimento, linha digitável, 2ª via, DAS, IPTU, IPVA, condomínio, Celesc, Casan, cartão…
2. Pula o que já foi processado, propaganda, e-mails enviados pela própria conta, comprovantes de pagamento, notas fiscais sem cobrança e boletos emitidos pela Fênix para clientes.
3. Lê o corpo e os **PDFs anexos** e extrai:
   - **linha digitável** de 47 dígitos (bancária) ou 48 (concessionárias), com **validação dos dígitos verificadores**; da bancária sai o **vencimento** (fator de vencimento, já com a virada de fevereiro de 2025) e o **valor**;
   - **PIX copia-e-cola** (com conferência do CRC) e o valor do PIX;
   - **vencimento** perto de "vencimento", "vence em", "data de vencimento"…;
   - **valor** perto de "valor", "total a pagar"…;
   - **beneficiário** escrito no boleto ou, na falta, o nome do remetente.
4. Grava em `Boletos_Outras_Contas` só o que está entre **30 dias atrasado e 7 dias à frente**. Boletos mais distantes ficam guardados no computador e entram na planilha quando chegarem a 7 dias do vencimento.
5. **Sem duplicidade**: não grava se já existir o mesmo Message-ID, a mesma linha digitável ou o mesmo beneficiário + vencimento + valor em qualquer uma das três abas de boletos.
6. **Limpeza**: a cada sincronização recalcula a situação ("Vence hoje", "Atrasado", "Próximos dias") e remove as linhas vencidas há mais de 30 dias e as marcadas como pagas no app.
