# Evolução do Progresso — testes da integração JWT

Validação em **31/10/2026**, Node.js **24.22.1**.
Componente: `src/pages/responsavel/rendimento/evolucao/index.js`.

## Análise e comportamento atual

Consultados `CONTEXTO_DESENVOLVIMENTO.md`, `ANALISE_ARQUITETURA_FRONTEND.md`,
página atual, `src/services/api.js`, CSS e testes/helpers existentes.
O diagnóstico documental de JWT por prompt é histórico: atualmente a página
lê localStorage, e api.js acrescenta Authorization pelo interceptor Axios.

A página consulta `/criancas/:id/evolucao-diaria`, usando Usuario._id da URL.
No início da consulta limpa série/erro, redefine consultaConcluida para false
e ativa carregamento. Sem token redireciona para `/`, sem GET. Em sucesso,
recebe evolucao e marca consultaConcluida; somente então mostra gráfico ou
mensagem de ausência de registros. Em 401 remove token/usuario e redireciona;
outros erros preservam sessão e exibem mensagem backend ou fallback.
O cleanup invalida respostas antigas por consultaAtiva.

## Resultados executados

| Execução | Aprovados | Reprovados | Ignorados |
| --- | ---: | ---: | ---: |
| Evolução isolada | 54 | 0 | 0 |
| Regressão conjunta: Evolução, Percentual, Resumo, Relatório, Contas, Painel e Detalhes | 328 | 0 | 0 |
| Autenticação filtrada: login e sessão do responsável | 11 | 0 | 0 |
| Total sem repetir os 54 específicos incluídos na regressão | **339** | **0** | **0** |

Comandos finais retornaram 0, sem cancelamentos ou TODOs.
Sintaxe e ESLint passaram; teste específico formatado com instalação existente.
Cadastro e Adicionar Conta foram excluídos dos comandos, não contabilizados
como aprovações ou skipped. O filtro de autenticação seleciona apenas login
ou sessão, evitando também testes de cadastro com títulos genéricos.

A execução inicial teve 27 aprovações e 8 falhas em 35 testes. As falhas eram
expectativas anteriores: header explícito/JWT manual, alerta em vez de
redirecionamento e exigência de console.error. Foram atualizadas conforme
os requisitos, preservando os cenários de cálculo, datas e desenho do SVG.

**Nenhum defeito funcional de Evolução foi reproduzido nos cenários finais.**

## Cobertura

- Sem window.prompt() no fluxo de consulta; token do localStorage compartilhado
  entre componente e interceptor Axios real.
- Uma única consulta GET ao endpoint de evolução, Bearer automático e ausência
  de config/header explícito no componente; token atualizado na próxima consulta.
- Token ausente, vazio ou de espaços: sem API, gráfico ou falso histórico vazio,
  com redirecionamento ao login; ausência completa de sessão também coberta.
- 401 com/sem mensagem remove apenas token e usuario, preserva outras chaves,
  encerra loading e redireciona sem histórico vazio ou gráfico.
- 403, 404 e 500 preservam sessão e mensagens backend; sem mensagem usam fallback.
- Falha de rede mantém sessão e exibe fallback, sem redirecionar.
- Alturas para 0%, 50%, 72%, 66.67% e 100%; ponto único central e caminho SVG
  ligando vários pontos, escala 0/25/50/75/100 e rótulos dd/mm.
- Preserva percentualAcertos e ordem recebidos, sem recalcular contadores,
  reagrupar ou inventar dias sem tentativas; viradas de mês e ano cobertas.
- Evolução vazia mostra mensagem somente após sucesso confirmado.
- Router não pronto ou ID ausente não inicia consulta.
- Usuario._id preservado no GET e link de retorno, inclusive com criancaId
  diferente na resposta, sem substituir o identificador da URL.
- Limpeza de série/erro anteriores, carregamento pendente e consultaConcluida
  verificados pelo comportamento visível, sem depender do índice dos hooks.
- Sucesso, erro, vazio e 401 antigos não sobrescrevem série atual; 401 antigo
  não apaga sessão; finally antigo não encerra carregamento atual.
- Vazio antigo não conclui consulta nova pendente; sucesso/vazio antigo após
  token ausente não exibe gráfico ou histórico vazio.
- Cleanup após desmontagem impede setState e redirecionamentos tardios.
- Estrutura SVG, viewBox, grade, linha, pontos, legenda, classes CSS, imagens,
  títulos, metadados e navegação preservados.

## Simulação, interceptor real e HTTP real

**Suíte Evolução (54 testes):** reutiliza node:test/assert, Babel do Next, VM,
renderToStaticMarkup e o helper existente, sem modificá-lo. A opção usarApiReal
executa api.js e seu interceptor Axios reais, com adapter de transporte simulado.
Hooks, router, storage e CSS Modules são controlados. Um teste usa API totalmente
simulada para comprovar que o componente não fornece config explícita.
Não há HTTP real nesta suíte nem validação criptográfica do JWT.

**Regressão com HTTP local real (2 testes incluídos nos totais):**

- Contas: componente/interceptor Axios reais e servidor node:http em loopback
  com resposta fixa; verifica Authorization recebido pelo servidor.
- Login: formulário/Axios, Express/Router/Controller/Service e bcrypt/JWT reais,
  com Models simulados; confirma obtenção e reutilização da sessão.

Os demais cenários usam respostas controladas. Sem MongoDB, API externa ou dados
reais. Nenhum arquivo do backend foi alterado. HTTP local não equivale a E2E.

A verificação visual cobre HTML/SVG, coordenadas, caminho, atributos e classes;
não comprova pixels, CSS aplicado, responsividade, DOM, navegação Next real,
hidratação, batching/StrictMode real ou CORS. Os estados são observados após
os efeitos, sem certificar ausência de um frame anterior no navegador.
A distribuição horizontal preservada é uniforme entre pontos recebidos,
sem representar a duração dos intervalos entre datas. O ano não aparece no eixo.

## Arquivos alterados nesta tarefa

- `tests/evolucao.test.cjs`: expectativas JWT atualizadas e ampliação para 54 testes.
- `tests/evolucao.relatorio.md`: análise, resultados, cobertura e limites.

Helper, outras suítes e alterações pré-existentes foram preservados.
Nenhuma alteração de produção, backend, MongoDB ou cadastro. Nenhuma instalação,
commit, push ou merge.

## Comandos de reprodução

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/evolucao.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/evolucao.test.cjs tests/percentual.test.cjs tests/resumo.test.cjs tests/relatorio.test.cjs tests/contas.test.cjs tests/painelResponsavel.test.cjs tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec --test-name-pattern='^(login|Login:|caracterização: handler de login|perfil de login|integração HTTP real: Login|responsável:)' tests/autenticacao.auditoria.test.cjs
node node_modules/eslint/bin/eslint.js tests/evolucao.test.cjs
node --check tests/evolucao.test.cjs
```

Formatação com instalação existente, a partir da raiz:

```powershell
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/evolucao.test.cjs
```
