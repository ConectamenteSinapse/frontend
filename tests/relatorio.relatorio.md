# Relatório Final — testes automatizados do frontend

Validação em 29/10/2026, Node.js 24.22.1. Alvo:
`src/pages/responsavel/rendimento/relatorio/index.js`.

Consultados os três documentos de contexto/arquitetura, a página atual,
o módulo Axios, package.json e a estrutura de testes disponível. A documentação
anterior ainda descreve a tabela demonstrativa; esta rodada usa o componente
local atualizado, com resumo-desempenho e a tabela por cômodo.

## Resultado efetivamente executado

| Execução final             | Aprovados | Reprovados | Ignorados |
| -------------------------- | --------: | ---------: | --------: |
| `tests/relatorio.test.cjs` |        26 |          1 |         0 |

São 27 testes, sem agrupadores, cancelamentos ou TODOs. O comando retorna 1
por uma asserção funcional, não por erro de compilação/carregamento. A primeira
rodada e a repetição após a formatação tiveram o mesmo resultado; não somar
essas execuções como testes diferentes. A falha permanece ativa, sem alterar
expectativas para obter aprovação.

## Estratégia e limites

Não havia script de testes, suítes de frontend, Testing Library,
react-test-renderer, Jest/Vitest, jsdom ou happy-dom. Essa limitação foi
comunicada antes da criação. Não houve instalação de dependências nem alteração
de scripts/configuração.

Foi reutilizado o runner nativo `node:test`, também usado no backend. O Babel
incluído na instalação existente do Next compila o JSX em memória; o módulo
real da página é executado em contexto isolado. API, router, prompt, CSS Modules,
Head/Link e hooks são controlados pelo helper de teste. O renderizador existente
react-dom/server produz HTML real da árvore retornada pelo componente.

O helper mantém estado entre renderizações, executa callbacks reais dos efeitos
e permite controlar promessas e limpezas após mudança de dependências. Não
reimplementa a associação, ordenação, percentuais ou tratamento de erros da página.
Imports inesperados falham e a instância Axios real não é carregada: nenhuma
requisição HTTP ou conexão MongoDB é necessária.

**São testes unitários do componente com hooks controlados**, não uma suíte DOM
ou de navegação real. Não certificam reconciliação/batching do React, StrictMode,
Next Router em execução, hidratação, CSS, responsividade, interação com prompt
real, acessibilidade completa ou CORS/autenticação reais. Não se declarou
aprovação desses cenários. O compilador interno do Next usado pelo helper pode
precisar de ajuste se essa dependência mudar.

## Cobertura executada

| Comportamento solicitado | Evidência                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Indicadores gerais       | Valores recebidos da API, sem somar as linhas localmente                                                |
| Associação de IDs        | Catálogo e histórico em ordens distintas                                                                |
| Ordenação                | Ordem numérica 2/10/100, diferente do nome e da ordem recebida                                          |
| Cômodo sem tentativas    | Contadores zero e percentual `—`                                                                        |
| Percentual do backend    | Valor deliberadamente diferente da razão local é preservado; também 0% e 100%                           |
| Criança sem histórico    | Indicadores zerados, catálogo completo e ausência de NaN/undefined                                      |
| JWT ausente              | Cancelamento, vazio e espaços; mensagem e zero chamadas                                                 |
| HTTP 401/403             | Mensagem da API, ausência de dados e tratamento de erro                                                 |
| Comunicação              | Mensagem padrão quando não existe resposta HTTP                                                         |
| Carregamento             | Promessas pendentes, dados ocultos e remoção do indicador ao terminar                                   |
| Vínculo ausente          | Mensagem correspondente, sem identidade/indicadores/tabela                                              |
| Endpoints                | Exatamente os três endpoints aprovados, ID da conta na URL e Bearer; nenhuma consulta de tarefas        |
| Dados demonstrativos     | Linhas originadas nas fixtures; ausência de fases, datas, nomes e estados antigos                       |
| Nova consulta falha      | Após sucesso de A e mudança para B: 401, 403, rede, JWT ausente e vínculo ausente ocultam os dados de A |
| Consultas concorrentes   | Resposta atrasada de A após sucesso de B: teste reprovado descrito abaixo                               |

