# Detalhes da Criança — testes automatizados

## Revalidação após as correções manuais — 30/10/2026

**As oito falhas funcionais anteriores não foram reproduzidas no código atual.**
O componente agora utiliza idAtualRef e versaoSelecaoRef para invalidar resultados
de gravações antigas e protege os botões/handlers de abertura de modal.
Nenhum código de produção foi alterado nesta revalidação.

### Resultados efetivamente executados

| Etapa                                                                      | Aprovados | Reprovados | Ignorados |
| -------------------------------------------------------------------------- | --------: | ---------: | --------: |
| Primeira reexecução dos 55 cenários, antes de ajustar a precondição antiga |        54 |          1 |         0 |
| Reexecução dos 55 após ajuste pontual da precondição                       |        55 |          0 |         0 |
| Detalhes ampliado: 55 anteriores + 56 novos                                |       111 |          0 |         0 |
| Seis páginas anteriores na regressão final                                 |       174 |          0 |         0 |
| Total da regressão final após formatação                                   |       285 |          0 |         0 |

O comando final retornou 0, sem cancelamentos ou TODOs. As etapas são execuções
repetidas e não devem ser somadas entre si. As seis suítes anteriores mantiveram
seus arquivos, cenários e expectativas intactos.

### Compatibilidade da primeira execução

A correção passou a usar useRef. O helper recebeu suporte a refs com identidade
preservada entre renderizações da mesma instância, antes de executar os testes;
nenhuma expectativa funcional foi alterada nessa preparação.

A única falha da primeira rodada ocorreu numa precondição do teste de substituição
de modal: ele exigia que Bloquear jogo estivesse habilitado, para reproduzir o
defeito antigo. Agora disabled é true, conforme a correção solicitada.

Foi alterado somente esse pressuposto, de assert.notEqual(disabled, true) para
assert.equal(disabled, true), e o nome do teste. A chamada direta ao handler e
a asserção final de que o modal permanece o mesmo foram preservadas. Portanto,
o ajuste exige a proteção correta e continua verificando o comportamento, sem
suprimir o cenário ou aceitar substituição indevida de modal.

### Situação individual das oito falhas anteriores

| Falha anterior                                            | Evidência atual                                  | Situação  |
| --------------------------------------------------------- | ------------------------------------------------ | --------- |
| Botão principal Limite habilitado durante salvando        | disabled=true                                    | Corrigida |
| Botão principal Bloquear jogo habilitado durante salvando | disabled=true                                    | Corrigida |
| Handler substituía o modal durante salvando               | Invocação direta não chama setter nem muda modal | Corrigida |
| Permissão antiga de A aplicada à interface de B           | Estado atual preservado, sem setters obsoletos   | Corrigida |
| Limite salvo em A aplicado à interface de B               | Limite de B permanece 120                        | Corrigida |
| Remoção de limite de A aplicada à interface de B          | Limite de B permanece 120                        | Corrigida |
| Desvinculação antiga redirecionava a seleção de B         | Sem alerta ou navegação antigos                  | Corrigida |
| Erro de gravação antiga aparecia na seleção atual         | Sem alerta ou log obsoleto                       | Corrigida |

### Ampliação da cobertura: 56 casos

- **32 casos:** quatro operações × sucesso/erro × A → B, A → B → A,
  cleanup/desmontagem e repetição simulada do efeito. Verificam ausência de
  setters, alertas, logs e navegação obsoletos. Após navegação, conferem nome,
  permissão, limite e ausência de modal indevido. Após desmontagem, não renderizam
  a instância desmontada: verificam as tentativas de atualização registradas.
- **16 casos:** quatro operações × sucesso/erro antigo × A → B ou A → B → A,
  com uma operação nova pendente. A conclusão antiga não altera o modal,
  não libera o botão da operação atual e não permite envio duplicado. A nova
  operação depois conclui normalmente, com seu valor, alerta ou navegação próprios.
- **4 casos:** durante cada operação, todos os três botões principais ficam
  desabilitados e seus handlers, mesmo invocados diretamente, não modificam modal
  nem estado. Os controles de fechamento e repetição do modal já existentes passam.
- **2 casos:** sucesso e erro de GET pendente após cleanup não provocam atualizações.
- **2 casos:** sucesso e erro de GET da primeira visita a A não alteram a segunda
  visita a A após A → B → A.

