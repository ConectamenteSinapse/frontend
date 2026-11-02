const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const babel = require("next/dist/compiled/babel/core");
const presetReact = require("next/dist/compiled/babel/preset-react");
const commonjs = require("next/dist/compiled/babel/plugin-transform-modules-commonjs");

// Mesmo mecanismo da infraestrutura existente: JSX real compilado em memória,
// hooks/router/storage controlados. Não é DOM, navegador, StrictMode ou E2E.
function montar(nome, responder, dadosIniciais = {}, apiReal) {
  const armazenamento = dadosIniciais instanceof Map ? dadosIniciais : new Map(Object.entries(dadosIniciais));
  const localStorage = {
    getItem: (k) => armazenamento.get(k) ?? null,
    setItem: (k, v) => armazenamento.set(k, String(v)),
    removeItem: (k) => armazenamento.delete(k),
  };
  const chamadas = [], navegacoes = [], logs = [], estados = [], refs = [], efeitos = [], pendentes = [], escritas = [];
  let indice = 0, indiceRef = 0, indiceEfeito = 0, arvore;
  const api = apiReal ?? { post: async (url, body, config) => {
    chamadas.push({ url, body, token: localStorage.getItem("token"), config });
    return responder(url, body, chamadas.length, config);
  }};
  const arquivo = path.resolve(__dirname, "../src/components", nome + ".js");
  const { code } = babel.transformSync(readFileSync(arquivo, "utf8"), {
    filename: arquivo, babelrc: false, configFile: false,
    presets: [[presetReact, { runtime: "automatic" }]], plugins: [commonjs],
  });
  const contexto = {
    exports: {}, localStorage, AbortController, window: { localStorage, location: { href: "" } },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    require(id) {
      if (id === "react") return { useState(inicial) {
        const i = indice++;
        if (!(i in estados)) estados[i] = inicial;
        return [estados[i], (valor) => { escritas.push(i); estados[i] = typeof valor === "function" ? valor(estados[i]) : valor; }];
      },
        useRef(inicial) { const i = indiceRef++; return refs[i] ?? (refs[i] = { current: inicial }); },
        useEffect(fn, deps) { const i = indiceEfeito++, anterior = efeitos[i]; if (!anterior || deps.some((v, j) => !Object.is(v, anterior.deps[j]))) pendentes.push(() => { anterior?.cleanup?.(); efeitos[i] = { deps, cleanup: fn() }; }); },
      };
      if (id === "react/jsx-runtime") return require(id);
      if (id === "next/router") return { useRouter: () => ({ push: (destino) => navegacoes.push(destino) }) };
      if (id === "next/link") return { __esModule: true, default: () => null };
      if (id === "next/head") return { __esModule: true, default: () => null };
      if (id === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (id.endsWith(".module.css")) return { __esModule: true, default: {} };
      if (id === "../services/api") return { __esModule: true, default: api };
      throw new Error("Import inesperado: " + id);
    },
  };
  vm.runInNewContext(code, contexto, { filename: arquivo });
  function elementos(node = arvore) {
    if (Array.isArray(node)) return node.flatMap(elementos);
    if (!node || !node.props) return [];
    return [node, ...(node.props.children === undefined ? [] : elementos(node.props.children))];
  }
  const tela = {
    chamadas, navegacoes, logs, armazenamento, localStorage, escritas, window: contexto.window,
    renderizar() { indice = indiceRef = indiceEfeito = 0; arvore = contexto.exports.default(); while (pendentes.length) pendentes.shift()(); return tela; },
    desmontar() { efeitos.forEach((e) => e.cleanup?.()); },
    elementos,
    campo(id, valor) {
      const no = elementos().find((n) => n.type === "input" && (n.props.id === id || n.props.name === id));
      assert.ok(no, "Campo ausente: " + id);
      no.props.onChange({ target: { name: id, value: valor } });
      tela.renderizar();
      return tela;
    },
    enviar() { return elementos().find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }); },
    erro() { tela.renderizar(); return elementos().find((n) => n.props.role === "alert")?.props.children; },
    botao() { return elementos().find((n) => n.type === "button" && n.props.type === "submit"); },
    apiCompilada(baseURL) {
      const codigo = babel.transformSync(readFileSync(path.resolve(__dirname, "../src/services/api.js"), "utf8"), {
        babelrc: false, configFile: false, plugins: [commonjs],
      }).code;
      const ctx = { exports: {}, require, localStorage, window: {}, process: { env: { NEXT_PUBLIC_API_URL: baseURL } } };
      vm.runInNewContext(codigo, ctx);
      return ctx.exports.default;
    },
  };
  return tela.renderizar();
}
const usuario = { id: "usuario-ficticio", nome: "Teste", email: "teste@example.invalid", perfil: "responsavel" };
const sucesso = () => ({ data: { token: "jwt-ficticio", usuario } });
function preencherLogin(tela) { return tela.campo("email", usuario.email).campo("senha", "senha fictícia"); }
function selecionarTipoCadastro(tela, perfil) {
  const rotulo = perfil === "crianca" ? "criança" : "responsável";
  const botao = tela.elementos().find((n) => n.type === "button" &&
    [n.props.children].flat().some((item) => typeof item === "string" && item.trim() === rotulo));
  assert.ok(botao, "Seletor de tipo de conta ausente: " + perfil);
  botao.props.onClick();
  return tela.renderizar();
}
function cadastroPreenchido(perfil, responder = sucesso, iniciais = {}, apiReal) {
  const tela = montar("Cadastro", responder, iniciais, apiReal);
  selecionarTipoCadastro(tela, perfil);
  for (const [campo, valor] of [["nome", "Teste"], ["email", perfil + "@example.invalid"],
    ["senha", "senha fictícia"], ["confirmarSenha", "senha fictícia"]]) tela.campo(campo, valor);
  return tela;
}

