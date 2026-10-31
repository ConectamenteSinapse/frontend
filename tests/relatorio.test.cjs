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
const ROTAS = [
  "/responsaveis/minhas-criancas",
  `/criancas/${USUARIO_A}/resumo-desempenho`,
  "/comodos",
];

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
    usarApiReal: true,
    id: USUARIO_A,
    responder: responderFixture(dados),
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
      ") redireciona ao login sem consultar a API",
    async () => {
      const tela = pagina(fixture(), { token });
      const html = await consultar(tela);
      assert.deepEqual(tela.substituicoes, ["/"]);
      assert.doesNotMatch(html, /role="alert"|Carregando relatório/);
      assert.equal(tela.chamadas.length, 0);
      semDadosAnteriores(html);
    },
  );
}

for (const status of [403, 404, 500]) {
  for (const rota of ROTAS) {
    test(
      "HTTP " +
        status +
        " em " +
        rota +
        " preserva sessão e mensagem backend sem dados parciais",
      async () => {
        const mensagem = "Mensagem do backend para HTTP " + status;
        const dados = fixture();
        const tela = pagina(dados, {
          responder: async (url) => {
            if (url === rota)
              throw { response: { status, data: { mensagem } } };
            return responderFixture(dados)(url);
          },
        });
        const html = await consultar(tela);
        assert.ok(html.includes('role="alert">' + mensagem));
        semDadosAnteriores(html);
        assert.equal(tela.chamadas.length, 3);
        assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
        assert.ok(tela.armazenamento.has("usuario"));
        assert.deepEqual(tela.substituicoes, []);
        assert.doesNotMatch(html, /Carregando relatório/);
      },
    );
  }
}

