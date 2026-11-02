const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("next/dist/compiled/babel/core");

// JSX real; hooks e API controlados. Não acessa MongoDB ou navegador.
const A = "6ae7e301bd8efb0766120010", B = "6ae7e301bd8efb0766120011";
const P = "6aac3c29bee9f041e4728a82", Q = "6aac3a3ea0d0e3c33530c5d2", BAN = "6aac3a3ea0d0e3c33530c5d3";
const IDS = ["6aac3c29bee9f041e4728a8f", "6aac3c29bee9f041e4728a90", "6aac3c29bee9f041e4728a91"];
const tarefas = IDS.map((_id, i) => ({ _id, comodoId: Q, ordem: i + 1, ativo: true }));
const niveis = ["facil", "medio", "dificil"];
const partida = (_id = A) => ({ _id, perfilJogoId: { _id: P, nomeAvatar: "Personagem" }, nomeJogo: `Partida ${_id === A ? "A" : "B"}`, dificuldade: "dificil" });
const grupo = (tarefaId, dificuldade, acertos = 1, erros = 0) => ({ tarefaId, dificuldade, concluida: acertos > 0, acertos, erros, tentativas: acertos + erros });
const progresso = (jogoSalvoId = A, grupos = [], estado = "disponivel") => ({ jogoSalvoId, tarefas: grupos, estrelasTotal: 18, comodos: [{ comodoId: Q, nome: "Quarto", estado }] });
const completar = (nivel) => IDS.map((id) => grupo(id, nivel));
function diferida() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function Link() {}
const arquivo = path.resolve(__dirname, "../src/components/Perfil.js");
const { code } = babel.transformSync(fs.readFileSync(arquivo, "utf8"), {
  filename: arquivo, babelrc: false, configFile: false,
  presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "automatic" }]],
  plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")],
});

function montar(opcoes = {}) {
  const estados = [], refs = [], efeitos = [], pendentes = [], chamadas = [], navegacoes = [], escritas = [];
  let indiceEstado, indiceRef, indiceEfeito, arvore;
  const router = { query: opcoes.query ?? {}, isReady: opcoes.ready ?? true, push: (rota) => navegacoes.push(rota) };
  const pendencias = opcoes.pendencias ?? new Map();
  const storage = new Map([["token", "sessao-simulada"], ...Object.entries(opcoes.storage ?? {})]);
  const contexto = {
    exports: {}, AbortController,
    sessionStorage: { getItem: k => pendencias.get(k) ?? null, setItem: (k,v) => pendencias.set(k,v), removeItem: k => pendencias.delete(k) },
    Date: opcoes.agora ? class extends Date { constructor(...args) { super(...(args.length ? args : [opcoes.agora])); } } : Date,
    localStorage: { getItem: (k) => { if (opcoes.storageIndisponivel) throw new Error("storage indispon?vel"); return storage.get(k) ?? null; }, removeItem: (k) => storage.delete(k) },
    console: { log() {}, error() {} },
    require(id) {
      if (id === "react") return {
        useRef(initial) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: initial }); },
        useState(initial) { const i = indiceEstado++; if (!(i in estados)) estados[i] = initial; return [estados[i], (v) => { escritas.push(i); estados[i] = typeof v === "function" ? v(estados[i]) : v; }]; },
        useEffect(fn, deps) { const i = indiceEfeito++, anterior = efeitos[i]; if (!anterior || deps.some((v, j) => !Object.is(v, anterior.deps[j]))) pendentes.push(() => { anterior?.cleanup?.(); efeitos[i] = { deps, cleanup: fn() }; }); },
      };
      if (id === "react/jsx-runtime") return require(id);
      if (id === "next/router") return { useRouter: () => router };
      if (id === "next/link") return { __esModule: true, default: Link };
      if (id === "lucide-react") return new Proxy({}, { get: () => function Icone() {} });
      if (id.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, k) => String(k) }) };
      if (id === "../services/api") return { __esModule: true, default: { get: async (url, config) => {
        chamadas.push({ url, config });
        if (opcoes.get) { const valor = await opcoes.get(url, config); if (valor !== undefined) return valor; }
        if (url.startsWith("/perfis-jogo/")) return { data: { _id: url.split("/").pop(), nomeAvatar: "Personagem", imagemAvatar: "/images/boneco.png", nivelAtual: 1 } };
        if (url === "/jogos-salvos") return { data: opcoes.partidas ?? [partida()] };
        if (url.endsWith("/progresso")) return { data: opcoes.progresso ? await opcoes.progresso(url, config) : progresso(url.split('/')[2]) };
        if (url === "/criancas/meu-perfil") return { data: { usuarioId: P, tempoUsadoHoje: 0, sessaoJogoEstado: "encerrada", sessaoJogoExpiraEm: null, permissaoAtiva: true } };
        if (url === "/usuarios/meu-perfil") return { data: { nome: "Criança" } };
        if (/^\/jogos-salvos\/[a-f0-9]{24}$/.test(url)) return { data: partida(url.split('/').pop()) };
        if (url.endsWith("/resumo-desempenho")) return { data: { resumo: { totalEstrelas: 25 }, desempenhoPorComodo: [{ comodoId: Q, tarefasConcluidas: 3 }, { comodoId: BAN, tarefasConcluidas: 1 }] } };
        if (opcoes.comodos && url === "/comodos") return { data: opcoes.comodos };
        if (opcoes.catalogos && url.startsWith("/comodos/") && url.endsWith("/tarefas")) return { data: opcoes.catalogos[url.split("/")[2]] };
        if (url === "/comodos") return { data: [{ _id: Q, nome: " Quarto ", ordem: 1, ativo: true }, { _id: BAN, nome: "Banheiro", ordem: 2, ativo: true }] };
        if (url === `/comodos/${Q}/tarefas`) return { data: opcoes.catalogo ?? tarefas };
        if (url === `/comodos/${BAN}/tarefas`) return { data: [{ _id: "banheiro-tarefa", ativo: true }] };
        throw new Error(`GET inesperado: ${url}`);
      }, patch: async (url, body, config) => {
        chamadas.push({ metodo: "PATCH", url, body, config });
        if (opcoes.patch) return opcoes.patch(url, body, config);
        if (url.startsWith('/jogos-salvos/')) return { status: 200, data: { ...partida(url.split('/').pop()), ...body } };
        return { status: 200, data: { _id: url.split('/').pop(), nivelAtual: 1, ...body } };
      } } };
      throw new Error(`Import inesperado: ${id}`);
    },
  };
  vm.runInNewContext(code, contexto, { filename: arquivo });
  function nos(n) { if (!arguments.length) n = arvore; if (Array.isArray(n)) return n.flatMap(nos); return n?.props ? [n, ...nos(n.props.children)] : []; }
  function texto(n) { if (!arguments.length) n = arvore; if (Array.isArray(n)) return n.map(texto).join(" "); return n?.props ? texto(n.props.children) : typeof n === "string" || typeof n === "number" ? String(n) : ""; }
  const t = {
    chamadas, navegacoes, escritas, nos, texto, storage, pendencias, router,
    render() { indiceEstado = indiceRef = indiceEfeito = 0; arvore = contexto.exports.default({}); while (pendentes.length) pendentes.shift()(); return t; },
    async carregar() { for (let i = 0; i < 5; i++) { await new Promise(setImmediate); t.render(); } return t; },
    selecionar(id) { router.query = { jogoSalvoId: id }; return t.render(); },
    indicadores() { const dl = nos().find((n) => n.type === "dl"); return dl ? nos(dl).filter((n) => n.type === "dd").map((n) => texto(n).trim()) : []; },
    leiturasProgresso() { return chamadas.filter((c) => c.url.endsWith("/progresso")); },
    desmontar() { efeitos.forEach((e) => e.cleanup?.()); },
  };
  return t.render();
}

const preferencia = (usuario = P) => `conectamente:ultima-partida:${usuario}`;
const selecionada = (t) => /Jornada: Partida A/.test(t.texto()) ? A : /Jornada: Partida B/.test(t.texto()) ? B : "";
const metrica = (t, nome) => t.texto(t.nos().find((n) => n.props["aria-label"] === nome));

