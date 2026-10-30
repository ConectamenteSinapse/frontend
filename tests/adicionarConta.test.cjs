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
      ") impede POST e redirecionamento",
    async () => {
      const tela = preencher(pagina({ token }));
      await enviar(tela);
      assert.deepEqual(tela.alertas, [
        "É necessário informar o token para realizar o teste.",
      ]);
      assert.equal(tela.chamadas.length, 0);
      assert.equal(tela.prompts.length, 1);
      assert.deepEqual(tela.navegacoes, []);
      tela.renderizar();
      conferirCampos(tela);
      conferirBotao(tela);
    },
  );
}

test("envia POST no endpoint de vínculo com corpo email/senha e JWT do responsável", async () => {
  const tela = preencher(pagina({ token: "  jwt-responsavel-ficticio  " }));
  const event = evento();
  await enviar(tela, event);
  assert.equal(event.prevencoes, 1);
  assert.equal(tela.chamadas.length, 1);
  const chamada = tela.chamadas[0];
  assert.equal(chamada.metodo, "POST");
  assert.equal(chamada.url, "/responsaveis/vincular-crianca");
  assert.deepEqual({ ...chamada.body }, { email: EMAIL, senha: SENHA });
  assert.equal(
    chamada.config.headers.Authorization,
    "Bearer jwt-responsavel-ficticio",
  );
});

test("preserva os valores informados no corpo, inclusive espaços de uma senha não vazia", async () => {
  const senha = "  Senha ficticia com espacos  ";
  const tela = preencher(pagina(), EMAIL, senha);
  await enviar(tela);
  assert.equal(tela.chamadas[0].body.email, EMAIL);
  assert.equal(tela.chamadas[0].body.senha, senha);
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
  assert.equal(tela.prompts.length, 1);
  assert.deepEqual(tela.alertas, []);
  pendente.resolve({ data: {} });
  await primeiro;
  assert.deepEqual(tela.alertas, [SUCESSO]);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
});

for (const status of [400, 401, 403, 404, 409]) {
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
      assert.equal(tela.errosConsole.length, 1);
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
