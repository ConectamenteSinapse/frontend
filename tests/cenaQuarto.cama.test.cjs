const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("next/dist/compiled/babel/core");

// JSX real com hooks, API e relógio controlados. Não é navegador nem MongoDB.
const comodoId = "6aac3a3ea0d0e3c33530c5d2";
const tarefaId = "6aac3c29bee9f041e4728a8f";
const corretaId = "6aac3dc5463fb5f785522ad6";
const tarefa = { _id: tarefaId, comodoId, audioEnunciado: "/audios/quarto/tarefa/o-que-devemos-fazer-com-a-cama.mp3", enunciado: "Enunciado recebido da API" };
// A correta vem primeiro para detectar qualquer dependência da segunda posição.
const respostas = [corretaId, "6aac3dc5463fb5f785522ad7", "6aac3dc5463fb5f785522ad8", "6aac3dc5463fb5f785522ad9"].map((id, i) => ({
  _id: id, tarefaId, texto: `Alternativa API ${i}`,
  imagem: `/imagem-api-${i}.png`, audio: `/audios/quarto/resposta/${["arrumar-a-cama", "voltar-a-dormir", "deitar-na-cama", "usar-o-celular"][i]}.mp3`, ordem: i + 1,
}));
const tarefaCortinaId = "6aac3c29bee9f041e4728a90";
const tarefaCortina = { _id: tarefaCortinaId, comodoId, audioEnunciado: "/audios/quarto/tarefa/o-que-devemos-fazer-com-a-cortina.mp3", enunciado: "Enunciado da cortina recebido da API" };
const respostasCortina = ["6aac3dc5463fb5f785522ad9", "6aac3dc5463fb5f785522ada", "6aac3dc5463fb5f785522adb", "6aac3dc5463fb5f785522adc"].map((_id, i) => ({
  _id, tarefaId: tarefaCortinaId, texto: `Cortina API ${i + 1}`, ordem: i + 1,
  imagem: `/images/quarto/respostas/cortina-${i + 1}.png`, audio: `/audios/quarto/resposta/${["deixar-a-cortina-fechada", "puxar-a-cortina", "abrir-a-cortina", "usar-o-controle"][i]}.mp3`,
}));
// Gabarito somente do servidor simulado; a terceira alternativa detecta índices fixos.
const corretaCortinaId = respostasCortina[2]._id;
const tarefaRoupaId = "6aac3c29bee9f041e4728a91";
const tarefaRoupa = { _id: tarefaRoupaId, comodoId, audioEnunciado: "/audios/quarto/tarefa/o-que-devemos-fazer-com-a-roupa-ao-acordar.mp3", enunciado: "Enunciado da roupa recebido da API" };
const respostasRoupa = ["6aac3dc5463fb5f785522add", "6aac3dc5463fb5f785522ade", "6aac3dc5463fb5f785522adf", "6aac3dc5463fb5f785522ae0"].map((_id, i) => ({
  _id, tarefaId: tarefaRoupaId,
  texto: ["Ficar na cama", "Continuar com a mesma roupa", "Trocar de roupa", "Colocar camiseta"][i],
  ordem: i + 1, imagem: `/images/quarto/respostas/roupa-${i + 1}.png`, audio: `/audios/quarto/resposta/${["ficar-na-cama", "continuar-com-a-mesma-roupa", "trocar-de-roupa", "colocar-camiseta"][i]}.mp3`,
}));
const corretaRoupaId = respostasRoupa[2]._id; // Exclusivo do servidor simulado.
const arquivo = path.resolve(__dirname, "../src/components/jogo/CenaQuarto.js");
const { code } = babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
  filename: arquivo, babelrc: false, configFile: false,
  presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
  plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
});
function RespostaCard() {}
function Link() {}
function diferida() {
  let resolve, reject;
  const promise = new Promise((ok, falha) => { resolve = ok; reject = falha; });
  return { promise, resolve, reject };
}

// O servidor simulado possui um total próprio; a cena nunca calcula essa soma.
function indicadorEstrelas(tela) {
  return tela.texto(tela.nos().find((n) => n.props.className === "estrelasAcumuladas")).replace(/\s+/g, " ");
}
const partidaId = "6aac3c29bee9f041e4728a81";
const perfilId = "6aac3c29bee9f041e4728a82";
const sessaoId = "d852415e-23c4-4703-9ae0-681789481d74";
function montar(responder = (url) => ({ data: url.includes(tarefaRoupaId)
  ? url.endsWith("/respostas") ? respostasRoupa : tarefaRoupa
  : url.includes(tarefaCortinaId)
  ? url.endsWith("/respostas") ? respostasCortina : tarefaCortina
  : url.endsWith("/respostas") ? respostas : tarefa }), token = "sessao-simulada", opcoes = {}) {
  const estados = [], refs = [], callbacks = [], efeitos = [], pendentes = [], chamadas = [], envios = [], sons = [], players = [], timers = new Map(), eventos = new Map();
  const armazenamento = new Map(token === null ? [] : [["token", token], ["usuario", "usuario-simulado"]]);
  const localStorage = { getItem: (k) => armazenamento.get(k) ?? null, removeItem: (k) => armazenamento.delete(k) };
  const pendencias = opcoes.pendencias ?? new Map();
  const sessionStorage = { getItem: (k) => pendencias.get(k) ?? null, setItem: (k, v) => pendencias.set(k, v), removeItem: (k) => pendencias.delete(k) };
  let indiceEstado, indiceRef, indiceCallback, indiceEfeito, arvore, timerId = 0;
  const concluidasServidor = new Set(opcoes.concluidasIniciais ?? []);
  let estrelasServidor = opcoes.estrelasIniciais ?? 0;
  let props = { perfilJogoId: perfilId, jogoSalvoId: partidaId, sessaoId, dificuldade: "facil", ...opcoes.props };
  const contexto = {
    exports: {}, localStorage, sessionStorage, AbortController,
    window: { addEventListener: (k, fn) => eventos.set(k, fn), removeEventListener: (k, fn) => { if (eventos.get(k) === fn) eventos.delete(k); } },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    Audio: function (url) {
      if (opcoes.audioConstrutorFalha) throw new Error("Audio indispon?vel");
      sons.push(url); players.push(this); this.url = url; this.pausas = 0; this.liberado = false;
      this.pause = () => { this.pausas++; };
      this.removeAttribute = (atributo) => { assert.equal(atributo, "src"); this.liberado = true; };
      this.load = () => {};
      this.play = () => opcoes.audioPlay ? opcoes.audioPlay() : Promise.resolve();
    },
    alert: () => {}, console: { log: () => {}, error: () => {} },
    require(id) {
      if (id === "react") return {
        useState(initial) { const i = indiceEstado++; if (!(i in estados)) estados[i] = initial; return [estados[i], (v) => { estados[i] = typeof v === "function" ? v(estados[i]) : v; }]; },
        useRef(initial) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: initial }); },
        useCallback(fn, deps) { const i = indiceCallback++; const anterior = callbacks[i]; if (!anterior || deps.some((v, j) => !Object.is(v, anterior.deps[j]))) callbacks[i] = { fn, deps }; return callbacks[i].fn; },
        useEffect(fn, deps) { const i = indiceEfeito++; const anterior = efeitos[i]; if (!anterior || deps.some((v, j) => !Object.is(v, anterior.deps[j]))) pendentes.push(() => { anterior?.cleanup?.(); efeitos[i] = { deps, cleanup: fn() }; }); },
      };
      if (id === "react/jsx-runtime") return require(id);
      if (id === "lucide-react") return new Proxy({}, { get: () => function Icone() {} });
      if (id === "next/link") return { __esModule: true, default: Link };
      if (id === "./RespostaCard") return { __esModule: true, default: RespostaCard };
      if (id.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
      if (id === "../../services/api") return { __esModule: true, default: {
        get: async (url, config) => {
          chamadas.push({ url, config });
          if (opcoes.api) return opcoes.api.get(url, config);
          if (url.endsWith("/progresso")) return opcoes.progresso ? opcoes.progresso(url, config) : { data: {
            jogoSalvoId: props.jogoSalvoId, estrelasTotal: estrelasServidor, tarefas: [...concluidasServidor].map((tarefaId) => ({ tarefaId, dificuldade: props.dificuldade, concluida: true })),
          } };
          if (url === `/comodos/${comodoId}/tarefas`) return opcoes.consultarCatalogo ? opcoes.consultarCatalogo(url, config) : { data: opcoes.catalogo ?? [tarefaId, tarefaCortinaId, tarefaRoupaId].map((_id, i) => ({ _id, comodoId, ativo: true, ordem: i + 1 })) };
          return responder(url, config, chamadas.length);
        },
        post: async (url, body, config) => {
          envios.push({ url, body, config });
          const gabaritoSimulado = body.tarefaId === tarefaRoupaId ? corretaRoupaId : body.tarefaId === tarefaCortinaId ? corretaCortinaId : corretaId;
          const resultado = opcoes.api ? await opcoes.api.post(url, body, config) : opcoes.post ? await opcoes.post(url, body, config) : {
            status: 201, data: { acertou: body.respostaEscolhidaId === gabaritoSimulado, tentativa: envios.length, pontuacaoGanha: body.respostaEscolhidaId === gabaritoSimulado ? { facil: 1, medio: 2, dificil: 3 }[body.dificuldade] : 0, dificuldade: body.dificuldade },
          };
          if (resultado.status === 201 && resultado.data?.acertou === true) {
            concluidasServidor.add(body.tarefaId);
            if (Number.isFinite(resultado.data.pontuacaoGanha) && resultado.data.pontuacaoGanha >= 0) estrelasServidor += resultado.data.pontuacaoGanha;
          }
          return resultado;
        },
      } };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(code, contexto, { filename: arquivo });
  function nos(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  function texto(n) { if (arguments.length === 0) n = arvore; if (Array.isArray(n)) return n.map(texto).join(" "); return n?.props ? texto(n.props.children) : typeof n === "string" || typeof n === "number" ? String(n) : ""; }
  const tela = {
    chamadas, envios, sons, players, timers, armazenamento, pendencias,
    render() { indiceEstado = 0; indiceRef = 0; indiceCallback = 0; indiceEfeito = 0; arvore = contexto.exports.default(props); while (pendentes.length) pendentes.shift()(); return tela; },
    trocarProps(novas) { props = { ...props, ...novas }; return tela.render(); },
    nos, texto,
    cards() { return nos().filter((n) => n.type === RespostaCard); },
    abrir() { nos().find((n) => n.type === "img" && n.props.alt === "Cama").props.onClick(); tela.render(); return tela; },
    abrirCortina() { nos().find((n) => n.type === "img" && n.props.alt === "Janela").props.onClick(); tela.render(); return tela; },
    abrirRoupa() { nos().find((n) => n.type === "img" && n.props.alt === "Guarda Roupa").props.onClick(); tela.render(); return tela; },
    fechar() { nos().find((n) => n.type === "button" && n.props.className === "botaoFecharModalImg").props.onClick(); tela.render(); return tela; },
    async concluir() { await new Promise(setImmediate); tela.render(); return tela; },
    teclado(key) { eventos.get("keydown")({ key }); tela.render(); },
    personagem() { return nos().find((n) => n.props.className?.startsWith("personagemMovivel")).props.style.left; },
    avancar(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.fn(); } tela.render(); },
    desmontar() { efeitos.forEach((e) => e.cleanup?.()); },
  };
  return tela.render();
}

test("estrelas: carrega total persistido sem confundir com tarefas ou enviar POST", async () => {
  const t = montar(undefined, undefined, { estrelasIniciais: 17 });
  assert.match(indicadorEstrelas(t), /Carregando/);
  await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 17$/);
  assert.match(t.texto(), /Tarefas\s+0\s*\/3/);
  assert.equal(t.envios.length, 0);
  assert.equal(t.chamadas.length, 1, "reaproveita consulta inicial de progresso");
  t.desmontar();
});

test("estrelas: zero é exibido somente quando confirmado pela API", async () => {
  const t = montar(); await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 0$/);
  t.desmontar();
});

test("estrelas: consulta inicial falha sem inventar total zero", async () => {
  const t = montar(undefined, undefined, { progresso: async () => { throw new Error("rede"); } });
  await t.concluir();
  assert.match(indicadorEstrelas(t), /Indisponível/);
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

test("estrelas: clique duplo gera um POST e uma atualização do total", async () => {
  const resultado = diferida();
  const t = montar(undefined, undefined, { estrelasIniciais: 3, post: async () => resultado.promise });
  t.abrir(); await t.concluir();
  const selecionar = t.cards()[0].props.onSelecionar;
  const envio = selecionar(); await t.concluir();
  await selecionar();
  assert.equal(t.envios.length, 1);
  assert.match(indicadorEstrelas(t), /Carregando/);
  resultado.resolve(retorno(true)); await envio; await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 4$/);
  assert.equal(t.chamadas.filter((c) => c.url.endsWith("/progresso")).length, 4);
  t.desmontar();
});

for (const total of [undefined, null, "5", -1, NaN, Infinity]) test(`estrelas: total inválido ${String(total)} não vira zero`, async () => {
  const t = montar(undefined, undefined, { progresso: async () => ({ data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: total } }) });
  await t.concluir();
  assert.match(indicadorEstrelas(t), /Indisponível/);
  t.desmontar();
});

for (const [dificuldade, pontos] of [["facil", 1], ["medio", 2], ["dificil", 3]]) test(`estrelas: acerto ${dificuldade} consulta total persistido com +${pontos}`, async () => {
  const t = montar(undefined, undefined, { estrelasIniciais: 9, props: { dificuldade } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${9 + pontos}$`));
  t.avancar(1500);
  t.abrir(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${9 + pontos}$`));
  t.desmontar();
});

test("estrelas: erro não aumenta total e as três tarefas atualizam pela API", async () => {
  const t = montar(undefined, undefined, { estrelasIniciais: 7 });
  t.abrir(); await t.concluir();
  await t.cards()[1].props.onSelecionar(); await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 7$/);
  assert.match(t.texto(), /Quase lá! Tente novamente!/);
  await t.cards()[0].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.match(indicadorEstrelas(t), /Estrelas: 8$/);
  t.abrirCortina(); await t.concluir();
  await t.cards()[2].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.match(indicadorEstrelas(t), /Estrelas: 9$/);
  t.abrirRoupa(); await t.concluir();
  await t.cards()[2].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.match(indicadorEstrelas(t), /Estrelas: 10$/);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.equal(t.envios.length, 4);
  t.desmontar();
});

test("estrelas: usa total retornado e não soma pontuacaoGanha localmente", async () => {
  let total = 20;
  const t = montar(undefined, undefined, {
    progresso: async () => ({ data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: total } }),
    post: async () => { total = 87; return retorno(true); },
  });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 87$/);
  t.desmontar();
});

test("estrelas: restaurar e reabrir partida preserva total sem POST ou áudio de conquista", async () => {
  for (let reabertura = 0; reabertura < 2; reabertura++) {
    const t = montar(undefined, undefined, { progresso: async () => ({ data: { ...progressoComRoupa(true).data, estrelasTotal: 12 } }) });
    await t.concluir();
    assert.match(indicadorEstrelas(t), /Estrelas: 12$/);
    assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
    assert.equal(t.envios.length, 0);
    assert.equal(t.sons.length, 0);
    t.desmontar();
  }
});

test("estrelas: dificuldade preserva total e troca de partida não reaproveita pontuação", async () => {
  let total = 6;
  const t = montar(undefined, undefined, { progresso: async (url) => ({ data: { jogoSalvoId: url.split('/')[2], estrelasTotal: total, tarefas: [] } }) });
  await t.concluir();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 6$/);
  total = 2;
  t.trocarProps({ jogoSalvoId: "6aac3c29bee9f041e4728a88" });
  assert.match(indicadorEstrelas(t), /Carregando/);
  await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 2$/);
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

for (const erro of [new Error("rede"), { response: { status: 401 } }, { response: { status: 403 } }, { code: "ECONNABORTED" }]) test(`estrelas: falha ${erro.response?.status ?? erro.code ?? "rede"} na atualização não desfaz acerto`, async () => {
  let concluida = false;
  const t = montar(undefined, undefined, {
    progresso: async () => { if (concluida) throw erro; return { data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 5 } }; },
    post: async () => { concluida = true; return retorno(true); },
  });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.match(indicadorEstrelas(t), /Indisponível/);
  assert.match(t.texto(), /Muito bem! Você acertou/);
  t.avancar(1500);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(t.envios.length, 1);
  t.desmontar();
});

