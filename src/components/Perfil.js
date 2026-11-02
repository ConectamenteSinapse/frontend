import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import {
  Star,
  Home,
  CheckCircle2,
  Clock,
  Circle,
  Gamepad2,
  LogOut,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import api from "../services/api";
import styles from "../styles/Perfil.module.css";

const avataresDisponiveis = [
  { imagem: "/images/boneco.png", nome: "Menino 1" },
  { imagem: "/images/boneco2.png", nome: "Menino 2" },
  { imagem: "/images/menina1.png", nome: "Menina 1" },
  { imagem: "/images/menina2.png", nome: "Menina 2" },
];

function dificuldadesDoComodo(progresso, catalogo, partidaId, comodoId) {
  const niveis = ["facil", "medio", "dificil"];
  const estado = progresso?.comodos?.find((item) => item.comodoId === comodoId)?.estado;
  if (progresso?.jogoSalvoId !== partidaId || !["bloqueado", "disponivel", "concluido"].includes(estado) ||
    !Array.isArray(progresso.tarefas) || progresso.tarefas.some((item) =>
      typeof item?.tarefaId !== "string" || !niveis.includes(item.dificuldade) ||
      typeof item.concluida !== "boolean" ||
      ![item.tentativas, item.acertos, item.erros].every((n) => Number.isInteger(n) && n >= 0) ||
      item.tentativas !== item.acertos + item.erros || item.concluida !== (item.acertos > 0)) ||
    !Array.isArray(catalogo) || catalogo.some((item) =>
      typeof item?._id !== "string" || !item._id || item.comodoId !== comodoId || typeof item.ativo !== "boolean")) {
    throw new Error("Não foi possível validar o progresso do cômodo.");
  }
  const ativas = new Set(catalogo.filter((item) => item.ativo).map((item) => item._id));
  if (!ativas.size) throw new Error("O cômodo não possui tarefas ativas para calcular o progresso.");
  const grupos = niveis.map((nivel) => progresso.tarefas.filter((item) =>
    item.dificuldade === nivel && ativas.has(item.tarefaId)));
  const concluidos = grupos.map((grupo) => {
    const acertadas = new Set(grupo.filter((item) => item.concluida).map((item) => item.tarefaId));
    return [...ativas].every((id) => acertadas.has(id));
  });
  return niveis.map((nivel, i) => ({
    nivel,
    status: estado === "bloqueado" || (i > 0 && !concluidos[i - 1]) ? "Bloqueado"
      : concluidos[i] ? "Concluído"
        : grupos[i].some((item) => item.tentativas > 0) ? "Em andamento" : "Não iniciado",
  }));
}

function formatarConsumo(segundos) {
  if (typeof segundos !== "number" || !Number.isFinite(segundos) || segundos < 0) return null;
  const total = Math.floor(segundos);
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  return [horas ? `${horas} h` : "", minutos ? `${minutos} min` : "", `${total % 60} s`].filter(Boolean).join(" ");
}

export default function Perfil({ nomeUtilizador = "" }) {
  const router = useRouter();

  const [dadosCrianca, setDadosCrianca] = useState(null);
  const [dadosUsuario, setDadosUsuario] = useState(null);
  const [consultaPersonagem, setConsultaPersonagem] = useState(null);
  const [rascunhoEdicao, setEdicao] = useState(null);
  const edicaoRef = useRef(null);
  const dialogoEdicaoRef = useRef(null);
  const [comodos, setComodos] = useState([]);
  const [catalogos, setCatalogos] = useState({});
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [partidas, setPartidas] = useState({ status: "carregando", lista: [] });
  const [partidaPadraoId, setPartidaPadraoId] = useState("");
  const [progressoPartida, setProgressoPartida] = useState(null);
  const [imagensComErro, setImagensComErro] = useState({});
  const [selecaoDificuldade, setSelecaoDificuldade] = useState(null);
  const selecaoRef = useRef(null);
  const contextoPerfilRef = useRef(null);
  const consultaPronta = router.isReady;
  const consultaRota = router.query;
  const temIdNaRota = Object.prototype.hasOwnProperty.call(router.query ?? {}, "jogoSalvoId");
  const idDaRota = typeof router.query?.jogoSalvoId === "string" && /^[a-f0-9]{24}$/i.test(router.query.jogoSalvoId)
    ? router.query.jogoSalvoId.toLowerCase() : null;
  const partidaSelecionada = consultaPronta && partidas.status === "pronta"
    ? partidas.lista.find((partida) => partida._id === (temIdNaRota ? idDaRota : partidaPadraoId)) : null;
  const partidaId = partidaSelecionada?._id ?? "";
  const perfilJogoId = typeof partidaSelecionada?.perfilJogoId === "string"
    ? partidaSelecionada.perfilJogoId : partidaSelecionada?.perfilJogoId?._id;
  const progressoAtual = progressoPartida?.partidaId === partidaId && progressoPartida?.consulta === consultaRota ? progressoPartida : null;
  const personagemAtual = consultaPersonagem?.partidaId === partidaId && consultaPersonagem?.perfilJogoId === perfilJogoId && consultaPersonagem?.consulta === consultaRota
    ? consultaPersonagem : null;
  const personagem = personagemAtual?.status === "pronto" ? personagemAtual.dados : null;
  const usuarioId = dadosCrianca?.usuarioId;
  const edicao = rascunhoEdicao?.partidaId === partidaId && rascunhoEdicao?.perfilJogoId === perfilJogoId && rascunhoEdicao?.consulta === consultaRota
    ? rascunhoEdicao : null;

  const selecaoAtual = selecaoDificuldade?.partidaId === partidaId && selecaoDificuldade?.consulta === consultaRota ? selecaoDificuldade : null;
  const selecionando = ["carregando", "navegando"].includes(selecaoAtual?.status);

  useEffect(() => {
    const contexto = { partidaId, perfilJogoId, consulta: consultaRota };
    contextoPerfilRef.current = contexto;
    return () => {
      selecaoRef.current?.controller.abort();
      selecaoRef.current = null;
      if (contextoPerfilRef.current === contexto) contextoPerfilRef.current = null;
      edicaoRef.current?.controller?.abort();
      edicaoRef.current = null;
    };
  }, [partidaId, perfilJogoId, consultaRota]);

  useEffect(() => {
    if (edicao && !dialogoEdicaoRef.current?.open) dialogoEdicaoRef.current?.showModal();
  }, [edicao]);

  const abrirEdicao = () => {
    if (!personagem || !partidaId || !/^[a-f0-9]{24}$/i.test(perfilJogoId ?? "") || edicaoRef.current) return;
    const contexto = { partidaId, perfilJogoId, consulta: consultaRota, token: localStorage.getItem("token"), salvando: false };
    if (!contexto.token?.trim()) return;
    edicaoRef.current = contexto;
    setEdicao({ partidaId, perfilJogoId, consulta: consultaRota, nome: personagem.nomeAvatar ?? "", imagem: personagem.imagemAvatar ?? "", erro: "", salvando: false });
  };
  const fecharEdicao = () => {
    if (edicaoRef.current?.salvando) return;
    edicaoRef.current = null;
    setEdicao(null);
  };
  const salvarPersonagem = async (event) => {
    event.preventDefault();
    const contexto = edicaoRef.current;
    if (!contexto || contexto.salvando || !edicao || contexto.partidaId !== partidaId || contexto.perfilJogoId !== perfilJogoId || contexto.consulta !== consultaRota) return;
    const body = { nomeAvatar: edicao.nome.trim(), imagemAvatar: edicao.imagem };
    if (!body.nomeAvatar || !avataresDisponiveis.some(avatar => avatar.imagem === body.imagemAvatar)) {
      setEdicao(anterior => ({ ...anterior, erro: "Escreva o nome do personagem e escolha um avatar." }));
      return;
    }
    contexto.salvando = true;
    contexto.controller = new AbortController();
    setEdicao(anterior => ({ ...anterior, salvando: true, erro: "" }));
    const atual = () => edicaoRef.current === contexto && !contexto.controller.signal.aborted && localStorage.getItem("token") === contexto.token;
    try {
      if (!contexto.token?.trim() || localStorage.getItem("token") !== contexto.token) throw { response: { status: 401 } };
      const { status, data } = await api.patch(`/perfis-jogo/${contexto.perfilJogoId}`, body, { signal: contexto.controller.signal, timeout: 10_000 });
      if (!atual()) return;
      if (status !== 200 || data?._id !== contexto.perfilJogoId || data.nomeAvatar !== body.nomeAvatar || data.imagemAvatar !== body.imagemAvatar) throw new Error("Edição não confirmada.");
      setConsultaPersonagem({ partidaId: contexto.partidaId, perfilJogoId: contexto.perfilJogoId, consulta: contexto.consulta, status: "pronto", dados: data });
      edicaoRef.current = null;
      setEdicao(null);
    } catch (error) {
      if (!atual()) return;
      const status = error.response?.status;
      setEdicao(anterior => ({ ...anterior, salvando: false, erro: status === 401
        ? "Sessão expirada. Entre novamente para editar."
        : status === 403 || status === 404 ? "Este personagem não está disponível para edição."
          : "Não foi possível confirmar a alteração. Seus dados anteriores continuam na tela. Reabra o Perfil para conferir antes de tentar novamente." }));
    } finally {
      if (atual()) contexto.salvando = false;
    }
  };

  const jogarDificuldade = async (comodoId, dificuldade, conferir = false) => {
    const contexto = contextoPerfilRef.current;
    if (!partidaId || !perfilJogoId || contexto?.partidaId !== partidaId || contexto.consulta !== consultaRota ||
      !["facil", "medio", "dificil"].includes(dificuldade) ||
      !comodos.some(comodo => comodo._id === comodoId && comodo.ativo && comodo.nome?.trim().toLowerCase() === "quarto") ||
      (selecaoRef.current && ["carregando", "navegando"].includes(selecaoRef.current.status))) return;
    const operacao = { partidaId, perfilJogoId, consulta: consultaRota, comodoId, dificuldade,
      token: localStorage.getItem("token"), controller: new AbortController(), status: "carregando", enviada: false };
    selecaoRef.current = operacao;
    const chavePendente = `conectamente:selecao-dificuldade:${partidaId}`;
    const atual = () => contextoPerfilRef.current === contexto && selecaoRef.current === operacao &&
      !operacao.controller.signal.aborted && localStorage.getItem("token") === operacao.token;
    const mostrar = (status, mensagem) => {
      operacao.status = status;
      setSelecaoDificuldade({ partidaId, consulta: consultaRota, status, mensagem, comodoId, dificuldade });
    };
    mostrar("carregando", conferir ? "Conferindo a seleção..." : "Preparando sua partida...");
    try {
      if (!operacao.token?.trim()) throw { response: { status: 401 } };
      const pendente = sessionStorage.getItem(chavePendente);
      if (pendente) {
        try { operacao.body = JSON.parse(pendente); }
        catch { throw new Error("A seleção pendente está indisponível. Peça ajuda a um responsável."); }
        if (!conferir) {
          mostrar("incerta", "Uma seleção anterior não foi confirmada. Confira a seleção antes de jogar. Ela não será reenviada automaticamente.");
          return;
        }
        if (operacao.body.comodoId !== comodoId || !["facil", "medio", "dificil"].includes(operacao.body.dificuldade)) throw new Error("Seleção pendente inválida. Reabra o Perfil para conferir a partida.");
        dificuldade = operacao.body.dificuldade;
      } else if (conferir) throw new Error("Não há uma seleção pendente para conferir.");
      const config = { signal: operacao.controller.signal, timeout: 10_000 };
      const [{ data: partida }, { data: progresso }, { data: catalogo }, { data: crianca }] = await Promise.all([
        api.get(`/jogos-salvos/${partidaId}`, config),
        api.get(`/jogos-salvos/${partidaId}/progresso`, config),
        api.get(`/comodos/${comodoId}/tarefas`, config),
        api.get("/criancas/meu-perfil", config),
      ]);
      if (!atual()) return;
      const perfil = typeof partida?.perfilJogoId === "string" ? partida.perfilJogoId : partida?.perfilJogoId?._id;
      if (partida?._id !== partidaId || perfil !== perfilJogoId || !["facil", "medio", "dificil"].includes(partida.dificuldade)) throw new Error("Partida indisponível para esta jornada.");
      const niveis = dificuldadesDoComodo(progresso, catalogo, partidaId, comodoId);
      if (niveis.find(nivel => nivel.nivel === dificuldade)?.status === "Bloqueado") throw new Error("Esta dificuldade ainda está bloqueada. Consulte o progresso da sua jornada.");
      const ativas = catalogo.filter(tarefa => tarefa.ativo).sort((a, b) => a.ordem - b.ordem);
      if (ativas.some(tarefa => !/^[a-f0-9]{24}$/i.test(tarefa._id) || !Number.isFinite(tarefa.ordem)) ||
        new Set(ativas.map(tarefa => tarefa._id)).size !== ativas.length || new Set(ativas.map(tarefa => tarefa.ordem)).size !== ativas.length) throw new Error("A ordem das tarefas está indisponível.");
      if (!crianca || !["ativa", "pausada", "encerrada"].includes(crianca.sessaoJogoEstado)) throw new Error("Não foi possível confirmar a situação da sessão. Reabra o Perfil para tentar novamente.");
      if (crianca.sessaoJogoEstado === "ativa" && (!Number.isFinite(Date.parse(crianca.sessaoJogoExpiraEm)) || Date.parse(crianca.sessaoJogoExpiraEm) > Date.now())) throw new Error("Você já tem uma partida em andamento. Encerre a partida aberta ou aguarde a sessão expirar antes de escolher a dificuldade.");
      if (crianca.permissaoAtiva === false) throw new Error("A permissão para jogar está inativa. Peça ajuda a um responsável.");
      const body = { dificuldade, comodoId, tarefaId: ativas[0]._id };
      if (pendente) {
        if (partida.dificuldade !== operacao.body.dificuldade || partida.comodoId !== operacao.body.comodoId || partida.tarefaId !== operacao.body.tarefaId || body.tarefaId !== operacao.body.tarefaId) {
          mostrar("incerta", "A partida ainda não confirmou a seleção. Aguarde e confira novamente. Nenhuma seleção será reenviada automaticamente.");
          return;
        }
      } else if (partida.dificuldade !== dificuldade || partida.comodoId !== comodoId || partida.tarefaId !== body.tarefaId) {
        operacao.body = body;
        sessionStorage.setItem(chavePendente, JSON.stringify(body));
        operacao.enviada = true;
        const { status, data } = await api.patch(`/jogos-salvos/${partidaId}`, body, config);
        if (!atual()) return;
        const perfilRetornado = typeof data?.perfilJogoId === "string" ? data.perfilJogoId : data?.perfilJogoId?._id;
        if (status !== 200 || data?._id !== partidaId || perfilRetornado !== perfilJogoId || data.dificuldade !== dificuldade || data.comodoId !== comodoId || data.tarefaId !== body.tarefaId) throw new Error("Seleção não confirmada.");
      }
      sessionStorage.removeItem(chavePendente);
      operacao.enviada = false;
      mostrar("navegando", "Abrindo o Quarto...");
      const navegou = await router.push({ pathname: "/jogo/quarto", query: { jogoSalvoId: partidaId } });
      if (!atual()) return;
      if (navegou === false) throw new Error("A navegação foi interrompida. Tente abrir a partida novamente.");
    } catch (error) {
      if (!atual()) return;
      const status = error.response?.status;
      if ([400, 401, 403, 404, 409].includes(status) && operacao.enviada) {
        sessionStorage.removeItem(chavePendente);
        operacao.enviada = false;
      }
      const incerta = operacao.enviada || conferir;
      mostrar(incerta ? "incerta" : "erro", incerta
        ? "Não foi possível confirmar a seleção. Ela pode ter sido registrada. Confira a seleção; ela não será reenviada automaticamente."
        : status === 401 ? "Sessão expirada. Entre novamente para jogar."
          : status === 403 ? "Esta dificuldade não está disponível para jogar agora. Peça ajuda a um responsável."
            : status === 404 ? "Partida indisponível para esta conta. Escolha uma jornada em Jogos Salvos."
              : error.response ? "Não foi possível selecionar a dificuldade. Tente novamente."
                : error.message || "Não foi possível consultar a partida. Tente novamente.");
    }
  };

  useEffect(() => {
    if (!/^[a-f0-9]{24}$/i.test(usuarioId ?? "")) return;
    const controller = new AbortController();
    let ativo = true;
    async function carregarPartidas() {
      try {
        const { data } = await api.get("/jogos-salvos", { signal: controller.signal, timeout: 10_000 });
        if (!ativo || controller.signal.aborted) return;
        if (!Array.isArray(data) || new Set(data.map((item) => item?._id)).size !== data.length || data.some((item) => {
          const perfilId = typeof item?.perfilJogoId === "string" ? item.perfilJogoId : item?.perfilJogoId?._id;
          return !/^[a-f0-9]{24}$/i.test(item?._id ?? "") || !/^[a-f0-9]{24}$/i.test(perfilId ?? "") ||
            typeof item.nomeJogo !== "string" || !item.nomeJogo.trim();
        })) throw new Error("Lista de partidas inválida.");
        let preferida;
        try {
          preferida = localStorage.getItem(`conectamente:ultima-partida:${usuarioId.toLowerCase()}`);
        } catch {
          // A seleção manual continua disponível sem armazenamento local.
        }
        const autorizada = data.find((partida) => partida._id === preferida);
        setPartidas({ status: "pronta", lista: data });
        setPartidaPadraoId(autorizada?._id ?? (data.length === 1 ? data[0]._id : ""));
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;
        setPartidas({ status: "erro", lista: [], mensagem: error.response?.status === 401
          ? "Sessão expirada. Entre novamente para consultar as partidas."
          : "Não foi possível consultar as partidas. Reabra o perfil para tentar novamente." });
      }
    }
    carregarPartidas();
    return () => { ativo = false; controller.abort(); };
  }, [usuarioId]);

  useEffect(() => {
    if (!partidaId) return;
    const controller = new AbortController();
    let ativo = true;
    const contexto = { partidaId, consulta: consultaRota };
    async function carregarProgresso() {
      setProgressoPartida({ ...contexto, status: "carregando" });
      try {
        const { data } = await api.get(`/jogos-salvos/${partidaId}/progresso`, {
          signal: controller.signal, timeout: 10_000,
        });
        if (!ativo || controller.signal.aborted) return;
        if (data?.jogoSalvoId !== partidaId || !Array.isArray(data.tarefas) || !Array.isArray(data.comodos)) {
          throw new Error("Progresso da partida inválido.");
        }
        const estrelasTotal = typeof data.estrelasTotal === "number" && Number.isFinite(data.estrelasTotal) && data.estrelasTotal >= 0
          ? data.estrelasTotal : null;
        setProgressoPartida({ ...contexto, status: "pronto", dados: data, estrelasTotal });
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;
        setProgressoPartida({ ...contexto, status: "erro", mensagem: error.response?.status === 401
          ? "Sessão expirada. Entre novamente para consultar o progresso."
          : "Progresso da partida indisponível. Reabra o perfil para tentar novamente." });
      }
    }
    carregarProgresso();
    return () => { ativo = false; controller.abort(); };
  }, [partidaId, consultaRota]);

  useEffect(() => {
    if (!partidaId || !perfilJogoId) return;
    const controller = new AbortController();
    let ativo = true;
    const contexto = { partidaId, perfilJogoId, consulta: consultaRota };
    async function carregarPersonagem() {
      setConsultaPersonagem({ ...contexto, status: "carregando" });
      try {
        const { data } = await api.get(`/perfis-jogo/${perfilJogoId}`, { signal: controller.signal, timeout: 10_000 });
        if (!ativo || controller.signal.aborted) return;
        if (data?._id !== perfilJogoId) throw new Error("Personagem inválido.");
        setConsultaPersonagem({ ...contexto, status: "pronto", dados: data });
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;
        setConsultaPersonagem({ ...contexto, status: "erro", mensagem: error.response?.status === 401
          ? "Sessão expirada. Entre novamente para consultar o personagem." : "Personagem indisponível nesta jornada." });
      }
    }
    carregarPersonagem();
    return () => { ativo = false; controller.abort(); };
  }, [partidaId, perfilJogoId, consultaRota]);

  useEffect(() => {
    let ativo = true;
    async function carregarPerfil() {
      try {
        const respostaCrianca = await api.get("/criancas/meu-perfil");
        const crianca = respostaCrianca.data;

        if (!ativo) return;
        setDadosCrianca(crianca);

        const [respostaUsuario, respostaComodos] =
          await Promise.all([
            api.get("/usuarios/meu-perfil"),
            api.get("/comodos"),
          ]);

        if (!ativo) return;
        setDadosUsuario(respostaUsuario.data);

        // Ordenar os cômodos pela ordem cadastrada no banco.
        
        const dadosComodos = respostaComodos.data;

        const listaRecebida = Array.isArray(dadosComodos)
          ? dadosComodos
          : Array.isArray(dadosComodos.comodos)
            ? dadosComodos.comodos
            : [];

        const listaComodos = listaRecebida
          .filter((comodo) => comodo.ativo !== false)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        if (!ativo) return;
        setComodos(listaComodos);
        const catalogosRecebidos = {};
        await Promise.all(listaComodos.map(async (comodo) => {
          try {
            const { data } = await api.get(`/comodos/${comodo._id}/tarefas`);
            const tarefas = Array.isArray(data) ? data : data?.tarefas;
            if (!Array.isArray(tarefas)) throw new Error("Catálogo inválido.");
            catalogosRecebidos[comodo._id] = { status: "pronto", tarefas };
          } catch {
            catalogosRecebidos[comodo._id] = { status: "erro" };
          }
        }));
        if (ativo) setCatalogos(catalogosRecebidos);
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);

        if (!ativo) return;
        setErro(
          error.response?.data?.mensagem ||
            "Não foi possível carregar o perfil da criança."
        );
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarPerfil();
    return () => { ativo = false; };
  }, []);

  const nomeExibido = dadosUsuario?.nome || nomeUtilizador || "Nome indisponível";
  const nivel = Number.isInteger(personagem?.nivelAtual) && personagem.nivelAtual >= 1 ? personagem.nivelAtual : null;
  const imagemAvatar = typeof personagem?.imagemAvatar === "string" ? personagem.imagemAvatar.trim() : "";
  const imagemPersonagem = imagemAvatar && (/^(https?:\/\/|\/)/i.test(imagemAvatar) ? imagemAvatar : `/${imagemAvatar}`);
  const chaveImagemPersonagem = `${partidaId}:${perfilJogoId}:${imagemAvatar}`;
  const consumo = formatarConsumo(dadosCrianca?.tempoUsadoHoje);
  const referencia = dadosCrianca?.dataReferenciaTempo;
  const referenciaValida = typeof referencia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referencia) &&
    !Number.isNaN(Date.parse(referencia)) && new Date(referencia).toISOString().slice(0, 10) === referencia;
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date());
  const hojeSP = ["year", "month", "day"].map((tipo) => hoje.find((parte) => parte.type === tipo).value).join("-");

  const jornada = comodos.map((comodo) => {
    let indicadores = null;
    if (progressoAtual?.status === "pronto" && catalogos[comodo._id]?.status === "pronto") {
      try {
        indicadores = dificuldadesDoComodo(progressoAtual.dados, catalogos[comodo._id].tarefas, partidaId, comodo._id);
      } catch {
        // Sem catálogo ativo ou progresso válido, não inventar um estado.
      }
    }
    const status = !indicadores ? "Indisponível"
      : indicadores.every((item) => item.status === "Concluído") ? "Concluído"
        : indicadores[0].status === "Bloqueado" ? "Bloqueado"
          : indicadores.some((item) => ["Concluído", "Em andamento"].includes(item.status)) ? "Em andamento" : "Não iniciado";
    return { comodo, indicadores, status };
  });

  if (carregando) {
    return <p>Carregando perfil...</p>;
  }

  return (
    <main className={styles.pagina}>
      {edicao && (
        <dialog ref={dialogoEdicaoRef} className={styles.modalEdicao}
          aria-labelledby="editar-personagem-titulo" aria-describedby="editar-personagem-descricao"
          onCancel={event => { if (edicaoRef.current?.salvando) event.preventDefault(); else fecharEdicao(); }}>
          <form onSubmit={salvarPersonagem}>
            <h2 id="editar-personagem-titulo">Editar personagem</h2>
            <p id="editar-personagem-descricao">Seu nome de conta não será alterado. A mudança vale para todas as jornadas deste personagem.</p>
            <label htmlFor="nome-personagem">Nome do personagem</label>
            <input id="nome-personagem" value={edicao.nome} disabled={edicao.salvando}
              onChange={event => setEdicao(anterior => ({ ...anterior, nome: event.target.value }))} />
            <fieldset disabled={edicao.salvando}>
              <legend>Escolha seu avatar</legend>
              <div className={styles.avataresEdicao}>
                {avataresDisponiveis.map(avatar => (
                  <label key={avatar.imagem} className={styles.opcaoAvatar}>
                    <input type="radio" name="avatar-personagem" value={avatar.imagem} checked={edicao.imagem === avatar.imagem}
                      onChange={() => setEdicao(anterior => ({ ...anterior, imagem: avatar.imagem }))} />
                    <img src={avatar.imagem} alt="" />
                    <span>{avatar.nome}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {edicao.erro && <p role="alert">{edicao.erro}</p>}
            {edicao.salvando && <p role="status">Salvando personagem...</p>}
            <div className={styles.acoesEdicao}>
              <button type="button" onClick={fecharEdicao} disabled={edicao.salvando} className={styles.botaoEditar}>Cancelar</button>
              <button type="submit" disabled={edicao.salvando} className={styles.botaoEditar}>Salvar personagem</button>
            </div>
          </form>
        </dialog>
      )}
      {erro && (
        <p role="alert" style={{ color: "red" }}>
          {erro}
        </p>
      )}

      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={() => router.push("/menu")}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img
            src="/images/majesticons_share.png"
            alt=""
            className={styles.iconeVoltar}
          />
        </button>

        <h1 className={styles.tituloTopo}>Perfil</h1>

        <div className={styles.conteudoAzul}>
          <img
            src="/images/logo.png"
            alt="Logo ConectaMente"
            className={styles.logo}
          />
        </div>
      </header>

      <div className={styles.painelPrincipal}>
        <div className={styles.colunaEsquerda}>
          <section className={styles.cardUsuario} aria-label="Meu Perfil">
            <div className={styles.avatarMiniContainer}>
              <img src="/images/avatar.png" alt="" className={styles.avatarMini} />
            </div>
            <div className={styles.infoUsuario}>
              <h2 className={styles.tituloPersonagem}>Meu Perfil</h2>
              <p className={styles.nomeUsuario}>{nomeExibido}</p>
              <p className={styles.nomePersonagemPerfil}>Personagem: {personagem?.nomeAvatar || "Indisponível"}</p>
              <span className={styles.badgeNivel}>{nivel === null ? "Nível indisponível" : `Nível ${nivel}`}</span>
            </div>
            <button type="button" className={styles.botaoEditar} disabled={!personagem || !partidaId} onClick={abrirEdicao}>Editar</button>
          </section>
          <section className={styles.cardEstrelas} aria-label="Estrelas da jornada">
            <div className={styles.tituloEstrelas}>
              <Star size={28} color="#ffb703" fill="#ffb703" aria-hidden="true" />
              <h3>Estrelas da jornada</h3>
            </div>
            <p role="status" className={styles.fracaoEstrelas} aria-label="Estrelas da partida consultada">
              {!partidaId ? "Escolha uma jornada"
                : !progressoAtual || progressoAtual.status === "carregando" ? "Carregando..."
                  : progressoAtual.status === "pronto" && progressoAtual.estrelasTotal !== null
                    ? `${progressoAtual.estrelasTotal} estrelas` : "Indisponíveis"}
            </p>
          </section>

          <div className={styles.cartaoTempo}>
            <div className={styles.tituloTempo}>
              <h2>Tempo durante o jogo</h2>
            </div>

            <p className={styles.tempoUtilizado}>
              {consumo === null ? "Consumo indisponível" : `${consumo} utilizados`}
            </p>
            <p>
              {consumo === null ? "Não foi possível consultar seu tempo de jogo."
                : !referenciaValida ? "A data do tempo registrado está indisponível."
                  : referencia === hojeSP ? "Tempo que você jogou hoje."
                    : `Último tempo registrado em ${referencia.split("-").reverse().join("/")}.`}
            </p>

            <p className={styles.limiteTempo}>
              Limite diário:{" "}
              {typeof dadosCrianca?.limiteTempoDiario === "number" && Number.isFinite(dadosCrianca.limiteTempoDiario) && dadosCrianca.limiteTempoDiario >= 0
                ? `${dadosCrianca.limiteTempoDiario} min`
                : dadosCrianca?.limiteTempoDiario === null ? "Sem limite definido" : "Indisponível"}
            </p>
          </div>

        </div>

        <div className={styles.colunaDireita}>
          <section className={styles.cardPersonagem} aria-label="Meu Personagem">
            <h2 className={styles.tituloPersonagem}>Meu Personagem</h2>
            {!partidaId ? <p>Escolha uma jornada para ver seu personagem.</p>
              : !personagemAtual || personagemAtual.status === "carregando" ? <p role="status">Carregando personagem...</p>
                : personagemAtual.status === "erro" ? <p role="alert">{personagemAtual.mensagem}</p>
                  : <>
                    <p className={styles.nomeTraje}>{personagem.nomeAvatar || "Nome do personagem indisponível"}</p>
                    <div className={styles.palcoPersonagem}>
                      {imagemPersonagem && !imagensComErro[chaveImagemPersonagem]
                        ? <img src={imagemPersonagem} alt={`Personagem ${personagem.nomeAvatar || "da jornada"}`} className={styles.imgPersonagem}
                          onError={() => setImagensComErro((anteriores) => ({ ...anteriores, [chaveImagemPersonagem]: true }))} />
                        : <p>Aparência indisponível</p>}
                    </div>
                    <p className={styles.rotuloTraje}>Traje não informado no cadastro do personagem.</p>
                  </>}
          </section>

          <button
            type="button"
            className={styles.cardAcao}
            onClick={() => router.push("/jogos-salvos")}
          >
            <div className={styles.esquerdaAcao}>
              <Gamepad2 size={22} color="#0052cc" />
              <span>Jogos Salvos</span>
            </div>
            <ChevronRight size={20} color="#0052cc" />
          </button>

          <button
            type="button"
            className={styles.cardAcao}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("usuario");
              router.push("/");
            }}
          >
            <div className={styles.esquerdaAcao}>
              <LogOut size={22} color="#0052cc" />
              <span>Sair da Conta</span>
            </div>
            <ChevronRight size={20} color="#0052cc" />
          </button>

        </div>
          <div className={styles.cardComodos} id="minha-jornada">
            <div className={styles.cabecalhoComodos}>
              <div className={styles.tituloComodos}>
                <Home size={26} color="#0052cc" fill="#0052cc" />
                <h3>Minha Jornada</h3>
              </div>

            </div>

            <div className={styles.selecaoPartida}>
              <p>{partidaSelecionada ? `Jornada: ${partidaSelecionada.nomeJogo}` : "Nenhuma jornada selecionada"}</p>
              <Link href="/jogos-salvos" className={styles.botaoJornada}>
                <Gamepad2 size={22} aria-hidden="true" />
                <span>Escolher outra jornada</span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </div>
            {!consultaPronta || partidas.status === "carregando" ? <p role="status">Carregando partidas...</p>
              : partidas.status === "erro" ? <p role="alert">{partidas.mensagem}</p>
                : temIdNaRota && !partidaSelecionada ? <p role="alert">Partida inválida ou indisponível para esta conta. Escolha uma jornada em Jogos Salvos.</p>
                  : !partidas.lista.length ? <p>Você ainda não possui partidas salvas. <Link href="/escolher-personagem">Criar novo jogo</Link></p>
                  : !partidaId ? <p className={styles.avisoJornada}>Escolha uma partida em Jogos Salvos para ver as dificuldades, ou crie um novo jogo.</p>
                    : progressoAtual?.status === "erro" ? <p role="alert">{progressoAtual.mensagem}</p>
                      : progressoAtual?.status !== "pronto" ? <p role="status">Carregando progresso...</p> : null}

            {selecaoAtual?.mensagem && <div role={selecionando ? "status" : "alert"} className={styles.avisoSelecao}>
              <p>{selecaoAtual.mensagem}</p>
              {selecaoAtual.status === "incerta" && <button type="button" className={styles.botaoEditar}
                onClick={() => jogarDificuldade(selecaoAtual.comodoId, selecaoAtual.dificuldade, true)}>Conferir seleção</button>}
            </div>}
            <div className={styles.gridComodos}>
              {jornada.map(({ comodo, indicadores, status }) => {
                const nome = comodo.nome?.trim() || "Cômodo";
                const chave = nome.toLowerCase();
                const imagem = { quarto: "quarto.png", banheiro: "banheiro.png", sala: "sala.png", cozinha: "cozinha.png" }[chave];
                const implementado = chave === "quarto";
                const tipoStatus = status === "Concluído" ? "concluido" : status === "Em andamento" ? "andamento" : "nao_iniciado";
                const Icone = status === "Concluído" ? CheckCircle2 : status === "Em andamento" ? Clock : Circle;
                return (
                  <article key={comodo._id} className={styles.itemComodo} aria-label={`Cômodo ${nome}`}>
                    <div className={styles.imagemComodoContainer}>
                      {imagem && !imagensComErro[comodo._id]
                        ? <img src={`/images/perfil/${imagem}`} alt={`Ilustração do ${nome}`} className={styles.imgComodo}
                          onError={() => setImagensComErro((anteriores) => ({ ...anteriores, [comodo._id]: true }))} />
                        : <span className={styles.imagemIndisponivel} role="img" aria-label={`Ilustração do ${nome} indisponível`}>
                          <Home size={40} aria-hidden="true" />Ilustração indisponível
                        </span>}
                    </div>
                    <div className={styles.cabecalhoComodo}>
                      <h4 className={styles.nomeComodo}>{nome}</h4>
                      <span className={`${styles.statusBadge} ${styles[tipoStatus]}`}>
                        <Icone size={16} aria-hidden="true" />{status}
                      </span>
                    </div>
                    {!implementado && <p className={styles.emDesenvolvimento}>Em desenvolvimento</p>}
                    <div className={styles.progressoDificuldades} aria-label={`Dificuldades do ${nome} da partida selecionada`} aria-live="polite">
                      <dl>
                        {["facil", "medio", "dificil"].map((nivel, i) => {
                          const statusNivel = indicadores?.[i].status ?? "Indisponível";
                          const IconeNivel = statusNivel === "Concluído" ? CheckCircle2 : statusNivel === "Em andamento" ? Clock : Circle;
                          return <div key={nivel} className={implementado ? styles.linhaDificuldadeJogavel : undefined}>
                            <dt>
                              <span>{{ facil: "Fácil", medio: "Médio", dificil: "Difícil" }[nivel]}</span>
                              {implementado && <button type="button" className={styles.botaoJogar}
                                aria-label={`Jogar Quarto no nível ${{ facil: "Fácil", medio: "Médio", dificil: "Difícil" }[nivel]}`}
                                disabled={!partidaId || !comodo.ativo || !indicadores || statusNivel === "Bloqueado" || selecionando || selecaoAtual?.status === "incerta"}
                                onClick={() => jogarDificuldade(comodo._id, nivel)}>Jogar</button>}
                            </dt>
                            <dd><IconeNivel size={16} aria-hidden="true" />{statusNivel}</dd>
                          </div>;
                        })}
                      </dl>
                      {partidaId && progressoAtual?.status === "pronto" && !indicadores &&
                        <p className={styles.avisoJornada}>Catálogo ativo ou progresso deste cômodo indisponível.</p>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
      </div>
    </main>
  );
}
