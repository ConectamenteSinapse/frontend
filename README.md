# ConectaMente — Frontend

O ConectaMente é um projeto acadêmico voltado a apoiar crianças com Síndrome de Down na prática de tarefas da rotina diária. O jogo combina atividades visuais, perguntas com alternativas, feedback e acompanhamento por responsáveis, com o objetivo educacional de estimular a autonomia.

Este repositório contém a interface web. Autenticação, autorização, validação das respostas, histórico, pontuação e progresso persistido são responsabilidades da API backend.

## Situação atual

| Área | Situação |
| --- | --- |
| Quarto | Implementado: arrumar a cama, abrir a cortina e trocar de roupa nas três dificuldades, com salvamento automático e prática repetida. Homologação manual com API e MongoDB reais informada pela equipe. |
| Perfil da criança | Implementado: jornada selecionada, personagem, edição de nome e avatar, estrelas da jornada, tempo diário, progresso e seleção de dificuldade do Quarto. |
| Jogos Salvos | Implementado: criação pelo Novo Jogo, listagem, continuidade, visualização do Perfil da jornada e exclusão com confirmação. |
| Área do responsável | Telas integradas para contas vinculadas, permissão para jogar, limite diário e acompanhamento de desempenho. |
| Banheiro, Sala e Cozinha | Em desenvolvimento. Possuem apresentação no Perfil, mas não têm cenas jogáveis disponíveis. |
| Áudios das tarefas e respostas | Pendentes de entrega pelo integrante responsável. Os controles existentes não significam que a reprodução esteja concluída ou homologada. |

Testes automatizados com dados simulados e homologação com MongoDB real são evidências diferentes. A homologação manual informada acima não representa uma nova execução realizada para esta atualização documental.

## Tecnologias

- JavaScript, React **19.2.8** e React DOM **19.2.8**.
- Next.js **16.4.4**, usando o **Pages Router** (`src/pages`).
- Axios para chamadas HTTP e envio do JWT pelo interceptor em `src/services/api.js`.
- CSS Modules e estilos globais.
- Lucide React para ícones.
- ESLint 9 e `eslint-config-next` 16.4.4.
- React Compiler e React Strict Mode habilitados em `next.config.mjs`.
- Runner nativo do Node.js (`node:test`) e roteiros de navegador com Chrome headless.

As dependências e scripts estão em [package.json](package.json); o [package-lock.json](package-lock.json) registra a resolução das versões.

## Organização principal

```text
frontend/
├── public/
│   └── images/             # Ilustrações, avatares, cenários e alternativas
├── src/
│   ├── components/         # Login, cadastro, Perfil, menus e Jogos Salvos
│   │   └── jogo/           # CenaQuarto, RespostaCard e estilos do card
│   ├── pages/              # Rotas do Pages Router
│   │   ├── jogo/quarto.js  # Validação da partida, sessão, heartbeat e saída
│   │   └── responsavel/    # Contas, detalhes e acompanhamento
│   ├── services/api.js     # Cliente Axios compartilhado
│   └── styles/             # CSS Modules e estilos globais
├── tests/                  # Suítes .test.cjs, roteiros visuais e relatórios
├── next.config.mjs
├── package.json
├── package-lock.json
└── README.md
```

Rotas principais da interface:

| Rota | Finalidade |
| --- | --- |
| `/` | Login |
| `/cadastro` | Cadastro de uma conta de criança ou responsável |
| `/menu` | Menu da criança |
| `/escolher-personagem` | Novo Jogo e seleção visual de personagem |
| `/jogos-salvos` | Continuar, consultar ou excluir uma partida |
| `/perfil` | Perfil da criança e da jornada selecionada |
| `/perfil?jogoSalvoId=<id>` | Consultar uma jornada autorizada específica |
| `/jogo/quarto?jogoSalvoId=<id>` | Abrir o Quarto com uma partida real |
| `/responsavel` | Painel do responsável |
| `/responsavel/contas` | Contas infantis vinculadas |
| `/responsavel/adicionar-conta` | Vincular uma conta infantil existente |
| `/responsavel/detalhes` | Detalhes, permissão e limite da criança selecionada |
| `/responsavel/rendimento` | Acompanhamento, resumo, percentual, evolução e relatório |

Os identificadores devem vir das respostas autorizadas da API. Os códigos visuais de avatar não são IDs de documentos MongoDB.