test("estrelas: POST incerto não soma nem reenvia automaticamente", async () => {
  const t = montar(undefined, undefined, { estrelasIniciais: 4, post: async () => { throw new Error("rede"); } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.match(indicadorEstrelas(t), /Indisponível/);
  assert.equal(t.envios.length, 1);
  assert.equal(t.chamadas.filter((c) => c.url.endsWith("/progresso")).length, 3);
  t.desmontar();
});

for (const desfecho of ["troca", "desmontagem", "401 tardio"]) test(`estrelas: atualização obsoleta após ${desfecho} é ignorada e abortada`, async () => {
  const antiga = diferida(); let leituras = 0;
  const t = montar(undefined, undefined, { progresso: async (url) => {
    if (++leituras === 4) return antiga.promise;
    return { data: { jogoSalvoId: url.split('/')[2], tarefas: [], estrelasTotal: leituras > 4 ? 2 : 8 } };
  } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.render();
  const signal = t.chamadas.at(-1).config.signal;
  if (desfecho === "desmontagem") t.desmontar();
  else { t.trocarProps({ jogoSalvoId: "6aac3c29bee9f041e4728a88" }); await t.concluir(); }
  assert.equal(signal.aborted, true);
  if (desfecho === "401 tardio") antiga.reject({ response: { status: 401 } });
  else antiga.resolve({ data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 999 } });
  await t.concluir();
  assert.doesNotMatch(indicadorEstrelas(t), /999/);
  assert.ok(t.armazenamento.has("token"));
  if (desfecho !== "desmontagem") { assert.match(indicadorEstrelas(t), /Estrelas: 2$/); t.desmontar(); }
});

test("estrelas: fechar modal após 201 não cancela consulta do total da partida", async () => {
  const total = diferida(); let leituras = 0;
  const t = montar(undefined, undefined, { progresso: async () => ++leituras === 4 ? total.promise : { data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 0 } } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.render();
  const signal = t.chamadas.at(-1).config.signal;
  t.fechar();
  assert.equal(signal.aborted, false);
  total.resolve({ data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 1 } }); await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 1$/);
  assert.equal(t.envios.length, 1);
  t.desmontar();
});

test("estrelas: consulta inicial tardia não sobrescreve acerto confirmado", async () => {
  const inicial = diferida(); let leituras = 0;
  const t = montar(undefined, undefined, { progresso: async () => ++leituras === 1 ? inicial.promise : { data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: leituras >= 4 ? 1 : 0 } } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(leituras, 3, "aguarda leitura inicial em vez de duplicar consulta de estrelas");
  inicial.resolve({ data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 0 } }); await t.concluir();
  assert.equal(leituras, 4);
  assert.match(indicadorEstrelas(t), /Estrelas: 1$/);
  t.desmontar();
});

test("estrelas: atualizações consecutivas são serializadas e leitura antiga não substitui a nova", async () => {
  const antiga = diferida(); let leituras = 0;
  const t = montar(undefined, undefined, { progresso: async () => {
    if (++leituras === 4) return antiga.promise;
    return { data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: leituras > 4 ? 8 : 6 } };
  } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.avancar(1500);
  t.abrirCortina(); await t.concluir();
  await t.cards()[2].props.onSelecionar(); t.render();
  assert.equal(leituras, 6, "apenas progresso do modal e pré-envio enquanto total está pendente");
  antiga.resolve({ data: { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 7 } }); await t.concluir();
  assert.equal(leituras, 7, "uma atualização pendente, sem concorrência entre consultas do indicador");
  assert.match(indicadorEstrelas(t), /Estrelas: 8$/);
  assert.equal(t.envios.length, 2);
  t.desmontar();
});

async function prepararPraticaCama(opcoes = {}) {
  const t = montar(undefined, undefined, {
    estrelasIniciais: 18, concluidasIniciais: [tarefaId, tarefaCortinaId, tarefaRoupaId], ...opcoes,
  });
  await t.concluir();
  const botao = t.nos().find((n) => n.props.className === "botaoCardTentarDeNovo");
  assert.ok(botao, "cartão oferece prática explícita");
  assert.match(t.texto(botao), /Praticar novamente/);
  await botao.props.onClick(); t.render();
  return t;
}

function fecharOrientacao(t) {
  const dialogo = t.nos().find(n => n.type === "dialog");
  assert.ok(dialogo);
  t.nos(dialogo).find(n => n.type === "button").props.onClick(); t.render();
}
async function verificarSomentePrimeira(t, primeira = "abrir") {
  for (const abrir of ["abrir", "abrirCortina", "abrirRoupa"]) {
    t[abrir](); await t.concluir();
    if (abrir === primeira) { assert.equal(t.cards().length, 4); t.fechar(); }
    else { assert.equal(t.cards().length, 0); fecharOrientacao(t); }
  }
}

async function novaRodada(t) {
  const ver = t.nos().find(n => n.type === "button" && /Ver conclusão do nível/.test(t.texto(n)));
  if (ver) { ver.props.onClick(); t.render(); }
  await t.nos().find(n => n.props.className === "botaoCardTentarDeNovo").props.onClick();
  t.render();
}
async function prepararPraticaTarefa(id, opcoes = {}) {
  // Catálogo controlado com a tarefa sob teste primeiro: as guardas continuam ativas.
  const ids = [id, ...[tarefaId, tarefaCortinaId, tarefaRoupaId].filter(outro => outro !== id)];
  return prepararPraticaCama({ ...opcoes, catalogo: ids.map((_id, i) => ({ _id, comodoId, ativo: true, ordem: i + 1 })) });
}

test("prática cama: ação explícita fecha cartão sem POST, zerar objetos ou contador", async () => {
  const t = await prepararPraticaCama();
  assert.equal(t.envios.length, 0);
  assert.equal(t.cards().length, 0);
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(t.nos().find((n) => n.props.alt === "Janela").props.src, "/images/quarto/janelaAberta.png");
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
  const posicao = t.personagem(); t.teclado("d"); assert.notEqual(t.personagem(), posicao);
  t.abrir(); await t.concluir();
  assert.equal(t.cards().length, 4);
  assert.equal(t.envios.length, 0, "abrir pergunta também não envia tentativa");
  t.desmontar();
});

for (const alvo of [
  { nome: "cama", abrir: "abrir", correta: 0 },
  { nome: "cortina", abrir: "abrirCortina", correta: 2 },
  { nome: "roupa", abrir: "abrirRoupa", correta: 2 },
]) test(`cartão difícil: fechar prática da ${alvo.nome} durante animação não trava Praticar novamente`, async () => {
  const t = await prepararPraticaTarefa({ cama: tarefaId, cortina: tarefaCortinaId, roupa: tarefaRoupaId }[alvo.nome], { props: { dificuldade: "dificil" } });
  t[alvo.abrir](); await t.concluir();
  await t.cards()[alvo.correta].props.onSelecionar(); await t.concluir();
  assert.match(indicadorEstrelas(t), /Estrelas: 21$/);
  t.fechar();
  t.nos().find((n) => n.type === "button" && /Ver conclusão do nível/.test(t.texto(n))).props.onClick(); t.render();
  let praticar = t.nos().find((n) => n.props.className === "botaoCardTentarDeNovo");
  assert.equal(praticar.props.disabled, false, "o clique chega ao handler");
  await praticar.props.onClick(); t.render();
  assert.ok(t.nos().some((n) => n.props.className === "modalOverlayFim"), "trava de animação permanece durante 1,5 s");
  t.avancar(1500);
  praticar = t.nos().find((n) => n.props.className === "botaoCardTentarDeNovo");
  await praticar.props.onClick(); t.render();
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false, "após animação, handler deve fechar o cartão");
  const consultas = t.chamadas.length;
  for (let render = 0; render < 3; render++) await t.concluir();
  t.avancar(1000);
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false, "progresso completo não reabre cartão");
  assert.equal(t.chamadas.length, consultas, "fechar cartão não repete consulta de restauração");
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.match(indicadorEstrelas(t), /Estrelas: 21$/);
  assert.equal(t.envios.length, 1, "botão não envia nova tentativa");
  await verificarSomentePrimeira(t, alvo.abrir);
  assert.equal(t.envios.length, 1);
  t.nos().find((n) => n.type === "button" && /Ver conclusão do nível/.test(t.texto(n))).props.onClick(); t.render();
  assert.ok(t.nos().some((n) => n.props.className === "modalOverlayFim"));
  t.desmontar();
});

test("cartão difícil: retomar partida concluída permite fechar e reabrir cartão sem POST ou alteração de estrelas", async () => {
  for (let retomada = 0; retomada < 2; retomada++) {
    const t = await prepararPraticaCama({ props: { dificuldade: "dificil" } });
    assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
    await t.concluir(); t.avancar(1000); t.avancar(1500);
    assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
    await verificarSomentePrimeira(t);
    t.nos().find((n) => n.type === "button" && /Ver conclusão do nível/.test(t.texto(n))).props.onClick(); t.render();
    assert.ok(t.nos().some((n) => n.props.className === "modalOverlayFim"));
    await t.nos().find((n) => n.props.className === "botaoCardTentarDeNovo").props.onClick(); t.render();
    assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
    assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
    assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
    assert.equal(t.envios.length, 0);
    t.desmontar();
  }
});

for (const [dificuldade, pontos] of [["facil", 1], ["medio", 2], ["dificil", 3]]) test(`prática cama ${dificuldade}: novo acerto acrescenta ${pontos}, sem nova conquista ou cartão`, async () => {
  const t = await prepararPraticaCama({ props: { dificuldade } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.deepEqual({ ...t.envios[0].body }, { perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId, respostaEscolhidaId: corretaId, dificuldade, sessaoId });
  assert.match(t.texto(), /Muito bem! Você acertou/);
  assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${18 + pontos}$`));
  t.avancar(1500); t.avancar(1000);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(t.pendencias.size, 0);
  await novaRodada(t);
  t.abrir(); await t.concluir();
  assert.equal(t.envios.length, 1, "nova rodada abre prática sem POST automático");
  await t.cards()[0].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.equal(t.envios.length, 2);
  assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${18 + 2 * pontos}$`));
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  t.desmontar();
});

test("prática cama: erro registra tentativa sem estrelas e preserva conclusão", async () => {
  const t = await prepararPraticaCama(); t.abrir(); await t.concluir();
  await t.cards()[1].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.match(t.texto(), /Quase lá! Tente novamente!/);
  assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
  await t.cards()[0].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.equal(t.envios.length, 2);
  assert.match(indicadorEstrelas(t), /Estrelas: 19$/);
  t.desmontar();
});

test("prática cama: cartão só volta por ação explícita e mantém callback de avanço", async () => {
  let avancos = 0;
  const t = await prepararPraticaCama({ props: { onAvancarDificuldade: () => { avancos++; } } });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
  t.nos().find((n) => n.type === "button" && /Ver conclusão do nível/.test(t.texto(n))).props.onClick(); t.render();
  assert.ok(t.nos().find((n) => n.props.className === "modalOverlayFim"));
  t.nos().find((n) => n.props.className === "botaoCardContinuar").props.onClick();
  assert.equal(avancos, 1);
  assert.equal(t.envios.length, 1);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  t.desmontar();
});

for (const status of [401, 403, 409]) test(`prática cama: HTTP ${status} não concede estrelas ou remove conclusão`, async () => {
  const t = await prepararPraticaCama({ post: async () => { throw { response: { status } }; } });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.equal(t.pendencias.size, 0);
  assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  if (status === 401) assert.equal(t.armazenamento.has("token"), false);
  else assert.ok(t.armazenamento.has("token"));
  t.desmontar();
});

test("prática cama: resposta 201 inválida permanece incerta, sem usar progresso antigo como sucesso", async () => {
  const t = await prepararPraticaCama({ post: async () => ({ status: 201, data: { acertou: true } }) });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.match(t.texto(), /Não foi possível confirmar esta prática/);
  assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
  assert.equal(t.pendencias.size, 1);
  t.fechar(); t.abrir(); await t.concluir();
  assert.equal(t.cards().length, 0);
  assert.equal(t.envios.length, 1);
  t.desmontar();
});

test("prática cama: incerteza surgida após carregar alternativas também impede POST", async () => {
  const t = await prepararPraticaCama(); t.abrir(); await t.concluir();
  t.pendencias.set(`conectamente:resposta-pendente:${partidaId}:${tarefaId}:facil:pratica`, "pendente");
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 0);
  assert.match(t.texto(), /resposta anterior não foi confirmada/);
  assert.equal(t.pendencias.size, 1);
  t.desmontar();
});

for (const props of [{ jogoSalvoId: "6aac3c29bee9f041e4728a88" }, { dificuldade: "medio" }]) test("prática cama: troca de contexto aborta POST e ignora confirmação tardia", async () => {
  const resultado = diferida();
  const t = await prepararPraticaCama({ post: async () => resultado.promise });
  t.abrir(); await t.concluir();
  const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  t.trocarProps(props); await t.concluir();
  assert.equal(t.envios[0].config.signal.aborted, true);
  resultado.resolve(retorno(true)); await envio; await t.concluir();
  assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
  assert.equal(t.envios.length, 1);
  assert.equal(t.pendencias.size, 1);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  t.desmontar();
});

test("prática cama: clique duplo e callbacks antigos não duplicam POST, incluindo animação", async () => {
  const resultado = diferida();
  const t = await prepararPraticaCama({ post: async () => resultado.promise });
  t.abrir(); await t.concluir();
  const selecionar = t.cards()[0].props.onSelecionar;
  const primeiro = selecionar(); await selecionar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  resultado.resolve(retorno(true)); await primeiro; await t.concluir();
  await selecionar(); assert.equal(t.envios.length, 1);
  t.fechar(); t.abrir(); await t.concluir();
  assert.equal(t.cards().length, 0, "fechar modal não libera prática durante animação");
  t.avancar(1500); fecharOrientacao(t); await novaRodada(t); t.abrir(); await t.concluir();
  assert.equal(t.cards().length, 4);
  await selecionar(); assert.equal(t.envios.length, 1, "callback de modal anterior permanece inválido");
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 2);
  t.desmontar();
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }, { response: { status: 500 } }]) test(`prática cama: envio incerto ${erro.code ?? erro.response?.status ?? "rede"} não é confirmado pela conclusão antiga`, async () => {
  const pendencias = new Map();
  const opcoes = { pendencias, post: async () => { throw erro; } };
  const t = await prepararPraticaCama(opcoes); t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.match(t.texto(), /Não foi possível confirmar esta prática/);
  assert.match(indicadorEstrelas(t), /Indisponível/);
  assert.equal(pendencias.get(`conectamente:resposta-pendente:${partidaId}:${tarefaId}:facil:pratica`), "pendente");
  t.fechar(); t.abrir(); await t.concluir();
  assert.match(t.texto(), /Não envie de novo/);
  assert.equal(t.cards().length, 0);
  assert.equal(t.envios.length, 1);
  assert.equal(pendencias.size, 1);
  t.desmontar();
  const recarregada = await prepararPraticaCama(opcoes); recarregada.abrir(); await recarregada.concluir();
  assert.equal(recarregada.cards().length, 0);
  assert.equal(recarregada.envios.length, 0);
  assert.equal(pendencias.size, 1, "restauração não apaga incerteza da prática");
  recarregada.desmontar();
});

for (const tipo of ["201", "401"]) test(`prática cama: resposta tardia ${tipo} após fechar não confirma envio`, async () => {
  const resultado = diferida();
  const t = await prepararPraticaCama({ post: async () => resultado.promise });
  t.abrir(); await t.concluir();
  const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  const signal = t.envios[0].config.signal; t.fechar();
  assert.equal(signal.aborted, true);
  if (tipo === "201") resultado.resolve(retorno(true)); else resultado.reject({ response: { status: 401 } });
  await envio; await t.concluir();
  assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.ok(t.armazenamento.has("token"));
  assert.equal(t.pendencias.size, 1);
  t.abrir(); await t.concluir();
  assert.equal(t.cards().length, 0);
  assert.equal(t.envios.length, 1);
  t.desmontar();
});

test("prática cama: fluxo normal até cartão pode entrar na prática na mesma montagem", async () => {
  const t = montar();
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); t.avancar(1500);
  t.abrirCortina(); await t.concluir(); await t.cards()[2].props.onSelecionar(); t.avancar(1500);
  t.abrirRoupa(); await t.concluir(); await t.cards()[2].props.onSelecionar(); t.avancar(1500); t.avancar(1000);
  await t.nos().find((n) => n.props.className === "botaoCardTentarDeNovo").props.onClick(); t.render();
  t.abrir(); await t.concluir(); assert.equal(t.cards().length, 4);
  await t.cards()[0].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  assert.equal(t.envios.length, 4);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.match(indicadorEstrelas(t), /Estrelas: 4$/);
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
  t.abrirCortina(); await t.concluir(); assert.equal(t.cards().length, 4);
  await t.cards()[2].props.onSelecionar(); await t.concluir(); t.avancar(1500);
  t.abrirRoupa(); await t.concluir(); assert.equal(t.cards().length, 4);
  await t.cards()[2].props.onSelecionar(); await t.concluir(); t.avancar(1500); t.avancar(1000);
  assert.equal(t.envios.length, 6);
  assert.match(indicadorEstrelas(t), /Estrelas: 6$/);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), true);
  assert.match(t.texto(), /Rodada de prática concluída!/);
  t.desmontar();
});

