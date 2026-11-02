const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("next/dist/compiled/babel/core");

// JSX real, hooks/API/router controlados; não acessa MongoDB.
const P = "6aac3dc5463fb5f785522ad6", J = "6aac3c29bee9f041e4728a81";
function Link() {}
function compilar(nome) {
  const arquivo = path.resolve(__dirname, "../src/components", nome + ".js");
  return babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
    filename: arquivo, babelrc: false, configFile: false,
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  }).code;
}
const code = compilar("EscolherPersonagem");
function diferida() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function montar(opcoes = {}) {
  const estados = [], refs = [], efeitos = [], fila = [], chamadas = [], navegacoes = [];
  const perfis = [...(opcoes.perfis ?? [])];
  const storage = new Map(opcoes.semToken ? [] : [["token", "token-ficticio"], ["usuario", "usuario-simulado"]]);
  let indiceEstado, indiceRef, indiceEfeito, arvore;
  const router = { push: async (destino) => { navegacoes.push(destino); return opcoes.navegar ? opcoes.navegar(destino) : true; }, replace: (destino) => navegacoes.push(destino) };
  const contexto = { exports: {}, AbortController, localStorage: { getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) }, require(id) {
    if (id === "react") return {
      useState(inicial) { const i = indiceEstado++; if (!(i in estados)) estados[i] = inicial; return [estados[i], (v) => { estados[i] = typeof v === "function" ? v(estados[i]) : v; }]; },
      useRef(inicial) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: inicial }); },
      useEffect(fn, deps) { const i = indiceEfeito++, antigo = efeitos[i]; if (!antigo || deps.some((v, j) => !Object.is(v, antigo.deps[j]))) fila.push(() => { antigo?.cleanup?.(); efeitos[i] = { deps, fn, cleanup: fn() }; }); },
    };
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/router") return { useRouter: () => router };
    if (id === "next/link") return { __esModule: true, default: Link };
    if (id.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
    if (id === "../services/api") return { __esModule: true, default: {
      get: async (url, config) => { chamadas.push({ metodo: "GET", url, config }); return opcoes.api ? opcoes.api.get(url, config) : opcoes.get ? opcoes.get(url, config) : { data: perfis }; },
      post: async (url, body, config) => {
        chamadas.push({ metodo: "POST", url, body, config });
        if (opcoes.api) return opcoes.api.post(url, body, config);
        if (opcoes.post) return opcoes.post(url, body, config);
        if (url === "/perfis-jogo") { const perfil = { _id: P, ...body }; perfis.push(perfil); return { status: 201, data: perfil }; }
        return { status: 201, data: { _id: J, ...body, dificuldade: "facil" } };
      },
    } };
    throw new Error(`Import inesperado: ${id}`);
  } };
  vm.runInNewContext(code, contexto);
  function nos(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  function texto(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.map(texto).join(" "); return n?.props ? texto(n.props.children) : typeof n === "string" ? n : ""; }
  const tela = {
    chamadas, navegacoes, storage, nos, texto,
    render() { indiceEstado = indiceRef = indiceEfeito = 0; arvore = contexto.exports.default(); while (fila.length) fila.shift()(); return tela; },
    botao() { return nos().find((n) => n.props["aria-label"] === "Começar"); },
    genero(indice) { nos().filter((n) => n.type === "button" && n.props.className?.startsWith("opcaoGenero"))[indice].props.onClick(); return tela.render(); },
    personagem(indice) { nos().filter((n) => n.props.className?.startsWith("cardPersonagem"))[indice].props.onClick(); return tela.render(); },
    async concluir() { await new Promise(setImmediate); return tela.render(); },
    desmontar() { efeitos.forEach((e) => e.cleanup?.()); },
    strictMode() { efeitos.forEach((e) => { e.cleanup?.(); e.cleanup = e.fn(); }); },
  };
  return tela.render();
}

test("novo jogo cria personagem e partida reais a partir da opção visual", async () => {
  const t = montar(); assert.equal(t.chamadas.length, 0);
  t.genero(1).personagem(1);
  await t.botao().props.onClick(); t.render();
  assert.deepEqual(t.chamadas.map((c) => [c.metodo, c.url]), [["GET", "/perfis-jogo"], ["POST", "/perfis-jogo"], ["POST", "/jogos-salvos"]]);
  assert.deepEqual(JSON.parse(JSON.stringify(t.chamadas[1].body)), { nomeAvatar: "Personagem 2", imagemAvatar: "/images/menina2.png" });
  assert.equal(t.chamadas[2].body.perfilJogoId, P);
  assert.ok(t.chamadas[2].body.nomeJogo.trim());
  assert.equal(t.navegacoes[0].pathname, "/jogo/quarto");
  assert.equal(t.navegacoes[0].query.jogoSalvoId, J);
  assert.equal(t.botao().props.disabled, true);
  t.desmontar();
});

