const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
} = require("./helpers/relatorio.cjs");

const A = "0000000000000000000000a1";
const B = "0000000000000000000000b1";

function resumo(percentual = 72, totalTentativas = 25) {
  return {
    criancaId: "000000000000000000000001",
    resumo: {
      totalTentativas,
      acertos: 18,
      erros: 7,
      percentualAcertos: percentual,
      totalEstrelas: 18,
      tarefasConcluidas: 3,
      ultimaInteracao: "2026-10-30T12:00:00.000Z",
    },
    desempenhoPorComodo: [],
  };
}

function pagina({ dados = resumo(), responder, ...extras } = {}) {
  return montarRelatorio({
    pagina: "percentual",
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

function semGrafico(html) {
  assert.doesNotMatch(
    html,
    /role="img"|conic-gradient|Respostas corretas:|Respostas incorretas:|<strong>/,
  );
}

function conferirGrafico(html, corretas, incorretas) {
  assert.match(html, /role="img"/);
  assert.ok(
    html.includes(
      'aria-label="' +
        corretas +
        "% de respostas corretas e " +
        incorretas +
        '% incorretas"',
    ),
  );
  assert.ok(html.includes("<strong>" + corretas + "%</strong>"));
  assert.ok(html.includes("Respostas corretas: " + corretas + "%"));
  assert.ok(html.includes("Respostas incorretas: " + incorretas + "%"));
  assert.ok(
    html.includes(
      "background:conic-gradient(#164b87 0% " +
        corretas +
        "%, #f4a62a " +
        corretas +
        "% 100%)",
    ),
  );
  assert.match(html, /<span>de acertos<\/span>/);
}

test("consulta somente resumo-desempenho pelo usuarioId e envia JWT com Bearer", async () => {
  const tela = pagina({ token: "  jwt-simulado  " });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/criancas/" + A + "/resumo-desempenho");
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-simulado",
  );
});

for (const [percentual, complemento] of [
  [0, 100],
  [72, 28],
  [66.67, 33.33],
  [100, 0],
]) {
  test(
    "percentual " +
      percentual +
      "% aparece no centro, legenda, descrição acessível e gradiente",
    async () => {
      const dados = resumo(percentual);
      const acertos = percentual === 66.67 ? 2 : percentual;
      const tentativas = percentual === 66.67 ? 3 : 100;
      Object.assign(dados.resumo, {
        totalTentativas: tentativas,
        acertos,
        erros: tentativas - acertos,
      });
      const html = await consultar(pagina({ dados }));
      conferirGrafico(html, percentual, complemento);
      assert.doesNotMatch(html, /Carregando progresso|role="alert"/);
    },
  );
}

test("usa percentualAcertos da API mesmo se os contadores sugerirem outro percentual", async () => {
  const dados = resumo(72);
  // Fixture deliberadamente divergente: não autoriza o frontend a recalcular 4%.
  Object.assign(dados.resumo, { acertos: 1, erros: 24 });
  conferirGrafico(await consultar(pagina({ dados })), 72, 28);
});

test("não depende dos contadores de acertos e erros para apresentar o percentual", async () => {
  const dados = resumo(66.67, 3);
  Object.defineProperty(dados.resumo, "acertos", {
    get() {
      assert.fail("Cálculo local não autorizado com acertos");
    },
  });
  Object.defineProperty(dados.resumo, "erros", {
    get() {
      assert.fail("Cálculo local não autorizado com erros");
    },
  });
  conferirGrafico(await consultar(pagina({ dados })), 66.67, 33.33);
});

test("criança sem histórico mostra mensagem específica, sem gráfico de erros de 100%", async () => {
  const dados = resumo(0, 0);
  Object.assign(dados.resumo, {
    acertos: 0,
    erros: 0,
    totalEstrelas: 0,
    tarefasConcluidas: 0,
    ultimaInteracao: null,
  });
  const html = await consultar(pagina({ dados }));
  assert.match(html, /Esta criança ainda não possui tentativas registradas\./);
  semGrafico(html);
  assert.doesNotMatch(html, /NaN|undefined|role="alert"|Carregando progresso/);
});

test("texto e legenda identificam acertos e erros com as cores correspondentes", async () => {
  const html = await consultar(pagina());
  assert.match(html, /<h1>RENDIMENTO DA CONTA<\/h1>/);
  assert.match(html, /<h2>Percentual de acerto<\/h2>/);
  assert.match(html, /<span class="azul"><\/span>Respostas corretas: 72%/);
  assert.match(html, /<span class="laranja"><\/span>Respostas incorretas: 28%/);
  conferirGrafico(html, 72, 28);
});

test("antes da consulta não exibe percentual demonstrativo nem gráfico", () => {
  const tela = pagina();
  const html = tela.renderizar();
  semGrafico(html);
  assert.equal(tela.chamadas.length, 0);
  assert.doesNotMatch(html, /75%|Esta criança ainda não possui tentativas/);
});

for (const token of [null, "", "   "]) {
  test(
    "JWT ausente (" + JSON.stringify(token) + ") mostra erro sem chamadas HTTP",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.match(html, /role="alert">É necessário informar o JWT\./);
      assert.equal(tela.chamadas.length, 0);
      semGrafico(html);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "HTTP " + status + " apresenta mensagem da API e oculta o gráfico",
    async () => {
      const mensagem =
        status === 401
          ? "Token inválido ou expirado"
          : "Você não tem permissão para consultar este resumo";
      const tela = pagina({
        responder: () => {
          throw { response: { status, data: { mensagem } } };
        },
      });
      const html = await consultar(tela);
      assert.ok(html.includes('role="alert">' + mensagem));
      semGrafico(html);
      assert.doesNotMatch(html, /Carregando progresso/);
      assert.equal(tela.errosConsole.length, 1);
    },
  );
}

test("falha de rede usa a mensagem padrão e encerra o carregamento", async () => {
  const tela = pagina({
    responder: () => Promise.reject(new Error("rede indisponível")),
  });
  const html = await consultar(tela);
  assert.match(html, /role="alert">Não foi possível consultar o progresso\./);
  assert.doesNotMatch(html, /Carregando progresso/);
  semGrafico(html);
});

test("HTTP sem mensagem de erro também utiliza o texto padrão", async () => {
  const tela = pagina({
    responder: () => Promise.reject({ response: { status: 401, data: {} } }),
  });
  const html = await consultar(tela);
  assert.match(html, /Não foi possível consultar o progresso\./);
  semGrafico(html);
});

test("mostra carregamento enquanto aguarda a API e só apresenta gráfico após o sucesso", async () => {
  const pendente = promessaControlada();
  const tela = pagina({ responder: () => pendente.promise });
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando progresso\.\.\./);
  semGrafico(aguardando);
  pendente.resolve({ data: resumo(72) });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  conferirGrafico(html, 72, 28);
  assert.doesNotMatch(html, /Carregando progresso/);
});

test("não pede JWT nem consulta API quando router ainda não está pronto", async () => {
  const tela = pagina({ isReady: false });
  semGrafico(await consultar(tela));
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 0);
});