for (const props of [{ dificuldade: "medio" }, { jogoSalvoId: "6aac3c29bee9f041e4728a88" }]) test("prática cama: autorização visual não atravessa partida ou dificuldade", async () => {
  const t = await prepararPraticaCama();
  t.trocarProps(props); await t.concluir();
  assert.ok(t.nos().find((n) => n.props.className === "modalOverlayFim"));
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

for (const alvo of [
  { nome: "cortina", abrir: "abrirCortina", id: tarefaCortinaId, respostas: respostasCortina },
  { nome: "roupa", abrir: "abrirRoupa", id: tarefaRoupaId, respostas: respostasRoupa },
]) {
  const chavePendente = `conectamente:resposta-pendente:${partidaId}:${alvo.id}:facil:pratica`;
  const imagens = (t) => t.nos().filter((n) => ["Cama", "Janela", "Guarda Roupa"].includes(n.props.alt)).map((n) => n.props.src);

  for (const [dificuldade, pontos] of [["facil", 1], ["medio", 2], ["dificil", 3]]) {
    test(`prática ${alvo.nome} ${dificuldade}: dois acertos explícitos, payload real e total persistido`, async () => {
      const t = await prepararPraticaTarefa(alvo.id, { props: { dificuldade } });
      const antes = imagens(t);
      assert.equal(t.envios.length, 0);
      for (let rodada = 1; rodada <= 2; rodada++) {
        if (rodada > 1) await novaRodada(t);
        t[alvo.abrir](); await t.concluir();
        assert.equal(t.cards().length, 4);
        t.cards().forEach((card, i) => assert.equal(card.props.imagem, alvo.respostas[i].imagem));
        assert.equal(t.envios.length, rodada - 1, "abrir modal não envia resposta");
        await t.cards()[2].props.onSelecionar(); await t.concluir();
        assert.deepEqual({ ...t.envios.at(-1).body }, {
          perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId: alvo.id,
          respostaEscolhidaId: alvo.respostas[2]._id, dificuldade, sessaoId,
        });
        assert.match(t.texto(), /Muito bem! Você acertou|Muito bem! Você acertou/);
        assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${18 + rodada * pontos}$`));
        t.avancar(1500); t.avancar(1000);
        assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
        assert.deepEqual(imagens(t), antes);
        assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
        assert.equal(t.pendencias.size, 0);
      }
      const posicao = t.personagem(); t.teclado("d"); assert.notEqual(t.personagem(), posicao);
      t.desmontar();
    });

    test(`prática ${alvo.nome} ${dificuldade}: erro não pontua nem desfaz conclusão`, async () => {
      const t = await prepararPraticaTarefa(alvo.id, { props: { dificuldade } });
      const antes = imagens(t);
      t[alvo.abrir](); await t.concluir();
      await t.cards()[0].props.onSelecionar(); await t.concluir();
      assert.equal(t.envios.length, 1);
      assert.match(t.texto(), /Quase lá! Tente novamente!/);
      assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
      assert.deepEqual(imagens(t), antes);
      assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
      assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
      await t.cards()[2].props.onSelecionar(); await t.concluir(); t.avancar(1500);
      assert.equal(t.envios.length, 2);
      assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${18 + pontos}$`));
      t.desmontar();
    });
  }

  test(`prática ${alvo.nome}: duplo clique, fechamento durante animação e callback antigo`, async () => {
    const resultado = diferida();
    const t = await prepararPraticaTarefa(alvo.id, { post: async () => resultado.promise });
    t[alvo.abrir](); await t.concluir();
    const selecionar = t.cards()[2].props.onSelecionar;
    const envio = selecionar(); await selecionar(); await t.concluir();
    assert.equal(t.envios.length, 1);
    resultado.resolve(retorno(true)); await envio; await t.concluir();
    await selecionar(); assert.equal(t.envios.length, 1);
    t.fechar(); t[alvo.abrir](); await t.concluir();
    assert.equal(t.cards().length, 0, "animação continua protegida após fechar");
    t.avancar(1500); fecharOrientacao(t); await novaRodada(t); t[alvo.abrir](); await t.concluir();
    assert.equal(t.cards().length, 4);
    await selecionar(); assert.equal(t.envios.length, 1, "callback antigo não envia na nova rodada");
    await t.cards()[2].props.onSelecionar(); await t.concluir();
    assert.equal(t.envios.length, 2);
    t.desmontar();
    assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  });

  for (const [nome, falha] of [
    ["rede", async () => { throw new Error("rede"); }],
    ["timeout", async () => { throw { code: "ECONNABORTED" }; }],
    ["500", async () => { throw { response: { status: 500 } }; }],
    ["201 inválido", async () => ({ status: 201, data: { acertou: true } })],
    ["200 indevido", async () => ({ status: 200, data: retorno(true).data })],
  ]) test(`prática ${alvo.nome}: ${nome} permanece incerto após reabrir e recarregar`, async () => {
    const pendencias = new Map();
    const opcoes = { pendencias, post: falha };
    const t = await prepararPraticaTarefa(alvo.id, opcoes); t[alvo.abrir](); await t.concluir();
    await t.cards()[2].props.onSelecionar(); await t.concluir();
    assert.equal(t.envios.length, 1);
    assert.match(t.texto(), /Não foi possível confirmar esta prática/);
    assert.match(indicadorEstrelas(t), /Indisponível/);
    assert.equal(pendencias.get(chavePendente), "pendente");
    assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
    t.fechar(); t[alvo.abrir](); await t.concluir();
    assert.equal(t.cards().length, 0);
    assert.match(t.texto(), /Não envie de novo/);
    assert.equal(t.envios.length, 1);
    assert.equal(pendencias.size, 1);
    t.desmontar();
    const retomada = await prepararPraticaTarefa(alvo.id, opcoes); retomada[alvo.abrir](); await retomada.concluir();
    assert.equal(retomada.cards().length, 0);
    assert.equal(retomada.envios.length, 0);
    assert.equal(pendencias.size, 1);
    assert.match(retomada.texto(), /Tarefas\s+3\s*\/3/);
    retomada.desmontar();
  });

  for (const status of [401, 403, 409]) test(`prática ${alvo.nome}: HTTP ${status} preserva objetos e não simula sucesso`, async () => {
    const t = await prepararPraticaTarefa(alvo.id, { post: async () => { throw { response: { status } }; } });
    const antes = imagens(t);
    t[alvo.abrir](); await t.concluir(); await t.cards()[2].props.onSelecionar(); await t.concluir();
    assert.equal(t.envios.length, 1);
    assert.equal(t.pendencias.size, 0);
    assert.deepEqual(imagens(t), antes);
    assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
    assert.equal(t.armazenamento.has("token"), status !== 401);
    assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
    t.desmontar();
  });

  for (const tipo of ["201", "401", "troca de partida", "troca de dificuldade"]) test(`prática ${alvo.nome}: resposta tardia após ${tipo} é descartada`, async () => {
    const resultado = diferida();
    const t = await prepararPraticaTarefa(alvo.id, { post: async () => resultado.promise });
    t[alvo.abrir](); await t.concluir();
    const envio = t.cards()[2].props.onSelecionar(); await t.concluir();
    const signal = t.envios[0].config.signal;
    if (tipo === "troca de partida") t.trocarProps({ jogoSalvoId: "6aac3c29bee9f041e4728a88" });
    else if (tipo === "troca de dificuldade") t.trocarProps({ dificuldade: "medio" });
    else t.fechar();
    await t.concluir(); assert.equal(signal.aborted, true);
    if (tipo === "401") resultado.reject({ response: { status: 401 } });
    else resultado.resolve(retorno(true));
    await envio; await t.concluir();
    assert.equal(t.envios.length, 1);
    assert.equal(t.pendencias.size, 1);
    assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
    assert.ok(t.armazenamento.has("token"));
    assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
    t.desmontar();
  });

  test(`prática ${alvo.nome}: marcador surgido após abrir modal impede POST`, async () => {
    const t = await prepararPraticaTarefa(alvo.id, ); t[alvo.abrir](); await t.concluir();
    t.pendencias.set(chavePendente, "pendente");
    await t.cards()[2].props.onSelecionar(); await t.concluir();
    assert.equal(t.envios.length, 0);
    assert.match(t.texto(), /resposta anterior não foi confirmada/);
    assert.equal(t.pendencias.size, 1);
    t.desmontar();
  });

  test(`prática ${alvo.nome}: incerteza impede avançar para outra tarefa da rodada`, async () => {
    const t = await prepararPraticaTarefa(alvo.id, { post: async (_url, body) => {
      if (body.tarefaId === alvo.id) throw new Error("rede");
      return retorno(true);
    } });
    t[alvo.abrir](); await t.concluir(); await t.cards()[2].props.onSelecionar(); await t.concluir(); t.fechar();
    t.abrir(); await t.concluir(); assert.equal(t.cards().length, 0);
    fecharOrientacao(t);
    assert.equal(t.envios.length, 1);
    assert.match(indicadorEstrelas(t), /Indisponível/);
    assert.equal(t.pendencias.get(chavePendente), "pendente");
    assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
    t.desmontar();
  });

  test(`prática ${alvo.nome}: restauração repetida permite nova prática explícita sem recompensa ao carregar`, async () => {
    for (let abertura = 0; abertura < 2; abertura++) {
      const t = await prepararPraticaTarefa(alvo.id, );
      assert.equal(t.envios.length, 0);
      assert.equal(t.sons.length, 0);
      assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
      t[alvo.abrir](); await t.concluir();
      assert.equal(t.cards().length, 4);
      assert.equal(t.envios.length, 0);
      await t.cards()[2].props.onSelecionar(); await t.concluir(); t.avancar(1500);
      assert.match(indicadorEstrelas(t), /Estrelas: 19$/);
      t.desmontar();
    }
  });
}

test("cartão final: três opções ordenadas, banheiro inativo e saída delegada à sessão", async () => {
  const destinos = [];
  const t = montar(undefined, undefined, {
    estrelasIniciais: 18, concluidasIniciais: [tarefaId, tarefaCortinaId, tarefaRoupaId],
    props: { dificuldade: "dificil", onSairDoJogo: (destino) => destinos.push(destino) },
  });
  await t.concluir();
  const cartao = t.nos().find((n) => n.props.className === "cardContainerFim");
  const botoes = t.nos(cartao).filter((n) => n.type === "button");
  const texto = (n) => t.texto(n).replace(/\s+/g, " ").trim();
  assert.equal(texto(t.nos(cartao).find((n) => n.type === "h2")), "Quarto concluído!");
  assert.equal(texto(t.nos(cartao).find((n) => n.props.className === "textoCardFim")), "Parabéns! Você concluiu o Quarto!");
  assert.deepEqual(botoes.map(texto), ["Ir para o Banheiro", "Praticar novamente", "Voltar ao Painel"]);
  assert.equal(botoes[0].props.disabled, true);
  assert.equal(botoes[0].props.onClick, undefined);
  assert.equal(botoes[0].props.href, undefined);
  const legenda = t.nos(cartao).find((n) => n.props.id === botoes[0].props["aria-describedby"]);
  assert.equal(texto(legenda), "Em desenvolvimento");
  const leituras = t.chamadas.length;
  await t.concluir();
  assert.equal(t.chamadas.length, leituras);
  assert.equal(t.envios.length, 0);
  assert.deepEqual(destinos, []);
  botoes[2].props.onClick();
  assert.deepEqual(destinos, ["/menu"], "não usa Link nem router na cena");
  assert.equal(t.envios.length, 0);
  await botoes[1].props.onClick(); t.render();
  assert.equal(t.nos().some((n) => n.props.className === "modalOverlayFim"), false);
  await verificarSomentePrimeira(t);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
  assert.equal(t.envios.length, 0);
  t.nos().find((n) => n.type === "button" && /Ver conclusão do nível/.test(t.texto(n))).props.onClick(); t.render();
  assert.match(t.texto(), /Quarto concluído!/);
  t.desmontar();
});

for (const [dificuldade, destino] of [["facil", "Médio"], ["medio", "Difícil"]]) test(`cartão ${dificuldade}: mantém progressão, prática e saída originais`, async () => {
  const t = montar(undefined, undefined, { props: { dificuldade }, concluidasIniciais: [tarefaId, tarefaCortinaId, tarefaRoupaId] });
  await t.concluir();
  const cartao = t.nos().find((n) => n.props.className === "cardContainerFim");
  const botoes = t.nos(cartao).filter((n) => n.type === "button");
  assert.deepEqual(botoes.map((n) => t.texto(n).replace(/\s+/g, " ").trim()), [
    `Continuar (${destino})`, "Praticar novamente", "Sair da partida",
  ]);
  assert.doesNotMatch(t.texto(cartao), /Banheiro|Voltar ao Painel|Quarto concluído/);
  t.desmontar();
});

test("cartão final isolado sem controlador de sessão desabilita Voltar ao Painel", async () => {
  const t = montar(undefined, undefined, { props: { dificuldade: "dificil" }, concluidasIniciais: [tarefaId, tarefaCortinaId, tarefaRoupaId] });
  await t.concluir();
  const sair = t.nos().find((n) => n.type === "button" && t.texto(n).trim() === "Voltar ao Painel");
  assert.equal(sair.props.disabled, true);
  sair.props.onClick(); t.render();
  assert.ok(t.nos().some((n) => n.props.className === "modalOverlayFim"));
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

test("restaura progresso na entrada e consulta pergunta somente ao abrir cama", async () => {
  const tela = montar();
  assert.deepEqual(tela.chamadas.map((c) => c.url), [`/jogos-salvos/${partidaId}/progresso`]);
  tela.abrir();
  assert.match(tela.texto(), /Carregando pergunta/);
  assert.equal(tela.cards().length, 0);
  await tela.concluir();
  assert.deepEqual(tela.chamadas.slice(1).map((c) => c.url), [`/tarefas/${tarefaId}`, `/tarefas/${tarefaId}/respostas`, `/jogos-salvos/${partidaId}/progresso`]);
  assert.match(tela.texto(), /Enunciado recebido da API/);
  assert.equal(tela.cards().length, 4);
  tela.cards().forEach((card, i) => {
    assert.equal(card.key, respostas[i]._id);
    for (const campo of ["texto", "imagem", "audio"]) assert.equal(card.props[campo], respostas[i][campo]);
  });
  tela.desmontar();
});

test("resultado do servidor decide acerto, ignorando campo correta e posição", async () => {
  const tela = montar((url) => ({ data: url.endsWith("/respostas") ? respostas.map((r) => ({ ...r, correta: r._id !== corretaId })) : tarefa }));
  tela.abrir(); await tela.concluir();
  await tela.cards()[1].props.onSelecionar(); tela.render();
  assert.match(tela.texto(), /Quase lá! Tente novamente!/);
  assert.equal([...tela.timers.values()].some((t) => t.delay === 1500), false);
  await tela.cards()[0].props.onSelecionar(); tela.render();
  assert.match(tela.texto(), /Muito bem! Você acertou/);
  assert.equal(tela.nos().filter((n) => n.props.className === "particulaFesta").length, 15);
  assert.ok(tela.sons.includes("/audio/parabens.mp3"));
  tela.avancar(1500);
  assert.equal(tela.cards().length, 0);
  assert.equal(tela.nos().find((n) => n.props.alt === "Cama").props.src, "/images/quarto/camaArrumada.png");
  assert.match(tela.texto(), /1\s*\/3/);
  tela.desmontar();
});

for (const [nome, erro] of [["rede", new Error("rede")], ["500", { response: { status: 500 } }], ["404", { response: { status: 404 } }]]) {
  test(`falha ${nome}: limpa conteúdo, preserva sessão e permite fechar/reabrir`, async () => {
    let falhar = false;
    const tela = montar((url) => { if (falhar) throw erro; return { data: url.endsWith("/respostas") ? respostas : tarefa }; });
    tela.abrir(); await tela.concluir(); assert.equal(tela.cards().length, 4);
    tela.fechar(); falhar = true; tela.abrir();
    assert.equal(tela.cards().length, 0);
    assert.doesNotMatch(tela.texto(), /Enunciado recebido/);
    await tela.concluir();
    assert.equal(tela.cards().length, 0);
    assert.match(tela.texto(), /Não foi possível carregar/);
    assert.ok(tela.armazenamento.has("token"));
    tela.fechar(); falhar = false; tela.abrir(); await tela.concluir();
    assert.equal(tela.cards().length, 4);
    tela.desmontar();
  });
}

for (const token of [null, "   "]) test("sessão ausente não consulta API e oferece login", async () => {
  const tela = montar(undefined, token);
  tela.abrir(); await tela.concluir();
  assert.equal(tela.chamadas.length, 0);
  assert.equal(tela.cards().length, 0);
  assert.match(tela.texto(), /Sessão ausente/);
  assert.equal(tela.nos().find((n) => n.type === Link).props.href, "/");
  assert.equal(tela.armazenamento.size, 0);
  tela.desmontar();
});

test("401 limpa sessão e dados, mantém modal e oferece entrada novamente", async () => {
  const tela = montar(() => { throw { response: { status: 401 } }; });
  tela.abrir(); await tela.concluir();
  assert.match(tela.texto(), /Sessão expirada/);
  assert.equal(tela.armazenamento.size, 0);
  assert.equal(tela.cards().length, 0);
  assert.equal(tela.nos().find((n) => n.type === Link).props.href, "/");
  const posicao = tela.personagem(); tela.teclado("ArrowRight"); assert.equal(tela.personagem(), posicao);
  tela.fechar(); tela.desmontar();
});

for (const tipo of ["sucesso", "401"]) test(`resposta tardia ${tipo} após fechar não altera modal ou sessão`, async () => {
  const pendente = diferida();
  const tela = montar(() => pendente.promise);
  tela.abrir(); const signal = tela.chamadas.find((c) => c.url.startsWith("/tarefas/")).config.signal; tela.fechar();
  assert.equal(signal.aborted, true);
  if (tipo === "401") pendente.reject({ response: { status: 401 } }); else pendente.resolve({ data: tarefa });
  await tela.concluir();
  assert.equal(tela.cards().length, 0);
  assert.ok(tela.armazenamento.has("token"));
  assert.doesNotMatch(tela.texto(), /Sessão expirada/);
  tela.desmontar();
});

test("reabertura ignora consulta anterior inclusive seu finally", async () => {
  const antiga = diferida(), nova = diferida();
  const tela = montar((url, config, numero) => numero <= 3 ? antiga.promise : nova.promise);
  tela.abrir(); tela.fechar(); tela.abrir();
  antiga.reject({ response: { status: 401 } }); await tela.concluir();
  assert.match(tela.texto(), /Carregando pergunta/);
  assert.ok(tela.armazenamento.has("token"));
  nova.reject(new Error("rede")); await tela.concluir();
  assert.match(tela.texto(), /Não foi possível carregar/);
  tela.desmontar();
});

for (const [nome, lista] of [["menos de quatro", respostas.slice(0, 3)], ["IDs duplicados", [respostas[0], respostas[1], respostas[1], respostas[3]]], ["outra tarefa", respostas.map((r) => ({ ...r, tarefaId: "outra" }))]]) {
  test(`catálogo inválido (${nome}) não oferece seleção`, async () => {
    const tela = montar((url) => ({ data: url.endsWith("/respostas") ? lista : tarefa }));
    tela.abrir(); await tela.concluir();
    assert.equal(tela.cards().length, 0);
    assert.match(tela.texto(), /Não foi possível carregar/);
    tela.desmontar();
  });
}

test("setas/WASD e áudio da pergunta preservados; fechar loading libera movimento", () => {
  const tela = montar(() => new Promise(() => {}));
  const inicio = tela.personagem(); tela.teclado("d"); assert.notEqual(tela.personagem(), inicio);
  tela.abrir(); const parado = tela.personagem(); tela.teclado("ArrowRight"); assert.equal(tela.personagem(), parado);
  const audio = tela.nos().find((n) => n.props.className === "botaoAudioModal"); audio.props.onClick();
  assert.equal(audio.props.disabled, true);
  assert.equal(tela.sons.length, 0);
  tela.fechar(); tela.teclado("a"); assert.notEqual(tela.personagem(), parado);
  tela.desmontar();
});

test("sequência cama/cortina/roupa preservada; cena isolada não avança visualmente sem a página", async () => {
  const tela = montar();
  tela.abrir(); await tela.concluir();
  await tela.cards()[0].props.onSelecionar(); tela.avancar(1500);
  tela.nos().find((n) => n.props.alt === "Janela").props.onClick(); tela.render();
  await tela.concluir();
  assert.equal(tela.cards()[0].props.texto, respostasCortina[0].texto);
  await tela.cards()[2].props.onSelecionar(); tela.avancar(1500);
  tela.nos().find((n) => n.props.alt === "Guarda Roupa").props.onClick(); tela.render();
  await tela.concluir();
  await tela.cards()[2].props.onSelecionar(); tela.avancar(1500);
  assert.match(tela.texto(), /3\s*\/3/);
  tela.avancar(1000);
  assert.match(tela.texto(), /Nível\s*Fácil\s*concluído/);
  assert.equal(tela.nos().find((n) => n.props.className === "botaoCardContinuar").props.disabled, true);
  assert.match(tela.texto(), /Fácil/);
  assert.match(tela.texto(), /3\s*\/3/);
  assert.equal(tela.envios.length, 3);
  tela.desmontar();
});

const retorno = (acertou, campos = {}) => ({ status: 201, data: { acertou, tentativa: 1, pontuacaoGanha: acertou ? 1 : 0, dificuldade: "facil", ...campos } });
const progressoDaCama = (concluida, dificuldade = "facil") => ({ data: {
  jogoSalvoId: partidaId, tarefas: [{ tarefaId, dificuldade, concluida }],
} });

const imagemCama = (tela) => tela.nos().find((n) => n.props.alt === "Cama").props.src;

test("entrada restaura cama fácil sem modal, POST, áudio, partículas ou recompensa nova", async () => {
  const opcoes = { progresso: async () => progressoDaCama(true) };
  const t = montar(undefined, undefined, opcoes);
  await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(t.chamadas.length, 1);
  assert.equal(t.envios.length, 0);
  assert.equal(t.cards().length, 0);
  assert.equal(t.sons.length, 0);
  assert.equal(t.timers.size, 0);
  assert.equal(t.nos().filter((n) => n.props.className === "particulaFesta").length, 0);
  assert.match(t.texto(), /1\s*\/3/);
  t.render(); await t.concluir();
  assert.equal(t.chamadas.length, 1);
  assert.match(t.texto(), /1\s*\/3/);
  t.desmontar();
  const recarregada = montar(undefined, undefined, opcoes);
  await recarregada.concluir();
  assert.equal(imagemCama(recarregada), "/images/quarto/camaArrumada.png");
  assert.equal(recarregada.envios.length, 0);
  recarregada.desmontar();
});

for (const concluida of [false, true]) test(`entrada distingue conclusão ${concluida} da cama`, async () => {
  const t = montar(undefined, undefined, { progresso: async () => progressoDaCama(concluida) });
  await t.concluir();
  assert.equal(imagemCama(t), concluida ? "/images/quarto/camaArrumada.png" : "/images/quarto/cama1.png");
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

test("troca de partida remove conclusão anterior e ignora sucesso tardio de outra partida", async () => {
  const antiga = diferida();
  const outroId = "6aac3c29bee9f041e4728a83";
  const t = montar(undefined, undefined, { progresso: (url) => url.includes(partidaId)
    ? antiga.promise : Promise.resolve({ data: { jogoSalvoId: outroId, tarefas: [] } }) });
  const signal = t.chamadas[0].config.signal;
  t.trocarProps({ jogoSalvoId: outroId }); await t.concluir();
  assert.equal(signal.aborted, true);
  antiga.resolve(progressoDaCama(true)); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  assert.match(t.texto(), /0\s*\/3/);
  assert.equal(t.envios.length, 0);
  t.trocarProps({ jogoSalvoId: partidaId }); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  t.trocarProps({ jogoSalvoId: outroId }); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  assert.match(t.texto(), /0\s*\/3/);
  t.desmontar();
});

test("troca de dificuldade restaura somente o grupo correspondente, sem acumular conquistas", async () => {
  const t = montar(undefined, undefined, { progresso: async () => progressoDaCama(true) });
  await t.concluir();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  assert.match(t.texto(), /0\s*\/3/);
  t.trocarProps({ dificuldade: "facil" }); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.match(t.texto(), /1\s*\/3/);
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

test("sucesso tardio de dificuldade anterior não restaura a dificuldade atual", async () => {
  const antiga = diferida();
  let consultas = 0;
  const t = montar(undefined, undefined, { progresso: () => ++consultas === 1
    ? antiga.promise : Promise.resolve(progressoDaCama(true, "facil")) });
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  antiga.resolve(progressoDaCama(true)); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  assert.match(t.texto(), /0\s*\/3/);
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

test("consulta inicial anterior ao acerto não desfaz a conclusão confirmada depois", async () => {
  const antiga = diferida();
  let consultas = 0;
  const t = montar(undefined, undefined, { progresso: () => ++consultas === 1
    ? antiga.promise : Promise.resolve(progressoDaCama(false)) });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.avancar(1500);
  antiga.resolve(progressoDaCama(false)); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.match(t.texto(), /1\s*\/3/);
  assert.equal(t.envios.length, 1);
  t.desmontar();
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }, { response: { status: 404 } }, { response: { status: 403 } }]) {
  test(`falha de restauração ${erro.message ?? erro.code ?? erro.response.status} não inventa conclusão`, async () => {
    const t = montar(undefined, undefined, { progresso: async () => { throw erro; } });
    await t.concluir();
    assert.equal(imagemCama(t), "/images/quarto/cama1.png");
    assert.match(t.texto(), /Não foi possível carregar seu progresso/);
    assert.match(t.texto(), /0\s*\/3/);
    assert.equal(t.envios.length, 0);
    assert.ok(t.armazenamento.has("token"));
    const posicao = t.personagem(); t.teclado("d"); assert.notEqual(t.personagem(), posicao);
    t.desmontar();
  });
}

test("erro de restauração pode ser recuperado pela consulta existente do modal", async () => {
  let consultas = 0;
  const t = montar(undefined, undefined, { progresso: async () => {
    if (++consultas === 1) throw new Error("rede");
    return progressoDaCama(true);
  } });
  await t.concluir(); t.abrir(); await t.concluir();
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.doesNotMatch(t.texto(), /Não foi possível carregar seu progresso/);
  assert.equal(t.envios.length, 0);
  t.desmontar();
});

for (const data of [null, { jogoSalvoId: "outro", tarefas: [] }, { jogoSalvoId: partidaId, tarefas: [{ tarefaId, dificuldade: "facil", concluida: "true" }] }]) {
  test("progresso inválido não restaura a cama", async () => {
    const t = montar(undefined, undefined, { progresso: async () => ({ data }) });
    await t.concluir();
    assert.equal(imagemCama(t), "/images/quarto/cama1.png");
    assert.match(t.texto(), /Não foi possível carregar seu progresso/);
    assert.equal(t.envios.length, 0);
    t.desmontar();
  });
}

test("401 da restauração orienta login; 401 obsoleto não apaga sessão atual", async () => {
  const expirada = montar(undefined, undefined, { progresso: async () => { throw { response: { status: 401 } }; } });
  await expirada.concluir();
  assert.match(expirada.texto(), /Sessão expirada/);
  assert.equal(expirada.armazenamento.size, 0);
  assert.equal(expirada.envios.length, 0);
  expirada.desmontar();
  const pendente = diferida();
  const t = montar(undefined, undefined, { progresso: () => pendente.promise });
  const signal = t.chamadas[0].config.signal;
  t.desmontar(); pendente.reject({ response: { status: 401 } }); await t.concluir();
  assert.equal(signal.aborted, true);
  assert.ok(t.armazenamento.has("token"));
  assert.doesNotMatch(t.texto(), /Sessão expirada/);
});

test("payload contém somente os seis campos do contrato, sem JWT no body", async () => {
  const t = montar(); t.abrir(); await t.concluir();
  await t.cards()[1].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 1);
  const envio = t.envios[0];
  assert.equal(envio.url, "/historico-jogo/responder");
  assert.deepEqual(JSON.parse(JSON.stringify(envio.body)), {
    perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId,
    respostaEscolhidaId: respostas[1]._id, dificuldade: "facil", sessaoId,
  });
  assert.equal(envio.config.timeout, 10000);
  assert.equal(t.pendencias.size, 0);
  assert.match(t.texto(), /Quase lá! Tente novamente!/);
  assert.doesNotMatch(t.texto(), /Muito bem! Você acertou/);
  assert.match(t.texto(), /0\s*\/3/);
  t.desmontar();
});

test("acertou do servidor prevalece sobre o antigo ID conhecido e pontuação não vira conquistas", async () => {
  const t = montar(undefined, undefined, { post: async () => retorno(true, { pontuacaoGanha: 3 }) });
  t.abrir(); await t.concluir();
  await t.cards()[2].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Muito bem! Você acertou/);
  assert.match(t.texto(), /0\s*\/3/, "não há conquista antes do timer");
  t.avancar(1500);
  assert.match(t.texto(), /1\s*\/3/);
  assert.equal(t.envios[0].body.respostaEscolhidaId, respostas[2]._id);
  t.desmontar();
});

test("não exige alternativa com ID de gabarito conhecido na consulta", async () => {
  const lista = respostas.map((r, i) => ({ ...r, _id: `6aac3dc5463fb5f785522ab${i}` }));
  const t = montar((url) => ({ data: url.endsWith("/respostas") ? lista : tarefa }), undefined, { post: async () => retorno(true) });
  t.abrir(); await t.concluir(); assert.equal(t.cards().length, 4);
  await t.cards()[3].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Muito bem! Você acertou/); t.desmontar();
});

test("duplo clique e cliques durante animação geram apenas um POST e uma conquista", async () => {
  const d = diferida(), t = montar(undefined, undefined, { post: () => d.promise });
  t.abrir(); await t.concluir(); const clicar = t.cards()[0].props.onSelecionar;
  const primeiro = clicar(), segundo = clicar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.ok(t.cards().every((c) => c.props.disabled));
  assert.doesNotMatch(t.texto(), /Muito bem! Você acertou/);
  d.resolve(retorno(true)); await Promise.all([primeiro, segundo]); t.render();
  await clicar(); assert.equal(t.envios.length, 1);
  assert.ok(t.cards().every((c) => c.props.disabled));
  t.avancar(1500); await clicar(); t.avancar(1500);
  assert.equal(t.envios.length, 1); assert.match(t.texto(), /1\s*\/3/); t.desmontar();
});

test("acerto já persistido é restaurado sem novo POST, partículas ou recompensa", async () => {
  const t = montar(undefined, undefined, { progresso: async () => progressoDaCama(true) });
  t.abrir(); await t.concluir();
  assert.equal(t.envios.length, 0); assert.equal(t.cards().length, 0);
  assert.match(t.texto(), /Você já concluiu esta tarefa/);
  assert.match(t.texto(), /1\s*\/3/);
  assert.equal(t.sons.includes("/audio/parabens.mp3"), false);
  t.fechar(); t.abrir(); await t.concluir();
  assert.match(t.texto(), /1\s*\/3/); assert.equal(t.envios.length, 0); t.desmontar();
});

test("acerto em outra dificuldade não bloqueia a atual", async () => {
  const t = montar(undefined, undefined, { progresso: async () => progressoDaCama(true, "medio") });
  t.abrir(); await t.concluir(); assert.equal(t.cards().length, 4); t.desmontar();
});

test("progresso é verificado outra vez no clique para impedir recompensa já concluída", async () => {
  let consultas = 0;
  const t = montar(undefined, undefined, { progresso: async () => progressoDaCama(++consultas > 2) });
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(consultas, 3); assert.equal(t.envios.length, 0);
  assert.match(t.texto(), /Você já concluiu esta tarefa/); assert.match(t.texto(), /1\s*\/3/); t.desmontar();
});

for (const status of [400, 401, 403, 404, 409]) test(`POST HTTP ${status} não conclui a cama`, async () => {
  const t = montar(undefined, undefined, { post: async () => { throw { response: { status, data: { codigo: status === 409 ? "SESSAO_EXPIRADA" : undefined } } }; } });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 1); assert.match(t.texto(), /0\s*\/3/);
  assert.doesNotMatch(t.texto(), /Muito bem! Você acertou/);
  assert.equal(t.nos().find((n) => n.props.alt === "Cama").props.src, "/images/quarto/cama1.png");
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  assert.equal(t.armazenamento.has("token"), status !== 401);
  assert.equal(t.pendencias.size, 0);
  if (status === 401) assert.equal(t.nos().find((n) => n.type === Link).props.href, "/");
  t.desmontar();
});

for (const [nome, erro] of [["rede", new Error("rede")], ["timeout", { code: "ECONNABORTED" }], ["500", { response: { status: 500 } }]]) {
  test(`POST incerto (${nome}) não reenvia na reabertura nem no recarregamento da aba`, async () => {
    const pendencias = new Map();
    const t = montar(undefined, undefined, { pendencias, post: async () => { throw erro; } });
    t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); t.render();
    assert.match(t.texto(), /pode ter sido registrada/);
    assert.equal(t.envios.length, 1); assert.equal(pendencias.size, 1);
    t.fechar(); t.abrir(); await t.concluir();
    assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 1);
    assert.match(t.texto(), /resposta anterior não foi confirmada/);
    t.desmontar();
    const nova = montar(undefined, undefined, { pendencias });
    nova.abrir(); await nova.concluir(); assert.equal(nova.envios.length, 0); assert.equal(nova.cards().length, 0); nova.desmontar();
  });
}

for (const resultado of [
  { status: 200, data: retorno(true).data },
  retorno("true"), retorno(true, { dificuldade: "medio" }), retorno(true, { tentativa: 0 }), retorno(true, { pontuacaoGanha: -1 }),
]) test(`resposta inválida do POST não simula sucesso (${JSON.stringify(resultado)})`, async () => {
  const t = montar(undefined, undefined, { post: async () => resultado });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); t.render();
  assert.doesNotMatch(t.texto(), /Muito bem! Você acertou/); assert.match(t.texto(), /0\s*\/3/);
  assert.equal(t.pendencias.size, 1); t.desmontar();
});

for (const resultado of ["acerto", "401"]) test(`POST tardio após fechar (${resultado}) não altera modal, conquista ou sessão`, async () => {
  const d = diferida(), t = montar(undefined, undefined, { post: () => d.promise });
  t.abrir(); await t.concluir(); const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  t.fechar(); assert.equal(t.envios[0].config.signal.aborted, true);
  if (resultado === "401") d.reject({ response: { status: 401 } }); else d.resolve(retorno(true));
  await envio; t.render();
  assert.ok(t.armazenamento.has("token")); assert.doesNotMatch(t.texto(), /Muito bem! Você acertou/);
  assert.match(t.texto(), /0\s*\/3/); assert.equal(t.pendencias.size, 1);
  if (resultado === "acerto") {
    t.abrir(); await t.concluir(); assert.match(t.texto(), /Você já concluiu esta tarefa/);
    assert.equal(t.pendencias.size, 0); assert.equal(t.envios.length, 1); assert.match(t.texto(), /1\s*\/3/);
  }
  t.desmontar();
});

test("fechar durante os 1,5 s cancela timer e restaura conclusão sem duplicá-la", async () => {
  const t = montar(); t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); t.render();
  t.fechar(); t.avancar(1500); assert.match(t.texto(), /0\s*\/3/);
  t.abrir(); await t.concluir(); assert.match(t.texto(), /1\s*\/3/);
  assert.equal(t.envios.length, 1); t.desmontar();
});

