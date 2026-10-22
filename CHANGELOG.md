# Histórico

## 0.1.1 — 22/10/2026 · teste da atualização automática

- Versão de teste para confirmar que o PC da empresa baixa e instala atualizações sozinho pelo GitHub Releases (token de leitura em Configurações). Nenhuma mudança de funcionamento.
- Inclui a identidade visual de 20/10, que já estava no instalador 0.1.0 publicado.

## 20/10/2026 · identidade visual do site (ainda sem instalador novo)

- Ícones do programa, do instalador e da bandeja com a fênix dourada do site (`assets/fenix-emblema.png`, `npm run icon`).
- Cores do site (preto/carvão/dourado no escuro, creme/dourado no claro), títulos em Oswald e texto em Manrope (fontes embutidas, funcionam sem internet). A fênix substitui o "F" no menu.
- Teste de ponta a ponta atualizado para o novo fundo escuro.

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
