const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("next/dist/compiled/babel/core");

// JSX real, hooks/router/API controlados. Não acessa navegador ou MongoDB.
const A = "6aac3c29bee9f041e4728a81";
const B = "6aac3c29bee9f041e4728a82";
const P = "6aac3dc5463fb5f785522ad6";
const S = "d852415e-23c4-4703-9ae0-681789481d74";
const partida = (id = A, perfilJogoId = { _id: P }) => ({ _id: id, perfilJogoId, dificuldade: "facil" });
const sucesso = (id = A) => ({ status: 201, data: {
  jogoSalvo: partida(id), sessaoId: S, estado: "ativa",
  expiraEm: new Date(Date.now() + 30000).toISOString(), tempoUsadoHoje: 0, limiteTempoDiario: null,
} });
const arquivo = path.resolve(__dirname, "../src/pages/jogo/quarto.js");
const { code } = babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
  filename: arquivo, babelrc: false, configFile: false,
  presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
  plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
});
function CenaQuarto() {}
function Link() {}
function diferida() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function montar({ id = A, ready = true, token = "sessao-simulada", usuario = "usuario-simulado", storageIndisponivel = false, get, post = async () => sucesso(), patch } = {}) {
  const estados = [], refs = [], efeitos = [], pendentes = [], chamadas = [], navegacoes = [], escritas = [];
  let indiceEstado, indiceRef, indiceEfeito, arvore;
  let agora = Date.now(), timerId = 0;
  const timers = new Map(), eventos = new Map();
  class Relogio extends Date {
    constructor(...args) { super(...(args.length ? args : [agora])); }
    static now() { return agora; }
  }
  const storage = new Map(token === null ? [] : [["token", token], ["usuario", usuario]]);
  const router = { query: { jogoSalvoId: id }, isReady: ready, replace: (url) => navegacoes.push(url) };
  const contexto = {
    exports: {}, AbortController, Date: Relogio,
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, quando: agora + delay, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    window: {
      addEventListener: (nome, fn) => eventos.set(nome, fn),
      removeEventListener: (nome, fn) => { if (eventos.get(nome) === fn) eventos.delete(nome); },
    },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => { if (storageIndisponivel) throw new Error("storage indispon?vel"); storage.set(k, v); }, removeItem: (k) => storage.delete(k) },
    require(id) {
      if (id === "react") return {
        useState(inicial) { const i = indiceEstado++; if (!(i in estados)) estados[i] = inicial; return [estados[i], (v) => { estados[i] = typeof v === "function" ? v(estados[i]) : v; escritas.push(i); }]; },
        useRef(inicial) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: inicial }); },
        useEffect(fn, deps) { const i = indiceEfeito++, antigo = efeitos[i]; if (!antigo || deps.some((v, j) => !Object.is(v, antigo.deps[j]))) pendentes.push(() => { antigo?.cleanup?.(); efeitos[i] = { deps, fn, cleanup: fn() }; }); },
      };
      if (id === "react/jsx-runtime") return require(id);
      if (id === "lucide-react") return new Proxy({}, { get: () => function Icone() {} });
      if (id.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
      if (id === "next/router") return { useRouter: () => router };
      if (id === "next/link") return { __esModule: true, default: Link };
      if (id === "../../components/jogo/CenaQuarto") return { __esModule: true, default: CenaQuarto };
      if (id === "../../services/api") return { __esModule: true, default: {
        get: async (url, config) => { chamadas.push({ metodo: "GET", url, config }); return get ? get(url, config) : { data: partida(url.split("/").pop()) }; },
        post: async (url, body, config) => { chamadas.push({ metodo: "POST", url, body, config }); return post(url, body, config); },
        patch: async (url, body, config) => {
          chamadas.push({ metodo: "PATCH", url, body, config });
          return patch ? patch(url, body, config) : { status: 200, data: {
            sessaoId: S, estado: url.endsWith("/encerrar") ? "encerrada" : "ativa",
            expiraEm: new Date(agora + 30000).toISOString(), tempoUsadoHoje: 0, limiteTempoDiario: null,
          } };
        },
      } };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(code, contexto, { filename: arquivo });
  function nos(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  function texto(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.map(texto).join(" "); return n?.props ? texto(n.props.children) : typeof n === "string" ? n : ""; }
  const tela = {
    router, storage, chamadas, navegacoes, escritas, nos, texto, timers, eventos,
    render(efeitosAtivos = true) { indiceEstado = indiceRef = indiceEfeito = 0; arvore = contexto.exports.default(); if (efeitosAtivos) while (pendentes.length) pendentes.shift()(); return tela; },
    async concluir() { await new Promise(setImmediate); return tela.render(); },
    botao() { return nos().find((n) => n.type === "button"); },
    sair() { return nos().find((n) => n.props["aria-label"] === "Sair da partida").props.onClick(); },
    cena() { return nos().find((n) => n.type === CenaQuarto); },
    posts() { return chamadas.filter((c) => c.metodo === "POST"); },
    patches() { return chamadas.filter((c) => c.metodo === "PATCH"); },
    async avancar(ms) {
      const fim = agora + ms;
      while (true) {
        const proximo = [...timers].filter(([, t]) => t.quando <= fim).sort((a, b) => a[1].quando - b[1].quando)[0];
        if (!proximo) break;
        const [id, timer] = proximo; agora = timer.quando; timers.delete(id); timer.fn(); await tela.concluir();
      }
      agora = fim; return tela.render();
    },
    selecionar(id, efeitosAtivos = true) { router.query = { jogoSalvoId: id }; return tela.render(efeitosAtivos); },
    repetirEfeitos() { efeitos.forEach((e) => e.cleanup?.()); efeitos.forEach((e) => { e.cleanup = e.fn(); }); return tela; },
    desmontar() { efeitos.forEach((e) => e.cleanup?.()); },
  };
  return tela.render();
}

const U = "6ae7cd2cbd8efb076611ffff";
const usuarioAutenticado = JSON.stringify({ id: U, perfil: "crianca" });
const chavePreferencia = `conectamente:ultima-partida:${U}`;

test("última partida: GET validado registra preferência e dispara somente uma sessão", async () => {
  const d = diferida(), t = montar({ usuario: usuarioAutenticado, get: () => d.promise });
  assert.equal(t.storage.has(chavePreferencia), false);
  d.resolve({ data: partida() }); await t.concluir();
  assert.equal(t.storage.get(chavePreferencia), A); assert.equal(t.posts().length, 1);
  assert.ok(t.cena()); t.desmontar();
});

for (const status of [401, 403, 404]) test(`última partida: GET ${status} não registra nem troca preferência`, async () => {
  const t = montar({ usuario: usuarioAutenticado, get: async () => { throw { response: { status } }; } });
  t.storage.set(chavePreferencia, B); await t.concluir(); assert.equal(t.storage.get(chavePreferencia), B); t.desmontar();
});

test("última partida: resposta obsoleta não sobrescreve a partida validada mais recente", async () => {
  const d = diferida(), t = montar({ usuario: usuarioAutenticado, get: async (url) => url.endsWith(A) ? d.promise : { data: partida(B) } });
  t.selecionar(B); await t.concluir(); assert.equal(t.storage.get(chavePreferencia), B);
  d.resolve({ data: partida() }); await t.concluir(); assert.equal(t.storage.get(chavePreferencia), B); t.desmontar();
});

test("última partida: troca da autenticação durante consulta não grava na conta anterior", async () => {
  const d = diferida(), t = montar({ usuario: usuarioAutenticado, get: () => d.promise });
  t.storage.set("usuario", JSON.stringify({ id: B, perfil: "crianca" }));
  t.storage.set("token", "outra-sessao-simulada");
  d.resolve({ data: partida() }); await t.concluir(); assert.equal(t.storage.has(chavePreferencia), false);
  assert.equal(t.storage.has(`conectamente:ultima-partida:${B}`), false); t.desmontar();
});

test("última partida: armazenamento bloqueado não impede sessão e heartbeat", async () => {
  const t = montar({ usuario: usuarioAutenticado, storageIndisponivel: true }); await t.concluir();
  await t.concluir(); assert.equal(t.cena().props.sessaoId, S);
  await t.avancar(10000); assert.equal(t.patches().length, 1); assert.equal(t.posts().length, 1); t.desmontar();
});

test("última partida: consulta incompleta e desmontagem não persistem preferência", async () => {
  const t = montar({ usuario: usuarioAutenticado, get: async () => ({ data: { ...partida(), dificuldade: null } }) });
  await t.concluir(); assert.equal(t.storage.has(chavePreferencia), false); t.desmontar();
  const d = diferida(), outra = montar({ usuario: usuarioAutenticado, get: () => d.promise }); outra.desmontar();
  d.resolve({ data: partida() }); await outra.concluir(); assert.equal(outra.storage.has(chavePreferencia), false);
});

test("GET validado inicia automaticamente, confirma UUID e passa contexto à cena", async () => {
  const t = montar(); await t.concluir();
  assert.equal(t.posts().length, 1);
  const cena = t.cena();
  assert.equal(cena.props.sessaoId, S);
  assert.equal(cena.props.jogoSalvoId, A);
  assert.equal(cena.props.perfilJogoId, P);
  assert.equal(cena.props.dificuldade, "facil");
  assert.ok(cena.props.expiraEm);
  assert.equal(t.posts().length, 1);
  assert.equal(t.posts()[0].url, `/jogos-salvos/${A}/sessao`);
  assert.deepEqual(Object.keys(t.posts()[0].body), []);
  t.desmontar();
});

test("trava imediata impede múltiplos efeitos e não oferece botão de início", async () => {
  const d = diferida(), t = montar({ post: () => d.promise }); await t.concluir();
  for (let i = 0; i < 8; i++) t.render();
  assert.equal(t.posts().length, 1); assert.equal(t.botao(), undefined);
  assert.equal(t.cena(), undefined); assert.match(t.texto(), /Preparando seu jogo/);
  d.resolve(sucesso()); await t.concluir();
  assert.ok(t.cena()); for (let i = 0; i < 8; i++) t.render();
  assert.equal(t.posts().length, 1); t.desmontar();
});

test("StrictMode: setup-cleanup-setup antes do GET dispara um único POST", async () => {
  const t = montar(); t.repetirEfeitos(); await t.concluir();
  assert.equal(t.posts().length, 1); assert.ok(t.cena()); assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.timers.size, 2); assert.equal(t.nos().some((n) => t.texto(n) === "Iniciar jogo"), false); t.desmontar();
});