test("personagem ativo com aparência escolhida é reutilizado sem criar outro", async () => {
  const t = montar({ perfis: [{ _id: P, nomeAvatar: "Existente", imagemAvatar: "/images/boneco.png" }] });
  await t.botao().props.onClick(); t.render();
  assert.equal(t.chamadas.filter((c) => c.metodo === "POST").length, 1);
  assert.equal(t.chamadas[1].url, "/jogos-salvos");
  assert.equal(t.chamadas[1].body.perfilJogoId, P); t.desmontar();
});

test("duplo clique antes do primeiro await e StrictMode não duplicam criação", async () => {
  const d = diferida(), t = montar({ get: () => d.promise });
  t.strictMode(); assert.equal(t.chamadas.length, 0);
  const clicar = t.botao().props.onClick, primeiro = clicar(), segundo = clicar(); t.render();
  assert.equal(t.chamadas.length, 1); assert.equal(t.botao().props.disabled, true);
  t.genero(1).personagem(1);
  d.resolve({ data: [] }); await Promise.all([primeiro, segundo]); t.render();
  assert.equal(t.chamadas.length, 3); assert.equal(t.navegacoes.length, 1);
  assert.equal(t.chamadas[1].body.imagemAvatar, "/images/boneco.png", "seleção não muda durante criação");
  await clicar(); assert.equal(t.chamadas.length, 3); t.desmontar();
});

test("JWT ausente não envia requisições", async () => {
  const t = montar({ semToken: true }); await t.botao().props.onClick(); t.render();
  assert.equal(t.chamadas.length, 0); assert.deepEqual(t.navegacoes, ["/"]); t.desmontar();
});

for (const status of [401, 403, 404, 409]) test(`falha ${status} na criação é exibida sem navegar para jogo`, async () => {
  const t = montar({ post: async () => { throw { response: { status, data: { mensagem: "Regra de criação" } } }; } });
  await t.botao().props.onClick(); t.render();
  assert.equal(t.navegacoes.some((n) => n?.pathname === "/jogo/quarto"), false);
  assert.ok(t.nos().some((n) => n.props.role === "alert"));
  assert.equal(t.storage.has("token"), status !== 401);
  if (status === 409) assert.match(t.texto(), /Regra de criação/);
  t.desmontar();
});

for (const etapa of ["personagem", "partida"]) test(`criação ${etapa} sem ID bloqueia repetição e oferece jogos salvos`, async () => {
  const t = montar({ perfis: etapa === "partida" ? [{ _id: P, imagemAvatar: "/images/boneco.png" }] : [], post: async () => ({ status: 201, data: {} }) });
  const clicar = t.botao().props.onClick; await clicar(); t.render();
  assert.match(t.texto(), /pode ter sido salvo/); assert.equal(t.botao().props.disabled, true);
  assert.ok(t.nos().some((n) => n.type === Link && n.props.href === "/jogos-salvos"));
  const numero = t.chamadas.length; await clicar(); assert.equal(t.chamadas.length, numero);
  assert.equal(t.navegacoes.length, 0); t.desmontar();
});

test("falha de rede durante POST não repete criação automaticamente", async () => {
  const t = montar({ post: async () => { throw new Error("rede simulada"); } });
  const clicar = t.botao().props.onClick; await clicar(); t.render(); await t.concluir();
  assert.equal(t.botao().props.disabled, true); assert.match(t.texto(), /pode ter sido salvo/);
  await clicar(); assert.equal(t.chamadas.length, 2); t.desmontar();
});

test("falha de GET não cria registros e permite tentativa manual", async () => {
  const t = montar({ get: async () => { throw new Error("rede"); } });
  await t.botao().props.onClick(); t.render();
  assert.equal(t.chamadas.length, 1); assert.equal(t.botao().props.disabled, false);
  assert.equal(t.navegacoes.length, 0); t.desmontar();
});