for (const [caso, dados, esperado, hoje] of [
  ["hoje", { tempoUsadoHoje: 90, dataReferenciaTempo: "2026-11-02" }, /Tempo que você jogou hoje\./, true],
  ["zero real hoje", { tempoUsadoHoje: 0, dataReferenciaTempo: "2026-11-02" }, /0 s utilizados/, true],
  ["dia anterior", { tempoUsadoHoje: 90, dataReferenciaTempo: "2026-11-01" }, /Último tempo registrado em 01\/11\/2026/, false],
  ["data ausente", { tempoUsadoHoje: 90 }, /A data do tempo registrado está indisponível/, false],
  ["data inválida", { tempoUsadoHoje: 90, dataReferenciaTempo: "2026-02-30" }, /A data do tempo registrado está indisponível/, false],
  ["consumo ausente hoje", { dataReferenciaTempo: "2026-11-02" }, /Não foi possível consultar seu tempo de jogo/, false],
  ["consumo inválido hoje", { tempoUsadoHoje: -1, dataReferenciaTempo: "2026-11-02" }, /Consumo indisponível/, false],
]) test(`Perfil: explicação infantil do tempo — ${caso}`, async () => {
  const t = montar({ agora: "2026-11-02T12:00:00Z", get: async (url) => url === "/criancas/meu-perfil"
    ? { data: { usuarioId: P, limiteTempoDiario: 60, ...dados } } : undefined });
  await t.carregar(); assert.match(t.texto(), /Tempo durante o jogo/); assert.match(t.texto(), esperado);
  assert.equal(t.texto().includes("Tempo que você jogou hoje."), hoje);
  assert.match(t.texto(), /Limite diário:.*60 min/);
  assert.doesNotMatch(t.texto(), /Tempo de Uso|Referência:|medição em tempo real/);
  if (dados.tempoUsadoHoje === undefined || dados.tempoUsadoHoje < 0) assert.doesNotMatch(t.texto(), /0 s utilizados/);
  t.desmontar();
});

test("Perfil: escolher outra jornada mantém destino, preferência e semântica nativa do link", async () => {
  const t = montar({ storage: { [preferencia()]: A } }); await t.carregar(); const antes = [...t.storage];
  const link = t.nos().find((n) => n.type === Link && n.props.className === "botaoJornada");
  assert.ok(link); assert.equal(link.props.href, "/jogos-salvos");
  assert.equal(t.texto(link).trim(), "Escolher outra jornada");
  assert.equal(link.props.onClick, undefined, "navegação existente sem mutações de autenticação ou preferência");
  assert.equal(link.props.tabIndex, undefined, "mantém acesso por teclado do link nativo");
  assert.equal(t.nos(link).filter((n) => n.props["aria-hidden"] === "true").length, 2);
  assert.deepEqual([...t.storage], antes); t.desmontar();
});

test("Perfil: remove somente contagem e botão dos cartões, mantendo quatro imagens e doze indicadores", async () => {
  const t = montarJornada(); await t.carregar();
  assert.doesNotMatch(t.texto(), /Contagem de cômodos|cômodos concluídos nesta partida|Ver partidas do Quarto/);
  assert.equal(t.nos().filter((n) => n.type === "article").length, 4);
  assert.equal(t.nos().filter((n) => n.type === "dd").length, 12);
  assert.equal(concluidosVisiveis(t), 4);
  for (const nome of ["Quarto", "Banheiro", "Sala", "Cozinha"]) {
    assert.equal(t.nos(cartao(t, nome)).filter((n) => n.type === "img").length, 1);
    assert.equal(t.nos(cartao(t, nome)).some((n) => n.type === Link), false);
    assert.deepEqual(niveisCartao(t, nome), ["Concluído", "Concluído", "Concluído"]);
  }
  t.desmontar();
});

test("Perfil por rota: consulta explícita prevalece sobre a última jogada e não grava preferência nem inicia sessão", async () => {
  const t = montar({ query: { jogoSalvoId: B }, partidas: [partida(), partida(B)], storage: { [preferencia()]: A } });
  await t.carregar(); assert.equal(selecionada(t), B);
  assert.equal(t.storage.get(preferencia()), A);
  assert.equal(t.leiturasProgresso()[0].url, `/jogos-salvos/${B}/progresso`);
  assert.equal(t.nos().some((n) => n.type === "select"), false);
  assert.ok(t.nos().some((n) => n.type === Link && n.props.href === "/jogos-salvos" && t.texto(n).trim() === "Escolher outra jornada"));
  assert.equal(t.chamadas.some((c) => /sessao|heartbeat|responder/.test(c.url)), false); t.desmontar();
});

for (const id of [undefined, "", " ", "invalido", [A, B], IDS[0]]) test(`Perfil por rota: identificador inválido/não autorizado ${JSON.stringify(id)} não revela outra jornada`, async () => {
  const t = montar({ query: { jogoSalvoId: id }, partidas: [partida()], storage: { [preferencia()]: A } });
  await t.carregar(); assert.equal(selecionada(t), "");
  assert.match(t.texto(), /Partida inválida ou indisponível para esta conta/);
  assert.equal(t.leiturasProgresso().length, 0);
  assert.equal(t.chamadas.some((c) => c.url.startsWith("/perfis-jogo/")), false);
  assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  assert.equal(t.storage.get(preferencia()), A); t.desmontar();
});

test("Perfil por rota: aguarda router.isReady antes de consultar jornada/personagem", async () => {
  const t = montar({ ready: false, query: { jogoSalvoId: A } }); await t.carregar();
  assert.equal(t.leiturasProgresso().length, 0); assert.equal(t.chamadas.some((c) => c.url.startsWith("/perfis-jogo/")), false);
  t.router.isReady = true; t.render(); await t.carregar(); assert.equal(t.leiturasProgresso().length, 1); t.desmontar();
});

test("Perfil: personagem, nível e estrelas acompanham o PerfilJogo da jornada", async () => {
  const t = montar({ partidas: [partida(), { ...partida(B), perfilJogoId: IDS[0] }], query: { jogoSalvoId: A },
    get: async (url) => url.startsWith("/perfis-jogo/") ? { data: { _id: url.split('/').pop(),
      nomeAvatar: url.endsWith(P) ? "Menino da jornada A" : "Menina da jornada B", nivelAtual: url.endsWith(P) ? 2 : 4,
      imagemAvatar: url.endsWith(P) ? "/images/boneco.png" : "/images/menina1.png" } } : undefined,
    progresso: async (url) => ({ ...progresso(url.split('/')[2]), estrelasTotal: url.includes(A) ? 18 : 3 }),
  });
  await t.carregar(); assert.match(t.texto(), /Menino da jornada A/); assert.match(t.texto(), /Nível 2/);
  assert.equal(t.nos().find((n) => n.type === "img" && n.props.alt === "Personagem Menino da jornada A").props.src, "/images/boneco.png");
  t.selecionar(B); assert.doesNotMatch(t.texto(), /Menino da jornada A|18 estrelas/); await t.carregar();
  assert.match(t.texto(), /Menina da jornada B/); assert.match(t.texto(), /Nível 4/);
  assert.match(metrica(t, "Estrelas da partida consultada"), /3 estrelas/);
  assert.equal(t.nos().find((n) => n.type === "img" && n.props.alt === "Personagem Menina da jornada B").props.src, "/images/menina1.png");
  assert.doesNotMatch(t.texto(), /Clássico|Salvar Alterações|Próxima recompensa|Nível 12/); t.desmontar();
});

for (const tipo of ["sucesso", "401"]) test(`Perfil: personagem tardio ${tipo} não substitui a jornada atual`, async () => {
  const d = diferida();
  const t = montar({ partidas: [partida(), { ...partida(B), perfilJogoId: IDS[0] }], query: { jogoSalvoId: A },
    get: async (url) => url === `/perfis-jogo/${P}` ? d.promise : undefined });
  await t.carregar(); const signal = t.chamadas.find((c) => c.url === `/perfis-jogo/${P}`).config.signal;
  t.selecionar(B); await t.carregar(); assert.equal(signal.aborted, true);
  if (tipo === "401") d.reject({ response: { status: 401 } }); else d.resolve({ data: { _id: P, nomeAvatar: "Antigo", nivelAtual: 10, imagemAvatar: "/images/boneco.png" } });
  await t.carregar(); assert.doesNotMatch(t.texto(), /Antigo|Nível 10|Sessão expirada/); t.desmontar();
});