As quatro operações são alternarConta, salvarLimite, removerLimite e
confirmarExclusao. As duas visitas a A têm o mesmo ID, mas gerações diferentes;
os testes confirmam que a versão da seleção evita aceitar a primeira operação
somente porque o identificador voltou a coincidir.

As novas operações usam o ID da seleção atual. A requisição antiga continua
dirigida à criança que a originou; ignorar seus efeitos visuais não desfaz nem
cancela uma gravação já enviada ao backend. A suíte não acessa MongoDB.

### Defeitos novos e limites da conclusão

**Nenhum novo defeito funcional foi reproduzido nos cenários executados.** Não
há correção adicional de produção recomendada com base nesta rodada. Preservar
as guardas de ID/versão nos caminhos de sucesso, catch e finally, assim como os
controles de salvando nos botões e handlers.

Strict Mode foi simulado somente por setup → cleanup → setup com estado e refs
preservados. Não houve renderização StrictMode/createRoot real, DOM, navegador,
clique atravessando overlay, teste de foco/Tab, hidratação ou batching. O prompt
provisório continua podendo ser chamado duas vezes nessa sequência simulada.

Trocas de seleção são exercitadas por renderização e execução controlada de
efeitos; não certificam todos os interleavings possíveis de renderização
concorrente, frames antes dos efeitos ou acesso real pelo navegador. As
requisições e respostas são simuladas, não evidências de confirmação/rollback
ou de estado real do servidor. Esses limites não foram classificados como
novas falhas comprovadas.

### Arquivos modificados nesta revalidação

- tests/detalhes.test.cjs: ajuste justificado de uma precondição e 56 novos casos.
- tests/helpers/relatorio.cjs: suporte ao hook useRef, com refs persistentes.
- tests/detalhes.relatorio.md: resultados atuais, preservando o diagnóstico anterior.

Não foram criados arquivos novos nesta rodada. As seis suítes anteriores não
foram editadas. Produção, backend, MongoDB, dependências e documentos de contexto
permaneceram intactos; sem instalação, commit ou push.

### Comandos executados

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs tests/adicionarConta.test.cjs tests/contas.test.cjs tests/resumo.test.cjs tests/relatorio.test.cjs tests/percentual.test.cjs tests/evolucao.test.cjs
node node_modules/eslint/bin/eslint.js tests/detalhes.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/detalhes.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/detalhes.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe, ESLint e formatação passaram. O formatador existente foi aplicado apenas
aos testes/relatório; não houve formatação de componentes de produção.

## Registro histórico — diagnóstico anterior às correções

Os resultados 47/8/0 e os defeitos abaixo pertencem à rodada anterior. Foram
preservados para rastreabilidade e devem ser lidos junto da revalidação acima;
não representam a situação atual nos cenários executados.

---

Validação em **30/10/2026**, Node.js 24.22.1. Página real examinada:
`src/pages/responsavel/detalhes/index.js`.

Consultados os três documentos de contexto/arquitetura, a implementação atual,
CSS, configuração Strict Mode e infraestrutura em tests/. As regras da #107
permanecem no backend; as operações do responsável usam Crianca._id, enquanto
a query de seleção da página usa Usuario._id.

## Resultado efetivamente executado

| Escopo                                       | Aprovados | Reprovados | Ignorados |
| -------------------------------------------- | --------: | ---------: | --------: |
| Detalhes da Criança: 55 testes               |        47 |          8 |         0 |
| Seis páginas anteriores na execução conjunta |       174 |          0 |         0 |
| Total conjunto após formatação               |       221 |          8 |         0 |

As seis suítes anteriores mantiveram cenários e expectativas intactos:
Adicionar Conta (25), Contas (27), Resumo (30), Relatório (27), Percentual (30)
e Evolução (35). Não houve regressão reproduzida nesses 174 casos.

Os comandos específico e conjunto retornaram 1 por asserções funcionais,
não por erro de módulos. Sem cancelamentos ou TODOs. A primeira rodada também
teve 47/8/0; não somar execuções repetidas. As oito expectativas reprovadas
permanecem ativas, sem relaxamento para obter aprovação.

## Comportamentos aprovados

### Consulta

- GET /responsaveis/minhas-criancas com Bearer e trim do token.
- Seleção por usuarioId da URL, incluindo fixture de colisão em que outra
  criança tem _id igual ao usuarioId procurado: a seleção continua correta.