test("repetir efeitos depois da confirmação mantém UUID e heartbeat sem outro POST", async () => {
  const t = montar(); await t.concluir(); const uuid = t.cena().props.sessaoId;
  t.repetirEfeitos(); await t.concluir();
  assert.equal(t.posts().length, 1); assert.equal(t.cena().props.sessaoId, uuid); assert.equal(t.timers.size, 2);
  await t.avancar(10000); assert.equal(t.patches().length, 1); t.desmontar();
});

test("cleanup com POST pendente não o reenvia nem aceita sucesso tardio", async () => {
  const d = diferida(), t = montar({ post: () => d.promise }); await t.concluir();
  const signal = t.posts()[0].config.signal; t.repetirEfeitos(); await t.concluir();
  assert.equal(signal.aborted, true); assert.equal(t.posts().length, 1); assert.equal(t.cena(), undefined);
  assert.match(t.texto(), /Esta entrada já foi solicitada/);
  d.resolve(sucesso()); await t.concluir(); assert.equal(t.cena(), undefined); assert.equal(t.posts().length, 1); t.desmontar();
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }]) test(`início incerto ${erro.code ?? "rede"} não é reenviado por novo efeito ou A→B→A`, async () => {
  const t = montar({ post: async (url) => { if (url.includes(A)) throw erro; return sucesso(B); } }); await t.concluir();
  assert.match(t.texto(), /pode ter sido criada/); t.repetirEfeitos(); await t.concluir();
  assert.equal(t.posts().length, 1); assert.equal(t.cena(), undefined);
  t.selecionar(B); await t.concluir(); assert.equal(t.cena().props.jogoSalvoId, B);
  t.selecionar(A); await t.concluir(); assert.equal(t.posts().length, 2); assert.equal(t.cena(), undefined);
  assert.equal(t.posts()[0].config.timeout, 10000); t.desmontar();
});

test("GET não confirmado não dispara POST e mantém preparação acessível", async () => {
  const d = diferida(), t = montar({ get: () => d.promise });
  await t.concluir(); assert.equal(t.posts().length, 0); assert.match(t.texto(), /Preparando seu jogo/);
  assert.ok(t.nos().some((n) => n.props.role === "status"));
  d.reject({ response: { status: 403 } }); await t.concluir();
  assert.equal(t.posts().length, 0); assert.equal(t.cena(), undefined);
  assert.ok(t.nos().some((n) => n.props.role === "alert"));
  assert.ok(t.nos().some((n) => n.props.href === "/jogos-salvos")); t.desmontar();
});

for (const [nome, alterar] of [
  ["sem ID", (r) => { delete r.data.sessaoId; }],
  ["ID vazio", (r) => { r.data.sessaoId = ""; }],
  ["ID malformado", (r) => { r.data.sessaoId = "nao-uuid"; }],
  ["outra partida", (r) => { r.data.jogoSalvo = partida(B); }],
  ["estado inativo", (r) => { r.data.estado = "encerrada"; }],
  ["expiração inválida", (r) => { r.data.expiraEm = "invalida"; }],
  ["status inesperado", (r) => { r.status = 200; }],
  ["dificuldade diferente", (r) => { r.data.jogoSalvo.dificuldade = "medio"; }],
  ["personagem diferente", (r) => { r.data.jogoSalvo.perfilJogoId = A; }],
  ["sessão já expirada", (r) => { r.data.expiraEm = new Date(Date.now() - 1000).toISOString(); }],
]) test(`sucesso incompleto (${nome}) não monta cena`, async () => {
  const t = montar({ post: async () => { const r = sucesso(); alterar(r); return r; } }); await t.concluir();
  await t.concluir();
  assert.equal(t.cena(), undefined);
  assert.match(t.texto(), /Não foi possível confirmar/);
  assert.ok(t.storage.has("token")); t.desmontar();
});