test("falha na leitura do progresso impede POST", async () => {
  let leituras = 0;
  const t = montar(undefined, undefined, { progresso: async () => { if (++leituras > 2) throw new Error("rede"); return progressoDaCama(false); } });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 0); assert.equal(t.pendencias.size, 0); t.desmontar();
});

test("contexto de partida incompleto impede consulta e envio", async () => {
  const t = montar(undefined, undefined, { props: { sessaoId: undefined } });
  t.abrir(); await t.concluir();
  assert.equal(t.chamadas.length, 0); assert.equal(t.envios.length, 0); assert.equal(t.cards().length, 0); t.desmontar();
});

test("RespostaCard desabilita somente seleção, mantendo áudio independente", async () => {
  const arquivoCard = path.resolve(__dirname, "../src/components/jogo/RespostaCard.js");
  const { code } = babel.transformSync(fs.readFileSync(arquivoCard, "utf8"), {
    filename: arquivoCard, babelrc: false, configFile: false,
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  let selecoes = 0, audios = 0, propagacoes = 0;
  const contexto = { exports: {}, Audio: function () { this.play = () => { audios++; return Promise.resolve(); }; }, require(id) {
    if (id === "react/jsx-runtime") return require(id);
      if (id === "lucide-react") return new Proxy({}, { get: () => function Icone() {} });
    if (id.endsWith(".css")) return { __esModule: true, default: {} };
    throw new Error(id);
  } };
  vm.runInNewContext(code, contexto);
  const card = contexto.exports.default({ texto: "Teste", imagem: "/teste.png", audio: "/teste.mp3", disabled: true, onSelecionar: () => selecoes++ });
  const [selecao, audio] = card.props.children;
  assert.equal(selecao.props.disabled, true); assert.equal(audio.props.disabled, false);
  audio.props.onClick({ stopPropagation() { propagacoes++; } });
  assert.equal(audios, 1); assert.equal(propagacoes, 1); assert.equal(selecoes, 0);
});

test("troca de contexto durante POST impede conquista e invalidação de outra sessão", async () => {
  const d = diferida(), t = montar(undefined, undefined, { post: () => d.promise });
  t.abrir(); await t.concluir(); const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  t.trocarProps({ sessaoId: "d852415e-23c4-4703-9ae0-681789481d75" });
  d.reject({ response: { status: 401 } }); await envio; await t.concluir();
  assert.ok(t.armazenamento.has("token")); assert.match(t.texto(), /0\s*\/3/);
  assert.equal(t.envios.length, 1); assert.equal(t.cards().length, 0); t.desmontar();
});

test("HTTP local com api.js/Axios real envia Bearer e payload correto, sem MongoDB", async (t) => {
  const http = require("node:http");
  const { once } = require("node:events");
  const recebidos = [];
  const servidor = http.createServer(async (req, res) => {
    let texto = ""; for await (const parte of req) texto += parte;
    recebidos.push({ metodo: req.method, url: req.url, autenticado: req.headers.authorization === "Bearer token-ficticio-http", body: texto ? JSON.parse(texto) : null });
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer token-ficticio-http") { res.writeHead(401); res.end(JSON.stringify({ mensagem: "Não autorizado" })); return; }
    if (req.method === "POST") { res.writeHead(201); res.end(JSON.stringify(retorno(false).data)); return; }
    res.end(JSON.stringify(req.url.endsWith("/progresso") ? { jogoSalvoId: partidaId, tarefas: [], estrelasTotal: 11 } : req.url.endsWith("/respostas") ? respostas : tarefa));
  });
  servidor.listen(0, "127.0.0.1"); await once(servidor, "listening");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const localStorage = { getItem: () => "token-ficticio-http" };
  const arquivoApi = path.resolve(__dirname, "../src/services/api.js");
  const { code } = babel.transformSync(fs.readFileSync(arquivoApi, "utf8"), {
    filename: arquivoApi, babelrc: false, configFile: false,
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  const contexto = { exports: {}, require, localStorage, window: { localStorage }, process: { env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${servidor.address().port}` } } };
  vm.runInNewContext(code, contexto);
  const tela = montar(undefined, "token-ficticio-http", { api: contexto.exports.default });
  tela.abrir();
  for (let i = 0; i < 50 && !tela.cards().length; i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  assert.equal(tela.cards().length, 4);
  await tela.cards()[1].props.onSelecionar(); tela.render();
  assert.ok(recebidos.every((r) => r.autenticado));
  for (let i = 0; i < 50 && !/Estrelas: 11$/.test(indicadorEstrelas(tela)); i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  assert.equal(recebidos.length, 7, "inclui leitura do total persistido depois do POST 201");
  assert.match(indicadorEstrelas(tela), /Estrelas: 11$/);
  const post = recebidos.find((r) => r.metodo === "POST");
  assert.equal(post.url, "/historico-jogo/responder");
  assert.deepEqual(post.body, { perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId, respostaEscolhidaId: respostas[1]._id, dificuldade: "facil", sessaoId });
  assert.match(tela.texto(), /Quase lá! Tente novamente!/);
  tela.desmontar();
});

const progressoComCortina = (concluida, dificuldade = "facil", jogoSalvoId = partidaId) => ({ data: {
  jogoSalvoId, tarefas: [
    { tarefaId, dificuldade, concluida: true },
    { tarefaId: tarefaCortinaId, dificuldade, concluida },
  ],
} });
const imagemJanela = (t) => t.nos().find((n) => n.props.alt === "Janela").props.src;
function montarCortina(opcoes = {}, responder) {
  return montar(responder, undefined, { progresso: async () => progressoComCortina(false), ...opcoes });
}
async function abrirCortina(opcoes = {}, responder) {
  const t = montarCortina(opcoes, responder);
  await t.concluir(); t.abrirCortina(); await t.concluir();
  return t;
}

test("cortina: consulta real de tarefa e quatro cards com IDs, texto, imagens e áudio opcional", async () => {
  const t = await abrirCortina();
  assert.ok(t.chamadas.some((c) => c.url === `/tarefas/${tarefaCortinaId}`));
  assert.ok(t.chamadas.some((c) => c.url === `/tarefas/${tarefaCortinaId}/respostas`));
  assert.match(t.texto(), /Enunciado da cortina recebido da API/);
  assert.equal(t.cards().length, 4);
  t.cards().forEach((card, i) => {
    assert.equal(card.key, respostasCortina[i]._id);
    for (const campo of ["texto", "imagem", "audio"]) assert.equal(card.props[campo], respostasCortina[i][campo]);
    assert.ok(fs.existsSync(path.resolve(__dirname, "../public", card.props.imagem.slice(1))));
  });
  const parado = t.personagem(); t.teclado("d"); assert.equal(t.personagem(), parado);
  t.nos().find((n) => n.props.className === "botaoAudioModal").props.onClick();
  assert.deepEqual(t.sons, [tarefaCortina.audioEnunciado]);
  t.fechar(); t.teclado("d"); assert.notEqual(t.personagem(), parado);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("cortina: carregamento limpa alternativas e mantém fechar disponível", async () => {
  const d = diferida();
  const t = montarCortina({}, (url) => d.promise);
  await t.concluir(); t.abrirCortina();
  assert.match(t.texto(), /Carregando pergunta/); assert.equal(t.cards().length, 0);
  const signal = t.chamadas.find((c) => c.url.includes(tarefaCortinaId)).config.signal;
  t.fechar(); assert.equal(signal.aborted, true);
  d.resolve({ data: tarefaCortina }); await t.concluir();
  assert.equal(t.cards().length, 0); t.desmontar();
});

test("cortina: erro e acerto usam apenas acertou do POST, preservando cama e temporizador", async () => {
  const t = await abrirCortina({}, (url) => ({ data: url.endsWith("/respostas")
    ? respostasCortina.map((r) => ({ ...r, correta: r._id !== corretaCortinaId })) : tarefaCortina }));
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Quase lá! Tente novamente!/);
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.match(t.texto(), /1\s*\/3/);
  assert.deepEqual({ ...t.envios[0].body }, {
    perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId: tarefaCortinaId,
    respostaEscolhidaId: respostasCortina[0]._id, dificuldade: "facil", sessaoId,
  });
  await t.cards()[2].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Muito bem! Você acertou/);
  assert.equal(imagemJanela(t), "/images/quarto/janela.png", "só abre depois da confirmação e animação");
  assert.equal(t.nos().filter((n) => n.props.className === "particulaFesta").length, 15);
  assert.ok(t.sons.includes("/audio/parabens.mp3"));
  t.avancar(1500);
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.match(t.texto(), /2\s*\/3/);
  assert.equal(t.envios.length, 2); t.desmontar();
});

test("cortina: duplo clique e cliques nos 1,5 s geram somente um POST e uma conquista", async () => {
  const d = diferida();
  const t = await abrirCortina({ post: () => d.promise });
  const clicar = t.cards()[1].props.onSelecionar;
  const a = clicar(), b = clicar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.ok(t.cards().every((c) => c.props.disabled));
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  d.resolve(retorno(true)); await Promise.all([a, b]); t.render();
  await clicar(); assert.equal(t.envios.length, 1);
  t.avancar(1500); await clicar(); t.avancar(1500);
  assert.equal(t.envios.length, 1); assert.match(t.texto(), /2\s*\/3/); t.desmontar();
});

test("cortina: restaura cama e janela na entrada/recarregamento sem POST, festa ou estrelas", async () => {
  for (let i = 0; i < 2; i++) {
    const t = montarCortina({ progresso: async () => progressoComCortina(true) });
    await t.concluir();
    assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
    assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
    assert.match(t.texto(), /2\s*\/3/);
    assert.equal(t.chamadas.length, 1); assert.equal(t.envios.length, 0);
    assert.equal(t.sons.length, 0); assert.equal(t.timers.size, 0);
    t.abrirCortina(); t.render();
    assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 0); t.desmontar();
  }
});

test("cortina: progresso reconsultado antes do POST impede nova recompensa", async () => {
  let consultas = 0;
  const t = await abrirCortina({ progresso: async () => progressoComCortina(++consultas > 2) });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 0);
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
  assert.match(t.texto(), /2\s*\/3/);
  assert.match(t.texto(), /Você já concluiu esta tarefa/); t.desmontar();
});

test("cortina: fechar durante animação cancela timer e reabrir restaura uma única conquista", async () => {
  const t = await abrirCortina();
  await t.cards()[2].props.onSelecionar(); t.render(); t.fechar();
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  t.abrirCortina(); await t.concluir();
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
  assert.match(t.texto(), /2\s*\/3/); assert.equal(t.envios.length, 1); t.desmontar();
});

for (const status of [401, 403, 409]) test(`cortina: POST ${status} não conclui nem recompensa`, async () => {
  const t = await abrirCortina({ post: async () => { throw { response: { status } }; } });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.match(t.texto(), /1\s*\/3/);
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  assert.equal(t.cards().length, 0);
  if (status === 401) {
    assert.equal(t.armazenamento.size, 0); assert.match(t.texto(), /Sessão expirada/);
  } else {
    assert.ok(t.armazenamento.has("token"));
    assert.match(t.texto(), status === 403 ? /Você não pode responder agora/ : /sessão da partida terminou ou não está disponível/);
  }
  t.desmontar();
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }, { response: { status: 500 } }]) {
  test(`cortina: resultado incerto ${erro.message ?? erro.code ?? 500} bloqueia reenvio inclusive após recarregar`, async () => {
    const pendencias = new Map();
    const opcoes = { pendencias, post: async () => { throw erro; } };
    const t = await abrirCortina(opcoes);
    await t.cards()[0].props.onSelecionar(); t.render();
    assert.match(t.texto(), /pode ter sido registrada/);
    assert.equal(imagemJanela(t), "/images/quarto/janela.png");
    t.fechar(); t.abrirCortina(); await t.concluir();
    assert.equal(t.envios.length, 1); assert.equal(t.cards().length, 0); t.desmontar();
    const outra = await abrirCortina(opcoes);
    assert.equal(outra.envios.length, 0); assert.equal(outra.cards().length, 0);
    assert.equal(imagemJanela(outra), "/images/quarto/janela.png"); outra.desmontar();
  });
}

for (const resultado of [
  { status: 200, data: { acertou: true } },
  retorno("true"), retorno(true, { dificuldade: "medio" }), { status: 201, data: {} },
]) test("cortina: resposta HTTP inválida não simula sucesso", async () => {
  const t = await abrirCortina({ post: async () => resultado });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.match(t.texto(), /1\s*\/3/);
  assert.match(t.texto(), /Não envie de novo/); t.desmontar();
});

for (const tipo of ["acerto", "401"]) test(`cortina: POST tardio ${tipo} após fechar não altera cena nem autenticação`, async () => {
  const d = diferida();
  const t = await abrirCortina({ post: () => d.promise });
  const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  const signal = t.envios[0].config.signal; t.fechar();
  assert.equal(signal.aborted, true);
  if (tipo === "401") d.reject({ response: { status: 401 } }); else d.resolve(retorno(true));
  await envio; t.render(); t.avancar(1500);
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.match(t.texto(), /1\s*\/3/); assert.ok(t.armazenamento.has("token")); t.desmontar();
});

test("cortina: partidas e dificuldades diferentes não herdam a conclusão anterior", async () => {
  const outroId = "6aac3c29bee9f041e4728a83";
  const t = montarCortina({ progresso: async (url) => url.includes(partidaId)
    ? progressoComCortina(true) : progressoComCortina(false, "facil", outroId) });
  await t.concluir();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  assert.equal(imagemJanela(t), "/images/quarto/janela.png"); assert.match(t.texto(), /0\s*\/3/);
  t.trocarProps({ dificuldade: "facil", jogoSalvoId: outroId }); await t.concluir();
  assert.equal(imagemJanela(t), "/images/quarto/janela.png"); assert.match(t.texto(), /1\s*\/3/);
  t.trocarProps({ jogoSalvoId: partidaId }); await t.concluir();
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png"); assert.match(t.texto(), /2\s*\/3/);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("cortina: troca de contexto ignora POST tardio e consulta inicial obsoleta", async () => {
  const d = diferida();
  const t = await abrirCortina({ post: () => d.promise });
  const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  d.reject({ response: { status: 401 } }); await envio; t.render();
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.ok(t.armazenamento.has("token")); t.desmontar();

  const antiga = diferida(); let consultas = 0;
  const outra = montarCortina({ progresso: () => ++consultas === 1 ? antiga.promise : Promise.resolve(progressoComCortina(false)) });
  outra.trocarProps({ dificuldade: "medio" }); await outra.concluir();
  antiga.resolve(progressoComCortina(true)); await outra.concluir();
  assert.equal(imagemJanela(outra), "/images/quarto/janela.png");
  assert.equal(outra.envios.length, 0); outra.desmontar();
});

test("cortina: falha de progresso antes de responder impede POST", async () => {
  let leituras = 0;
  const t = await abrirCortina({ progresso: async () => {
    if (++leituras > 2) throw new Error("rede");
    return progressoComCortina(false);
  } });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 0); assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.match(t.texto(), /Não foi possível verificar/); t.desmontar();
});

for (const status of [401, 403, 409]) test(`cortina: erro de carregamento ${status} limpa alternativas`, async () => {
  const t = await abrirCortina({}, async () => { throw { response: { status } }; });
  assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 0);
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.match(t.texto(), status === 401 ? /Sessão expirada/ : /Não foi possível carregar/);
  t.desmontar();
});

for (const lista of [respostasCortina.slice(0, 3), respostas, respostasCortina.map((r) => ({ ...r, imagem: "" }))]) {
  test("cortina: catálogo inválido não oferece respostas", async () => {
    const t = await abrirCortina({}, (url) => ({ data: url.endsWith("/respostas") ? lista : tarefaCortina }));
    assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 0);
    assert.match(t.texto(), /Não foi possível carregar/); t.desmontar();
  });
}

test("cortina: ordem exige cama e libera roupa após ambas concluídas", async () => {
  const semCama = montar(); semCama.abrirCortina(); await semCama.concluir();
  assert.equal(semCama.cards().length, 0); assert.equal(semCama.envios.length, 0); semCama.desmontar();
  const t = montarCortina({ progresso: async () => progressoComCortina(true) }); await t.concluir();
  t.nos().find((n) => n.props.alt === "Guarda Roupa").props.onClick(); t.render();
  await t.concluir();
  await t.cards()[2].props.onSelecionar(); t.avancar(1500);
  assert.match(t.texto(), /3\s*\/3/);
  assert.equal(t.envios.length, 1); t.desmontar();
});

test("cortina: HTTP local com api.js/Axios real envia Bearer e payload correto, sem MongoDB", async (t) => {
  const http = require("node:http");
  const { once } = require("node:events");
  const recebidos = [];
  const servidor = http.createServer(async (req, res) => {
    let texto = ""; for await (const parte of req) texto += parte;
    recebidos.push({ metodo: req.method, url: req.url, autenticado: req.headers.authorization === "Bearer token-ficticio-http", body: texto ? JSON.parse(texto) : null });
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer token-ficticio-http") { res.writeHead(401); res.end(JSON.stringify({ mensagem: "Não autorizado" })); return; }
    if (req.method === "POST") { res.writeHead(201); res.end(JSON.stringify(retorno(false).data)); return; }
    res.end(JSON.stringify(req.url.endsWith("/progresso") ? { ...progressoComCortina(false).data, estrelasTotal: 11 } : req.url.endsWith("/respostas") ? respostasCortina : tarefaCortina));
  });
  servidor.listen(0, "127.0.0.1"); await once(servidor, "listening");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const localStorage = { getItem: () => "token-ficticio-http" };
  const arquivoApi = path.resolve(__dirname, "../src/services/api.js");
  const { code } = babel.transformSync(fs.readFileSync(arquivoApi, "utf8"), {
    filename: arquivoApi, babelrc: false, configFile: false,
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  const contexto = { exports: {}, require, localStorage, window: { localStorage }, process: { env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${servidor.address().port}` } } };
  vm.runInNewContext(code, contexto);
  const tela = montar(undefined, "token-ficticio-http", { api: contexto.exports.default });
  for (let i = 0; i < 50 && imagemCama(tela) !== "/images/quarto/camaArrumada.png"; i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  tela.abrirCortina();
  for (let i = 0; i < 50 && !tela.cards().length; i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  assert.equal(tela.cards().length, 4);
  await tela.cards()[1].props.onSelecionar(); tela.render();
  assert.ok(recebidos.every((r) => r.autenticado));
  for (let i = 0; i < 50 && !/Estrelas: 11$/.test(indicadorEstrelas(tela)); i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  assert.equal(recebidos.length, 7, "inclui leitura do total persistido depois do POST 201");
  assert.match(indicadorEstrelas(tela), /Estrelas: 11$/);
  const post = recebidos.find((r) => r.metodo === "POST");
  assert.equal(post.url, "/historico-jogo/responder");
  assert.deepEqual(post.body, { perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId: tarefaCortinaId, respostaEscolhidaId: respostasCortina[1]._id, dificuldade: "facil", sessaoId });
  assert.match(tela.texto(), /Quase lá! Tente novamente!/);
  tela.desmontar();
});

const progressoComRoupa = (concluida, dificuldade = "facil", jogoSalvoId = partidaId) => ({ data: {
  jogoSalvoId, tarefas: [
    { tarefaId, dificuldade, concluida: true },
    { tarefaId: tarefaCortinaId, dificuldade, concluida: true },
    { tarefaId: tarefaRoupaId, dificuldade, concluida },
  ],
} });
const imagemGuardaRoupa = (t) => t.nos().find((n) => n.props.alt === "Guarda Roupa").props.src;
function montarRoupa(opcoes = {}, responder) {
  return montar(responder, undefined, { progresso: async () => progressoComRoupa(false), ...opcoes });
}
async function abrirRoupa(opcoes = {}, responder) {
  const t = montarRoupa(opcoes, responder);
  await t.concluir(); t.abrirRoupa(); await t.concluir();
  return t;
}

test("roupa: consulta real de tarefa e quatro cards com IDs, texto, imagens e áudio opcional", async () => {
  const t = await abrirRoupa();
  assert.ok(t.chamadas.some((c) => c.url === `/tarefas/${tarefaRoupaId}`));
  assert.ok(t.chamadas.some((c) => c.url === `/tarefas/${tarefaRoupaId}/respostas`));
  assert.match(t.texto(), /Enunciado da roupa recebido da API/);
  assert.equal(t.cards().length, 4);
  t.cards().forEach((card, i) => {
    assert.equal(card.key, respostasRoupa[i]._id);
    for (const campo of ["texto", "imagem", "audio"]) assert.equal(card.props[campo], respostasRoupa[i][campo]);
    assert.ok(fs.existsSync(path.resolve(__dirname, "../public", card.props.imagem.slice(1))));
  });
  const parado = t.personagem(); t.teclado("d"); assert.equal(t.personagem(), parado);
  t.nos().find((n) => n.props.className === "botaoAudioModal").props.onClick();
  assert.deepEqual(t.sons, [tarefaRoupa.audioEnunciado]);
  t.fechar(); t.teclado("d"); assert.notEqual(t.personagem(), parado);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("roupa: carregamento limpa alternativas e mantém fechar disponível", async () => {
  const d = diferida();
  const t = montarRoupa({}, (url) => d.promise);
  await t.concluir(); t.abrirRoupa();
  assert.match(t.texto(), /Carregando pergunta/); assert.equal(t.cards().length, 0);
  const signal = t.chamadas.find((c) => c.url.includes(tarefaRoupaId)).config.signal;
  t.fechar(); assert.equal(signal.aborted, true);
  d.resolve({ data: tarefaRoupa }); await t.concluir();
  assert.equal(t.cards().length, 0); t.desmontar();
});

test("roupa: erro e acerto usam apenas acertou do POST, preservando cama e temporizador", async () => {
  const t = await abrirRoupa({}, (url) => ({ data: url.endsWith("/respostas")
    ? respostasRoupa.map((r) => ({ ...r, correta: r._id !== corretaRoupaId })) : tarefaRoupa }));
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Quase lá! Tente novamente!/);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), /2\s*\/3/);
  assert.deepEqual({ ...t.envios[0].body }, {
    perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId: tarefaRoupaId,
    respostaEscolhidaId: respostasRoupa[0]._id, dificuldade: "facil", sessaoId,
  });
  await t.cards()[2].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Muito bem! Você acertou/);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png", "só conclui depois da confirmação e animação");
  assert.equal(t.nos().filter((n) => n.props.className === "particulaFesta").length, 15);
  assert.ok(t.sons.includes("/audio/parabens.mp3"));
  t.avancar(1500);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.match(t.texto(), /3\s*\/3/);
  assert.equal(t.envios.length, 2); t.desmontar();
});

test("roupa: duplo clique e cliques nos 1,5 s geram somente um POST e uma conquista", async () => {
  const d = diferida();
  const t = await abrirRoupa({ post: () => d.promise });
  const clicar = t.cards()[1].props.onSelecionar;
  const a = clicar(), b = clicar(); await t.concluir();
  assert.equal(t.envios.length, 1);
  assert.ok(t.cards().every((c) => c.props.disabled));
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  d.resolve(retorno(true)); await Promise.all([a, b]); t.render();
  await clicar(); assert.equal(t.envios.length, 1);
  t.avancar(1500); await clicar(); t.avancar(1500);
  assert.equal(t.envios.length, 1); assert.match(t.texto(), /3\s*\/3/); t.desmontar();
});

test("roupa: restaura as três tarefas na entrada/recarregamento sem POST, festa ou estrelas", async () => {
  for (let i = 0; i < 2; i++) {
    const t = montarRoupa({ progresso: async () => progressoComRoupa(true) });
    await t.concluir();
    assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
    assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
    assert.match(t.texto(), /3\s*\/3/);
    assert.equal(t.chamadas.length, 1); assert.equal(t.envios.length, 0);
    assert.equal(t.sons.length, 0); assert.equal(t.timers.size, 0);
    t.abrirRoupa(); t.render();
    assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 0); t.desmontar();
  }
});

test("roupa: progresso reconsultado antes do POST impede nova recompensa", async () => {
  let consultas = 0;
  const t = await abrirRoupa({ progresso: async () => progressoComRoupa(++consultas > 2) });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 0);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  assert.match(t.texto(), /3\s*\/3/);
  assert.match(t.texto(), /Você já concluiu esta tarefa/); t.desmontar();
});

test("roupa: fechar durante animação cancela timer e reabrir restaura uma única conquista", async () => {
  const t = await abrirRoupa();
  await t.cards()[2].props.onSelecionar(); t.render(); t.fechar();
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  t.abrirRoupa(); await t.concluir();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  assert.match(t.texto(), /3\s*\/3/); assert.equal(t.envios.length, 1); t.desmontar();
});

for (const status of [401, 403, 409]) test(`roupa: POST ${status} não conclui nem recompensa`, async () => {
  const t = await abrirRoupa({ post: async () => { throw { response: { status } }; } });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), /2\s*\/3/);
  assert.equal([...t.timers.values()].some((timer) => timer.delay === 1500), false);
  assert.equal(t.cards().length, 0);
  if (status === 401) {
    assert.equal(t.armazenamento.size, 0); assert.match(t.texto(), /Sessão expirada/);
  } else {
    assert.ok(t.armazenamento.has("token"));
    assert.match(t.texto(), status === 403 ? /Você não pode responder agora/ : /sessão da partida terminou ou não está disponível/);
  }
  t.desmontar();
});