- JWT ausente/null, vazio ou espaços; criança não vinculada; HTTP 401/403 e rede.
- Mensagem genérica atual nos erros da consulta, carregamento e ausência de
  ações antes de localizar a criança.
- Router não pronto e ID ausente não pedem token nem fazem requisições.
- Troca de ID limpa perfil/modal e carrega a nova criança.
- Sucesso e erro de GET antigo são ignorados após mudança de criança.
- Sequência simulada setup → cleanup → setup: prompt repetido e primeira
  consulta invalidada; segundo prompt cancelado não mantém perfil/carregamento.

### Permissão

- PATCH .../:Crianca._id/permissao com booleano false para bloquear e true
  para liberar, além do header de autorização.
- Estado visual da permissão só muda após sucesso da requisição.
- Falha mantém a permissão anterior e o modal, mostra mensagem do backend ou
  fallback de rede, não apresenta sucesso nem redireciona e permite nova tentativa.

### Limite diário

- PATCH .../:Crianca._id/limite-tempo com números inteiros positivos: 1, 30, 1440.
- Rejeição antes de PATCH para zero, negativo, decimal, vazio, espaços, texto,
  Infinity e NaN, mantendo o modal disponível para correção.
- Remoção usa exatamente limiteTempoDiario:null e Bearer; criança sem limite
  apresenta campo vazio.
- Salvar utiliza o valor devolvido pelo backend: envio de 90 com resposta 45
  faz a reabertura do modal mostrar 45.
- Falhas mantêm modal e rascunho editado, sem falso sucesso; botão volta a ficar
  disponível e a tentativa seguinte funciona.

### Desvinculação e controles

- Primeiro botão somente abre confirmação. DELETE só ocorre na confirmação,
  usando Crianca._id e JWT.
- Texto informa desvinculação, preservação da conta e do histórico; não descreve
  exclusão da conta.
- Sucesso apresenta mensagem e router.push('/responsavel/contas'); erros não
  redirecionam e permitem recuperar.
- Nas quatro operações, todos os botões do modal ficam disabled durante salvando;
  novas chamadas ao handler renderizado em carregamento não repetem a requisição.
- Clique controlado no fundo não fecha durante salvando. Cancelamento/fundo
  fecham normalmente quando nenhuma operação está pendente.

## Oito falhas: dois grupos de causa

### A. Operações antigas afetam a seleção atual — cinco testes

Reprodução comum, usando promessas controladas e callbacks reais:

1. Consultar A e iniciar uma operação, mantendo a resposta pendente.
2. Alterar a query para Usuario._id de B e concluir sua consulta.
3. Confirmar que o perfil exibido é B, com permissão ativa e limite de 120 minutos.
4. Resolver ou rejeitar a operação antiga de A.

| Teste                                                                            | Esperado                             | Obtido                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| resultado antigo de permissao não deve alterar a criança selecionada depois      | B continua Ativa                     | B passa a Desativada na interface                                |
| resultado antigo de salvar-limite não deve alterar a criança selecionada depois  | B mantém 120 min                     | Modal de B passa a mostrar 90 min da resposta de A               |
| resultado antigo de remover-limite não deve alterar a criança selecionada depois | B mantém 120 min                     | Modal de B fica vazio, como se não tivesse limite                |
| resultado antigo de desvincular não deve alterar a criança selecionada depois    | Nenhuma navegação da operação antiga | Redireciona para /responsavel/contas enquanto B está selecionada |
| erro de gravação antiga não deve aparecer na seleção de outra criança            | Nenhum alerta obsoleto               | Alerta “Erro antigo da criança A” aparece na seleção de B        |

**Causa no código:** alternarConta(), salvarLimite(), removerLimite() e
confirmarExclusao() não verificam se o contexto da operação continua atual
depois do await. A proteção consultaAtiva é local ao GET e não protege esses
handlers. O setCrianca funcional mescla resultados de A com o documento atual
de B; setAtiva/setLimite, fechamento de modal, alertas e navegação também não
têm invalidação por mudança de seleção.

**Correção mínima recomendada:** associar cada gravação à seleção/execução que
a iniciou e invalidar seus efeitos de interface ao mudar de criança ou desmontar.
Proteger atualizações, alertas, fechamento de modal, navegação, catch e finally.
Uma referência atual ou invalidação no cleanup pode cumprir essa função sem
alterar a arquitetura. Ao iniciar a nova seleção, tratar o estado salvando para
não deixá-la presa; um finally antigo não deve liberar uma nova operação.
Comparar apenas duas variáveis capturadas pela mesma closure antiga não basta.

