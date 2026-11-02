const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("next/dist/compiled/babel/core");

// JSX real com router/API/hooks controlados, sem navegador ou MongoDB.
const arquivo = path.resolve(__dirname, "../src/components/JogosSalvos.js");
const { code } = babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
  filename: arquivo, babelrc: false, configFile: false,
  presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
  plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
});
function montar(jogos, excluir = async () => {}, opcoes = {}) {
  const estados = [], efeitos = [], chamadas = [], navegacoes = [];
  let indice = 0, arvore;
  const router = { push: (destino) => navegacoes.push(destino), replace: (destino) => navegacoes.push(destino) };
  const storage = new Map([["token", "token-ficticio"], ["usuario", "usuario-simulado"]]);
  const contexto = {
    localStorage: { removeItem: (chave) => storage.delete(chave) },
    exports: {}, console: { log() {}, error() {} },
    require(id) {
      if (id === "react") return {
        useState(inicial) { const i = indice++; if (!(i in estados)) estados[i] = inicial; return [estados[i], (v) => { estados[i] = typeof v === "function" ? v(estados[i]) : v; }]; },
        useEffect(fn) { efeitos.push(fn); },
      };
      if (id === "react/jsx-runtime") return require(id);
      if (id === "next/router") return { useRouter: () => router };
      if (id === "next/link") return { __esModule: true, default: () => null };
      if (id === "lucide-react") return { Minus: () => null };
      if (id.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
      if (id === "../services/api") return { __esModule: true, default: {
        get: async (url) => { chamadas.push(["GET", url]); if (opcoes.erro) throw opcoes.erro; return { data: jogos }; },
        delete: async (url) => { chamadas.push(["DELETE", url]); return excluir(url); },
      } };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(code, contexto, { filename: arquivo });
  function nos(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  const tela = {
    chamadas, navegacoes, storage,
    render() { indice = 0; arvore = contexto.exports.default(); return tela; },
    async carregar() { efeitos.shift()(); await new Promise(setImmediate); return tela.render(); },
    nos,
    cards() { return nos().filter((n) => n.props.className === "cardJogo"); },
    botao(classe) { return nos().find((n) => n.type === "button" && n.props.className === classe); },
  };
  return tela.render();
}

for (const id of ["6aac3c29bee9f041e4728a81", "6aac3c29bee9f041e4728a82"]) {
  test(`Ver perfil consulta jornada ${id}, interrompe clique do card e não inicia jogo`, async () => {
    const tela = await montar([{ _id: id, nomeJogo: "Partida simulada" }]).carregar();
    let interrompido = false;
    tela.botao("botaoPerfil").props.onClick({ stopPropagation() { interrompido = true; } });
    assert.equal(interrompido, true); assert.equal(tela.navegacoes.length, 1);
    assert.equal(tela.navegacoes[0].pathname, "/perfil"); assert.equal(tela.navegacoes[0].query.jogoSalvoId, id);
    assert.deepEqual(tela.chamadas, [["GET", "/jogos-salvos"]]);
    tela.botao("botaoContinuar").props.onClick({ stopPropagation() {} });
    assert.equal(tela.navegacoes[1].pathname, "/jogo/quarto");
  });
  test(`seleção transporta o ID da partida ${id}`, async () => {
    const tela = await montar([{ _id: id, nomeJogo: "Partida simulada" }]).carregar();
    tela.cards()[0].props.onClick();
    assert.equal(tela.navegacoes.length, 1);
    const destino = tela.navegacoes[0];
    assert.equal(destino.pathname, "/jogo/quarto");
    assert.equal(destino.query.jogoSalvoId, id);
    assert.equal(`${destino.pathname}?${new URLSearchParams(destino.query)}`, `/jogo/quarto?jogoSalvoId=${id}`);
    assert.deepEqual(tela.chamadas, [["GET", "/jogos-salvos"]], "selecionar não cria partida, sessão ou resposta");
  });
}

test("Ver perfil rejeita identificador ausente ou malformado sem navegar", async () => {
  for (const id of [null, "", "m1", "partida-alheia", 123]) {
    const tela = await montar([{ _id: id }]).carregar();
    tela.botao("botaoPerfil").props.onClick({ stopPropagation() {} }); tela.render();
    assert.equal(tela.navegacoes.length, 0);
    assert.ok(tela.nos().some((n) => n.props.role === "alert"));
    assert.deepEqual(tela.chamadas, [["GET", "/jogos-salvos"]]);
  }
});

for (const id of [undefined, null, "", "   ", 123]) {
  test(`partida sem identificador utilizável (${String(id)}) não navega`, async () => {
    const tela = await montar([{ _id: id, nomeJogo: "Sem ID" }]).carregar();
    tela.cards()[0].props.onClick(); tela.render();
    assert.equal(tela.navegacoes.length, 0);
    assert.ok(tela.nos().some((n) => n.props.role === "alert" && n.props.children.includes("identificador ausente")));
    assert.deepEqual(tela.chamadas, [["GET", "/jogos-salvos"]]);
  });
}

test("exclusão interrompe propagação, exige confirmação e remove somente a partida escolhida", async () => {
  const jogos = [{ _id: "partida-a", nomeJogo: "A" }, { _id: "partida-b", nomeJogo: "B" }];
  const tela = await montar(jogos).carregar();
  let interrompido = false;
  tela.botao("botaoAcao").props.onClick({ stopPropagation() { interrompido = true; } }); tela.render();
  assert.equal(interrompido, true);
  assert.equal(tela.navegacoes.length, 0);
  assert.equal(tela.chamadas.length, 1);
  await tela.botao("botaoSim").props.onClick(); tela.render();
  assert.deepEqual(tela.chamadas, [["GET", "/jogos-salvos"], ["DELETE", "/jogos-salvos/partida-a"]]);
  assert.equal(tela.cards().length, 1);
  assert.equal(tela.cards()[0].key, "partida-b");
  assert.equal(tela.navegacoes.length, 0);
});

test("cancelar exclusão preserva a lista e não navega", async () => {
  const tela = await montar([{ _id: "partida-a", nomeJogo: "A" }]).carregar();
  tela.botao("botaoAcao").props.onClick({ stopPropagation() {} }); tela.render();
  tela.botao("botaoNao").props.onClick(); tela.render();
  assert.equal(tela.cards().length, 1);
  assert.equal(tela.nos().some((n) => n.props.role === "dialog"), false);
  assert.equal(tela.navegacoes.length, 0);
  assert.equal(tela.chamadas.length, 1);
});

test("erro de exclusão mantém a partida e oferece mensagem", async () => {
  const tela = await montar([{ _id: "partida-a", nomeJogo: "A" }], async () => { throw new Error("rede simulada"); }).carregar();
  tela.botao("botaoAcao").props.onClick({ stopPropagation() {} }); tela.render();
  await tela.botao("botaoSim").props.onClick(); tela.render();
  assert.equal(tela.cards().length, 1);
  assert.ok(tela.nos().some((n) => n.props.role === "alert"));
  assert.equal(tela.navegacoes.length, 0);
});

test("lista vazia oferece Novo jogo; não navega para rota inexistente", async () => {
  const t = await montar([]).carregar();
  assert.ok(t.nos().some((n) => n.props.href === "/escolher-personagem"));
  assert.equal(t.navegacoes.length, 0);
});

test("401 na listagem limpa sessão e volta ao login", async () => {
  const t = await montar([], undefined, { erro: { response: { status: 401 } } }).carregar();
  assert.deepEqual(t.navegacoes, ["/"]); assert.equal(t.storage.size, 0);
});