for (const [status, codigo, mensagem] of [
  [409, "SESSAO_JA_ATIVA", /Já existe uma sessão/],
  [409, "CONFLITO_SESSAO", /conflito/],
  [409, "SESSAO_EXPIRADA", /conflito/],
  [403, "LIMITE_TEMPO_ATINGIDO", /tempo de jogo terminou/],
  [403, "PERMISSAO_INATIVA", /permissão para jogar está inativa/],
  [403, undefined, /não tem permissão/],
  [404, undefined, /Partida não encontrada/],
  [500, undefined, /pode ter sido criada/],
]) test(`erro ${status}/${codigo} não inicia e preserva login`, async () => {
  const t = montar({ post: async () => { throw { response: { status, data: { codigo } } }; } }); await t.concluir();
  await t.concluir();
  assert.equal(t.cena(), undefined);
  assert.match(t.texto(), mensagem);
  assert.ok(t.storage.has("token"));
  assert.equal(t.navegacoes.length, 0);
  assert.equal(t.posts().length, 1); t.desmontar();
});

test("falha de rede não confirma sessão nem repete POST automaticamente", async () => {
  const t = montar({ post: async () => { throw new Error("rede simulada"); } }); await t.concluir();
  await t.concluir(); await t.concluir();
  assert.equal(t.cena(), undefined);
  assert.match(t.texto(), /aguarde sua expiração/);
  assert.equal(t.posts().length, 1);
  assert.equal(t.botao(), undefined); t.desmontar();
});

test("401 no POST limpa sessão e encaminha ao login", async () => {
  const t = montar({ post: async () => { throw { response: { status: 401 } }; } }); await t.concluir();
  await t.concluir();
  assert.equal(t.cena(), undefined);
  assert.equal(t.storage.size, 0);
  assert.deepEqual(t.navegacoes, ["/"]); t.desmontar();
});

test("token removido depois do GET impede o POST", async () => {
  const d = diferida(), t = montar({ get: () => d.promise }); t.storage.delete("token"); d.resolve({ data: partida() });
  await t.concluir();
  assert.equal(t.posts().length, 0);
  assert.equal(t.storage.size, 0);
  assert.deepEqual(t.navegacoes, ["/"]); t.desmontar();
});

for (const resultado of ["sucesso", "401"]) test(`troca de partida ignora POST obsoleto ${resultado} e seu finally`, async () => {
  const antiga = diferida(), nova = diferida();
  const t = montar({ post: (url) => url.includes(A) ? antiga.promise : nova.promise }); await t.concluir();
  const anterior = t.concluir();
  const sinal = t.posts()[0].config.signal;
  t.selecionar(B); await t.concluir();
  const atual = t.concluir();
  assert.equal(sinal.aborted, true);
  if (resultado === "401") antiga.reject({ response: { status: 401 } }); else antiga.resolve(sucesso(A));
  await anterior; t.render();
  assert.equal(t.cena(), undefined);
  assert.equal(t.botao(), undefined);
  assert.ok(t.storage.has("token"));
  assert.equal(t.navegacoes.length, 0);
  await t.concluir(); assert.equal(t.posts().length, 2);
  nova.resolve(sucesso(B)); await atual; await t.concluir();
  assert.equal(t.cena().props.jogoSalvoId, B); t.desmontar();
});

for (const resultado of ["sucesso", "401"]) test(`desmontagem ignora resultado ${resultado}`, async () => {
  const d = diferida(), t = montar({ post: () => d.promise }); await t.concluir();
  const requisicao = t.concluir(); t.desmontar(); const escritas = t.escritas.length;
  if (resultado === "401") d.reject({ response: { status: 401 } }); else d.resolve(sucesso());
  await requisicao;
  assert.equal(t.escritas.length, escritas);
  assert.ok(t.storage.has("token"));
  assert.equal(t.navegacoes.length, 0);
});

test("partida indisponível e JWT ausente no GET não oferecem início", async () => {
  for (const configuracao of [{ token: null }, { get: async () => { throw { response: { status: 404 } }; } }]) {
    const t = montar(configuracao); await t.concluir();
    assert.equal(t.botao(), undefined); assert.equal(t.cena(), undefined); assert.equal(t.posts().length, 0); t.desmontar();
  }
});

test("router não pronto e query inválida não enviam requisições de sessão", async () => {
  const t = montar({ ready: false }); await t.concluir(); assert.equal(t.chamadas.length, 0);
  t.router.isReady = true; t.selecionar("invalido"); await t.concluir();
  assert.equal(t.chamadas.length, 0); assert.equal(t.botao(), undefined); t.desmontar();
});

test("preparação e query ausente têm fundo e texto explícitos para não herdar tela escura", async () => {
  for (const id of [null, A]) {
    const t = montar({ id, post: () => diferida().promise }); await t.concluir();
    const main = t.nos().find((n) => n.type === "main");
    assert.equal(main.props.style.background, "#f8fafc");
    assert.equal(main.props.style.color, "#0f172a"); t.desmontar();
  }
});

async function entrar(configuracao) {
  const t = montar(configuracao); await t.concluir();
  await t.concluir();
  return t;
}

test("heartbeat a cada 10 segundos sem intervalos duplicados e sem remontar cena", async () => {
  const t = await entrar();
  for (let i = 0; i < 4; i++) t.render();
  assert.equal(t.timers.size, 2);
  await t.avancar(9999); assert.equal(t.patches().length, 0);
  await t.avancar(1); assert.equal(t.patches().length, 1);
  assert.equal(t.patches()[0].url, "/jogos-salvos/sessao/heartbeat");
  assert.equal(t.patches()[0].body.sessaoId, S);
  const chave = t.cena().key;
  await t.avancar(20000); assert.equal(t.patches().length, 3);
  assert.equal(t.cena().key, chave);
  assert.equal(t.timers.size, 2);
  t.desmontar(); assert.equal(t.timers.size, 0); assert.equal(t.eventos.size, 0);
});

test("heartbeat pendente não concorre e expiração bloqueia inclusive teclado", async () => {
  const d = diferida(), t = await entrar({ patch: () => d.promise });
  await t.avancar(20000);
  assert.equal(t.patches().length, 1);
  await t.avancar(11000);
  assert.ok(t.nos().some((n) => n.props.role === "alertdialog"));
  assert.ok(t.nos().some((n) => n.props.inert === true));
  assert.equal(t.patches()[0].config.signal.aborted, true);
  assert.equal(t.timers.size, 0);
  let bloqueou = 0;
  t.eventos.get("keydown")({ key: "d", preventDefault() { bloqueou++; }, stopImmediatePropagation() { bloqueou++; } });
  assert.equal(bloqueou, 2);
  d.resolve({ status: 200, data: { sessaoId: S, estado: "ativa", expiraEm: new Date(Date.now() + 60000).toISOString() } });
  await t.concluir();
  assert.ok(t.nos().some((n) => n.props.inert === true));
  assert.equal(t.timers.size, 0); t.desmontar();
});

for (const [status, codigo] of [[409, "SESSAO_EXPIRADA"], [409, "SESSAO_INVALIDA"], [409, "SESSAO_INATIVA"], [403, "LIMITE_TEMPO_ATINGIDO"], [403, "PERMISSAO_INATIVA"], [401, undefined], [undefined, undefined]]) {
  test(`falha heartbeat ${status}/${codigo}: bloqueia cena e interrompe timers`, async () => {
    const t = await entrar({ patch: async () => { throw status ? { response: { status, data: { codigo } } } : new Error("rede simulada"); } });
    await t.avancar(10000);
    assert.ok(t.cena(), "cena permanece montada");
    assert.ok(t.nos().some((n) => n.props.inert === true));
    assert.equal(t.timers.size, 0);
    await t.avancar(60000); assert.equal(t.patches().length, 1);
    assert.equal(t.storage.has("token"), status !== 401);
    if (status === 401) assert.deepEqual(t.navegacoes, ["/"]);
    t.desmontar();
  });
}

