# Contas do Responsável — testes automatizados

Validação em **30/10/2026**, Node.js 24.22.1. Página real examinada:
`src/pages/responsavel/contas/index.js`.

Consultados os três documentos de contexto/arquitetura, a página atual,
next.config.mjs e a infraestrutura em tests/. A página atual tem cleanup com
consultaAtiva e já trata JWT ausente; não usa mais o antigo ref de execução única.

## Resultados efetivamente executados

| Escopo                                          | Aprovados | Reprovados | Ignorados |
| ----------------------------------------------- | --------: | ---------: | --------: |
| Contas do Responsável                           |        24 |          3 |         0 |
| Quatro telas de rendimento na execução conjunta |       122 |          0 |         0 |
| Total conjunto após formatação                  |       146 |          3 |         0 |

São 27 testes novos e 122 anteriores, totalizando 149. Os comandos específicos
e conjunto retornaram 1 pelas três asserções funcionais descritas abaixo,
sem erro de compilação/carregamento, cancelamentos ou TODOs. As expectativas
reprovadas permanecem ativas. Não somar a primeira rodada aos resultados da
repetição após formatação.

Os 122 testes anteriores passaram com seus cenários intactos: Relatório Final
(27), Percentual de Acertos (30), Evolução (35) e Resumo (30). Nenhuma regressão
nessas quatro suítes foi reproduzida pela extensão do helper.

## Cobertura

- Exatamente GET /responsaveis/minhas-criancas e Authorization Bearer com token
  fictício do responsável, retirando espaços externos.
- Nome, e-mail e descrição do avatar de cada criança.
- Chaves reais dos articles iguais a conta._id, inclusive com ordem invertida.
  key é inspecionado na árvore JSX, pois não aparece no HTML.
- Links para rendimento usam conta.usuarioId, diferente de conta._id na fixture.
- Destinos de Adicionar Conta e retorno ao responsável preservados.
- Resposta vazia, estado inicial aguardando autenticação e carregamento pendente.
- JWT cancelado/null, vazio ou somente espaços, sem chamadas HTTP.
- HTTP 401/403 e erro de rede tratados pela mensagem genérica atual
  “Não foi possível carregar as contas.”, sem confundir falha com lista vazia.
- Renderização adicional sem remontagem não repete o efeito de dependências vazias.
- Sucesso, erro e lista vazia após cleanup não provocam novos setters nem logs
  do componente. Não se renderiza o componente desmontado para essa verificação.
- Sequência simulada setup → cleanup → setup: prompts repetidos, resposta/erro
  antigos ignorados e finally antigo sem encerrar carregamento da consulta nova.
- Cancelar o primeiro prompt e informar JWT no segundo funciona; cancelar ambos
  também mostra erro corretamente. Os três casos em que somente o segundo
  prompt é inválido revelam o defeito abaixo.

## Defeito funcional reproduzido na simulação unitária

Os três testes reprovados têm o nome:

**JWT válido no primeiro setup e [null / string vazia / espaços] no segundo
não deve deixar carregamento preso.**

Sequência:

1. A primeira execução recebe JWT válido e inicia uma requisição pendente,
   deixando carregando=true.
2. O cleanup invalida essa execução.
3. O setup é repetido, preservando o estado, mas o segundo prompt retorna null,
   string vazia ou espaços.
4. Esse caminho define erro e consultaRealizada, mas não redefine carregando.
5. A resposta da requisição antiga chega; sua proteção corretamente impede
   atualização de dados e o finally também não altera o carregamento.

**Esperado:** exibir “É necessário informar o JWT do responsável.”, sem lista
nem spinner, pois não existe consulta atual em andamento.

**Obtido nos três casos:** o HTML continua com “Carregando contas...”, mesmo
depois da conclusão da requisição antiga. O JSX dá prioridade ao carregamento
e oculta a mensagem de JWT ausente.

É um defeito de estado reproduzido com callbacks reais em um ciclo de efeitos
controlado. Não é uma alegação de reprodução em navegador com Strict Mode real.

**Menor correção recomendada, sem implementar:** definir carregando=false no
caminho de JWT ausente/inválido, ou reiniciar o estado da nova execução antes
de pedir o token. Preservar a proteção consultaAtiva; removê-la para permitir
que a requisição antiga desligue o spinner reintroduziria atualizações obsoletas.
Não é necessária mudança de endpoint, backend ou arquitetura.

## Strict Mode e prompt provisório

next.config.mjs declara reactStrictMode=true. A documentação oficial do React
descreve um ciclo adicional de setup/cleanup de efeitos em desenvolvimento:
[StrictMode — re-running Effects](https://react.dev/reference/react/StrictMode#fixing-bugs-found-by-re-running-effects-in-development).

O teste repete explicitamente setup → cleanup → setup com estado preservado,
executando as callbacks e limpezas reais da página. Não habilita um reconciliador
React, não usa createRoot/StrictMode real e não executa o servidor Next.

Nessa sequência simulada, o prompt dentro do efeito é chamado duas vezes. Se o
token for informado nas duas, há duas chamadas GET: a primeira continua sendo
enviada, embora sua resposta seja ignorada. O cleanup invalida a escrita no
estado; não cancela a comunicação em rede. Isso é uma limitação do fluxo de
autenticação provisório por prompt, não evidência de dois vínculos criados nem
autorização para remover Strict Mode. Frequência e comportamento visual dos
diálogos reais não foram homologados.

## Infraestrutura reutilizada e limitações

Reutilizados node:test/assert, Babel instalado com Next, VM isolada e
renderToStaticMarkup. O helper recebeu suporte à página contas, seu import
de API/CSS, exposição da árvore JSX e registro de setters, além de métodos
para executar cleanup e repetir efeitos em sequência controlada.

Fixtures usam IDs diferentes para conta infantil e usuário. Não há carregamento
da instância Axios real nem chamadas HTTP/MongoDB. Imports inesperados falham.
Nenhuma biblioteca ou configuração foi instalada/alterada.

Os links são verificados nas props reais do JSX; o mock de Next Link não
executa navegação nem preserva todos os seus atributos no HTML. As keys são
checadas nos React elements, sem testar reconciliação do DOM. A ausência de
setters após cleanup é observada por instrumentação unitária, sem uma
desmontagem React real. Essas verificações não substituem testes de interação,
hidratação, Strict Mode completo, CSS, acessibilidade, CORS ou JWT real.

Nenhum teste simulado foi contabilizado como aprovação de navegador. Produção,
backend, banco e os testes anteriores permaneceram intactos.

## Arquivos e comandos

- Criado: tests/contas.test.cjs.
- Criado: tests/contas.relatorio.md.
- Ajustado: tests/helpers/relatorio.cjs.

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/contas.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/contas.test.cjs tests/resumo.test.cjs tests/relatorio.test.cjs tests/percentual.test.cjs tests/evolucao.test.cjs
node node_modules/eslint/bin/eslint.js tests/contas.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/contas.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/contas.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe e ESLint passaram. Prettier foi utilizado somente em testes/relatório,
pela instalação existente. Nenhuma alteração de produção ou dependências,
acesso ao banco, commit ou push.
