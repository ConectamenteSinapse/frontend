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

test("token presente no localStorage permite GET sem prompt ou Authorization manual", async () => {
  const tela = pagina({ token: "  jwt-responsavel-ficticio  " });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/responsaveis/minhas-criancas");
  assert.equal(tela.chamadas[0].config, undefined);
  assert.equal(tela.prompts.length, 0);
  assert.ok(tela.operacoesStorage.some((op) => op.metodo === "getItem" && op.chave === "token"));
  assert.equal(tela.armazenamento.get("token"), "  jwt-responsavel-ficticio  ");
  assert.deepEqual(tela.substituicoes, []);
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
      ") redireciona ao login sem prompt nem chamada API",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.equal(tela.chamadas.length, 0);
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.equal(tela.prompts.length, 0);
      assert.doesNotMatch(html, /Carregando contas|É necessário informar o JWT/);
      semContas(html);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "HTTP " +
      status +
      (status === 401 ? " limpa sessão e substitui navegação pelo login" : " mostra acesso negado e preserva sessão"),
    async () => {
      const tela = pagina({
        responder: () =>
          Promise.reject({
            response: { status, data: { mensagem: "Mensagem da API" } },
          }),
      });
      const html = await consultar(tela);
      if (status === 401) {
        assert.equal(tela.armazenamento.has("token"), false);
        assert.equal(tela.armazenamento.has("usuario"), false);
        assert.deepEqual(tela.operacoesStorage.filter((op) => op.metodo === "removeItem").map((op) => op.chave), ["token", "usuario"]);
        assert.deepEqual(tela.substituicoes, ["/"]);
      } else {
        assert.match(html, /Você não tem permissão para acessar estas contas\./);
        assert.doesNotMatch(html, /Você não possui contas para monitorar/);
        assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
        assert.ok(tela.armazenamento.has("usuario"));
        assert.deepEqual(tela.substituicoes, []);
      }
      assert.doesNotMatch(html, /Mensagem da API|Carregando contas/);
      assert.equal(tela.errosConsole.length, 0);
      assert.equal(tela.prompts.length, 0);
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
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.ok(tela.armazenamento.has("usuario"));
  assert.deepEqual(tela.substituicoes, []);
  assert.equal(tela.errosConsole.length, 1);
});

for (const status of [500, 503]) {
  test(`erro HTTP ${status} mostra falha genérica e preserva sessão`, async () => {
    const tela = pagina({ responder: () => Promise.reject({ response: { status, data: { mensagem: "Detalhe interno fictício" } } }) });
    const html = await consultar(tela);
    assert.match(html, /Não foi possível carregar as contas\./);
    assert.doesNotMatch(html, /Detalhe interno|Carregando contas|Você não possui contas/);
    semContas(html);
    assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
    assert.ok(tela.armazenamento.has("usuario"));
    assert.deepEqual(tela.substituicoes, []);
    assert.equal(tela.errosConsole.length, 1);
    assert.equal(tela.prompts.length, 0);
  });
}

test("token permite consulta mesmo sem usuario no storage; página não exige metadados locais", async () => {
  const tela = pagina({ usuario: null });
  assert.match(await consultar(tela), /Caio da fixture/);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.prompts.length, 0);
  assert.deepEqual(tela.substituicoes, []);
});

test("401 remove apenas token e usuario, preservando outras chaves do storage", async () => {
  const tela = pagina({ responder: () => Promise.reject({ response: { status: 401 } }) });
  tela.localStorage.setItem("preferencia-ficticia", "preservar");
  await consultar(tela);
  assert.equal(tela.armazenamento.get("preferencia-ficticia"), "preservar");
  assert.equal(tela.armazenamento.has("token"), false);
  assert.equal(tela.armazenamento.has("usuario"), false);
  assert.deepEqual(tela.substituicoes, ["/"]);
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

test("nova renderização com mesmo router não repete consulta e nunca solicita prompt", async () => {
  const tela = pagina();
  await consultar(tela);
  await consultar(tela);
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 1);
});

for (const resultado of ["sucesso", "erro", "vazio", 401, 403, 500]) {
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
      if (typeof resultado === "number") pendente.reject({ response: { status: resultado } });
      else if (resultado === "erro")
        pendente.reject(new Error("Erro depois do cleanup"));
      else pendente.resolve({ data: resultado === "vazio" ? [] : contas() });
      await tela.resolverConsulta();
      // Não renderiza o componente desmontado: observa tentativas de atualização.
      assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
      assert.equal(tela.errosConsole.length, 0);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );
}