test("heartbeat tardio após desmontagem não altera estado e não deixa timers", async () => {
  const d = diferida(), t = await entrar({ patch: () => d.promise });
  await t.avancar(10000); t.desmontar(); const antes = t.escritas.length;
  d.reject({ response: { status: 401 } }); await new Promise(setImmediate);
  assert.equal(t.escritas.length, antes); assert.ok(t.storage.has("token"));
  assert.equal(t.timers.size, 0); assert.equal(t.navegacoes.length, 0);
});

test("cartão final: Voltar ao Painel encerra uma vez e navega ao menu somente após confirmação", async () => {
  const encerramento = diferida();
  const t = await entrar({ patch: async () => encerramento.promise });
  const voltar = t.cena().props.onSairDoJogo;
  const a = voltar("/menu"), b = voltar("/menu"); t.render();
  assert.equal(t.patches().length, 1);
  assert.equal(t.patches()[0].url, "/jogos-salvos/sessao/encerrar");
  assert.equal(t.patches()[0].body.sessaoId, S);
  assert.equal(t.timers.size, 0);
  assert.deepEqual(t.navegacoes, []);
  assert.match(t.texto(), /Saindo da partida/);
  encerramento.resolve({ status: 200, data: { sessaoId: S, estado: "encerrada" } });
  await Promise.all([a, b]); t.render();
  assert.deepEqual(t.navegacoes, ["/menu"]);
  await t.avancar(60000);
  assert.equal(t.patches().length, 1);
  t.desmontar();
});

for (const erro of [new Error("rede"), { response: { status: 403 } }, { response: { status: 409 } }]) test(`cartão final: falha de encerramento ${erro.response?.status ?? "rede"} não anuncia sucesso nem navega`, async () => {
  const t = await entrar({ patch: async () => { throw erro; } });
  await t.cena().props.onSairDoJogo("/menu"); t.render();
  assert.equal(t.patches().length, 1);
  assert.deepEqual(t.navegacoes, []);
  assert.equal(t.timers.size, 0);
  assert.ok(t.nos().some((n) => n.props.inert === true));
  assert.doesNotMatch(t.texto(), /Sessão encerrada\./);
  t.desmontar();
});

test("cartão final: erro de rede seguido de nova saída explícita mantém destino do painel", async () => {
  let tentativas = 0;
  const t = await entrar({ patch: async () => {
    if (++tentativas === 1) throw new Error("rede");
    return { status: 200, data: { sessaoId: S, estado: "encerrada" } };
  } });
  await t.cena().props.onSairDoJogo("/menu"); t.render();
  assert.deepEqual(t.navegacoes, []);
  await t.sair(); t.render();
  assert.equal(t.patches().length, 2);
  assert.deepEqual(t.navegacoes, ["/menu"]);
  t.desmontar();
});

test("cartão final: encerramento sem confirmação válida não navega ao painel", async () => {
  const t = await entrar({ patch: async () => ({ status: 200, data: { sessaoId: S, estado: "ativa" } }) });
  await t.cena().props.onSairDoJogo("/menu"); t.render();
  assert.deepEqual(t.navegacoes, []);
  assert.match(t.texto(), /Não foi possível confirmar a saída/);
  t.desmontar();
});

test("saída explícita confirma encerramento sem expiraEm e interrompe toda renovação", async () => {
  const t = await entrar({ patch: async () => ({ status: 200, data: { sessaoId: S, estado: "encerrada", tempoUsadoHoje: 10, limiteTempoDiario: null } }) });
  await t.sair(); t.render();
  assert.equal(t.patches().length, 1);
  assert.equal(t.patches()[0].url, "/jogos-salvos/sessao/encerrar");
  assert.equal(t.patches()[0].body.sessaoId, S);
  assert.deepEqual(t.navegacoes, ["/jogos-salvos"]);
  assert.equal(t.timers.size, 0);
  await t.avancar(60000); assert.equal(t.patches().length, 1);
  await t.sair(); assert.equal(t.patches().length, 1);
  t.desmontar();
});

test("saída impede cliques duplicados e ignora heartbeat pendente", async () => {
  const heartbeat = diferida(), encerramento = diferida();
  const t = await entrar({ patch: (url) => url.endsWith("/heartbeat") ? heartbeat.promise : encerramento.promise });
  await t.avancar(10000);
  const primeira = t.sair(), segunda = t.sair(); t.render();
  assert.equal(t.patches().length, 2);
  assert.equal(t.patches()[0].config.signal.aborted, true);
  assert.equal(t.timers.size, 0);
  heartbeat.reject({ response: { status: 401 } }); await t.concluir();
  assert.ok(t.storage.has("token")); assert.equal(t.navegacoes.length, 0);
  assert.match(t.texto(), /Saindo da partida/);
  encerramento.resolve({ status: 200, data: { sessaoId: S, estado: "encerrada" } });
  await Promise.all([primeira, segunda]); t.render();
  assert.deepEqual(t.navegacoes, ["/jogos-salvos"]); t.desmontar();
});

test("falha ao sair mantém bloqueio sem timers e não anuncia encerramento confirmado", async () => {
  const t = await entrar({ patch: async () => { throw new Error("rede simulada"); } });
  await t.sair(); t.render();
  assert.match(t.texto(), /Não foi possível confirmar a saída/);
  assert.equal(t.navegacoes.length, 0); assert.equal(t.timers.size, 0);
  assert.ok(t.nos().some((n) => n.props.inert === true));
  await t.avancar(60000); assert.equal(t.patches().length, 1);
  await t.sair(); assert.equal(t.patches().length, 2, "nova tentativa somente por ação explícita");
  t.desmontar();
});

test("saída tardia após troca de partida não navega ou modifica nova sessão", async () => {
  const d = diferida(), t = await entrar({ patch: () => d.promise });
  const saida = t.sair(); t.selecionar(B); await t.concluir();
  d.resolve({ status: 200, data: { sessaoId: S, estado: "encerrada" } }); await saida; t.render();
  assert.equal(t.navegacoes.length, 0); assert.equal(t.cena(), undefined);
  assert.equal(t.timers.size, 0); t.desmontar();
});

test("heartbeat com sessão diferente bloqueia, mesmo com HTTP 200", async () => {
  const t = await entrar({ patch: async () => ({ status: 200, data: { sessaoId: "outra", estado: "ativa", expiraEm: new Date(Date.now() + 30000).toISOString() } }) });
  await t.avancar(10000);
  assert.ok(t.nos().some((n) => n.props.inert === true));
  assert.equal(t.timers.size, 0); t.desmontar();
});

test("validade menor que 30 segundos antecipa a primeira renovação", async () => {
  const t = await entrar({ post: async () => {
    const r = sucesso(); r.data.expiraEm = new Date(Date.now() + 8000).toISOString(); return r;
  } });
  assert.ok([...t.timers.values()].some((timer) => timer.delay > 0 && timer.delay < 5000));
  await t.avancar(5000); assert.equal(t.patches().length, 1);
  assert.equal(t.nos().some((n) => n.props.inert === true), false); t.desmontar();
});

