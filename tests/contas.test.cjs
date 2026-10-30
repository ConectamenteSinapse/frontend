const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
} = require("./helpers/relatorio.cjs");

function contas() {
  return [
    {
      _id: "0000000000000000000000c1",
      usuarioId: "0000000000000000000000a1",
      nome: "Caio da fixture",
      email: "caio@example.invalid",
    },
    {
      _id: "0000000000000000000000c2",
      usuarioId: "0000000000000000000000b2",
      nome: "Lia da fixture",
      email: "lia@example.invalid",
    },
  ];
}

function pagina({ dados = contas(), responder, ...extras } = {}) {
  return montarRelatorio({
    pagina: "contas",
    responder: responder || (() => ({ data: dados })),
    ...extras,
  });
}

async function consultar(tela) {
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  return tela.renderizar();
}

// key não é serializado no HTML; verifica a árvore JSX real, sem atribuir key
// a uma prop DOM ou inferir a chave pelo nome exibido.
function elementos(arvore, predicado) {
  if (Array.isArray(arvore))
    return arvore.flatMap((item) => elementos(item, predicado));
  if (!arvore || typeof arvore !== "object" || !arvore.props) return [];
  return [
    ...(predicado(arvore) ? [arvore] : []),
    ...elementos(arvore.props.children, predicado),
  ];
}

function cards(tela) {
  return elementos(tela.arvore, (item) => item.type === "article");
}
function links(tela) {
  return elementos(tela.arvore, (item) => typeof item.props.href === "string");
}
function semContas(html) {
  assert.doesNotMatch(
    html,
    /<article|Caio da fixture|Lia da fixture|example.invalid/,
  );
}

test("consulta somente GET /responsaveis/minhas-criancas com JWT Bearer sem espaços", async () => {
  const tela = pagina({ token: "  jwt-responsavel-ficticio  " });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/responsaveis/minhas-criancas");
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-responsavel-ficticio",
  );
});

test("mostra nome, e-mail e avatar de cada criança vinculada", async () => {
  const tela = pagina();
  const html = await consultar(tela);
  for (const conta of contas()) {
    assert.ok(html.includes("<h2>" + conta.nome + "</h2>"));
    assert.ok(html.includes("<p>" + conta.email + "</p>"));
    assert.ok(html.includes('alt="Avatar de ' + conta.nome + '"'));
  }
  assert.equal(cards(tela).length, 2);
});

test("utiliza conta._id como key de cada article, e não usuarioId ou índice", async () => {
  const tela = pagina();
  const html = await consultar(tela);
  assert.deepEqual(
    cards(tela).map((card) => card.key),
    contas().map((conta) => conta._id),
  );
  assert.doesNotMatch(html, /\bkey=/);
});

test("keys continuam identificando as contas quando a ordem recebida é invertida", async () => {
  const dados = contas().reverse();
  const tela = pagina({ dados });
  await consultar(tela);
  assert.deepEqual(
    cards(tela).map((card) => card.key),
    dados.map((conta) => conta._id),
  );
});

test("links para rendimento usam conta.usuarioId, nunca conta._id", async () => {
  const tela = pagina();
  await consultar(tela);
  const destinos = links(tela).filter((link) =>
    link.props.href.includes("/rendimento?id="),
  );
  assert.deepEqual(
    destinos.map((link) => link.props.href),
    contas().map((conta) => "/responsavel/rendimento?id=" + conta.usuarioId),
  );
  assert.deepEqual(
    destinos.map((link) => link.props["aria-label"]),
    contas().map((conta) => "Ver rendimento de " + conta.nome),
  );
});

test("preserva os destinos de Adicionar Conta e de retorno para o responsável", async () => {
  const tela = pagina();
  await consultar(tela);
  const adicionar = links(tela).find(
    (link) => link.props["aria-label"] === "Adicionar conta",
  );
  assert.equal(adicionar.props.href, "/responsavel/adicionar-conta");
  assert.ok(links(tela).some((link) => link.props.href === "/responsavel"));
});

test("resposta vazia mostra mensagem de ausência de crianças vinculadas", async () => {
  const html = await consultar(pagina({ dados: [] }));
  assert.match(html, /Você não possui contas para monitorar\./);
  assert.doesNotMatch(html, /Carregando contas|Aguardando autenticação/);
  semContas(html);
});

test("estado inicial aguarda autenticação, sem dizer que não existem contas", () => {
  const tela = pagina();
  const html = tela.renderizar();
  assert.match(html, /Aguardando autenticação para consultar as contas\./);
  assert.doesNotMatch(
    html,
    /Você não possui contas para monitorar|Carregando contas/,
  );
  assert.equal(tela.chamadas.length, 0);
  semContas(html);
});

for (const token of [null, "", "   "]) {
  test(
    "JWT não informado (" +
      JSON.stringify(token) +
      ") informa erro e não chama API",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.match(html, /É necessário informar o JWT do responsável\./);
      assert.equal(tela.chamadas.length, 0);
      assert.doesNotMatch(
        html,
        /Carregando contas|Você não possui contas para monitorar/,
      );
      semContas(html);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "HTTP " +
      status +
      " usa a mensagem genérica atual e não mostra lista vazia como sucesso",
    async () => {
      const tela = pagina({
        responder: () =>
          Promise.reject({
            response: { status, data: { mensagem: "Mensagem da API" } },
          }),
      });
      const html = await consultar(tela);
      assert.match(html, /Não foi possível carregar as contas\./);
      assert.doesNotMatch(
        html,
        /Mensagem da API|Carregando contas|Você não possui contas para monitorar/,
      );
      assert.equal(tela.errosConsole.length, 1);
      semContas(html);
    },
  );
}

