const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
} = require("./helpers/relatorio.cjs");

const A = "0000000000000000000000a1";
const B = "0000000000000000000000b1";

function dados(tarefasConcluidas = 4, totalTentativas = 29, acertos = 17) {
  return {
    criancaId: "000000000000000000000001",
    resumo: {
      tarefasConcluidas,
      totalTentativas,
      acertos,
      erros: 12,
      percentualAcertos: 58.62,
      totalEstrelas: 22,
      ultimaInteracao: "2026-10-30T12:00:00.000Z",
    },
    desempenhoPorComodo: [],
  };
}

function pagina({ resposta = dados(), responder, ...extras } = {}) {
  return montarRelatorio({
    pagina: "resumo",
    usarApiReal: true,
    id: A,
    responder: responder || (() => ({ data: resposta })),
    ...extras,
  });
}

async function consultar(tela) {
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  return tela.renderizar();
}

function indicadores(html) {
  return [
    ...html.matchAll(
      /<article[^>]*>\s*<strong>(.*?)<\/strong>\s*<span>(.*?)<\/span>[\s\S]*?<\/article>/g,
    ),
  ].map((item) => [item[2], item[1]]);
}

function conferirIndicadores(html, tarefas = 4, tentativas = 29, acertos = 17) {
  assert.deepEqual(indicadores(html), [
    ["Tarefas concluídas", String(tarefas)],
    ["Total de tentativas", String(tentativas)],
    ["Acertos", String(acertos)],
  ]);
  assert.doesNotMatch(html, /role="alert"|Carregando progresso/);
}

function semIndicadores(html) {
  assert.deepEqual(indicadores(html), []);
  assert.doesNotMatch(html, /<article|<strong>/);
}

test("consulta somente resumo-desempenho com Usuario._id da URL e JWT do storage pelo interceptor real", async () => {
  const tela = pagina({ token: "jwt-responsavel-ficticio" });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/criancas/" + A + "/resumo-desempenho");
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-responsavel-ficticio",
  );
  assert.equal(tela.chamadas[0].config.method, "get");
  assert.notEqual(
    dados().criancaId,
    A,
    "Crianca._id difere do Usuario._id da URL",
  );
  assert.equal(tela.prompts.length, 0);
  assert.deepEqual(tela.operacoesStorage, [
    { metodo: "getItem", chave: "token" },
    { metodo: "getItem", chave: "token" },
  ]);
  assert.deepEqual(tela.substituicoes, []);
});

test("exibe tarefas concluídas, tentativas e acertos recebidos em resumo", async () => {
  conferirIndicadores(await consultar(pagina()));
});

test("não soma desempenho por cômodo para recalcular os indicadores gerais", async () => {
  const resposta = dados();
  // Valores deliberadamente divergentes; a fonte do card é o resumo geral.
  resposta.desempenhoPorComodo = [
    {
      comodoId: "fixture",
      tarefasConcluidas: 100,
      tentativas: 500,
      acertos: 400,
    },
  ];
  conferirIndicadores(await consultar(pagina({ resposta })));
});

test("não lê percentuais, erros ou detalhes por cômodo para calcular os indicadores", async () => {
  const resposta = dados();
  for (const campo of ["percentualAcertos", "erros", "totalEstrelas"]) {
    Object.defineProperty(resposta.resumo, campo, {
      get() {
        assert.fail("Recálculo local indevido: " + campo);
      },
    });
  }
  Object.defineProperty(resposta, "desempenhoPorComodo", {
    get() {
      assert.fail("Resumo não deve ser recalculado a partir de cômodos");
    },
  });
  conferirIndicadores(await consultar(pagina({ resposta })));
});