test("troca de partida ativa remove agendamentos antigos", async () => {
  const t = await entrar(); assert.equal(t.timers.size, 2);
  t.selecionar(B); await t.concluir();
  assert.equal(t.timers.size, 0); assert.equal(t.eventos.size, 0);
  await t.avancar(60000); assert.equal(t.patches().length, 0); t.desmontar();
});

test("401 ao encerrar limpa autenticação sem confirmar saída", async () => {
  const t = await entrar({ patch: async () => { throw { response: { status: 401 } }; } });
  await t.sair(); t.render();
  assert.equal(t.storage.size, 0); assert.deepEqual(t.navegacoes, ["/"]);
  assert.equal(t.timers.size, 0); t.desmontar();
});

test("encerramento com resposta inválida não navega", async () => {
  const t = await entrar({ patch: async () => ({ status: 200, data: { sessaoId: S, estado: "pausada" } }) });
  await t.sair(); t.render();
  assert.equal(t.navegacoes.length, 0); assert.equal(t.timers.size, 0);
  assert.match(t.texto(), /Não foi possível confirmar a saída/); t.desmontar();
});

const Q = "6aac3c29bee9f041e4728a80";
const TC = "6aac3c29bee9f041e4728a8f";
const TJ = "6aac3c29bee9f041e4728a90";
const TR = "6aac3c29bee9f041e4728a91";
const catalogo = [
  { _id: TR, comodoId: Q, ordem: 3, ativo: true },
  { _id: "6aac3c29bee9f041e4728a92", comodoId: Q, ordem: 0, ativo: false },
  { _id: TJ, comodoId: Q, ordem: 2, ativo: true },
  { _id: TC, comodoId: Q, ordem: 1, ativo: true },
];
const progressoFacil = (id = A) => ({ jogoSalvoId: id, tarefas: [TC, TJ, TR].map((tarefaId) => ({
  tarefaId, dificuldade: "facil", concluida: true,
})) });
const partidaMedia = (extras = {}) => ({ ...partida(), dificuldade: "medio", comodoId: Q, tarefaId: TC, ...extras });
function montarProgressao(opcoes = {}) {
  const servidor = { partida: opcoes.partida ?? partida() };
  const t = montar({
    get: async (url, config) => {
      const especial = await opcoes.get?.(url, config, servidor);
      if (especial !== undefined) return especial;
      return { status: 200, data: url.startsWith("/tarefas/") ? { _id: TC, comodoId: Q }
        : url.startsWith("/comodos/") ? catalogo
          : url.endsWith("/progresso") ? progressoFacil(url.split("/")[2])
            : { ...servidor.partida, _id: url.split("/").pop() } };
    },
    post: async (url) => ({ ...sucesso(url.split("/")[2]), data: {
      ...sucesso(url.split("/")[2]).data, jogoSalvo: { ...servidor.partida, _id: url.split("/")[2] },
    } }),
    patch: async (url, body, config) => {
      const especial = await opcoes.patch?.(url, body, config, servidor);
      if (especial !== undefined) return especial;
      if (url === `/jogos-salvos/${A}` || url === `/jogos-salvos/${B}`) {
        servidor.partida = { ...servidor.partida, ...body };
        return { status: 200, data: servidor.partida };
      }
      return { status: 200, data: { sessaoId: S, estado: url.endsWith("/encerrar") ? "encerrada" : "ativa",
        expiraEm: new Date(Date.now() + 120000).toISOString(), tempoUsadoHoje: 0, limiteTempoDiario: null } };
    },
  });
  t.servidor = servidor;
  t.avancos = () => t.patches().filter((c) => c.url === `/jogos-salvos/${A}` || c.url === `/jogos-salvos/${B}`);
  return t;
}
async function entrarProgressao(opcoes) {
  const t = montarProgressao(opcoes); await t.concluir();
  await t.concluir();
  return t;
}

test("fácil → médio: catálogo completo e ordenado define payload, sem trocar a identidade da sessão", async () => {
  const t = await entrarProgressao();
  const inicial = t.cena(), timers = [...t.timers.keys()];
  await inicial.props.onAvancarDificuldade(); t.render();
  assert.equal(t.avancos().length, 1);
  assert.deepEqual({ ...t.avancos()[0].body }, { dificuldade: "medio", comodoId: Q, tarefaId: TC });
  assert.equal(t.cena().props.dificuldade, "medio");
  assert.equal(t.cena().props.jogoSalvo.dificuldade, "medio");
  assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.cena().props.perfilJogoId, P);
  assert.notEqual(t.cena().key, inicial.key, "somente a cena deve ser remontada");
  assert.deepEqual([...t.timers.keys()], timers, "heartbeat não foi reiniciado");
  assert.equal(typeof t.cena().props.onAvancarDificuldade, "function", "oferece médio → difícil");
  await inicial.props.onAvancarDificuldade();
  assert.equal(t.avancos().length, 1, "callback antigo permanece travado");
  await t.avancar(10000);
  assert.equal(t.patches().filter((c) => c.url.endsWith("/heartbeat")).length, 1);
  assert.equal(t.posts().length, 1, "não cria outra sessão");
  assert.equal(t.patches().find((c) => c.url.endsWith("/heartbeat")).body.sessaoId, S);
  t.desmontar();
});

test("fácil → médio: usa a primeira tarefa ativa por ordem real, não pelo índice nem ID fixo", async () => {
  const t = await entrarProgressao({ get: (url) => url.startsWith("/comodos/") ? { data: catalogo.map((r) => ({
    ...r, ordem: r._id === TJ ? -1 : r.ordem,
  })) } : undefined });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.avancos()[0].body.tarefaId, TJ);
  assert.equal(t.cena().props.dificuldade, "medio"); t.desmontar();
});

test("fácil → médio: trava imediata, duplo clique e PATCH pendente preservam fácil e heartbeat", async () => {
  const d = diferida();
  const t = await entrarProgressao({ patch: (url) => url === `/jogos-salvos/${A}` ? d.promise : undefined });
  const antes = t.cena(), clicar = antes.props.onAvancarDificuldade;
  const a = clicar(), b = clicar(); await t.concluir();
  assert.equal(t.avancos().length, 1);
  assert.equal(t.cena().key, antes.key);
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.cena().props.avancandoDificuldade, true);
  await t.avancar(10000);
  assert.equal(t.patches().filter((c) => c.url.endsWith("/heartbeat")).length, 1);
  d.resolve({ status: 200, data: partidaMedia({ perfilJogoId: P }) });
  await Promise.all([a, b]); t.render();
  assert.equal(t.cena().props.dificuldade, "medio");
  assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.posts().length, 1); t.desmontar();
});

for (const caso of ["pendente", "outra dificuldade", "outra partida", "quarta tarefa ativa"]) {
  test(`fácil → médio: ${caso} impede PATCH`, async () => {
    const t = await entrarProgressao({ get: (url) => {
      if (url.startsWith("/comodos/") && caso === "quarta tarefa ativa") return { data: [...catalogo, {
        _id: "6aac3c29bee9f041e4728a93", comodoId: Q, ordem: 4, ativo: true,
      }] };
      if (!url.endsWith("/progresso")) return;
      const data = progressoFacil();
      if (caso === "pendente") data.tarefas[2].concluida = false;
      if (caso === "outra dificuldade") data.tarefas[2].dificuldade = "medio";
      if (caso === "outra partida") data.jogoSalvoId = B;
      return { data };
    } });
    await t.cena().props.onAvancarDificuldade(); t.render();
    assert.equal(t.avancos().length, 0);
    assert.equal(t.cena().props.dificuldade, "facil");
    assert.ok(t.cena().props.erroAvanco); t.desmontar();
  });
}