## Pré-requisitos

- Node.js e npm. Para reproduzir o ambiente inspecionado, use **Node.js 24**; a versão local verificada foi 24.22.1. O pacote Next.js instalado declara mínimo `>=20.9.0`, mas isso não comprova compatibilidade de toda a suíte com cada versão intermediária.
- Backend do ConectaMente configurado e disponível para uso real da interface.
- MongoDB configurado **no backend**, com suporte a transações para registrar respostas, como Atlas ou replica set.
- Catálogo das tarefas e respostas do Quarto compatível com a integração atual.
- Para jogar, uma conta infantil com permissão ativa, concedida pelo responsável.

Não é necessário configurar conexão MongoDB no frontend. Siga o README do repositório backend para preparar a API, o banco e seus próprios testes.

## Instalação e configuração

No terminal, dentro da pasta do repositório frontend:

```sh
npm ci
```

Não há `.env.example` neste checkout. Crie localmente um arquivo `.env.local`, na mesma pasta do `package.json`, com a variável efetivamente utilizada pelo cliente HTTP:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000
```

| Variável do frontend | Uso |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL base da API. O `api.js` não define um endereço padrão quando ela está ausente. |

O endereço acima é um exemplo local, sem prefixo `/api`. Na configuração local descrita pelo backend, a API usa a porta 4000 e o frontend a porta 3000. A origem autorizada no CORS do backend deve corresponder à origem do frontend.

Variáveis com prefixo `NEXT_PUBLIC_` são expostas ao navegador. Não coloque senhas, JWT, segredos de assinatura ou URI do MongoDB nelas. Arquivos `.env*` estão ignorados pelo Git neste repositório. Reinicie o servidor de desenvolvimento após alterar a configuração; para produção, gere novamente o build.

## Execução local

Com a API disponível, execute:

```sh
npm run dev
```

Acesse `http://localhost:3000`, considerando a porta informada pelo terminal. Se utilizar outra porta, ajuste também a origem permitida pelo backend.

Para gerar e executar o build de produção local:

```sh
npm run build
npm run start
```

`npm run start` exige um build prévio. A execução do frontend não inicia a API nem prepara o catálogo no MongoDB.

## Autenticação e perfis de acesso

- O login usa `POST /usuarios/auth`, com email e senha. O JWT e os dados do usuário são armazenados em `localStorage` nas chaves `token` e `usuario`.
- O interceptor Axios adiciona `Authorization: Bearer <token>` às requisições. Não é necessário inserir um token fixo nos componentes.
- A conta `crianca` é encaminhada para `/menu`; a conta `responsavel`, para `/responsavel`.
- O cadastro cria **uma conta por vez**: usuário, autenticação temporária e perfil de criança ou responsável. Ao concluir, remove o token temporário e retorna ao login. Não cria automaticamente um vínculo entre as duas contas.
- O responsável pode vincular uma criança existente e gerenciar permissão e limite diário. Uma conta infantil recém-criada não recebe permissão para jogar automaticamente.
- O logout remove os dados de autenticação e retorna ao login, preservando as preferências não relacionadas a credenciais.

A API continua responsável por validar JWT, perfil de acesso e propriedade dos recursos. A interface não substitui essa autorização.

## Perfil, personagem e jornadas

O Perfil exibe nome da criança, nome do personagem, nível cadastrado, estrelas da jornada, tempo diário e quatro cartões de cômodos. Cada cartão apresenta Fácil, Médio e Difícil com estados calculados a partir do catálogo ativo e do progresso retornado pela API: **Bloqueado**, **Não iniciado**, **Em andamento** ou **Concluído**. Dados ausentes ou inválidos aparecem como indisponíveis.

