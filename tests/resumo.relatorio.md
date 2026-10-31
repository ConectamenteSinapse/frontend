# Resumo de Atividade — integração JWT

Validação em **31/10/2026**, Node.js **24.22.1**. Componente real:
`src/pages/responsavel/rendimento/resumo/index.js`.

## Resultados

| Execução | Aprovados | Falhas |
| --- | ---: | ---: |
| Resumo isolado | 40 | 0 |
| Regressão conjunta: Resumo, Relatório, Percentual, Evolução, Contas e Painel | 182 | 0 |
| Detalhes da criança | 111 | 0 |
| Autenticação filtrada: login e sessão do responsável | 11 | 0 |
| Total sem repetir os 40 específicos incluídos na regressão | **304** | **0** |

Todos os comandos finais retornaram 0, sem cancelamentos ou TODOs.
Sintaxe dos dois arquivos JavaScript alterados e ESLint também passaram.
Os testes de cadastro e a suíte Adicionar Conta foram excluídos da execução.
O filtro de autenticação seleciona explicitamente login/sessão, evitando também
cenários de cadastro cujos títulos não contêm a palavra cadastro.

A execução inicial apresentou 21 aprovações e 9 falhas em 30 testes.
As falhas eram expectativas desatualizadas: headers explícitos/JWT digitado,
alerta em vez de redirecionamento e console de erro.
**Nenhum defeito funcional do Resumo foi reproduzido nos cenários finais.**

## Cobertura do Resumo

- Sem window.prompt(); token do mesmo localStorage usado pelo interceptor.
- api.js e instância/interceptor Axios reais enviam Authorization: Bearer;
  teste separado confirma que a página não fornece headers explícitos.
- Token atualizado no storage é utilizado na consulta seguinte.
- Token ausente, vazio ou de espaços impede GET e redireciona para `/`.
- HTTP 401 remove token/usuario, encerra carregamento, oculta indicadores
  e redireciona para `/`.
- HTTP 403, 404 e 500 preservam a mensagem do backend; sem mensagem, usam fallback.
- Falha de rede mantém token/usuário, mostra fallback e não redireciona.
- Cards usam tarefasConcluidas, totalTentativas e acertos do resumo, inclusive
  zeros reais, sem recalcular a partir de cômodos ou percentuais.
- GET e link de retorno preservam Usuario._id da URL, distinto de Crianca._id
  recebido na resposta.
- Carregamento, troca de criança, limpeza de erro, respostas antigas e finally
  antigo preservam a consulta atual; 401 antigo não apaga a sessão atual.
- Cleanup na desmontagem impede atualizações e redirecionamentos tardios.
- Estrutura JSX/HTML, classes CSS, imagens, títulos, metadados e link de retorno.

## Infraestrutura e limites

Reutilizados node:test/assert, Babel do Next já instalado, VM e renderizador
React existentes. O helper recebeu a opção usarApiReal, desativada por padrão,
preservando o comportamento dos testes das outras páginas. Quando ativada,
compila o módulo de produção api.js e substitui somente o adapter de transporte
por respostas controladas, sem conexão com serviços externos.

Os testes do Resumo executam componente, efeito/cleanup e interceptor reais,
com hooks, router, storage, Head/Link e CSS Modules controlados. Erros HTTP
são rejeições simuladas no adapter; não validam autorização do backend.
A regressão de login inclui HTTP local e backend com Models simulados,
sem MongoDB. Nenhum arquivo de backend foi alterado.

Não é E2E: não valida DOM, navegação Next real, StrictMode real, hidratação,
CORS ou aparência em pixels/responsividade. A preservação visual foi verificada
na estrutura, atributos e classes, sem alteração do CSS.

## Arquivos alterados nesta tarefa

- tests/resumo.test.cjs: atualiza expectativas JWT e amplia de 30 para 40 testes.
- tests/helpers/relatorio.cjs: opção de API/interceptor reais com adapter simulado.
- tests/resumo.relatorio.md: resultados e instruções de reprodução.

Alterações de produção e outros testes já existentes no workspace foram
preservadas. Nenhuma biblioteca foi instalada. Não houve alteração de produção,
backend, MongoDB ou fluxo de cadastro; nenhum commit, push ou merge foi feito.

## Comandos executados

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/resumo.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/resumo.test.cjs tests/relatorio.test.cjs tests/percentual.test.cjs tests/evolucao.test.cjs tests/contas.test.cjs tests/painelResponsavel.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec --test-name-pattern='^(login|Login:|caracterização: handler de login|perfil de login|integração HTTP real: Login|responsável:)' tests/autenticacao.auditoria.test.cjs
node node_modules/eslint/bin/eslint.js tests/resumo.test.cjs tests/helpers/relatorio.cjs
node --check tests/resumo.test.cjs
node --check tests/helpers/relatorio.cjs
```

Formatação do teste do Resumo, a partir da raiz, com instalação existente:

```powershell
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/resumo.test.cjs
```
