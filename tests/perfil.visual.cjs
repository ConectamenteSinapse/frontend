// Validação visual no Chrome headless do build real; API interceptada, sem MongoDB.
// Executar depois de npm run build: node tests/perfil.visual.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { setTimeout: esperar } = require("node:timers/promises");

const root = path.resolve(__dirname, "..");
const destino = path.join(root, ".next/perfil-visual");
const perfilChrome = fs.mkdtempSync(path.join(os.tmpdir(), "conectamente-perfil-"));
const U = "111111111111111111111111", A = "222222222222222222222222", B = "333333333333333333333333";
const P2 = "999999999999999999999999";
let cenario = "normal", personagemEditado;
const edicoes = [], selecoes = [];
let dificuldadeAtual = "dificil", sessaoAtiva = false, inicios = 0, heartbeats = 0;
const sessaoId = "d852415e-23c4-4703-9ae0-681789481d74";
const tarefasQuartoIds = ["6aac3c29bee9f041e4728a8f", "6aac3c29bee9f041e4728a90", "6aac3c29bee9f041e4728a91"];
const salas = ["Quarto", "Banheiro", "Sala", "Cozinha"].map((nome, i) => ({
  _id: String(i + 4).repeat(24), nome, ordem: i + 1, ativo: true, imagemCenario: "/imagem-incorreta.png",
}));
const tarefas = [...tarefasQuartoIds.map((_id,i)=>({_id,comodoId:salas[0]._id,ativo:true,ordem:i+1})),
  ...salas.slice(1).map((sala,i)=>({_id:(i+10).toString(16).repeat(24),comodoId:sala._id,ativo:true,ordem:1}))];
const partida = (_id) => ({ _id, nomeJogo: _id === A ? "Minha aventura no Quarto" : "Outra aventura", perfilJogoId: _id === B ? P2 : U, dificuldade: _id === A ? dificuldadeAtual : "dificil", comodoId: salas[0]._id, tarefaId: tarefasQuartoIds[2] });
function dados(url) {
  if (url === `/jogos-salvos/${A}` || url === `/jogos-salvos/${B}`) return { ...partida(url.split('/').pop()), perfilJogoId: dados(`/perfis-jogo/${url.endsWith(A)?U:P2}`) };
  if (url === `/jogos-salvos/${A}/sessao`) { inicios++; sessaoAtiva=true; return { jogoSalvo: partida(A), sessaoId, estado: "ativa", expiraEm: new Date(Date.now()+30000).toISOString() }; }
  if (url.startsWith('/jogos-salvos/sessao/')) {
    if (url.endsWith('/encerrar')) sessaoAtiva=false; else heartbeats++;
    return { sessaoId, estado: sessaoAtiva ? 'ativa' : 'encerrada', expiraEm: new Date(Date.now()+30000).toISOString() };
  }
  if (url.startsWith('/tarefas/')) {
    const id=url.split('/')[2],i=tarefasQuartoIds.indexOf(id);
    if (i<0) return;
    if (url.endsWith('/respostas')) return [1,2,3,4].map(ordem=>({_id:(100+i*10+ordem).toString(16).padStart(24,'0'),tarefaId:id,ordem,texto:`Resposta ${ordem}`,imagem:`/images/quarto/respostas/${['cama','cortina','roupa'][i]}-${ordem}.png`}));
    return {_id:id,comodoId:salas[0]._id,enunciado:`Pergunta ${i+1}`};
  }
  if (personagemEditado && url === `/perfis-jogo/${U}`) return personagemEditado;
  if (url === `/perfis-jogo/${U}` || url === `/perfis-jogo/${P2}`) return {
    _id: url.split('/').pop(), nomeAvatar: cenario === "textos-longos" ? "PersonagemComNomeMuitoLongoSemEspacos".repeat(5) : url.endsWith(U) ? "Aventureiro" : "Aventureira",
    imagemAvatar: url.endsWith(U) ? "/images/boneco.png" : "/images/menina1.png", nivelAtual: url.endsWith(U) ? 1 : 2,
  };
  if (url === "/criancas/meu-perfil") {
    const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const hoje = ["year", "month", "day"].map((tipo) => partes.find((p) => p.type === tipo).value).join("-");
    return { usuarioId: U, sessaoJogoEstado: sessaoAtiva ? 'ativa' : 'encerrada', sessaoJogoExpiraEm: sessaoAtiva ? new Date(Date.now()+30000).toISOString() : null, permissaoAtiva: true, tempoUsadoHoje: cenario === "tempo-ausente" ? null : 7546.408, limiteTempoDiario: 180,
      dataReferenciaTempo: cenario === "tempo-anterior" ? "2000-01-01" : cenario === "data-invalida" ? "2026-02-30" : hoje };
  }
  if (url === "/usuarios/meu-perfil") return { nome: cenario === "textos-longos" ? "NomeDaCriancaMuitoLongoSemEspacos".repeat(5) : "Criança de demonstração" };
  if (url.endsWith("/resumo-desempenho")) return { resumo: { totalEstrelas: 51 } };
  if (url === "/jogos-salvos") return [cenario === "textos-longos" ? { ...partida(A), nomeJogo: "MinhaJornadaComIdentificacaoMuitoLonga".repeat(5) } : partida(A), partida(B)];
  if (url === "/comodos") return [...salas].reverse();
  if (url.startsWith("/comodos/") && url.endsWith("/tarefas")) return tarefas.filter((t) => url.includes(t.comodoId));
  if (url.endsWith("/progresso")) {
    if (cenario === "indisponivel") return {};
    const id = url.split("/")[2];
    return { jogoSalvoId: id, estrelasTotal: id === A ? 18 : 2,
      tarefas: id === A ? ["facil", "medio", "dificil"].flatMap((dificuldade) => tarefasQuartoIds.map(tarefaId => ({
        tarefaId, dificuldade, concluida: true, tentativas: 8, acertos: 6, erros: 2,
      }))) : [], comodos: salas.map((sala, i) => ({ comodoId: sala._id,
        estado: i === 0 && id === A ? "concluido" : i <= 1 ? "disponivel" : "bloqueado" })) };
  }
}

