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
    usarApiReal: true,
    id: A,
    responder: responder || (() => ({ data: dados })),
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

test("consulta por Usuario._id e interceptor Axios real envia JWT do localStorage", async () => {
  const tela = pagina({ token: "jwt-simulado" });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 1);
  assert.equal(tela.chamadas[0].url, "/criancas/" + A + "/resumo-desempenho");
  assert.equal(
    tela.chamadas[0].config.headers.Authorization,
    "Bearer jwt-simulado",
  );
  assert.equal(tela.chamadas[0].config.method, "get");
  assert.notEqual(resumo().criancaId, A);
  assert.deepEqual(tela.operacoesStorage, [
    { metodo: "getItem", chave: "token" },
    { metodo: "getItem", chave: "token" },
  ]);
  assert.deepEqual(tela.substituicoes, []);
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
    "JWT ausente (" +
      JSON.stringify(token) +
      ") redireciona ao login sem consultar API",
    async () => {
      const tela = pagina({ token });
      const html = await consultar(tela);
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.doesNotMatch(
        html,
        /role="alert"|Carregando progresso|Esta criança ainda/,
      );
      assert.equal(tela.chamadas.length, 0);
      semGrafico(html);
    },
  );
}

for (const status of [403, 404, 500]) {
  test(
    "HTTP " + status + " apresenta mensagem da API e oculta o gráfico",
    async () => {
      const mensagem = "Mensagem específica do backend para HTTP " + status;
      const tela = pagina({
        responder: () => {
          throw { response: { status, data: { mensagem } } };
        },
      });
      const html = await consultar(tela);
      assert.ok(html.includes('role="alert">' + mensagem));
      semGrafico(html);
      assert.doesNotMatch(html, /Carregando progresso/);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
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
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.ok(tela.armazenamento.has("usuario"));
  assert.deepEqual(tela.substituicoes, []);
});

for (const status of [403, 404, 500])
  test(
    "HTTP " + status + " sem mensagem de erro utiliza o texto padrão",
    async () => {
      const tela = pagina({
        responder: () => Promise.reject({ response: { status, data: {} } }),
      });
      const html = await consultar(tela);
      assert.match(html, /Não foi possível consultar o progresso\./);
      semGrafico(html);
      assert.doesNotMatch(html, /Carregando progresso/);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );

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

for (const falha of ["401", "403", "500", "rede", "sem-jwt"]) {
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
      if (["401", "sem-jwt"].includes(falha)) {
        assert.deepEqual(tela.substituicoes, ["/"]);
        assert.doesNotMatch(html, /role="alert"/);
      } else assert.match(html, /role="alert"/);
      assert.doesNotMatch(html, /Carregando progresso|Esta criança ainda/);
      semGrafico(html);
    },
  );
}

for (const desfecho of ["sucesso", "erro", "401"]) {
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
          response: {
            status: desfecho === "401" ? 401 : 403,
            data: { mensagem: "Erro obsoleto de A" },
          },
        });
      await tela.resolverConsulta();
      const html = tela.renderizar();
      conferirGrafico(html, 100, 0);
      assert.doesNotMatch(
        html,
        /Erro obsoleto de A|role="alert"|Carregando progresso/,
      );
      assert.equal(tela.errosConsole.length, 0);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
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

for (const dados of [{ mensagem: "Token expirado" }, {}]) {
  test(
    "401 limpa sessão e redireciona, " +
      (dados.mensagem ? "com" : "sem") +
      " mensagem backend",
    async () => {
      const tela = pagina({
        responder: () =>
          Promise.reject({ response: { status: 401, data: dados } }),
      });
      tela.localStorage.setItem("preferencia", "preservar");
      const html = await consultar(tela);
      assert.equal(tela.chamadas.length, 1);
      assert.equal(tela.armazenamento.has("token"), false);
      assert.equal(tela.armazenamento.has("usuario"), false);
      assert.equal(tela.armazenamento.get("preferencia"), "preservar");
      assert.deepEqual(
        tela.operacoesStorage.filter((op) => op.metodo === "removeItem"),
        [
          { metodo: "removeItem", chave: "token" },
          { metodo: "removeItem", chave: "usuario" },
        ],
      );
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.doesNotMatch(
        html,
        /role="alert"|Carregando progresso|Esta criança ainda/,
      );
      semGrafico(html);
    },
  );
}

