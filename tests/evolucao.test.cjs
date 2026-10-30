const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
} = require("./helpers/relatorio.cjs");

const A = "0000000000000000000000a1";
const B = "0000000000000000000000b1";
const VAZIO = "Nenhuma atividade registrada para esta criança.";

function dia(data, percentualAcertos, extras = {}) {
  return {
    data,
    totalTentativas: 25,
    acertos: 18,
    erros: 7,
    percentualAcertos,
    ...extras,
  };
}

function resposta(evolucao = [dia("2026-10-30", 72)]) {
  return { criancaId: A, evolucao };
}

function pagina({ dados = resposta(), responder, ...extras } = {}) {
  return montarRelatorio({
    pagina: "evolucao",
    id: A,
    responder: responder || (() => ({ data: dados })),
    ...extras,
  });
}

async function consultar(tela) {
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  return tela.renderizar();
}

function pontos(html) {
  return [...html.matchAll(/<circle\b([^>]*)>/g)].map(([, atributos]) => ({
    x: Number(atributos.match(/\bcx="([^"]+)"/)[1]),
    y: Number(atributos.match(/\bcy="([^"]+)"/)[1]),
  }));
}

function datas(html) {
  return [...html.matchAll(/<text\b[^>]*>(\d{2}\/\d{2})<\/text>/g)].map(
    (item) => item[1],
  );
}

function semGrafico(html) {
  assert.doesNotMatch(html, /<svg|<circle|<path|Percentual diário de acertos/);
}

function conferirDiaUnico(html, data = "30/10", y = 85.4) {
  assert.deepEqual(datas(html), [data]);
  assert.equal(pontos(html).length, 1);
  assert.equal(pontos(html)[0].x, 300);
  assert.ok(
    Math.abs(pontos(html)[0].y - y) < 1e-8,
    "Altura do ponto deve refletir o percentual da API",
  );
  assert.doesNotMatch(html, /NaN|Infinity|role="alert"|Carregando evolução/);
}

test("consulta somente evolucao-diaria pelo usuarioId e envia JWT do responsável com Bearer", async () => {
  const tela = pagina({ token: "  jwt-responsavel-ficticio  " });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/criancas/" + A + "/evolucao-diaria");
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-responsavel-ficticio",
  );
});

test("um único dia é representado no centro, com ponto e caminho válidos", async () => {
  const html = await consultar(pagina());
  conferirDiaUnico(html);
  assert.match(html, /<path d="M 300 85\.4"/);
});

test("vários dias representam 0%, 50% e 100% e preservam sequência cronológica da API", async () => {
  const dados = resposta([
    dia("2026-10-28", 0),
    dia("2026-10-29", 50),
    dia("2026-10-30", 100),
  ]);
  const html = await consultar(pagina({ dados }));
  assert.deepEqual(datas(html), ["28/10", "29/10", "30/10"]);
  assert.deepEqual(pontos(html), [
    { x: 35, y: 215 },
    { x: 300, y: 125 },
    { x: 565, y: 35 },
  ]);
  assert.match(html, /<path d="M 35 215 L 300 125 L 565 35"/);
});

test("percentual fracionário 66,67% da API é preservado na altura do gráfico", async () => {
  const html = await consultar(
    pagina({ dados: resposta([dia("2026-10-30", 66.67)]) }),
  );
  conferirDiaUnico(html, "30/10", 94.994);
});

test("não recalcula percentual a partir de acertos e tentativas divergentes", async () => {
  const dados = resposta([
    dia("2026-10-30", 72, { totalTentativas: 100, acertos: 1, erros: 99 }),
  ]);
  conferirDiaUnico(await consultar(pagina({ dados })));
});

test("não lê contadores de rendimento para construir os pontos", async () => {
  const item = dia("2026-10-30", 72);
  for (const campo of ["totalTentativas", "acertos", "erros"]) {
    Object.defineProperty(item, campo, {
      get() {
        assert.fail("Cálculo local proibido: " + campo);
      },
    });
  }
  conferirDiaUnico(await consultar(pagina({ dados: resposta([item]) })));
});

test("utiliza a ordem recebida, sem ordenar ou agrupar novamente a série no frontend", async () => {
  // A ordenação cronológica pertence ao backend; esta fixture identifica se o
  // cliente altera a sequência recebida, não certifica uma API fora do contrato.
  const dados = resposta([dia("2026-11-02", 100), dia("2026-10-30", 0)]);
  const html = await consultar(pagina({ dados }));
  assert.deepEqual(datas(html), ["02/11", "30/10"]);
  assert.deepEqual(pontos(html), [
    { x: 35, y: 35 },
    { x: 565, y: 215 },
  ]);
});

