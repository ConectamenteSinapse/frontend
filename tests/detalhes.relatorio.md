# Detalhes da Criança — integração JWT e regressão final

Validação em **31/10/2026**, Node.js **24.22.1**.
Componente: `src/pages/responsavel/detalhes/index.js`.

## Análise e comportamento atual

Consultados `CONTEXTO_DESENVOLVIMENTO.md`, `ANALISE_ARQUITETURA_FRONTEND.md`,
`ANALISE_ARQUITETURA_BACKEND.md`, página atual, `src/services/api.js`, CSS,
package.json e infraestrutura existente de testes.

A página atual lê token do localStorage, não pede prompt nem fornece headers
manuais. O interceptor de api.js acrescenta Authorization. O GET lista crianças
vinculadas e seleciona por usuarioId = Usuario._id da URL; PATCH e DELETE usam
Crianca._id. Sem token a consulta redireciona para `/`; as operações verificam
novamente a sessão antes de enviar. HTTP 401 limpa token/usuario e redireciona.
Outros erros exibem mensagem backend ou fallback, preservando sessão.

idAtualRef acompanha a seleção no render; versaoSelecaoRef distingue visitas,
cleanup e repetição do efeito. Os handlers conferem ambos antes de aplicar
sucesso, erro ou finally. salvando bloqueia controles e novas operações após
atualização do estado. Não houve mudança de produção.

## Resultados executados

| Execução | Aprovados | Reprovados | Ignorados |
| --- | ---: | ---: | ---: |
| Detalhes isolado | 195 | 0 | 0 |
| Regressão das oito páginas: Detalhes, Relatório, Evolução, Percentual, Resumo, Contas, Painel e Adicionar Conta | 482 | 0 | 0 |
| Autenticação filtrada: login e sessão do responsável | 11 | 0 | 0 |
| Total sem repetir os 195 específicos incluídos na regressão | **493** | **0** | **0** |

As oito suítes contêm, respectivamente: 195, 62, 54, 46, 40, 37, 13 e 35 testes.
Todos os comandos finais retornaram 0. Sem cancelamentos ou TODOs.
Sintaxe e ESLint passaram; formatação utilizou Prettier já instalado.

**Cadastro foi excluído.** Adicionar Conta foi incluída por tratar somente de
vinculação de criança existente via `/responsaveis/vincular-crianca`, sem criar
usuários. Na auditoria de autenticação o filtro seleciona explicitamente login
ou sessão, evitando também testes de cadastro com títulos genéricos. Exclusões
por seleção de comando não são contabilizadas como aprovações ou skipped.

A rodada inicial, antes dos ajustes, teve 97 aprovações e 14 falhas em 111 testes.
As falhas eram expectativas antigas: headers explícitos, prompts, alertas na
falta de token e mensagem genérica em 401. Foram atualizadas conforme o contrato
solicitado; os testes de gerenciamento e de corridas existentes foram mantidos.

**Nenhum defeito funcional novo de Detalhes foi reproduzido nos cenários finais.**
As oito falhas históricas documentadas na versão anterior deste relatório já
estavam corrigidas no código recebido e seus cenários continuam aprovados.

## Cobertura

- Nenhum window.prompt(); GET e operações não passam config/headers manuais.
- Interceptor Axios real lê o mesmo localStorage e envia Bearer.
- Ausência completa de sessão ou token null/vazio/espaços: sem GET e login.
- Remoção do token após carregar a criança: cada uma das quatro operações
  revalida token, limpa sessão e redireciona sem PATCH/DELETE.
- GET 401 e 401 em cada operação: limpeza de token/usuario, preservação de outras
  chaves, perfil/modal retirados no tratamento da resposta e login.
- GET 403/404/500 e rede: fallback ou mensagem backend, sem perfil indevido,
  carregamento encerrado e sessão preservada.
- Cada operação com 403/404/500, com e sem mensagem: erro correto, perfil/modal
  mantidos, sessão preservada e botão liberado para nova tentativa.
- Rede nas quatro operações: fallback, sem sucesso/navegação ou perda de sessão.
- Seleção por Usuario._id, inclusive fixture com _id de perfil enganoso.
- Bloquear e liberar jogo: PATCH com Crianca._id e booleano, atualização após sucesso.
- Limite: inteiros positivos, valor devolvido pelo backend, null para remover,
  campo vazio após remoção e mensagens de sucesso.
