const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
} = require("./helpers/relatorio.cjs");

const URL_LISTA = "/responsaveis/minhas-criancas";
const UA = "0000000000000000000000a1";
const UB = "0000000000000000000000b2";
const CA = "0000000000000000000000c1";
const CB = "0000000000000000000000c2";

function criancas() {
  return [
    {
      _id: CA,
      usuarioId: UA,
      nome: "Criança A da fixture",
      email: "a@example.invalid",
      permissaoAtiva: true,
      limiteTempoDiario: 60,
    },
    {
      _id: CB,
      usuarioId: UB,
      nome: "Criança B da fixture",
      email: "b@example.invalid",
      permissaoAtiva: true,
      limiteTempoDiario: 120,
    },
  ];
}

function pagina({ filhos = criancas(), responder, ...extras } = {}) {
  return montarRelatorio({
    pagina: "detalhes",
    id: UA,
    responder:
      responder ||
      ((url, config, body) => {
        if (url === URL_LISTA) return { data: filhos };
        return { data: { limiteTempoDiario: body?.limiteTempoDiario ?? null } };
      }),
    ...extras,
  });
}

async function consultar(tela) {
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  assert.equal(tela.prompts.length, 0, "Não deve solicitar JWT por prompt");
  return tela.renderizar();
}

async function carregar(extras = {}) {
  const tela = pagina(extras);
  await consultar(tela);
  return tela;
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
function texto(node) {
  if (Array.isArray(node)) return node.map(texto).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node?.props ? texto(node.props.children) : "";
}
function buscar(tela, predicado, raiz = tela.arvore) {
  const item = elementos(raiz, predicado)[0];
  assert.ok(item, "Elemento esperado não encontrado");
  return item;
}
function botao(tela, nome) {
  return buscar(
    tela,
    (node) => node.type === "button" && texto(node).trim() === nome,
  );
}
function dialogo(tela) {
  return elementos(tela.arvore, (node) => node.props.role === "dialog")[0];
}
function comando(tela, classe = "confirmar") {
  assert.ok(dialogo(tela), "Modal deve estar aberto");
  return buscar(
    tela,
    (node) => node.type === "button" && node.props.className === classe,
    dialogo(tela),
  );
}
function limite(tela) {
  return buscar(
    tela,
    (node) => node.type === "input" && node.props.id === "limite",
  );
}
function permissao(tela) {
  return texto(buscar(tela, (node) => node.props.className === "status"));
}
function escritas(tela) {
  return tela.chamadas.filter((item) => item.metodo);
}
function abrir(tela, nome) {
  botao(tela, nome).props.onClick();
  tela.renderizar();
}
function preencherLimite(tela, valor) {
  limite(tela).props.onChange({ target: { value: valor } });
  tela.renderizar();
}
function conferirCrianca(tela, nome = "Criança A da fixture") {
  assert.ok(texto(buscar(tela, (node) => node.type === "h1")).includes(nome));
}
const OPERACOES = [
  "permissao",
  "salvar-limite",
  "remover-limite",
  "desvincular",
];
const FALLBACKS = {
  permissao: "Não foi possível alterar a permissão da criança.",
  "salvar-limite": "Não foi possível atualizar o limite diário.",
  "remover-limite": "Não foi possível remover o limite diário.",
  desvincular: "Não foi possível desvincular a criança.",
};
function preparar(tela, operacao) {
  if (operacao === "permissao")
    abrir(
      tela,
      /Ativa$/.test(permissao(tela)) ? "Bloquear jogo" : "Liberar jogo",
    );
  else if (operacao === "desvincular") abrir(tela, "Desvincular Criança");
  else {
    abrir(tela, "Limite de tempo por dia");
    if (operacao === "salvar-limite") preencherLimite(tela, "90");
  }
}
function acao(tela, operacao) {
  return comando(
    tela,
    operacao === "desvincular"
      ? "excluir"
      : operacao === "remover-limite"
        ? "cancelar"
        : "confirmar",
  );
}

test("GET da lista não fornece headers manuais e seleciona por Usuario._id da URL", async () => {
  const filhos = criancas();
  filhos.unshift({
    ...filhos[1],
    _id: UA,
    usuarioId: "outro-usuario",
    nome: "Armadilha de ID",
  });
  const tela = await carregar({
    filhos,
    token: "jwt-responsavel-ficticio",
  });
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, URL_LISTA);
  assert.equal(tela.chamadas[0].config, undefined);
  assert.deepEqual(tela.operacoesStorage, [
    { metodo: "getItem", chave: "token" },
  ]);
  conferirCrianca(tela);
  assert.match(tela.renderizar(), /a@example.invalid/);
  assert.doesNotMatch(tela.renderizar(), /Armadilha de ID/);
});

test("criança não vinculada mostra erro sem ações de edição", async () => {
  const tela = await carregar({ filhos: [criancas()[1]] });
  assert.match(
    tela.renderizar(),
    /Criança não encontrada entre as contas vinculadas/,
  );
  assert.equal(
    elementos(tela.arvore, (node) => node.type === "button").length,
    0,
  );
});

for (const token of [null, "", "   "]) {
  test(
    "JWT ausente " +
      JSON.stringify(token) +
      " não consulta nem mostra criança anterior",
    async () => {
      const tela = await carregar({ token });
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.doesNotMatch(tela.renderizar(), /role="alert"/);
      assert.equal(tela.chamadas.length, 0);
      assert.doesNotMatch(
        tela.renderizar(),
        /Criança A da fixture|Carregando dados/,
      );
    },
  );
}

