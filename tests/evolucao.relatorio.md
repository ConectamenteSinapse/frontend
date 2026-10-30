# Evolução do Progresso — testes automatizados

Validação em **30/10/2026**, Node.js 24.22.1. Componente:
`src/pages/responsavel/rendimento/evolucao/index.js`.

Consultados os três documentos de contexto/arquitetura, o código atual da página,
seu CSS, package.json e os testes existentes. O código local já utiliza
evolucao-diaria, consultaConcluida e cleanup com consultaAtiva; os diagnósticos
históricos de gráfico demonstrativo não descrevem essa implementação atual.

## Resultados efetivamente executados

| Execução                                    | Aprovados | Reprovados | Ignorados |
| ------------------------------------------- | --------: | ---------: | --------: |
| Específicos de Evolução do Progresso        |        35 |          0 |         0 |
| Percentual de Acertos na regressão conjunta |        30 |          0 |         0 |
| Relatório Final na regressão conjunta       |        27 |          0 |         0 |
| Total da execução conjunta após formatação  |        92 |          0 |         0 |

Comandos com exit 0, sem cancelamentos ou TODOs. A primeira execução específica
teve 35 aprovações; elas foram repetidas na regressão, não somadas novamente.
As suítes anteriores passaram sem modificar seus cenários ou expectativas.

**Nenhum defeito funcional reproduzido nos cenários executados.** Não houve
homologação visual nem integração HTTP real nesta rodada.

## Cobertura dos cenários solicitados

| Cenário              | Verificação executada                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Endpoint             | Uma única consulta GET /criancas/:usuarioId/evolucao-diaria                                    |
| JWT do responsável   | Header Bearer e remoção de espaços do token fictício                                           |
| Percentuais da API   | Alturas dos pontos para 0%, 50%, 72%, 66,67% e 100%                                            |
| Datas e ordem        | Rótulos dd/mm, ordem recebida, virada de mês/ano e lacunas sem dias inventados                 |
| Um dia               | Ponto central x=300 e caminho SVG sem NaN/Infinity                                             |
| Vários dias          | Posições e caminho que liga os pontos; escala 0/25/50/75/100                                   |
| Sem histórico        | Mensagem específica somente após sucesso com evolucao vazio, sem gráfico                       |
| Antes da consulta    | Ausência de mensagem prematura de histórico vazio e de série demonstrativa                     |
| JWT ausente          | Cancelamento, string vazia e espaços; mensagem e zero chamadas                                 |
| HTTP 401/403         | Mensagem da API; gráfico e mensagem de histórico vazio ausentes                                |
| Falha de comunicação | Mensagem padrão e encerramento do carregamento                                                 |
| Carregamento         | Promessa pendente, sem gráfico ou mensagem de ausência                                         |
| Troca de criança     | Série anterior oculta após início do novo efeito; novo ID na URL e novos dados                 |
| Respostas antigas    | Sucesso, erro e resultado vazio antigos não sobrescrevem sucesso atual                         |
| Erros antigos        | Não geram alerta nem encerram o carregamento atual; sucesso antigo não remove erro novo        |
| Sem recálculo        | Fixture divergente dos contadores e getters que falham se acertos/erros/tentativas forem lidos |

Também foram testados router não pronto, ID ausente, erro HTTP sem mensagem,
falhas de nova consulta após resultado anterior, finally antigo durante nova
consulta, histórico vazio anterior durante carregamento e troca de uma criança
com atividades para outra sem histórico.

## Datas e percentuais: interpretação do contrato

O backend é responsável pela ordenação cronológica e pelo cálculo dos percentuais
diários. A página utiliza diretamente a ordem do array recebido e extrai dd/mm
das strings de data, sem agrupar ou ordenar novamente. Uma fixture deliberadamente
fora da ordem cronológica confirma esse comportamento de preservação da sequência;
ela não homologa uma resposta incorreta do backend.

A representação horizontal atual distribui igualmente os pontos recebidos;
não insere dias sem tentativas nem representa a duração dos intervalos entre datas.
Os rótulos usam dd/mm e não exibem o ano. Os percentuais são representados pela
altura dos pontos, sem rótulo numérico individual de cada percentual.

Converter percentual em coordenada SVG e posicionar linhas de escala são cálculos
de apresentação. Não são recálculo de rendimento a partir de acertos e tentativas.
Foi comprovado que o componente não depende desses contadores para desenhar a série.

As regras da #107 permanecem intactas: consulta geral da criança por Usuario._id,
com dados calculados no backend e autorização de responsável vinculada ao JWT.
A suíte testa o envio do token e tratamento das respostas, não sua validação
criptográfica ou o vínculo real no backend.

## Infraestrutura reutilizada e limitações

Reutilizados node:test/assert, Babel já incluído no Next, VM isolada e
renderToStaticMarkup. O helper existente recebeu apenas a página evolucao
na lista permitida e seu mock de CSS Modules. O default relatorio e as duas
suítes anteriores foram preservados.

São testes unitários do código real com hooks controlados. Requisições, router,
prompt, CSS Modules e Head/Link são simulados; a instância Axios real não é
carregada e imports não previstos são rejeitados. As callbacks reais do efeito
e seu cleanup são executados em ordem controlada, sem sleeps arbitrários.

O HTML/SVG gerado valida estrutura, texto, coordenadas, caminho e atributos
acessíveis. Não certifica pixels, CSS aplicado, responsividade, navegação real,
eventos, hidratação, batching/StrictMode, semântica completa do Next Router,
CORS ou o ciclo de vida real do Next. Não houve teste DOM/ponta a ponta.
A suíte observa renderizações controladas após os efeitos; não certifica a
ausência de um frame antigo antes da execução do efeito no navegador.

## Arquivos e comandos

- Criado: tests/evolucao.test.cjs.
- Criado: tests/evolucao.relatorio.md.
- Ajustado: tests/helpers/relatorio.cjs para aceitar evolucao e seu CSS.

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/evolucao.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/evolucao.test.cjs tests/percentual.test.cjs tests/relatorio.test.cjs
node node_modules/eslint/bin/eslint.js tests/evolucao.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/evolucao.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/evolucao.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe e ESLint aprovados. Foi utilizado apenas o formatador já instalado e
somente nos arquivos de testes/relatório. Nenhuma alteração em produção,
backend, banco, dependências ou documentos de contexto; nenhum commit ou push.