test("lista inválida ou personagem existente sem ObjectId não criam partida", async () => {
  for (const data of [{ perfis: [] }, [{ _id: "m1", imagemAvatar: "/images/boneco.png" }]]) {
    const t = montar({ get: async () => ({ data }) }); await t.botao().props.onClick(); t.render();
    assert.equal(t.chamadas.length, 1); assert.equal(t.navegacoes.length, 0); t.desmontar();
  }
});

test("navegação cancelada oferece partida criada sem criar outra", async () => {
  const t = montar({ navegar: async () => false });
  const clicar = t.botao().props.onClick; await clicar(); t.render();
  const link = t.nos().find((n) => n.type === Link && n.props.href?.pathname === "/jogo/quarto");
  assert.equal(link.props.href.query.jogoSalvoId, J);
  assert.match(t.texto(), /A partida foi criada/);
  await clicar(); assert.equal(t.chamadas.length, 3); t.desmontar();
});

test("desmontagem durante consulta cancela encadeamento e ignora 401 tardio", async () => {
  const d = diferida(), t = montar({ get: () => d.promise });
  const requisicao = t.botao().props.onClick(); t.desmontar();
  assert.equal(t.chamadas[0].config.signal.aborted, true);
  d.reject({ response: { status: 401 } }); await requisicao;
  assert.equal(t.chamadas.length, 1); assert.equal(t.navegacoes.length, 0); assert.ok(t.storage.has("token"));
});