**Escopo da evidência:** as requisições capturadas continuam dirigidas ao
Crianca._id de A. Nenhuma escrita para B foi emitida pelo teste. O problema
reproduzido é mistura de estado/efeitos no frontend; não demonstra alteração
indevida de B no MongoDB, que não foi acessado. A gravação original em A pode
ser válida; sua conclusão não deve ser aplicada à seleção visual de B.

### B. Abertura de outro modal durante salvando — três testes

Testes reprovados:

1. botão principal Limite de tempo por dia deve ficar desabilitado enquanto salvando.
2. botão principal Bloquear jogo deve ficar desabilitado enquanto salvando.
3. acionar outro botão ainda habilitado não deve substituir o modal durante salvando.

**Esperado:** ações principais indisponíveis e modal da operação mantido.

**Obtido:** os dois botões não têm disabled (prop undefined); seus handlers
chamam setModal sem conferir salvando. Ao iniciar salvamento do limite e invocar
o botão ainda habilitado de Bloquear jogo, o modal muda para permissão.
O botão principal Desvincular Criança e os botões internos do modal já possuem
disabled=salvando.

**Correção mínima recomendada:** aplicar disabled=salvando aos dois botões
principais e impedir setModal por seus handlers durante operação pendente,
preservando as proteções de fundo e dos botões internos já existentes.

**Comprovado em unidade:** props habilitadas e substituição do modal ao executar
seu handler real. **Não comprovado no navegador:** clique de ponteiro atravessar
o overlay. O CSS contém fundo fixo com z-index; a suíte não testa hit testing,
foco/Tab ou sobreposição real. A exposição por teclado é risco a verificar,
não foi apresentada como reprodução visual já realizada.

## Limitações e riscos não certificados

- São testes unitários com hooks, API, router, prompt e alert simulados. Não
  homologam navegador, CSS, navegação, DOM, batching, hidratação ou rede real.
- Strict Mode foi representado somente pela repetição controlada de setup,
  cleanup e setup com estado preservado. Há duas chamadas de prompt nessa
  sequência; não se certifica frequência ou experiência do diálogo nativo.
- IDs/headers e mensagens são testados, mas vínculo/autorização/versionamento
  reais do backend não são revalidados. Nenhum MongoDB foi acessado.
- Cliques em botões disabled não são invocados para afirmar comportamento DOM.
  Seus atributos são verificados; a proteção do fundo é exercitada diretamente.
- O bloqueio de envios repetidos é testado após renderizar salvando=true; não
  certifica reentrância sintética antes do commit do React ou duplo clique real.
- A limpeza da seleção é observada após executar o efeito; não certifica ausência
  de um frame anterior antes da execução do efeito no navegador.
- Não se propõe cancelamento como rollback da gravação já enviada: ignorar um
  resultado obsoleto na interface não desfaz uma operação confirmada no backend.
- Não foram introduzidas novas regras de permissão, minutos/segundos, consumo
  diário, sessão ou progressão. As decisões da #107 continuam preservadas.

## Arquivos e comandos

- Criado: tests/detalhes.test.cjs.
- Criado: tests/detalhes.relatorio.md.
- Ajustado: tests/helpers/relatorio.cjs para compilar Detalhes e simular PATCH/DELETE.

A partir de frontend:

```powershell
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs
node --test --test-concurrency=1 --test-reporter=spec tests/detalhes.test.cjs tests/adicionarConta.test.cjs tests/contas.test.cjs tests/resumo.test.cjs tests/relatorio.test.cjs tests/percentual.test.cjs tests/evolucao.test.cjs
node node_modules/eslint/bin/eslint.js tests/detalhes.test.cjs tests/helpers/relatorio.cjs
```

A partir da raiz do workspace:

```powershell
node --check frontend/tests/detalhes.test.cjs
node --check frontend/tests/helpers/relatorio.cjs
node backend/node_modules/prettier/bin/prettier.cjs --write frontend/tests/detalhes.test.cjs frontend/tests/helpers/relatorio.cjs
```

Sintaxe e ESLint passaram. O Prettier já instalado foi usado somente nos
arquivos de testes/relatório. Nenhuma dependência foi instalada e nenhum
componente, backend, banco ou documento de contexto foi alterado. Sem commit
ou push. Os defeitos de produção não foram corrigidos automaticamente.
