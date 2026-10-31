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
  const chamadas = [], navegacoes = [], logs = [], estados = [];
  let indice = 0, arvore;
  const api = apiReal ?? { post: async (url, body) => {
    chamadas.push({ url, body, token: localStorage.getItem("token") });
    return responder(url, body, chamadas.length);
  }};
  const arquivo = path.resolve(__dirname, "../src/components", nome + ".js");
  const { code } = babel.transformSync(readFileSync(arquivo, "utf8"), {
    filename: arquivo, babelrc: false, configFile: false,
    presets: [[presetReact, { runtime: "automatic" }]], plugins: [commonjs],
  });
  const contexto = {
    exports: {}, localStorage, window: { localStorage, location: { href: "" } },
    console: { log: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    require(id) {
      if (id === "react") return { useState(inicial) {
        const i = indice++;
        if (!(i in estados)) estados[i] = inicial;
        return [estados[i], (valor) => { estados[i] = typeof valor === "function" ? valor(estados[i]) : valor; }];
      }};
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
    chamadas, navegacoes, logs, armazenamento, localStorage, window: contexto.window,
    renderizar() { indice = 0; arvore = contexto.exports.default(); return tela; },
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
function preencherEtapa(tela, sufixo) {
  for (const [campo, valor] of [["nome", "Teste"], ["email", sufixo + "@example.invalid"], ["senha", "senha fictícia"], ["confirmarSenha", "senha fictícia"]]) tela.campo(campo + sufixo, valor);
}
async function cadastroPronto(responder = sucesso, iniciais = {}, apiReal) {
  const tela = montar("Cadastro", responder, iniciais, apiReal);
  preencherEtapa(tela, "Responsavel");
  await tela.enviar(); tela.renderizar();
  preencherEtapa(tela, "Crianca");
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
for (const sufixo of ["Responsavel", "Crianca"]) test(`cadastro: confirmação divergente ${sufixo} não chama API`, async () => {
  const tela = sufixo === "Responsavel" ? montar("Cadastro", sucesso) : await cadastroPronto();
  tela.campo("senha" + sufixo, "senha fictícia").campo("confirmarSenha" + sufixo, "outra");
  await tela.enviar();
  assert.match(tela.erro(), /não coincidem/);
  assert.equal(tela.chamadas.length, 0);
});
test("cadastro completo: sete chamadas, alternância JWT, perfis e vínculo", async () => {
  const tela = await cadastroPronto((url, body, n) => ({ data: { token: n === 2 ? "jwt-resp-ficticio" : "jwt-crianca-ficticio", usuario } }));
  await tela.enviar();
  assert.deepEqual(tela.chamadas.map((c) => c.url), ["/usuarios", "/usuarios/auth", "/responsaveis", "/usuarios", "/usuarios/auth", "/criancas", "/responsaveis/vincular-crianca"]);
  assert.equal(tela.chamadas.length, 7); // comentários numeram 9 etapas, mas são 7 requests.
  assert.equal(tela.chamadas[0].body.perfil, "responsavel");
  assert.equal(tela.chamadas[3].body.perfil, "crianca");
  assert.equal(tela.chamadas[2].token, "jwt-resp-ficticio");
  assert.equal(tela.chamadas[5].token, "jwt-crianca-ficticio");
  assert.equal(tela.chamadas[6].token, "jwt-resp-ficticio");
  assert.deepEqual(tela.navegacoes, ["/responsavel"]);
  assert.equal(tela.armazenamento.has("usuario"), false);
  assert.ok(tela.logs.some((args) => args[1]?.token === "jwt-resp-ficticio"), "log expõe resposta contendo JWT fictício");
});
for (let etapa = 1; etapa <= 7; etapa++) test(`falha na chamada ${etapa}: interrompe fluxo, mostra erro e caracteriza storage residual`, async () => {
  const tela = await cadastroPronto((url, body, n) => {
    if (n === etapa) throw { response: { data: { mensagem: "Falha fictícia na etapa" } } };
    return { data: { token: n === 2 ? "jwt-resp-ficticio" : "jwt-crianca-ficticio", usuario } };
  }, { token: "token-anterior-ficticio", usuario: JSON.stringify({ perfil: "crianca" }) });
  await tela.enviar();
  assert.equal(tela.chamadas.length, etapa);
  assert.equal(tela.erro(), "Falha fictícia na etapa");
  assert.deepEqual(tela.navegacoes, []);
  assert.equal(tela.botao().props.disabled, false);
  assert.equal(tela.armazenamento.get("token"), etapa <= 2 ? "token-anterior-ficticio" : etapa === 6 ? "jwt-crianca-ficticio" : "jwt-resp-ficticio");
  assert.equal(JSON.parse(tela.armazenamento.get("usuario")).perfil, "crianca");
});
test("cadastro: erro de rede apresenta fallback", async () => {
  const tela = await cadastroPronto(() => { throw new Error("offline fictício"); });
  await tela.enviar(); assert.match(tela.erro(), /Não foi possível concluir o cadastro/);
});
test("caracterização: seletor criança permite pular etapa responsável e enviar dados vazios", async () => {
  const tela = montar("Cadastro", () => { throw { response: { data: { mensagem: "Campos obrigatórios inválidos ou não preenchidos" } } }; });
  const botoes = tela.elementos().filter((n) => n.type === "button");
  botoes.at(-1).props.onClick(); tela.renderizar(); preencherEtapa(tela, "Crianca");
  await tela.enviar();
  assert.equal(tela.chamadas[0].body.nome, "");
  assert.equal(tela.chamadas[0].body.email, "");
  assert.match(tela.erro(), /Campos obrigatórios/);
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

test("cadastro: loading desabilita botão; handler direto ainda permite envio concorrente", async () => {
  const resolvers = [];
  const tela = await cadastroPronto((url, body, n) => n <= 2 ? new Promise((r) => resolvers.push(r)) : sucesso());
  const a = tela.enviar(); tela.renderizar();
  assert.equal(tela.botao().props.disabled, true);
  const b = tela.enviar();
  assert.equal(tela.chamadas.length, 2);
  resolvers.forEach((r) => r(sucesso())); await Promise.all([a, b]); tela.renderizar();
  assert.equal(tela.botao().props.disabled, false);
});

test("cadastro: 409 apresenta mensagem backend sem redirecionar", async () => {
  const tela = await cadastroPronto(() => { throw { response: { status: 409, data: { erro: true, mensagem: "Email já cadastrado" } } }; });
  await tela.enviar();
  assert.equal(tela.erro(), "Email já cadastrado");
  assert.deepEqual(tela.navegacoes, []);
});

test("integração HTTP real de Cadastro: sete requests até vínculo; somente Models simulados", async (t) => {
  const [{ default: express }, { default: Usuario }, { default: Responsavel }, { default: Crianca },
    { default: usuarios }, { default: responsaveis }, { default: criancas }] = await Promise.all([
    import("../../backend/node_modules/express/index.js"), import("../../backend/models/usuarioModel.js"),
    import("../../backend/models/responsavelModel.js"), import("../../backend/models/criancaModel.js"),
    import("../../backend/routes/usuarioRoutes.js"), import("../../backend/routes/responsavelRoutes.js"),
    import("../../backend/routes/criancaRoutes.js"),
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
  t.mock.method(Crianca, "findOneAndUpdate", async (filtro, update) => {
    const doc = perfisCrianca.find((c) => String(c._id) === String(filtro._id) && c.responsavelId === null);
    if (!doc) return null;
    Object.assign(doc, update.$set); return doc;
  });
  const requests = [];
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { requests.push({ url: req.url, metodo: req.method }); next(); });
  app.use("/usuarios", usuarios); app.use("/responsaveis", responsaveis); app.use("/criancas", criancas);
  const servidor = app.listen(0, "127.0.0.1"); await once(servidor, "listening");
  t.after(() => new Promise((r) => servidor.close(r)));
  const storage = montar("Cadastro", sucesso);
  const api = storage.apiCompilada(`http://127.0.0.1:${servidor.address().port}`);
  const tela = await cadastroPronto(sucesso, storage.armazenamento, api);
  await tela.enviar();
  assert.equal(tela.erro(), undefined);
  assert.equal(requests.length, 7);
  assert.deepEqual(tela.navegacoes, ["/responsavel"]);
  assert.equal(contas.length, 2); assert.equal(perfisResp.length, 1); assert.equal(perfisCrianca.length, 1);
  assert.equal(String(perfisCrianca[0].responsavelId), String(perfisResp[0]._id));
  assert.equal(perfisCrianca[0].permissaoAtiva, false);
  assert.notEqual(String(perfisCrianca[0]._id), String(perfisCrianca[0].usuarioId));
  assert.equal(tela.armazenamento.has("usuario"), false);
  const { default: jwt } = await import("../../backend/node_modules/jsonwebtoken/index.js");
  assert.equal(jwt.verify(tela.armazenamento.get("token"), process.env.JWT_SECRET).id, String(contas[0]._id));
});
