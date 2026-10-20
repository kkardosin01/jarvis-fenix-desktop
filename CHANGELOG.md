# Histórico

## 0.1.0 — 19/10/2026 · primeira versão

**App**

- Central de comando para Windows: painel do dia em tela cheia (Hoje, Contas a pagar, Clientes, E-mails, Prospecção, Configurações), ícone na bandeja, início com o Windows, tela ligada.
- Lê a planilha Jarvis_Fenix (conta de serviço do Google) e escreve só em `Boletos_Manual` e `Boletos_Outras_Contas`.
- Lê os e-mails pessoais em modo somente leitura (IMAP), extrai boletos de texto e PDFs (linha digitável com DV, PIX) e grava sem duplicidade. IA opcional para e-mails sem vencimento identificável.
- Notificações: bom dia às 9h05 (nova tentativa às 9h35), boleto novo e lembrete às 14h; nunca entre 22h e 7h.
- Instalador NSIS com atualização automática pelo GitHub Releases.

**No mesmo dia, mais tarde**

- O núcleo de boletos (`src/shared` e o extrator) saiu daqui para o pacote **`jarvis-fenix-core`**, compartilhado com o app de celular. Ele entra como tarball em `vendor/` (devDependency, embutido no bundle pelo electron-vite). Assim os dois apps acham e deduplicam boletos do mesmo jeito.
- O app de celular (repositório `jarvis-fenix`) foi publicado em https://jarvis-fenix.vercel.app e grava na mesma aba `Boletos_Outras_Contas`.

Situação atual e pendências: [docs/ESTADO.md](docs/ESTADO.md).
