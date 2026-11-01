const test = require("node:test");
const assert = require("node:assert/strict");
const { montarRelatorio } = require("./helpers/relatorio.cjs");

function pagina(extras = {}) {
  return montarRelatorio({
    pagina: "responsavel",
    responder() { assert.fail("Painel não deve consultar a API"); },
    ...extras,
  });
}

function elementos(node, predicado) {
  if (Array.isArray(node)) return node.flatMap((item) => elementos(item, predicado));
  if (!node || !node.props) return [];
  return [...(predicado(node) ? [node] : []), ...elementos(node.props.children, predicado)];
}
function botao(tela, texto) {
  const encontrado = elementos(tela.arvore, (n) => n.type === "button" && n.props.children === texto)[0];
  assert.ok(encontrado, "Botão ausente: " + texto);
  return encontrado;
}
function autenticar(tela) {
  assert.equal(tela.renderizar(), "");
  tela.executarEfeitos();
  return tela.renderizar();
}

for (const token of ["jwt-ficticio", "  jwt-ficticio  "]) {
  test(`token presente permite painel após efeito (${token.trim() === token ? "normal" : "com espaços"})`, () => {
    const tela = pagina({ token });
    assert.match(autenticar(tela), /PERFIL DO RESPONSÁVEL/);
    assert.equal(tela.armazenamento.get("token"), token);
    assert.deepEqual(tela.substituicoes, []);
    assert.deepEqual(tela.navegacoesJanela, []);
    assert.deepEqual(tela.operacoesStorage, [{ metodo: "getItem", chave: "token" }]);
  });
}

for (const token of [null, "", "   "]) {
  test(`token ${JSON.stringify(token)} redireciona para / sem exibir painel`, () => {
    const tela = pagina({ token });
    assert.equal(tela.renderizar(), "");
    assert.equal(tela.arvore, null);
    assert.equal(tela.operacoesStorage.length, 0);
    assert.deepEqual(tela.substituicoes, []);
    tela.executarEfeitos();
    assert.equal(tela.renderizar(), "");
    assert.equal(tela.arvore, null);
    assert.deepEqual(tela.substituicoes, ["/"]);
    assert.deepEqual(tela.navegacoesJanela, []);
    assert.equal(tela.chamadas.length, 0);
  });
}

test("primeira renderização com sessão também fica vazia até o useEffect", () => {
  const tela = pagina();
  assert.equal(tela.renderizar(), "");
  assert.equal(tela.arvore, null);
  assert.equal(tela.operacoesStorage.length, 0);
  assert.equal(tela.atualizacoesEstado.length, 0);
  tela.executarEfeitos();
  assert.deepEqual(tela.operacoesStorage, [{ metodo: "getItem", chave: "token" }]);
  assert.match(tela.renderizar(), /PERFIL DO RESPONSÁVEL/);
});

test("SSR real do React renderiza vazio sem window/localStorage ou execução do efeito", () => {
  const tela = pagina();
  assert.equal(tela.renderizarServidor(), "");
  assert.equal(tela.operacoesStorage.length, 0);
  assert.equal(tela.atualizacoesEstado.length, 0);
  assert.deepEqual(tela.substituicoes, []);
  assert.equal(tela.chamadas.length, 0);
});

for (const usuario of [JSON.stringify({ id: "resp-ficticio", perfil: "responsavel" }), null]) {
  test(`logout limpa sessão antes de navegar, com usuario ${usuario === null ? "ausente" : "presente"}`, () => {
    const tela = pagina({ usuario });
    autenticar(tela);
    tela.localStorage.setItem("preferencia-ficticia", "preservar");
    botao(tela, "SAIR DA CONTA").props.onClick();
    assert.equal(tela.armazenamento.has("token"), false);
    assert.equal(tela.armazenamento.has("usuario"), false);
    assert.equal(tela.armazenamento.get("preferencia-ficticia"), "preservar");
    assert.deepEqual(tela.operacoesStorage.filter((op) => op.metodo === "removeItem"), [
      { metodo: "removeItem", chave: "token" }, { metodo: "removeItem", chave: "usuario" },
    ]);
    assert.deepEqual(tela.navegacoesJanela, [{ destino: "/", tokenPresente: false, usuarioPresente: false }]);
    assert.deepEqual(tela.substituicoes, []);
  });
}

test("Contas Acessíveis navega para contas e preserva sessão", () => {
  const tela = pagina(); autenticar(tela);
  const antes = [...tela.armazenamento];
  botao(tela, "Contas Acessíveis").props.onClick();
  assert.deepEqual([...tela.armazenamento], antes);
  assert.deepEqual(tela.navegacoesJanela, [{ destino: "/responsavel/contas", tokenPresente: true, usuarioPresente: true }]);
  assert.equal(tela.operacoesStorage.filter((op) => op.metodo === "removeItem").length, 0);
});

test("preserva título, descrição, logo, hierarquia, classes e dois botões", () => {
  const tela = pagina();
  const html = autenticar(tela);
  const nodes = elementos(tela.arvore, () => true);
  assert.equal(nodes.find((n) => n.type === "title").props.children, "Perfil do Responsável | ConectaMente");
  assert.equal(nodes.find((n) => n.type === "meta" && n.props.name === "description").props.content, "Área do responsável pelo ConectaMente");
  const main = nodes.find((n) => n.type === "main");
  assert.equal(main.props.className, "container");
  assert.equal(main.props.children.type, "section");
  assert.equal(main.props.children.props.className, "card");
  assert.match(html, /<h1>PERFIL DO RESPONSÁVEL<\/h1>/);
  assert.match(html, /Minha Rotina Divertida/);
  const logo = nodes.find((n) => n.type === "img");
  assert.equal(logo.props.src, "/images/logo.png");
  assert.equal(logo.props.alt, "ConectaMente — Minha Rotina Divertida");
  assert.equal(logo.props.className, "logoImage");
  assert.equal(nodes.filter((n) => n.type === "button").length, 2);
  assert.equal(botao(tela, "Contas Acessíveis").props.className, "contasButton");
  assert.equal(botao(tela, "SAIR DA CONTA").props.className, "sairButton");
  for (const texto of ["Contas Acessíveis", "SAIR DA CONTA"]) assert.equal(botao(tela, texto).props.type, "button");
});

test("nova renderização com mesmo router não repete verificação de sessão", () => {
  const tela = pagina(); autenticar(tela);
  tela.renderizar(); tela.executarEfeitos(); tela.renderizar();
  assert.equal(tela.operacoesStorage.length, 1);
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 0);
});

test("novo setup sem token permanece oculto e repete somente redirecionamento", () => {
  const tela = pagina({ token: null }); autenticar(tela);
  tela.repetirEfeitos();
  assert.equal(tela.renderizar(), "");
  assert.deepEqual(tela.substituicoes, ["/", "/"]);
  assert.equal(tela.prompts.length, 0);
});