async function aguardar(verificar, descricao) {
  const fim = Date.now() + 20000;
  while (Date.now() < fim) { if (await verificar()) return; await esperar(100); }
  throw new Error(`Tempo excedido: ${descricao}`);
}

async function executar() {
  fs.mkdirSync(destino, { recursive: true });
  const portaServidor = await new Promise((resolve, reject) => {
    const reserva = net.createServer();
    reserva.on("error", reject);
    reserva.listen(0, "127.0.0.1", () => { const porta = reserva.address().port; reserva.close(() => resolve(porta)); });
  });
  const origem = `http://localhost:${portaServidor}`;
  const servidor = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "start", "-p", String(portaServidor)],
    { cwd: root, windowsHide: true, stdio: "ignore" });
  let chrome, ws;
  try {
    await aguardar(async () => { try { return (await fetch(`${origem}/perfil`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } }, "servidor local");
    chrome = spawn(process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
      "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
      `--user-data-dir=${perfilChrome}`, "about:blank",
    ], { windowsHide: true, stdio: "ignore" });
    const portaArquivo = path.join(perfilChrome, "DevToolsActivePort");
    await aguardar(() => fs.existsSync(portaArquivo), "Chrome headless");
    const porta = fs.readFileSync(portaArquivo, "utf8").split("\n")[0];
    const alvos = await (await fetch(`http://localhost:${porta}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
    ws = new WebSocket(alvos.find((alvo) => alvo.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error("Chrome não confirmou WebSocket")), 5000);
      ws.onopen = () => { clearTimeout(limite); resolve(); };
      ws.onerror = (error) => { clearTimeout(limite); reject(error); };
    });
    let id = 0;
    const pendentes = new Map();
    const consultasAPI = [];
    const respostasSuspensas = [];
    function enviar(method, params = {}) {
      return new Promise((resolve, reject) => {
        const pedido = ++id;
        const limite = setTimeout(() => { pendentes.delete(pedido); reject(new Error(`Chrome não respondeu: ${method}`)); }, 10000);
        pendentes.set(pedido, { resolve: (v) => { clearTimeout(limite); resolve(v); }, reject: (e) => { clearTimeout(limite); reject(e); } });
        ws.send(JSON.stringify({ id: pedido, method, params }));
      });
    }
    ws.onmessage = ({ data }) => {
      const evento = JSON.parse(data);
      if (evento.id) {
        const pedido = pendentes.get(evento.id); pendentes.delete(evento.id);
        if (!pedido) return;
        if (evento.error) pedido.reject(new Error(evento.error.message)); else pedido.resolve(evento.result);
      } else if (evento.method === "Fetch.requestPaused") {
        const { request, requestId } = evento.params;
        const url = new URL(request.url);
        if (url.origin === origem) enviar("Fetch.continueRequest", { requestId }).catch(() => {});
        else {
          if (request.method !== "OPTIONS") consultasAPI.push({ metodo: request.method, caminho: url.pathname });
          let body = request.method === "OPTIONS" ? {} : dados(url.pathname);
        if (request.method === "PATCH" && url.pathname === `/perfis-jogo/${U}`) {
          const campos = JSON.parse(request.postData);
          assert.deepEqual(Object.keys(campos).sort(), ["imagemAvatar", "nomeAvatar"]);
          edicoes.push(campos);
          personagemEditado = { _id: U, nivelAtual: 1, ...campos };
          body = personagemEditado;
        }
          if (request.method === "PATCH" && url.pathname === `/jogos-salvos/${A}`) {
            const campos=JSON.parse(request.postData);
            assert.deepEqual(Object.keys(campos).sort(),["comodoId","dificuldade","tarefaId"]);
            assert.equal(campos.comodoId,salas[0]._id);assert.equal(campos.tarefaId,tarefasQuartoIds[0]);
            selecoes.push(campos);dificuldadeAtual=campos.dificuldade;
            body={...partida(A),...campos};
          }
          const cabecalhos = [{ name: "Content-Type", value: "application/json" },
            { name: "Access-Control-Allow-Origin", value: "*" },
            { name: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,OPTIONS" },
              { name: "Access-Control-Allow-Headers", value: "authorization,content-type" }];
          const responder = () => enviar("Fetch.fulfillRequest", { requestId, responseCode: request.method === "OPTIONS" ? 204 : body === undefined ? 404 : request.method === "POST" ? 201 : 200,
            responseHeaders: cabecalhos, body: Buffer.from(JSON.stringify(body ?? {})).toString("base64") }).catch(() => {});
          if (cenario === "carregando" && url.pathname.endsWith("/progresso")) respostasSuspensas.push(responder);
          else responder();
        }
      }
    };
    async function avaliar(expression) {
      const resposta = await enviar("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
      if (resposta.exceptionDetails) throw new Error(resposta.exceptionDetails.exception?.description ?? resposta.exceptionDetails.text);
      return resposta.result.value;
    }
    await enviar("Page.enable"); await enviar("Network.enable");
    await enviar("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await enviar("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem('token','token-simulado-sem-validade'); localStorage.setItem('conectamente:ultima-partida:${U}','${A}');` });
    const resultados = [];
    async function verificarIntegridade() {
      const medidas = await avaliar(`(() => {
        const caixas=[...document.querySelectorAll('article')];
        const sobrepoe=(a,b)=>a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
        const sobreposicao=caixas.some((c,i)=>caixas.slice(i+1).some(o=>sobrepoe(c.getBoundingClientRect(),o.getBoundingClientRect()))) ||
          [...document.querySelectorAll('article dl > div')].some(r=>sobrepoe(r.querySelector('dt').getBoundingClientRect(),r.querySelector('dd').getBoundingClientRect()));
        const cortes=[...document.querySelectorAll('p,h2,h3,h4,dt,dd,a,span')].filter(e=>e.clientWidth>0&&e.scrollWidth>e.clientWidth+2).map(e=>e.tagName);
        const foraDoPai=[...document.querySelectorAll('p,h2,h3,h4,dt,dd,a,span')].filter(e=>{
          const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();
          return r.width>0&&(r.left<p.left-1||r.right>p.right+1);
        }).map(e=>e.tagName);
        return {largura:innerWidth,semRolagem:document.documentElement.scrollWidth<=document.documentElement.clientWidth,sobreposicao,cortes,foraDoPai};
      })()`);
      assert.equal(medidas.semRolagem, true); assert.equal(medidas.sobreposicao, false);
      assert.deepEqual(medidas.cortes, [], "textos não ultrapassam suas caixas");
      assert.deepEqual(medidas.foraDoPai, [], "textos permanecem dentro dos elementos pais");
      return medidas;
    }
    for (const largura of [360, 768, 1024, 1280, 1920]) {
      await enviar("Emulation.setDeviceMetricsOverride", { width: largura, height: 900, deviceScaleFactor: 1, mobile: false });
      await enviar("Page.navigate", { url: `${origem}/perfil` });
      await aguardar(() => avaliar(`document.querySelector('[aria-label="Cômodo Quarto"] dd')?.textContent.trim()==='Concluído' && [...document.querySelectorAll('article img')].length === 4 && [...document.querySelectorAll('article img')].every(i=>i.complete && i.naturalWidth>0)`), "jornada e ilustrações");
      const medidas = await avaliar(`(() => {
        const cards=[...document.querySelectorAll('article')]; const b=cards.map(c=>c.getBoundingClientRect());
        const perfil=document.querySelector('[aria-label="Meu Perfil"]').parentElement.getBoundingClientRect();
        const personagem=document.querySelector('[aria-label="Meu Personagem"]').parentElement.getBoundingClientRect();
        const jornada=document.querySelector('#minha-jornada').getBoundingClientRect();
        return {largura:innerWidth, larguraUtil:document.documentElement.clientWidth, larguraDocumento:document.documentElement.scrollWidth, cartoes:cards.length,
          linhas:document.querySelectorAll('article dd').length, colunas:b.filter(r=>Math.abs(r.top-b[0].top)<1).length,
          larguraGrade:document.querySelector('article').parentElement.getBoundingClientRect().width, largurasCartoes:b.map(r=>r.width),
          regioes: {ladoALado:Math.abs(perfil.top-personagem.top)<1,jornadaAbaixo:jornada.top>=Math.max(perfil.bottom,personagem.bottom),jornadaLarguraCompleta:Math.abs(jornada.left-perfil.left)<1&&jornada.right>=personagem.right},
          imagens:[...document.querySelectorAll('article img')].map(i=>({src:i.getAttribute('src'),ok:i.complete&&i.naturalWidth>0}))};
      })()`);
      assert.ok(medidas.larguraDocumento <= medidas.larguraUtil, "sem rolagem horizontal");
      assert.equal(medidas.cartoes, 4); assert.equal(medidas.linhas, 12);
      assert.equal(medidas.colunas, largura === 360 ? 1 : largura >= 1280 ? 4 : 2);
      assert.equal(medidas.regioes.ladoALado, largura > 1000);
      if (largura >= 1280) assert.ok(Math.min(...medidas.largurasCartoes) >= 268, "quatro cartões somente com largura útil legível");
      assert.equal(medidas.regioes.jornadaAbaixo, true); assert.equal(medidas.regioes.jornadaLarguraCompleta, true);
      assert.equal(await avaliar(`document.querySelector('select')===null`), true);
      assert.equal(await avaliar(`!document.body.innerText.includes('Contagem de cômodos')&&!document.body.innerText.includes('cômodos concluídos nesta partida')&&!document.body.innerText.includes('Ver partidas do Quarto')`), true);
      const botao = await avaliar(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='Escolher outra jornada');const r=a.getBoundingClientRect();return {altura:r.height,href:a.getAttribute('href')};})()`);
      assert.equal(botao.href, '/jogos-salvos'); assert.ok(botao.altura >= 44);
      assert.equal(await avaliar(`document.querySelectorAll('[aria-label^="Jogar Quarto no nível"]').length`),3);
      assert.equal(await avaliar(`[...document.querySelectorAll('[aria-label^="Jogar Quarto no nível"]')].every(b=>!b.disabled&&b.getBoundingClientRect().height>=44)`),true);
      assert.equal(await avaliar(`document.querySelectorAll('article:not([aria-label="Cômodo Quarto"]) button').length`),0);
      medidas.integridade = await verificarIntegridade();
      const { contentSize } = await enviar("Page.getLayoutMetrics");
      const captura = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
        clip: { x: 0, y: 0, width: largura, height: contentSize.height, scale: 1 } });
      fs.writeFileSync(path.join(destino, `perfil-${largura}.png`), Buffer.from(captura.data, "base64"));
      resultados.push(medidas);
    }
    const cenarios = [];
    for (const tipo of ["textos-longos", "indisponivel", "carregando"]) {
      cenario = tipo;
      for (const largura of [360, 768, 1024, 1280, 1920]) {
        await enviar("Emulation.setDeviceMetricsOverride", { width: largura, height: 900, deviceScaleFactor: 1, mobile: false });
        await enviar("Page.navigate", { url: `${origem}/perfil` });
        await aguardar(() => avaliar(`document.querySelectorAll('article dd').length===12 && document.body.innerText.includes('${tipo === "textos-longos" ? "NomeDaCriancaMuitoLongoSemEspacos" : tipo === "indisponivel" ? "Progresso da partida indisponível" : "Carregando progresso..."}')`), `cenário ${tipo}`);
        const medidas = await verificarIntegridade();
        if (tipo !== "textos-longos") assert.equal(await avaliar(`[...document.querySelectorAll('article dd')].every(e=>e.textContent.trim()==='Indisponível')`), true);
        if (largura === 360 || largura === 1280) {
          const { contentSize } = await enviar("Page.getLayoutMetrics");
          const captura = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: largura, height: contentSize.height, scale: 1 } });
          fs.writeFileSync(path.join(destino, `perfil-${tipo}-${largura}.png`), Buffer.from(captura.data, "base64"));
        }
        for (const responder of respostasSuspensas.splice(0)) await responder();
        cenarios.push({ tipo, ...medidas });
      }
    }
    for (const [tipo, texto] of [["tempo-hoje", "Tempo que você jogou hoje."], ["tempo-anterior", "Último tempo registrado em 01/01/2000"],
      ["tempo-ausente", "Não foi possível consultar seu tempo de jogo"], ["data-invalida", "A data do tempo registrado está indisponível"]]) {
      cenario = tipo;
      for (const largura of [360, 1280]) {
        await enviar("Emulation.setDeviceMetricsOverride", { width: largura, height: 900, deviceScaleFactor: 1, mobile: false });
        await enviar("Page.navigate", { url: `${origem}/perfil` });
        await aguardar(() => avaliar(`document.body?.innerText.includes(${JSON.stringify(texto)})`), tipo);
        assert.equal(await avaliar(`document.body.innerText.includes('Tempo que você jogou hoje.')`), tipo === "tempo-hoje");
        assert.equal(await avaliar(`document.body.innerText.includes('180 min')`), true);
        cenarios.push({ tipo, ...await verificarIntegridade() });
      }
    }
    cenario = "normal";
    await enviar("Page.navigate", { url: `${origem}/perfil` });
    await aguardar(() => avaliar(`document.querySelector('[aria-label="Cômodo Quarto"] dd')?.textContent.trim()==='Concluído'`), "jornada antes da navegação");
    let foco = false;
    for (let i = 0; i < 20; i++) {
      await enviar("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      await enviar("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
      if (await avaliar(`document.activeElement?.tagName==='A'&&document.activeElement.textContent.trim()==='Escolher outra jornada'`)) { foco = true; break; }
    }
    assert.equal(foco, true, "Escolher outra jornada acessível por Tab");
    assert.equal(await avaliar(`getComputedStyle(document.activeElement).outlineStyle==='solid'`), true, "foco visível");
    await enviar("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
    await enviar("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });

    await aguardar(() => avaliar(`[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Ver perfil').length===2`), "Jogos Salvos");
    await avaliar(`[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Ver perfil')[1].click()`);
    await aguardar(() => avaliar(`document.querySelector('[aria-label="Cômodo Quarto"] dd')?.textContent.trim()==='Não iniciado' && document.body.innerText.includes('Aventureira') && document.querySelector('[aria-label="Estrelas da partida consultada"]')?.innerText.includes('2 estrelas')`), "Ver perfil de outra jornada");
    assert.equal(await avaliar(`location.pathname==='/perfil'&&new URLSearchParams(location.search).get('jogoSalvoId')==='${B}'`), true);
    assert.equal(await avaliar(`localStorage.getItem('conectamente:ultima-partida:${U}')`), A);
    assert.equal(consultasAPI.every((c) => c.metodo === "GET" && !/sessao|heartbeat|responder/.test(c.caminho)), true);
    await enviar("Page.navigate", { url: `${origem}/perfil?jogoSalvoId=888888888888888888888888` });
    await aguardar(() => avaliar(`document.body?.innerText.includes('Partida inválida ou indisponível para esta conta')`), "ID não autorizado");
    assert.equal(await avaliar(`document.querySelector('[aria-label="Estrelas da partida consultada"]').innerText==='Escolha uma jornada'`), true);
    await enviar("Page.navigate", { url: `${origem}/perfil` });
    await aguardar(() => avaliar(`document.querySelector('[aria-label="Cômodo Quarto"] dd')?.textContent.trim()==='Concluído'`), "última partida jogada preservada");
    await enviar("Network.setBlockedURLs", { urls: ["*/images/perfil/quarto.png"] });
    await enviar("Page.reload", { ignoreCache: true });
    await aguardar(() => avaliar(`!!document.querySelector('[aria-label="Ilustração do Quarto indisponível"]')`), "alternativa da imagem");
    cenario="normal";
    const edicaoVisual=[];
    for (const [i,largura] of [360,768,1280,1920].entries()) {
      await enviar("Emulation.setDeviceMetricsOverride",{width:largura,height:900,deviceScaleFactor:1,mobile:false});
      await enviar("Page.navigate",{url:`${origem}/perfil`});
      await aguardar(()=>avaliar(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Editar'&&!b.disabled)`),"personagem confirmado para editar");
      await avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Editar').click()`);
      await aguardar(()=>avaliar(`!!document.querySelector('dialog:modal')`),"editor modal");
      await aguardar(()=>avaliar(`[...document.querySelectorAll('dialog img')].every(i=>i.complete&&i.naturalWidth>0)`),"quatro avatares existentes");
      const medidas=await avaliar(`(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {largura:innerWidth,dentro:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,foco:document.activeElement.id==='nome-personagem',avatares:d.querySelectorAll('input[type="radio"]').length,overflow:document.documentElement.scrollWidth>innerWidth}})()`);
      assert.equal(medidas.dentro,true);assert.equal(medidas.foco,true);assert.equal(medidas.avatares,4);assert.equal(medidas.overflow,false);
      const captura=await enviar("Page.captureScreenshot",{format:"png"});
      fs.writeFileSync(path.join(destino,`editar-personagem-${largura}.png`),Buffer.from(captura.data,"base64"));
      const nome=`Luna ${largura}`,imagem=['/images/boneco.png','/images/boneco2.png','/images/menina1.png','/images/menina2.png'][i];
      await avaliar(`(()=>{const input=document.querySelector('#nome-personagem');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(nome)});input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('dialog input[value="${imagem}"]').click();})()`);
      await avaliar(`document.querySelector('dialog button[type="submit"]').click()`);
      await aguardar(()=>avaliar(`!document.querySelector('dialog')&&document.querySelector('[aria-label="Meu Perfil"]').innerText.includes(${JSON.stringify(nome)})`),"edição confirmada");
      assert.equal(edicoes.length,i+1);
      await enviar("Page.reload",{ignoreCache:true});
      await aguardar(()=>avaliar(`document.querySelector('[aria-label="Meu Perfil"]')?.innerText.includes(${JSON.stringify(nome)})&&document.querySelector('[aria-label="Meu Personagem"] img')?.getAttribute('src')===${JSON.stringify(imagem)}`),"nome e avatar restaurados da API");
      assert.equal(await avaliar(`document.querySelector('[aria-label="Meu Perfil"]').innerText.includes('Criança de demonstração')`),true);
      edicaoVisual.push({...medidas,persistidoNaApiSimulada:true});
    }
    assert.equal(consultasAPI.some(c=>/sessao|heartbeat|historico-jogo/.test(c.caminho)),false);
    const selecaoVisual=[];
    for(const [i,nivel] of ['Fácil','Médio'].entries()){
      await enviar('Page.navigate',{url:`${origem}/perfil`});
      await aguardar(()=>avaliar(`!!document.querySelector('[aria-label="Jogar Quarto no nível ${nivel}"]:not(:disabled)')`),'dificuldade concluída disponível');
      const sessoesAntes=inicios,hbAntes=heartbeats;
      await avaliar(`(()=>{const b=document.querySelector('[aria-label="Jogar Quarto no nível ${nivel}"]');b.click();b.click()})()`);
      await aguardar(()=>avaliar(`location.pathname==='/jogo/quarto'&&document.body.innerText.includes('Nível ${nivel} concluído!')`),'seleção confirmada e entrada automática');
      assert.equal(selecoes.length,i+1);assert.equal(selecoes[i].dificuldade,i===0?'facil':'medio');
      assert.equal(inicios,sessoesAntes+1);
      await avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Praticar novamente').click()`);
      await aguardar(()=>avaliar(`document.body.innerText.includes('Ver conclusão do nível')`),'prática do nível concluído');
      await avaliar(`document.querySelector('img[alt="Janela"]').click()`);
      await aguardar(()=>avaliar(`!!document.querySelector('dialog:modal')`),'prática mantém ordem da rodada');
      await avaliar(`document.querySelector('dialog button').click()`);
      await aguardar(()=>heartbeats>hbAntes,'heartbeat após escolha pelo Perfil');
      assert.equal(inicios,sessoesAntes+1);
      await avaliar(`document.querySelector('[aria-label="Sair da partida"]').click()`);
      await aguardar(()=>avaliar(`location.pathname==='/jogos-salvos'`),'encerramento real preservado');
      assert.equal(sessaoAtiva,false);
      selecaoVisual.push({nivel,patchUnico:true,sessaoUnica:true,heartbeat:true,praticaOrdenada:true,encerramento:true});
    }
    const resultado = { navegador: "Chrome headless", dados: "API simulada; sem acesso ao MongoDB", resultados, cenarios,
      edicaoVisual, selecaoVisual, botaoJornadaPorTeclado: true, contagemRemovida: true, botaoCartaoRemovido: true, verPerfil: true, preferenciaPreservada: true, consultaSemSessao: true, idNaoAutorizado: true, imagemAlternativa: true };
    fs.writeFileSync(path.join(destino, "resultado.json"), JSON.stringify(resultado, null, 2));
    console.log(JSON.stringify(resultado, null, 2));
  } finally {
    ws?.close(); chrome?.kill(); servidor.kill();
  }
}
executar().catch((error) => { console.error(error.message); process.exitCode = 1; });
