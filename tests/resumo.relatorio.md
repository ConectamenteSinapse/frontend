# Resumo de Atividade — testes automatizados

Validação em **30/10/2026**, Node.js 24.22.1. Componente real:
`src/pages/responsavel/rendimento/resumo/index.js`.

Consultados os documentos de contexto/arquitetura, a página atual, CSS,
package.json e os testes existentes. A implementação atual utiliza
resumo-desempenho e cleanup com consultaAtiva; a referência histórica ao
endpoint de progresso não descreve o código testado nesta rodada.

## Resultados executados

| Execução                                   | Aprovados | Reprovados | Ignorados |
| ------------------------------------------ | --------: | ---------: | --------: |
| Específicos de Resumo de Atividade         |        30 |          0 |         0 |
| Relatório Final na execução conjunta       |        27 |          0 |         0 |
| Percentual de Acertos na execução conjunta |        30 |          0 |         0 |
| Evolução do Progresso na execução conjunta |        35 |          0 |         0 |
| Total conjunto após formatação             |       122 |          0 |         0 |

Ambos os comandos retornaram 0. Não houve cancelamentos ou TODOs. Os 30
específicos foram repetidos na regressão e já estão nos 122; não somar novamente.
Os 92 testes anteriores mantiveram seus cenários e expectativas intactos.

**Nenhum defeito funcional reproduzido nos cenários executados.** Não houve
modificação de produção nem homologação de navegador/API real.

## Cenários cobertos

| Requisito           | Verificação                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| Endpoint            | Exatamente um GET /criancas/:usuarioId/resumo-desempenho                                                        |
| Authorization       | Bearer com JWT fictício do responsável, retirando espaços externos                                              |
| Indicadores         | Três cards com tarefasConcluidas, totalTentativas e acertos recebidos em resumo                                 |
| Sem recálculo       | Desempenho por cômodo divergente não altera cards; getters de erros/percentual/estrelas/cômodos falham se lidos |
| Indicadores zerados | Três valores zero exibidos após resposta bem-sucedida sem histórico                                             |
| JWT ausente/vazio   | Cancelamento, string vazia e espaços; mensagem sem requisições                                                  |
| HTTP 401/403        | Mensagem da API, sem indicadores e sem carregamento residual                                                    |
| Comunicação         | Mensagem padrão na falha de rede ou erro HTTP sem mensagem                                                      |
| Carregamento        | Dados ocultos enquanto a promessa está pendente                                                                 |
| Router não pronto   | Nenhum prompt nem chamada HTTP                                                                                  |
| Sem ID              | Nenhum prompt nem chamada HTTP                                                                                  |
| Troca de ID         | Dados anteriores removidos após início do novo efeito; novo ID na URL                                           |
| Resposta atrasada   | Sucesso antigo não substitui indicadores da criança atual                                                       |
| Erro antigo         | Erro anterior não produz alerta nem altera a consulta atual                                                     |
| Erro/carregamento   | Não exibem os cards anteriores nem indicadores demonstrativos                                                   |

Também cobertos: estado inicial sem cards, títulos/rótulos, erros em novas
consultas após sucesso, finally antigo durante carregamento de outra criança,
sucesso antigo após erro novo, resposta antiga após JWT ausente na nova consulta,
limpeza de erro anterior ao consultar outra criança e troca para indicadores
zerados de criança sem histórico.

As respostas simuladas não alteram MongoDB. A identidade é o Usuario._id
da URL, não o Crianca._id retornado no resumo. Os totais vêm do backend e
representam o rendimento geral entre partidas. A distinção da #107 entre
tarefas distintas do resumo e grupos tarefa+dificuldade do progresso foi
preservada; nenhum desbloqueio ou regra de sessão foi acrescentado à tela.

## Infraestrutura e limitações

Reutilizado o helper existente de node:test/assert, compilação JSX pelo Babel
já instalado com Next, VM isolada e renderToStaticMarkup do React. A alteração
pontual no helper adiciona resumo à lista permitida e seu mock de CSS Modules.
O comportamento padrão e as outras páginas permanecem compatíveis.

São testes unitários do componente real com hooks controlados. API, router,
prompt, Head/Link e CSS Modules são simulados. A instância Axios real não é
carregada e imports inesperados falham; não há chamadas HTTP reais ou banco.
Callbacks e cleanup reais do efeito são executados em ordem controlada,
com promessas pendentes e sem sleeps arbitrários.

Não foram automatizados DOM real, eventos de navegador, navegação do Next,
hidratação, batching/StrictMode, aparência/responsividade, CORS ou autorização
real no backend. As verificações de limpeza observam o estado após o efeito;
não certificam ausência de um frame antigo antes da execução do efeito no
navegador. Aprovação unitária não equivale a homologação ponta a ponta.

## Arquivos e comandos

- Criado: tests/resumo.test.cjs.
- Criado: tests/resumo.relatorio.md.
- Ajustado: tests/helpers/relatorio.cjs para aceitar a página e seu CSS.

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/resumo.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/resumo.test.cjs tests/relatorio.test.cjs tests/percentual.test.cjs tests/evolucao.test.cjs
node node_modules/eslint/bin/eslint.js tests/resumo.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/resumo.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/resumo.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe e ESLint passaram. Prettier utilizou apenas a instalação existente,
somente em testes/relatório. Nenhuma dependência foi instalada; não houve
alteração de produção, backend, banco, configuração ou documentos de contexto,
commit ou push.