for (const erro of [new Error("rede"), { code: "ECONNABORTED" }, { response: { status: 500 } }]) {
  test(`roupa: resultado incerto ${erro.message ?? erro.code ?? 500} bloqueia reenvio inclusive após recarregar`, async () => {
    const pendencias = new Map();
    const opcoes = { pendencias, post: async () => { throw erro; } };
    const t = await abrirRoupa(opcoes);
    await t.cards()[0].props.onSelecionar(); t.render();
    assert.match(t.texto(), /pode ter sido registrada/);
    assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
    t.fechar(); t.abrirRoupa(); await t.concluir();
    assert.equal(t.envios.length, 1); assert.equal(t.cards().length, 0); t.desmontar();
    const outra = await abrirRoupa(opcoes);
    assert.equal(outra.envios.length, 0); assert.equal(outra.cards().length, 0);
    assert.equal(imagemGuardaRoupa(outra), "/images/quarto/guardaroupa.png"); outra.desmontar();
  });
}

for (const resultado of [
  { status: 200, data: { acertou: true } },
  retorno("true"), retorno(true, { dificuldade: "medio" }), { status: 201, data: {} },
]) test("roupa: resposta HTTP inválida não simula sucesso", async () => {
  const t = await abrirRoupa({ post: async () => resultado });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), /2\s*\/3/);
  assert.match(t.texto(), /Não envie de novo/); t.desmontar();
});

