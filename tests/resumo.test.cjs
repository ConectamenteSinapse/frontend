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

test("consulta somente resumo-desempenho com usuarioId da URL e JWT Bearer do responsável", async () => {
  const tela = pagina({ token: "  jwt-responsavel-ficticio  " });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/criancas/" + A + "/resumo-desempenho");
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-responsavel-ficticio",
  );
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
      ") mostra erro e não consulta API",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.match(html, /role="alert">É necessário informar o JWT\./);
      assert.equal(tela.chamadas.length, 0);
      assert.doesNotMatch(html, /Carregando progresso/);
      semIndicadores(html);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "HTTP " + status + " mostra mensagem da API sem indicadores",
    async () => {
      const mensagem =
        status === 401
          ? "Token inválido ou expirado"
          : "Você não tem permissão para consultar este resumo";
      const tela = pagina({
        responder: () =>
          Promise.reject({ response: { status, data: { mensagem } } }),
      });
      const html = await consultar(tela);
      assert.ok(html.includes('role="alert">' + mensagem));
      assert.doesNotMatch(html, /Carregando progresso/);
      assert.equal(tela.errosConsole.length, 1);
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
});

test("erro HTTP sem mensagem usa o texto padrão", async () => {
  const tela = pagina({
    responder: () => Promise.reject({ response: { status: 403, data: {} } }),
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
      assert.match(html, /role="alert"/);
      semIndicadores(html);
    },
  );
}

for (const desfecho of ["sucesso", "erro"]) {
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
          response: { status: 403, data: { mensagem: "Erro antigo de A" } },
        });
      await tela.resolverConsulta();
      const html = tela.renderizar();
      conferirIndicadores(html, 8, 53, 31);
      assert.doesNotMatch(html, /Erro antigo de A/);
      assert.equal(tela.errosConsole.length, 0);
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
  assert.match(html, /É necessário informar o JWT/);
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