- Limites 0, negativo, fracionário, vazio, espaços, texto, Infinity e NaN rejeitados
  sem PATCH; modal permanece disponível.
- Desvinculação exige confirmação, envia somente DELETE ao vínculo com Crianca._id,
  informa preservação da conta/histórico e navega apenas após sucesso.
- Carregamento inicial, botões desabilitados, proteção dos handlers, modal mantido
  durante salvamento e fechamento por cancelar/fundo quando permitido.
- Repetição de operação após renderização de salvando não envia segunda requisição.
- Corridas A → B, A → B → A, desmontagem e setup-cleanup-setup com sucesso,
  erro e 401 antigos não aplicam setters, alertas, logs, navegação ou limpeza da sessão.
- Finally antigo não libera uma operação nova pendente nem permite repetição.
- idAtualRef é exercitado após render de B e antes do novo efeito: sucesso/401
  antigos das quatro operações são ignorados mesmo sem cleanup executado ainda.
- versaoSelecaoRef é exercitado por retorno a A, cleanup e repetição do efeito.
- GET 401 antigo após cleanup/A → B/A → B → A não remove sessão nem redireciona.
- Estrutura HTML/CSS de perfil, ações, status, metadados, imagens, link e três
  modais; role dialog, aria-modal, label/input, classes e stopPropagation.

## Simulação, interceptor real e HTTP real

Reutilizados node:test/assert, Babel do Next, VM e renderToStaticMarkup, com o
helper existente sem modificações nesta tarefa.

**Nos 195 específicos de Detalhes:**

- 193 cenários usam API/respostas controladas e observam chamadas, body e config.
- 1 usa api.js/interceptor Axios reais e adapter simulado, confirmando leitura do
  storage compartilhado e header automático no GET.
- 1 integração HTTP local real usa api.js/Axios e servidor node:http em loopback.
  Confirma seis requisições: GET, bloquear, liberar, salvar limite, remover limite
  e desvincular. Verifica métodos, URLs com Crianca._id, JSON, Bearer recebido,
  ausência de config manual, mudanças de estado, alertas e navegação.

O servidor HTTP de Detalhes devolve fixtures; não executa o backend nem valida
criptograficamente JWT. O contrato de preservação de conta/histórico é validado
no cliente por endpoint e texto corretos, sem chamada de exclusão de conta.
**A persistência dessa preservação no backend/MongoDB não foi testada nesta rodada.**

**A regressão total inclui 9 testes HTTP locais reais:** Detalhes (1), Relatório
(1), Contas (1), vinculação de criança existente em Adicionar Conta (5: 200, 401,
403, 500 e conexão interrompida) e Login (1). Login executa Express/Router/
Controller/Service e bcrypt/JWT reais com Models simulados. Os demais servidores
locais substituem a API com respostas de teste. Sem MongoDB, serviços externos
ou dados reais.

Hooks, router, storage, Head/Link e CSS Modules são controlados. Não é E2E:
não certifica DOM, reconciliação/batching, StrictMode real, navegação Next real,
hidratação, CORS, aparência em pixels ou responsividade. A duplicidade é testada
por handlers após renderização de salvando, sem simular cliques DOM reais.

## Arquivos alterados nesta tarefa

- `tests/detalhes.test.cjs`: atualização JWT e ampliação de 111 para 195 testes.
- `tests/detalhes.relatorio.md`: resultados finais, cobertura e limitações.

Helper, demais suítes, páginas e alterações pré-existentes foram preservados.
Sem alterações de produção, backend, MongoDB ou cadastro; sem instalação,
commit, push ou merge.

## Comandos de reprodução

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs tests/relatorio.test.cjs tests/evolucao.test.cjs tests/percentual.test.cjs tests/resumo.test.cjs tests/contas.test.cjs tests/painelResponsavel.test.cjs tests/adicionarConta.test.cjs
node --test --test-concurrency=1 --test-reporter=spec --test-name-pattern='^(login|Login:|caracterização: handler de login|perfil de login|integração HTTP real: Login|responsável:)' tests/autenticacao.auditoria.test.cjs
node node_modules/eslint/bin/eslint.js tests/detalhes.test.cjs
node --check tests/detalhes.test.cjs
```

Formatação com instalação existente, a partir da raiz:

```powershell
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/detalhes.test.cjs
```