for (const tipo of ["acerto", "401"]) test(`roupa: POST tardio ${tipo} após fechar não altera cena nem autenticação`, async () => {
  const d = diferida();
  const t = await abrirRoupa({ post: () => d.promise });
  const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  const signal = t.envios[0].config.signal; t.fechar();
  assert.equal(signal.aborted, true);
  if (tipo === "401") d.reject({ response: { status: 401 } }); else d.resolve(retorno(true));
  await envio; t.render(); t.avancar(1500);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), /2\s*\/3/); assert.ok(t.armazenamento.has("token")); t.desmontar();
});

test("roupa: partidas e dificuldades diferentes não herdam a conclusão anterior", async () => {
  const outroId = "6aac3c29bee9f041e4728a83";
  const t = montarRoupa({ progresso: async (url) => url.includes(partidaId)
    ? progressoComRoupa(true) : progressoComRoupa(false, "facil", outroId) });
  await t.concluir();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png"); assert.match(t.texto(), /0\s*\/3/);
  t.trocarProps({ dificuldade: "facil", jogoSalvoId: outroId }); await t.concluir();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png"); assert.match(t.texto(), /2\s*\/3/);
  t.trocarProps({ jogoSalvoId: partidaId }); await t.concluir();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png"); assert.match(t.texto(), /3\s*\/3/);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("roupa: troca de contexto ignora POST tardio e consulta inicial obsoleta", async () => {
  const d = diferida();
  const t = await abrirRoupa({ post: () => d.promise });
  const envio = t.cards()[0].props.onSelecionar(); await t.concluir();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  d.reject({ response: { status: 401 } }); await envio; t.render();
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.ok(t.armazenamento.has("token")); t.desmontar();

  const antiga = diferida(); let consultas = 0;
  const outra = montarRoupa({ progresso: () => ++consultas === 1 ? antiga.promise : Promise.resolve(progressoComRoupa(false)) });
  outra.trocarProps({ dificuldade: "medio" }); await outra.concluir();
  antiga.resolve(progressoComRoupa(true)); await outra.concluir();
  assert.equal(imagemGuardaRoupa(outra), "/images/quarto/guardaroupa.png");
  assert.equal(outra.envios.length, 0); outra.desmontar();
});

test("roupa: falha de progresso antes de responder impede POST", async () => {
  let leituras = 0;
  const t = await abrirRoupa({ progresso: async () => {
    if (++leituras > 2) throw new Error("rede");
    return progressoComRoupa(false);
  } });
  await t.cards()[0].props.onSelecionar(); t.render();
  assert.equal(t.envios.length, 0); assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), /Não foi possível verificar/); t.desmontar();
});

for (const status of [401, 403, 409]) test(`roupa: erro de carregamento ${status} limpa alternativas`, async () => {
  const t = await abrirRoupa({}, async () => { throw { response: { status } }; });
  assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 0);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), status === 401 ? /Sessão expirada/ : /Não foi possível carregar/);
  t.desmontar();
});

for (const lista of [respostasRoupa.slice(0, 3), respostas, respostasRoupa.map((r) => ({ ...r, imagem: "" }))]) {
  test("roupa: catálogo inválido não oferece respostas", async () => {
    const t = await abrirRoupa({}, (url) => ({ data: url.endsWith("/respostas") ? lista : tarefaRoupa }));
    assert.equal(t.cards().length, 0); assert.equal(t.envios.length, 0);
    assert.match(t.texto(), /Não foi possível carregar/); t.desmontar();
  });
}