for (const caso of ["ausente", "outra identidade", "erro API"]) test(`Perfil: personagem ${caso} não usa boneco ou traje fictício`, async () => {
  const t = montar({ get: async (url) => {
    if (!url.startsWith("/perfis-jogo/")) return;
    if (caso === "erro API") throw new Error("rede");
    return { data: caso === "outra identidade" ? { _id: IDS[0], imagemAvatar: "/images/menina1.png" } : { _id: P } };
  } });
  await t.carregar(); assert.match(t.texto(), caso === "ausente" ? /Aparência indisponível/ : /Personagem indisponível/);
  assert.doesNotMatch(t.texto(), /Clássico|Nível 12/);
  assert.equal(t.nos().some((n) => n.type === "img" && n.props.src === "/images/boneco.png"), false);
  assert.equal(t.indicadores().length, 3); t.desmontar();
});

test("Perfil: Jogos Salvos e logout preservam rotas e limpeza de autenticação", async () => {
  const t = montar({ storage: { usuario: "usuario-simulado", [preferencia()]: A } }); await t.carregar();
  t.nos().find((n) => n.type === "button" && t.texto(n).trim() === "Jogos Salvos").props.onClick();
  assert.equal(t.navegacoes[0], "/jogos-salvos");
  t.nos().find((n) => n.type === "button" && t.texto(n).trim() === "Sair da Conta").props.onClick();
  assert.equal(t.navegacoes[1], "/"); assert.equal(t.storage.has("token"), false); assert.equal(t.storage.has("usuario"), false);
  assert.equal(t.storage.get(preferencia()), A); t.desmontar();
});

const salas = [
  { _id: Q, nome: "Quarto", ordem: 1, ativo: true },
  { _id: BAN, nome: "Banheiro", ordem: 2, ativo: true },
  { _id: "6aac3a3ea0d0e3c33530c5d4", nome: "Sala", ordem: 3, ativo: true },
  { _id: "6aac3a3ea0d0e3c33530c5d5", nome: "Cozinha", ordem: 4, ativo: true },
];
const catalogosCompletos = Object.fromEntries(salas.map((sala, i) => [sala._id,
  i === 0 ? tarefas : [{ _id: `tarefa-${i}`, comodoId: sala._id, ativo: true }]]));
const todosAcertos = salas.flatMap((sala) => niveis.flatMap((nivel) =>
  catalogosCompletos[sala._id].map((tarefa) => grupo(tarefa._id, nivel, 8, 4))));
const progressoJornada = (id = A, tarefas = todosAcertos) => ({ jogoSalvoId: id, estrelasTotal: 150,
  tarefas, comodos: salas.map((sala) => ({ comodoId: sala._id, estado: "disponivel" })) });
const montarJornada = (opcoes = {}) => montar({ comodos: [...salas].reverse(), catalogos: catalogosCompletos,
  progresso: async () => progressoJornada(), ...opcoes });
const cartao = (t, nome) => t.nos().find((n) => n.type === "article" && n.props["aria-label"] === `Cômodo ${nome}`);
const concluidosVisiveis = (t) => t.nos().filter((n) => n.props.className === "statusBadge concluido").length;
const niveisCartao = (t, nome) => t.nos(cartao(t, nome)).filter((n) => n.type === "dd").map((n) => t.texto(n).trim());

test("Jornada: quatro cartões na ordem real, quatro PNGs próprios e doze indicadores", async () => {
  const t = montarJornada(); await t.carregar();
  assert.deepEqual(t.nos().filter((n) => n.type === "article").map((n) => n.props["aria-label"]), salas.map((s) => `Cômodo ${s.nome}`));
  assert.match(t.texto(), /Minha Jornada/); assert.equal(t.nos().filter((n) => n.type === "dd").length, 12);
  for (const sala of salas) {
    const img = t.nos(cartao(t, sala.nome)).find((n) => n.type === "img");
    assert.equal(img.props.src, `/images/perfil/${sala.nome.toLowerCase()}.png`);
    assert.equal(img.props.alt, `Ilustração do ${sala.nome}`);
    assert.ok(fs.existsSync(path.join(__dirname, "../public", img.props.src)));
    assert.deepEqual(niveisCartao(t, sala.nome), ["Concluído", "Concluído", "Concluído"]);
  }
  assert.equal(concluidosVisiveis(t), 4);
  assert.equal(t.leiturasProgresso().length, 1, "uma consulta compartilhada pelos quatro cartões"); t.desmontar();
});

test("Jornada: erro da imagem mostra alternativa acessível sem afetar dados ou consultas", async () => {
  const t = montarJornada(); await t.carregar(); const antes = t.chamadas.length;
  t.nos(cartao(t, "Quarto")).find((n) => n.type === "img").props.onError(); t.render();
  assert.equal(t.nos(cartao(t, "Quarto")).some((n) => n.type === "img"), false);
  assert.ok(t.nos(cartao(t, "Quarto")).some((n) => n.props.role === "img" && /indisponível/.test(n.props["aria-label"])));
  assert.deepEqual(niveisCartao(t, "Quarto"), ["Concluído", "Concluído", "Concluído"]);
  assert.equal(t.chamadas.length, antes); t.desmontar();
});

test("Jornada: disponibilidade da interface é independente de conclusão e bloqueio", async () => {
  const dados = progressoJornada(); dados.comodos[2].estado = "bloqueado";
  const t = montarJornada({ progresso: async () => dados }); await t.carregar();
  assert.deepEqual(niveisCartao(t, "Sala"), ["Bloqueado", "Bloqueado", "Bloqueado"]);
  assert.deepEqual(niveisCartao(t, "Banheiro"), ["Concluído", "Concluído", "Concluído"]);
  for (const nome of ["Banheiro", "Sala", "Cozinha"]) {
    assert.match(t.texto(cartao(t, nome)), /Em desenvolvimento/);
    assert.equal(t.nos(cartao(t, nome)).some((n) => n.type === Link), false);
  }
  assert.doesNotMatch(t.texto(cartao(t, "Quarto")), /Em desenvolvimento/);
  assert.equal(concluidosVisiveis(t), 3); t.desmontar();
});

for (const caso of ["vazio", "inativo", "falha", "metadados ausentes"]) test(`Jornada: catálogo/progresso ${caso} não inventa estado nem contagem`, async () => {
  const t = montarJornada({ catalogos: { ...catalogosCompletos, [BAN]: caso === "inativo"
    ? catalogosCompletos[BAN].map((t) => ({ ...t, ativo: false })) : caso === "vazio" ? [] : catalogosCompletos[BAN] },
    get: async (url) => { if (caso === "falha" && url === `/comodos/${BAN}/tarefas`) throw new Error("rede"); },
    progresso: async () => { const dados = progressoJornada(); if (caso === "metadados ausentes") dados.comodos = dados.comodos.filter((c) => c.comodoId !== BAN); return dados; },
  });
  await t.carregar(); assert.deepEqual(niveisCartao(t, "Banheiro"), ["Indisponível", "Indisponível", "Indisponível"]);
  assert.deepEqual(niveisCartao(t, "Quarto"), ["Concluído", "Concluído", "Concluído"]);
  assert.doesNotMatch(t.texto(), /Contagem de cômodos|cômodos concluídos nesta partida/); t.desmontar();
});

test("Jornada: sem acertos e com erro inicia somente a dificuldade da partida consultada", async () => {
  const t = montarJornada({ progresso: async () => progressoJornada(A, [grupo("tarefa-1", "facil", 0, 1)]) }); await t.carregar();
  assert.deepEqual(niveisCartao(t, "Quarto"), ["Não iniciado", "Bloqueado", "Bloqueado"]);
  assert.deepEqual(niveisCartao(t, "Banheiro"), ["Em andamento", "Bloqueado", "Bloqueado"]);
  assert.equal(concluidosVisiveis(t), 0); t.desmontar();
});