test("sem token nem usuário redireciona ao login sem solicitar JWT ou consultar API", async () => {
  const tela = pagina({ token: null, usuario: null });
  semGrafico(await consultar(tela));
  assert.equal(tela.chamadas.length, 0);
  assert.deepEqual(tela.substituicoes, ["/"]);
});

test("página delega Authorization ao interceptor sem fornecer config explícita", async () => {
  const tela = pagina({ usarApiReal: false });
  conferirGrafico(await consultar(tela), 72, 28);
  assert.equal(tela.chamadas[0].config, undefined);
});

test("interceptor usa token atualizado do mesmo localStorage na consulta seguinte", async () => {
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
});

for (const desfecho of ["sucesso", "401"]) {
  test("cleanup na desmontagem ignora " + desfecho + " atrasado", async () => {
    const pendente = promessaControlada();
    const tela = pagina({ responder: () => pendente.promise });
    tela.renderizar();
    tela.executarEfeitos();
    await tela.resolverConsulta();
    tela.limparEfeitos();
    const antes = tela.atualizacoesEstado.length;
    if (desfecho === "sucesso") pendente.resolve({ data: resumo() });
    else pendente.reject({ response: { status: 401 } });
    await tela.resolverConsulta();
    assert.equal(tela.atualizacoesEstado.length, antes);
    assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
    assert.ok(tela.armazenamento.has("usuario"));
    assert.deepEqual(tela.substituicoes, []);
    assert.equal(tela.prompts.length, 0);
  });
}

test("resposta antiga não mostra gráfico após ausência de token na nova consulta", async () => {
  const antiga = promessaControlada();
  const tela = pagina({ responder: () => antiga.promise });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.mudarCrianca(B);
  tela.definirToken(null);
  await consultar(tela);
  antiga.resolve({ data: resumo() });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  semGrafico(html);
  assert.doesNotMatch(
    html,
    /Carregando progresso|role="alert"|Esta criança ainda/,
  );
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.equal(tela.chamadas.length, 1);
});

test("consulta bem-sucedida de outra criança limpa erro anterior", async () => {
  const tela = pagina({
    responder: (url) => {
      if (url.includes(A))
        throw {
          response: { status: 403, data: { mensagem: "Erro anterior" } },
        };
      return { data: resumo(100) };
    },
  });
  assert.match(await consultar(tela), /Erro anterior/);
  tela.mudarCrianca(B);
  const html = await consultar(tela);
  conferirGrafico(html, 100, 0);
  assert.doesNotMatch(html, /Erro anterior|role="alert"/);
});

test("erro antigo não encerra carregamento da consulta atual", async () => {
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
  antiga.reject({ response: { status: 401 } });
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /Carregando progresso/);
  assert.doesNotMatch(html, /role="alert"/);
  semGrafico(html);
  assert.deepEqual(tela.substituicoes, []);
  atual.resolve({ data: resumo(100) });
  await tela.resolverConsulta();
  conferirGrafico(tela.renderizar(), 100, 0);
});

test("preserva estrutura do gráfico, legenda, classes, metadados e Usuario._id no retorno", async () => {
  const tela = pagina();
  const html = await consultar(tela);
  assert.match(html, /<main class="pagina">/);
  assert.match(html, /<header class="cabecalho">/);
  assert.match(html, /<section class="painel">/);
  assert.match(
    html,
    /<div class="graficoArea"><div class="grafico" role="img"/,
  );
  assert.match(
    html,
    /<div class="centro"><strong>72%<\/strong><span>de acertos<\/span><\/div>/,
  );
  assert.match(
    html,
    /<div class="legenda"><p><span class="azul"><\/span>Respostas corretas: 72%<\/p><p><span class="laranja"><\/span>Respostas incorretas: 28%<\/p><\/div>/,
  );
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
        no.props.children === "Percentual de acerto | ConectaMente",
    ),
  );
  assert.ok(
    nos.some(
      (no) =>
        no.type === "meta" &&
        no.props.name === "description" &&
        no.props.content === "Percentual de respostas corretas da criança.",
    ),
  );
  conferirGrafico(html, 72, 28);
});