for (const lista of [[], { tarefas: [] }, catalogo.map((r) => ({ ...r, ativo: false })),
  catalogo.map((r) => ({ ...r, ordem: 1 })), [...catalogo, catalogo[0]],
  catalogo.map((r) => ({ ...r, comodoId: B }))]) {
  test("fácil → médio: catálogo vazio, inconsistente ou duplicado impede PATCH", async () => {
    const t = await entrarProgressao({ get: (url) => url.startsWith("/comodos/") ? { data: lista } : undefined });
    await t.cena().props.onAvancarDificuldade(); t.render();
    assert.equal(t.avancos().length, 0);
    assert.equal(t.cena().props.dificuldade, "facil"); t.desmontar();
  });
}

for (const status of [400, 403, 404, 409]) test(`fácil → médio: PATCH ${status} mantém fácil e permite nova ação explícita`, async () => {
  const t = await entrarProgressao({ patch: (url) => {
    if (url === `/jogos-salvos/${A}`) throw { response: { status } };
  } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.cena().props.avancandoDificuldade, false);
  assert.equal(t.cena().props.avancoIncerto, false);
  assert.ok(t.cena().props.erroAvanco);
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.avancos().length, 2); t.desmontar();
});

for (const momento of ["consulta", "PATCH"]) test(`fácil → médio: 401 durante ${momento} bloqueia e limpa JWT`, async () => {
  const t = await entrarProgressao({
    get: (url) => { if (momento === "consulta" && url.startsWith("/tarefas/")) throw { response: { status: 401 } }; },
    patch: (url) => { if (momento === "PATCH" && url === `/jogos-salvos/${A}`) throw { response: { status: 401 } }; },
  });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.storage.size, 0); assert.ok(t.navegacoes.includes("/"));
  assert.ok(t.nos().some((n) => n.props.inert === true));
  t.desmontar();
});

test("fácil → médio: falha de rede antes do PATCH permite tentar novamente sem resultado incerto", async () => {
  const t = await entrarProgressao({ get: (url) => { if (url.startsWith("/tarefas/")) throw new Error("Sem conexão para consultar o catálogo."); } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.avancos().length, 0);
  assert.equal(t.cena().props.avancoIncerto, false);
  assert.match(t.cena().props.erroAvanco, /Sem conexão/); t.desmontar();
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }, { response: { status: 500 } }]) {
  test("fácil → médio: PATCH incerto não altera dificuldade nem reenvia automaticamente", async () => {
    const t = await entrarProgressao({ patch: (url) => { if (url === `/jogos-salvos/${A}`) throw erro; } });
    const clicar = t.cena().props.onAvancarDificuldade;
    await clicar(); t.render(); await clicar();
    assert.equal(t.avancos().length, 1);
    assert.equal(t.cena().props.dificuldade, "facil");
    assert.equal(t.cena().props.avancoIncerto, true);
    assert.match(t.cena().props.erroAvanco, /não será reenviada automaticamente/);
    assert.ok(t.storage.has("token")); t.desmontar();
  });
}

for (const resultado of [
  { status: 201, data: partidaMedia() }, { status: 200, data: partida() },
  { status: 200, data: partidaMedia({ _id: B }) }, { status: 200, data: partidaMedia({ perfilJogoId: B }) },
  { status: 200, data: partidaMedia({ tarefaId: TR }) }, { status: 200, data: partidaMedia({ comodoId: B }) },
  { status: 200, data: null },
]) test("fácil → médio: resposta inválida do PATCH mantém fácil e exige conferência", async () => {
  const t = await entrarProgressao({ patch: (url) => url === `/jogos-salvos/${A}` ? resultado : undefined });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.cena().props.avancoIncerto, true); t.desmontar();
});

test("fácil → médio: GET explícito confirma PATCH gravado com confirmação perdida, sem reenvio", async () => {
  const t = await entrarProgressao({ patch: (url, body, config, servidor) => {
    if (url === `/jogos-salvos/${A}`) {
      servidor.partida = partidaMedia(); throw new Error("resposta perdida");
    }
  } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  const consultas = t.chamadas.filter((c) => c.metodo === "GET").length;
  await t.cena().props.onConferirDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "medio");
  assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.avancos().length, 1); assert.equal(t.posts().length, 1);
  assert.equal(t.chamadas.filter((c) => c.metodo === "GET").length, consultas + 1);
  await t.avancar(10000);
  assert.equal(t.patches().filter((c) => c.url.endsWith("/heartbeat")).length, 1); t.desmontar();
});

test("fácil → médio: GET ainda fácil não libera novo PATCH potencialmente pendente", async () => {
  const t = await entrarProgressao({ patch: (url) => { if (url === `/jogos-salvos/${A}`) throw new Error("rede"); } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  await t.cena().props.onConferirDificuldade(); t.render();
  await t.cena().props.onAvancarDificuldade();
  assert.equal(t.cena().props.avancoIncerto, true);
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.avancos().length, 1); t.desmontar();
});

for (const tipo of ["sucesso", "401"]) test(`fácil → médio: troca de partida ignora PATCH tardio ${tipo}`, async () => {
  const d = diferida();
  const t = await entrarProgressao({ patch: (url) => url === `/jogos-salvos/${A}` ? d.promise : undefined });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir();
  const signal = t.avancos()[0].config.signal;
  t.selecionar(B); await t.concluir();
  if (tipo === "401") d.reject({ response: { status: 401 } }); else d.resolve({ status: 200, data: partidaMedia() });
  await envio; t.render();
  assert.equal(signal.aborted, true); assert.ok(t.storage.has("token"));
  await t.concluir();
  assert.equal(t.cena().props.jogoSalvoId, B);
  assert.equal(t.cena().props.dificuldade, "facil"); t.desmontar();
});

test("fácil → médio: sair durante PATCH cancela transição, sem aplicar resposta tardia", async () => {
  const d = diferida();
  const t = await entrarProgressao({ patch: (url) => url === `/jogos-salvos/${A}` ? d.promise : undefined });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir();
  await t.cena().props.onSairDoJogo(); t.render();
  d.resolve({ status: 200, data: partidaMedia() }); await envio; t.render();
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.timers.size, 0);
  assert.deepEqual(t.navegacoes, ["/jogos-salvos"]); t.desmontar();
});

test("fácil → médio: desmontagem ignora erro tardio e aborta a requisição", async () => {
  const d = diferida();
  const t = await entrarProgressao({ patch: (url) => url === `/jogos-salvos/${A}` ? d.promise : undefined });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir();
  const signal = t.avancos()[0].config.signal; t.desmontar();
  const escritas = t.escritas.length;
  d.reject({ response: { status: 401 } }); await envio;
  assert.equal(signal.aborted, true);
  assert.equal(t.escritas.length, escritas);
  assert.ok(t.storage.has("token")); assert.equal(t.timers.size, 0);
});