test("Jornada: duas dificuldades completas ainda não concluem o cômodo, repetições não duplicam contagem", async () => {
  const dados = todosAcertos.filter((tarefa) => tarefa.tarefaId !== IDS[0] || tarefa.dificuldade !== "dificil");
  const t = montarJornada({ progresso: async () => progressoJornada(A, [...dados, grupo("tarefa-1", "facil", 100, 30)]) }); await t.carregar();
  assert.deepEqual(niveisCartao(t, "Quarto"), ["Concluído", "Concluído", "Em andamento"]);
  assert.equal(concluidosVisiveis(t), 3); t.desmontar();
});

test("Jornada: partidas diferentes não compartilham conclusão dos outros cômodos", async () => {
  const t = montarJornada({ partidas: [partida(), partida(B)], storage: { [preferencia()]: A },
    progresso: async (url) => progressoJornada(url.split('/')[2], url.includes(A) ? todosAcertos : []) });
  await t.carregar(); assert.equal(concluidosVisiveis(t), 4);
  t.selecionar(B); assert.doesNotMatch(t.texto(), /Contagem de cômodos|cômodos concluídos nesta partida/); await t.carregar();
  assert.equal(concluidosVisiveis(t), 0);
  for (const sala of salas) assert.deepEqual(niveisCartao(t, sala.nome), ["Não iniciado", "Bloqueado", "Bloqueado"]);
  t.desmontar();
});

test("Perfil: última partida autorizada prevalece sobre ordem da lista e mantém troca manual", async () => {
  const t = montar({ partidas: [partida(), partida(B)], storage: { [preferencia()]: B } });
  await t.carregar(); assert.equal(selecionada(t), B);
  assert.equal(t.leiturasProgresso()[0].url, `/jogos-salvos/${B}/progresso`);
  t.selecionar(A); await t.carregar(); assert.equal(selecionada(t), A);
  assert.equal(t.storage.get(preferencia()), B, "consultar outro progresso não substitui a última partida escolhida para jogar");
  t.desmontar();
});

for (const [nome, storage, lista, esperado] of [
  ["excluída com várias partidas", { [preferencia()]: IDS[0] }, [partida(), partida(B)], ""],
  ["não autorizada com uma partida", { [preferencia()]: B }, [partida()], A],
  ["de outro usuário", { [preferencia(IDS[0])]: B }, [partida(), partida(B)], ""],
  ["sem preferência e uma partida", {}, [partida()], A],
  ["sem preferência e várias partidas", {}, [partida(B), partida()], ""],
  ["sem partidas", { [preferencia()]: A }, [], ""],
]) test(`Perfil: preferência ${nome}`, async () => {
  const t = montar({ storage, partidas: lista }); await t.carregar(); assert.equal(selecionada(t), esperado);
  assert.equal(t.leiturasProgresso().length, esperado ? 1 : 0); t.desmontar();
});

test("Perfil: armazenamento indisponível não impede selecionar manualmente", async () => {
  const t = montar({ storageIndisponivel: true, partidas: [partida(), partida(B)] });
  await t.carregar(); assert.equal(selecionada(t), ""); t.selecionar(B); await t.carregar();
  assert.equal(selecionada(t), B); assert.equal(t.indicadores().length, 3); t.desmontar();
});

test("Perfil: identidade confirmada da API determina a preferência, não metadados de outra conta", async () => {
  const t = montar({ partidas: [partida(), partida(B)], storage: {
    usuario: JSON.stringify({ id: IDS[0] }), [preferencia(IDS[0])]: B, [preferencia()]: A,
  } });
  await t.carregar(); assert.equal(selecionada(t), A); t.desmontar();
});

test("Perfil: estrelas persistidas acompanham a jornada sem consultar resumo geral", async () => {
  const t = montar({ partidas: [partida(), partida(B)], progresso: async (url) => ({
    ...progresso(url.split('/')[2]), estrelasTotal: url.includes(A) ? 51 : 7,
  }) });
  await t.carregar(); assert.match(metrica(t, "Estrelas da partida consultada"), /Escolha uma jornada/);
  t.selecionar(A); await t.carregar();
  assert.equal(t.chamadas.some((c) => c.url.endsWith("/resumo-desempenho")), false, "Perfil não mistura o resumo geral com a jornada");
  assert.match(metrica(t, "Estrelas da partida consultada"), /51 estrelas$/);
  t.selecionar(B); assert.doesNotMatch(metrica(t, "Estrelas da partida consultada"), /51/); await t.carregar();
  assert.match(metrica(t, "Estrelas da partida consultada"), /7 estrelas$/);
  assert.equal(t.chamadas.some((c) => c.url.endsWith("/resumo-desempenho")), false, "Perfil não mistura o resumo geral com a jornada"); t.desmontar();
});

test("Perfil: total tardio de outra partida não substitui estrelas da seleção atual", async () => {
  const antiga = diferida();
  const t = montar({ partidas: [partida(), partida(B)], progresso: async (url) => url.includes(A)
    ? antiga.promise : { ...progresso(B), estrelasTotal: 8 } });
  await t.carregar(); t.selecionar(A); await t.carregar(); t.selecionar(B); await t.carregar();
  antiga.resolve({ ...progresso(A), estrelasTotal: 999 }); await t.carregar();
  assert.match(metrica(t, "Estrelas da partida consultada"), /8 estrelas$/); t.desmontar();
});

for (const valor of [undefined, null, -1, "18", NaN]) test(`Perfil: total de estrelas inválido (${String(valor)}) é indisponível`, async () => {
  const t = montar({ progresso: async () => ({ ...progresso(), estrelasTotal: valor }),
    get: async (url) => url.endsWith("/resumo-desempenho") ? { data: { resumo: { totalEstrelas: valor } } } : undefined });
  await t.carregar(); assert.doesNotMatch(t.texto(), /Estrelas gerais da criança/);
  assert.match(metrica(t, "Estrelas da partida consultada"), /Indisponíveis$/);
  assert.equal(t.indicadores().length, 3, "pontuação ausente não muda cálculo de conclusão"); t.desmontar();
});

test("Perfil: falha de progresso não exibe total antigo ou zero confirmado", async () => {
  const t = montar({ progresso: async () => { throw new Error("rede"); } }); await t.carregar();
  assert.equal(t.chamadas.some((c) => c.url.endsWith("/resumo-desempenho")), false, "Perfil não mistura o resumo geral com a jornada");
  assert.match(metrica(t, "Estrelas da partida consultada"), /Indisponíveis$/); t.desmontar();
});

for (const [nome, crianca, esperado] of [
  ["segundos fracionários", { tempoUsadoHoje: 7546.408, limiteTempoDiario: 180, dataReferenciaTempo: "2026-11-02" }, /2 h 5 min 46 s utilizados/],
  ["zero confirmado", { tempoUsadoHoje: 0, limiteTempoDiario: null }, /0 s utilizados/],
  ["menos de um minuto", { tempoUsadoHoje: 59.9 }, /59 s utilizados/],
  ["ausente", {}, /Consumo indisponível/],
  ["null", { tempoUsadoHoje: null }, /Consumo indisponível/],
  ["tipo inválido", { tempoUsadoHoje: "60" }, /Consumo indisponível/],
]) test(`Perfil: tempo ${nome}`, async () => {
  const t = montar({ agora: "2026-11-02T12:00:00Z", get: async (url) => url === "/criancas/meu-perfil"
    ? { data: { usuarioId: P, ...crianca } } : undefined });
  await t.carregar(); assert.match(t.texto(), esperado);
  if (crianca.limiteTempoDiario === 180) assert.match(t.texto(), /180 min/);
  else assert.match(t.texto(), crianca.limiteTempoDiario === null ? /Sem limite definido/ : /Indisponível/);
  t.desmontar();
});

for (const [referencia, agora, esperado] of [
  ["2026-11-01", "2026-11-02T12:00:00Z", /Último tempo registrado em 01\/11\/2026/],
  ["2026-11-01", "2026-11-02T01:00:00Z", /Tempo que você jogou hoje\./],
  [undefined, "2026-11-02T12:00:00Z", /A data do tempo registrado está indisponível/],
  ["2026-02-30", "2026-11-02T12:00:00Z", /A data do tempo registrado está indisponível/],
]) test(`Perfil: data de referência ${referencia} em ${agora}`, async () => {
  const t = montar({ agora, get: async (url) => url === "/criancas/meu-perfil"
    ? { data: { usuarioId: P, tempoUsadoHoje: 7546.408, dataReferenciaTempo: referencia } } : undefined });
  await t.carregar(); assert.match(t.texto(), esperado);
  assert.match(t.texto(), /2 h 5 min 46 s utilizados/, "preserva consumo da referência, não fabrica zero para hoje"); t.desmontar();
});

