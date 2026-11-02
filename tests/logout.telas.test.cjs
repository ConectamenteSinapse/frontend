const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("next/dist/compiled/babel/core");
const { montarRelatorio, promessaControlada } = require("./helpers/relatorio.cjs");

// Componentes reais, hooks/router/API controlados; não acessa navegador ou MongoDB.
function elementos(n, predicado) {
  if (Array.isArray(n)) return n.flatMap((item) => elementos(item, predicado));
  if (!n?.props) return [];
  return [...(predicado(n) ? [n] : []), ...elementos(n.props.children, predicado)];
}
const saidaContas = (t) => elementos(t.arvore, (n) => n.type === "button" && n.props.children === "Sair da Conta")[0];
async function abrirContas(opcoes = {}) {
  const t = montarRelatorio({ pagina: "contas", responder: () => ({ data: [{ _id: "crianca", usuarioId: "usuario", nome: "Criança da fixture", email: "fixture@example.invalid" }] }), ...opcoes });
  t.renderizar(); t.executarEfeitos(); await t.resolverConsulta(); t.renderizar(); return t;
}

test("Contas: botão no rodapé limpa só autenticação e substitui navegação uma vez", async () => {
  const t = await abrirContas();
  t.localStorage.setItem("conectamente:ultima-partida:usuario", "partida");
  t.localStorage.setItem("preferencia-visual", "azul");
  const botao = saidaContas(t);
  assert.equal(botao.props.type, "button");
  assert.ok(elementos(t.arvore, (n) => n.type === "footer").some((n) => elementos(n, (item) => item === botao).length));
  botao.props.onClick(); botao.props.onClick();
  assert.equal(t.armazenamento.has("token"), false); assert.equal(t.armazenamento.has("usuario"), false);
  assert.equal(t.armazenamento.get("conectamente:ultima-partida:usuario"), "partida");
  assert.equal(t.armazenamento.get("preferencia-visual"), "azul");
  assert.deepEqual(t.substituicoes, ["/"]); assert.equal(t.chamadas.length, 1);
  assert.doesNotMatch(t.renderizar(), /Criança da fixture|Adicionar conta|Sair da Conta/);
});

for (const resultado of ["sucesso", "401", "rede"]) test(`Contas: consulta tardia ${resultado} após logout não repovoa tela nem navega outra vez`, async () => {
  const d = promessaControlada(), t = await abrirContas({ responder: () => d.promise });
  assert.ok(saidaContas(t), "saída disponível durante carregamento"); saidaContas(t).props.onClick();
  const antes = t.atualizacoesEstado.length;
  if (resultado === "sucesso") d.resolve({ data: [{ _id: "tardia", nome: "Resposta antiga" }] });
  else d.reject(resultado === "401" ? { response: { status: 401 } } : new Error("rede"));
  await t.resolverConsulta(); assert.equal(t.atualizacoesEstado.length, antes);
  assert.deepEqual(t.substituicoes, ["/"]); assert.doesNotMatch(t.renderizar(), /Resposta antiga/);
});

test("Contas: reabrir sem as credenciais removidas redireciona e não consulta contas", async () => {
  const t = await abrirContas(); saidaContas(t).props.onClick();
  const reaberta = await abrirContas({ token: null, usuario: null });
  assert.deepEqual(reaberta.substituicoes, ["/"]); assert.equal(reaberta.chamadas.length, 0);
  assert.doesNotMatch(reaberta.renderizar(), /Criança da fixture|Adicionar conta/);
});

function compilar(arquivo) {
  return babel.transformSync(fs.readFileSync(arquivo, "utf8"), { filename: arquivo, babelrc: false, configFile: false,
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  }).code;
}
const menuPagina = compilar(path.resolve(__dirname, "../src/pages/menu.js"));
const menuComponente = compilar(path.resolve(__dirname, "../src/components/HomeMenu.js"));

