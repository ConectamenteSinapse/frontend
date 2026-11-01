const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
} = require("./helpers/relatorio.cjs");

const EMAIL = "crianca@example.invalid";
const SENHA = "Senha ficticia 123!";
const SUCESSO = "Criança vinculada com sucesso!";
const FALHA = "Não foi possível vincular a criança.";

function pagina(extras = {}) {
  return montarRelatorio({
    pagina: "adicionar-conta",
    responder: () => ({ data: { _id: "crianca-ficticia" } }),
    ...extras,
  });
}

function elementos(arvore, predicado) {
  if (Array.isArray(arvore))
    return arvore.flatMap((item) => elementos(item, predicado));
  if (!arvore || typeof arvore !== "object" || !arvore.props) return [];
  return [
    ...(predicado(arvore) ? [arvore] : []),
    ...elementos(arvore.props.children, predicado),
  ];
}

function elemento(tela, tipo, id) {
  const item = elementos(
    tela.arvore,
    (node) => node.type === tipo && (id === undefined || node.props.id === id),
  )[0];
  assert.ok(item, "Elemento não encontrado: " + tipo + (id ? "#" + id : ""));
  return item;
}

function preencher(tela, email = EMAIL, senha = SENHA) {
  tela.renderizar();
  elemento(tela, "input", "email").props.onChange({ target: { value: email } });
  tela.renderizar();
  elemento(tela, "input", "senha").props.onChange({ target: { value: senha } });
  tela.renderizar();
  return tela;
}

function evento() {
  return {
    prevencoes: 0,
    preventDefault() {
      this.prevencoes++;
    },
  };
}
function enviar(tela, event = evento()) {
  return elemento(tela, "form").props.onSubmit(event);
}
function conferirCampos(tela, email = EMAIL, senha = SENHA) {
  assert.equal(elemento(tela, "input", "email").props.value, email);
  assert.equal(elemento(tela, "input", "senha").props.value, senha);
}
function conferirBotao(tela, carregando = false) {
  const botao = elemento(tela, "button");
  assert.equal(botao.props.type, "submit");
  assert.equal(botao.props.disabled, carregando);
  assert.equal(
    botao.props.children,
    carregando ? "Vinculando..." : "Continuar",
  );
}

test("renderiza formulário com labels, tipos, required e valores iniciais de e-mail/senha", () => {
  const tela = pagina();
  const html = tela.renderizar();
  assert.match(html, /<h1>Adicionar Conta<\/h1>/);
  assert.equal(typeof elemento(tela, "form").props.onSubmit, "function");
  const labels = elementos(tela.arvore, (item) => item.type === "label");
  assert.deepEqual(
    labels.map((item) => [item.props.htmlFor, item.props.children]),
    [
      ["email", "E-mail"],
      ["senha", "Senha"],
    ],
  );
  assert.equal(elemento(tela, "input", "email").props.type, "email");
  assert.equal(elemento(tela, "input", "senha").props.type, "password");
  assert.equal(elemento(tela, "input", "email").props.required, true);
  assert.equal(elemento(tela, "input", "senha").props.required, true);
  conferirCampos(tela, "", "");
  conferirBotao(tela);
  assert.equal(tela.chamadas.length, 0);
  assert.equal(tela.prompts.length, 0);
});

test("onChange preserva o preenchimento dos campos controlados", () => {
  const tela = preencher(pagina());
  conferirCampos(tela);
});

test("preventDefault é chamado antes da validação, mesmo no formulário vazio", async () => {
  const tela = pagina();
  tela.renderizar();
  const event = evento();
  await enviar(tela, event);
  assert.equal(event.prevencoes, 1);
  assert.equal(tela.chamadas.length, 0);
});

for (const [email, senha, nome] of [
  ["", SENHA, "e-mail vazio"],
  ["   ", SENHA, "e-mail com espaços"],
  [EMAIL, "", "senha vazia"],
  [EMAIL, "   ", "senha com espaços"],
  ["", "", "ambos vazios"],
]) {
  test("valida " + nome + " sem pedir JWT ou enviar requisição", async () => {
    const tela = preencher(pagina(), email, senha);
    await enviar(tela);
    assert.deepEqual(tela.alertas, ["Preencha o e-mail e a senha."]);
    assert.equal(tela.prompts.length, 0);
    assert.equal(tela.chamadas.length, 0);
    assert.deepEqual(tela.navegacoes, []);
    tela.renderizar();
    conferirCampos(tela, email, senha);
    conferirBotao(tela);
  });
}