test("Perfil: zeros reais de estrelas são apresentados como confirmados", async () => {
  const t = montar({ progresso: async () => ({ ...progresso(), estrelasTotal: 0 }),
    get: async (url) => url.endsWith("/resumo-desempenho") ? { data: { resumo: { totalEstrelas: 0 } } } : undefined });
  await t.carregar(); assert.doesNotMatch(t.texto(), /Estrelas gerais da criança/);
  assert.match(metrica(t, "Estrelas da partida consultada"), /0 estrelas$/); t.desmontar();
});

for (const [nome, grupos, esperado] of [
  ["fácil não iniciado", [], ["Não iniciado", "Bloqueado", "Bloqueado"]],
  ["erro já inicia fácil", [grupo(IDS[0], "facil", 0, 1)], ["Em andamento", "Bloqueado", "Bloqueado"]],
  ["fácil parcial", [grupo(IDS[0], "facil")], ["Em andamento", "Bloqueado", "Bloqueado"]],
  ["fácil concluído libera médio", completar("facil"), ["Concluído", "Não iniciado", "Bloqueado"]],
  ["médio iniciado por erro", [...completar("facil"), grupo(IDS[0], "medio", 0, 2)], ["Concluído", "Em andamento", "Bloqueado"]],
  ["médio concluído libera difícil", [...completar("facil"), ...completar("medio")], ["Concluído", "Concluído", "Não iniciado"]],
  ["difícil parcial", [...completar("facil"), ...completar("medio"), grupo(IDS[1], "dificil")], ["Concluído", "Concluído", "Em andamento"]],
  ["todas concluídas", niveis.flatMap(completar), ["Concluído", "Concluído", "Concluído"]],
]) test(`Perfil: ${nome}`, async () => {
  const t = montar({ progresso: async () => progresso(A, grupos, grupos.length === 9 ? "concluido" : "disponivel") });
  await t.carregar(); assert.deepEqual(t.indicadores(), esperado);
  assert.equal(selecionada(t), A, "uma única partida é identificada automaticamente");
  assert.equal(t.leiturasProgresso().length, 1);
  assert.equal(t.chamadas.filter((c) => c.url === `/comodos/${Q}/tarefas`).length, 1, "reaproveita catálogo existente");
  const dl = t.nos().find((n) => n.type === "dl");
  assert.deepEqual(t.nos(dl).filter((n) => n.type === "dt").map((n) => t.texto(n.props.children[0])), ["Fácil", "Médio", "Difícil"]);
  t.desmontar();
});

test("Perfil: conclusão considera todas as tarefas ativas, não três IDs fixos", async () => {
  const extra = { _id: "6aac3c29bee9f041e4728a92", comodoId: Q, ativo: true, ordem: 4 };
  const t = montar({ catalogo: [...tarefas, extra], progresso: async () => progresso(A, completar("facil")) });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Em andamento", "Bloqueado", "Bloqueado"]); t.desmontar();
});

test("Perfil: ignora tarefa inativa e tentativas de outro cômodo", async () => {
  const t = montar({ catalogo: [...tarefas, { _id: "inativa", comodoId: Q, ativo: false }],
    progresso: async () => progresso(A, [...completar("facil"), grupo("inativa", "medio"), grupo("outra-tarefa", "medio")]) });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Concluído", "Não iniciado", "Bloqueado"]); t.desmontar();
});

test("Perfil: acertos repetidos e erros posteriores preservam conclusão, sem duplicar tarefas", async () => {
  const grupos = niveis.flatMap((nivel) => IDS.map((id) => grupo(id, nivel, 7, 3)));
  const t = montar({ progresso: async () => progresso(A, [...grupos, grupo(IDS[0], "facil", 10, 5)], "concluido") });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Concluído", "Concluído", "Concluído"]); t.desmontar();
});

test("Perfil: repetições da mesma tarefa não concluem as demais", async () => {
  const t = montar({ progresso: async () => progresso(A, [grupo(IDS[0], "facil", 100), grupo(IDS[0], "facil", 200)]) });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Em andamento", "Bloqueado", "Bloqueado"]); t.desmontar();
});

test("Perfil: cômodo bloqueado pelo backend bloqueia as três dificuldades", async () => {
  const t = montar({ progresso: async () => progresso(A, [], "bloqueado") });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Bloqueado", "Bloqueado", "Bloqueado"]); t.desmontar();
});

test("Perfil: várias partidas exigem escolha e não usam dificuldade atual nem resumo geral como conclusão", async () => {
  const t = montar({ partidas: [partida(), partida(B)] }); await t.carregar();
  assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]); assert.equal(t.leiturasProgresso().length, 0);
  assert.match(t.texto(), /Escolha uma partida em Jogos Salvos para ver/);
  t.selecionar(A); await t.carregar();
  assert.deepEqual(t.indicadores(), ["Não iniciado", "Bloqueado", "Bloqueado"], "save está no difícil e resumo geral mostra acertos, mas este save está vazio");
  assert.ok(t.nos().some((n) => n.type === Link && n.props.href === "/jogos-salvos" && n.props.className === "botaoJornada"));
  const banho = t.nos().find((n) => n.type === "article" && n.props["aria-label"] === "Cômodo Banheiro");
  assert.match(t.texto(banho), /Banheiro/);
  assert.equal(t.nos(banho).filter((n) => n.type === "dd").length, 3);
  assert.doesNotMatch(t.texto(banho), /Concluído/, "resumo histórico geral não conclui outra partida");
  t.desmontar();
});

test("Perfil: partidas do mesmo personagem mantêm progressos separados", async () => {
  const t = montar({ partidas: [partida(), partida(B)], progresso: async (url) => url.includes(A) ? progresso(A, niveis.flatMap(completar), "concluido") : progresso(B) });
  await t.carregar(); t.selecionar(A); await t.carregar();
  assert.deepEqual(t.indicadores(), ["Concluído", "Concluído", "Concluído"]);
  t.selecionar(B); assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]); await t.carregar();
  assert.deepEqual(t.indicadores(), ["Não iniciado", "Bloqueado", "Bloqueado"]);
  t.selecionar(""); await t.carregar(); assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  t.desmontar();
});

for (const tipo of ["sucesso", "401"]) test(`Perfil: resposta obsoleta ${tipo} é abortada e não substitui outra partida`, async () => {
  const antiga = diferida();
  const t = montar({ partidas: [partida(), partida(B)], progresso: async (url) => url.includes(A) ? antiga.promise : progresso(B) });
  await t.carregar(); t.selecionar(A); await t.carregar();
  const signal = t.leiturasProgresso()[0].config.signal;
  t.selecionar(B); await t.carregar(); assert.equal(signal.aborted, true);
  if (tipo === "401") antiga.reject({ response: { status: 401 } }); else antiga.resolve(progresso(A, niveis.flatMap(completar), "concluido"));
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Não iniciado", "Bloqueado", "Bloqueado"]);
  assert.doesNotMatch(t.texto(), /Sessão expirada/); t.desmontar();
});

test("Perfil: A → vazio → A aguarda nova consulta sem reapresentar resultado antigo", async () => {
  let consultas = 0; const nova = diferida();
  const t = montar({ progresso: async () => ++consultas === 1 ? progresso(A, completar("facil")) : nova.promise });
  await t.carregar(); t.selecionar(""); await t.carregar(); t.selecionar(A);
  assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]); await t.carregar(); assert.match(t.texto(), /Carregando progresso/);
  nova.resolve(progresso(A)); await t.carregar(); assert.deepEqual(t.indicadores(), ["Não iniciado", "Bloqueado", "Bloqueado"]);
  t.desmontar();
});

for (const status of [null, 401, 403, 404]) test(`Perfil: falha de progresso ${status ?? "rede"} não é progresso zerado`, async () => {
  const t = montar({ progresso: async () => { throw status ? { response: { status } } : new Error("rede"); } });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  assert.match(t.texto(), status === 401 ? /Sessão expirada/ : /Progresso da partida indisponível|Catálogo ativo ou progresso deste cômodo indisponível/);
  assert.ok(t.nos().some((n) => n.props.role === "alert")); t.desmontar();
});