test("retomada no médio passa dificuldade persistida e oferece ação para difícil", async () => {
  const t = await entrarProgressao({ partida: partidaMedia() });
  assert.equal(t.cena().props.dificuldade, "medio");
  assert.equal(t.cena().props.sessaoId, S);
  assert.equal(typeof t.cena().props.onAvancarDificuldade, "function");
  assert.equal(t.avancos().length, 0); t.desmontar();
});

test("fácil → médio: falha do heartbeat cancela PATCH pendente e ignora sucesso tardio", async () => {
  const d = diferida();
  const t = await entrarProgressao({ patch: (url) => {
    if (url.endsWith("/heartbeat")) throw { response: { status: 409, data: { codigo: "SESSAO_EXPIRADA" } } };
    if (url === `/jogos-salvos/${A}`) return d.promise;
  } });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir();
  const signal = t.avancos()[0].config.signal;
  await t.avancar(10000);
  assert.equal(signal.aborted, true);
  d.resolve({ status: 200, data: partidaMedia() }); await envio; t.render();
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.ok(t.nos().some((n) => n.props.inert === true));
  assert.equal(t.timers.size, 0); t.desmontar();
});

test("fácil → médio: consulta obsoleta após troca de partida não inicia PATCH", async () => {
  const d = diferida();
  const t = await entrarProgressao({ get: (url) => url.startsWith("/tarefas/") ? d.promise : undefined });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir();
  t.selecionar(B); await t.concluir();
  d.resolve({ data: { _id: TC, comodoId: Q } }); await envio;
  assert.equal(t.avancos().length, 0);
  assert.equal(t.chamadas.some((c) => c.url.startsWith("/comodos/")), false);
  t.desmontar();
});

test("fácil → médio: conferência evita consultas simultâneas e trata 401 sem confirmar avanço", async () => {
  const d = diferida(); let conferir = false;
  const t = await entrarProgressao({
    get: (url) => conferir && url === `/jogos-salvos/${A}` ? d.promise : undefined,
    patch: (url) => { if (url === `/jogos-salvos/${A}`) throw new Error("rede"); },
  });
  await t.cena().props.onAvancarDificuldade(); t.render(); conferir = true;
  const clicar = t.cena().props.onConferirDificuldade;
  const a = clicar(), b = clicar(); t.render();
  assert.equal(t.chamadas.filter((c) => c.metodo === "GET" && c.url === `/jogos-salvos/${A}`).length, 2);
  d.reject({ response: { status: 401 } }); await Promise.all([a, b]); t.render();
  assert.equal(t.cena().props.dificuldade, "facil");
  assert.equal(t.storage.size, 0); assert.ok(t.navegacoes.includes("/"));
  assert.equal(t.avancos().length, 1); t.desmontar();
});

const progressoMedio = (id = A) => ({ ...progressoFacil(id),
  tarefas: progressoFacil(id).tarefas.map((tarefa) => ({ ...tarefa, dificuldade: "medio" })),
});
const partidaDificil = (extras = {}) => ({ ...partidaMedia(), dificuldade: "dificil", ...extras });
async function entrarMedio(opcoes = {}) {
  return entrarProgressao({ ...opcoes, partida: opcoes.partida ?? partidaMedia(),
    get: async (url, config, servidor) => {
      const especial = await opcoes.get?.(url, config, servidor);
      if (especial !== undefined) return especial;
      if (url.endsWith("/progresso")) return { status: 200, data: progressoMedio(url.split("/")[2]) };
    },
  });
}

test("médio → difícil: payload real, primeira tarefa ativa, 200 e mesma sessão com heartbeat", async () => {
  const t = await entrarMedio();
  const antes = t.cena(), timers = [...t.timers.keys()];
  await antes.props.onAvancarDificuldade(); t.render();
  assert.equal(t.avancos().length, 1);
  assert.deepEqual({ ...t.avancos()[0].body }, { dificuldade: "dificil", comodoId: Q, tarefaId: TC });
  assert.equal(t.cena().props.dificuldade, "dificil");
  assert.equal(t.cena().props.jogoSalvo.dificuldade, "dificil");
  assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.cena().props.perfilJogoId, P);
  assert.notEqual(t.cena().key, antes.key);
  assert.deepEqual([...t.timers.keys()], timers);
  assert.equal(t.cena().props.onAvancarDificuldade, undefined, "sem nível quatro");
  await antes.props.onAvancarDificuldade(); assert.equal(t.avancos().length, 1);
  await t.avancar(10000);
  assert.equal(t.patches().filter((c) => c.url.endsWith("/heartbeat")).length, 1);
  assert.equal(t.patches().find((c) => c.url.endsWith("/heartbeat")).body.sessaoId, S);
  assert.equal(t.posts().length, 1); t.desmontar();
});

test("fácil → médio → difícil funciona na mesma sessão e mantém callbacks antigos travados", async () => {
  const t = await entrarProgressao({ get: (url, config, servidor) => url.endsWith("/progresso")
    ? { data: servidor.partida.dificuldade === "facil" ? progressoFacil() : progressoMedio() } : undefined });
  const facil = t.cena().props.onAvancarDificuldade;
  await facil(); t.render();
  const medio = t.cena().props.onAvancarDificuldade;
  await facil(); assert.equal(t.avancos().length, 1);
  await medio(); t.render();
  assert.equal(t.cena().props.dificuldade, "dificil");
  assert.deepEqual(t.avancos().map((c) => c.body.dificuldade), ["medio", "dificil"]);
  await facil(); await medio(); assert.equal(t.avancos().length, 2);
  assert.equal(t.posts().length, 1); assert.equal(t.cena().props.sessaoId, S);
  t.desmontar();
});

test("erro no segundo avanço preserva a trava anterior e permite repetir só médio → difícil", async () => {
  let rejeitar = true;
  const t = await entrarProgressao({
    get: (url, config, servidor) => url.endsWith("/progresso")
      ? { data: servidor.partida.dificuldade === "facil" ? progressoFacil() : progressoMedio() } : undefined,
    patch: (url, body) => { if (url === `/jogos-salvos/${A}` && body.dificuldade === "dificil" && rejeitar) throw { response: { status: 403 } }; },
  });
  const antigo = t.cena().props.onAvancarDificuldade; await antigo(); t.render();
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "medio");
  await antigo(); assert.equal(t.avancos().length, 2, "não reenvia PATCH para médio por callback antigo");
  rejeitar = false; await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "dificil");
  assert.deepEqual(t.avancos().map((c) => c.body.dificuldade), ["medio", "dificil", "dificil"]); t.desmontar();
});

test("médio → difícil: ordem do catálogo define tarefa inicial, sem índice fixo", async () => {
  const t = await entrarMedio({ get: (url) => url.startsWith("/comodos/") ? { data: catalogo.map((tarefa) => ({
    ...tarefa, ordem: tarefa._id === TJ ? -1 : tarefa.ordem,
  })) } : undefined });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.avancos()[0].body.tarefaId, TJ);
  assert.equal(t.cena().props.dificuldade, "dificil"); t.desmontar();
});

