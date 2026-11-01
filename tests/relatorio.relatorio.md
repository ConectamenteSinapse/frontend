# Relatório Final — testes da integração JWT

Validação em **31/10/2026**, Node.js **24.22.1**.
Componente: `src/pages/responsavel/rendimento/relatorio/index.js`.

## Análise e comportamento atual

Consultados `CONTEXTO_DESENVOLVIMENTO.md`, `ANALISE_ARQUITETURA_FRONTEND.md`,
página atual, `src/services/api.js`, CSS e testes/helper existentes.
As descrições documentais de JWT por prompt e tabela demonstrativa são históricas.
O código atual lê token do localStorage e executa três GETs em Promise.all:

- `/responsaveis/minhas-criancas`
- `/criancas/:usuarioId/resumo-desempenho`
- `/comodos`

O interceptor de api.js envia Authorization automaticamente. A seleção da criança
compara usuarioId com o ID da URL. O catálogo é ordenado numericamente por ordem
e associado a desempenhoPorComodo por ID. Indicadores vêm do resumo geral.
Sem token ocorre redirecionamento para `/`; 401 remove token e usuario e redireciona.
Os demais erros preservam sessão e mostram mensagem backend ou fallback.
O cleanup invalida callbacks antigas por consultaAtiva.

## Resultados executados

| Execução | Aprovados | Reprovados | Ignorados |
| --- | ---: | ---: | ---: |
| Relatório isolado | 62 | 0 | 0 |
| Regressão conjunta: Relatório, Evolução, Percentual, Resumo, Contas, Painel e Detalhes | 363 | 0 | 0 |
| Autenticação filtrada: login e sessão do responsável | 11 | 0 | 0 |
| Total sem repetir os 62 específicos incluídos na regressão | **374** | **0** | **0** |

Todos os comandos finais retornaram 0. Sem cancelamentos ou TODOs.
Sintaxe e ESLint passaram; teste específico formatado com instalação existente.
Cadastro e Adicionar Conta foram excluídos dos comandos, não contabilizados
como aprovações ou skipped. O filtro de autenticação seleciona apenas login
ou sessão, evitando também cenários de cadastro com títulos genéricos.

A rodada inicial teve 19 aprovações e 8 falhas em 27 testes. As falhas eram
expectativas do fluxo anterior: JWT/header explícito, alertas na ausência de
token ou em 401 e exigência de console.error. Atualizadas conforme os requisitos,
sem remover verificações existentes de dados e tabela.

**Nenhum defeito funcional do Relatório foi reproduzido nos cenários finais.**
O defeito histórico de resposta antiga sobrescrevendo a criança atual, descrito
na versão anterior deste relatório, já não ocorreu na rodada inicial: o código
recebido contém cleanup e consultaAtiva. Nenhuma correção de produção foi feita.

## Cobertura

- Ausência de window.prompt(); token do localStorage compartilhado com interceptor.
- Authorization automático nas três chamadas; teste separado confirma ausência
  de config explícita enviada pela página. Token renovado vale na próxima consulta.
- Sem token, vazio ou espaços: nenhuma consulta e redirecionamento ao login.
  Ausência completa de token e usuario também coberta.
- 401 em cada uma das três rotas, com/sem mensagem backend: remove token/usuario,
  preserva outras chaves, oculta relatório, encerra loading e redireciona.
- 403, 404 e 500 em cada uma das três rotas: preserva sessão e mensagem backend,
  sem exibir dados parciais. Sem mensagem, usa fallback.
- Falha de rede preserva sessão, mostra fallback e encerra loading.
- As três consultas iniciam antes de qualquer resposta. Cada rota é testada
  como última resposta pendente, sem exibir relatório parcial.
- Criança identificada por Usuario._id e não Crianca._id, inclusive com fixture
  cujo perfil errado possui _id igual ao usuário da URL. Navegação preserva o ID.
- Indicadores tarefasConcluidas, totalTentativas e acertos vêm do resumo geral.
- Tabela associa comodoId ao catálogo em ordens diferentes; ordenação numérica
  2/10/100, percentuais backend sem recálculo, extremos 0% e 100%.
- Cômodos sem tentativas exibem zeros e percentual —; criança sem histórico mantém
  catálogo completo e indicadores zerados, sem NaN/undefined.
- Criança fora das contas vinculadas: mensagem específica e ausência de dados.
- Router não pronto/sem ID não inicia consultas; carregamento oculta dados antigos.
- Troca de criança seguida de erro HTTP/rede/token/vínculo ausente limpa relatório.
- Sucesso e erro/401 antigos não alteram relatório atual, sessão ou carregamento;
  sucesso antigo não remove erro atual nem repõe dados após falta de token.
- Cleanup na desmontagem impede setState/redirecionamento tardio.
- Sucesso de outra criança limpa erro anterior e apresenta relatório novo.
- HTML, perfil, avatar, títulos, metadados, indicadores, tabela, cabeçalhos,
  imagens, classes CSS e link de retorno preservados.

## Simulação, interceptor real e HTTP real

Reutilizados node:test/assert, Babel do Next, VM e renderToStaticMarkup do helper
existente, sem modificá-lo. Hooks/router/storage/CSS Modules são controlados.

**Na suíte do Relatório (62 testes):**

- 60 cenários usam a opção existente usarApiReal: api.js e interceptor Axios reais,
  com adapter de transporte simulado e respostas/rejeições controladas.
- 1 teste usa API inteiramente simulada para observar a config passada pela página.
- 1 integração HTTP local real executa o componente e api.js/Axios, envia os três
  GETs a servidor node:http em loopback e verifica as URLs e Bearer recebidos,
  além de perfil, indicadores e tabela após respostas JSON. O servidor fornece
  fixtures e não executa o backend nem valida criptograficamente o JWT.

**Na regressão, mais 2 integrações HTTP reais (incluídas nos totais):**

- Contas: componente/interceptor reais e servidor local com resposta fixa.
- Login: formulário/Axios, Express/Router/Controller/Service e bcrypt/JWT reais,
  com Models simulados, confirmando obtenção e reutilização da sessão.

Assim, os 374 testes incluem 3 integrações HTTP locais reais. Os demais usam
respostas controladas. Não houve MongoDB, API externa ou dados reais.

A verificação visual cobre HTML, texto, atributos e classes; não certifica
pixels, CSS aplicado, responsividade, DOM, navegação Next real, hidratação,
batching/StrictMode real ou CORS. HTTP local não equivale a E2E de navegador.
Estados são observados após os efeitos, sem certificar ausência de frame antigo.

## Arquivos alterados nesta tarefa

- `tests/relatorio.test.cjs`: expectativas JWT, cobertura ampliada e HTTP local real.
- `tests/relatorio.relatorio.md`: análise, resultados, cobertura e limites.

Helper, demais suítes e alterações pré-existentes foram preservados.
Sem alterações de produção, backend, MongoDB ou cadastro. Sem instalação,
commit, push ou merge.

## Comandos de reprodução

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/relatorio.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/relatorio.test.cjs tests/evolucao.test.cjs tests/percentual.test.cjs tests/resumo.test.cjs tests/contas.test.cjs tests/painelResponsavel.test.cjs tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec --test-name-pattern='^(login|Login:|caracterização: handler de login|perfil de login|integração HTTP real: Login|responsável:)' tests/autenticacao.auditoria.test.cjs
node node_modules/eslint/bin/eslint.js tests/relatorio.test.cjs
node --check tests/relatorio.test.cjs
```

Formatação com instalação existente, a partir da raiz:

```powershell
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/relatorio.test.cjs
```