for (const [nome, opcoes] of [
  ["partida diferente", { progresso: async () => progresso(B) }],
  ["sem metadados de cômodo", { progresso: async () => ({ jogoSalvoId: A, tarefas: [] }) }],
  ["contagens inválidas", { progresso: async () => progresso(A, [{ ...grupo(IDS[0], "facil"), tentativas: 20 }]) }],
  ["catálogo vazio", { catalogo: [] }],
  ["catálogo sem ativo", { catalogo: tarefas.map(({ ativo, ...item }) => item) }],
  ["catálogo de outro cômodo", { catalogo: tarefas.map((item) => ({ ...item, comodoId: BAN })) }],
]) test(`Perfil: dados inválidos (${nome}) deixam indicadores indisponíveis`, async () => {
  const t = montar(opcoes); await t.carregar(); assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  assert.match(t.texto(), /Progresso da partida indisponível|Catálogo ativo ou progresso deste cômodo indisponível/); t.desmontar();
});

test("Perfil: falha do catálogo não se converte em zero tarefas concluídas", async () => {
  const t = montar({ get: async (url) => { if (url === `/comodos/${Q}/tarefas`) throw new Error("rede"); } });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  assert.match(t.texto(), /Progresso da partida indisponível|Catálogo ativo ou progresso deste cômodo indisponível/); assert.equal(t.leiturasProgresso().length, 1); t.desmontar();
});

test("Perfil: nenhuma partida não faz consulta de progresso nem inventa indicadores", async () => {
  const t = montar({ partidas: [] }); await t.carregar();
  assert.match(t.texto(), /Você ainda não possui partidas salvas/);
  assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]); assert.equal(t.leiturasProgresso().length, 0); t.desmontar();
});

for (const dados of [null, [{ ...partida(), _id: "invalido" }], [{ ...partida(), perfilJogoId: null }]]) test("Perfil: lista de partidas inválida fica indisponível", async () => {
  const t = montar({ get: async (url) => url === "/jogos-salvos" ? { data: dados } : undefined });
  await t.carregar(); assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  assert.match(t.texto(), /Não foi possível consultar as partidas/); assert.equal(t.leiturasProgresso().length, 0); t.desmontar();
});

test("Perfil: falha 401 na lista de partidas oferece orientação sem consultar progresso", async () => {
  const t = montar({ get: async (url) => { if (url === "/jogos-salvos") throw { response: { status: 401 } }; } });
  await t.carregar(); assert.match(t.texto(), /Sessão expirada/);
  assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]); assert.equal(t.leiturasProgresso().length, 0); t.desmontar();
});

test("Perfil: carregamento de progresso é explícito e desmontagem impede escrita tardia", async () => {
  const pendente = diferida(); const t = montar({ progresso: async () => pendente.promise });
  await t.carregar(); assert.match(t.texto(), /Carregando progresso/);
  assert.deepEqual(t.indicadores(), ["Indisponível", "Indisponível", "Indisponível"]);
  const signal = t.leiturasProgresso()[0].config.signal; t.desmontar(); const escritas = t.escritas.length;
  assert.equal(signal.aborted, true);
  pendente.resolve(progresso(A, niveis.flatMap(completar), "concluido")); await t.carregar();
  assert.equal(t.escritas.length, escritas);
  assert.equal(t.navegacoes.length, 0);
});


const edicao = t => t.nos().find(n => n.type === "dialog");
function abrirEditor(t) { t.nos().find(n => n.type === "button" && t.texto(n) === "Editar").props.onClick(); t.render(); }
function nomeEditor(t, nome) { t.nos().find(n => n.props.id === "nome-personagem").props.onChange({ target: { value: nome } }); t.render(); }
function avatarEditor(t, imagem) { t.nos().find(n => n.type === "input" && n.props.value === imagem).props.onChange(); t.render(); }
function salvarEditor(t) { return t.nos(edicao(t)).find(n => n.type === "form").props.onSubmit({ preventDefault() {} }); }
const patches = t => t.chamadas.filter(c => c.metodo === "PATCH");

test("editar personagem: nome da criança permanece independente e quatro avatares reais estão disponíveis", async () => {
  const t = await montar().carregar();
  assert.match(metrica(t, "Meu Perfil"), /Criança.*Personagem:\s+Personagem/);
  abrirEditor(t);
  assert.match(t.texto(edicao(t)), /todas as jornadas deste personagem/);
  const radios = t.nos(edicao(t)).filter(n => n.props.type === "radio");
  assert.equal(radios.length, 4);
  for (const radio of radios) assert.ok(fs.existsSync(path.resolve(__dirname, '../public', radio.props.value.slice(1))));
  nomeEditor(t, "  Luna  "); avatarEditor(t, "/images/menina1.png");
  assert.match(metrica(t, "Meu Perfil"), /Personagem:\s+Personagem/);
  await salvarEditor(t); await t.carregar();
  assert.equal(edicao(t), undefined);
  assert.equal(patches(t).length, 1);
  assert.equal(patches(t)[0].url, `/perfis-jogo/${P}`);
  assert.deepEqual({ ...patches(t)[0].body }, { nomeAvatar: "Luna", imagemAvatar: "/images/menina1.png" });
  assert.match(metrica(t, "Meu Perfil"), /Criança.*Personagem:\s+Luna/);
  assert.match(metrica(t, "Meu Personagem"), /Luna/);
  assert.equal(t.nos().find(n => n.props.alt === "Personagem Luna").props.src, "/images/menina1.png");
  assert.ok(t.chamadas.every(c => !c.metodo || c.metodo === "PATCH"));
  assert.match(metrica(t, "Estrelas da partida consultada"), /18 estrelas/);
  t.desmontar();
});

for (const imagem of ["/images/boneco.png", "/images/boneco2.png", "/images/menina1.png", "/images/menina2.png"]) test(`editar personagem: persiste e restaura ${imagem}`, async () => {
  let persistido = { _id: P, nomeAvatar: "Original", imagemAvatar: "/images/boneco.png", nivelAtual: 2 };
  const opcoes = { get: async url => url === `/perfis-jogo/${P}` ? { data: persistido } : undefined,
    patch: async (url, body) => { persistido = { ...persistido, ...body }; return { status: 200, data: persistido }; } };
  const t = await montar(opcoes).carregar(); abrirEditor(t); nomeEditor(t,"Novo nome"); avatarEditor(t,imagem);
  await salvarEditor(t); await t.carregar(); t.desmontar();
  const retomada = await montar(opcoes).carregar();
  assert.match(metrica(retomada,"Meu Perfil"), /Criança.*Personagem:\s+Novo nome/);
  assert.equal(retomada.nos().find(n => n.props.alt === "Personagem Novo nome").props.src,imagem);
  retomada.desmontar();
});

test("editar personagem: validação e cancelamento não chamam PATCH", async () => {
  const t = await montar().carregar(); abrirEditor(t); nomeEditor(t,"   "); await salvarEditor(t); t.render();
  assert.match(t.texto(edicao(t)), /Escreva o nome/); assert.equal(patches(t).length, 0);
  nomeEditor(t,"Corrigido");
  t.nos(edicao(t)).find(n => n.type === "button" && t.texto(n)==="Cancelar").props.onClick();t.render();
  assert.equal(edicao(t),undefined);assert.match(metrica(t,"Meu Perfil"),/Personagem:\s+Personagem/);t.desmontar();
});

test("editar personagem: trava imediata evita dois PATCHs, mantém loading e bloqueia cancelar durante envio", async () => {
  const d=diferida(),t=await montar({patch:()=>d.promise}).carregar();abrirEditor(t);nomeEditor(t,"Luna");
  const handler=t.nos(edicao(t)).find(n=>n.type==="form").props.onSubmit;
  const primeiro=handler({preventDefault(){}});await handler({preventDefault(){}});t.render();
  assert.equal(patches(t).length,1);assert.match(t.texto(),/Salvando personagem/);
  assert.equal(t.nos(edicao(t)).find(n=>n.props.type==="submit").props.disabled,true);
  let prevenido=false;edicao(t).props.onCancel({preventDefault(){prevenido=true;}});assert.equal(prevenido,true);
  d.resolve({status:200,data:{_id:P,nomeAvatar:"Luna",imagemAvatar:"/images/boneco.png",nivelAtual:1}});await primeiro;await t.carregar();
  assert.equal(edicao(t),undefined);t.desmontar();
});