test("roupa: HTTP local com api.js/Axios real envia Bearer e payload correto, sem MongoDB", async (t) => {
  const http = require("node:http");
  const { once } = require("node:events");
  const recebidos = [];
  const servidor = http.createServer(async (req, res) => {
    let texto = ""; for await (const parte of req) texto += parte;
    recebidos.push({ metodo: req.method, url: req.url, autenticado: req.headers.authorization === "Bearer token-ficticio-http", body: texto ? JSON.parse(texto) : null });
    res.setHeader("Content-Type", "application/json");
    if (req.headers.authorization !== "Bearer token-ficticio-http") { res.writeHead(401); res.end(JSON.stringify({ mensagem: "Não autorizado" })); return; }
    if (req.method === "POST") { res.writeHead(201); res.end(JSON.stringify(retorno(false).data)); return; }
    res.end(JSON.stringify(req.url.endsWith("/progresso") ? { ...progressoComRoupa(false).data, estrelasTotal: 11 } : req.url.endsWith("/respostas") ? respostasRoupa : tarefaRoupa));
  });
  servidor.listen(0, "127.0.0.1"); await once(servidor, "listening");
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const localStorage = { getItem: () => "token-ficticio-http" };
  const arquivoApi = path.resolve(__dirname, "../src/services/api.js");
  const { code } = babel.transformSync(fs.readFileSync(arquivoApi, "utf8"), {
    filename: arquivoApi, babelrc: false, configFile: false,
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  const contexto = { exports: {}, require, localStorage, window: { localStorage }, process: { env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${servidor.address().port}` } } };
  vm.runInNewContext(code, contexto);
  const tela = montar(undefined, "token-ficticio-http", { api: contexto.exports.default });
  for (let i = 0; i < 50 && imagemCama(tela) !== "/images/quarto/camaArrumada.png"; i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  tela.abrirRoupa();
  for (let i = 0; i < 50 && !tela.cards().length; i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  assert.equal(tela.cards().length, 4);
  await tela.cards()[1].props.onSelecionar(); tela.render();
  assert.ok(recebidos.every((r) => r.autenticado));
  for (let i = 0; i < 50 && !/Estrelas: 11$/.test(indicadorEstrelas(tela)); i++) { await new Promise((resolve) => setTimeout(resolve, 10)); await tela.concluir(); }
  assert.equal(recebidos.length, 7, "inclui leitura do total persistido depois do POST 201");
  assert.match(indicadorEstrelas(tela), /Estrelas: 11$/);
  const post = recebidos.find((r) => r.metodo === "POST");
  assert.equal(post.url, "/historico-jogo/responder");
  assert.deepEqual(post.body, { perfilJogoId: perfilId, jogoSalvoId: partidaId, tarefaId: tarefaRoupaId, respostaEscolhidaId: respostasRoupa[1]._id, dificuldade: "facil", sessaoId });
  assert.match(tela.texto(), /Quase lá! Tente novamente!/);
  tela.desmontar();
});

test("roupa: ordem exige cama e cortina antes de abrir o modal", async () => {
  for (const progresso of [progressoDaCama(false), progressoDaCama(true)]) {
    const t = montar(undefined, undefined, { progresso: async () => progresso });
    await t.concluir(); t.abrirRoupa(); await t.concluir();
    assert.equal(t.cards().length, 0);
    assert.equal(t.chamadas.some((c) => c.url.includes(tarefaRoupaId)), false);
    assert.equal(t.envios.length, 0); t.desmontar();
  }
});

test("roupa: acertou prevalece sobre pontos, fecha a fase uma vez e mantém controles locais", async () => {
  let chamadas = 0;
  const t = await abrirRoupa({ post: async () => retorno(++chamadas > 1, { pontuacaoGanha: chamadas === 1 ? 99 : 0 }) });
  await t.cards()[2].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Quase lá! Tente novamente!/);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.match(t.texto(), /2\s*\/3/);
  await t.cards()[0].props.onSelecionar(); t.avancar(1500);
  assert.match(t.texto(), /3\s*\/3/);
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  t.avancar(1000);
  assert.match(t.texto(), /Nível\s*Fácil\s*concluído/);
  assert.equal(t.nos().find((n) => n.props.className === "botaoCardContinuar").props.disabled, true);
  assert.match(t.texto(), /Fácil/);
  assert.match(t.texto(), /3\s*\/3/);
  assert.equal(t.envios.length, 2); t.desmontar();
});

test("roupa: restauração das três tarefas apresenta fim de fase sem festa ou novo envio", async () => {
  const t = montarRoupa({ progresso: async () => progressoComRoupa(true) });
  await t.concluir();
  assert.match(t.texto(), /Nível\s*Fácil\s*concluído/);
  assert.match(t.texto(), /3\s*\/3/);
  assert.equal(t.envios.length, 0);
  assert.equal(t.sons.length, 0);
  assert.equal(t.timers.size, 0);
  assert.equal(t.nos().filter((n) => n.props.className === "particulaFesta").length, 0);
  t.desmontar();
});

test("roupa: desmontagem ou troca de contexto após animação cancela fim de fase pendente", async () => {
  for (const desmontar of [true, false]) {
    const t = await abrirRoupa();
    await t.cards()[2].props.onSelecionar(); t.avancar(1500);
    const sons = t.sons.length;
    assert.equal([...t.timers.values()].some((timer) => timer.delay === 1000), true);
    if (desmontar) t.desmontar(); else t.trocarProps({ dificuldade: "medio" });
    assert.equal([...t.timers.values()].some((timer) => timer.delay === 1000), false);
    t.avancar(1000); await t.concluir();
    assert.equal(t.sons.length, sons);
    if (!desmontar) assert.doesNotMatch(t.texto(), /Nível\s*Fácil\s*concluído/);
    t.desmontar();
  }
});

test("avanço: botão chama a página, mantém fácil enquanto pendente e exibe erro sem reiniciar", async () => {
  let chamadas = 0;
  const t = montar(undefined, undefined, { props: { onAvancarDificuldade: () => { chamadas++; } },
    progresso: async () => progressoComRoupa(true) });
  await t.concluir();
  const botao = () => t.nos().find((n) => n.props.className === "botaoCardContinuar");
  botao().props.onClick(); t.render();
  assert.equal(chamadas, 1);
  assert.match(t.texto(), /Fácil/); assert.match(t.texto(), /3\s*\/3/);
  t.trocarProps({ avancandoDificuldade: true });
  assert.equal(botao().props.disabled, true);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  t.trocarProps({ avancandoDificuldade: false, erroAvanco: "Avanço não autorizado." });
  assert.match(t.texto(), /Avanço não autorizado/);
  assert.equal(botao().props.disabled, false);
  assert.match(t.texto(), /Fácil/); t.desmontar();
});

test("avanço incerto: trava respostas antigas e reinício, permite conferir e sair pela página", async () => {
  let consultas = 0, saidas = 0;
  const t = montar(undefined, undefined, { props: {
    avancoIncerto: true, erroAvanco: "Confira a dificuldade antes de continuar.",
    onConferirDificuldade: () => { consultas++; }, onSairDoJogo: () => { saidas++; },
  }, progresso: async () => progressoComRoupa(true) });
  await t.concluir();
  assert.equal(t.nos().find((n) => n.props.className === "botaoCardContinuar").props.disabled, true);
  assert.equal(t.nos().find((n) => n.props.className === "botaoCardTentarDeNovo").props.disabled, true);
  t.nos().find((n) => n.type === "button" && t.texto(n).includes("Conferir dificuldade")).props.onClick();
  t.nos().find((n) => n.props.className === "botaoCardSair").props.onClick();
  assert.equal(consultas, 1); assert.equal(saidas, 1);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("médio: indicador real, estados novos e três POSTs usam medio, sem herdar acertos do fácil", async () => {
  const t = montar(undefined, undefined, { props: { dificuldade: "medio" } });
  await t.concluir();
  assert.match(t.texto(), /Médio/);
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.avancar(1500);
  t.abrirCortina(); await t.concluir();
  await t.cards()[2].props.onSelecionar(); t.avancar(1500);
  t.abrirRoupa(); await t.concluir();
  await t.cards()[2].props.onSelecionar(); t.avancar(1500); t.avancar(1000);
  assert.equal(t.envios.length, 3);
  for (const envio of t.envios) {
    assert.equal(envio.body.dificuldade, "medio");
    assert.equal(envio.body.sessaoId, sessaoId);
  }
  assert.match(t.texto(), /Nível\s*Médio\s*concluído/);
  assert.equal(t.nos().find((n) => n.props.className === "botaoCardContinuar").props.disabled, true);
  assert.match(t.texto(), /Continuar \(Difícil\)/);
  assert.doesNotMatch(t.texto(), /Fase\s*\d|Nível\s*\d/); t.desmontar();
});

test("retomada do médio restaura só a dificuldade real e apresenta avanço sem envio automático", async () => {
  const t = montar(undefined, undefined, { props: { dificuldade: "medio" },
    progresso: async () => progressoComRoupa(true, "medio") });
  await t.concluir();
  assert.match(t.texto(), /Médio/); assert.match(t.texto(), /Nível\s*Médio\s*concluído/);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  assert.equal(t.envios.length, 0); assert.equal(t.sons.length, 0);
  assert.equal(t.nos().find((n) => n.props.className === "botaoCardContinuar").props.disabled, true);
  assert.match(t.texto(), /Continuar \(Difícil\)/);
  t.desmontar();
});

test("médio não restaura conclusão existente somente no fácil", async () => {
  const t = montar(undefined, undefined, { props: { dificuldade: "medio" },
    progresso: async () => progressoComRoupa(true, "facil") });
  await t.concluir();
  assert.match(t.texto(), /Médio/); assert.match(t.texto(), /0\s*\/3/);
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.equal(t.envios.length, 0); t.desmontar();
});

for (const [dificuldade, titulo, estrelas, numeros] of [
  ["facil", "Fácil", 3, ["1", "2", "3"]],
  ["medio", "Médio", 3, []],
  ["dificil", "Difícil", 0, []],
]) {
  test(`visual ${titulo}: título real, ${estrelas} estrelas e números corretos sem alterar conquistas`, async () => {
    const t = montar(undefined, undefined, { props: { dificuldade } });
    await t.concluir();
    assert.equal(t.texto(t.nos().find((n) => n.props.className === "textoConquista")), titulo);
    assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, estrelas);
    assert.deepEqual(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").map((n) => t.texto(n)).sort(), numeros);
    assert.match(t.texto(), /0\s*\/3/);
    assert.doesNotMatch(t.texto(), /Fase\s*\d/);
    assert.equal(t.envios.length, 0);
    const posicao = t.personagem(); t.teclado("d"); assert.notEqual(t.personagem(), posicao);
    t.desmontar();
  });

  test(`visual ${titulo}: cartão usa nome da dificuldade e restauração não repete recompensas`, async () => {
    const t = montar(undefined, undefined, { props: { dificuldade },
      progresso: async () => progressoComRoupa(true, dificuldade) });
    await t.concluir();
    assert.equal(t.texto(t.nos().find((n) => n.props.className === "tituloCardFim")).replace(/\s+/g, " ").trim(), dificuldade === "dificil" ? "Quarto concluído!" : `Nível ${titulo} concluído!`);
    assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 0);
    assert.equal(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").length, 0);
    assert.match(t.texto(), /3\s*\/3/);
    assert.equal(t.envios.length, 0); assert.equal(t.sons.length, 0);
    t.desmontar();
  });
}

test("visual fácil → médio mantém três marcadores nas mesmas classes e remove apenas os números", async () => {
  const t = montar(); await t.concluir();
  const marcadores = () => t.nos().filter((n) => ["containerEstrelaCama", "containerEstrelaJanela", "containerEstrelaGuardaRoupa"].includes(n.props.className)).map((n) => n.props.className);
  const classes = marcadores();
  t.teclado("d"); const posicao = t.personagem();
  t.trocarProps({ dificuldade: "medio" }); await t.concluir();
  assert.deepEqual(marcadores(), classes);
  assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 3);
  assert.equal(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").length, 0);
  assert.equal(t.texto(t.nos().find((n) => n.props.className === "textoConquista")), "Médio");
  assert.equal(t.personagem(), posicao);
  assert.match(t.texto(), /0\s*\/3/); assert.equal(t.envios.length, 0);
  t.desmontar();
});

test("visual médio: concluir cama remove só sua estrela e mantém contador e demais objetos", async () => {
  const t = montar(undefined, undefined, { props: { dificuldade: "medio" } });
  await t.concluir(); t.abrir(); await t.concluir();
  await t.cards()[0].props.onSelecionar(); t.avancar(1500);
  assert.equal(t.nos().some((n) => n.props.className === "containerEstrelaCama"), false);
  assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 2);
  assert.equal(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").length, 0);
  assert.match(t.texto(), /1\s*\/3/);
  assert.equal(t.envios.length, 1);
  assert.equal(t.envios[0].body.dificuldade, "medio");
  t.desmontar();
});

for (const [nome, teclas] of [
  ["setas", ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]],
  ["WASD", ["d", "a", "w", "s"]],
]) {
  test(`personagem ampliado: ${nome} preserva posição inicial, passo e novos limites seguros`, async () => {
    const t = montar(); await t.concluir();
    const personagem = () => t.nos().find((n) => n.props.className?.startsWith("personagemMovivel"));
    assert.equal(personagem().props.style.left, "44%");
    assert.equal(personagem().props.style.bottom, "10%");
    t.teclado(teclas[0]); assert.equal(personagem().props.style.left, "46%");
    t.teclado(teclas[1]); assert.equal(personagem().props.style.left, "44%");
    t.teclado(teclas[2]); assert.equal(personagem().props.style.bottom, "12%");
    t.teclado(teclas[3]); assert.equal(personagem().props.style.bottom, "10%");
    assert.match(personagem().props.className, /personagemAndando/);
    t.avancar(200); assert.doesNotMatch(personagem().props.className, /personagemAndando/);
    for (const [tecla, propriedade, limite] of [
      [teclas[0], "left", "67.5%"], [teclas[1], "left", "5%"],
      [teclas[2], "bottom", "25%"], [teclas[3], "bottom", "8%"],
    ]) {
      for (let i = 0; i < 100; i++) t.teclado(tecla);
      assert.equal(personagem().props.style[propriedade], limite);
      t.teclado(tecla); assert.equal(personagem().props.style[propriedade], limite);
    }
    assert.equal(t.envios.length, 0);
    t.desmontar();
  });
}

test("médio concluído: Continuar (Difícil) chama a página sem reiniciar antes da confirmação", async () => {
  let chamadas = 0;
  const t = montar(undefined, undefined, { props: { dificuldade: "medio",
    onAvancarDificuldade: () => { chamadas++; } }, progresso: async () => progressoComRoupa(true, "medio") });
  await t.concluir();
  const botao = () => t.nos().find((n) => n.props.className === "botaoCardContinuar");
  assert.match(t.texto(botao()), /Continuar \(Difícil\)/); assert.equal(botao().props.disabled, false);
  botao().props.onClick(); t.render();
  assert.equal(chamadas, 1); assert.match(t.texto(), /Nível\s*Médio\s*concluído/);
  assert.equal(imagemCama(t), "/images/quarto/camaArrumada.png");
  assert.equal(imagemJanela(t), "/images/quarto/janelaAberta.png");
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaRoupaOrganizado.png");
  t.trocarProps({ avancandoDificuldade: true });
  assert.equal(botao().props.disabled, true);
  t.trocarProps({ avancandoDificuldade: false, erroAvanco: "Avanço não autorizado." });
  assert.equal(botao().props.disabled, false); assert.match(t.texto(), /Avanço não autorizado/);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("médio → difícil: título e objetos seguem nova prop sem herdar conclusões do médio", async () => {
  const t = montar(undefined, undefined, { props: { dificuldade: "medio" },
    progresso: async () => progressoComRoupa(true, "medio") });
  await t.concluir();
  t.trocarProps({ dificuldade: "dificil" }); await t.concluir();
  assert.equal(t.texto(t.nos().find((n) => n.props.className === "textoConquista")), "Difícil");
  assert.match(t.texto(), /0\s*\/3/);
  assert.equal(imagemCama(t), "/images/quarto/cama1.png");
  assert.equal(imagemJanela(t), "/images/quarto/janela.png");
  assert.equal(imagemGuardaRoupa(t), "/images/quarto/guardaroupa.png");
  assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 0);
  assert.equal(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").length, 0);
  assert.equal(t.envios.length, 0); t.desmontar();
});

test("difícil: três tarefas usam payload dificil, 3 pontos por acerto não viram conquistas e cartão é final", async () => {
  let tentativas = 0;
  const t = montar(undefined, undefined, { props: { dificuldade: "dificil" },
    post: async (url, body) => {
      assert.equal(body.dificuldade, "dificil"); assert.equal(body.sessaoId, sessaoId);
      const acertou = ++tentativas > 1;
      return { status: 201, data: { acertou, tentativa: tentativas, pontuacaoGanha: acertou ? 3 : 0, dificuldade: "dificil" } };
    } });
  await t.concluir();
  assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 0);
  t.abrir(); await t.concluir();
  await t.cards()[1].props.onSelecionar(); t.render();
  assert.match(t.texto(), /Quase lá! Tente novamente!/); assert.match(t.texto(), /0\s*\/3/);
  await t.cards()[1].props.onSelecionar(); t.avancar(1500);
  assert.match(t.texto(), /1\s*\/3/);
  t.abrirCortina(); await t.concluir(); await t.cards()[1].props.onSelecionar(); t.avancar(1500);
  assert.match(t.texto(), /2\s*\/3/);
  t.abrirRoupa(); await t.concluir(); await t.cards()[1].props.onSelecionar(); t.avancar(1500); t.avancar(1000);
  assert.match(t.texto(), /Quarto concluído!/);
  assert.match(t.texto(), /3\s*\/3/); assert.doesNotMatch(t.texto(), /9\s*\/3/);
  assert.match(t.texto(), /Você concluiu o Quarto/);
  assert.equal(t.nos().some((n) => n.props.className === "botaoCardContinuar"), false);
  assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 0);
  assert.equal(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").length, 0);
  assert.deepEqual(t.envios.map((e) => e.body.tarefaId), [tarefaId, tarefaId, tarefaCortinaId, tarefaRoupaId]);
  assert.ok(t.envios.every((e) => e.body.dificuldade === "dificil" && e.body.sessaoId === sessaoId));
  assert.equal(t.envios.length, 4); t.desmontar();
});

test("difícil restaurado: cartão final sem nível quatro, estrelas, POST, áudio ou recompensa nova", async () => {
  let avancos = 0;
  const t = montar(undefined, undefined, { props: { dificuldade: "dificil",
    onAvancarDificuldade: () => { avancos++; } },
    progresso: async () => progressoComRoupa(true, "dificil") });
  await t.concluir();
  assert.match(t.texto(), /Quarto concluído!/);
  assert.equal(t.nos().some((n) => n.props.className === "botaoCardContinuar"), false);
  assert.equal(t.nos().filter((n) => n.props.className === "imagemEstrelaIcone").length, 0);
  assert.equal(t.nos().filter((n) => n.props.className === "numeroEstrelaTexto").length, 0);
  assert.equal(t.envios.length, 0); assert.equal(t.sons.length, 0); assert.equal(t.timers.size, 0);
  assert.equal(avancos, 0); assert.match(t.texto(), /3\s*\/3/);
  t.desmontar();
});

for (const dificuldade of ["facil", "medio", "dificil"]) {
  for (const alvo of ["cama", "cortina", "roupa"]) {
    test(`mensagens pt-BR: ${alvo} em ${dificuldade} mostra recompensa confirmada`, async () => {
      const opcoes = { props: { dificuldade }, concluidasIniciais: alvo === "cama" ? [] : alvo === "cortina" ? [tarefaId] : [tarefaId, tarefaCortinaId] };
      const t = montar(undefined, undefined, opcoes);
      await t.concluir();
      if (alvo === "cama") t.abrir();
      else if (alvo === "cortina") t.abrirCortina();
      else t.abrirRoupa();
      await t.concluir();
      const id = alvo === "cama" ? corretaId : alvo === "cortina" ? corretaCortinaId : corretaRoupaId;
      await t.cards().find(card => card.key === id).props.onSelecionar();
      await t.concluir();
      const pontos = { facil: 1, medio: 2, dificil: 3 }[dificuldade];
      assert.ok(t.texto().includes(`Muito bem! Você acertou! Você ganhou ${pontos} ${pontos === 1 ? "estrela" : "estrelas"}!`));
      assert.equal(t.envios.length, 1);
      assert.equal(t.envios[0].body.dificuldade, dificuldade);
      assert.doesNotMatch(t.texto(), /[🎉💖🏆🚀🔊⚠️]/u);
      t.desmontar();
    });
  }
}

for (const alvo of ["cortina", "roupa"]) {
  test(`orientação sem solução: ${alvo} bloqueada não registra tentativa nem altera progresso`, async () => {
    const t = montar(undefined, undefined, { estrelasIniciais: 17 });
    await t.concluir();
    const consultas = t.chamadas.length, sons = t.sons.length, posicao = t.personagem();
    if (alvo === "cortina") t.abrirCortina(); else t.abrirRoupa();
    const dialogo = t.nos().find(n => n.type === "dialog");
    assert.ok(dialogo, "orientação deve ser um diálogo modal");
    assert.equal(dialogo.props["aria-labelledby"], "orientacao-quarto-titulo");
    assert.equal(dialogo.props["aria-describedby"], "orientacao-quarto-descricao");
    assert.match(t.texto(dialogo), /Tente novamente!/);
    assert.match(t.texto(dialogo), /Ordem errada!/);
    assert.doesNotMatch(t.texto(dialogo), /cama|cortina|roupa|primeiro|[🎉💖🏆🚀🔊⚠️]/iu);
    t.teclado("d"); assert.equal(t.personagem(), posicao);
    t.abrir(); t.abrirCortina(); t.abrirRoupa();
    await t.concluir();
    assert.equal(t.cards().length, 0);
    assert.equal(t.envios.length, 0);
    assert.equal(t.chamadas.length, consultas);
    assert.equal(t.sons.length, sons);
    assert.match(indicadorEstrelas(t), /Estrelas: 17$/);
    assert.match(t.texto(), /Tarefas\s+0\s*\/3/);
    const botao = t.nos(dialogo).find(n => n.type === "button");
    assert.equal(t.texto(botao), "Entendi");
    botao.props.onClick(); t.render();
    assert.equal(t.nos().some(n => n.type === "dialog"), false);
    t.teclado("d"); assert.notEqual(t.personagem(), posicao);
    t.abrir(); await t.concluir(); assert.equal(t.cards().length, 4);
    assert.equal(t.envios.length, 0);
    t.desmontar();
  });
}


const catalogoPratica = (ids = [tarefaId, tarefaCortinaId, tarefaRoupaId]) => ids.map((_id, i) => ({ _id, comodoId, ativo: true, ordem: i + 1 }));
async function bloquearNaRodada(t, abrir) {
  const leituras = t.chamadas.length, envios = t.envios.length;
  t[abrir](); await t.concluir();
  assert.equal(t.cards().length, 0);
  const dialogo = t.nos().find(n => n.type === "dialog");
  assert.ok(dialogo);
  assert.match(t.texto(dialogo), /Ordem errada!.*Tente novamente!/);
  assert.doesNotMatch(t.texto(dialogo), /cama|cortina|roupa|primeiro/i);
  assert.equal(t.chamadas.length, leituras);
  assert.equal(t.envios.length, envios);
  fecharOrientacao(t);
}
async function acertarNaRodada(t, abrir, alternativa) {
  t[abrir](); await t.concluir();
  await t.cards()[alternativa].props.onSelecionar(); await t.concluir(); t.avancar(1500);
}

for (const [dificuldade, pontos] of [["facil", 1], ["medio", 2], ["dificil", 3]]) {
  test(`rodada completa ${dificuldade}: catálogo real, três acertos novos, 3/3 preservado e reinício explícito`, async () => {
    const t = await prepararPraticaCama({ props: { dificuldade } });
    const aparencia = t.nos().filter(n => ["Cama", "Janela", "Guarda Roupa"].includes(n.props.alt)).map(n => n.props.src);
    for (let rodada = 1; rodada <= 2; rodada++) {
      assert.equal(t.envios.length, (rodada - 1) * 3);
      await bloquearNaRodada(t, "abrirCortina"); await bloquearNaRodada(t, "abrirRoupa");
      t.abrir(); await t.concluir(); t.fechar();
      await bloquearNaRodada(t, "abrirCortina");
      await acertarNaRodada(t, "abrir", 0);
      await bloquearNaRodada(t, "abrir"); await bloquearNaRodada(t, "abrirRoupa");
      await acertarNaRodada(t, "abrirCortina", 2);
      await bloquearNaRodada(t, "abrirCortina");
      await acertarNaRodada(t, "abrirRoupa", 2);
      assert.match(t.texto(), /Rodada de prática concluída!/);
      for (const abrir of ["abrir", "abrirCortina", "abrirRoupa"]) { t[abrir](); await t.concluir(); assert.equal(t.cards().length, 0); }
      assert.equal(t.envios.length, rodada * 3);
      assert.deepEqual(t.envios.slice(-3).map(e => e.body.tarefaId), [tarefaId, tarefaCortinaId, tarefaRoupaId]);
      assert.ok(t.envios.every(e => e.body.dificuldade === dificuldade && e.body.sessaoId === sessaoId && Object.keys(e.body).length === 6));
      assert.match(indicadorEstrelas(t), new RegExp(`Estrelas: ${18 + rodada * 3 * pontos}$`));
      assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
      assert.deepEqual(t.nos().filter(n => ["Cama", "Janela", "Guarda Roupa"].includes(n.props.alt)).map(n => n.props.src), aparencia);
      assert.equal(t.nos().some(n => n.props.className === "modalOverlayFim"), true);
      if (rodada === 1) await novaRodada(t);
    }
    t.desmontar();
  });
}

test("rodada: erro mantém a etapa e acerto só libera a próxima depois da animação, mesmo fechando o modal", async () => {
  const t = await prepararPraticaCama();
  t.abrir(); await t.concluir(); await t.cards()[1].props.onSelecionar(); await t.concluir();
  assert.match(t.texto(), /Quase lá! Tente novamente!/); t.fechar();
  await bloquearNaRodada(t, "abrirCortina");
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); await t.concluir(); t.fechar();
  await bloquearNaRodada(t, "abrirCortina"); await bloquearNaRodada(t, "abrir");
  t.avancar(1500); t.abrirCortina(); await t.concluir(); assert.equal(t.cards().length, 4);
  assert.equal(t.envios.length, 2); assert.match(indicadorEstrelas(t), /Estrelas: 19$/);
  t.desmontar();
});

for (const [nome, falha] of [
  ["rede", async () => { throw new Error("rede"); }],
  ["timeout", async () => { throw { code: "ECONNABORTED" }; }],
  ["HTTP 201 inválido", async () => ({ status: 201, data: { acertou: true } })],
  ["HTTP 200", async () => ({ status: 200, data: retorno(true).data })],
  ...[401, 403, 409].map(status => [`HTTP ${status}`, async () => { throw { response: { status } }; }]),
]) test(`rodada: ${nome} não libera tarefa seguinte`, async () => {
  const t = await prepararPraticaCama({ post: falha });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); await t.concluir(); t.fechar(); t.avancar(1500);
  await bloquearNaRodada(t, "abrirCortina"); await bloquearNaRodada(t, "abrirRoupa");
  assert.equal(t.envios.length, 1); assert.match(t.texto(), /Tarefas\s+3\s*\/3/);
  t.desmontar();
});

test("rodada: nova ação explícita não limpa incerteza nem usa acerto histórico para liberar cortina", async () => {
  const t = await prepararPraticaCama({ post: async () => { throw { code: "ECONNABORTED" }; } });
  t.abrir(); await t.concluir(); await t.cards()[0].props.onSelecionar(); await t.concluir(); t.fechar();
  const marcadores = [...t.pendencias];
  await novaRodada(t);
  assert.deepEqual([...t.pendencias], marcadores);
  t.abrir(); await t.concluir(); assert.equal(t.cards().length, 0); assert.match(t.texto(), /Não envie de novo/); t.fechar();
  await bloquearNaRodada(t, "abrirCortina"); assert.equal(t.envios.length, 1);
  t.desmontar();
});

test("rodada: recarregar descarta etapas temporárias sem apagar histórico ou estrelas", async () => {
  const t = await prepararPraticaCama(); await acertarNaRodada(t, "abrir", 0); t.desmontar();
  const retomada = await prepararPraticaCama({ estrelasIniciais: 19 });
  await bloquearNaRodada(retomada, "abrirCortina"); retomada.abrir(); await retomada.concluir();
  assert.equal(retomada.cards().length, 4); assert.equal(retomada.envios.length, 0);
  assert.match(indicadorEstrelas(retomada), /Estrelas: 19$/); assert.match(retomada.texto(), /Tarefas\s+3\s*\/3/);
  retomada.desmontar();
});

test("rodada: catálogo fora de ordem na resposta é ordenado por ordem; tarefa inativa não participa", async () => {
  const catalogo = catalogoPratica([tarefaRoupaId, tarefaId, tarefaCortinaId]);
  catalogo[2].ativo = false;
  catalogo.push({ _id: "6aac3c29bee9f041e4728a92", comodoId, ordem: 4, ativo: false });
  const t = await prepararPraticaCama({ catalogo: [...catalogo].reverse() });
  await bloquearNaRodada(t, "abrir"); await bloquearNaRodada(t, "abrirCortina");
  await acertarNaRodada(t, "abrirRoupa", 2); await acertarNaRodada(t, "abrir", 0);
  assert.match(t.texto(), /Rodada de prática concluída!/);
  t.abrirCortina();t.abrirRoupa();assert.equal(t.cards().length,0);
  assert.deepEqual(t.envios.map(e => e.body.tarefaId), [tarefaRoupaId, tarefaId]);
  assert.match(t.texto(), /Tarefas\s+3\s*\/3/); t.desmontar();
});

for (const catalogo of [[], [...catalogoPratica(), { _id: "6aac3c29bee9f041e4728a92", comodoId, ativo: true, ordem: 4 }],
  catalogoPratica().map(t => ({ ...t, ativo: false })), catalogoPratica().map(t => ({ ...t, ordem: 1 }))]) {
  test("rodada: catálogo vazio, sem ativas, ambíguo ou com tarefa sem interface mantém prática indisponível", async () => {
    const t = await prepararPraticaCama({ catalogo });
    assert.match(t.texto(), /A prática está indisponível/);
    assert.ok(t.nos().some(n => n.props.className === "modalOverlayFim"));
    assert.equal(t.envios.length, 0); assert.match(indicadorEstrelas(t), /Estrelas: 18$/);
    t.desmontar();
  });
}

for (const tipo of ["desmontagem", "partida", "dificuldade", "sessao"]) test(`rodada: consulta de catálogo obsoleta por ${tipo} não inicia prática`, async () => {
  const d = diferida(), t = montar(undefined, undefined, { concluidasIniciais: [tarefaId, tarefaCortinaId, tarefaRoupaId], consultarCatalogo: () => d.promise });
  await t.concluir(); const iniciar = t.nos().find(n => n.props.className === "botaoCardTentarDeNovo").props.onClick;
  const primeira = iniciar(); await t.concluir();
  assert.match(t.texto(), /Preparando a prática/);
  assert.equal(t.nos().find(n => n.props.className === "botaoCardTentarDeNovo").props.disabled, true);
  await iniciar();
  assert.equal(t.chamadas.filter(c => c.url.startsWith('/comodos/')).length, 1);
  if (tipo === "desmontagem") t.desmontar();
  else { t.trocarProps(tipo === "partida" ? { jogoSalvoId: "6aac3c29bee9f041e4728a88" } : tipo === "dificuldade" ? { dificuldade: "medio" } : { sessaoId: "d852415e-23c4-4703-9ae0-681789481d75" }); await t.concluir(); }
  d.resolve({ data: catalogoPratica() }); await primeira; await t.concluir();
  assert.equal(t.envios.length, 0); assert.equal(t.cards().length, 0);
  assert.equal(t.chamadas.filter(c => c.url.startsWith('/comodos/')).length, 1);
  t.desmontar();
});

for (const status of [401, 403, 500]) test(`rodada: erro ${status} no catálogo não inicia prática`, async () => {
  const t = await prepararPraticaCama({ consultarCatalogo: async () => { throw { response: { status } }; } });
  assert.match(t.texto(), status === 401 ? /Sessão expirada/ : /prática está indisponível/);
  assert.equal(t.armazenamento.has("token"), status !== 401); assert.equal(t.envios.length, 0);
  assert.ok(t.nos().some(n => n.props.className === "modalOverlayFim")); t.desmontar();
});


for (const imagemAvatar of ["/images/boneco.png","/images/boneco2.png","/images/menina1.png","/images/menina2.png"]) test(`avatar da jornada no Quarto: ${imagemAvatar} preserva coordenadas e movimentação`,async()=>{
  const t=montar(undefined,undefined,{props:{jogoSalvo:{perfilJogoId:{_id:perfilId,nomeAvatar:"Luna",imagemAvatar}}}});await t.concluir();
  const posicao=t.personagem();t.teclado("d");assert.notEqual(t.personagem(),posicao);
  const visual=t.nos().find(n=>n.props.className?.startsWith("personagemMovivel"));
  if(imagemAvatar==="/images/boneco.png")assert.match(visual.props.className,/personagemAndando/);
  else {assert.match(visual.props.className,/personagemAvatar/);assert.equal(t.nos(visual).find(n=>n.type==="img").props.src,imagemAvatar);assert.doesNotMatch(visual.props.className,/personagemAndando/);}
  assert.equal(t.envios.length,0);t.desmontar();
});


for(const dificuldade of ["facil","medio","dificil"])test(`cartão de prática ${dificuldade}: só último acerto confirmado após 1,5 s exibe cartão próprio uma vez`,async()=>{
  let saidas=0;
  const t=await prepararPraticaCama({props:{dificuldade,onSairDoJogo:()=>saidas++}});
  await acertarNaRodada(t,"abrir",0);await acertarNaRodada(t,"abrirCortina",2);
  assert.equal(t.nos().some(n=>n.props.className==="modalOverlayFim"),false);
  t.abrirRoupa();await t.concluir();const responder=t.cards()[2].props.onSelecionar;
  await responder();await t.concluir();
  assert.equal(t.nos().some(n=>n.props.className==="modalOverlayFim"),false,"não aparece durante animação");
  t.avancar(1500);
  const card=t.nos().find(n=>n.props.className==="cardContainerFim");
  assert.ok(card,"última animação deve apresentar cartão da rodada");
  assert.equal(t.texto(t.nos(card).find(n=>n.type==="h2")),"Rodada de prática concluída!");
  const botoes=t.nos(card).filter(n=>n.type==="button");
  assert.deepEqual(botoes.map(n=>t.texto(n).trim()),["Praticar novamente","Sair da partida"]);
  await responder();await t.concluir();t.avancar(1500);
  assert.equal(t.envios.length,3);assert.equal(t.nos().filter(n=>n.props.className==="cardContainerFim").length,1);
  assert.match(t.texto(),/Tarefas\s+3\s*\/3/);
  const total=18+3*{facil:1,medio:2,dificil:3}[dificuldade];assert.match(indicadorEstrelas(t),new RegExp(`Estrelas: ${total}$`));
  botoes[1].props.onClick();assert.equal(saidas,1,"saída usa callback da sessão");
  await botoes[0].props.onClick();t.render();assert.equal(t.nos().some(n=>n.props.className==="modalOverlayFim"),false);
  await t.concluir();t.avancar(1500);t.avancar(1000);
  assert.equal(t.nos().some(n=>n.props.className==="modalOverlayFim"),false,"3/3 histórico não reabre cartão da rodada");
  await bloquearNaRodada(t,"abrirCortina");t.abrir();await t.concluir();assert.equal(t.cards().length,4);t.desmontar();
});


for(const [nome,post] of [
  ["erro",async()=>retorno(false)],
  ["timeout",async()=>{throw{code:"ECONNABORTED"};}],
  ["rede",async()=>{throw new Error("rede");}],
  ["201 inválido",async()=>({status:201,data:{acertou:true}})],
])test(`cartão de prática: última resposta com ${nome} não conclui rodada`,async()=>{
  const t=await prepararPraticaCama({post:async(url,body)=>body.tarefaId===tarefaRoupaId?post():retorno(true)});
  await acertarNaRodada(t,"abrir",0);await acertarNaRodada(t,"abrirCortina",2);
  t.abrirRoupa();await t.concluir();await t.cards()[2].props.onSelecionar();await t.concluir();t.avancar(1500);t.avancar(1000);
  assert.equal(t.nos().some(n=>n.props.className==="modalOverlayFim"),false);
  assert.doesNotMatch(t.texto(),/Rodada de prática concluída!/);assert.equal(t.envios.length,3);
  assert.match(t.texto(),/Tarefas\s+3\s*\/3/);t.desmontar();
});

test("cartão de prática: fechar última pergunta durante animação confirmada ainda apresenta conclusão",async()=>{
  const t=await prepararPraticaCama();await acertarNaRodada(t,"abrir",0);await acertarNaRodada(t,"abrirCortina",2);
  t.abrirRoupa();await t.concluir();await t.cards()[2].props.onSelecionar();await t.concluir();t.fechar();
  assert.doesNotMatch(t.texto(),/Rodada de prática concluída!/);t.avancar(1500);
  assert.match(t.texto(),/Rodada de prática concluída!/);assert.equal(t.envios.length,3);t.desmontar();
});

for(const tipo of ["201 tardio","troca de dificuldade","troca de partida"])test(`cartão de prática: ${tipo} não apresenta conclusão de rodada obsoleta`,async()=>{
  const d=diferida(),t=await prepararPraticaCama({post:async(url,body)=>body.tarefaId===tarefaRoupaId?d.promise:retorno(true)});
  await acertarNaRodada(t,"abrir",0);await acertarNaRodada(t,"abrirCortina",2);
  t.abrirRoupa();await t.concluir();const envio=t.cards()[2].props.onSelecionar();await t.concluir();
  if(tipo==="201 tardio")t.fechar();else t.trocarProps(tipo==="troca de dificuldade"?{dificuldade:"medio"}:{jogoSalvoId:"6aac3c29bee9f041e4728a88"});
  d.resolve(retorno(true));await envio;await t.concluir();t.avancar(1500);t.avancar(1000);
  assert.doesNotMatch(t.texto(),/Rodada de prática concluída!/);assert.equal(t.envios.length,3);assert.equal(t.pendencias.size,1);t.desmontar();
});

// Executa também o handler do RespostaCard real, além do callback recebido da cena.
function renderizarCardAudio(props) {
  const arquivo = path.resolve(__dirname, "../src/components/jogo/RespostaCard.js");
  const { code } = babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
    filename: arquivo, babelrc: false, configFile: false,
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
    plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
  });
  const contexto = { exports: {}, require(id) {
    if (id === "react/jsx-runtime") return require(id);
    if (id === "lucide-react") return { Volume2() {} };
    if (id.endsWith(".css")) return { __esModule: true, default: {} };
    throw new Error(id);
  } };
  vm.runInNewContext(code, contexto);
  return contexto.exports.default(props).props.children[1];
}

for (const [nome, abrir, pergunta, alternativas] of [
  ["cama", "abrir", tarefa, respostas],
  ["cortina", "abrirCortina", tarefaCortina, respostasCortina],
  ["roupa", "abrirRoupa", tarefaRoupa, respostasRoupa],
]) test(`áudio: ${nome} usa enunciado e quatro alternativas da API sem autoplay ou POST`, async () => {
  const t = montar(undefined, undefined, { concluidasIniciais:
    nome === "roupa" ? [tarefaId, tarefaCortinaId] : nome === "cortina" ? [tarefaId] : [] });
  await t.concluir(); t[abrir](); await t.concluir();
  assert.equal(t.sons.length, 0);
  const amarelo = t.nos().find((n) => n.props.className === "botaoAudioModal");
  assert.equal(amarelo.props.disabled, false); amarelo.props.onClick();
  assert.equal(t.sons[0], pergunta.audioEnunciado);
  for (let i = 0; i < 4; i++) {
    let propagacoes = 0;
    const azul = renderizarCardAudio(t.cards()[i].props);
    azul.props.onClick({ stopPropagation() { propagacoes++; } });
    assert.equal(propagacoes, 1);
    assert.equal(t.sons[i + 1], alternativas[i].audio);
    assert.equal(t.players[i].pausas, 1);
    assert.equal(t.players[i].liberado, true);
    assert.equal(t.players[i + 1].pausas, 0);
  }
  assert.equal(t.envios.length, 0);
  t.fechar(); assert.equal(t.players[4].pausas, 1);
  t.desmontar();
});

test("áudio: repetir, mudar contexto, bloquear sessão e desmontar interrompem reprodução", async () => {
  const t = montar(); t.abrir(); await t.concluir();
  const tocar = () => t.nos().find((n) => n.props.className === "botaoAudioModal").props.onClick();
  tocar(); tocar(); assert.equal(t.players[0].pausas, 1);
  t.trocarProps({ dificuldade: "medio" }); assert.equal(t.players[1].pausas, 1);
  await t.concluir(); tocar(); t.trocarProps({ audioBloqueado: true });
  assert.equal(t.players[2].pausas, 1); tocar(); assert.equal(t.players.length, 3);
  t.trocarProps({ audioBloqueado: false }); tocar(); t.desmontar();
  assert.equal(t.players[3].pausas, 1); assert.equal(t.envios.length, 0);
});

for (const valor of [undefined, null, ""]) test(`áudio: ausência ${String(valor)} mantém jogo e seleção disponíveis`, async () => {
  const t = montar((url) => ({ data: url.endsWith("/respostas")
    ? respostas.map((r) => ({ ...r, audio: valor })) : { ...tarefa, audioEnunciado: valor } }));
  t.abrir(); await t.concluir();
  const amarelo = t.nos().find((n) => n.props.className === "botaoAudioModal");
  assert.equal(amarelo.props.disabled, true); amarelo.props.onClick();
  const azul = renderizarCardAudio(t.cards()[0].props);
  assert.equal(azul.props.disabled, true); azul.props.onClick({ stopPropagation() {} });
  assert.equal(t.sons.length, 0); assert.equal(t.envios.length, 0);
  await t.cards()[0].props.onSelecionar(); assert.equal(t.envios.length, 1);
  t.desmontar();
});

for (const falha of ["rejeição", "exceção play", "construtor"]) test(`áudio: ${falha} não quebra resposta nem jogo`, async () => {
  const t = montar(undefined, undefined, {
    audioConstrutorFalha: falha === "construtor",
    audioPlay: () => { if (falha === "exceção play") throw new Error("Falha síncrona"); return Promise.reject(new Error("Arquivo ausente")); },
  });
  t.abrir(); await t.concluir();
  t.nos().find((n) => n.props.className === "botaoAudioModal").props.onClick();
  await t.concluir(); assert.equal(t.cards().length, 4); assert.equal(t.envios.length, 0);
  await t.cards()[0].props.onSelecionar(); await t.concluir();
  assert.equal(t.envios.length, 1); t.desmontar();
});

test("áudio: os 15 caminhos das fixtures existem em public, com case exato e conteúdo MP3", () => {
  const caminhos = [tarefa, tarefaCortina, tarefaRoupa].map((t) => t.audioEnunciado)
    .concat([...respostas, ...respostasCortina, ...respostasRoupa].map((r) => r.audio));
  assert.equal(new Set(caminhos).size, 15);
  for (const caminho of caminhos) {
    let diretorio = path.resolve(__dirname, "../public");
    for (const parte of caminho.slice(1).split("/")) {
      assert.ok(fs.readdirSync(diretorio).includes(parte), caminho);
      diretorio = path.join(diretorio, parte);
    }
    const dados = fs.readFileSync(diretorio);
    assert.ok(dados.length > 1000, caminho);
    assert.ok(dados.subarray(0, 3).toString() === "ID3" || (dados[0] === 0xff && (dados[1] & 0xe0) === 0xe0), caminho);
  }
});
