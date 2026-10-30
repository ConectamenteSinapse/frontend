const test = require("node:test");
const assert = require("node:assert/strict");
const {
  montarRelatorio,
  promessaControlada,
  linhasTabela,
  indicadores,
} = require("./helpers/relatorio.cjs");

const USUARIO_A = "0000000000000000000000a1";
const USUARIO_B = "0000000000000000000000b1";
const SALA = "0000000000000000000000c1";
const JARDIM = "0000000000000000000000c2";
const OFICINA = "0000000000000000000000c3";

function fixture(id = USUARIO_A) {
  return {
    criancas: [
      {
        _id: "000000000000000000000001",
        usuarioId: id,
        nome: "Criança da fixture",
      },
    ],
    resumo: {
      criancaId: "000000000000000000000001",
      resumo: {
        totalTentativas: 13,
        acertos: 9,
        erros: 4,
        percentualAcertos: 69.23,
        totalEstrelas: 16,
        tarefasConcluidas: 4,
        ultimaInteracao: "2026-10-29T18:30:00.000Z",
      },
      desempenhoPorComodo: [
        {
          comodoId: JARDIM,
          tentativas: 3,
          acertos: 2,
          erros: 1,
          percentualAcertos: 66.67,
          tarefasConcluidas: 1,
        },
        {
          comodoId: SALA,
          tentativas: 10,
          acertos: 7,
          erros: 3,
          percentualAcertos: 70,
          tarefasConcluidas: 3,
        },
      ],
    },
    comodos: [
      { _id: OFICINA, nome: "Oficina criativa", ordem: 30, ativo: true },
      { _id: JARDIM, nome: "Jardim sensorial", ordem: 20, ativo: true },
      { _id: SALA, nome: "Sala de música", ordem: 10, ativo: true },
    ],
  };
}

function responderFixture(dados, id = USUARIO_A) {
  return (url) => {
    if (url === "/responsaveis/minhas-criancas")
      return { data: dados.criancas };
    if (url === "/criancas/" + id + "/resumo-desempenho")
      return { data: dados.resumo };
    if (url === "/comodos") return { data: dados.comodos };
    assert.fail("Chamada fora do contrato: " + url);
  };
}

function pagina(dados = fixture(), extras = {}) {
  return montarRelatorio({
    id: USUARIO_A,
    responder: responderFixture(dados),
    ...extras,
  });
}

async function consultar(tela) {
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  return tela.renderizar();
}

function semDadosAnteriores(html, nome = "Criança da fixture") {
  assert.ok(
    !html.includes(nome),
    "A identidade da consulta anterior não pode aparecer",
  );
  assert.deepEqual(indicadores(html), []);
  assert.deepEqual(linhasTabela(html), []);
}

test("exibe os três indicadores gerais exatamente como recebidos da API", async () => {
  const html = await consultar(pagina());
  assert.deepEqual(indicadores(html), [
    ["Tarefas concluídas", "4"],
    ["Total de tentativas", "13"],
    ["Acertos", "9"],
  ]);
  assert.match(html, /Criança da fixture/);
});

test("associa comodoId ao _id do catálogo mesmo com os arrays em ordens distintas", async () => {
  const rows = linhasTabela(await consultar(pagina()));
  assert.deepEqual(rows[0], ["Sala de música", "10", "7", "3", "70%"]);
  assert.deepEqual(rows[1], ["Jardim sensorial", "3", "2", "1", "66.67%"]);
});

test("ordena cômodos por ordem numérica do catálogo, e não por nome ou histórico", async () => {
  const dados = fixture();
  dados.comodos.find((c) => c._id === OFICINA).ordem = 2;
  dados.comodos.find((c) => c._id === JARDIM).ordem = 100;
  const rows = linhasTabela(await consultar(pagina(dados)));
  assert.deepEqual(
    rows.map((r) => r[0]),
    ["Oficina criativa", "Sala de música", "Jardim sensorial"],
  );
});

test("cômodo sem tentativas recebe zeros e percentual —", async () => {
  const rows = linhasTabela(await consultar(pagina()));
  assert.deepEqual(rows[2], ["Oficina criativa", "0", "0", "0", "—"]);
});

test("usa o percentual do backend sem recalcular acertos divididos por tentativas", async () => {
  const dados = fixture();
  // Valor deliberadamente diferente de 2/3 para detectar cálculo local indevido.
  dados.resumo.desempenhoPorComodo[0].percentualAcertos = 83.21;
  const rows = linhasTabela(await consultar(pagina(dados)));
  assert.equal(rows[1][4], "83.21%");
});