for (const [nome,resultado] of [
  ...[400,401,403,404,409,500].map(status=>[`HTTP ${status}`,()=>Promise.reject({response:{status}})]),
  ["rede",()=>Promise.reject(new Error("rede"))], ["timeout",()=>Promise.reject({code:"ECONNABORTED"})],
  ["resposta inválida",async()=>({status:200,data:{_id:P,nomeAvatar:"Outro",imagemAvatar:"/images/boneco.png"}})],
  ["ID divergente",async()=>({status:200,data:{_id:B,nomeAvatar:"Luna",imagemAvatar:"/images/boneco.png"}})],
  ["HTTP 201",async()=>({status:201,data:{_id:P,nomeAvatar:"Luna",imagemAvatar:"/images/boneco.png"}})],
]) test(`editar personagem: ${nome} preserva dados anteriores e não anuncia sucesso`,async()=>{
  const t=await montar({patch:resultado}).carregar();abrirEditor(t);nomeEditor(t,"Luna");await salvarEditor(t);await t.carregar();
  assert.ok(edicao(t));assert.ok(t.nos(edicao(t)).find(n=>n.props.role==="alert"));
  assert.match(metrica(t,"Meu Perfil"),/Personagem:\s+Personagem/);assert.equal(patches(t).length,1);t.desmontar();
});

for (const tipo of ["partida","desmontagem","autenticação"]) test(`editar personagem: resposta tardia por ${tipo} não mistura dados`,async()=>{
  const d=diferida(),outro="6aac3c29bee9f041e4728a83";
  const t=await montar({partidas:[partida(A),{...partida(B),perfilJogoId:outro}],query:{jogoSalvoId:A},patch:()=>d.promise}).carregar();
  abrirEditor(t);nomeEditor(t,"Luna");const envio=salvarEditor(t);t.render();
  if(tipo==="partida"){t.selecionar(B);await t.carregar();assert.equal(patches(t)[0].config.signal.aborted,true);}
  else if(tipo==="desmontagem")t.desmontar();else t.storage.set("token","outra-sessao");
  const escritas=t.escritas.length;
  d.resolve({status:200,data:{_id:P,nomeAvatar:"Luna",imagemAvatar:"/images/boneco.png"}});await envio;
  assert.equal(t.escritas.length,escritas,"resultado obsoleto não atualiza estado");
  if(tipo==="partida"){assert.equal(edicao(t),undefined);assert.doesNotMatch(metrica(t,"Meu Perfil"),/Luna/);}
  t.desmontar();
});

for (const opcoes of [{partidas:[]},{query:{jogoSalvoId:B}}, {get:async url=>url.startsWith('/perfis-jogo/')?Promise.reject({response:{status:404}}):undefined}]) test("editar personagem: sem jornada autorizada e personagem confirmado não abre editor",async()=>{
  const t=await montar(opcoes).carregar();
  const botao=t.nos().find(n=>n.type==="button"&&t.texto(n)==="Editar");assert.equal(botao.props.disabled,true);
  botao.props.onClick();t.render();assert.equal(edicao(t),undefined);assert.equal(patches(t).length,0);t.desmontar();
});


test("editar personagem: api.js real envia Bearer e somente nomeAvatar/imagemAvatar no PATCH HTTP local",async(teste)=>{
  const http=require('node:http'),{once}=require('node:events');let recebido;
  const servidor=http.createServer(async(req,res)=>{
    let texto='';for await(const parte of req)texto+=parte;
    recebido={metodo:req.method,url:req.url,autenticado:req.headers.authorization==='Bearer sessao-simulada',body:JSON.parse(texto)};
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify({_id:P,nivelAtual:1,...recebido.body}));
  });
  servidor.listen(0,'127.0.0.1');await once(servidor,'listening');teste.after(()=>new Promise(resolve=>servidor.close(resolve)));
  const arquivoApi=path.resolve(__dirname,'../src/services/api.js');
  const {code}=babel.transformSync(fs.readFileSync(arquivoApi,'utf8'),{filename:arquivoApi,babelrc:false,configFile:false,plugins:[require('next/dist/compiled/babel/plugin-transform-modules-commonjs')]});
  const storage={getItem:()=>"sessao-simulada"};const contexto={exports:{},require,localStorage:storage,window:{localStorage:storage},process:{env:{NEXT_PUBLIC_API_URL:`http://127.0.0.1:${servidor.address().port}`}}};
  vm.runInNewContext(code,contexto);
  const t=await montar({patch:(url,body,config)=>contexto.exports.default.patch(url,body,config)}).carregar();
  abrirEditor(t);nomeEditor(t,'Luna');avatarEditor(t,'/images/menina2.png');await salvarEditor(t);await t.carregar();
  assert.deepEqual(recebido,{metodo:'PATCH',url:`/perfis-jogo/${P}`,autenticado:true,body:{nomeAvatar:'Luna',imagemAvatar:'/images/menina2.png'}});
  assert.match(metrica(t,'Meu Perfil'),/Criança.*Luna/);assert.equal(edicao(t),undefined);t.desmontar();
});


const jogoNivel = (t, nivel) => t.nos().find(n => n.props["aria-label"] === `Jogar Quarto no nível ${{facil:"Fácil",medio:"Médio",dificil:"Difícil"}[nivel]}`);
const gruposTodos = niveis.flatMap(completar);
const opcoesLiberadas = { progresso: async url => progresso(url.split('/')[2], gruposTodos, "concluido") };
const patchJogos = t => patches(t).filter(c => c.url.startsWith('/jogos-salvos/'));

for (const [grupos,esperado] of [[[],[false,true,true]],[completar('facil'),[false,false,true]],[gruposTodos,[false,false,false]]]) {
  test("Jogar: desbloqueios usam catálogo e acertos históricos, mesmo com dificuldade atual difícil",async()=>{
    const t=await montar({progresso:async()=>progresso(A,grupos)}).carregar();
    assert.deepEqual(niveis.map(nivel=>jogoNivel(t,nivel).props.disabled),esperado);
    assert.equal(t.nos().filter(n=>n.type==='button'&&/^Jogar Quarto/.test(n.props['aria-label']??'')).length,3);
    for(const nome of ['Banheiro'])assert.equal(t.nos().filter(n=>n.props['aria-label']?.startsWith(`Jogar ${nome}`)).length,0);
    assert.equal(patchJogos(t).length,0);t.desmontar();
  });
}
for (const dificuldade of niveis) test(`Jogar: seleciona ${dificuldade} após concluir difícil, com payload exato e sem apagar progresso`,async()=>{
  const d=diferida(),t=await montar({...opcoesLiberadas,patch:()=>d.promise}).carregar();
  const antes=t.indicadores(),estrelas=metrica(t,'Estrelas da partida consultada');
  const envio=jogoNivel(t,dificuldade).props.onClick();await t.carregar();
  assert.equal(t.navegacoes.length,0);
  assert.equal(patchJogos(t).length,1);
  const body={dificuldade,comodoId:Q,tarefaId:IDS[0]};
  assert.deepEqual({...patchJogos(t)[0].body},body);assert.equal(patchJogos(t)[0].url,`/jogos-salvos/${A}`);
  assert.ok(niveis.every(n=>jogoNivel(t,n).props.disabled));
  d.resolve({status:200,data:{...partida(),...body}});await envio;await t.carregar();
  assert.equal(t.navegacoes.length,1);assert.deepEqual({...t.navegacoes[0].query},{jogoSalvoId:A});assert.equal(t.navegacoes[0].pathname,'/jogo/quarto');
  assert.deepEqual(t.indicadores(),antes);assert.equal(metrica(t,'Estrelas da partida consultada'),estrelas);
  assert.ok(t.chamadas.every(c=>!c.url.includes('/sessao')&&!c.url.includes('/historico-jogo')));
  assert.equal(t.pendencias.size,0);t.desmontar();
});