test("não consulta API sem id da criança", async () => {
  const tela = pagina({ id: undefined });
  semGrafico(await consultar(tela));
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 0);
});

test("troca de criança limpa gráfico anterior e carrega o percentual da nova conta", async () => {
  const nova = promessaControlada();
  const tela = pagina({
    responder: (url) => (url.includes(A) ? { data: resumo(72) } : nova.promise),
  });
  conferirGrafico(await consultar(tela), 72, 28);
  tela.mudarCrianca(B);
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando progresso/);
  semGrafico(aguardando);
  nova.resolve({ data: resumo(100) });
  await tela.resolverConsulta();
  conferirGrafico(tela.renderizar(), 100, 0);
  assert.equal(
    tela.chamadas.at(-1).url,
    "/criancas/" + B + "/resumo-desempenho",
  );
});

for (const falha of ["401", "403", "rede", "sem-jwt"]) {
  test(
    "nova consulta com " + falha + " não preserva percentual anterior na tela",
    async () => {
      const tela = pagina({
        responder: (url) => {
          if (url.includes(A)) return { data: resumo(72) };
          if (falha === "rede") throw new Error("rede indisponível");
          throw {
            response: {
              status: Number(falha),
              data: { mensagem: "Falha da nova consulta" },
            },
          };
        },
      });
      conferirGrafico(await consultar(tela), 72, 28);
      tela.mudarCrianca(B);
      if (falha === "sem-jwt") tela.definirToken(null);
      const html = await consultar(tela);
      assert.match(html, /role="alert"/);
      semGrafico(html);
    },
  );
}

for (const desfecho of ["sucesso", "erro"]) {
  test(
    "resposta antiga com " +
      desfecho +
      " não sobrescreve sucesso da criança atual",
    async () => {
      const antiga = promessaControlada();
      const tela = pagina({
        responder: (url) =>
          url.includes(A) ? antiga.promise : { data: resumo(100) },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      tela.mudarCrianca(B);
      conferirGrafico(await consultar(tela), 100, 0);
      if (desfecho === "sucesso") antiga.resolve({ data: resumo(72) });
      else
        antiga.reject({
          response: { status: 403, data: { mensagem: "Erro obsoleto de A" } },
        });
      await tela.resolverConsulta();
      const html = tela.renderizar();
      conferirGrafico(html, 100, 0);
      assert.doesNotMatch(
        html,
        /Erro obsoleto de A|role="alert"|Carregando progresso/,
      );
      assert.equal(tela.errosConsole.length, 0);
    },
  );
}

test("finally de consulta antiga não encerra carregamento da criança atual", async () => {
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
  antiga.resolve({ data: resumo(72) });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Carregando progresso/);
  semGrafico(html);
  atual.resolve({ data: resumo(66.67) });
  await tela.resolverConsulta();
  conferirGrafico(tela.renderizar(), 66.67, 33.33);
});

test("sucesso atrasado de A não remove erro da consulta atual de B", async () => {
  const antiga = promessaControlada();
  const tela = pagina({
    responder: (url) => {
      if (url.includes(A)) return antiga.promise;
      throw {
        response: {
          status: 403,
          data: { mensagem: "Resumo de B não autorizado" },
        },
      };
    },
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.mudarCrianca(B);
  await consultar(tela);
  antiga.resolve({ data: resumo(72) });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /role="alert">Resumo de B não autorizado/);
  semGrafico(html);
});

test("troca para criança sem histórico remove gráfico e mostra mensagem de ausência", async () => {
  const dadosVazios = resumo(0, 0);
  Object.assign(dadosVazios.resumo, {
    acertos: 0,
    erros: 0,
    ultimaInteracao: null,
  });
  const tela = pagina({
    responder: (url) => ({ data: url.includes(A) ? resumo(72) : dadosVazios }),
  });
  await consultar(tela);
  tela.mudarCrianca(B);
  const html = await consultar(tela);
  assert.match(html, /Esta criança ainda não possui tentativas registradas/);
  semGrafico(html);
});
