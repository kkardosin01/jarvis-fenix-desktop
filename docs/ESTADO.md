# Jarvis Fênix (computador) — situação em 20/10/2026

## Feito

- Código completo, com testes, typecheck, lint e build passando (os testes do núcleo agora rodam no `jarvis-fenix-core`).
- Versão **0.1.0 publicada** em 20/10 no GitHub Releases (repositório privado): https://github.com/kkardosin01/jarvis-fenix-desktop/releases/tag/v0.1.0 — instalador, `.blockmap` e `latest.yml`, gerados já com o `jarvis-fenix-core` e a nova identidade visual.
- **Instalado no PC da empresa** em 20/10 (opção "Apenas para mim", usuário `USER` do Windows) e **conectado à planilha** com uma chave nova da conta `jarvis-web@jarvis-fenix.iam.gserviceaccount.com` (a mesma conta do app de celular, chave separada para poder revogar só a do PC).
- Núcleo de boletos movido para o pacote compartilhado `jarvis-fenix-core` (ver [CHANGELOG](../CHANGELOG.md)).

## Ainda não feito

- [ ] **Token de atualização no PC** (fine-grained, só leitura de `jarvis-fenix-desktop`) em Configurações → Atualizações e suporte. Sem ele, o PC não baixa as próximas versões sozinho.
- [ ] Conectar o e-mail pessoal do Tulio (senha de app do Gmail).
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