- O acesso normal ao Perfil utiliza a última partida validada ao entrar no Quarto, desde que ainda pertença à lista autorizada. Sem preferência válida, uma única partida é selecionada automaticamente; várias partidas exigem escolha em Jogos Salvos.
- **Ver perfil**, em Jogos Salvos, permite consultar outra jornada sem iniciar sessão ou heartbeat e sem substituir a preferência da última partida jogada.
- **Editar** altera somente `nomeAvatar` e `imagemAvatar` do PerfilJogo associado, pelo PATCH existente. O nome da conta infantil permanece independente.
- A mudança de personagem afeta todas as partidas vinculadas ao mesmo PerfilJogo, conforme informado no modal. A tela atualiza os dados somente após confirmação válida da API.
- Existem quatro opções visuais de avatar. Somente o avatar original possui sprite de caminhada; os demais usam suas ilustrações reais e mantêm a movimentação no Quarto.
- **Estrelas da jornada** usa `JogoSalvo.estrelasTotal`. Esse total não deve ser confundido com o resumo geral do histórico da criança nem com o campo de estrelas do personagem.
- O tempo recebido em segundos é formatado em horas, minutos e segundos. O limite diário permanece em minutos. A data de referência é preservada para não apresentar consumo antigo como consumo de hoje.

No Quarto, os botões **Jogar** permitem escolher uma dificuldade desbloqueada, inclusive uma já concluída. A seleção revalida progresso, catálogo, partida e situação da sessão. Quando necessário, confirma o PATCH da dificuldade antes de navegar. Uma sessão ainda ativa bloqueia essa seleção com orientação; o Perfil não encerra nem retoma sessões silenciosamente.

## Novo Jogo e Jogos Salvos

1. Em **Novo Jogo**, a criança escolhe uma das opções visuais de personagem.
2. O frontend consulta os perfis existentes e reutiliza um perfil com a imagem escolhida ou cria um PerfilJogo real pela API.
3. Cria um JogoSalvo vinculado ao perfil confirmado e navega com seu ID real para o Quarto.
4. Em **Carregar Jogo**, é possível continuar uma partida existente ou consultar seu Perfil.

O salvamento é **automático**: não existe botão Salvar jogo. Tentativas confirmadas são registradas no backend e alimentam histórico, estrelas e progresso. Ao retomar a mesma partida e dificuldade, a cena restaura os objetos concluídos sem enviar novas respostas ou conceder recompensas pela restauração. A posição exata do personagem e a rodada temporária de prática não são restauradas.

A exclusão em Jogos Salvos exige confirmação. Excluir uma partida não equivale a uma falha de salvamento; o backend preserva o histórico associado conforme suas regras.

## Jogabilidade do Quarto

As tarefas implementadas são:

1. Arrumar a cama.
2. Abrir a cortina.
3. Trocar de roupa.

Use as **setas** ou **WASD** para mover o personagem e clique nos objetos para abrir as perguntas. Cada tarefa mostra o enunciado e quatro alternativas com texto e imagem, usando o componente reutilizável `RespostaCard`. O controle de áudio da alternativa é independente da seleção da resposta.

O controle de movimento atual é por teclado. A responsividade visual do cenário não representa a entrega de controles de movimento por toque.

O backend valida o acerto; o frontend não usa um gabarito local. Feedback, animação e conclusão dependem de uma resposta HTTP 201 válida. Uma tentativa fora da sequência apresenta **“Ordem errada!” / “Tente novamente!”**, sem revelar a próxima tarefa e sem registrar uma resposta.

### Dificuldades e desbloqueios

| Dificuldade | Orientação nos objetos ainda não concluídos | Estrelas por novo acerto |
| --- | --- | ---: |
| Fácil (`facil`) | Estrelas com números de ordem | 1 |
| Médio (`medio`) | Estrelas sem números | 2 |
| Difícil (`dificil`) | Sem estrelas de orientação | 3 |

- Cada dificuldade exige acerto em **todas as tarefas ativas** do cômodo naquela partida. Repetições não contam tarefas duplicadas.
- Médio exige Fácil concluído; Difícil exige Médio concluído. O cômodo é concluído após as três dificuldades.
- O catálogo e os acertos persistidos determinam os desbloqueios. A dificuldade atualmente selecionada no JogoSalvo não representa a maior dificuldade liberada.
- **Continuar (Médio)** e **Continuar (Difícil)** usam o PATCH da partida. Também é possível voltar a uma dificuldade liberada pelo Perfil, sem apagar os acertos anteriores.
- Não existe um quarto nível nem navegação jogável para o Banheiro nesta versão.

### Prática repetida e pontuação

**Praticar novamente** inicia explicitamente uma rodada temporária vazia. A sequência vem das tarefas ativas do catálogo, ordenadas por `ordem`; no catálogo homologado do Quarto, ela é cama → cortina → roupa.

