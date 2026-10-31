# Percentual de Acertos — testes da integração JWT

Validação em **31/10/2026**, Node.js **24.22.1**.
Componente: `src/pages/responsavel/rendimento/percentual/index.js`.

## Análise realizada

Consultados `CONTEXTO_DESENVOLVIMENTO.md`, `ANALISE_ARQUITETURA_FRONTEND.md`,
página atual, `src/services/api.js`, CSS, package.json e testes/helpers existentes.
As descrições documentais de JWT por prompt e gráfico demonstrativo são históricas;
o componente atual lê localStorage e api.js já possui interceptor de autenticação.
Preservado o contrato de Usuario._id nas consultas gerais e navegação.

## Resultados executados

| Execução | Aprovados | Reprovados | Ignorados |
| --- | ---: | ---: | ---: |
| Percentual isolado | 46 | 0 | 0 |
| Regressão conjunta: Percentual, Resumo, Relatório, Evolução, Contas, Painel e Detalhes | 309 | 0 | 0 |
| Autenticação filtrada: login e sessão do responsável | 11 | 0 | 0 |
| Total sem repetir os 46 específicos incluídos na regressão | **320** | **0** | **0** |

Todos os comandos finais retornaram 0. Sem cancelamentos ou TODOs.
Sintaxe, ESLint e formatação do teste específico passaram.
Cadastro e Adicionar Conta foram excluídos dos comandos; não são aprovações
nem testes marcados como skipped. O filtro de autenticação seleciona apenas
login/sessão, evitando inclusive cenários de cadastro com títulos genéricos.

A rodada inicial teve 21 aprovações e 9 falhas em 30 testes. As causas eram
expectativas do fluxo anterior: JWT/header explícito, alerta na ausência de
token ou 401 e exigência de console.error. Foram atualizadas conforme os
requisitos desta tarefa, mantendo os testes de cálculo e gráfico existentes.

**Nenhum defeito funcional de Percentual foi reproduzido nos cenários finais.**

## Cenários cobertos

- Ausência de window.prompt() no fluxo de consulta.
- Leitura do token do localStorage compartilhado pelo componente e interceptor.
- Authorization: Bearer pelo interceptor Axios real; página sem config explícita.
- Token alterado no storage é utilizado na consulta seguinte.
- Token ausente, vazio ou de espaços: sem GET e redirecionamento ao login `/`.
- Ausência completa de token e usuario: redirecionamento sem consulta.
- HTTP 401 com ou sem mensagem: remove token e usuario, preserva outras chaves,
  oculta gráfico, encerra carregamento e redireciona.
- HTTP 403, 404 e 500: mensagem backend quando presente, fallback quando ausente,
  sessão preservada e sem redirecionamento.
- Falha de rede: fallback, carregamento encerrado e sessão preservada.
- Acertos e erros: 0/100, 72/28, 66.67/33.33 e 100/0 no centro, legenda,
  descrição acessível e conic-gradient.
- Uso de resumo.percentualAcertos sem recálculo por contadores de acertos/erros.
- Nenhuma tentativa: mensagem específica, sem gráfico de 100% de erros.
- Usuario._id na consulta e link de retorno, distinto do Crianca._id da resposta.
- Router não pronto ou sem ID: nenhuma consulta/prompt.
- Carregamento pendente, limpeza de dados anteriores e erro anterior.
- Sucesso/erro/401 antigo não substitui dados atuais nem apaga sessão atual.
- Finally antigo não encerra carregamento atual em sucesso ou erro.
- Resposta antiga após falta de token e cleanup na desmontagem são ignorados.
- Estrutura do gráfico, centro, legenda, classes CSS, cores, títulos, imagens,
  metadados e link de retorno preservados.

O percentual fracionário permanece apresentado com ponto (66.67%), conforme
implementação atual. Localização para vírgula não foi exigida como novo contrato.

## Testes simulados e HTTP real

**Percentual (46 testes):** componente, efeito/cleanup e interceptor de api.js
reais, com infraestrutura existente de node:test/assert, Babel do Next, VM e
renderToStaticMarkup. Hooks, router, storage e CSS Modules são controlados.
A opção usarApiReal do helper existente foi reutilizada sem modificá-lo.
O adapter Axios retorna respostas/rejeições simuladas; não abre conexão HTTP.
Um teste usa API inteiramente simulada para confirmar ausência de headers
explícitos no componente. Esses testes não validam JWT no servidor.

**Regressão com HTTP local real (2 testes incluídos nos totais):**

- Contas: página e interceptor Axios reais, servidor node:http em loopback
  com resposta fixa; confirma Authorization recebido pelo servidor.
- Login: formulário e Axios reais, Express/Router/Controller/Service e bcrypt/JWT;
  Models simulados, sem MongoDB. Confirma criação e reutilização da sessão.

As demais verificações usam respostas controladas. Não houve acesso a API
externa, MongoDB ou dados reais. HTTP local não equivale a E2E de navegador.
A estrutura visual é verificada em JSX/HTML/atributos/classes, sem comparação
de pixels, CSS aplicado, responsividade, DOM, navegação Next real, hidratação,
StrictMode real ou CORS. Os estados são observados após execução dos efeitos.

## Arquivos alterados nesta tarefa

- `tests/percentual.test.cjs`: expectativas JWT atualizadas e 46 cenários.
- `tests/percentual.relatorio.md`: resultados, cobertura e limites atualizados.

Helper, outras suítes e alterações pré-existentes foram preservados.
Sem alterações de produção, backend, MongoDB ou cadastro. Sem instalação,
commit, push ou merge.

## Comandos de reprodução

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/percentual.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/percentual.test.cjs tests/resumo.test.cjs tests/relatorio.test.cjs tests/evolucao.test.cjs tests/contas.test.cjs tests/painelResponsavel.test.cjs tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec --test-name-pattern='^(login|Login:|caracterização: handler de login|perfil de login|integração HTTP real: Login|responsável:)' tests/autenticacao.auditoria.test.cjs
node node_modules/eslint/bin/eslint.js tests/percentual.test.cjs
node --check tests/percentual.test.cjs
```

Formatação com a instalação existente, a partir da raiz:

```powershell
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/percentual.test.cjs
```