test("sequência simulada setup-cleanup-setup ignora a primeira resposta sem solicitar prompt", async () => {
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
  assert.equal(tela.prompts.length, 0);
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

test("401 antigo não apaga nova sessão nem redireciona depois de outro setup concluído", async () => {
  const primeira = promessaControlada();
  let numero = 0;
  const tela = pagina({ responder: () => ++numero === 1 ? primeira.promise : { data: [contas()[1]] } });
  tela.renderizar(); tela.executarEfeitos(); await tela.resolverConsulta();
  tela.definirToken("jwt-nova-sessao-ficticio");
  tela.localStorage.setItem("usuario", JSON.stringify({ id: "novo-responsavel-ficticio" }));
  tela.repetirEfeitos(); await tela.resolverConsulta();
  const atualizacoesAntes = tela.atualizacoesEstado.length;
  primeira.reject({ response: { status: 401 } }); await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Lia da fixture/); assert.doesNotMatch(html, /Caio da fixture/);
  assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
  assert.equal(tela.armazenamento.get("token"), "jwt-nova-sessao-ficticio");
  assert.equal(JSON.parse(tela.armazenamento.get("usuario")).id, "novo-responsavel-ficticio");
  assert.deepEqual(tela.substituicoes, []);
});

test("401 do setup atual retira contas carregadas anteriormente e encerra loading", async () => {
  let numero = 0;
  const tela = pagina({ responder: () => ++numero === 1 ? { data: contas() } : Promise.reject({ response: { status: 401 } }) });
  assert.match(await consultar(tela), /Caio da fixture/);
  tela.repetirEfeitos(); await tela.resolverConsulta();
  const html = tela.renderizar();
  semContas(html); assert.doesNotMatch(html, /Carregando contas/);
  assert.equal(tela.armazenamento.size, 0);
  assert.deepEqual(tela.substituicoes, ["/"]);
});

test("HTTP local: Contas e interceptor Axios reais enviam JWT do storage sem prompt", async (t) => {
  const { createServer } = require("node:http");
  const { once } = require("node:events");
  const { readFileSync } = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const babel = require("next/dist/compiled/babel/core");
  const commonjs = require("next/dist/compiled/babel/plugin-transform-modules-commonjs");
  const recebidas = [];
  const servidor = createServer((req, res) => {
    recebidas.push({ url: req.url, authorization: req.headers.authorization });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(contas()));
  });
  servidor.listen(0, "127.0.0.1"); await once(servidor, "listening");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  let apiReal;
  const tela = pagina({ token: "jwt-storage-ficticio", responder: (url, config) => apiReal.get(url, config) });
  const arquivo = path.resolve(__dirname, "../src/services/api.js");
  const { code } = babel.transformSync(readFileSync(arquivo, "utf8"), { filename: arquivo, babelrc: false, configFile: false, plugins: [commonjs] });
  const contexto = { exports: {}, require, window: { localStorage: tela.localStorage }, localStorage: tela.localStorage,
    process: { env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${servidor.address().port}` } } };
  vm.runInNewContext(code, contexto, { filename: arquivo }); apiReal = contexto.exports.default;
  let terminar;
  const concluida = new Promise((resolve) => { terminar = resolve; });
  // Observa conclusão do transporte real sem depender de sleeps ou de um único tick.
  apiReal.interceptors.response.use((res) => { terminar(); return res; }, (erro) => { terminar(); return Promise.reject(erro); });
  tela.renderizar(); tela.executarEfeitos();
  await concluida; await tela.resolverConsulta();
  assert.match(tela.renderizar(), /Caio da fixture/);
  assert.deepEqual(recebidas, [{ url: "/responsaveis/minhas-criancas", authorization: "Bearer jwt-storage-ficticio" }]);
  assert.equal(tela.chamadas[0].config, undefined);
  assert.equal(tela.prompts.length, 0);
  assert.deepEqual(tela.substituicoes, []);
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

test("sessão ausente seguida de token presente em novo setup permite consultar", async () => {
  const tela = pagina({ token: null });
  await consultar(tela);
  tela.definirToken("jwt-valido-ficticio");
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Caio da fixture/);
  assert.doesNotMatch(html, /É necessário informar|Carregando contas/);
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 1);
  assert.deepEqual(tela.substituicoes, ["/"]);
});

test("sessão ausente em dois setups redireciona ao login sem requisições ou prompts", async () => {
  const tela = pagina({ token: null });
  await consultar(tela);
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  assert.doesNotMatch(tela.renderizar(), /Carregando contas/);
  assert.deepEqual(tela.substituicoes, ["/", "/"]);
  assert.equal(tela.prompts.length, 0);
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
        "Sessão ausente no segundo setup não pode manter spinner",
      );
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.equal(tela.prompts.length, 0);
      semContas(html);
    },
  );
}
