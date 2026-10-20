# Jarvis Fênix (computador) — situação em 19/10/2026

## Feito

- Código completo, com testes, typecheck, lint e build passando (os testes do núcleo agora rodam no `jarvis-fenix-core`).
- Instalador `Jarvis-Fenix-Setup-0.1.0.exe` gerado **localmente** (`release/0.1.0/`, fora do Git). Ele foi gerado **antes** da troca para o `jarvis-fenix-core`; gere de novo antes de instalar.
- Núcleo de boletos movido para o pacote compartilhado `jarvis-fenix-core` (ver [CHANGELOG](../CHANGELOG.md)).

## Ainda não feito

- [ ] **Nenhuma versão publicada no GitHub Releases**, então ainda não há atualização automática. Publicar exige o token descrito no README (seção 4).
- [ ] **Instalar no computador do Tulio** e conectar a planilha.
- [ ] **Chave da conta de serviço para este app.** O projeto do Google Cloud já existe: **`jarvis-fenix`**, na conta `fenix.hospitalares@gmail.com`, criado em 19/10 para o app de celular. Há duas opções:
  - criar **outra chave** para a conta `jarvis-web@jarvis-fenix.iam.gserviceaccount.com`, que já é Editor da planilha (mais simples; dá para revogar cada chave separadamente); ou
  - criar a conta `jarvis-desktop`, como descreve o README, e compartilhar a planilha com ela.
- [ ] Contas de e-mail pessoais: se as mesmas contas forem ligadas aqui **e** no app de celular, as duas leituras gravam na mesma aba. A deduplicação (mesmo `id_mensagem`, mesma linha digitável ou mesmo beneficiário + vencimento + valor) evita linhas repetidas, mas o mais simples é ler cada conta em um app só.
- [ ] Assinatura de código do instalador (aviso do SmartScreen) — decisão pendente.

## Como os dois apps se relacionam

| | Computador (este) | Celular (`jarvis-fenix`) |
|---|---|---|
| Onde roda | PC do Tulio, 24 h | Vercel, https://jarvis-fenix.vercel.app |
| Planilha | lê tudo; escreve em `Boletos_Manual` e `Boletos_Outras_Contas` | igual |
| E-mails pessoais | a cada 15 min, 6h–23h | de hora em hora, 7h–22h (pg_cron do Supabase), ao abrir o app e no botão |
| Núcleo de boletos | `jarvis-fenix-core` (vendor/) | `jarvis-fenix-core` (vendor/) |
| Onde guarda contas e senhas | no PC, cifrado pelo Windows (DPAPI) | Supabase (projeto `comercial-fenix`), cifrado com AES-256-GCM |
| "Marcar como pago" de outras contas | lista local neste PC | tabela `boletos_pagos` no Supabase |

Por causa da última linha, um boleto marcado como pago em um app pode reaparecer no outro, se o outro também ler a mesma conta de e-mail. Ler cada conta em um app só evita isso.