test("dias sem tentativas não são inventados entre as datas fornecidas pela API", async () => {
  const html = await consultar(
    pagina({ dados: resposta([dia("2026-10-01", 0), dia("2026-10-30", 100)]) }),
  );
  assert.deepEqual(datas(html), ["01/10", "30/10"]);
  assert.equal(pontos(html).length, 2);
});

test("rótulos dd/mm preservam as datas na virada de mês e ano", async () => {
  const html = await consultar(
    pagina({ dados: resposta([dia("2026-12-31", 0), dia("2027-01-01", 100)]) }),
  );
  assert.deepEqual(datas(html), ["31/12", "01/01"]);
});

test("texto, legenda, descrição acessível e escala identificam o percentual diário", async () => {
  const html = await consultar(pagina());
  assert.match(html, /<h1>Evolução do progresso<\/h1>/);
  assert.match(
    html,
    /Acompanhe o desenvolvimento da criança ao longo do tempo\./,
  );
  assert.match(html, /viewBox="0 0 600 250"/);
  assert.match(
    html,
    /role="img" aria-label="Gráfico de evolução diária do percentual de acertos"/,
  );
  assert.match(html, /Percentual diário de acertos \(%\)/);
  const valoresEixo = [...html.matchAll(/<text\b[^>]*>(\d+)<\/text>/g)].map(
    (item) => Number(item[1]),
  );
  assert.deepEqual(valoresEixo, [0, 25, 50, 75, 100]);
});

test("criança sem histórico recebe mensagem específica após consulta concluída", async () => {
  const html = await consultar(pagina({ dados: resposta([]) }));
  assert.ok(html.includes(VAZIO));
  assert.doesNotMatch(html, /role="alert"|Carregando evolução/);
  semGrafico(html);
});

test("estado inicial não mostra mensagem de histórico vazio nem série demonstrativa", () => {
  const tela = pagina();
  const html = tela.renderizar();
  assert.ok(!html.includes(VAZIO));
  semGrafico(html);
  assert.equal(tela.chamadas.length, 0);
});

test("carregamento não é confundido com histórico vazio e termina após sucesso", async () => {
  const pendente = promessaControlada();
  const tela = pagina({ responder: () => pendente.promise });
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando evolução\.\.\./);
  assert.ok(!aguardando.includes(VAZIO));
  semGrafico(aguardando);
  pendente.resolve({ data: resposta() });
  await tela.resolverConsulta();
  conferirDiaUnico(tela.renderizar());
});

for (const token of [null, "", "   "]) {
  test(
    "JWT não informado (" +
      JSON.stringify(token) +
      ") mostra erro e não consulta API",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.match(html, /role="alert">É necessário informar o JWT\./);
      assert.equal(tela.chamadas.length, 0);
      assert.ok(!html.includes(VAZIO));
      semGrafico(html);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "HTTP " + status + " exibe mensagem da API, sem gráfico ou histórico vazio",
    async () => {
      const mensagem =
        status === 401
          ? "Token inválido ou expirado"
          : "Acesso à evolução não autorizado";
      const tela = pagina({
        responder: () =>
          Promise.reject({ response: { status, data: { mensagem } } }),
      });
      const html = await consultar(tela);
      assert.ok(html.includes('role="alert">' + mensagem));
      assert.ok(!html.includes(VAZIO));
      assert.doesNotMatch(html, /Carregando evolução/);
      assert.equal(tela.errosConsole.length, 1);
      semGrafico(html);
    },
  );
}

test("falha de comunicação usa mensagem padrão e encerra carregamento", async () => {
  const tela = pagina({
    responder: () => Promise.reject(new Error("rede indisponível")),
  });
  const html = await consultar(tela);
  assert.match(
    html,
    /role="alert">Não foi possível consultar a evolução diária\./,
  );
  assert.ok(!html.includes(VAZIO));
  assert.doesNotMatch(html, /Carregando evolução/);
  semGrafico(html);
});

test("resposta HTTP de erro sem mensagem usa o texto padrão", async () => {
  const tela = pagina({
    responder: () => Promise.reject({ response: { status: 403, data: {} } }),
  });
  const html = await consultar(tela);
  assert.match(html, /Não foi possível consultar a evolução diária\./);
  semGrafico(html);
});

test("router não pronto não pede token, não consulta e não informa histórico vazio", async () => {
  const tela = pagina({ isReady: false });
  const html = await consultar(tela);
  assert.equal(tela.chamadas.length, 0);
  assert.equal(tela.prompts.length, 0);
  assert.ok(!html.includes(VAZIO));
  semGrafico(html);
});

test("ausência do id da criança impede a consulta", async () => {
  const tela = pagina({ id: undefined });
  const html = await consultar(tela);
  assert.equal(tela.chamadas.length, 0);
  assert.equal(tela.prompts.length, 0);
  assert.ok(!html.includes(VAZIO));
});