Somente um novo acerto confirmado na rodada atual libera a próxima tarefa, após a animação de 1,5 segundo. Erros e resultados incertos não avançam. Cada novo acerto intencional concede novamente as estrelas da dificuldade; a pontuação exibida é consultada do total persistido, sem soma local.

As conclusões históricas, a aparência dos objetos e o contador de tarefas únicas **3/3** permanecem preservados. Ao terminar a rodada, aparece **“Rodada de prática concluída!”**, com opções para praticar novamente ou sair. A conclusão histórica continua acessível por **Ver conclusão do nível** quando apropriado.

A sequência de cada rodada é garantida pela interface. O backend valida a progressão histórica da partida, mas não possui uma identificação própria dessas rodadas temporárias. As proteções locais contra duplo envio não equivalem a idempotência global da API.

## Sessões, limite diário e falhas

A página do Quarto valida a partida antes de iniciar automaticamente uma sessão. A cena só é montada após a confirmação do início. O heartbeat mantém a sessão ativa, normalmente a cada 10 segundos ou antes, conforme sua expiração; o backend concede validade de até 30 segundos, limitada pelo saldo diário.

- O limite e o consumo pertencem à criança e são compartilhados entre suas partidas.
- A contagem usa o relógio do servidor e a referência diária em `America/Sao_Paulo`.
- Permissão negada, limite atingido ou sessão inválida bloqueiam a continuidade.
- **Sair da partida** usa o encerramento real da sessão antes da navegação de sucesso.
- Fechar uma aba abruptamente não garante encerramento imediato; o backend limita o consumo pela validade da sessão.
- Alterar dificuldade durante a partida ou iniciar outra rodada de prática não cria uma nova sessão.

Em falhas de comunicação, a interface não simula sucesso. Um timeout pode ocorrer depois de o servidor gravar a operação: não há reenvio automático de respostas ou seleções incertas. Marcadores em `sessionStorage` impedem reenvios acidentais; não representam conclusões fictícias. A seleção de dificuldade oferece **Conferir seleção** por GET quando necessário.

## Integração frontend → backend → MongoDB

```text
Páginas e componentes React
          ↓ Axios + JWT
API: Routes → Controllers → Services → Models
          ↓
        MongoDB
```

O navegador não acessa MongoDB diretamente. Contratos principais consumidos pelos fluxos do jogo:

| Operação | Endpoint relativo à URL base | Uso |
| --- | --- | --- |
| POST | `/usuarios/auth` | Autenticar a conta |
| GET | `/usuarios/meu-perfil`, `/criancas/meu-perfil` | Identidade e dados da criança |
| GET / POST | `/perfis-jogo` | Consultar ou criar personagens |
| GET / PATCH | `/perfis-jogo/:id` | Consultar ou editar nome e imagem do personagem |
| GET / POST | `/jogos-salvos` | Listar ou criar partidas |
| GET / PATCH / DELETE | `/jogos-salvos/:id` | Validar, selecionar dificuldade ou excluir a partida |
| GET | `/jogos-salvos/:id/progresso` | Tarefas por dificuldade, estados dos cômodos e estrelas da partida |
| GET | `/comodos`, `/comodos/:comodoId/tarefas` | Catálogo e ordem das tarefas |
| GET | `/tarefas/:id` | Objeto da tarefa, incluindo enunciado |
| GET | `/tarefas/:tarefaId/respostas` | Array ordenado de alternativas, sem o campo `correta` |
| POST | `/jogos-salvos/:id/sessao` | Iniciar sessão; sucesso 201 |
| PATCH | `/jogos-salvos/sessao/heartbeat` | Renovar sessão |
| PATCH | `/jogos-salvos/sessao/encerrar` | Encerrar sessão |
| POST | `/historico-jogo/responder` | Registrar tentativa e retornar resultado; sucesso 201 |

O envio de resposta utiliza `perfilJogoId`, `jogoSalvoId`, `tarefaId`, `respostaEscolhidaId`, `dificuldade` e `sessaoId`. O resultado inclui `acertou`, `tentativa`, `pontuacaoGanha` e `dificuldade`. O frontend não envia gabarito, estrelas ou pontuação calculada.

O catálogo deve permanecer coerente com as tarefas implementadas. Uma tarefa adicional ativa pode impedir conclusão ou tornar a prática indisponível; não se deve ignorá-la silenciosamente nem alterar dados para contornar a validação.