for (const perfil of ["responsavel", "crianca"]) test(`login ${perfil}: endpoint, storage e redirecionamento`, async () => {
  const tela = preencherLogin(montar("Login", () => ({ data: { token: "jwt-ficticio", usuario: { ...usuario, perfil } } })));
  await tela.enviar();
  assert.equal(tela.chamadas[0].url, "/usuarios/auth");
  assert.equal(tela.chamadas[0].body.email, usuario.email);
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.equal(JSON.parse(tela.armazenamento.get("usuario")).perfil, perfil);
  assert.deepEqual(tela.navegacoes, [perfil === "crianca" ? "/menu" : "/responsavel"]);
});
for (const nome of ["Login", "Cadastro"]) test(`${nome}: campos HTML obrigatórios, email e senha mascarada sem minLength definido`, () => {
  const tela = montar(nome, sucesso);
  const campos = tela.elementos().filter((n) => n.type === "input");
  assert.ok(campos.every((n) => n.props.required));
  assert.ok(campos.some((n) => n.props.type === "email"));
  assert.ok(campos.some((n) => n.props.type === "password"));
  assert.ok(campos.every((n) => n.props.minLength === undefined));
});
for (const [nome, erro, mensagem] of [
  ["401", { response: { data: { mensagem: "Email ou senha inválidos" } } }, "Email ou senha inválidos"],
  ["500 sem mensagem", { response: { data: {} } }, "Não foi possível realizar o login."],
  ["rede", new Error("offline fictício"), "Não foi possível conectar ao servidor. Verifique se a API está funcionando."],
]) test(`login: erro ${nome} exibido, sem navegar ou gravar token`, async () => {
  const tela = preencherLogin(montar("Login", () => { throw erro; }));
  await tela.enviar();
  assert.equal(tela.erro(), mensagem);
  assert.equal(tela.armazenamento.size, 0);
  assert.deepEqual(tela.navegacoes, []);
  assert.equal(tela.botao().props.disabled, false);
});
test("login: carregamento desabilita botão enquanto promessa está pendente", async () => {
  let resolver;
  const tela = preencherLogin(montar("Login", () => new Promise((r) => { resolver = r; })));
  const pendente = tela.enviar(); tela.renderizar();
  assert.equal(tela.botao().props.disabled, true);
  resolver(sucesso()); await pendente; tela.renderizar();
  assert.equal(tela.botao().props.disabled, false);
});
test("caracterização: handler de login não bloqueia segunda chamada direta pendente", async () => {
  const resolver = [];
  const tela = preencherLogin(montar("Login", () => new Promise((r) => resolver.push(r))));
  const a = tela.enviar(); tela.renderizar(); const b = tela.enviar();
  assert.equal(tela.chamadas.length, 2);
  resolver.forEach((r) => r(sucesso())); await Promise.all([a, b]);
});
test("perfil de login desconhecido é salvo antes de apresentar erro", async () => {
  const tela = preencherLogin(montar("Login", () => ({ data: { token: "jwt-ficticio", usuario: { ...usuario, perfil: "invalido" } } })));
  await tela.enviar();
  assert.equal(tela.erro(), "Perfil de usuário não reconhecido.");
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.deepEqual(tela.navegacoes, []);
});
for (const perfil of ["responsavel", "crianca"]) {
  test("cadastro " + perfil + ": confirmação divergente não chama API", async () => {
    const tela = cadastroPreenchido(perfil);
    tela.campo("confirmarSenha", "outra senha fictícia");
    await tela.enviar();
    assert.equal(tela.erro(), "As senhas não coincidem.");
    assert.equal(tela.chamadas.length, 0);
    assert.deepEqual(tela.navegacoes, []);
    assert.equal(tela.armazenamento.size, 0);
    assert.equal(tela.botao().props.disabled, false);
    tela.campo("confirmarSenha", "senha fictícia");
    await tela.enviar();
    assert.equal(tela.chamadas.length, 3, "corrigir a validação permite o primeiro cadastro");
    assert.deepEqual(tela.navegacoes, ["/"]);
  });

  test("cadastro " + perfil + ": três chamadas, payloads e token temporário", async () => {
    const token = "jwt-temporario-" + perfil + "-ficticio";
    const tela = cadastroPreenchido(perfil, (url) => url === "/usuarios/auth"
      ? { data: { token } } : { data: { _id: "registro-ficticio" } });
    assert.equal(tela.chamadas.length, 0, "selecionar e preencher não cadastra automaticamente");
    assert.deepEqual(tela.elementos().filter((n) => n.type === "input").map((n) => n.props.name),
      ["nome", "email", "senha", "confirmarSenha"]);
    await tela.enviar();
    assert.deepEqual(tela.chamadas.map((c) => c.url), ["/usuarios", "/usuarios/auth", perfil === "responsavel" ? "/responsaveis" : "/criancas"]);
    assert.deepEqual(tela.chamadas.map((c) => ({ ...c.body })), [
      { nome: "Teste", email: perfil + "@example.invalid", senha: "senha fictícia", perfil },
      { email: perfil + "@example.invalid", senha: "senha fictícia" }, {},
    ]);
    assert.deepEqual(tela.chamadas.map((c) => c.token), [null, null, token]);
    assert.ok(tela.chamadas.every((c) => c.config.timeout === 10_000 && !c.config.signal.aborted));
    assert.equal(tela.armazenamento.has("token"), false);
    assert.equal(tela.armazenamento.has("usuario"), false);
    assert.deepEqual(tela.navegacoes, ["/"]);
    assert.equal(tela.erro(), undefined);
    assert.equal(tela.botao().props.disabled, false);
    assert.deepEqual(tela.logs, []);
  });

  for (let etapa = 1; etapa <= 3; etapa++) test("cadastro " + perfil + ": falha na etapa " + etapa + " interrompe fluxo e remove token", async () => {
    const usuarioAnterior = JSON.stringify({ perfil: "crianca" });
    const token = "jwt-temporario-" + perfil + "-ficticio";
    const tela = cadastroPreenchido(perfil, (_url, _body, n) => {
      if (n === etapa) throw { response: { status: etapa === 1 ? 400 : 500, data: { mensagem: "Falha fictícia na etapa" } } };
      return { data: { token } };
    }, { token: "token-anterior-ficticio", usuario: usuarioAnterior });
    await tela.enviar();
    assert.deepEqual(tela.chamadas.map((c) => c.url), ["/usuarios", "/usuarios/auth", perfil === "responsavel" ? "/responsaveis" : "/criancas"].slice(0, etapa));
    assert.ok(tela.erro().startsWith("Falha fictícia na etapa"));
    if (etapa > 1) assert.match(tela.erro(), /A conta pode ter sido criada/);
    assert.deepEqual(tela.navegacoes, []);
    assert.equal(tela.botao().props.disabled, etapa > 1);
    assert.equal(tela.armazenamento.has("token"), false);
    assert.deepEqual(tela.chamadas.map((c) => c.token), ["token-anterior-ficticio", "token-anterior-ficticio", token].slice(0, etapa));
    assert.equal(tela.armazenamento.get("usuario"), usuarioAnterior, "Cadastro não remove usuario preexistente");
    tela.campo("email", "corrigido@example.invalid");
    await tela.enviar();
    assert.equal(tela.chamadas.length, etapa === 1 ? 4 : etapa, "somente rejeição antes da criação permite nova sequência explícita");
  });

  for (const [nome, erro, mensagem] of [
    ["rede", new Error("offline fictício"), "Não foi possível concluir o cadastro."],
    ["500 vazio", { response: { status: 500, data: {} } }, "Não foi possível concluir o cadastro."],
    ["erro textual", { response: { status: 400, data: { erro: "Falha textual fictícia" } } }, "Falha textual fictícia"],
    ["mensagem não textual", { response: { status: 400, data: { mensagem: { detalhe: "fictício" } } } }, "Não foi possível concluir o cadastro."],
  ]) test("cadastro " + perfil + ": erro " + nome + " apresenta mensagem e limpa token", async () => {
    const tela = cadastroPreenchido(perfil, () => { throw erro; });
    await tela.enviar();
    const incerto = erro.response?.status !== 400;
    if (incerto) {
      assert.ok(tela.erro().startsWith(mensagem));
      assert.match(tela.erro(), /Não envie novamente/);
      assert.doesNotMatch(tela.erro(), /tente novamente/);
    } else assert.equal(tela.erro(), mensagem);
    assert.equal(tela.chamadas.length, 1);
    assert.equal(tela.armazenamento.has("token"), false);
    assert.equal(tela.botao().props.disabled, incerto);
    assert.deepEqual(tela.navegacoes, []);
  });
}