test("falha de comunicação usa a mensagem padrão e não apresenta relatório", async () => {
  const tela = pagina(fixture(), {
    responder: () => Promise.reject(new Error("rede indisponível")),
  });
  const html = await consultar(tela);
  assert.match(html, /role="alert">Não foi possível carregar o relatório\./);
  semDadosAnteriores(html);
  assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
  assert.ok(tela.armazenamento.has("usuario"));
  assert.deepEqual(tela.substituicoes, []);
  assert.doesNotMatch(html, /Carregando relatório/);
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

test("usa os três endpoints e Usuario._id da URL com JWT automático pelo interceptor real", async () => {
  const tela = pagina(fixture(), { token: "jwt-ficticio" });
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
  assert.ok(tela.chamadas.every((c) => c.config.method === "get"));
  assert.equal(
    tela.operacoesStorage.filter(
      (op) => op.metodo === "getItem" && op.chave === "token",
    ).length,
    4,
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

for (const falha of [
  "401",
  "403",
  "404",
  "500",
  "rede",
  "sem-jwt",
  "sem-vinculo",
]) {
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
      if (["401", "sem-jwt"].includes(falha)) {
        assert.deepEqual(tela.substituicoes, ["/"]);
        assert.doesNotMatch(html, /role="alert"/);
      } else assert.match(html, /role="alert"/);
      assert.doesNotMatch(html, /Carregando relatório/);
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

for (const status of [403, 404, 500]) {
  test(
    "HTTP " + status + " sem mensagem usa fallback e preserva sessão",
    async () => {
      const tela = pagina(fixture(), {
        responder: () => Promise.reject({ response: { status, data: {} } }),
      });
      const html = await consultar(tela);
      assert.match(
        html,
        /role="alert">Não foi possível carregar o relatório\./,
      );
      assert.doesNotMatch(html, /Carregando relatório/);
      semDadosAnteriores(html);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );
}

for (const rota of ROTAS) {
  for (const mensagem of ["Token expirado", undefined]) {
    test(
      "401 em " +
        rota +
        (mensagem ? " com" : " sem") +
        " mensagem limpa sessão e redireciona",
      async () => {
        const dados = fixture();
        const tela = pagina(dados, {
          responder: (url) => {
            if (url === rota)
              throw { response: { status: 401, data: { mensagem } } };
            return responderFixture(dados)(url);
          },
        });
        tela.localStorage.setItem("preferencia", "preservar");
        const html = await consultar(tela);
        assert.equal(tela.chamadas.length, 3);
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
        assert.doesNotMatch(html, /role="alert"|Carregando relatório/);
        semDadosAnteriores(html);
      },
    );
  }
}

test("sem token nem usuario redireciona sem nenhuma das três consultas", async () => {
  const tela = pagina(fixture(), { token: null, usuario: null });
  semDadosAnteriores(await consultar(tela));
  assert.equal(tela.chamadas.length, 0);
  assert.deepEqual(tela.substituicoes, ["/"]);
});

test("as três chamadas delegam Authorization ao interceptor sem config explícita", async () => {
  const tela = pagina(fixture(), { usarApiReal: false });
  await consultar(tela);
  assert.equal(tela.chamadas.length, 3);
  assert.ok(tela.chamadas.every((c) => c.config === undefined));
});

test("interceptor usa token renovado em todas as consultas da próxima criança", async () => {
  let rodada = 0;
  const tela = pagina(fixture(), {
    responder: (url) =>
      responderFixture(
        fixture(rodada ? USUARIO_B : USUARIO_A),
        rodada ? USUARIO_B : USUARIO_A,
      )(url),
  });
  await consultar(tela);
  rodada++;
  tela.definirToken("jwt-renovado-ficticio");
  tela.mudarCrianca(USUARIO_B);
  await consultar(tela);
  assert.equal(tela.chamadas.length, 6);
  assert.ok(
    tela.chamadas
      .slice(0, 3)
      .every((c) => c.config.headers.Authorization === "Bearer jwt-ficticio"),
  );
  assert.ok(
    tela.chamadas
      .slice(3)
      .every(
        (c) =>
          c.config.headers.Authorization === "Bearer jwt-renovado-ficticio",
      ),
  );
  assert.equal(
    tela.chamadas[4].url,
    `/criancas/${USUARIO_B}/resumo-desempenho`,
  );
});

for (const ultima of ROTAS) {
  test(
    "inicia três consultas paralelas e aguarda " +
      ultima +
      " antes de exibir relatório",
    async () => {
      const dados = fixture();
      const pendentes = new Map(
        ROTAS.map((rota) => [rota, promessaControlada()]),
      );
      const tela = pagina(dados, {
        responder: (url) => pendentes.get(url).promise,
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      assert.deepEqual(
        tela.chamadas.map((c) => c.url).sort(),
        [...ROTAS].sort(),
      );
      for (const rota of ROTAS.filter((r) => r !== ultima))
        pendentes.get(rota).resolve(responderFixture(dados)(rota));
      await tela.resolverConsulta();
      const aguardando = tela.renderizar();
      assert.match(aguardando, /Carregando relatório/);
      semDadosAnteriores(aguardando);
      pendentes.get(ultima).resolve(responderFixture(dados)(ultima));
      await tela.resolverConsulta();
      const html = tela.renderizar();
      assert.equal(linhasTabela(html).length, 3);
      assert.equal(indicadores(html).length, 3);
      assert.doesNotMatch(html, /Carregando relatório|role="alert"/);
      assert.equal(tela.prompts.length, 0);
    },
  );
}

for (const status of [401, 403]) {
  test(
    "erro antigo " +
      status +
      " não altera relatório nem sessão da criança atual",
    async () => {
      const antiga = promessaControlada();
      let nova = false;
      const atuais = fixture(USUARIO_B);
      atuais.criancas[0].nome = "Criança atual B";
      const tela = pagina(fixture(), {
        responder: async (url) => {
          if (!nova) await antiga.promise;
          return responderFixture(atuais, USUARIO_B)(url);
        },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      nova = true;
      tela.mudarCrianca(USUARIO_B);
      const antes = await consultar(tela);
      antiga.reject({
        response: { status, data: { mensagem: "Erro obsoleto" } },
      });
      await tela.resolverConsulta();
      assert.equal(tela.renderizar(), antes);
      assert.match(antes, /Criança atual B/);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );
}

for (const desfecho of ["sucesso", "401"]) {
  test(
    "finally antigo após " + desfecho + " não encerra carregamento atual",
    async () => {
      const antiga = promessaControlada();
      const atual = promessaControlada();
      let nova = false;
      const tela = pagina(fixture(), {
        responder: async (url) => {
          const ehNova = nova;
          await (ehNova ? atual.promise : antiga.promise);
          return responderFixture(
            fixture(ehNova ? USUARIO_B : USUARIO_A),
            ehNova ? USUARIO_B : USUARIO_A,
          )(url);
        },
      });
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      nova = true;
      tela.mudarCrianca(USUARIO_B);
      tela.renderizar();
      tela.executarEfeitos();
      await tela.resolverConsulta();
      if (desfecho === "sucesso") antiga.resolve();
      else antiga.reject({ response: { status: 401 } });
      await tela.resolverConsulta();
      const aguardando = tela.renderizar();
      assert.match(aguardando, /Carregando relatório/);
      assert.doesNotMatch(aguardando, /role="alert"/);
      semDadosAnteriores(aguardando);
      assert.deepEqual(tela.substituicoes, []);
      atual.resolve();
      await tela.resolverConsulta();
      assert.equal(linhasTabela(tela.renderizar()).length, 3);
    },
  );
}

for (const desfecho of ["sucesso", "401"]) {
  test(
    "desmontagem ignora " + desfecho + " atrasado sem alterar estado ou sessão",
    async () => {
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
      await tela.resolverConsulta();
      tela.limparEfeitos();
      const antes = tela.atualizacoesEstado.length;
      if (desfecho === "sucesso") pendente.resolve();
      else pendente.reject({ response: { status: 401 } });
      await tela.resolverConsulta();
      assert.equal(tela.atualizacoesEstado.length, antes);
      assert.equal(tela.armazenamento.get("token"), "jwt-ficticio");
      assert.ok(tela.armazenamento.has("usuario"));
      assert.deepEqual(tela.substituicoes, []);
    },
  );
}

test("preserva HTML, perfil, indicadores, cabeçalhos, classes e Usuario._id no retorno", async () => {
  const dados = fixture();
  dados.criancas.unshift({
    _id: USUARIO_A,
    usuarioId: USUARIO_B,
    nome: "Perfil errado",
  });
  const tela = pagina(dados);
  const html = await consultar(tela);
  assert.match(html, /<main class="pagina">/);
  assert.match(
    html,
    /<section class="painel"><h1>Relatório Final<\/h1><p class="descricao">/,
  );
  assert.match(
    html,
    /<div class="perfil"><img src="\/images\/Perfil.png" alt="Avatar da criança"/,
  );
  assert.match(html, /<h2>Criança da fixture<\/h2>/);
  assert.doesNotMatch(html, /Perfil errado/);
  assert.match(html, /<div class="indicadores">/);
  assert.equal([...html.matchAll(/<article class="indicador">/g)].length, 3);
  assert.match(
    html,
    /<h2 class="tituloTabela">Desempenho por cômodo<\/h2><div class="tabelaContainer"><table class="tabela">/,
  );
  assert.match(
    html,
    /<thead><tr><th>CÔMODO<\/th><th>TENTATIVAS<\/th><th>ACERTOS<\/th><th>ERROS<\/th><th>PERCENTUAL<\/th><\/tr><\/thead>/,
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
    (no) => no.props["aria-label"] === "Voltar para rendimento",
  );
  assert.equal(voltar.props.className, "voltar");
  assert.equal(voltar.props.href.pathname, "/responsavel/rendimento");
  assert.equal(voltar.props.href.query.id, USUARIO_A);
  assert.ok(
    nos.some(
      (no) =>
        no.type === "title" &&
        no.props.children === "Relatório Final | ConectaMente",
    ),
  );
  assert.ok(
    nos.some(
      (no) =>
        no.type === "meta" &&
        no.props.name === "description" &&
        no.props.content ===
          "Relatório de desempenho da criança no ConectaMente.",
    ),
  );
});

test("sucesso antigo não remove erro da consulta atual", async () => {
  const antiga = promessaControlada();
  let nova = false;
  const dados = fixture();
  const tela = pagina(dados, {
    responder: async (url) => {
      if (nova)
        throw {
          response: { status: 403, data: { mensagem: "Erro atual de B" } },
        };
      await antiga.promise;
      return responderFixture(dados)(url);
    },
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  nova = true;
  tela.mudarCrianca(USUARIO_B);
  await consultar(tela);
  antiga.resolve();
  await tela.resolverConsulta();
  const html = tela.renderizar();
  assert.match(html, /role="alert">Erro atual de B/);
  semDadosAnteriores(html);
});

test("sucesso antigo após ausência de token não repõe relatório nem consulta API novamente", async () => {
  const antiga = promessaControlada();
  const dados = fixture();
  const tela = pagina(dados, {
    responder: async (url) => {
      await antiga.promise;
      return responderFixture(dados)(url);
    },
  });
  tela.renderizar();
  tela.executarEfeitos();
  await tela.resolverConsulta();
  tela.mudarCrianca(USUARIO_B);
  tela.definirToken(null);
  await consultar(tela);
  antiga.resolve();
  await tela.resolverConsulta();
  const html = tela.renderizar();
  semDadosAnteriores(html);
  assert.doesNotMatch(html, /role="alert"|Carregando relatório/);
  assert.deepEqual(tela.substituicoes, ["/"]);
  assert.equal(tela.chamadas.length, 3);
});

test("sucesso de outra criança limpa erro anterior e apresenta novo relatório", async () => {
  let nova = false;
  const dados = fixture(USUARIO_B);
  dados.criancas[0].nome = "Criança atual B";
  const tela = pagina(fixture(), {
    responder: (url) => {
      if (!nova)
        throw {
          response: { status: 500, data: { mensagem: "Erro anterior" } },
        };
      return responderFixture(dados, USUARIO_B)(url);
    },
  });
  assert.match(await consultar(tela), /Erro anterior/);
  nova = true;
  tela.mudarCrianca(USUARIO_B);
  const html = await consultar(tela);
  assert.match(html, /Criança atual B/);
  assert.equal(linhasTabela(html).length, 3);
  assert.doesNotMatch(html, /Erro anterior|role="alert"|Carregando relatório/);
});

test(
  "HTTP local real: Relatório e interceptor Axios enviam JWT nas três consultas",
  { timeout: 5000 },
  async (t) => {
    const { createServer } = require("node:http");
    const { once } = require("node:events");
    const { readFileSync } = require("node:fs");
    const path = require("node:path");
    const vm = require("node:vm");
    const babel = require("next/dist/compiled/babel/core");
    const commonjs = require("next/dist/compiled/babel/plugin-transform-modules-commonjs");
    const dados = fixture();
    const recebidas = [];
    const servidor = createServer((req, res) => {
      recebidas.push({
        url: req.url,
        authorization: req.headers.authorization,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(responderFixture(dados)(req.url).data));
    });
    servidor.listen(0, "127.0.0.1");
    await once(servidor, "listening");
    t.after(() => new Promise((resolve) => servidor.close(resolve)));
    let apiReal;
    const pendentes = [];
    const tela = pagina(dados, {
      usarApiReal: false,
      token: "jwt-http-ficticio",
      responder: (url, config) => {
        const consulta = apiReal.get(url, config);
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
    assert.equal(pendentes.length, 3);
    await Promise.all(pendentes);
    await tela.resolverConsulta();
    assert.deepEqual(recebidas.map((r) => r.url).sort(), [...ROTAS].sort());
    assert.ok(
      recebidas.every((r) => r.authorization === "Bearer jwt-http-ficticio"),
    );
    assert.ok(tela.chamadas.every((c) => c.config === undefined));
    assert.equal(tela.prompts.length, 0);
    assert.deepEqual(tela.substituicoes, []);
    const html = tela.renderizar();
    assert.match(html, /Criança da fixture/);
    assert.equal(indicadores(html).length, 3);
    assert.equal(linhasTabela(html).length, 3);
  },
);