test("criança sem histórico apresenta os três indicadores zerados", async () => {
  const resposta = dados(0, 0, 0);
  Object.assign(resposta.resumo, {
    erros: 0,
    percentualAcertos: 0,
    totalEstrelas: 0,
    ultimaInteracao: null,
  });
  const html = await consultar(pagina({ resposta }));
  conferirIndicadores(html, 0, 0, 0);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("estado inicial não apresenta indicadores zerados ou demonstrativos antes da consulta", () => {
  const tela = pagina();
  semIndicadores(tela.renderizar());
  assert.equal(tela.chamadas.length, 0);
});

test("textos dos cards correspondem aos indicadores e ao título Resumo de atividade", async () => {
  const html = await consultar(pagina());
  assert.match(html, /<h1>RENDIMENTO DA CONTA<\/h1>/);
  assert.match(html, /<h2>Resumo de atividade<\/h2>/);
  conferirIndicadores(html);
  assert.doesNotMatch(
    html,
    /Atividades concluídas|Etapas concluídas|75 pontos/,
  );
});

for (const token of [null, "", "   "]) {
  test(
    "JWT ausente (" +
      JSON.stringify(token) +
      ") redireciona ao login sem prompt nem consulta à API",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.equal(tela.prompts.length, 0);
      assert.doesNotMatch(html, /role="alert"/);
      assert.equal(tela.chamadas.length, 0);
      assert.doesNotMatch(html, /Carregando progresso/);
      semIndicadores(html);
    },
  );
}

for (const status of [403, 404, 500]) {
  test(
    "HTTP " + status + " mostra mensagem da API sem indicadores",
    async () => {
      const mensagem = "Mensagem específica do backend para HTTP " + status;
      const tela = pagina({
        responder: () =>
          Promise.reject({ response: { status, data: { mensagem } } }),
      });
      const html = await consultar(tela);
      assert.ok(html.includes('role="alert">' + mensagem));
      assert.doesNotMatch(html, /Carregando progresso/);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
      assert.equal(tela.prompts.length, 0);
      semIndicadores(html);
    },
  );
}

test("falha de rede usa mensagem padrão e encerra carregamento", async () => {
  const tela = pagina({
    responder: () => Promise.reject(new Error("rede indisponível")),
  });
  const html = await consultar(tela);
  assert.match(html, /role="alert">Não foi possível consultar o progresso\./);
  assert.doesNotMatch(html, /Carregando progresso/);
  semIndicadores(html);
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.ok(tela.armazenamento.has("usuario"));
  assert.deepEqual(tela.substituicoes, []);
  assert.equal(tela.prompts.length, 0);
});

for (const status of [403, 404, 500])
  test("HTTP " + status + " sem mensagem usa o texto padrão", async () => {
    const tela = pagina({
      responder: () => Promise.reject({ response: { status, data: {} } }),
    });
    const html = await consultar(tela);
    assert.match(html, /Não foi possível consultar o progresso\./);
    semIndicadores(html);
  });

test("carregamento oculta indicadores até a resposta da API", async () => {
  const pendente = promessaControlada();
  const tela = pagina({ responder: () => pendente.promise });
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando progresso\.\.\./);
  semIndicadores(aguardando);
  pendente.resolve({ data: dados() });
  await tela.resolverConsulta();
  conferirIndicadores(tela.renderizar());
});

test("router não pronto não pede JWT nem realiza consultas", async () => {
  const tela = pagina({ isReady: false });
  semIndicadores(await consultar(tela));
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 0);
});

test("ID da criança ausente impede consulta e solicitação de JWT", async () => {
  const tela = pagina({ id: undefined });
  semIndicadores(await consultar(tela));
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 0);
});

test("mudança de ID limpa os indicadores anteriores durante a nova consulta", async () => {
  const nova = promessaControlada();
  const tela = pagina({
    responder: (url) => (url.includes(A) ? { data: dados() } : nova.promise),
  });
  conferirIndicadores(await consultar(tela));
  tela.mudarCrianca(B);
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando progresso/);
  semIndicadores(aguardando);
  nova.resolve({ data: dados(8, 53, 31) });
  await tela.resolverConsulta();
  conferirIndicadores(tela.renderizar(), 8, 53, 31);
  assert.equal(
    tela.chamadas.at(-1).url,
    "/criancas/" + B + "/resumo-desempenho",
  );
});

