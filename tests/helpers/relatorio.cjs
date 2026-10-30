const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { setImmediate: nextTurn } = require("node:timers/promises");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const babel = require("next/dist/compiled/babel/core");
const presetReact = require("next/dist/compiled/babel/preset-react");
const commonjs = require("next/dist/compiled/babel/plugin-transform-modules-commonjs");

// Compila o componente real em memória, sem copiar sua lógica nem editar produção.
function compilarPagina(pagina) {
  assert.ok(
    [
      "relatorio",
      "percentual",
      "evolucao",
      "resumo",
      "contas",
      "adicionar-conta",
      "detalhes",
    ].includes(pagina),
    "Página não autorizada no helper",
  );
  const arquivo = path.resolve(
    __dirname,
    ["contas", "adicionar-conta", "detalhes"].includes(pagina)
      ? "../../src/pages/responsavel"
      : "../../src/pages/responsavel/rendimento",
    pagina,
    "index.js",
  );
  const { code } = babel.transformSync(readFileSync(arquivo, "utf8"), {
    filename: arquivo,
    babelrc: false,
    configFile: false,
    presets: [[presetReact, { runtime: "automatic" }]],
    plugins: [commonjs],
  });
  return { arquivo, code };
}

function promessaControlada() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

// Harness unitário: controla useState/useEffect e router. NÃO simula o DOM,
// reconciliador React, StrictMode, Next Router real ou eventos de navegador.
// HTML é produzido pelo renderizador real do React a partir do JSX executado.
function montarRelatorio({
  pagina = "relatorio",
  id,
  isReady = true,
  token = "jwt-ficticio",
  responder,
}) {
  // Parâmetro opcional mantém compatibilidade com os testes do relatório.
  const { arquivo, code } = compilarPagina(pagina);
  const navegacoes = [];
  const router = {
    isReady,
    query: { id },
    push(destino) {
      navegacoes.push(destino);
      return Promise.resolve(true);
    },
  };
  const chamadas = [];
  const prompts = [];
  const errosConsole = [];
  const logsConsole = [];
  const alertas = [];
  const atualizacoesEstado = [];
  const estados = [];
  const referencias = [];
  const dependencias = [];
  const limpezas = [];
  const efeitos = [];
  const callbacksEfeitos = [];
  let arvore;
  let indiceEstado = 0;
  let indiceReferencia = 0;
  let indiceEfeito = 0;
  let tokenAtual = token;
  const api = {
    get(url, config) {
      chamadas.push({ url, config });
      return Promise.resolve().then(() => responder(url, config));
    },
    post(url, body, config) {
      chamadas.push({ metodo: "POST", url, body, config });
      return Promise.resolve().then(() => responder(url, config, body));
    },
    patch(url, body, config) {
      chamadas.push({ metodo: "PATCH", url, body, config });
      return Promise.resolve().then(() => responder(url, config, body));
    },
    delete(url, config) {
      chamadas.push({ metodo: "DELETE", url, config });
      return Promise.resolve().then(() => responder(url, config));
    },
  };
  const hooks = {
    useRef(inicial) {
      const indice = indiceReferencia++;
      if (!(indice in referencias)) referencias[indice] = { current: inicial };
      return referencias[indice];
    },
    useState(inicial) {
      const indice = indiceEstado++;
      if (!(indice in estados)) estados[indice] = inicial;
      return [
        estados[indice],
        (valor) => {
          atualizacoesEstado.push({ indice, valor });
          estados[indice] =
            typeof valor === "function" ? valor(estados[indice]) : valor;
        },
      ];
    },
    useEffect(callback, deps) {
      const indice = indiceEfeito++;
      const anterior = dependencias[indice];
      if (
        !anterior ||
        deps.some((valor, i) => !Object.is(valor, anterior[i]))
      ) {
        dependencias[indice] = [...deps];
        efeitos.push({ indice, callback });
      }
    },
  };
  const modules = {
    react: hooks,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "next/head": { __esModule: true, default: () => null },
    "next/link": {
      __esModule: true,
      default: ({ children }) => React.createElement("a", null, children),
    },
    "next/router": { useRouter: () => router },
    "../../../../services/api": { __esModule: true, default: api },
    "../../../services/api": { __esModule: true, default: api },
    ["./" +
    {
      relatorio: "Relatorio",
      percentual: "Percentual",
      evolucao: "Evolucao",
      resumo: "Resumo",
      contas: "Contas",
      "adicionar-conta": "AdcionarConta",
      detalhes: "Detalhes",
    }[pagina] +
    ".module.css"]: {
      __esModule: true,
      default: new Proxy({}, { get: (_, nome) => String(nome) }),
    },
  };
  const contexto = {
    exports: {},
    alert(mensagem) {
      alertas.push(mensagem);
    },
    require(nome) {
      assert.ok(Object.hasOwn(modules, nome), "Import não simulado: " + nome);
      return modules[nome];
    },
    window: {
      prompt(mensagem) {
        prompts.push(mensagem);
        return tokenAtual;
      },
    },
    console: {
      log(...args) {
        logsConsole.push(args);
      },
      error(...args) {
        errosConsole.push(args);
      },
    },
  };
  vm.runInNewContext(code, contexto, { filename: arquivo });
  const Componente = contexto.exports.default;
  return {
    chamadas,
    prompts,
    errosConsole,
    logsConsole,
    alertas,
    navegacoes,
    atualizacoesEstado,
    get arvore() {
      return arvore;
    },
    renderizar() {
      indiceEstado = 0;
      indiceReferencia = 0;
      indiceEfeito = 0;
      arvore = Componente();
      return renderToStaticMarkup(arvore);
    },
    executarEfeitos() {
      for (const { indice, callback } of efeitos.splice(0)) {
        if (typeof limpezas[indice] === "function") limpezas[indice]();
        callbacksEfeitos[indice] = callback;
        limpezas[indice] = callback();
      }
    },
    limparEfeitos() {
      for (let indice = 0; indice < limpezas.length; indice++) {
        if (typeof limpezas[indice] === "function") limpezas[indice]();
        limpezas[indice] = undefined;
      }
    },
    // Reproduz SOMENTE setup → cleanup → setup com estado preservado.
    // Não monta um reconciliador React nem habilita StrictMode real.
    repetirEfeitos() {
      callbacksEfeitos.forEach((callback, indice) =>
        efeitos.push({ indice, callback }),
      );
      this.executarEfeitos();
    },
    async resolverConsulta() {
      await nextTurn();
    },
    mudarCrianca(novoId) {
      router.query = { id: novoId };
    },
    definirToken(novoToken) {
      tokenAtual = novoToken;
    },
  };
}

function linhasTabela(html) {
  const tbody = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!tbody) return [];
  return [...tbody[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((linha) =>
    [...linha[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (celula) => celula[1],
    ),
  );
}

function indicadores(html) {
  return [
    ...html.matchAll(
      /<article[^>]*>[\s\S]*?<span class="valor">(.*?)<\/span>[\s\S]*?<p>(.*?)<\/p>[\s\S]*?<\/article>/g,
    ),
  ].map((item) => [item[2], item[1]]);
}

module.exports = {
  montarRelatorio,
  promessaControlada,
  linhasTabela,
  indicadores,
};