for (const caso of ["incompleto", "somente fácil", "outra partida", "quarta tarefa ativa"]) {
  test(`médio → difícil: ${caso} impede PATCH`, async () => {
    const t = await entrarMedio({ get: (url) => {
      if (url.startsWith("/comodos/") && caso === "quarta tarefa ativa") return { data: [...catalogo, {
        _id: "6aac3c29bee9f041e4728a93", comodoId: Q, ordem: 4, ativo: true,
      }] };
      if (!url.endsWith("/progresso")) return;
      const data = caso === "somente fácil" ? progressoFacil() : progressoMedio();
      if (caso === "incompleto") data.tarefas[2].concluida = false;
      if (caso === "outra partida") data.jogoSalvoId = B;
      return { data };
    } });
    await t.cena().props.onAvancarDificuldade(); t.render();
    assert.equal(t.avancos().length, 0); assert.equal(t.cena().props.dificuldade, "medio");
    assert.ok(t.cena().props.erroAvanco); t.desmontar();
  });
}

test("médio → difícil: duplo clique e espera pelo 200 preservam cena e heartbeat", async () => {
  const d = diferida();
  const t = await entrarMedio({ patch: (url) => url === `/jogos-salvos/${A}` ? d.promise : undefined });
  const antes = t.cena(), clicar = antes.props.onAvancarDificuldade;
  const a = clicar(), b = clicar(); await t.concluir();
  assert.equal(t.avancos().length, 1);
  assert.equal(t.cena().props.dificuldade, "medio"); assert.equal(t.cena().key, antes.key);
  assert.equal(t.cena().props.avancandoDificuldade, true);
  await t.avancar(10000);
  assert.equal(t.patches().filter((c) => c.url.endsWith("/heartbeat")).length, 1);
  d.resolve({ status: 200, data: partidaDificil({ perfilJogoId: P }) }); await Promise.all([a, b]); t.render();
  assert.equal(t.cena().props.dificuldade, "dificil");
  assert.equal(t.cena().props.sessaoId, S); assert.equal(t.posts().length, 1); t.desmontar();
});

for (const status of [401, 403, 409]) test(`médio → difícil: HTTP ${status} não altera a dificuldade`, async () => {
  const t = await entrarMedio({ patch: (url) => { if (url === `/jogos-salvos/${A}`) throw { response: { status } }; } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "medio");
  if (status === 401) { assert.equal(t.storage.size, 0); assert.ok(t.navegacoes.includes("/")); }
  else { assert.ok(t.storage.has("token")); assert.equal(t.cena().props.avancoIncerto, false); }
  t.desmontar();
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }, { response: { status: 500 } }]) {
  test("médio → difícil: resultado incerto mantém médio e não repete o PATCH", async () => {
    const t = await entrarMedio({ patch: (url) => { if (url === `/jogos-salvos/${A}`) throw erro; } });
    const clicar = t.cena().props.onAvancarDificuldade;
    await clicar(); t.render(); await clicar();
    assert.equal(t.avancos().length, 1); assert.equal(t.cena().props.dificuldade, "medio");
    assert.equal(t.cena().props.avancoIncerto, true);
    assert.match(t.cena().props.erroAvanco, /no difícil/); t.desmontar();
  });
}

for (const resultado of [
  { status: 201, data: partidaDificil() }, { status: 200, data: partidaMedia() },
  { status: 200, data: partidaDificil({ _id: B }) }, { status: 200, data: partidaDificil({ perfilJogoId: B }) },
  { status: 200, data: partidaDificil({ tarefaId: TR }) }, { status: 200, data: null },
]) test("médio → difícil: resposta inválida do PATCH não confirma avanço", async () => {
  const t = await entrarMedio({ patch: (url) => url === `/jogos-salvos/${A}` ? resultado : undefined });
  await t.cena().props.onAvancarDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "medio"); assert.equal(t.cena().props.avancoIncerto, true);
  t.desmontar();
});

test("médio → difícil: consulta explícita confirma gravação com resposta perdida, sem repetir PATCH", async () => {
  const t = await entrarMedio({ patch: (url, body, config, servidor) => {
    if (url === `/jogos-salvos/${A}`) { servidor.partida = partidaDificil(); throw new Error("resposta perdida"); }
  } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  await t.cena().props.onConferirDificuldade(); t.render();
  assert.equal(t.cena().props.dificuldade, "dificil");
  assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.avancos().length, 1); assert.equal(t.posts().length, 1); t.desmontar();
});

test("médio → difícil: conferência ainda no médio não libera reenvio incerto", async () => {
  const t = await entrarMedio({ patch: (url) => { if (url === `/jogos-salvos/${A}`) throw new Error("rede"); } });
  await t.cena().props.onAvancarDificuldade(); t.render();
  await t.cena().props.onConferirDificuldade(); t.render();
  await t.cena().props.onAvancarDificuldade();
  assert.equal(t.avancos().length, 1); assert.equal(t.cena().props.avancoIncerto, true);
  assert.equal(t.cena().props.dificuldade, "medio"); t.desmontar();
});

for (const tipo of ["200", "401"]) test(`médio → difícil: troca de partida ignora resposta tardia ${tipo}`, async () => {
  const d = diferida();
  const t = await entrarMedio({ patch: (url) => url === `/jogos-salvos/${A}` ? d.promise : undefined });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir();
  const signal = t.avancos()[0].config.signal;
  t.selecionar(B); await t.concluir();
  if (tipo === "401") d.reject({ response: { status: 401 } }); else d.resolve({ status: 200, data: partidaDificil() });
  await envio; t.render();
  assert.equal(signal.aborted, true); assert.ok(t.storage.has("token"));
  await t.concluir();
  assert.equal(t.cena().props.jogoSalvoId, B); assert.equal(t.cena().props.dificuldade, "medio");
  t.desmontar();
});

test("médio → difícil: falha do heartbeat aborta avanço pendente sem aplicar 200 tardio", async () => {
  const d = diferida();
  const t = await entrarMedio({ patch: (url) => {
    if (url.endsWith("/heartbeat")) throw { response: { status: 409 } };
    if (url === `/jogos-salvos/${A}`) return d.promise;
  } });
  const envio = t.cena().props.onAvancarDificuldade(); await t.concluir(); await t.avancar(10000);
  d.resolve({ status: 200, data: partidaDificil() }); await envio; t.render();
  assert.equal(t.cena().props.dificuldade, "medio");
  assert.ok(t.nos().some((n) => n.props.inert === true));
  assert.equal(t.timers.size, 0); t.desmontar();
});

test("retomada no difícil mantém dificuldade persistida e não oferece nível quatro", async () => {
  const t = await entrarProgressao({ partida: partidaDificil() });
  assert.equal(t.cena().props.dificuldade, "dificil"); assert.equal(t.cena().props.sessaoId, S);
  assert.equal(t.cena().props.onAvancarDificuldade, undefined);
  assert.equal(t.avancos().length, 0); t.desmontar();
});


test("avatar: personagem validado permanece disponível quando PATCH da dificuldade retorna só o ID",async()=>{
  const personagem={_id:P,nomeAvatar:"Luna",imagemAvatar:"/images/menina1.png"};
  const t=await entrarProgressao({partida:partida(A,personagem),patch:async(url)=>url===`/jogos-salvos/${A}`?{status:200,data:partidaMedia({perfilJogoId:P})}:undefined});
  assert.equal(t.cena().props.personagem.imagemAvatar,personagem.imagemAvatar);
  const sessao=t.cena().props.sessaoId;
  await t.cena().props.onAvancarDificuldade();t.render();
  assert.equal(t.cena().props.personagem.imagemAvatar,personagem.imagemAvatar);
  assert.equal(t.cena().props.sessaoId,sessao);assert.equal(t.cena().props.dificuldade,"medio");t.desmontar();
});