test("exibe 0% quando há tentativas, mas nenhum acerto", async () => {
  const dados = fixture();
  Object.assign(dados.resumo.desempenhoPorComodo[0], {
    acertos: 0,
    erros: 3,
    percentualAcertos: 0,
  });
  assert.deepEqual(linhasTabela(await consultar(pagina(dados)))[1], [
    "Jardim sensorial",
    "3",
    "0",
    "3",
    "0%",
  ]);
});

test("exibe 100% recebido do backend", async () => {
  const dados = fixture();
  Object.assign(dados.resumo.desempenhoPorComodo[0], {
    acertos: 3,
    erros: 0,
    percentualAcertos: 100,
  });
  assert.equal(linhasTabela(await consultar(pagina(dados)))[1][4], "100%");
});

test("criança sem histórico apresenta indicadores zerados e todos os cômodos sem percentual", async () => {
  const dados = fixture();
  dados.resumo.resumo = {
    totalTentativas: 0,
    acertos: 0,
    erros: 0,
    percentualAcertos: 0,
    totalEstrelas: 0,
    tarefasConcluidas: 0,
    ultimaInteracao: null,
  };
  dados.resumo.desempenhoPorComodo = [];
  const html = await consultar(pagina(dados));
  assert.deepEqual(
    indicadores(html).map((i) => i[1]),
    ["0", "0", "0"],
  );
  assert.equal(linhasTabela(html).length, 3);
  assert.ok(
    linhasTabela(html).every((r) => r.slice(1).join("|") === "0|0|0|—"),
  );
  assert.doesNotMatch(html, /NaN|undefined/);
});

for (const token of [null, "", "   "]) {
  test(
    "JWT não informado (" +
      JSON.stringify(token) +
      ") mostra erro sem consultar a API",
    async () => {
      const tela = pagina(fixture(), { token });
      const html = await consultar(tela);
      assert.match(html, /role="alert">É necessário informar o JWT\./);
      assert.equal(tela.chamadas.length, 0);
      semDadosAnteriores(html);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "HTTP " +
      status +
      " apresenta a mensagem retornada pela API e oculta dados",
    async () => {
      const mensagem =
        status === 401
          ? "Token inválido ou expirado"
          : "Você não tem permissão para consultar este resumo";
      const tela = pagina(fixture(), {
        responder: async () => {
          throw { response: { status, data: { mensagem } } };
        },
      });
      const html = await consultar(tela);
      assert.ok(html.includes('role="alert">' + mensagem));
      semDadosAnteriores(html);
      assert.equal(tela.errosConsole.length, 1);
    },
  );
}

test("falha de comunicação usa a mensagem padrão e não apresenta relatório", async () => {
  const tela = pagina(fixture(), {
    responder: () => Promise.reject(new Error("rede indisponível")),
  });
  const html = await consultar(tela);
  assert.match(html, /role="alert">Não foi possível carregar o relatório\./);
  semDadosAnteriores(html);
});

test("mostra carregamento enquanto as respostas estão pendentes e depois o remove", async () => {
  const pendente = promessaControlada();
  const dados = fixture();
  const tela = pagina(dados, {
    responder: async (url) => {
      await pendente.promise;
      return responderFixture(dados)(url);
    },
  });
  tela.renderizar();
  tela.executarEfeitos();
  const aguardando = tela.renderizar();
  assert.match(aguardando, /Carregando relatório\.\.\./);
  semDadosAnteriores(aguardando);
  pendente.resolve();
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.doesNotMatch(html, /Carregando relatório\.\.\./);
  assert.equal(linhasTabela(html).length, 3);
});

test("criança ausente da lista de vínculos recebe mensagem sem dados nem tabela", async () => {
  const dados = fixture();
  dados.criancas[0].usuarioId = USUARIO_B;
  const html = await consultar(pagina(dados));
  assert.match(html, /Criança não encontrada entre as contas vinculadas\./);
  semDadosAnteriores(html);
});

test("usa apenas os três endpoints aprovados, usuarioId da URL e JWT sem espaços", async () => {
  const tela = pagina(fixture(), { token: "  jwt-ficticio  " });
  await consultar(tela);
  assert.deepEqual(tela.chamadas.map((c) => c.url).sort(), [
    "/comodos",
    "/criancas/" + USUARIO_A + "/resumo-desempenho",
    "/responsaveis/minhas-criancas",
  ]);
  assert.ok(
    tela.chamadas.every(
      (c) => c.config.headers.Authorization === "Bearer jwt-ficticio",
    ),
  );
  assert.ok(
    tela.chamadas.every((c) => !/\/comodos\/[^/]+\/tarefas/.test(c.url)),
  );
});

test("a tabela não contém fases, datas, estados ou nomes demonstrativos anteriores", async () => {
  const html = await consultar(pagina());
  assert.match(html, /Desempenho por cômodo/);
  assert.deepEqual(
    linhasTabela(html).map((r) => r[0]),
    ["Sala de música", "Jardim sensorial", "Oficina criativa"],
  );
  assert.doesNotMatch(
    html,
    /Status dos módulos|Desempenho por fase|29\/04\/2026|QUARTO|BANHEIRO|COZINHA|EXTRA|CONCLUÍDO|FÁCIL|NÃO COMEÇOU|BLOQUEADO/,
  );
  assert.doesNotMatch(html, /Os módulos são liberados em sequência/);
});

test("não inicia consultas enquanto o router não estiver pronto", async () => {
  const tela = pagina(fixture(), { isReady: false });
  const html = await consultar(tela);
  assert.equal(tela.prompts.length, 0);
  assert.equal(tela.chamadas.length, 0);
  semDadosAnteriores(html);
});

test("não inicia consultas sem id da criança", async () => {
  const tela = pagina(fixture(), { id: undefined });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 0);
  assert.equal(tela.prompts.length, 0);
});