test("links do menu apontam para páginas existentes; carregar não usa rota inexistente", () => {
  const contexto = { exports: {}, require(id) {
    if (id === "react") return {};
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/link") return { __esModule: true, default: Link };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (id.endsWith(".css")) return { __esModule: true, default: {} };
    throw new Error(id);
  } };
  vm.runInNewContext(compilar("HomeMenu"), contexto);
  function nos(n) { if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  const links = nos(contexto.exports.default({})).filter((n) => n.type === Link);
  assert.deepEqual(links.map((n) => n.props.href), ["/escolher-personagem", "/perfil", "/jogos-salvos"]);
  links.forEach((n) => assert.ok(fs.existsSync(path.resolve(__dirname, "../src/pages", n.props.href.slice(1) + ".js"))));
});

test("Perfil mantém navegação para partidas fora dos cartões dos cômodos", () => {
  const estados = [null, null, null, null, [{ _id: P, nome: "Quarto", ordem: 1 }, { _id: J, nome: "Cozinha", ordem: 2 }], {}, "", false];
  let indice = 0;
  const contexto = { exports: {}, require(id) {
    if (id === "react") return { useRef: initial => ({current: initial}), useState(initial) { const atual = indice++; return [atual < estados.length ? estados[atual] : initial, () => {}]; }, useEffect() {} };
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/router") return { useRouter: () => ({}) };
    if (id === "next/link") return { __esModule: true, default: Link };
    if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
    if (id.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
    if (id === "../services/api") return { __esModule: true, default: {} };
    throw new Error(id);
  } };
  vm.runInNewContext(compilar("Perfil"), contexto);
  function nos(n) { if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  const arvore = contexto.exports.default({});
  const cards = nos(arvore).filter((n) => n.props.className?.startsWith("itemComodo"));
  assert.equal(cards[0].type, "article");
  assert.equal(nos(cards[0]).some((n) => n.type === Link), false);
  assert.ok(nos(arvore).some((n) => n.type === Link && n.props.href === "/jogos-salvos"));
  assert.equal(cards[1].type, "article"); assert.equal(nos(cards[1]).some((n) => n.type === Link), false);
});

test("criação por HTTP local usa Axios/JWT/Routes/Controllers/Services reais; Models em memória", async (t) => {
  const [{ preparar, Perfil, Crianca, Jogo, id }, { default: express }, { default: perfilRoutes }, { default: jogoRoutes }] = await Promise.all([
    import("../../backend/tests/helpers/jogoSalvoMock.js"), import("../../backend/node_modules/express/index.js"),
    import("../../backend/routes/perfilJogoRoutes.js"), import("../../backend/routes/jogoSalvoRoutes.js"),
  ]);
  const j = await preparar(t);
  t.mock.method(Perfil, "create", async (valores) => {
    const doc = new Perfil(valores); await doc.validate(); j.dados.get(Perfil).set(String(doc._id), doc.toObject()); return doc;
  });
  const app = express(); app.use(express.json()); app.use("/perfis-jogo", perfilRoutes); app.use("/jogos-salvos", jogoRoutes);
  const servidor = app.listen(0, "127.0.0.1"); await require("node:events").once(servidor, "listening");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const token = j.token();
  const codigoApi = babel.transformSync(fs.readFileSync(path.resolve(__dirname, "../src/services/api.js"), "utf8"), {
    babelrc: false, configFile: false, plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  }).code;
  const localStorage = { getItem: () => token };
  const contexto = { exports: {}, require, localStorage, window: { localStorage }, process: { env: { NEXT_PUBLIC_API_URL: base } } };
  vm.runInNewContext(codigoApi, contexto); const api = contexto.exports.default;
  const vazios = await api.get("/jogos-salvos");
  assert.equal(vazios.status, 200); assert.deepEqual(vazios.data, [], "sem partidas é 200 [], não 404");
  const tela = montar({ api }); await tela.botao().props.onClick(); tela.render();
  assert.equal(tela.chamadas.length, 3);
  assert.equal(j.linhas(Jogo).length, 1); assert.equal(j.linhas(Perfil).length, 2);
  const partidaId = tela.navegacoes[0].query.jogoSalvoId;
  assert.match(partidaId, /^[a-f0-9]{24}$/);
  const partida = await api.get(`/jogos-salvos/${partidaId}`);
  assert.equal(partida.status, 200); assert.equal(partida.data.perfilJogoId.imagemAvatar, "/images/boneco.png");
  const outroUsuario = id(); j.inserir(Crianca, { usuarioId: outroUsuario, permissaoAtiva: true });
  const alheia = await fetch(`${base}/jogos-salvos/${partidaId}`, { headers: { Authorization: `Bearer ${j.token({ id: String(outroUsuario) })}` } });
  assert.equal(alheia.status, 404, "partida alheia é recurso indisponível");
  const semCrianca = await fetch(`${base}/jogos-salvos`, { headers: { Authorization: `Bearer ${j.token({ id: String(id()) })}` } });
  assert.equal(semCrianca.status, 404, "cadastro infantil ausente também gera 404, com rota existente");
  assert.equal(j.sessoes.length, 0, "criação não inicia transação nem sessão de jogo");
  tela.desmontar();
});

test("nova tentativa após rejeição da partida reutiliza o personagem já criado", async () => {
  const perfis = []; let partidas = 0, personagens = 0;
  const t = montar({ get: async () => ({ data: perfis }), post: async (url, body) => {
    if (url === "/perfis-jogo") { personagens++; const p = { _id: P, ...body }; perfis.push(p); return { status: 201, data: p }; }
    if (++partidas === 1) throw { response: { status: 409, data: { mensagem: "Criação rejeitada" } } };
    return { status: 201, data: { _id: J, ...body } };
  } });
  await t.botao().props.onClick(); t.render(); assert.equal(t.botao().props.disabled, false);
  await t.botao().props.onClick(); t.render();
  assert.equal(personagens, 1); assert.equal(partidas, 2); assert.equal(t.navegacoes.length, 1); t.desmontar();
});

for (const semToken of [true, false]) test(`menu encaminha autenticação ausente/expirada ao login existente (${semToken})`, async () => {
  const arquivo = path.resolve(__dirname, "../src/pages/menu.js");
  const { code } = babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
    filename: arquivo, babelrc: false, configFile: false,
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  const storage = new Map(semToken ? [] : [["token", "ficticio"], ["usuario", JSON.stringify({ perfil: "crianca" })]]);
  let efeito; const navegacoes = [];
  const contexto = { exports: {}, localStorage: { getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) }, require(id) {
    if (id === "react") return { useState: (inicial) => [inicial, () => {}], useRef: (inicial) => ({ current: inicial }), useEffect: (fn) => { efeito = fn; } };
    if (id === "react/jsx-runtime") return require(id);
    if (id === "next/router") return { useRouter: () => ({ replace: (url) => navegacoes.push(url) }) };
    if (id === "../components/HomeMenu") return { __esModule: true, default: () => null };
    if (id === "../services/api") return { __esModule: true, default: { get: async () => { throw { response: { status: 401 } }; } } };
    throw new Error(id);
  } };
  vm.runInNewContext(code, contexto); contexto.exports.default(); efeito(); await new Promise(setImmediate);
  assert.deepEqual(navegacoes, ["/"]); assert.equal(storage.size, 0);
});