for (const token of [null, "", "   "]) {
  test(
    "JWT ausente (" +
      JSON.stringify(token) +
      ") impede POST e redireciona ao login",
    async () => {
      const tela = preencher(pagina({ token }));
      await enviar(tela);
      assert.deepEqual(tela.alertas, [
        "Sua sessão não foi encontrada. Faça login novamente.",
      ]);
      assert.equal(tela.chamadas.length, 0);
      assert.equal(tela.prompts.length, 0);
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.deepEqual(tela.navegacoes, ["/"]);
      assert.equal(tela.operacoesStorage.filter((op) => op.metodo === "removeItem").length, 0);
      tela.renderizar();
      conferirCampos(tela);
      conferirBotao(tela);
    },
  );
}

test("token no localStorage permite POST de vínculo sem prompt nem Authorization manual", async () => {
  const tela = preencher(pagina({ token: "  jwt-responsavel-ficticio  " }));
  const event = evento();
  await enviar(tela, event);
  assert.equal(event.prevencoes, 1);
  assert.equal(tela.chamadas.length, 1);
  const chamada = tela.chamadas[0];
  assert.equal(chamada.metodo, "POST");
  assert.equal(chamada.url, "/responsaveis/vincular-crianca");
  assert.deepEqual({ ...chamada.body }, { email: EMAIL, senha: SENHA });
  assert.equal(chamada.config, undefined);
  assert.equal(tela.prompts.length, 0);
  assert.ok(tela.operacoesStorage.some((op) => op.metodo === "getItem" && op.chave === "token"));
  assert.equal(tela.armazenamento.get("token"), "  jwt-responsavel-ficticio  ");
});

test("remove espaços externos do email no corpo e preserva senha e campos preenchidos", async () => {
  const senha = "  Senha ficticia com espacos  ";
  const email = "  " + EMAIL + "  ";
  const tela = preencher(pagina(), email, senha);
  await enviar(tela);
  assert.equal(tela.chamadas[0].body.email, EMAIL);
  assert.equal(tela.chamadas[0].body.senha, senha);
  tela.renderizar();
  conferirCampos(tela, email, senha);
});

test("sucesso apresenta uma única mensagem e redireciona uma única vez para Contas", async () => {
  const tela = preencher(pagina());
  await enviar(tela);
  assert.deepEqual(tela.alertas, [SUCESSO]);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
  assert.equal(tela.errosConsole.length, 0);
  assert.equal(tela.chamadas.length, 1);
});

test("durante a vinculação o botão fica desabilitado e exibe Vinculando...", async () => {
  const pendente = promessaControlada();
  const tela = preencher(pagina({ responder: () => pendente.promise }));
  const conclusao = enviar(tela);
  await tela.resolverConsulta();
  const html = tela.renderizar();
  conferirBotao(tela, true);
  assert.match(html, /disabled=""[^>]*>Vinculando\.\.\.<\/button>/);
  assert.deepEqual(tela.alertas, []);
  assert.deepEqual(tela.navegacoes, []);
  conferirCampos(tela);
  pendente.resolve({ data: {} });
  await conclusao;
});

test("envios repetidos após renderizar carregamento não geram novos POSTs nem prompts", async () => {
  const pendente = promessaControlada();
  const tela = preencher(pagina({ responder: () => pendente.promise }));
  const primeiro = enviar(tela);
  tela.renderizar();
  conferirBotao(tela, true);
  const segundoEvento = evento();
  await enviar(tela, segundoEvento);
  await enviar(tela);
  assert.equal(segundoEvento.prevencoes, 1);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.prompts.length, 0);
  assert.deepEqual(tela.alertas, []);
  pendente.resolve({ data: {} });
  await primeiro;
  assert.deepEqual(tela.alertas, [SUCESSO]);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
});

for (const status of [400, 401, 403, 404, 409, 500]) {
  test(
    "HTTP " +
      status +
      " mostra mensagem do backend, reabilita botão e preserva formulário",
    async () => {
      const mensagem = "Mensagem específica do backend para HTTP " + status;
      const tela = preencher(
        pagina({
          responder: () =>
            Promise.reject({ response: { status, data: { mensagem } } }),
        }),
      );
      await enviar(tela);
      assert.deepEqual(tela.alertas, [mensagem]);
      assert.deepEqual(tela.navegacoes, []);
      assert.equal(tela.errosConsole.length, 0);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.equal(tela.operacoesStorage.filter((op) => op.metodo === "removeItem").length, 0);
      assert.equal(tela.prompts.length, 0);
      tela.renderizar();
      conferirBotao(tela);
      conferirCampos(tela);
      assert.ok(!tela.alertas.includes(SUCESSO));
    },
  );
}

