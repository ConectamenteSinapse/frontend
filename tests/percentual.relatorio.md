# Percentual de Acertos — testes automatizados

Validação em **30/10/2026**, Node.js 24.22.1. Componente real examinado:
`src/pages/responsavel/rendimento/percentual/index.js`.

Consultados CONTEXTO_DESENVOLVIMENTO.md, ANALISE_ARQUITETURA_FRONTEND.md,
ANALISE_ARQUITETURA_BACKEND.md, componente, CSS, package.json e infraestrutura
existente em tests/. O código local atualizado prevalece sobre os diagnósticos
históricos de gráfico fixo ou cálculo a partir de acertos e tentativas.

## Resultados executados

| Execução                             | Aprovados | Reprovados | Ignorados |
| ------------------------------------ | --------: | ---------: | --------: |
| Específicos de Percentual de Acertos |        30 |          0 |         0 |
| Relatório Final na execução conjunta |        27 |          0 |         0 |
| Total da execução conjunta           |        57 |          0 |         0 |

Não houve cancelamentos ou TODOs. Os comandos retornaram 0. A primeira
execução específica teve 30 aprovações; a execução conjunta após formatação
repetiu esses 30, sem somá-los novamente. Os 27 testes anteriores foram
executados com suas expectativas intactas; a falha histórica do relatório
não reapareceu no código atual, já corrigido pelo desenvolvedor antes desta
rodada. O relatório histórico anterior foi preservado.

Nenhum defeito funcional foi reproduzido nos cenários desta suíte. Os resultados
são unitários e não homologam o navegador ou a API real.

## Cobertura

- Uma única chamada GET /criancas/:usuarioId/resumo-desempenho e Bearer com token
  sem espaços; não utiliza o antigo endpoint de progresso nem busca outras rotas.
- Percentuais 0%, 72%, 66,67% (número 66.67 na API) e 100% no centro do gráfico,
  legendas, descrição acessível e limites do conic-gradient.
- Uso direto de resumo.percentualAcertos: uma fixture deliberadamente divergente
  dos contadores comprova que não há recálculo; outra faz os getters de acertos
  e erros falharem caso sejam lidos, e o componente continua passando.
- Complemento para respostas incorretas e diferença entre 0% com tentativas e
  ausência de histórico: sem tentativas aparece mensagem específica e nenhum
  gráfico de 100% de erros.
- Texto RENDIMENTO DA CONTA / Percentual de acerto, descrição de acertos,
  legendas de corretas/incorretas, classes azul/laranja, cores do gradiente
  e role=img com aria-label.
- Ausência de percentual demonstrativo no estado inicial.
- JWT cancelado, vazio e apenas espaços, sem chamada HTTP.
- HTTP 401/403 com mensagem da API, fallback sem mensagem e falha de rede.
- Carregamento pendente e encerramento do carregamento em sucesso ou erro.
- Router não pronto e ID ausente não iniciam consulta nem pedem token.
- Troca de criança limpa os dados durante a consulta e apresenta o novo resultado.
- Nova consulta com 401, 403, rede ou JWT ausente não mantém gráfico antigo.
- Sucesso atrasado e erro atrasado de A não sobrescrevem o sucesso de B.
- Finally da consulta antiga não encerra o carregamento de B.
- Sucesso atrasado de A não remove o erro atual de B.
- Troca para criança sem histórico remove o gráfico anterior.

As corridas são controladas por promessas, sem sleeps arbitrários ou rede real.
O helper executa o cleanup do efeito ao mudar as dependências, ativando a
proteção consultaAtiva presente em produção. Os cálculos, mensagens, guardas,
callbacks e JSX executados são do componente real.

## Observação de apresentação

O valor numérico 66.67 é exibido literalmente como **66.67%**, inclusive na
legenda e descrição acessível. A formatação brasileira **66,67%** não está
implementada. Foi validado o valor fracionário e o uso direto da API; a vírgula
não foi imposta como requisito adicional nem tratada como defeito funcional
sem contrato explícito de localização. Se essa apresentação for exigida, a
correção mínima é formatar somente os textos para pt-BR, mantendo o número
da API e o valor numérico do gradiente. Nada foi alterado em produção.

## Infraestrutura e limites

Reutilizados node:test/assert, compilador JSX já incluído no Next, VM isolada
e renderToStaticMarkup do React. O helper existente relatorio.cjs recebeu
somente um parâmetro opcional de página, preservando o padrão relatorio, e o
mock do CSS correspondente. Apenas relatorio e percentual são aceitos.
Os testes antigos não foram modificados.

API, router, prompt, Head/Link, CSS Modules e hooks são controlados. A instância
Axios real não é carregada e imports não previstos são rejeitados. Não há
instalação, alteração de package.json/lockfile ou configuração.

O HTML gerado confirma estrutura, textos, atributos e estilo inline; não confirma
pixels, geometria pintada pelo navegador, CSS aplicado, responsividade, foco,
eventos reais, hidratação, batching/StrictMode, Next Router real, CORS ou JWT
validado pelo backend. Não houve execução DOM/ponta a ponta. A renderização
controlada verifica o estado após os efeitos; não certifica ausência de um
frame anterior entre renderização de nova URL e execução do efeito no navegador.

As regras da #107 foram preservadas: esta é uma consulta geral por criança,
com indicadores calculados no backend, sem nova exigência de sessão de jogo
para o responsável nem tentativa de derivar desbloqueios por partida.

## Arquivos

- Criado: tests/percentual.test.cjs.
- Criado: tests/percentual.relatorio.md.
- Ajustado: tests/helpers/relatorio.cjs para reutilização nas duas páginas.

## Comandos executados

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=tap tests/percentual.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/percentual.test.cjs tests/relatorio.test.cjs
node node_modules/eslint/bin/eslint.js tests/percentual.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/percentual.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/percentual.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe e ESLint passaram. Prettier utilizou somente a instalação existente,
sem formatar produção. Backend, banco, documentos de contexto e dependências
não foram modificados. Não houve commit ou push.