Também passaram os controles de router ainda não pronto, ID ausente e
ocultação dos dados anteriores durante o carregamento da nova consulta.

O contrato continua geral por criança, agregado pelo backend entre partidas.
Não foram acrescentadas regras de progressão, cálculo de estrelas, sessão de
jogo ou necessidade de sessaoId a essa consulta do responsável. Nenhuma regra
da issue #107 foi modificada.

## Defeito reproduzido: consulta anterior sobrescreve a atual

Teste: **uma resposta atrasada da criança anterior não deve sobrescrever o
relatório da criança atual**.

Sequência com as callbacks reais do componente e respostas simuladas:

1. Router aponta para o usuário A; suas três requisições ficam pendentes.
2. O ID muda para B, iniciando outra consulta no mesmo componente.
3. As respostas de B chegam primeiro; o HTML exibe `Criança atual B`.
4. As respostas de A chegam depois.
5. O HTML passa a exibir `Criança antiga A`, embora o router continue em B.

Esperado: manter o relatório de B e ignorar o resultado obsoleto de A.
Obtido: A substitui criança, resumo e catálogo. Mensagem da asserção:
`Resposta atrasada de A exibida na URL de B`.

Causa: o useEffect depende de id, mas não retorna limpeza nem invalida consultas
anteriores. buscarRelatorio() aplica seus setters após Promise.all sem conferir
se a consulta ainda corresponde à seleção atual. Catch/finally antigos também
não têm essa proteção.

Menor correção recomendada para implementação manual pelo desenvolvedor:
invalidar a execução anterior no cleanup do efeito e conferir essa validade
antes de atualizar dados, erro ou carregamento. Cancelamento de rede pode
complementar isso, mas não deve provocar mensagens de erro de consulta obsoleta.
Não é necessária mudança de endpoint, cálculo ou arquitetura.

Esta é uma falha reproduzida no teste unitário controlado; a navegação
concorrente não foi reproduzida nesta rodada em navegador real. O componente
permaneceu intacto. A revalidação deve manter esta expectativa.

As cinco variantes de falha da nova consulta passaram: os dados antigos
continuam armazenados em estado, mas o JSX os oculta por erro/carregamento.
Esses resultados não eliminam o problema de respostas fora de ordem.

## Arquivos criados

- `tests/relatorio.test.cjs`: cenários e fixtures da API.
- `tests/helpers/relatorio.cjs`: instrumentação isolada, renderização e leitura do HTML.
- `tests/relatorio.relatorio.md`: este relatório.

## Comandos

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=tap tests/relatorio.test.cjs
```

A partir da raiz do workspace, somente sobre os dois arquivos de testes:

```powershell
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/helpers/relatorio.cjs frontend/tests/relatorio.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node --check frontend/tests/relatorio.test.cjs
```

O formatador já instalado foi utilizado apenas nos testes; nenhuma dependência
foi instalada. Não houve modificação de produção, backend, configuração,
package.json/lockfile ou documentos de contexto, acesso a banco, commit ou push.

Verificações finais aprovadas:

- `node --check` nos dois arquivos JavaScript.
- Prettier `--check` nos três arquivos criados.
- A partir de frontend: `node node_modules/eslint/bin/eslint.js tests/relatorio.test.cjs tests/helpers/relatorio.cjs` (exit 0, sem avisos).
- Comparação SHA-256: 357 arquivos pré-existentes de backend/frontend intactos;
  somente os três arquivos de testes/relatório foram acrescentados. Excluídos
  da coleta de hashes .git, node_modules, .next e arquivos de ambiente.

Uma chamada inicial ao ESLint usou o diretório raiz do workspace e não encontrou
o executável; a chamada corrigida acima foi executada em frontend e passou.
Esse erro de caminho não integra a contagem de testes nem é falha do componente.