test("HTTP sem mensagem utiliza o fallback e não redireciona", async () => {
  const tela = preencher(
    pagina({
      responder: () => Promise.reject({ response: { status: 409, data: {} } }),
    }),
  );
  await enviar(tela);
  assert.deepEqual(tela.alertas, [FALHA]);
  assert.deepEqual(tela.navegacoes, []);
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.ok(tela.armazenamento.has("usuario"));
  tela.renderizar();
  conferirBotao(tela);
  conferirCampos(tela);
});

test("falha de comunicação informa erro padrão, reabilita botão e preserva valores", async () => {
  const tela = preencher(
    pagina({ responder: () => Promise.reject(new Error("rede indisponível")) }),
  );
  await enviar(tela);
  assert.deepEqual(tela.alertas, [FALHA]);
  assert.deepEqual(tela.navegacoes, []);
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.ok(tela.armazenamento.has("usuario"));
  tela.renderizar();
  conferirBotao(tela);
  conferirCampos(tela);
});

test("botão permanece bloqueado até a falha chegar e depois permite tentar novamente", async () => {
  const pendente = promessaControlada();
  let tentativas = 0;
  const tela = preencher(
    pagina({
      responder: () => (++tentativas === 1 ? pendente.promise : { data: {} }),
    }),
  );
  const primeiro = enviar(tela);
  tela.renderizar();
  conferirBotao(tela, true);
  pendente.reject({
    response: { status: 400, data: { mensagem: "Corrija o vínculo" } },
  });
  await primeiro;
  tela.renderizar();
  conferirBotao(tela);
  conferirCampos(tela);
  assert.deepEqual(tela.navegacoes, []);
  await enviar(tela);
  assert.equal(tela.chamadas.length, 2);
  assert.deepEqual(tela.alertas, ["Corrija o vínculo", SUCESSO]);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
});

test("link de retorno mantém o destino /responsavel/contas", () => {
  const tela = pagina();
  tela.renderizar();
  const voltar = elementos(
    tela.arvore,
    (item) => item.props["aria-label"] === "Voltar para contas",
  )[0];
  assert.ok(voltar);
  assert.equal(voltar.props.href, "/responsavel/contas");
});

test("preserva título, descrição, logo, hierarquia e classes do formulário", () => {
  const tela = pagina();
  const html = tela.renderizar();
  assert.equal(elemento(tela, "title").props.children, "Adicionar Conta | ConectaMente");
  assert.equal(elemento(tela, "main").props.className, "pagina");
  assert.equal(elemento(tela, "section").props.className, "painel");
  assert.equal(elemento(tela, "form").props.className, "formulario");
  assert.equal(elemento(tela, "button").props.className, "continuar");
  assert.match(html, /Informe os dados da conta da criança que deseja acompanhar\./);
  const logo = elementos(tela.arvore, (n) => n.type === "img" && n.props.alt === "Logo ConectaMente")[0];
  assert.ok(logo);
  assert.equal(logo.props.src, "/images/logo.png");
  assert.equal(logo.props.className, "logo");
  assert.equal(elementos(tela.arvore, (n) => n.type === "input").length, 2);
  assert.equal(elementos(tela.arvore, (n) => n.type === "button").length, 1);
});

test("token sem usuario armazenado ainda permite vincular criança existente", async () => {
  const tela = preencher(pagina({ usuario: null }));
  await enviar(tela);
  assert.deepEqual(tela.alertas, [SUCESSO]);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
  assert.equal(tela.prompts.length, 0);
});

test("token removido depois de preencher é verificado novamente ao enviar", async () => {
  const tela = preencher(pagina());
  tela.definirToken(null);
  await enviar(tela);
  assert.equal(tela.chamadas.length, 0);
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.equal(tela.prompts.length, 0);
});