test("cadastro: trocar tipo de conta preserva campos e cadastra somente o tipo escolhido", async () => {
  const tela = cadastroPreenchido("crianca");
  selecionarTipoCadastro(tela, "responsavel");
  assert.equal(tela.chamadas.length, 0);
  await tela.enviar();
  assert.deepEqual(tela.chamadas.map((c) => c.url), ["/usuarios", "/usuarios/auth", "/responsaveis"]);
  assert.deepEqual({ ...tela.chamadas[0].body }, { nome: "Teste", email: "crianca@example.invalid", senha: "senha fictícia", perfil: "responsavel" });
  assert.deepEqual(tela.navegacoes, ["/"]);
});

test("integração HTTP real: Login + api.js/Axios + Router/Controller/Service + bcrypt/JWT; banco simulado", async (t) => {
  const [{ default: express }, { default: Usuario }, { default: routes }, { default: bcrypt }] = await Promise.all([
    import("../../backend/node_modules/express/index.js"), import("../../backend/models/usuarioModel.js"),
    import("../../backend/routes/usuarioRoutes.js"), import("../../backend/node_modules/bcrypt/bcrypt.js"),
  ]);
  const anterior = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "segredo-ficticio-integracao-http";
  t.after(() => { if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
  const doc = new Usuario({ nome: "HTTP fictício", email: usuario.email, perfil: "responsavel", senha: await bcrypt.hash("senha fictícia", 12) });
  t.mock.method(Usuario, "findOne", async ({ email }) => email === doc.email ? doc : null);
  t.mock.method(Usuario, "findById", (id) => ({ select: async (projecao) => {
    assert.equal(projecao, "-senha"); assert.equal(String(id), String(doc._id));
    const dados = doc.toObject(); delete dados.senha; return dados;
  }}));
  const app = express(); app.use(express.json()); app.use("/usuarios", routes);
  const servidor = app.listen(0, "127.0.0.1"); await once(servidor, "listening");
  t.after(() => new Promise((r) => servidor.close(r)));
  const storage = montar("Login", sucesso);
  const api = storage.apiCompilada(`http://127.0.0.1:${servidor.address().port}`);
  // O mesmo storage é fornecido ao componente e ao interceptor REAL.
  const tela = preencherLogin(montar("Login", sucesso, storage.armazenamento, api));
  await tela.enviar();
  assert.equal(tela.erro(), undefined);
  assert.deepEqual(tela.navegacoes, ["/responsavel"]);
  assert.equal(JSON.parse(tela.armazenamento.get("usuario")).id, String(doc._id));
  const perfil = await api.get("/usuarios/meu-perfil");
  assert.equal(perfil.status, 200);
  assert.equal(perfil.data.senha, undefined);
  const substituido = await api.get("/usuarios/meu-perfil", { headers: { Authorization: "Bearer prompt-ficticio-invalido" } });
  assert.equal(substituido.status, 200, "interceptor substitui token explícito pelo localStorage");
  tela.campo("senha", "incorreta fictícia"); await tela.enviar();
  assert.equal(tela.erro(), "Email ou senha inválidos");
});

test("responsável: sessão protege painel e logout remove token/usuário", () => {
  const { montarRelatorio } = require("./helpers/relatorio.cjs");
  const semSessao = montarRelatorio({ pagina: "responsavel", token: null });
  assert.equal(semSessao.renderizar(), "");
  semSessao.executarEfeitos();
  assert.deepEqual(semSessao.substituicoes, ["/"]);
  const tela = montarRelatorio({ pagina: "responsavel", token: "jwt-ficticio", usuario: JSON.stringify(usuario) });
  tela.renderizar(); tela.executarEfeitos();
  assert.match(tela.renderizar(), /PERFIL DO RESPONSÁVEL/);
  const localizar = (no) => {
    if (Array.isArray(no)) return no.flatMap(localizar);
    if (!no?.props) return [];
    return [no, ...localizar(no.props.children)];
  };
  localizar(tela.arvore).find((n) => n.type === "button" && n.props.children === "SAIR DA CONTA").props.onClick();
  assert.equal(tela.armazenamento.has("token"), false);
  assert.equal(tela.armazenamento.has("usuario"), false);
  assert.equal(tela.navegacoesJanela[0].destino, "/");
});

for (const perfil of ["responsavel", "crianca"]) {
  test("cadastro " + perfil + ": loading desabilita botão até concluir as três chamadas", async () => {
    let liberar;
    const tela = cadastroPreenchido(perfil, (url) => url === "/usuarios"
      ? new Promise((resolve) => { liberar = resolve; }) : sucesso());
    const envio = tela.enviar(); tela.renderizar();
    assert.equal(tela.botao().props.disabled, true);
    assert.deepEqual(tela.chamadas.map((c) => c.url), ["/usuarios"]);
    assert.deepEqual(tela.navegacoes, []);
    liberar({ data: {} }); await envio; tela.renderizar();
    assert.equal(tela.botao().props.disabled, false);
    assert.equal(tela.chamadas.length, 3);
    assert.equal(tela.armazenamento.has("token"), false);
    assert.deepEqual(tela.navegacoes, ["/"]);
  });

  test("cadastro " + perfil + ": trava imediata impede dois envios antes do próximo render", async () => {
    const resolvers = [];
    const tela = cadastroPreenchido(perfil, (url) => url === "/usuarios"
      ? new Promise((resolve) => resolvers.push(resolve)) : sucesso());
    const a = tela.enviar();
    const b = tela.enviar();
    const chamadasPendentes = tela.chamadas.length;
    tela.renderizar();
    assert.equal(tela.botao().props.disabled, true);
    const c = tela.enviar();
    assert.equal(tela.chamadas.length, 1, "novo handler após render também respeita a trava");
    assert.ok(tela.chamadas.every((c) => c.url === "/usuarios"));
    resolvers.forEach((resolve) => resolve({ data: {} }));
    await Promise.all([a, b, c]); tela.renderizar();
    assert.equal(chamadasPendentes, 1);
    assert.deepEqual(tela.chamadas.map((c) => c.url), ["/usuarios", "/usuarios/auth", perfil === "responsavel" ? "/responsaveis" : "/criancas"]);
    assert.deepEqual(tela.navegacoes, ["/"]);
    assert.equal(tela.armazenamento.has("token"), false);
    assert.equal(tela.botao().props.disabled, false);
    await tela.enviar();
    assert.equal(tela.chamadas.length, 3, "cadastro confirmado não reinicia enquanto a navegação está pendente");
  });

  test("cadastro " + perfil + ": 409 apresenta mensagem backend sem redirecionar", async () => {
    let primeira = true;
    const tela = cadastroPreenchido(perfil, () => {
      if (primeira) { primeira = false; throw { response: { status: 409, data: { erro: true, mensagem: "Email já cadastrado" } } }; }
      return sucesso();
    });
    await tela.enviar();
    assert.equal(tela.erro(), "Email já cadastrado");
    assert.equal(tela.chamadas.length, 1);
    assert.deepEqual(tela.navegacoes, []);
    assert.equal(tela.armazenamento.has("token"), false);
    assert.equal(tela.botao().props.disabled, false);
    tela.campo("email", "outra-conta@example.invalid");
    await tela.enviar();
    assert.equal(tela.chamadas.length, 4, "nova conta somente após ação explícita corrigindo email rejeitado");
    assert.deepEqual(tela.navegacoes, ["/"]);
  });

  for (let etapa = 1; etapa <= 3; etapa++) {
    for (const tipo of ["rede", "timeout"]) test("cadastro " + perfil + ": " + tipo + " na etapa " + etapa + " mantém reenvio bloqueado", async () => {
      const tela = cadastroPreenchido(perfil, (_url, _body, n) => {
        if (n === etapa) throw tipo === "rede" ? new Error("rede fictícia") : { code: "ECONNABORTED" };
        return sucesso();
      });
      await tela.enviar(); tela.renderizar();
      assert.equal(tela.chamadas.length, etapa);
      assert.equal(tela.botao().props.disabled, true);
      assert.match(tela.erro(), /A conta pode ter sido criada/);
      assert.match(tela.erro(), /Não envie novamente/);
      assert.doesNotMatch(tela.erro(), /tente novamente/);
      assert.equal(tela.armazenamento.has("token"), false);
      assert.deepEqual(tela.navegacoes, []);
      await new Promise(setImmediate);
      assert.equal(tela.chamadas.length, etapa, "não reenvia automaticamente");
      const mensagem = tela.erro();
      tela.campo("email", "alterado@example.invalid");
      selecionarTipoCadastro(tela, perfil === "crianca" ? "responsavel" : "crianca");
      assert.equal(tela.erro(), mensagem, "editar não apaga orientação de criação incerta");
      await tela.enviar(); await tela.enviar();
      assert.equal(tela.chamadas.length, etapa, "editar e chamar handler não repetem uma criação incerta");
    });

    for (const tipo of ["sucesso", "401"]) test("cadastro " + perfil + ": desmontagem na etapa " + etapa + " ignora " + tipo + " tardio", async () => {
      let resolver, rejeitar;
      const pendente = new Promise((r, j) => { resolver = r; rejeitar = j; });
      const tela = cadastroPreenchido(perfil, (_url, _body, n) => n === etapa ? pendente : sucesso());
      const envio = tela.enviar(); await new Promise(setImmediate); tela.renderizar();
      assert.equal(tela.chamadas.length, etapa);
      const signal = tela.chamadas.at(-1).config.signal;
      tela.desmontar();
      assert.equal(signal.aborted, true);
      assert.equal(tela.armazenamento.has("token"), false, "token temporário próprio é removido ao sair");
      tela.localStorage.setItem("token", "outra-sessao-ficticia");
      const escritas = tela.escritas.length, logs = tela.logs.length;
      if (tipo === "sucesso") resolver(sucesso()); else rejeitar({ response: { status: 401 } });
      await envio; await tela.enviar();
      assert.equal(tela.chamadas.length, etapa, "não continua a cadeia nem executa callback antigo");
      assert.deepEqual(tela.navegacoes, []);
      assert.equal(tela.armazenamento.get("token"), "outra-sessao-ficticia");
      assert.equal(tela.escritas.length, escritas, "não atualiza estado depois de desmontar");
      assert.equal(tela.logs.length, logs, "catch antigo não produz efeitos");
    });
  }

  for (const [etapa, status] of [[2, 401], [3, 400], [3, 409]]) test("cadastro " + perfil + ": HTTP " + status + " após criar usuário não libera a cadeia inteira", async () => {
    const tela = cadastroPreenchido(perfil, (_url, _body, n) => {
      if (n === etapa) throw { response: { status, data: { mensagem: "Falha posterior à criação" } } };
      return sucesso();
    });
    await tela.enviar(); tela.renderizar();
    assert.match(tela.erro(), /Falha posterior à criação/);
    assert.match(tela.erro(), /A conta pode ter sido criada/);
    assert.equal(tela.botao().props.disabled, true);
    assert.equal(tela.armazenamento.has("token"), false);
    await tela.enviar(); assert.equal(tela.chamadas.length, etapa);
    assert.deepEqual(tela.navegacoes, []);
  });

  test("cadastro " + perfil + ": desmontagem não remove token de uma sessão substituta", async () => {
    let resolver;
    const pendente = new Promise((r) => { resolver = r; });
    const tela = cadastroPreenchido(perfil, (_url, _body, n) => n === 3 ? pendente : sucesso());
    const envio = tela.enviar(); await new Promise(setImmediate);
    assert.equal(tela.chamadas.length, 3);
    assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
    tela.localStorage.setItem("token", "sessao-substituta-ficticia");
    tela.desmontar();
    assert.equal(tela.armazenamento.get("token"), "sessao-substituta-ficticia");
    resolver(sucesso()); await envio;
    assert.equal(tela.armazenamento.get("token"), "sessao-substituta-ficticia");
    assert.deepEqual(tela.navegacoes, []);
  });

  test("integração HTTP local de Cadastro " + perfil + ": três requests e JWT temporário; Models em memória", async (t) => {
    const [{ default: express }, { default: Usuario }, { default: Responsavel }, { default: Crianca },
      { default: usuarios }, { default: responsaveis }, { default: criancas }, { default: jwt }, { default: bcrypt }] = await Promise.all([
      import("../../backend/node_modules/express/index.js"), import("../../backend/models/usuarioModel.js"),
      import("../../backend/models/responsavelModel.js"), import("../../backend/models/criancaModel.js"),
      import("../../backend/routes/usuarioRoutes.js"), import("../../backend/routes/responsavelRoutes.js"),
      import("../../backend/routes/criancaRoutes.js"), import("../../backend/node_modules/jsonwebtoken/index.js"),
      import("../../backend/node_modules/bcrypt/bcrypt.js"),
    ]);
    const anterior = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "segredo-ficticio-cadastro-http";
    t.after(() => { if (anterior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = anterior; });
    const contas = [], perfisResp = [], perfisCrianca = [];
    for (const [Model, dados] of [[Usuario, contas], [Responsavel, perfisResp], [Crianca, perfisCrianca]]) {
      t.mock.method(Model, "create", async (body) => {
        const doc = new Model(body); await doc.validate(); dados.push(doc); return doc;
      });
      t.mock.method(Model, "findOne", async (filtro) => dados.find((doc) =>
        Object.entries(filtro).every(([k, v]) => String(doc[k]) === String(v))) ?? null);
    }
    t.mock.method(Usuario, "findById", async (id) => contas.find((u) => String(u._id) === String(id)) ?? null);
    const requests = [];
    let tokenEmitido;
    const app = express(); app.use(express.json());
    app.use((req, res, next) => {
      requests.push({ url: req.url, metodo: req.method, body: req.body, authorization: req.headers.authorization });
      if (req.url === "/usuarios/auth") {
        const json = res.json;
        res.json = function (body) { tokenEmitido = body?.token; return json.call(this, body); };
      }
      next();
    });
    app.use("/usuarios", usuarios); app.use("/responsaveis", responsaveis); app.use("/criancas", criancas);
    const servidor = app.listen(0, "127.0.0.1"); await once(servidor, "listening");
    t.after(() => new Promise((resolve) => servidor.close(resolve)));
    const storage = montar("Cadastro", sucesso);
    const api = storage.apiCompilada("http://127.0.0.1:" + servidor.address().port);
    const tela = cadastroPreenchido(perfil, sucesso, storage.armazenamento, api);
    const primeiro = tela.enviar(), duplicado = tela.enviar();
    await Promise.all([primeiro, duplicado]);
    assert.equal(tela.erro(), undefined);
    assert.deepEqual(requests.map((r) => [r.metodo, r.url]), [
      ["POST", "/usuarios"], ["POST", "/usuarios/auth"], ["POST", perfil === "responsavel" ? "/responsaveis" : "/criancas"],
    ]);
    assert.deepEqual(requests.map((r) => r.body), [
      { nome: "Teste", email: perfil + "@example.invalid", senha: "senha fictícia", perfil },
      { email: perfil + "@example.invalid", senha: "senha fictícia" }, {},
    ]);
    assert.equal(requests[0].authorization, undefined);
    assert.equal(requests[1].authorization, undefined);
    assert.equal(typeof tokenEmitido, "string");
    assert.equal(requests[2].authorization, "Bearer " + tokenEmitido);
    assert.equal(contas.length, 1);
    const identidade = jwt.verify(tokenEmitido, process.env.JWT_SECRET);
    assert.equal(identidade.id, String(contas[0]._id));
    assert.equal(identidade.perfil, perfil);
    assert.equal(contas[0].perfil, perfil);
    assert.equal(contas[0].email, perfil + "@example.invalid");
    assert.notEqual(contas[0].senha, "senha fictícia");
    assert.equal(await bcrypt.compare("senha fictícia", contas[0].senha), true);
    assert.equal(perfisResp.length, perfil === "responsavel" ? 1 : 0);
    assert.equal(perfisCrianca.length, perfil === "crianca" ? 1 : 0);
    const registro = perfil === "responsavel" ? perfisResp[0] : perfisCrianca[0];
    assert.equal(String(registro.usuarioId), String(contas[0]._id));
    if (perfil === "crianca") {
      assert.equal(registro.responsavelId, null);
      assert.equal(registro.permissaoAtiva, false);
      assert.notEqual(String(registro._id), String(registro.usuarioId));
    }
    assert.equal(tela.armazenamento.has("token"), false);
    assert.equal(tela.armazenamento.has("usuario"), false);
    assert.deepEqual(tela.navegacoes, ["/"]);
  });
}