## Testes e revisão técnica

### Suíte automatizada

Não há script `test` no `package.json`. Execute o runner diretamente, a partir da pasta frontend:

```sh
node --test tests/*.test.cjs
```

Para concentrar a revisão no jogo, sessões e Perfil:

```sh
node --test tests/cenaQuarto.cama.test.cjs tests/quarto.sessao.test.cjs tests/perfil.dificuldades.test.cjs
```

**Requisito da suíte completa:** os testes de autenticação e Novo Jogo importam código, helpers e dependências do backend por caminhos relativos. Mantenha os repositórios lado a lado e instale as dependências de ambos conforme seus READMEs:

```text
pasta-de-trabalho/
├── frontend/
└── backend/
```

Essas integrações HTTP locais usam Models em memória; não exigem iniciar a API real ou conectar o MongoDB. Outros testes controlam hooks, relógio e respostas da API. Nenhuma dessas camadas comprova, sozinha, persistência em banco real.

### Build e lint

```sh
npm run build
npm run lint
git diff --check
```

O build aprovado não implica lint aprovado. Registre separadamente erros, avisos, testes ignorados e verificações não executadas. Relatórios anteriores em `tests/` não substituem a execução no checkout que está sendo revisado.

### Verificação visual com API simulada

Os roteiros existentes usam o build real do frontend, Chrome headless e respostas de API interceptadas:

```sh
npm run build
node tests/perfil.visual.cjs
node tests/quarto.entrada.visual.cjs
```

É necessário ter Chrome instalado. Os roteiros possuem um caminho padrão de instalação do Chrome no Windows e aceitam `CHROME_PATH` para apontar o executável em outro ambiente. Usam `WebSocket` global do Node.js; utilize o ambiente indicado nos pré-requisitos.

As capturas e resultados ficam em `.next/perfil-visual/` e `.next/quarto-entrada-visual/`. Esses roteiros não homologam MongoDB real. Testes de banco devem seguir as instruções e o isolamento definidos no repositório backend.

## Roteiro para integrantes executarem e revisarem

1. Prepare o backend e seu catálogo seguindo a documentação daquele repositório; configure a URL pública da API e o CORS para o frontend local.
2. Instale as dependências do frontend, configure `.env.local` e execute `npm run dev`.
3. Use contas de desenvolvimento autorizadas. Cadastre criança e responsável separadamente, faça o vínculo e conceda permissão para jogar quando necessário.
4. Crie uma partida pelo Novo Jogo. Confira se Jogos Salvos permite continuar a partida e consultar seu Perfil.
5. No Quarto, verifique as três tarefas, dificuldades, estrelas persistidas, saída e restauração ao carregar a mesma partida.
6. Revise a seleção de dificuldades anteriores pelo Perfil e uma rodada completa de prática, incluindo sua conclusão após a animação.
7. Confira nome e avatar do personagem ao salvar, reabrir o Perfil e continuar a partida. Não confunda esses campos com a identidade da conta.
8. Execute os testes, build e lint. Para revisão visual, confira celular, tablet e desktop; os roteiros incluem diferentes larguras de tela.
9. Registre o que foi simulado e o que foi testado com API e MongoDB reais. Não publique credenciais, dados pessoais ou arquivos de ambiente nos relatórios.

## Pendências e limites conhecidos

- Entrega e integração final dos áudios das perguntas e alternativas. Os controles e referências existentes ainda dependem dos arquivos e da validação da reprodução.
- Implementação das cenas e atividades de Banheiro, Sala e Cozinha.
- Sprite de caminhada próprio para os avatares que atualmente usam ilustrações estáticas.
- Não há restauração da posição exata do personagem, persistência da rodada temporária de prática ou controles de movimento por toque nesta versão.
- Concorrência entre clientes distintos e idempotência global não são garantidas apenas pelas travas do frontend. Reutilização de uma sessão ativa a partir do Perfil não foi implementada.

Os documentos `CONTEXTO_DESENVOLVIMENTO.md` e `ANALISE_ARQUITETURA_BACKEND.md`, quando disponíveis na pasta de trabalho conjunta, detalham decisões da API. Eles contêm registros datados: trechos antigos sobre o frontend não substituem o código atual nem o estado de entrega descrito neste README.
