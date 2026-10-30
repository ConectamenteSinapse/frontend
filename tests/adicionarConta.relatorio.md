# Adicionar Conta — testes automatizados

Validação em **30/10/2026**, Node.js 24.22.1. Componente real:
`src/pages/responsavel/adicionar-conta/index.js`.

Consultados os três documentos de contexto/arquitetura, a página atual,
seu CSS, módulo API, package.json e a infraestrutura de tests/.

## Resultados efetivamente executados

| Escopo                               | Aprovados | Reprovados | Ignorados |
| ------------------------------------ | --------: | ---------: | --------: |
| Adicionar Conta                      |        25 |          0 |         0 |
| Contas na execução conjunta          |        27 |          0 |         0 |
| Resumo na execução conjunta          |        30 |          0 |         0 |
| Relatório Final na execução conjunta |        27 |          0 |         0 |
| Percentual na execução conjunta      |        30 |          0 |         0 |
| Evolução na execução conjunta        |        35 |          0 |         0 |
| Total conjunto após formatação       |       174 |          0 |         0 |

Ambos os comandos retornaram 0, sem cancelamentos ou TODOs. Os 25 específicos
foram repetidos na execução conjunta e já estão nos 174; não somar novamente.
Os cenários e expectativas das cinco suítes anteriores permaneceram intactos.

**Nenhum defeito funcional reproduzido na página Adicionar Conta nos cenários
executados.** Não houve edição de produção nem homologação em navegador.

Os três casos historicamente reprovados em Contas também passaram nesta rodada.
Antes de qualquer alteração de testes, o código atual de Contas já apresentava
setCarregando(false) no caminho de JWT ausente. Nenhuma correção desse componente
foi feita nesta etapa; o relatório histórico foi preservado.

## Cobertura dos 18 cenários

| Requisito                | Verificação executada                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Formulário               | Título, labels associados por htmlFor/id, tipos email/password, required e valores iniciais    |
| preventDefault           | Chamado antes da validação, em formulário vazio, envio válido e tentativa durante carregamento |
| Campos vazios            | E-mail vazio/espaços, senha vazia/espaços e ambos vazios, sem prompt/POST                      |
| JWT ausente              | Cancelamento/null, vazio e espaços bloqueiam POST e redirecionamento                           |
| Endpoint                 | Método POST e caminho exato /responsaveis/vincular-crianca                                     |
| Corpo                    | Somente email/senha com valores informados; senha não vazia preserva espaços                   |
| Authorization            | Bearer com JWT fictício do responsável e trim do token                                         |
| Sucesso único            | Exatamente um alerta de sucesso por envio concluído                                            |
| Redirecionamento         | Uma chamada a router.push('/responsavel/contas') após sucesso                                  |
| Erro do backend          | Alerta usa response.data.mensagem                                                              |
| HTTP 400/401/403/404/409 | Um teste por status, sem sucesso ou redirecionamento indevido                                  |
| Comunicação              | Falha de rede e resposta HTTP sem mensagem usam o fallback atual                               |
| Botão desabilitado       | disabled=true durante promessa pendente                                                        |
| Vinculando...            | Texto exibido enquanto a API não conclui                                                       |
| Repetição de envio       | Novos submits após renderizar carregamento não geram outros POSTs/prompts                      |
| Reabilitação             | Botão volta a Continuar/disabled=false após falha e aceita nova tentativa                      |
| Sem navegação no erro    | Nenhuma chamada de redirecionamento nos erros de validação/JWT/HTTP/rede                       |
| Campos preservados       | Valores continuam disponíveis após falha e podem ser reenviados                                |

Também verificados onChange dos campos controlados, ausência de requisição ao
renderizar, link de retorno para Contas e falha seguida de nova tentativa com
sucesso, sem precisar preencher novamente o formulário.

O componente usa a mesma regra de apresentação para os cinco status HTTP:
mensagem do backend quando existe, fallback quando ausente. Os testes não
inventam mensagens ou fluxos específicos de status não implementados.

## Infraestrutura reutilizada e limites

Reutilizados node:test/assert, compilação JSX em memória pelo Babel incluído
no Next, VM isolada e renderToStaticMarkup. O helper existente recebeu a
página adicionar-conta, o nome atual de seu CSS (AdcionarConta.module.css),
POST simulado, captura de alert/console.log e registro de router.push.
Os GETs, hooks controlados e comportamento das outras páginas foram preservados.

Os testes preenchem os campos chamando os onChange reais do JSX, renderizam
novamente e invocam o onSubmit real com evento controlado. A API real não é
importada e nenhuma comunicação HTTP/MongoDB é feita. Somente credenciais
fictícias são usadas. Imports desconhecidos falham.

Não há DOM/reconciliador real, validação HTML nativa, eventos de teclado/clique,
diálogos nativos, navegação Next ou CSS aplicado. Os testes verificam os
atributos required/type, a validação JavaScript de campos vazios, as callbacks
e as props/HTML gerados; não homologam a validação nativa de formato de e-mail.
Alertas e redirecionamentos são chamadas registradas, não diálogos ou mudança
real de página no navegador. Não se certificam batching, hidratação, Strict Mode,
CORS ou vínculo/autorização reais do backend.

O bloqueio de envio repetido é exercitado após uma renderização que observa
carregando=true, incluindo chamadas diretas ao novo handler apesar do botão
desabilitado. Isso não certifica reentrância sintética do mesmo handler antes
de o React renderizar/confirmar o estado nem equivale a teste real de duplo clique.

Essas são limitações da infraestrutura unitária existente, não cenários
declarados aprovados em navegador. Não foram instaladas dependências.

## Arquivos

- Criado: tests/adicionarConta.test.cjs.
- Criado: tests/adicionarConta.relatorio.md.
- Ajustado: tests/helpers/relatorio.cjs.

## Comandos executados

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/adicionarConta.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/adicionarConta.test.cjs tests/contas.test.cjs tests/resumo.test.cjs tests/relatorio.test.cjs tests/percentual.test.cjs tests/evolucao.test.cjs
node node_modules/eslint/bin/eslint.js tests/adicionarConta.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/adicionarConta.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/adicionarConta.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe e ESLint aprovados. O Prettier já instalado foi aplicado somente aos
arquivos de testes/relatório. Produção, backend, MongoDB, dependências e
documentos de contexto não foram modificados. Sem commit ou push.