test("Jogar: dificuldade bloqueada também é rejeitada pelo handler com progresso atualizado",async()=>{
  const t=await montar().carregar();assert.equal(jogoNivel(t,'medio').props.disabled,true);
  await jogoNivel(t,'medio').props.onClick();await t.carregar();
  assert.equal(patchJogos(t).length,0);assert.equal(t.navegacoes.length,0);assert.match(t.texto(),/ainda está bloqueada/);t.desmontar();
});

test("Jogar: consulta atualizada revoga liberação aparente e não usa apenas o estado visual",async()=>{
  let leituras=0;
  const t=await montar({progresso:async()=>progresso(A,++leituras===1?gruposTodos:[])}).carregar();
  assert.equal(jogoNivel(t,'dificil').props.disabled,false);
  await jogoNivel(t,'dificil').props.onClick();await t.carregar();
  assert.equal(patchJogos(t).length,0);assert.equal(t.navegacoes.length,0);t.desmontar();
});

test("Jogar: primeira tarefa vem da ordem ativa do catálogo, não da posição do array",async()=>{
  const catalogo=[{...tarefas[2],ativo:false,ordem:0},{...tarefas[1],ordem:5},{...tarefas[0],ordem:2}];
  const t=await montar({...opcoesLiberadas,catalogo}).carregar();await jogoNivel(t,'facil').props.onClick();await t.carregar();
  assert.equal(patchJogos(t)[0].body.tarefaId,IDS[0]);t.desmontar();
});

test("Jogar: consulta confirmada já na combinação correta navega sem PATCH desnecessário",async()=>{
  const t=await montar({get:async url=>url===`/jogos-salvos/${A}`?{data:{...partida(),dificuldade:'facil',comodoId:Q,tarefaId:IDS[0]}}:undefined}).carregar();
  await jogoNivel(t,'facil').props.onClick();await t.carregar();assert.equal(patchJogos(t).length,0);assert.equal(t.navegacoes.length,1);t.desmontar();
});

for(const estado of ['ativa','ativa de outra partida','ativa com data inválida'])test(`Jogar: sessão ${estado} impede PATCH, navegação e nova sessão`,async()=>{
  const t=await montar({...opcoesLiberadas,get:async url=>url==='/criancas/meu-perfil'?{data:{usuarioId:P,sessaoJogoEstado:'ativa',sessaoJogoSalvoId:estado.includes('outra')?B:A,sessaoJogoExpiraEm:estado.includes('inválida')?'inválida':new Date(Date.now()+60000).toISOString()}}:undefined}).carregar();
  await jogoNivel(t,'facil').props.onClick();await t.carregar();assert.equal(patchJogos(t).length,0);assert.equal(t.navegacoes.length,0);assert.match(t.texto(),/partida em andamento/);t.desmontar();
});

test("Jogar: sessão expirada permite o fluxo normal e não é encerrada pelo Perfil",async()=>{
  const t=await montar({...opcoesLiberadas,get:async url=>url==='/criancas/meu-perfil'?{data:{usuarioId:P,sessaoJogoEstado:'ativa',sessaoJogoExpiraEm:'2000-01-01T00:00:00Z'}}:undefined}).carregar();
  await jogoNivel(t,'facil').props.onClick();await t.carregar();assert.equal(patchJogos(t).length,1);assert.equal(t.navegacoes.length,1);assert.ok(t.chamadas.every(c=>!c.url.includes('/sessao')));t.desmontar();
});

test("Jogar: dois cliques e dificuldades concorrentes geram somente um PATCH e uma navegação",async()=>{
  const d=diferida(),t=await montar({...opcoesLiberadas,patch:()=>d.promise}).carregar();
  const enviar=jogoNivel(t,'facil').props.onClick,primeiro=enviar();await enviar();await jogoNivel(t,'medio').props.onClick();await t.carregar();
  assert.equal(patchJogos(t).length,1);
  d.resolve({status:200,data:{...partida(),dificuldade:'facil',comodoId:Q,tarefaId:IDS[0]}});await primeiro;await t.carregar();
  assert.equal(t.navegacoes.length,1);await enviar();assert.equal(patchJogos(t).length,1);t.desmontar();
});

for(const status of [400,401,403,404,409])test(`Jogar: PATCH ${status} não navega nem anuncia seleção confirmada`,async()=>{
  const t=await montar({...opcoesLiberadas,patch:async()=>{throw{response:{status}};}}).carregar();
  await jogoNivel(t,'facil').props.onClick();await t.carregar();
  assert.equal(t.navegacoes.length,0);assert.equal(patchJogos(t).length,1);assert.equal(t.pendencias.size,0);assert.match(metrica(t,'Estrelas da partida consultada'),/18 estrelas/);t.desmontar();
});

for(const [nome,patch] of [['rede',async()=>{throw new Error('rede');}],['timeout',async()=>{throw{code:'ECONNABORTED'};}],['500',async()=>{throw{response:{status:500}};}],['resposta inválida',async()=>({status:200,data:{_id:A}})]])test(`Jogar: ${nome} mantém seleção incerta sem reenvio automático, inclusive ao reabrir`,async()=>{
  const pendencias=new Map(),opcoes={...opcoesLiberadas,pendencias,patch};
  const t=await montar(opcoes).carregar();await jogoNivel(t,'facil').props.onClick();await t.carregar();
  assert.equal(pendencias.size,1);assert.equal(t.navegacoes.length,0);assert.match(t.texto(),/pode ter sido registrada/);assert.ok(niveis.every(n=>jogoNivel(t,n).props.disabled));
  await jogoNivel(t,'medio').props.onClick();await t.carregar();assert.equal(patchJogos(t).length,1);
  t.desmontar();const retomada=await montar(opcoes).carregar();await jogoNivel(retomada,'medio').props.onClick();await retomada.carregar();
  assert.equal(patchJogos(retomada).length,0);assert.equal(retomada.navegacoes.length,0);assert.equal(pendencias.size,1);retomada.desmontar();
});

test("Jogar: conferir resultado incerto usa somente GET e navega após confirmar a seleção persistida",async()=>{
  let selecionada=false;
  const t=await montar({...opcoesLiberadas,get:async url=>url===`/jogos-salvos/${A}`&&selecionada?{data:{...partida(),dificuldade:'facil',comodoId:Q,tarefaId:IDS[0]}}:undefined,
    patch:async()=>{selecionada=true;throw new Error('rede');}}).carregar();
  await jogoNivel(t,'facil').props.onClick();await t.carregar();
  await t.nos().find(n=>n.type==='button'&&t.texto(n)==='Conferir seleção').props.onClick();await t.carregar();
  assert.equal(patchJogos(t).length,1);assert.equal(t.navegacoes.length,1);assert.equal(t.pendencias.size,0);t.desmontar();
});

test("Jogar: conferir sem gravação confirmada não libera navegação nem repete PATCH",async()=>{
  const t=await montar({...opcoesLiberadas,patch:async()=>{throw new Error('rede');}}).carregar();await jogoNivel(t,'facil').props.onClick();await t.carregar();
  await t.nos().find(n=>n.type==='button'&&t.texto(n)==='Conferir seleção').props.onClick();await t.carregar();
  assert.equal(patchJogos(t).length,1);assert.equal(t.navegacoes.length,0);assert.equal(t.pendencias.size,1);t.desmontar();
});

for(const tipo of ['partida','desmontagem','autenticação'])test(`Jogar: resposta tardia após ${tipo} não navega nem altera outra jornada`,async()=>{
  const d=diferida(),t=await montar({...opcoesLiberadas,query:{jogoSalvoId:A},partidas:[partida(A),partida(B)],patch:()=>d.promise}).carregar();
  const envio=jogoNivel(t,'facil').props.onClick();await t.carregar();
  if(tipo==='partida'){t.selecionar(B);await t.carregar();}else if(tipo==='desmontagem')t.desmontar();else t.storage.set('token','outra-sessao');
  const escritas=t.escritas.length;
  d.resolve({status:200,data:{...partida(),dificuldade:'facil',comodoId:Q,tarefaId:IDS[0]}});await envio;
  assert.equal(t.navegacoes.length,0);assert.equal(t.escritas.length,escritas);assert.equal(patchJogos(t)[0].url,`/jogos-salvos/${A}`);assert.equal(t.pendencias.size,1);t.desmontar();
});