test("troca de criança limpa série anterior durante carregamento e apresenta novos dados", async () => {
  const nova = promessaControlada();
  const tela = pagina({
    responder: (url) => (url.includes(A) ? { data: resposta() } : nova.promise),
  });
  conferirDiaUnico(await consultar(tela));
  tela.mudarCrianca(B);
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando evolução/);
  assert.ok(!aguardando.includes(VAZIO));
  semGrafico(aguardando);
  nova.resolve({ data: resposta([dia("2026-11-02", 100)]) });
  await tela.resolverConsulta();
  conferirDiaUnico(tela.renderizar(), "02/11", 35);
  assert.equal(tela.chamadas.at(-1).url, "/criancas/" + B + "/evolucao-diaria");
});

for (const falha of ["401", "403", "rede", "sem-jwt"]) {
  test(
    "falha " +
      falha +
      " ao trocar criança não preserva dados antigos nem mostra histórico vazio",
    async () => {
      const tela = pagina({
        responder: (url) => {
          if (url.includes(A)) return { data: resposta() };
          if (falha === "rede") throw new Error("rede indisponível");
          throw {
            response: {
              status: Number(falha),
              data: { mensagem: "Consulta atual bloqueada" },
            },
          };
        },
      });
      await consultar(tela);
      tela.mudarCrianca(B);
      if (falha === "sem-jwt") tela.definirToken(null);
      const html = await consultar(tela);
      assert.match(html, /role="alert"/);
      assert.ok(!html.includes(VAZIO));
      semGrafico(html);
    },
  );
}

for (const desfecho of ["sucesso", "erro", "vazio"]) {
  test(
    "resposta antiga com " +
      desfecho +
      " não sobrescreve a série da criança atual",
    async () => {
      const antiga = promessaControlada();
      const tela = pagina({
        responder: (url) =>
          url.includes(A)
            ? antiga.promise
            : { data: resposta([dia("2026-11-02", 100)]) },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.mudarCrianca(B);
      conferirDiaUnico(await consultar(tela), "02/11", 35);
      if (desfecho === "erro")
        antiga.reject({
          response: { status: 403, data: { mensagem: "Erro antigo de A" } },
        });
      else
        antiga.resolve({
          data: desfecho === "vazio" ? resposta([]) : resposta(),
        });
      await tela.resolverConsulta();
      const html = tela.renderizar();
      conferirDiaUnico(html, "02/11", 35);
      assert.ok(!html.includes(VAZIO));
      assert.doesNotMatch(html, /Erro antigo de A/);
      assert.equal(tela.errosConsole.length, 0);
    },
  );
}

for (const desfecho of ["sucesso", "erro"]) {
  test(
    "finally antigo após " +
      desfecho +
      " não encerra carregamento da nova consulta",
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
      if (desfecho === "sucesso") antiga.resolve({ data: resposta() });
      else antiga.reject(new Error("Falha antiga de rede"));
      await tela.resolverConsulta();
      const aguardando = tela.renderizar();
      assert.match(aguardando, /Carregando evolução/);
      assert.doesNotMatch(aguardando, /role="alert"/);
      assert.ok(!aguardando.includes(VAZIO));
      semGrafico(aguardando);
      atual.resolve({ data: resposta([dia("2026-11-02", 100)]) });
      await tela.resolverConsulta();
      conferirDiaUnico(tela.renderizar(), "02/11", 35);
    },
  );
}

test("sucesso atrasado não remove erro da consulta atual", async () => {
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
  antiga.resolve({ data: resposta() });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /role="alert">Consulta atual não autorizada/);
  assert.ok(!html.includes(VAZIO));
  semGrafico(html);
});

test("histórico vazio anterior não aparece enquanto a nova consulta está pendente", async () => {
  const nova = promessaControlada();
  const tela = pagina({
    responder: (url) =>
      url.includes(A) ? { data: resposta([]) } : nova.promise,
  });
  assert.ok((await consultar(tela)).includes(VAZIO));
  tela.mudarCrianca(B);
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando evolução/);
  assert.ok(!aguardando.includes(VAZIO));
  nova.resolve({ data: resposta() });
  await tela.resolverConsulta();
  conferirDiaUnico(tela.renderizar());
});

test("troca para criança sem histórico remove série anterior e mostra mensagem apenas após sucesso", async () => {
  const tela = pagina({
    responder: (url) => ({ data: url.includes(A) ? resposta() : resposta([]) }),
  });
  await consultar(tela);
  tela.mudarCrianca(B);
  const html = await consultar(tela);
  assert.ok(html.includes(VAZIO));
  semGrafico(html);
});
