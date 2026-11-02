// Cena e página reais no Chrome; contratos da API simulados, sem MongoDB.
// npm run build && node tests/quarto.entrada.visual.cjs
// Para exercitar StrictMode real: definir QUARTO_VISUAL_DEV=1 e executar o roteiro.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), net = require("node:net");
const { spawn } = require("node:child_process");
const { setTimeout: esperar } = require("node:timers/promises");
const root = path.resolve(__dirname, "..");
const destino = path.join(root, ".next/quarto-entrada-visual");
const perfilChrome = fs.mkdtempSync(path.join(os.tmpdir(), "conectamente-quarto-"));
const A="222222222222222222222222", B="333333333333333333333333", P="444444444444444444444444", U="111111111111111111111111", Q="6aac3a3ea0d0e3c33530c5d2";
const S="d852415e-23c4-4703-9ae0-681789481d74";
const IDS=["6aac3c29bee9f041e4728a8f","6aac3c29bee9f041e4728a90","6aac3c29bee9f041e4728a91"];
let avatarVisual="/images/boneco.png", dificuldadeVisual="facil";
const partida=(id)=>({_id:id,perfilJogoId:{_id:P,nomeAvatar:"Luna",imagemAvatar:avatarVisual},nomeJogo:"Partida da fixture",dificuldade:dificuldadeVisual});
let segurarInicio=true, inicioSuspenso, modoPratica=false, estrelasPratica=18, tentativasPratica=0;
function dados(url, metodo) {
  if (url === `/comodos/${Q}/tarefas`) return IDS.map((_id,i)=>({_id,comodoId:Q,ativo:true,ordem:i+1}));
  if (url === '/historico-jogo/responder' && metodo === 'POST') {
    tentativasPratica++; estrelasPratica+={facil:1,medio:2,dificil:3}[dificuldadeVisual];
    return {acertou:true,tentativa:tentativasPratica,pontuacaoGanha:{facil:1,medio:2,dificil:3}[dificuldadeVisual],dificuldade:dificuldadeVisual};
  }
  if (url==="/jogos-salvos") return metodo==="POST" ? partida(B) : [partida(A)];
  if (url===`/jogos-salvos/${A}` || url===`/jogos-salvos/${B}`) return partida(url.split('/').pop());
  if (url==="/perfis-jogo") return [{_id:P,nomeAvatar:"Personagem 1",imagemAvatar:"/images/boneco.png"}];
  if (url.endsWith('/sessao')) return {jogoSalvo:partida(url.split('/')[2]),sessaoId:S,estado:"ativa",expiraEm:new Date(Date.now()+30000).toISOString()};
  if (url.includes('/sessao/')) return {sessaoId:S,estado:url.endsWith('/encerrar')?"encerrada":"ativa",expiraEm:new Date(Date.now()+30000).toISOString()};
  if (url.endsWith('/progresso')) return {jogoSalvoId:url.split('/')[2],estrelasTotal:modoPratica?estrelasPratica:0,tarefas:modoPratica?IDS.map(tarefaId=>({tarefaId,dificuldade:dificuldadeVisual,concluida:true})):[],comodos:[{comodoId:Q,estado:"disponivel"}]};
  if (url.startsWith('/tarefas/')) {
    const id=url.split('/')[2],i=IDS.indexOf(id);
    if (i<0) return;
    if (url.endsWith('/respostas')) return [1,2,3,4].map((ordem)=>({_id:(i*10+ordem+100).toString(16).padStart(24,'0'),tarefaId:id,ordem,texto:`Alternativa ${ordem}`,imagem:`/images/quarto/respostas/${['cama','cortina','roupa'][i]}-${ordem}.png`}));
    return {_id:id,comodoId:Q,enunciado:['Como arrumar a cama?','Como abrir a cortina?','Como trocar de roupa?'][i]};
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
  const origem = process.env.QUARTO_VISUAL_ORIGEM || `http://localhost:${portaServidor}`;
  if (!["localhost", "127.0.0.1"].includes(new URL(origem).hostname)) throw new Error("A origem de teste deve ser local.");
  const servidor = process.env.QUARTO_VISUAL_ORIGEM ? null : spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), (process.env.QUARTO_VISUAL_DEV === "1" ? "dev" : "start"), "-p", String(portaServidor)],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  let logServidor = "";
  servidor?.stdout.on("data", (d) => { logServidor = (logServidor + d).slice(-3000); });
  servidor?.stderr.on("data", (d) => { logServidor = (logServidor + d).slice(-3000); });
  let chrome, ws;
  try {
    try {
      await aguardar(async () => { try { return (await fetch(`${origem}/menu`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } }, "servidor local");
    } catch (error) {
      throw new Error(`${error.message}\n${logServidor}`);
    }
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
          const body = dados(url.pathname, request.method);
          const cabecalhos = [{ name: "Content-Type", value: "application/json" },
            { name: "Access-Control-Allow-Origin", value: "*" },
            { name: "Access-Control-Allow-Methods", value: "GET,POST,PATCH,OPTIONS" },
            { name: "Access-Control-Allow-Headers", value: "authorization,content-type" }];
          const responder = () => enviar("Fetch.fulfillRequest", { requestId, responseCode: request.method === "OPTIONS" ? 204 : body === undefined ? 404 : request.method === "POST" ? 201 : 200,
            responseHeaders: cabecalhos, body: Buffer.from(JSON.stringify(body ?? {})).toString("base64") }).catch(() => {});
          if (segurarInicio && request.method === "POST" && url.pathname.endsWith("/sessao")) inicioSuspenso = responder;
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
    await enviar("Emulation.setDeviceMetricsOverride", { width:1280,height:900,deviceScaleFactor:1,mobile:false });
    await enviar("Page.navigate",{url:origem});
    await avaliar(`localStorage.setItem('token','jwt-ficticio');localStorage.setItem('usuario',JSON.stringify({id:'${U}',perfil:'crianca'}));`);
    await enviar("Page.navigate",{url:`${origem}/jogos-salvos`});
    await aguardar(()=>avaliar(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Continuar jogo')`),"Jogos Salvos");
    await avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Continuar jogo').click()`);
    await aguardar(()=>inicioSuspenso&&avaliar(`document.body?.innerText.includes('Preparando seu jogo...')`),"POST automático pendente");
    assert.equal(await avaliar(`!!document.querySelector('[aria-label="Sair da partida"]')`),false);
    assert.equal(await avaliar(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Iniciar jogo')`),false);
    const inicios=()=>consultasAPI.filter(c=>c.metodo==='POST'&&c.caminho.endsWith('/sessao'));
    assert.equal(inicios().length,1); assert.equal(consultasAPI.some(c=>c.caminho.endsWith('/heartbeat')),false);
    const captura=await enviar("Page.captureScreenshot",{format:"png"});
    fs.writeFileSync(path.join(destino,"preparando.png"),Buffer.from(captura.data,"base64"));
    segurarInicio=false;await inicioSuspenso();
    await aguardar(()=>avaliar(`!!document.querySelector('[aria-label="Sair da partida"]') && document.body.innerText.includes('Fácil')`),"cena após POST confirmado");
    const cena=await enviar("Page.captureScreenshot",{format:"png"});fs.writeFileSync(path.join(destino,"entrada-direta.png"),Buffer.from(cena.data,"base64"));
    const layouts = [];
    for (const [width,height] of [[360,800],[768,1024],[1280,720],[1920,1080],[768,360]]) {
      await enviar("Emulation.setDeviceMetricsOverride", {width,height,deviceScaleFactor:1,mobile:false});
      await avaliar(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      const layout = await avaliar(`(()=>{
        const button=document.querySelector('[aria-label="Sair da partida"]');
        const hud=document.querySelector('[class*="badgeConquista"]');
        const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        const b=rect(button),h=rect(hud),style=getComputedStyle(button);
        return {button:b,hud:h,text:button.textContent.trim(),background:style.backgroundColor,color:style.color,borderRadius:style.borderRadius,
          overflow:document.documentElement.scrollWidth>innerWidth,
          collision:b.left<h.right&&b.right>h.left&&b.top<h.bottom&&b.bottom>h.top};
      })()`);
      assert.equal(layout.text,"Sair da partida");
      assert.equal(layout.overflow,false);
      assert.equal(layout.collision,false,"saída não cobre indicadores");
      assert.ok(layout.button.height>=48);
      assert.equal(layout.background,"rgb(7, 88, 201)");
      assert.equal(layout.color,"rgb(255, 255, 255)");
      const shot=await enviar("Page.captureScreenshot",{format:"png"});
      fs.writeFileSync(path.join(destino,`quarto-${width}x${height}.png`),Buffer.from(shot.data,"base64"));
      const antesOrientacao=consultasAPI.length;
      await avaliar(`document.querySelector('img[alt="Janela"]').click()`);
      await aguardar(()=>avaliar(`!!document.querySelector('dialog:modal')`),"orientação modal nativa");
      const orientacao=await avaliar(`(()=>{
        const d=document.querySelector('dialog:modal'),r=d.getBoundingClientRect();
        return {texto:d.innerText,foco:document.activeElement===d.querySelector('button'),dentro:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,centralizado:Math.abs((r.left+r.right)/2-innerWidth/2)<1&&Math.abs((r.top+r.bottom)/2-innerHeight/2)<1};
      })()`);
      assert.equal(orientacao.texto,"Ordem errada!\n\nTente novamente!\n\nEntendi");
      assert.equal(orientacao.foco,true);assert.equal(orientacao.dentro,true);assert.equal(orientacao.centralizado,true);
      assert.equal(consultasAPI.length,antesOrientacao,"orientação não consulta nem registra tentativa");
      const modalShot=await enviar("Page.captureScreenshot",{format:"png"});
      fs.writeFileSync(path.join(destino,`orientacao-${width}x${height}.png`),Buffer.from(modalShot.data,"base64"));
      await avaliar(`document.querySelector('dialog button').click()`);
      await aguardar(()=>avaliar(`!document.querySelector('dialog')`),"Entendi fecha orientação");
      layouts.push({width,height,...layout,orientacao});
    }
    assert.equal(await avaliar(`localStorage.getItem('conectamente:ultima-partida:${U}')`),A);
    await aguardar(()=>consultasAPI.some(c=>c.metodo==='PATCH'&&c.caminho.endsWith('/heartbeat')),"heartbeat ativo");
    assert.equal(inicios().length,1);
    await avaliar(`document.querySelector('[aria-label="Sair da partida"]').click()`);
    await aguardar(()=>avaliar(`location.pathname==='/jogos-salvos'`),"saída confirmada");
    assert.equal(consultasAPI.filter(c=>c.metodo==='PATCH'&&c.caminho.endsWith('/encerrar')).length,1);
    await enviar("Page.navigate",{url:`${origem}/escolher-personagem`});
    await aguardar(()=>avaliar(`!!document.querySelector('[aria-label="Começar"]')&&window.next?.router?.isReady&&window.next.router.pathname==='/escolher-personagem'`),"Novo Jogo hidratado");
    await avaliar(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
    await avaliar(`document.querySelector('[aria-label="Começar"]').click()`);
    try {
      await aguardar(()=>avaliar(`location.pathname==='/jogo/quarto'&&new URLSearchParams(location.search).get('jogoSalvoId')==='${B}'&&!!document.querySelector('[aria-label="Sair da partida"]')`),"Novo Jogo entra automaticamente");
    } catch (error) {
      console.error(await avaliar(`JSON.stringify({rota:location.pathname,texto:document.body.innerText.slice(-400)})`));
      console.error(JSON.stringify(consultasAPI)); throw error;
    }
    assert.equal(inicios().length,2);assert.deepEqual(inicios().map(c=>c.caminho),[`/jogos-salvos/${A}/sessao`,`/jogos-salvos/${B}/sessao`]);
    await avaliar(`document.querySelector('[aria-label="Sair da partida"]').click()`);
    await aguardar(()=>avaliar(`location.pathname==='/jogos-salvos'`),"encerrar segunda partida");
    const iniciosAntesPratica=inicios().length;
    const heartbeatsAntesPratica=consultasAPI.filter(c=>c.metodo==='PATCH'&&c.caminho.endsWith('/heartbeat')).length;
    modoPratica=true;dificuldadeVisual="medio";
    await enviar("Emulation.setDeviceMetricsOverride",{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    await enviar("Page.navigate",{url:`${origem}/jogo/quarto?jogoSalvoId=${A}`});
    await aguardar(()=>avaliar(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Praticar novamente')`),"partida concluída restaurada");
    const praticar=()=>avaliar(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Praticar novamente').click()`);
    const postRespostas=()=>consultasAPI.filter(c=>c.metodo==='POST'&&c.caminho==='/historico-jogo/responder').length;
    await praticar();
    await aguardar(()=>avaliar(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Ver conclusão do nível')`),"rodada iniciada pelo catálogo");
    const bloquear=async alt=>{
      const antes=postRespostas();
      await avaliar(`document.querySelector('img[alt="${alt}"]').click()`);
      await aguardar(()=>avaliar(`!!document.querySelector('dialog:modal')`),"tarefa fora de ordem bloqueada");
      assert.equal(postRespostas(),antes);
      await avaliar(`document.querySelector('dialog button').click()`);
      await aguardar(()=>avaliar(`!document.querySelector('dialog')`),"Entendi fecha orientação");
    };
    await bloquear("Janela");await bloquear("Guarda Roupa");assert.equal(postRespostas(),0);
    for (const [i,alt] of ["Cama","Janela","Guarda Roupa"].entries()) {
      await avaliar(`document.querySelector('img[alt="${alt}"]').click()`);
      await aguardar(()=>avaliar(`document.querySelectorAll('button[aria-label^="Selecionar:"]').length===4`),"pergunta da próxima tarefa");
      assert.equal(postRespostas(),i);
      await avaliar(`(()=>{const b=document.querySelector('button[aria-label^="Selecionar:"]');b.click();b.click()})()`);
      await aguardar(()=>avaliar(`document.body.innerText.includes('Muito bem! Você acertou!')`),"acerto 201 confirmado");
      assert.equal(postRespostas(),i+1);
      if (i===0) {
        await avaliar(`document.querySelector('button[aria-label="Fechar pergunta"]').click()`);
        await bloquear("Janela");
        await esperar(1600);
      } else await aguardar(()=>avaliar(`!document.querySelector('button[aria-label="Fechar pergunta"]')`),"animação terminada");
    }
    assert.equal(postRespostas(),3);
    assert.equal(await avaliar(`document.body.innerText.includes('Tarefas 3/3')&&document.body.innerText.includes('Estrelas: 24')`),true);
    await aguardar(()=>avaliar(`document.body.innerText.includes('Rodada de prática concluída!')`),"cartão automático da prática após última animação");
    await esperar(350);
    for(const width of [360,768,1280,1920]){
      await enviar("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:false});
      await avaliar(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
      assert.equal(await avaliar(`(()=>{const r=document.querySelector('[class*="cardContainerFim"]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()`),true);
      const imagem=await enviar("Page.captureScreenshot",{format:"png"});
      fs.writeFileSync(path.join(destino,`pratica-concluida-${width}.png`),Buffer.from(imagem.data,"base64"));
    }
    await enviar("Emulation.setDeviceMetricsOverride",{width:1280,height:720,deviceScaleFactor:1,mobile:false});
    const cartaoPratica=await enviar("Page.captureScreenshot",{format:"png"});
    fs.writeFileSync(path.join(destino,"pratica-concluida.png"),Buffer.from(cartaoPratica.data,"base64"));
    assert.deepEqual(await avaliar(`[...document.querySelectorAll('[class*="cardContainerFim"] button')].map(b=>b.textContent.trim())`),['Praticar novamente','Sair da partida']);
    await praticar();await aguardar(()=>avaliar(`![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Praticar novamente')`),"nova rodada explícita");
    await bloquear("Janela");await bloquear("Guarda Roupa");assert.equal(postRespostas(),3);
    assert.equal(inicios().length,iniciosAntesPratica+1,"somente a entrada cria sessão; rodadas não criam outra");
    await aguardar(()=>consultasAPI.filter(c=>c.metodo==='PATCH'&&c.caminho.endsWith('/heartbeat')).length>heartbeatsAntesPratica,"heartbeat continua após prática e nova rodada");
    assert.equal(inicios().length,iniciosAntesPratica+1);
    const praticaShot=await enviar("Page.captureScreenshot",{format:"png"});
    fs.writeFileSync(path.join(destino,"pratica-nova-rodada.png"),Buffer.from(praticaShot.data,"base64"));
    for(const alt of ["Cama","Janela","Guarda Roupa"]){
      await avaliar(`document.querySelector('img[alt="${alt}"]').click()`);
      await aguardar(()=>avaliar(`document.querySelectorAll('button[aria-label^="Selecionar:"]').length===4`),"pergunta da segunda rodada");
      await avaliar(`document.querySelector('button[aria-label^="Selecionar:"]').click()`);
      await aguardar(()=>avaliar(`!document.querySelector('button[aria-label="Fechar pergunta"]')`),"fim da animação da segunda rodada");
    }
    await aguardar(()=>avaliar(`document.body.innerText.includes('Rodada de prática concluída!')`),"segunda conclusão automática");
    assert.equal(postRespostas(),6);
    const encerramentosAntes=consultasAPI.filter(c=>c.metodo==='PATCH'&&c.caminho.endsWith('/encerrar')).length;
    await avaliar(`(()=>{const b=[...document.querySelectorAll('[class*="cardContainerFim"] button')].find(b=>b.textContent.trim()==='Sair da partida');b.click();b.click()})()`);
    await aguardar(()=>avaliar(`location.pathname==='/jogos-salvos'`),"saída pelo cartão de prática");
    assert.equal(consultasAPI.filter(c=>c.metodo==='PATCH'&&c.caminho.endsWith('/encerrar')).length,encerramentosAntes+1);
    const avataresVisuais=[];
    for(const [i,width] of [360,768,1280,1920].entries()){
      avatarVisual=['/images/boneco.png','/images/boneco2.png','/images/menina1.png','/images/menina2.png'][i];
      await enviar('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await enviar('Page.navigate',{url:`${origem}/jogo/quarto?jogoSalvoId=${A}`});
      await aguardar(()=>avaliar(`!!document.querySelector('[aria-label="Sair da partida"]')&&document.body.innerText.includes('Praticar novamente')`),'avatar da partida restaurada');
      await praticar();await aguardar(()=>avaliar(`document.body.innerText.includes('Ver conclusão do nível')`),'cenário para avatar');
      if(i>0)await aguardar(()=>avaliar(`(()=>{const img=document.querySelector('img[alt="Personagem Luna"]');return img?.getAttribute('src')==='${avatarVisual}'&&img.complete&&img.naturalWidth>0})()`),'ilustração do avatar selecionado');
      const shot=await enviar('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(destino,`avatar-${width}.png`),Buffer.from(shot.data,'base64'));
      avataresVisuais.push({width,imagem:avatarVisual});
      await avaliar(`document.querySelector('[aria-label="Sair da partida"]').click()`);
      await aguardar(()=>avaliar(`location.pathname==='/jogos-salvos'`),'encerrar após conferir avatar');
    }
    const resultado={navegador:"Chrome headless",modo:process.env.QUARTO_VISUAL_DEV==='1'?"Next dev com StrictMode real":"build de produção",dados:"API simulada; sem MongoDB",jogosSalvos:true,novoJogo:true,postUnicoPorEntrada:true,preparacaoSemCena:true,heartbeat:true,encerramento:true,praticaSequencial:true,cartaoPraticaAutomatico:true,saidaCartaoPratica:true,praticaPostUnicoPorTarefa:true,praticaSemNovaSessao:true,avataresVisuais,layouts};
    fs.writeFileSync(path.join(destino,"resultado.json"),JSON.stringify(resultado,null,2));console.log(JSON.stringify(resultado,null,2));
  } finally {ws?.close();chrome?.kill();servidor?.kill();}
}
executar().catch(error=>{console.error(error.message);process.exitCode=1;});
