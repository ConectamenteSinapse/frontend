// Chrome headless com API simulada: logout das duas telas, sem MongoDB.
// Executar depois de npm run build: node tests/logout.visual.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const { spawn } = require("node:child_process");
const { setTimeout: esperar } = require("node:timers/promises");
const root = path.resolve(__dirname, "..");
const destino = path.join(root, ".next/logout-visual");
const perfilChrome = fs.mkdtempSync(path.join(os.tmpdir(), "conectamente-logout-"));
function dados(url) {
  if (url === "/usuarios/meu-perfil") return { nome: "Criança da demonstração" };
  if (url === "/responsaveis/minhas-criancas") return [{ _id: "111111111111111111111111", usuarioId: "222222222222222222222222", nome: "Criança da demonstração", email: "crianca@example.invalid" }];
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
    await aguardar(async () => { try { return (await fetch(`${origem}/menu`, { signal: AbortSignal.timeout(2000) })).ok; } catch { return false; } }, "servidor local");
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
          const body = dados(url.pathname);
          const cabecalhos = [{ name: "Content-Type", value: "application/json" },
            { name: "Access-Control-Allow-Origin", value: "*" },
            { name: "Access-Control-Allow-Headers", value: "authorization,content-type" }];
          const responder = () => enviar("Fetch.fulfillRequest", { requestId, responseCode: request.method === "OPTIONS" ? 204 : body === undefined ? 404 : 200,
            responseHeaders: cabecalhos, body: Buffer.from(JSON.stringify(body ?? {})).toString("base64") }).catch(() => {});
          responder();
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
    const resultados = [];
    for (const [rota, tipo] of [["/menu", "crianca"], ["/responsavel/contas", "responsavel"]]) {
      for (const largura of [360, 1280]) {
        await enviar("Emulation.setDeviceMetricsOverride", { width: largura, height: 900, deviceScaleFactor: 1, mobile: false });
        await enviar("Page.navigate", { url: origem });
        await avaliar(`localStorage.setItem('token','jwt-apenas-simulado');localStorage.setItem('usuario',JSON.stringify({perfil:'${tipo}'}));localStorage.setItem('conectamente:ultima-partida:fixture','preservar');`);
        await enviar("Page.navigate", { url: `${origem}${rota}` });
        await aguardar(() => avaliar(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Sair da Conta') && document.body.innerText.includes('${tipo === "crianca" ? "Novo Jogo" : "crianca@example.invalid"}')`), "tela autenticada");
        const medida = await avaliar(`(()=>{
          const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sair da Conta');const r=b.getBoundingClientRect();
          return {largura:innerWidth,semRolagem:document.documentElement.scrollWidth<=document.documentElement.clientWidth,alturaBotao:r.height,larguraBotao:r.width,rodape:${tipo === "responsavel" ? "!!b.closest('footer')" : "[...document.querySelectorAll('a')].filter(a=>['/perfil','/escolher-personagem','/jogos-salvos'].includes(a.getAttribute('href'))).every(a=>a.getBoundingClientRect().bottom<=r.top)"}};
        })()`);
        assert.equal(medida.semRolagem, true); assert.equal(medida.rodape, true); assert.ok(medida.alturaBotao >= 44);
        const { contentSize } = await enviar("Page.getLayoutMetrics");
        const captura = await enviar("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: largura, height: contentSize.height, scale: 1 } });
        fs.writeFileSync(path.join(destino, `${tipo}-${largura}.png`), Buffer.from(captura.data, "base64"));
        // Teclado nativo: foco via Tab, ativação por Enter.
        await avaliar(`document.activeElement?.blur()`);
        let focado = false;
        for (let tentativa = 0; tentativa < 16; tentativa++) {
          await enviar("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          await enviar("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
          if (await avaliar(`document.activeElement?.textContent.trim()==='Sair da Conta'`)) { focado = true; break; }
        }
        assert.equal(focado, true, "botão alcançável pelo teclado");
        await enviar("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13, text: "\r", unmodifiedText: "\r" });
        await enviar("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
        try {
          await aguardar(() => avaliar(`location.pathname==='/'&&localStorage.getItem('token')===null&&localStorage.getItem('usuario')===null`), "logout por teclado");
        } catch (error) {
          console.error(await avaliar(`JSON.stringify({rota:location.pathname,tokenPresente:localStorage.getItem('token')!==null,usuarioPresente:localStorage.getItem('usuario')!==null,foco:document.activeElement?.tagName,texto:document.body.innerText.slice(-180)})`));
          throw error;
        }
        assert.equal(await avaliar(`localStorage.getItem('conectamente:ultima-partida:fixture')`), "preservar");
        const antes = consultasAPI.length;
        await enviar("Page.navigate", { url: `${origem}${rota}` });
        await aguardar(() => avaliar(`location.pathname==='/'`), "acesso sem autenticação");
        assert.equal(consultasAPI.length, antes, "não consulta dados protegidos sem token");
        resultados.push({ rota, ...medida, teclado: true, logout: true, reentradaBloqueada: true });
      }
    }
    const resultado = { navegador: "Chrome headless", dados: "API simulada; sem MongoDB", resultados };
    fs.writeFileSync(path.join(destino, "resultado.json"), JSON.stringify(resultado, null, 2));
    console.log(JSON.stringify(resultado, null, 2));
  } finally { ws?.close(); chrome?.kill(); servidor.kill(); }
}
executar().catch((error) => { console.error(error.message); process.exitCode = 1; });