for (const falha of ["401", "403", "rede", "sem-jwt", "sem-vinculo"]) {
  test(
    "troca de criança seguida de " +
      falha +
      " não mostra informações da consulta anterior",
    async () => {
      const dados = fixture();
      let segundaConsulta = false;
      const tela = pagina(dados, {
        responder: async (url) => {
          if (!segundaConsulta) return responderFixture(dados)(url);
          if (falha === "sem-vinculo") {
            const outros = fixture(USUARIO_B);
            outros.criancas = [];
            return responderFixture(outros, USUARIO_B)(url);
          }
          if (falha === "rede") throw new Error("rede indisponível");
          throw {
            response: {
              status: Number(falha),
              data: { mensagem: "Consulta negada da segunda criança" },
            },
          };
        },
      });
      assert.equal(linhasTabela(await consultar(tela)).length, 3);
      segundaConsulta = true;
      tela.mudarCrianca(USUARIO_B);
      if (falha === "sem-jwt") tela.definirToken(null);
      const html = await consultar(tela);
      assert.match(html, /role="alert"/);
      semDadosAnteriores(html);
    },
  );
}

test("esconde dados antigos durante o carregamento de outra criança", async () => {
  let bloquear = false;
  const pendente = promessaControlada();
  const dados = fixture();
  const tela = pagina(dados, {
    responder: async (url) => {
      if (!bloquear) return responderFixture(dados)(url);
      await pendente.promise;
      return responderFixture(fixture(USUARIO_B), USUARIO_B)(url);
    },
  });
  await consultar(tela);
  bloquear = true;
  tela.mudarCrianca(USUARIO_B);
  tela.renderizar();
  tela.executarEfeitos();
  const html = tela.renderizar();
  assert.match(html, /Carregando relatório/);
  semDadosAnteriores(html);
  pendente.resolve();
  await tela.resolverConsulta();
});

test("uma resposta atrasada da criança anterior não deve sobrescrever o relatório da criança atual", async () => {
  const antiga = promessaControlada();
  const novos = fixture(USUARIO_B);
  novos.criancas[0].nome = "Criança atual B";
  const anteriores = fixture();
  anteriores.criancas[0].nome = "Criança antiga A";
  let consultaAtual = false;
  const tela = pagina(anteriores, {
    responder: async (url) => {
      const pertenceConsultaNova = consultaAtual;
      if (!pertenceConsultaNova) await antiga.promise;
      return responderFixture(
        pertenceConsultaNova ? novos : anteriores,
        pertenceConsultaNova ? USUARIO_B : USUARIO_A,
      )(url);
    },
  });
  tela.renderizar();
  tela.executarEfeitos();
  // Garante que as três chamadas da primeira consulta estão aguardando resposta.
  await tela.resolverConsulta();
  consultaAtual = true;
  tela.mudarCrianca(USUARIO_B);
  const htmlNovo = await consultar(tela);
  assert.match(htmlNovo, /Criança atual B/);
  antiga.resolve();
  await tela.resolverConsulta();
  const htmlFinal = tela.renderizar();
  assert.ok(
    !htmlFinal.includes("Criança antiga A"),
    "Resposta atrasada de A exibida na URL de B",
  );
  assert.match(htmlFinal, /Criança atual B/);
});