function montarMenu(opcoes = {}) {
  const storage = opcoes.storage ?? new Map([["token", "jwt-simulado"], ["usuario", JSON.stringify({ perfil: "crianca", nome: "Criança" })]]);
  const estados = [], refs = [], efeitos = [], pendentes = [], navegacoes = [], chamadas = [], escritas = [];
  let indiceEstado, indiceRef, indiceEfeito, arvore;
  const router = { replace: (rota) => navegacoes.push(rota) };
  const contexto = { exports: {}, localStorage: { getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) }, console: { error() {} }, require(id) {
    if (id === "react") return {
      useState(inicial) { const i = indiceEstado++; if (!(i in estados)) estados[i] = inicial; return [estados[i], (v) => { escritas.push(i); estados[i] = v; }]; },
      useRef(inicial) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: inicial }); },
      useEffect(fn, deps) { const i = indiceEfeito++, anterior = efeitos[i]; if (!anterior || deps.some((v, j) => !Object.is(v, anterior.deps[j]))) pendentes.push(() => { anterior?.cleanup?.(); efeitos[i] = { deps, cleanup: fn() }; }); },
    };
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/router") return { useRouter: () => router };
    if (id === "next/link") return { __esModule: true, default: "a" };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (id.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
    if (id === "../components/HomeMenu") return { __esModule: true, default: HomeMenu };
    if (id === "../services/api") return { __esModule: true, default: { get: async (url) => { chamadas.push(url); return opcoes.responder ? opcoes.responder() : { data: { nome: "Criança da fixture" } }; } } };
    throw new Error(id);
  } };
  vm.runInNewContext(menuComponente, contexto); const HomeMenu = contexto.exports.default;
  vm.runInNewContext(menuPagina, contexto);
  const t = { storage, navegacoes, chamadas, escritas,
    render() { indiceEstado = indiceRef = indiceEfeito = 0; arvore = contexto.exports.default(); if (arvore.type === HomeMenu) arvore = HomeMenu(arvore.props); while (pendentes.length) pendentes.shift()(); return t; },
    async carregar() { await new Promise(setImmediate); return t.render(); },
    nos() { return elementos(arvore, () => true); },
    saida() { return elementos(arvore, (n) => n.type === "button")[0]; },
    desmontar() { efeitos.forEach((e) => e.cleanup?.()); },
  };
  return t.render();
}

test("Menu: botão nativo depois das três opções faz logout único e preserva dados não credenciais", async () => {
  const t = await montarMenu().carregar(); const b = t.saida();
  assert.equal(b.props.type, "button"); assert.equal(b.props.disabled, false);
  assert.equal(t.nos().filter((n) => n.type === "a").length, 3);
  const lista = t.nos(); assert.ok(lista.indexOf(b) > lista.findLastIndex((n) => n.type === "a"));
  t.storage.set("conectamente:ultima-partida:usuario", "partida"); t.storage.set("configuracao", "preservar");
  b.props.onClick(); b.props.onClick(); t.render();
  assert.deepEqual(t.navegacoes, ["/"]); assert.equal(t.storage.has("token"), false); assert.equal(t.storage.has("usuario"), false);
  assert.equal(t.storage.get("conectamente:ultima-partida:usuario"), "partida"); assert.equal(t.storage.get("configuracao"), "preservar");
  assert.equal(t.nos().some((n) => n.type === "a"), false);
  const reaberta = await montarMenu({ storage: t.storage }).carregar();
  assert.deepEqual(reaberta.navegacoes, ["/"]); assert.equal(reaberta.chamadas.length, 0); assert.equal(reaberta.saida(), undefined);
});

test("Menu: dados locais de responsável preservam o encaminhamento autorizado", async () => {
  const storage = new Map([["token", "jwt-simulado"], ["usuario", JSON.stringify({ perfil: "responsavel" })]]);
  const t = await montarMenu({ storage }).carregar();
  assert.deepEqual(t.navegacoes, ["/responsavel"]); assert.equal(t.saida(), undefined); assert.equal(t.chamadas.length, 0);
});

test("Menu: carregamento não mostra opções antes da autorização e 401 limpa autenticação", async () => {
  const d = promessaControlada(), t = montarMenu({ responder: () => d.promise });
  assert.equal(t.saida(), undefined); assert.equal(t.nos().some((n) => n.type === "a"), false);
  d.reject({ response: { status: 401 } }); await t.carregar();
  assert.equal(t.saida(), undefined); assert.deepEqual(t.navegacoes, ["/"]);
  assert.equal(t.storage.has("token"), false); assert.equal(t.storage.has("usuario"), false);
});

test("Menu: resposta de perfil após desmontagem não atualiza estado ou navegação", async () => {
  const d = promessaControlada(), t = montarMenu({ responder: () => d.promise }); t.desmontar();
  const antes = t.escritas.length; d.resolve({ data: { nome: "Tardio" } }); await t.carregar();
  assert.equal(t.escritas.length, antes); assert.deepEqual(t.navegacoes, []); assert.equal(t.saida(), undefined);
});