for (const falha of [403, 404, 500, "rede"]) {
  test(
    "falha da consulta " +
      falha +
      " mostra mensagem genérica e encerra carregamento",
    async () => {
      const tela = await carregar({
        responder: () =>
          Promise.reject(
            falha === "rede"
              ? new Error("offline")
              : { response: { status: falha } },
          ),
      });
      assert.match(
        tela.renderizar(),
        /Não foi possível carregar os dados da criança/,
      );
      assert.doesNotMatch(
        tela.renderizar(),
        /Carregando dados|Criança A da fixture/,
      );
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );
}

test("consulta pendente exibe carregamento, sem perfil e sem ações", async () => {
  const pendente = promessaControlada();
  const tela = pagina({ responder: () => pendente.promise });
  tela.renderizar();
  tela.executarEfeitos();
  assert.match(tela.renderizar(), /Carregando dados da criança/);
  assert.equal(
    elementos(tela.arvore, (node) => node.type === "button").length,
    0,
  );
  pendente.resolve({ data: criancas() });
  await tela.resolverConsulta();
  tela.renderizar();
  conferirCrianca(tela);
});

for (const extras of [{ isReady: false }, { id: undefined }]) {
  test(
    "router não pronto ou ID ausente impede consulta: " +
      JSON.stringify(extras),
    async () => {
      const tela = await carregar(extras);
      assert.equal(tela.chamadas.length, 0);
      assert.equal(tela.prompts.length, 0);
    },
  );
}

test("troca de criança limpa perfil e modal e carrega o novo usuarioId", async () => {
  const tela = await carregar();
  preparar(tela, "salvar-limite");
  tela.mudarCrianca(UB);
  tela.renderizar();
  tela.executarEfeitos();
  assert.doesNotMatch(tela.renderizar(), /Criança A da fixture|role="dialog"/);
  await tela.resolverConsulta();
  tela.renderizar();
  conferirCrianca(tela, "Criança B da fixture");
  abrir(tela, "Limite de tempo por dia");
  assert.equal(limite(tela).props.value, 120);
});

for (const desfecho of ["sucesso", "erro"]) {
  test(
    "consulta antiga com " +
      desfecho +
      " não sobrescreve consulta da criança atual",
    async () => {
      const antiga = promessaControlada();
      let chamadas = 0;
      const tela = pagina({
        responder: () =>
          ++chamadas === 1 ? antiga.promise : { data: criancas() },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.mudarCrianca(UB);
      await consultar(tela);
      if (desfecho === "sucesso") antiga.resolve({ data: [criancas()[0]] });
      else antiga.reject(new Error("Erro antigo"));
      await tela.resolverConsulta();
      tela.renderizar();
      conferirCrianca(tela, "Criança B da fixture");
      assert.equal(tela.errosConsole.length, 0);
    },
  );
}

test("sequência simulada setup-cleanup-setup usa storage sem prompt e ignora consulta invalidada", async () => {
  const antiga = promessaControlada();
  let consultas = 0;
  const tela = pagina({
    responder: () =>
      ++consultas === 1 ? antiga.promise : { data: criancas() },
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.repetirEfeitos();
  await tela.resolverConsulta();
  antiga.reject(new Error("Consulta invalidada"));
  await tela.resolverConsulta();
  tela.renderizar();
  conferirCrianca(tela);
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 2);
  assert.equal(tela.errosConsole.length, 0);
});

test("repetição simulada sem token redireciona sem manter perfil ou carregamento", async () => {
  const antiga = promessaControlada();
  const tela = pagina({ responder: () => antiga.promise });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.definirToken(null);
  tela.repetirEfeitos();
  antiga.resolve({ data: criancas() });
  await tela.resolverConsulta();
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 1);
  assert.doesNotMatch(tela.renderizar(), /role="alert"/);
  assert.doesNotMatch(
    tela.renderizar(),
    /Criança A da fixture|Carregando dados/,
  );
});

for (const ativa of [true, false]) {
  test(
    "PATCH de permissão " +
      ativa +
      " → " +
      !ativa +
      " usa Crianca._id e booleano",
    async () => {
      const filhos = criancas();
      filhos[0].permissaoAtiva = ativa;
      const tela = await carregar({ filhos });
      preparar(tela, "permissao");
      await acao(tela, "permissao").props.onClick();
      tela.renderizar();
      const escrita = escritas(tela)[0];
      assert.equal(escrita.metodo, "PATCH");
      assert.equal(escrita.url, URL_LISTA + "/" + CA + "/permissao");
      assert.equal(escrita.body.permissaoAtiva, !ativa);
      assert.equal(typeof escrita.body.permissaoAtiva, "boolean");
      assert.equal(escrita.config, undefined);
      assert.equal(
        permissao(tela),
        "Permissão para jogar: " + (ativa ? "Desativada" : "Ativa"),
      );
      assert.equal(dialogo(tela), undefined);
    },
  );
}

test("permissão na interface muda somente depois do sucesso da API", async () => {
  const pendente = promessaControlada();
  const tela = await carregar({
    responder: (url) =>
      url === URL_LISTA ? { data: criancas() } : pendente.promise,
  });
  preparar(tela, "permissao");
  const conclusao = acao(tela, "permissao").props.onClick();
  tela.renderizar();
  assert.equal(permissao(tela), "Permissão para jogar: Ativa");
  pendente.resolve({ data: {} });
  await conclusao;
  tela.renderizar();
  assert.equal(permissao(tela), "Permissão para jogar: Desativada");
});

for (const valor of ["1", "30", "1440"]) {
  test(
    "limite inteiro positivo " +
      valor +
      " é enviado como número ao perfil Crianca",
    async () => {
      const tela = await carregar();
      preparar(tela, "salvar-limite");
      preencherLimite(tela, valor);
      await acao(tela, "salvar-limite").props.onClick();
      tela.renderizar();
      const escrita = escritas(tela)[0];
      assert.equal(escrita.metodo, "PATCH");
      assert.equal(escrita.url, URL_LISTA + "/" + CA + "/limite-tempo");
      assert.equal(escrita.body.limiteTempoDiario, Number(valor));
      assert.equal(escrita.config, undefined);
      assert.deepEqual(tela.alertas, ["Limite diário atualizado com sucesso."]);
    },
  );
}

for (const valor of ["0", "-1", "2.5", "", "   ", "abc", "Infinity", "NaN"]) {
  test(
    "limite inválido " + JSON.stringify(valor) + " é rejeitado sem PATCH",
    async () => {
      const tela = await carregar();
      preparar(tela, "salvar-limite");
      preencherLimite(tela, valor);
      await acao(tela, "salvar-limite").props.onClick();
      tela.renderizar();
      assert.equal(escritas(tela).length, 0);
      assert.deepEqual(tela.alertas, ["Informe um limite válido em minutos."]);
      assert.ok(dialogo(tela));
      assert.equal(comando(tela).props.disabled, false);
    },
  );
}

test("limite exibido após salvar usa o valor devolvido pelo backend", async () => {
  const tela = await carregar({
    responder: (url) =>
      url === URL_LISTA
        ? { data: criancas() }
        : { data: { limiteTempoDiario: 45 } },
  });
  preparar(tela, "salvar-limite");
  await acao(tela, "salvar-limite").props.onClick();
  tela.renderizar();
  abrir(tela, "Limite de tempo por dia");
  assert.equal(limite(tela).props.value, 45);
});

test("criança sem limite mostra campo vazio e pode remover limite enviando null", async () => {
  const filhos = criancas();
  filhos[0].limiteTempoDiario = null;
  const tela = await carregar({ filhos });
  preparar(tela, "remover-limite");
  assert.equal(limite(tela).props.value, "");
  await acao(tela, "remover-limite").props.onClick();
  tela.renderizar();
  const escrita = escritas(tela)[0];
  assert.equal(escrita.metodo, "PATCH");
  assert.equal(escrita.url, URL_LISTA + "/" + CA + "/limite-tempo");
  assert.deepEqual({ ...escrita.body }, { limiteTempoDiario: null });
  assert.equal(escrita.config, undefined);
  assert.deepEqual(tela.alertas, ["Limite diário removido com sucesso."]);
  abrir(tela, "Limite de tempo por dia");
  assert.equal(limite(tela).props.value, "");
});

test("primeiro botão de desvinculação abre confirmação sem DELETE e preserva texto de conta/histórico", async () => {
  const tela = await carregar();
  preparar(tela, "desvincular");
  assert.equal(escritas(tela).length, 0);
  const html = tela.renderizar();
  assert.match(html, /Desvincular criança\?/);
  assert.match(html, /A conta e o histórico da criança serão preservados/);
  assert.doesNotMatch(
    texto(tela.arvore),
    /excluir (a )?conta|excluir (a )?criança|apagar conta/i,
  );
});

test("DELETE somente após confirmar, usando Crianca._id, JWT e navegação após sucesso", async () => {
  const tela = await carregar();
  preparar(tela, "desvincular");
  await acao(tela, "desvincular").props.onClick();
  tela.renderizar();
  const escrita = escritas(tela)[0];
  assert.equal(escrita.metodo, "DELETE");
  assert.equal(escrita.url, URL_LISTA + "/" + CA + "/vinculo");
  assert.equal(escrita.config, undefined);
  assert.deepEqual(tela.alertas, ["Criança desvinculada com sucesso."]);
  assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
});

for (const operacao of OPERACOES) {
  test(
    "falha de " +
      operacao +
      " preserva perfil/modal, mostra erro e permite recuperar",
    async () => {
      let tentativas = 0;
      const tela = await carregar({
        responder: (url, config, body) => {
          if (url === URL_LISTA) return { data: criancas() };
          if (++tentativas === 1)
            throw {
              response: {
                status: 403,
                data: { mensagem: "Falha controlada da operação" },
              },
            };
          return {
            data: { limiteTempoDiario: body?.limiteTempoDiario ?? null },
          };
        },
      });
      preparar(tela, operacao);
      await acao(tela, operacao).props.onClick();
      tela.renderizar();
      conferirCrianca(tela);
      assert.equal(permissao(tela), "Permissão para jogar: Ativa");
      assert.ok(dialogo(tela));
      assert.equal(acao(tela, operacao).props.disabled, false);
      assert.deepEqual(tela.alertas, ["Falha controlada da operação"]);
      assert.deepEqual(tela.navegacoes, []);
      if (operacao === "salvar-limite")
        assert.equal(limite(tela).props.value, "90");
      await acao(tela, operacao).props.onClick();
      tela.renderizar();
      assert.equal(escritas(tela).length, 2);
      assert.equal(dialogo(tela), undefined);
    },
  );
}

for (const [operacao, mensagem] of [
  ["permissao", "Não foi possível alterar a permissão da criança."],
  ["salvar-limite", "Não foi possível atualizar o limite diário."],
  ["remover-limite", "Não foi possível remover o limite diário."],
  ["desvincular", "Não foi possível desvincular a criança."],
]) {
  test(
    "falha de rede em " +
      operacao +
      " usa fallback sem sucesso ou redirecionamento",
    async () => {
      const tela = await carregar({
        responder: (url) =>
          url === URL_LISTA
            ? { data: criancas() }
            : Promise.reject(new Error("offline")),
      });
      preparar(tela, operacao);
      await acao(tela, operacao).props.onClick();
      tela.renderizar();
      assert.deepEqual(tela.alertas, [mensagem]);
      assert.deepEqual(tela.navegacoes, []);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.equal(tela.prompts.length, 0);
      assert.equal(acao(tela, operacao).props.disabled, false);
    },
  );
}

for (const operacao of OPERACOES) {
  test(
    "salvando bloqueia ações do modal, repetição e fechamento pelo fundo: " +
      operacao,
    async () => {
      const pendente = promessaControlada();
      const tela = await carregar({
        responder: (url) =>
          url === URL_LISTA ? { data: criancas() } : pendente.promise,
      });
      preparar(tela, operacao);
      const conclusao = acao(tela, operacao).props.onClick();
      tela.renderizar();
      const botoesModal = elementos(
        dialogo(tela),
        (node) => node.type === "button",
      );
      assert.ok(botoesModal.every((item) => item.props.disabled === true));
      await acao(tela, operacao).props.onClick();
      assert.equal(escritas(tela).length, 1);
      buscar(
        tela,
        (node) => node.props.className === "fundoModal",
      ).props.onClick();
      tela.renderizar();
      assert.ok(dialogo(tela));
      pendente.resolve({
        data: { limiteTempoDiario: operacao === "remover-limite" ? null : 90 },
      });
      await conclusao;
    },
  );
}

test("sem operação pendente é possível cancelar e clicar no fundo para fechar modal", async () => {
  const tela = await carregar();
  preparar(tela, "permissao");
  botao(tela, "Cancelar").props.onClick();
  tela.renderizar();
  assert.equal(dialogo(tela), undefined);
  preparar(tela, "salvar-limite");
  buscar(tela, (node) => node.props.className === "fundoModal").props.onClick();
  tela.renderizar();
  assert.equal(dialogo(tela), undefined);
  assert.equal(escritas(tela).length, 0);
});

for (const nome of ["Limite de tempo por dia", "Bloquear jogo"]) {
  test(
    "botão principal " + nome + " deve ficar desabilitado enquanto salvando",
    async () => {
      const pendente = promessaControlada();
      const tela = await carregar({
        responder: (url) =>
          url === URL_LISTA ? { data: criancas() } : pendente.promise,
      });
      preparar(tela, "salvar-limite");
      const conclusao = acao(tela, "salvar-limite").props.onClick();
      tela.renderizar();
      const disabled = botao(tela, nome).props.disabled;
      pendente.resolve({ data: { limiteTempoDiario: 90 } });
      await conclusao;
      assert.equal(
        disabled,
        true,
        "Ação principal continua habilitada durante a operação",
      );
    },
  );
}

test("handler do botão desabilitado não substitui o modal durante salvando", async () => {
  const pendente = promessaControlada();
  const tela = await carregar({
    responder: (url) =>
      url === URL_LISTA ? { data: criancas() } : pendente.promise,
  });
  preparar(tela, "salvar-limite");
  const conclusao = acao(tela, "salvar-limite").props.onClick();
  tela.renderizar();
  assert.equal(botao(tela, "Bloquear jogo").props.disabled, true);
  botao(tela, "Bloquear jogo").props.onClick();
  tela.renderizar();
  const textoModal = texto(dialogo(tela));
  pendente.resolve({ data: { limiteTempoDiario: 90 } });
  await conclusao;
  assert.ok(
    textoModal.includes("Limite de tempo por dia"),
    "Modal de limite foi substituído pelo de permissão enquanto salvando",
  );
});

for (const operacao of OPERACOES) {
  test(
    "resultado antigo de " +
      operacao +
      " não deve alterar a criança selecionada depois",
    async () => {
      const pendente = promessaControlada();
      const tela = await carregar({
        responder: (url) =>
          url === URL_LISTA ? { data: criancas() } : pendente.promise,
      });
      preparar(tela, operacao);
      const conclusao = acao(tela, operacao).props.onClick();
      tela.renderizar();
      await tela.resolverConsulta();
      tela.mudarCrianca(UB);
      await consultar(tela);
      conferirCrianca(tela, "Criança B da fixture");
      pendente.resolve({
        data: { limiteTempoDiario: operacao === "remover-limite" ? null : 90 },
      });
      await conclusao;
      tela.renderizar();
      // A chamada original deve continuar dirigida a A, nunca realizar escrita em B.
      assert.ok(escritas(tela)[0].url.includes("/" + CA + "/"));
      if (operacao === "permissao")
        assert.equal(
          permissao(tela),
          "Permissão para jogar: Ativa",
          "Permissão de A aplicada à interface de B",
        );
      else if (operacao === "desvincular")
        assert.deepEqual(
          tela.navegacoes,
          [],
          "Operação antiga redirecionou a seleção atual",
        );
      else {
        abrir(tela, "Limite de tempo por dia");
        assert.equal(
          limite(tela).props.value,
          120,
          "Limite de A aplicado à interface de B",
        );
      }
      assert.deepEqual(
        tela.alertas,
        [],
        "Operação antiga não deve apresentar sucesso na seleção atual",
      );
    },
  );
}

test("erro de gravação antiga não deve aparecer na seleção de outra criança", async () => {
  const pendente = promessaControlada();
  const tela = await carregar({
    responder: (url) =>
      url === URL_LISTA ? { data: criancas() } : pendente.promise,
  });
  preparar(tela, "permissao");
  const conclusao = acao(tela, "permissao").props.onClick();
  tela.renderizar();
  await tela.resolverConsulta();
  tela.mudarCrianca(UB);
  await consultar(tela);
  pendente.reject({
    response: { status: 403, data: { mensagem: "Erro antigo da criança A" } },
  });
  await conclusao;
  tela.renderizar();
  conferirCrianca(tela, "Criança B da fixture");
  assert.deepEqual(
    tela.alertas,
    [],
    "Erro antigo de A apresentado na seleção de B",
  );
});

// Revalidação das correções: a versão da seleção deve diferenciar a primeira
// visita a A da visita seguinte, mesmo quando o ID volta ao mesmo valor.
for (const operacao of OPERACOES) {
  for (const desfecho of ["sucesso", "erro", "401"]) {
    for (const ciclo of ["A-B", "A-B-A", "cleanup", "repeticao-efeito"]) {
      test(
        "revalidação: " +
          operacao +
          " antiga com " +
          desfecho +
          " após " +
          ciclo +
          " não produz efeitos",
        async () => {
          const antiga = promessaControlada();
          const tela = await carregar({
            responder: (url) =>
              url === URL_LISTA ? { data: criancas() } : antiga.promise,
          });
          preparar(tela, operacao);
          const conclusao = acao(tela, operacao).props.onClick();
          tela.renderizar();
          await tela.resolverConsulta();

          if (ciclo === "cleanup") {
            tela.limparEfeitos();
          } else if (ciclo === "repeticao-efeito") {
            // Simulação somente da sequência setup → cleanup → setup.
            tela.repetirEfeitos();
            await tela.resolverConsulta();
            tela.renderizar();
          } else {
            tela.mudarCrianca(UB);
            await consultar(tela);
            if (ciclo === "A-B-A") {
              tela.mudarCrianca(UA);
              await consultar(tela);
            }
          }

          const atualizacoesAntes = tela.atualizacoesEstado.length;
          if (desfecho === "sucesso")
            antiga.resolve({
              data: {
                limiteTempoDiario: operacao === "remover-limite" ? null : 90,
              },
            });
          else
            antiga.reject({
              response: {
                status: desfecho === "401" ? 401 : 403,
                data: { mensagem: "Erro obsoleto de A" },
              },
            });
          await conclusao;

          assert.equal(
            tela.atualizacoesEstado.length,
            atualizacoesAntes,
            "Gravação obsoleta chamou setter, inclusive no finally",
          );
          assert.deepEqual(tela.alertas, []);
          assert.deepEqual(tela.navegacoes, []);
          assert.equal(tela.errosConsole.length, 0);
          assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
          assert.ok(tela.armazenamento.has("usuario"));
          assert.deepEqual(tela.substituicoes, []);
          assert.equal(escritas(tela).length, 1);
          assert.ok(escritas(tela)[0].url.includes("/" + CA + "/"));

          if (ciclo !== "cleanup") {
            tela.renderizar();
            conferirCrianca(
              tela,
              ciclo === "A-B" ? "Criança B da fixture" : "Criança A da fixture",
            );
            assert.equal(permissao(tela), "Permissão para jogar: Ativa");
            assert.equal(dialogo(tela), undefined);
            abrir(tela, "Limite de tempo por dia");
            assert.equal(limite(tela).props.value, ciclo === "A-B" ? 120 : 60);
          }
          // No caso cleanup não se renderiza um componente já desmontado.
        },
      );
    }
  }
}

for (const operacao of OPERACOES) {
  for (const desfecho of ["sucesso", "erro", "401"]) {
    for (const ciclo of ["A-B", "A-B-A"]) {
      test(
        "revalidação: finally de " +
          operacao +
          " antiga com " +
          desfecho +
          " em " +
          ciclo +
          " não interfere em operação nova",
        async () => {
          const antiga = promessaControlada();
          const atual = promessaControlada();
          let gravacoes = 0;
          const tela = await carregar({
            responder: (url) => {
              if (url === URL_LISTA) return { data: criancas() };
              return ++gravacoes === 1 ? antiga.promise : atual.promise;
            },
          });
          preparar(tela, operacao);
          const conclusaoAntiga = acao(tela, operacao).props.onClick();
          tela.renderizar();
          await tela.resolverConsulta();
          tela.mudarCrianca(UB);
          await consultar(tela);
          if (ciclo === "A-B-A") {
            tela.mudarCrianca(UA);
            await consultar(tela);
          }

          preparar(tela, operacao);
          const conclusaoAtual = acao(tela, operacao).props.onClick();
          tela.renderizar();
          await tela.resolverConsulta();
          assert.equal(
            escritas(tela).length,
            2,
            "Nova seleção deve permitir uma nova operação",
          );
          assert.equal(acao(tela, operacao).props.disabled, true);
          const textoModalAtual = texto(dialogo(tela));
          const atualizacoesAntes = tela.atualizacoesEstado.length;

          if (desfecho === "sucesso")
            antiga.resolve({
              data: {
                limiteTempoDiario: operacao === "remover-limite" ? null : 90,
              },
            });
          else
            antiga.reject({
              response: {
                status: desfecho === "401" ? 401 : 403,
                data: { mensagem: "Erro da operação antiga" },
              },
            });
          await conclusaoAntiga;
          assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
          assert.deepEqual(tela.alertas, []);
          assert.deepEqual(tela.navegacoes, []);
          assert.equal(tela.errosConsole.length, 0);
          assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
          assert.ok(tela.armazenamento.has("usuario"));
          assert.deepEqual(tela.substituicoes, []);
          tela.renderizar();
          assert.equal(texto(dialogo(tela)), textoModalAtual);
          assert.equal(
            acao(tela, operacao).props.disabled,
            true,
            "Finally antigo não pode liberar o botão da nova operação",
          );
          await acao(tela, operacao).props.onClick();
          assert.equal(
            escritas(tela).length,
            2,
            "Resultado antigo não pode liberar um envio repetido",
          );
          assert.ok(
            escritas(tela)[1].url.includes(
              "/" + (ciclo === "A-B" ? CB : CA) + "/",
            ),
          );

          atual.resolve({
            data: {
              limiteTempoDiario: operacao === "remover-limite" ? null : 75,
            },
          });
          await conclusaoAtual;
          tela.renderizar();
          assert.equal(dialogo(tela), undefined);
          if (operacao === "permissao") {
            assert.equal(permissao(tela), "Permissão para jogar: Desativada");
            assert.deepEqual(tela.alertas, []);
          } else if (operacao === "salvar-limite") {
            assert.deepEqual(tela.alertas, [
              "Limite diário atualizado com sucesso.",
            ]);
            abrir(tela, "Limite de tempo por dia");
            assert.equal(limite(tela).props.value, 75);
          } else if (operacao === "remover-limite") {
            assert.deepEqual(tela.alertas, [
              "Limite diário removido com sucesso.",
            ]);
            abrir(tela, "Limite de tempo por dia");
            assert.equal(limite(tela).props.value, "");
          } else {
            assert.deepEqual(tela.alertas, [
              "Criança desvinculada com sucesso.",
            ]);
            assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
          }
          if (operacao !== "desvincular") assert.deepEqual(tela.navegacoes, []);
        },
      );
    }
  }
}

for (const operacao of OPERACOES) {
  test(
    "revalidação: todos os botões e handlers principais preservam modal durante " +
      operacao,
    async () => {
      const pendente = promessaControlada();
      const tela = await carregar({
        responder: (url) =>
          url === URL_LISTA ? { data: criancas() } : pendente.promise,
      });
      preparar(tela, operacao);
      const conclusao = acao(tela, operacao).props.onClick();
      tela.renderizar();
      const modalAntes = texto(dialogo(tela));
      const atualizacoesAntes = tela.atualizacoesEstado.length;
      for (const nome of [
        "Limite de tempo por dia",
        "Bloquear jogo",
        "Desvincular Criança",
      ]) {
        assert.equal(botao(tela, nome).props.disabled, true);
        // Chamada direta verifica a guarda do handler, sem alegar clique DOM.
        botao(tela, nome).props.onClick();
        tela.renderizar();
        assert.equal(texto(dialogo(tela)), modalAntes);
        assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
      }
      pendente.resolve({
        data: { limiteTempoDiario: operacao === "remover-limite" ? null : 90 },
      });
      await conclusao;
    },
  );
}

for (const desfecho of ["sucesso", "erro"]) {
  test(
    "revalidação: GET pendente com " +
      desfecho +
      " após desmontagem não atualiza estado",
    async () => {
      const pendente = promessaControlada();
      const tela = pagina({ responder: () => pendente.promise });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.limparEfeitos();
      const atualizacoesAntes = tela.atualizacoesEstado.length;
      if (desfecho === "sucesso") pendente.resolve({ data: criancas() });
      else pendente.reject(new Error("GET antigo"));
      await tela.resolverConsulta();
      assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
      assert.deepEqual(tela.alertas, []);
      assert.deepEqual(tela.navegacoes, []);
      assert.equal(tela.errosConsole.length, 0);
    },
  );
}

for (const desfecho of ["sucesso", "erro"]) {
  test(
    "revalidação: GET da primeira visita a A com " +
      desfecho +
      " não altera a segunda visita a A",
    async () => {
      const antiga = promessaControlada();
      let consultas = 0;
      const tela = pagina({
        responder: () =>
          ++consultas === 1 ? antiga.promise : { data: criancas() },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.mudarCrianca(UB);
      await consultar(tela);
      tela.mudarCrianca(UA);
      await consultar(tela);
      const atualizacoesAntes = tela.atualizacoesEstado.length;
      if (desfecho === "sucesso")
        antiga.resolve({
          data: [
            {
              ...criancas()[0],
              nome: "Nome antigo indevido",
              permissaoAtiva: false,
            },
          ],
        });
      else antiga.reject(new Error("GET da visita anterior"));
      await tela.resolverConsulta();
      assert.equal(tela.atualizacoesEstado.length, atualizacoesAntes);
      tela.renderizar();
      conferirCrianca(tela);
      assert.equal(permissao(tela), "Permissão para jogar: Ativa");
      assert.equal(tela.errosConsole.length, 0);
    },
  );
}

function conferirSessaoRemovida(tela) {
  assert.equal(tela.armazenamento.has("token"), false);
  assert.equal(tela.armazenamento.has("usuario"), false);
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.equal(tela.prompts.length, 0);
}

for (const status of [403, 404, 500]) {
  test(`GET ${status} preserva mensagem backend e sessão`, async () => {
    const mensagem = `Falha específica da consulta ${status}`;
    const tela = await carregar({
      responder: () =>
        Promise.reject({ response: { status, data: { mensagem } } }),
    });
    assert.ok(tela.renderizar().includes('role="alert">' + mensagem));
    assert.doesNotMatch(
      tela.renderizar(),
      /Carregando dados|Criança A da fixture/,
    );
    assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
    assert.ok(tela.armazenamento.has("usuario"));
    assert.deepEqual(tela.substituicoes, []);
  });
}

test("GET 401 remove sessão e redireciona sem perfil, ações ou loading", async () => {
  const tela = await carregar({
    responder: () =>
      Promise.reject({
        response: { status: 401, data: { mensagem: "Token expirado" } },
      }),
  });
  conferirSessaoRemovida(tela);
  assert.doesNotMatch(
    tela.renderizar(),
    /role="alert"|Carregando dados|Criança A da fixture/,
  );
  assert.equal(elementos(tela.arvore, (n) => n.type === "button").length, 0);
});

test("sem token nem usuario não consulta e redireciona ao login", async () => {
  const tela = await carregar({ token: null, usuario: null });
  assert.equal(tela.chamadas.length, 0);
  conferirSessaoRemovida(tela);
});

test("GET com interceptor Axios real usa token do mesmo localStorage", async () => {
  const tela = await carregar({
    usarApiReal: true,
    token: "jwt-interceptor-ficticio",
  });
  conferirCrianca(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, URL_LISTA);
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-interceptor-ficticio",
  );
  assert.deepEqual(tela.operacoesStorage, [
    { metodo: "getItem", chave: "token" },
    { metodo: "getItem", chave: "token" },
  ]);
});

for (const operacao of OPERACOES) {
  test(`401 em ${operacao} limpa sessão, perfil/modal e redireciona`, async () => {
    const tela = await carregar({
      responder: (url) =>
        url === URL_LISTA
          ? { data: criancas() }
          : Promise.reject({
              response: { status: 401, data: { mensagem: "Token expirado" } },
            }),
    });
    tela.localStorage.setItem("preferencia", "preservar");
    preparar(tela, operacao);
    await acao(tela, operacao).props.onClick();
    tela.renderizar();
    conferirSessaoRemovida(tela);
    assert.equal(tela.armazenamento.get("preferencia"), "preservar");
    assert.equal(dialogo(tela), undefined);
    assert.doesNotMatch(tela.renderizar(), /Criança A da fixture|role="alert"/);
    assert.deepEqual(tela.alertas, []);
    assert.equal(escritas(tela).length, 1);
    assert.equal(escritas(tela)[0].config, undefined);
  });

  for (const token of [null, "", "   "]) {
    test(`${operacao} sem token ${JSON.stringify(token)} não grava e redireciona`, async () => {
      const tela = await carregar();
      preparar(tela, operacao);
      tela.definirToken(token);
      await acao(tela, operacao).props.onClick();
      conferirSessaoRemovida(tela);
      assert.equal(escritas(tela).length, 0);
      assert.deepEqual(tela.alertas, []);
    });
  }

  for (const status of [403, 404, 500]) {
    for (const comMensagem of [true, false]) {
      test(`${operacao} HTTP ${status} ${comMensagem ? "preserva mensagem" : "usa fallback"} e mantém sessão/modal`, async () => {
        const mensagem = `Falha backend ${operacao} ${status}`;
        const tela = await carregar({
          responder: (url) =>
            url === URL_LISTA
              ? { data: criancas() }
              : Promise.reject({
                  response: { status, data: comMensagem ? { mensagem } : {} },
                }),
        });
        preparar(tela, operacao);
        await acao(tela, operacao).props.onClick();
        tela.renderizar();
        conferirCrianca(tela);
        assert.ok(dialogo(tela));
        assert.equal(acao(tela, operacao).props.disabled, false);
        assert.deepEqual(tela.alertas, [
          comMensagem ? mensagem : FALLBACKS[operacao],
        ]);
        assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
        assert.ok(tela.armazenamento.has("usuario"));
        assert.deepEqual(tela.navegacoes, []);
        assert.equal(tela.prompts.length, 0);
      });
    }
  }

  for (const desfecho of ["sucesso", "401"]) {
    test(`idAtualRef ignora ${operacao} ${desfecho} após render de B antes do efeito`, async () => {
      const pendente = promessaControlada();
      const tela = await carregar({
        responder: (url) =>
          url === URL_LISTA ? { data: criancas() } : pendente.promise,
      });
      preparar(tela, operacao);
      const conclusao = acao(tela, operacao).props.onClick();
      await tela.resolverConsulta();
      tela.mudarCrianca(UB);
      tela.renderizar(); // Atualiza idAtualRef; ainda não executa cleanup/setup.
      const antes = tela.atualizacoesEstado.length;
      if (desfecho === "sucesso")
        pendente.resolve({ data: { limiteTempoDiario: 90 } });
      else pendente.reject({ response: { status: 401 } });
      await conclusao;
      assert.equal(tela.atualizacoesEstado.length, antes);
      assert.deepEqual(tela.alertas, []);
      assert.deepEqual(tela.navegacoes, []);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.renderizar();
      conferirCrianca(tela, "Criança B da fixture");
    });
  }
}

test("preserva HTML, CSS, metadados e estrutura dos três modais", async () => {
  const tela = await carregar();
  const html = tela.renderizar();
  assert.match(html, /<main class="pagina">/);
  assert.match(html, /<section class="painel"><div class="perfil">/);
  assert.match(html, /class="avatar"/);
  assert.match(html, /<p class="status">Permissão para jogar: Ativa<\/p>/);
  assert.match(html, /<div class="acoes">/);
  assert.match(
    html,
    /src="\/images\/logo.png" alt="Logo ConectaMente" class="logo"/,
  );
  const voltar = buscar(
    tela,
    (n) => n.props["aria-label"] === "Voltar para contas",
  );
  assert.equal(voltar.props.href, "/responsavel/contas");
  assert.equal(voltar.props.className, "voltar");
  buscar(
    tela,
    (n) =>
      n.type === "title" && texto(n) === "Detalhes da Conta | ConectaMente",
  );
  buscar(
    tela,
    (n) =>
      n.type === "meta" &&
      n.props.name === "description" &&
      n.props.content === "Gerenciamento da conta da criança no ConectaMente.",
  );
  for (const operacao of ["permissao", "salvar-limite", "desvincular"]) {
    preparar(tela, operacao);
    assert.equal(dialogo(tela).props["aria-modal"], "true");
    assert.equal(dialogo(tela).props.className, "modal");
    buscar(tela, (n) => n.props.className === "fundoModal");
    buscar(tela, (n) => n.props.className === "botoesModal");
    buscar(tela, (n) => n.props["aria-label"] === "Fechar modal");
    let interrompeu = false;
    dialogo(tela).props.onClick({
      stopPropagation() {
        interrompeu = true;
      },
    });
    assert.equal(interrompeu, true);
    if (operacao === "salvar-limite") {
      assert.equal(limite(tela).props.type, "number");
      assert.equal(limite(tela).props.min, "1");
      buscar(tela, (n) => n.type === "label" && n.props.htmlFor === "limite");
    }
    buscar(
      tela,
      (n) => n.props["aria-label"] === "Fechar modal",
    ).props.onClick();
    tela.renderizar();
    assert.equal(dialogo(tela), undefined);
  }
});

for (const ciclo of ["cleanup", "A-B", "A-B-A"]) {
  test(`GET 401 antigo após ${ciclo} não remove sessão nem redireciona`, async () => {
    const antiga = promessaControlada();
    let consultas = 0;
    const tela = pagina({
      responder: () =>
        ++consultas === 1 ? antiga.promise : { data: criancas() },
    });
    tela.renderizar();
    tela.executarEfeitos();
    await tela.resolverConsulta();
    if (ciclo === "cleanup") tela.limparEfeitos();
    else {
      tela.mudarCrianca(UB);
      await consultar(tela);
      if (ciclo === "A-B-A") {
        tela.mudarCrianca(UA);
        await consultar(tela);
      }
    }
    const antes = tela.atualizacoesEstado.length;
    antiga.reject({ response: { status: 401 } });
    await tela.resolverConsulta();
    assert.equal(tela.atualizacoesEstado.length, antes);
    assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
    assert.ok(tela.armazenamento.has("usuario"));
    assert.deepEqual(tela.navegacoes, []);
  });
}

test(
  "HTTP local real: JWT automático em GET, bloquear/liberar, salvar/remover limite e desvincular",
  { timeout: 5000 },
  async (t) => {
    const { createServer } = require("node:http");
    const { once } = require("node:events");
    const { readFileSync } = require("node:fs");
    const path = require("node:path");
    const vm = require("node:vm");
    const babel = require("next/dist/compiled/babel/core");
    const commonjs = require("next/dist/compiled/babel/plugin-transform-modules-commonjs");
    const recebidas = [];
    const servidor = createServer(async (req, res) => {
      let textoBody = "";
      for await (const chunk of req) textoBody += chunk;
      const body = textoBody ? JSON.parse(textoBody) : undefined;
      recebidas.push({
        metodo: req.method,
        url: req.url,
        body,
        authorization: req.headers.authorization,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          req.method === "GET"
            ? criancas()
            : (body ?? { mensagem: "Vínculo removido" }),
        ),
      );
    });
    servidor.listen(0, "127.0.0.1");
    await once(servidor, "listening");
    t.after(() => new Promise((resolve) => servidor.close(resolve)));
    let apiReal;
    const pendentes = [];
    const tela = pagina({
      token: "jwt-http-ficticio",
      responder: (url, config, body) => {
        const method = url.endsWith("/vinculo")
          ? "delete"
          : body === undefined
            ? "get"
            : "patch";
        const consulta = apiReal.request({
          ...config,
          url,
          method,
          data: body,
        });
        pendentes.push(consulta);
        return consulta;
      },
    });
    const arquivo = path.resolve(__dirname, "../src/services/api.js");
    const { code } = babel.transformSync(readFileSync(arquivo, "utf8"), {
      filename: arquivo,
      babelrc: false,
      configFile: false,
      plugins: [commonjs],
    });
    const contexto = {
      exports: {},
      require,
      localStorage: tela.localStorage,
      window: { localStorage: tela.localStorage },
      process: {
        env: {
          NEXT_PUBLIC_API_URL: `http://127.0.0.1:${servidor.address().port}`,
        },
      },
    };
    vm.runInNewContext(code, contexto, { filename: arquivo });
    apiReal = contexto.exports.default;
    tela.renderizar();
    tela.executarEfeitos();
    await tela.resolverConsulta();
    assert.equal(pendentes.length, 1);
    await Promise.all(pendentes);
    await tela.resolverConsulta();
    tela.renderizar();
    conferirCrianca(tela);

    preparar(tela, "permissao");
    await acao(tela, "permissao").props.onClick();
    tela.renderizar();
    assert.equal(permissao(tela), "Permissão para jogar: Desativada");
    preparar(tela, "permissao");
    await acao(tela, "permissao").props.onClick();
    tela.renderizar();
    assert.equal(permissao(tela), "Permissão para jogar: Ativa");
    preparar(tela, "salvar-limite");
    await acao(tela, "salvar-limite").props.onClick();
    tela.renderizar();
    preparar(tela, "remover-limite");
    assert.equal(limite(tela).props.value, 90);
    await acao(tela, "remover-limite").props.onClick();
    tela.renderizar();
    abrir(tela, "Limite de tempo por dia");
    assert.equal(limite(tela).props.value, "");
    buscar(
      tela,
      (n) => n.props["aria-label"] === "Fechar modal",
    ).props.onClick();
    tela.renderizar();
    preparar(tela, "desvincular");
    assert.match(
      tela.renderizar(),
      /A conta e o histórico da criança serão preservados/,
    );
    await acao(tela, "desvincular").props.onClick();
    tela.renderizar();

    assert.deepEqual(
      recebidas.map(({ metodo, url, body }) => ({ metodo, url, body })),
      [
        { metodo: "GET", url: URL_LISTA, body: undefined },
        {
          metodo: "PATCH",
          url: `${URL_LISTA}/${CA}/permissao`,
          body: { permissaoAtiva: false },
        },
        {
          metodo: "PATCH",
          url: `${URL_LISTA}/${CA}/permissao`,
          body: { permissaoAtiva: true },
        },
        {
          metodo: "PATCH",
          url: `${URL_LISTA}/${CA}/limite-tempo`,
          body: { limiteTempoDiario: 90 },
        },
        {
          metodo: "PATCH",
          url: `${URL_LISTA}/${CA}/limite-tempo`,
          body: { limiteTempoDiario: null },
        },
        {
          metodo: "DELETE",
          url: `${URL_LISTA}/${CA}/vinculo`,
          body: undefined,
        },
      ],
    );
    assert.ok(
      recebidas.every((r) => r.authorization === "Bearer jwt-http-ficticio"),
    );
    assert.ok(tela.chamadas.every((c) => c.config === undefined));
    assert.equal(tela.prompts.length, 0);
    assert.deepEqual(tela.alertas, [
      "Limite diário atualizado com sucesso.",
      "Limite diário removido com sucesso.",
      "Criança desvinculada com sucesso.",
    ]);
    assert.deepEqual(tela.navegacoes, ["/responsavel/contas"]);
    assert.equal(dialogo(tela), undefined);
  },
);