test("401 de credenciais infantis incorretas mantém sessão e permite corrigir a senha", async () => {
  let tentativas = 0;
  const mensagem = "Email ou senha inválidos";
  const tela = preencher(pagina({ responder: () => ++tentativas === 1
    ? Promise.reject({ response: { status: 401, data: { mensagem } } })
    : { data: {} } }));
  const sessao = [...tela.armazenamento];
  await enviar(tela);
  assert.deepEqual(tela.alertas, [mensagem]);
  assert.deepEqual([...tela.armazenamento], sessao);
  assert.deepEqual(tela.navegacoes, []);
  tela.renderizar();
  elemento(tela, "input", "senha").props.onChange({ target: { value: "Outra senha fictícia" } });
  tela.renderizar();
  await enviar(tela);
  assert.equal(tela.chamadas.length, 2);
  assert.equal(tela.chamadas[1].body.senha, "Outra senha fictícia");
  assert.deepEqual(tela.alertas, [mensagem, SUCESSO]);
  assert.deepEqual([...tela.armazenamento], sessao);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
});

// Transporte HTTP e api.js/Axios reais; servidor de teste substitui a API.
// Não importa backend, não cria contas e não conecta ao MongoDB.
for (const resultado of [200, 401, 403, 500, "rede"]) {
  test(`HTTP local com interceptor real: vínculo ${resultado}`, { timeout: 10000 }, async (t) => {
    const { createServer } = require("node:http");
    const { once } = require("node:events");
    const { readFileSync } = require("node:fs");
    const path = require("node:path");
    const vm = require("node:vm");
    const babel = require("next/dist/compiled/babel/core");
    const commonjs = require("next/dist/compiled/babel/plugin-transform-modules-commonjs");
    const recebidas = [];
    const mensagem = resultado === 401 ? "Credenciais infantis inválidas"
      : resultado === 403 ? "Acesso negado pelo backend" : "Falha do servidor de teste";
    const servidor = createServer((req, res) => {
      let corpo = "";
      req.setEncoding("utf8");
      req.on("data", (parte) => { corpo += parte; });
      req.on("end", () => {
        recebidas.push({ metodo: req.method, url: req.url, authorization: req.headers.authorization, body: JSON.parse(corpo) });
        if (resultado === "rede") { req.socket.destroy(); return; }
        res.writeHead(resultado, { "Content-Type": "application/json" });
        res.end(JSON.stringify(resultado === 200 ? { _id: "crianca-existente-ficticia" } : { erro: true, mensagem }));
      });
    });
    servidor.listen(0, "127.0.0.1"); await once(servidor, "listening");
    t.after(() => new Promise((resolve) => servidor.close(resolve)));
    let apiReal;
    const tela = preencher(pagina({
      token: "jwt-responsavel-ficticio",
      responder: (url, config, body) => apiReal.post(url, body, config),
    }), "  " + EMAIL + "  ", SENHA);
    const arquivo = path.resolve(__dirname, "../src/services/api.js");
    const { code } = babel.transformSync(readFileSync(arquivo, "utf8"), {
      filename: arquivo, babelrc: false, configFile: false, plugins: [commonjs],
    });
    const contexto = {
      exports: {}, require,
      localStorage: tela.localStorage, window: { localStorage: tela.localStorage },
      process: { env: { NEXT_PUBLIC_API_URL: `http://127.0.0.1:${servidor.address().port}` } },
    };
    vm.runInNewContext(code, contexto, { filename: arquivo });
    apiReal = contexto.exports.default;
    apiReal.defaults.timeout = 2000;
    const sessao = [...tela.armazenamento];
    await enviar(tela); tela.renderizar();
    assert.deepEqual(recebidas, [{ metodo: "POST", url: "/responsaveis/vincular-crianca",
      authorization: "Bearer jwt-responsavel-ficticio", body: { email: EMAIL, senha: SENHA } }]);
    assert.equal(tela.chamadas[0].config, undefined);
    assert.equal(tela.prompts.length, 0);
    assert.deepEqual([...tela.armazenamento], sessao);
    assert.equal(tela.operacoesStorage.filter((op) => op.metodo === "removeItem").length, 0);
    conferirBotao(tela);
    conferirCampos(tela, "  " + EMAIL + "  ", SENHA);
    if (resultado === 200) {
      assert.deepEqual(tela.alertas, [SUCESSO]);
      assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
    } else {
      assert.deepEqual(tela.alertas, [resultado === "rede" ? FALHA : mensagem]);
      assert.deepEqual(tela.navegacoes, []);
    }
  });
}