test("falha de comunicação usa mensagem de erro e encerra carregamento", async () => {
  const tela = pagina({
    responder: () => Promise.reject(new Error("rede indisponível")),
  });
  const html = await consultar(tela);
  assert.match(html, /Não foi possível carregar as contas\./);
  assert.doesNotMatch(
    html,
    /Carregando contas|Você não possui contas para monitorar/,
  );
  semContas(html);
});

test("mostra carregamento enquanto aguarda resposta e depois apresenta as contas", async () => {
  const pendente = promessaControlada();
  const tela = pagina({ responder: () => pendente.promise });
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando contas\.\.\./);
  assert.doesNotMatch(aguardando, /Você não possui contas para monitorar/);
  semContas(aguardando);
  pendente.resolve({ data: contas() });
  await tela.resolverConsulta();
  assert.match(tela.renderizar(), /Caio da fixture/);
});

test("nova renderização sem remontagem não repete prompt ou consulta do efeito vazio", async () => {
  const tela = pagina();
  await consultar(tela);
  await consultar(tela);
  assert.equal(tela.prompts.length, 1);
  assert.equal(tela.chamadas.length, 1);
});

for (const resultado of ["sucesso", "erro", "vazio"]) {
  test(
    "cleanup impede setState após resposta atrasada: " + resultado,
    async () => {
      const pendente = promessaControlada();
      const tela = pagina({ responder: () => pendente.promise });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.limparEfeitos();
      const atualizacoesAntes = tela.atualizacoesEstado.length;
      if (resultado === "erro")
        pendente.reject(new Error("Erro depois do cleanup"));
      else pendente.resolve({ data: resultado === "vazio" ? [] : contas() });
      await tela.resolverConsulta();
      // Não renderiza o componente desmontado: observa tentativas de atualização.
      assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
      assert.equal(tela.errosConsole.length, 0);
    },
  );
}

test("sequência simulada de Strict Mode repete o prompt e ignora a primeira resposta", async () => {
  const primeira = promessaControlada();
  const segunda = promessaControlada();
  let chamadas = 0;
  const tela = pagina({
    responder: () => (++chamadas === 1 ? primeira.promise : segunda.promise),
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  assert.equal(tela.prompts.length, 2);
  assert.equal(tela.chamadas.length, 2);
  segunda.resolve({ data: [contas()[1]] });
  await tela.resolverConsulta();
  assert.match(tela.renderizar(), /Lia da fixture/);
  primeira.resolve({ data: [contas()[0]] });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Lia da fixture/);
  assert.doesNotMatch(html, /Caio da fixture|Não foi possível carregar/);
});

test("erro da primeira execução simulada não altera resultado da segunda", async () => {
  const primeira = promessaControlada();
  let chamadas = 0;
  const tela = pagina({
    responder: () => (++chamadas === 1 ? primeira.promise : { data: contas() }),
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  primeira.reject({ response: { status: 403 } });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Caio da fixture/);
  assert.doesNotMatch(html, /Não foi possível carregar|Carregando contas/);
  assert.equal(tela.errosConsole.length, 0);
});

test("finally da primeira execução simulada não encerra carregamento da segunda", async () => {
  const primeira = promessaControlada();
  const segunda = promessaControlada();
  let chamadas = 0;
  const tela = pagina({
    responder: () => (++chamadas === 1 ? primeira.promise : segunda.promise),
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  primeira.resolve({ data: contas() });
  await tela.resolverConsulta();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando contas/);
  semContas(aguardando);
  segunda.resolve({ data: [] });
  await tela.resolverConsulta();
  assert.match(tela.renderizar(), /Você não possui contas para monitorar/);
});

test("cancelamento inicial seguido de JWT válido na repetição simulada permite consultar", async () => {
  const tela = pagina({ token: null });
  await consultar(tela);
  tela.definirToken("jwt-valido-ficticio");
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Caio da fixture/);
  assert.doesNotMatch(html, /É necessário informar|Carregando contas/);
  assert.equal(tela.prompts.length, 2);
  assert.equal(tela.chamadas.length, 1);
});

test("cancelar os dois prompts na repetição simulada informa erro sem requisições", async () => {
  const tela = pagina({ token: null });
  await consultar(tela);
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  assert.match(tela.renderizar(), /É necessário informar o JWT do responsável/);
  assert.equal(tela.prompts.length, 2);
  assert.equal(tela.chamadas.length, 0);
});

for (const token of [null, "", "   "]) {
  test(
    "JWT válido no primeiro setup e " +
      JSON.stringify(token) +
      " no segundo não deve deixar carregamento preso",
    async () => {
      const primeira = promessaControlada();
      const tela = pagina({ responder: () => primeira.promise });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.definirToken(token);
      tela.repetirEfeitos();
      primeira.resolve({ data: contas() });
      await tela.resolverConsulta();
      const html = tela.renderizar();
      assert.doesNotMatch(
        html,
        /Carregando contas/,
        "Cancelamento do segundo prompt mantém spinner indefinidamente",
      );
      assert.match(html, /É necessário informar o JWT do responsável/);
      semContas(html);
    },
  );
}