for (const falha of ["401", "403", "rede", "sem-jwt"]) {
  test(
    "nova consulta com " + falha + " não mostra os dados anteriores",
    async () => {
      const tela = pagina({
        responder: (url) => {
          if (url.includes(A)) return { data: dados() };
          if (falha === "rede") throw new Error("rede indisponível");
          throw {
            response: {
              status: Number(falha),
              data: { mensagem: "Falha da consulta atual" },
            },
          };
        },
      });
      await consultar(tela);
      tela.mudarCrianca(B);
      if (falha === "sem-jwt") tela.definirToken(null);
      const html = await consultar(tela);
      if (["401", "sem-jwt"].includes(falha)) {
        assert.deepEqual(tela.substituicoes, ["/"]);
        assert.doesNotMatch(html, /role="alert"|Carregando progresso/);
      } else assert.match(html, /role="alert"/);
      semIndicadores(html);
    },
  );
}

for (const desfecho of ["sucesso", "erro", "401"]) {
  test(
    "resposta antiga com " + desfecho + " não altera os indicadores atuais",
    async () => {
      const antiga = promessaControlada();
      const tela = pagina({
        responder: (url) =>
          url.includes(A) ? antiga.promise : { data: dados(8, 53, 31) },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.mudarCrianca(B);
      conferirIndicadores(await consultar(tela), 8, 53, 31);
      if (desfecho === "sucesso") antiga.resolve({ data: dados() });
      else
        antiga.reject({
          response: {
            status: desfecho === "401" ? 401 : 403,
            data: { mensagem: "Erro antigo de A" },
          },
        });
      await tela.resolverConsulta();
      const html = tela.renderizar();
      conferirIndicadores(html, 8, 53, 31);
      assert.doesNotMatch(html, /Erro antigo de A/);
      assert.equal(tela.errosConsole.length, 0);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );
}

for (const desfecho of ["sucesso", "erro"]) {
  test(
    "finally da consulta antiga após " +
      desfecho +
      " não encerra o carregamento atual",
    async () => {
      const antiga = promessaControlada();
      const atual = promessaControlada();
      const tela = pagina({
        responder: (url) => (url.includes(A) ? antiga.promise : atual.promise),
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.mudarCrianca(B);
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      if (desfecho === "sucesso") antiga.resolve({ data: dados() });
      else antiga.reject(new Error("rede indisponível na consulta antiga"));
      await tela.resolverConsulta();
      const aguardando = tela.renderizar();
      assert.match(aguardando, /Carregando progresso/);
      assert.doesNotMatch(aguardando, /role="alert"/);
      semIndicadores(aguardando);
      atual.resolve({ data: dados(8, 53, 31) });
      await tela.resolverConsulta();
      conferirIndicadores(tela.renderizar(), 8, 53, 31);
    },
  );
}

test("sucesso atrasado de A não remove erro da consulta atual de B", async () => {
  const antiga = promessaControlada();
  const tela = pagina({
    responder: (url) => {
      if (url.includes(A)) return antiga.promise;
      throw {
        response: {
          status: 403,
          data: { mensagem: "Consulta atual não autorizada" },
        },
      };
    },
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.mudarCrianca(B);
  await consultar(tela);
  antiga.resolve({ data: dados() });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /role="alert">Consulta atual não autorizada/);
  semIndicadores(html);
});

test("resultado antigo não aparece após JWT ausente na nova consulta", async () => {
  const antiga = promessaControlada();
  const tela = pagina({ responder: () => antiga.promise });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.mudarCrianca(B);
  tela.definirToken(null);
  await consultar(tela);
  antiga.resolve({ data: dados() });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.doesNotMatch(html, /role="alert"|Carregando progresso/);
  semIndicadores(html);
  assert.equal(tela.chamadas.length, 1);
});

test("consulta bem-sucedida de nova criança limpa erro anterior", async () => {
  const tela = pagina({
    responder: (url) => {
      if (url.includes(A))
        throw {
          response: { status: 403, data: { mensagem: "Erro anterior" } },
        };
      return { data: dados(8, 53, 31) };
    },
  });
  assert.match(await consultar(tela), /Erro anterior/);
  tela.mudarCrianca(B);
  const html = await consultar(tela);
  conferirIndicadores(html, 8, 53, 31);
  assert.doesNotMatch(html, /Erro anterior/);
});

test("troca para criança sem histórico substitui valores anteriores por zeros reais", async () => {
  const tela = pagina({
    responder: (url) => ({ data: url.includes(A) ? dados() : dados(0, 0, 0) }),
  });
  await consultar(tela);
  tela.mudarCrianca(B);
  conferirIndicadores(await consultar(tela), 0, 0, 0);
});

test("HTTP 401 remove token e usuário e redireciona ao login sem indicadores", async () => {
  const tela = pagina({
    responder: () =>
      Promise.reject({
        response: { status: 401, data: { mensagem: "Token expirado" } },
      }),
  });
  const html = await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.armazenamento.has("token"), false);
  assert.equal(tela.armazenamento.has("usuario"), false);
  assert.deepEqual(
    tela.operacoesStorage.filter((op) => op.metodo === "removeItem"),
    [
      { metodo: "removeItem", chave: "token" },
      { metodo: "removeItem", chave: "usuario" },
    ],
  );
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.equal(tela.prompts.length, 0);
  assert.doesNotMatch(html, /role="alert"|Carregando progresso/);
  semIndicadores(html);
});

test("página delega Authorization ao interceptor sem fornecer headers explícitos", async () => {
  const tela = pagina({ usarApiReal: false });
  conferirIndicadores(await consultar(tela));
  assert.equal(tela.chamadas[0].config, undefined);
  assert.equal(tela.prompts.length, 0);
});

test("interceptor lê token atualizado do mesmo storage a cada consulta", async () => {
  const tela = pagina();
  await consultar(tela);
  tela.definirToken("jwt-renovado-ficticio");
  tela.mudarCrianca(B);
  await consultar(tela);
  assert.deepEqual(
    tela.chamadas.map((c) => c.config.headers.Authorization),
    ["Bearer jwt-ficticio", "Bearer jwt-renovado-ficticio"],
  );
  assert.equal(tela.chamadas[1].url, `/criancas/${B}/resumo-desempenho`);
  assert.equal(tela.prompts.length, 0);
});

for (const desfecho of ["sucesso", "401"])
  test("cleanup na desmontagem ignora " + desfecho + " atrasado", async () => {
    const pendente = promessaControlada();
    const tela = pagina({ responder: () => pendente.promise });
    tela.renderizar();
    tela.executarEfeitos();
    await tela.resolverConsulta();
    tela.limparEfeitos();
    const antes = tela.atualizacoesEstado.length;
    if (desfecho === "sucesso") pendente.resolve({ data: dados() });
    else pendente.reject({ response: { status: 401 } });
    await tela.resolverConsulta();
    assert.equal(tela.atualizacoesEstado.length, antes);
    assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
    assert.ok(tela.armazenamento.has("usuario"));
    assert.deepEqual(tela.substituicoes, []);
  });

test("preserva estrutura, classes, imagens, metadados e retorno com Usuario._id", async () => {
  const tela = pagina();
  const html = await consultar(tela);
  assert.match(html, /<main class="pagina">/);
  assert.match(html, /<header class="cabecalho">/);
  assert.match(html, /<section class="painel">/);
  assert.match(html, /<div class="indicadores">/);
  assert.equal([...html.matchAll(/<article class="indicador">/g)].length, 3);
  assert.match(
    html,
    /src="\/images\/logo.png" alt="Logo ConectaMente" class="logo"/,
  );
  assert.match(
    html,
    /src="\/images\/majesticons_share.png" alt="" class="iconeVoltar"/,
  );
  function elementos(no) {
    if (Array.isArray(no)) return no.flatMap(elementos);
    if (!no?.props) return [];
    return [no, ...elementos(no.props.children)];
  }
  const nos = elementos(tela.arvore);
  const voltar = nos.find(
    (no) => no.props["aria-label"] === "Voltar ao menu de rendimento",
  );
  assert.equal(voltar.props.className, "voltar");
  assert.equal(voltar.props.href.pathname, "/responsavel/rendimento");
  assert.equal(voltar.props.href.query.id, A);
  assert.ok(
    nos.some(
      (no) =>
        no.type === "title" &&
        no.props.children === "Resumo de atividade | ConectaMente",
    ),
  );
  assert.ok(
    nos.some(
      (no) =>
        no.type === "meta" &&
        no.props.name === "description" &&
        no.props.content ===
          "Resumo das atividades da criança no ConectaMente.",
    ),
  );
  conferirIndicadores(html);
});
