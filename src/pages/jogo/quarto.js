import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import styles from "../../styles/Quarto.module.css";
import { useRouter } from "next/router";
import CenaQuarto from "../../components/jogo/CenaQuarto";
import api from "../../services/api";

const estiloPreparacao = {
  minHeight: "100vh", background: "#f8fafc", color: "#0f172a",
  display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: 16, padding: 24,
};

export default function Quarto() {
  const { query, isReady, replace } = useRouter();
  const identificador = query.jogoSalvoId;
  const jogoSalvoId = typeof identificador === "string"
    ? identificador.toLowerCase()
    : null;
  const idValido = typeof jogoSalvoId === "string" && /^[a-f0-9]{24}$/.test(jogoSalvoId);
  const [consulta, setConsulta] = useState(null);
  const [inicio, setInicio] = useState(null);
  const inicioRef = useRef(null);
  // Mantém a trava após falha/cancelamento: um POST pode ter sido persistido.
  const tentativasInicioRef = useRef(new Map());
  const [acompanhamento, setAcompanhamento] = useState(null);
  const controleSessaoRef = useRef(null);
  const [partidaAtualizada, setPartidaAtualizada] = useState(null);
  const [transicao, setTransicao] = useState(null);
  const transicaoRef = useRef(null);
  const partidaAtual = partidaAtualizada?.consulta === consulta
    ? partidaAtualizada.partida : consulta?.partida;

  useEffect(() => {
    if (!isReady) return;

    const controller = new AbortController();
    let ativa = true;

    async function iniciarJogo(validada, tokenValidado) {
      if (
        !isReady || validada?.id !== jogoSalvoId ||
        validada.status !== "pronta" || inicioRef.current
      ) return;

      const anterior = tentativasInicioRef.current.get(jogoSalvoId);
      if (anterior?.token === tokenValidado) {
        setInicio(anterior.sessaoId && !anterior.encerrada && Date.parse(anterior.expiraEm) > Date.now()
          ? { consulta: validada, status: "ativa", sessaoId: anterior.sessaoId, expiraEm: anterior.expiraEm }
          : { consulta: validada, status: "erro", mensagem: anterior.mensagem ??
            "Esta entrada já foi solicitada. Volte à seleção de partidas e aguarde a expiração da sessão antes de tentar novamente." });
        return;
      }
      const tentativa = { controller: new AbortController() };
      inicioRef.current = tentativa;
      setInicio({ consulta: validada, status: "iniciando" });
      let confirmada = false;

      try {
        if (!localStorage.getItem("token")?.trim()) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setInicio({ consulta: validada, status: "erro", mensagem: "Entre novamente para iniciar o jogo." });
          replace("/");
          return;
        }
        if (localStorage.getItem("token") !== tokenValidado) {
          setInicio({ consulta: validada, status: "erro", mensagem: "A conta mudou durante a preparação. Volte à seleção de partidas." });
          return;
        }

        tentativasInicioRef.current.set(jogoSalvoId, { token: tokenValidado });
        const { status, data } = await api.post(
          `/jogos-salvos/${jogoSalvoId}/sessao`,
          {},
          { signal: tentativa.controller.signal, timeout: 10_000 }
        );
        if (inicioRef.current !== tentativa || tentativa.controller.signal.aborted) return;

        if (
          status !== 201 || data?.estado !== "ativa" ||
          typeof data.sessaoId !== "string" ||
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(data.sessaoId) ||
          data.jogoSalvo?._id !== jogoSalvoId ||
          (typeof data.jogoSalvo.perfilJogoId === "string" ? data.jogoSalvo.perfilJogoId : data.jogoSalvo.perfilJogoId?._id) !== validada.perfilJogoId ||
          data.jogoSalvo.dificuldade !== validada.partida.dificuldade ||
          typeof data.expiraEm !== "string" || !Number.isFinite(Date.parse(data.expiraEm)) || Date.parse(data.expiraEm) <= Date.now()
        ) {
          throw new Error("Início de sessão não confirmado.");
        }

        confirmada = true;
        tentativasInicioRef.current.set(jogoSalvoId, { token: tokenValidado, sessaoId: data.sessaoId, expiraEm: data.expiraEm });
        setInicio({ consulta: validada, status: "ativa", sessaoId: data.sessaoId, expiraEm: data.expiraEm });
      } catch (error) {
        if (inicioRef.current !== tentativa || tentativa.controller.signal.aborted) return;

        const status = error.response?.status;
        const codigo = error.response?.data?.codigo;
        if (status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setInicio({ consulta: validada, status: "erro", mensagem: "Sessão de login expirada. Entre novamente." });
          replace("/");
          return;
        }

        let mensagem;
        if (status === 403) {
          mensagem = codigo === "LIMITE_TEMPO_ATINGIDO"
            ? "Seu tempo de jogo terminou por hoje."
            : codigo === "PERMISSAO_INATIVA"
              ? "A permissão para jogar está inativa."
              : "Você não tem permissão para iniciar esta partida.";
        } else if (status === 409) {
          mensagem = codigo === "SESSAO_JA_ATIVA"
            ? "Já existe uma sessão de jogo ativa. Aguarde seu encerramento ou expiração antes de tentar novamente."
            : "Não foi possível iniciar a sessão devido a um conflito. Tente novamente após verificar a partida.";
        } else if (status === 404) {
          mensagem = "Partida não encontrada ou indisponível para esta conta.";
        } else {
          mensagem = "Não foi possível confirmar o início. A sessão pode ter sido criada; aguarde sua expiração antes de tentar novamente.";
        }
        tentativasInicioRef.current.set(jogoSalvoId, { token: tokenValidado, mensagem });
        setInicio({ consulta: validada, status: "erro", mensagem });
      } finally {
        if (inicioRef.current === tentativa && !confirmada) inicioRef.current = null;
      }
    }

    async function carregarPartida() {
      setConsulta({ id: jogoSalvoId, status: "carregando" });
      if (!idValido) return;

      try {
        if (!localStorage.getItem("token")?.trim()) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setConsulta({ id: jogoSalvoId, status: "erro", mensagem: "Entre novamente para abrir a partida." });
          replace("/");
          return;
        }

        const usuarioDaConsulta = localStorage.getItem("usuario");
        const tokenDaConsulta = localStorage.getItem("token");
        const { data: partida } = await api.get(`/jogos-salvos/${jogoSalvoId}`, {
          signal: controller.signal,
        });
        if (!ativa || controller.signal.aborted) return;

        const perfilJogoId = typeof partida?.perfilJogoId === "string"
          ? partida.perfilJogoId
          : partida?.perfilJogoId?._id;

        if (
          partida?._id !== jogoSalvoId ||
          typeof perfilJogoId !== "string" ||
          !/^[a-f0-9]{24}$/i.test(perfilJogoId) ||
          !["facil", "medio", "dificil"].includes(partida.dificuldade)
        ) {
          throw new Error("Dados incompletos da partida.");
        }

        // Preferência local, nunca autorização nem identidade da sessão de jogo.
        try {
          const usuario = JSON.parse(usuarioDaConsulta);
          if (usuario?.perfil === "crianca" && /^[a-f0-9]{24}$/i.test(usuario.id ?? "") &&
            localStorage.getItem("usuario") === usuarioDaConsulta &&
            localStorage.getItem("token") === tokenDaConsulta) {
            localStorage.setItem(`conectamente:ultima-partida:${usuario.id.toLowerCase()}`, jogoSalvoId);
          }
        } catch {
          // Armazenamento indisponível não impede abrir uma partida validada.
        }
        const validada = { id: jogoSalvoId, status: "pronta", partida, perfilJogoId };
        setConsulta(validada);
        await iniciarJogo(validada, tokenDaConsulta);
      } catch (error) {
        if (!ativa || controller.signal.aborted) return;

        const status = error.response?.status;
        if (status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setConsulta({ id: jogoSalvoId, status: "erro", mensagem: "Sessão expirada. Entre novamente." });
          replace("/");
          return;
        }

        const mensagem = status === 404
          ? "Partida não encontrada ou indisponível para esta conta."
          : status === 403
            ? "Você não tem permissão para abrir esta partida."
            : "Não foi possível carregar a partida. Volte à seleção e tente novamente.";
        setConsulta({ id: jogoSalvoId, status: "erro", mensagem });
      }
    }

    carregarPartida();
    return () => {
      ativa = false;
      controller.abort();
      inicioRef.current?.controller.abort();
      inicioRef.current = null;
      transicaoRef.current?.controller.abort();
      transicaoRef.current = null;
    };
  }, [isReady, replace, jogoSalvoId, idValido]);

  useEffect(() => {
    if (!isReady || consulta?.id !== jogoSalvoId || inicio?.consulta !== consulta || inicio?.status !== "ativa") return;

    let ativa = true;
    let timerRenovacao;
    let timerExpiracao;
    const ciclo = { bloqueada: false, encerrando: false, requisicao: null };
    controleSessaoRef.current = ciclo;

    function pararRenovacao() {
      clearTimeout(timerRenovacao);
      clearTimeout(timerExpiracao);
      ciclo.requisicao?.abort();
      transicaoRef.current?.controller.abort();
    }

    function bloquear(mensagem) {
      if (!ativa) return;
      ciclo.bloqueada = true;
      pararRenovacao();
      setAcompanhamento({ inicio, status: "bloqueada", mensagem });
    }
    ciclo.bloquear = bloquear;

    function tratarFalha(error, encerramento = false) {
      const status = error.response?.status;
      const codigo = error.response?.data?.codigo;
      if (status === 401) {
        bloquear("Sessão de login expirada. Entre novamente.");
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        replace("/");
      } else if (status === 403) {
        bloquear(codigo === "LIMITE_TEMPO_ATINGIDO"
          ? "Seu tempo de jogo terminou por hoje."
          : "A permissão para jogar está indisponível.");
      } else if (status === 409) {
        bloquear("A sessão de jogo expirou ou não está disponível. Volte à seleção de partidas.");
      } else {
        bloquear(encerramento
          ? "Não foi possível confirmar a saída. A partida continua bloqueada. Peça ajuda a um responsável. Você pode tentar sair novamente."
          : "A conexão com a partida falhou. A partida está bloqueada na tela. Peça ajuda a um responsável.");
      }
    }

    function agendar(expiraEm) {
      clearTimeout(timerRenovacao);
      clearTimeout(timerExpiracao);
      const restante = Math.max(0, Date.parse(expiraEm) - Date.now());
      timerExpiracao = setTimeout(() => bloquear("Sua sessão terminou. Volte para Jogos Salvos."), restante);
      timerRenovacao = setTimeout(renovar, Math.min(10_000, Math.max(250, restante / 2)));
    }

    async function renovar() {
      if (!ativa || ciclo.bloqueada || ciclo.encerrando || ciclo.requisicao) return;
      const controller = new AbortController();
      ciclo.requisicao = controller;
      try {
        if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
        const { status, data } = await api.patch("/jogos-salvos/sessao/heartbeat", {
          sessaoId: inicio.sessaoId,
        }, { signal: controller.signal, timeout: 10_000 });
        if (!ativa || ciclo.bloqueada || ciclo.encerrando || controller.signal.aborted) return;
        if (status !== 200 || data?.sessaoId !== inicio.sessaoId || data.estado !== "ativa" ||
          typeof data.expiraEm !== "string" || !Number.isFinite(Date.parse(data.expiraEm))) {
          throw new Error("Renovação não confirmada.");
        }
        setAcompanhamento({ inicio, status: "ativa", expiraEm: data.expiraEm });
        const tentativa = tentativasInicioRef.current.get(jogoSalvoId);
        if (tentativa?.sessaoId === inicio.sessaoId) tentativa.expiraEm = data.expiraEm;
        agendar(data.expiraEm);
      } catch (error) {
        if (ativa && !ciclo.bloqueada && !ciclo.encerrando && !controller.signal.aborted) tratarFalha(error);
      } finally {
        if (ciclo.requisicao === controller) ciclo.requisicao = null;
      }
    }

    async function sair(destino = ciclo.destinoSaida ?? "/jogos-salvos") {
      if (!ativa || ciclo.encerrando || ciclo.finalizada) return;
      const rotaSaida = destino === "/menu" ? "/menu" : "/jogos-salvos";
      ciclo.destinoSaida = rotaSaida;
      ciclo.encerrando = true;
      ciclo.bloqueada = true;
      pararRenovacao();
      const controller = new AbortController();
      ciclo.requisicao = controller;
      setAcompanhamento({ inicio, status: "saindo", mensagem: "Saindo da partida..." });
      try {
        if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
        const { status, data } = await api.patch("/jogos-salvos/sessao/encerrar", {
          sessaoId: inicio.sessaoId,
        }, { signal: controller.signal, timeout: 10_000 });
        if (!ativa || controller.signal.aborted) return;
        if (status !== 200 || data?.sessaoId !== inicio.sessaoId || data.estado !== "encerrada") {
          throw new Error("Encerramento não confirmado.");
        }
        ciclo.finalizada = true;
        const tentativa = tentativasInicioRef.current.get(jogoSalvoId);
        if (tentativa?.sessaoId === inicio.sessaoId) tentativa.encerrada = true;
        setAcompanhamento({ inicio, status: "encerrada", mensagem: rotaSaida === "/menu"
          ? "Sessão encerrada. Voltando ao painel..." : "Sessão encerrada. Voltando à seleção de partidas..." });
        replace(rotaSaida);
      } catch (error) {
        if (ativa && !controller.signal.aborted) tratarFalha(error, true);
      } finally {
        ciclo.encerrando = false;
        if (ciclo.requisicao === controller) ciclo.requisicao = null;
      }
    }
    ciclo.sair = sair;

    // A cena tem listener global de movimento; inert sozinho não o bloquearia.
    function bloquearMovimento(event) {
      if (ciclo.bloqueada && ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "a", "w", "s", "d"].includes(event.key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }

    window.addEventListener("keydown", bloquearMovimento, true);
    agendar(inicio.expiraEm);
    return () => {
      ativa = false;
      pararRenovacao();
      window.removeEventListener("keydown", bloquearMovimento, true);
      if (controleSessaoRef.current === ciclo) controleSessaoRef.current = null;
    };
  }, [isReady, consulta, jogoSalvoId, inicio, replace]);

  async function avancarDificuldade() {
    const ciclo = controleSessaoRef.current;
    const origem = partidaAtual?.dificuldade;
    const destino = { facil: "medio", medio: "dificil" }[origem];
    const nomeOrigem = { facil: "fácil", medio: "médio" }[origem];
    const nomeDestino = { medio: "médio", dificil: "difícil" }[destino];
    const anterior = transicaoRef.current;
    if (!destino || inicio?.consulta !== consulta || inicio?.status !== "ativa" ||
      !ciclo || ciclo.bloqueada || ciclo.encerrando ||
      (anterior && (!anterior.confirmada || anterior.body.dificuldade !== origem))) return;

    const operacao = { controller: new AbortController(), enviada: false, conferindo: false, anterior };
    transicaoRef.current = operacao;
    const atual = () => transicaoRef.current === operacao && !operacao.controller.signal.aborted &&
      controleSessaoRef.current === ciclo && !ciclo.bloqueada && !ciclo.encerrando;
    setTransicao({ inicio, status: "avancando" });

    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const config = { signal: operacao.controller.signal, timeout: 10_000 };
      const { data: cama } = await api.get("/tarefas/6aac3c29bee9f041e4728a8f", config);
      if (!atual()) return;
      if (cama?._id !== "6aac3c29bee9f041e4728a8f" ||
        typeof cama.comodoId !== "string" || !/^[a-f0-9]{24}$/i.test(cama.comodoId)) {
        throw new Error("Não foi possível identificar o cômodo da partida.");
      }
      const [{ data: catalogo }, { data: progresso }] = await Promise.all([
        api.get(`/comodos/${cama.comodoId}/tarefas`, config),
        api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, config),
      ]);
      if (!atual()) return;
      if (!Array.isArray(catalogo) || catalogo.some((tarefa) =>
        typeof tarefa?._id !== "string" || !/^[a-f0-9]{24}$/i.test(tarefa._id) ||
        tarefa.comodoId !== cama.comodoId || typeof tarefa.ativo !== "boolean" ||
        !Number.isFinite(tarefa.ordem)) || progresso?.jogoSalvoId !== jogoSalvoId ||
        !Array.isArray(progresso.tarefas) || progresso.tarefas.some((tarefa) =>
          typeof tarefa?.tarefaId !== "string" || typeof tarefa.concluida !== "boolean" ||
          !["facil", "medio", "dificil"].includes(tarefa.dificuldade))) {
        throw new Error("Não foi possível validar o catálogo e o progresso da partida.");
      }
      const ativas = catalogo.filter((tarefa) => tarefa.ativo).sort((a, b) => a.ordem - b.ordem);
      if (!ativas.length || new Set(ativas.map((tarefa) => tarefa._id)).size !== ativas.length ||
        new Set(ativas.map((tarefa) => tarefa.ordem)).size !== ativas.length) {
        throw new Error("O catálogo não possui uma sequência válida de tarefas ativas.");
      }
      if (!ativas.every((tarefa) => progresso.tarefas.some((item) =>
        item.tarefaId === tarefa._id && item.dificuldade === origem && item.concluida))) {
        throw new Error(`Conclua todas as tarefas ativas do Quarto no ${nomeOrigem} antes de avançar.`);
      }

      operacao.body = { dificuldade: destino, comodoId: cama.comodoId, tarefaId: ativas[0]._id };
      operacao.enviada = true;
      const { status, data } = await api.patch(`/jogos-salvos/${jogoSalvoId}`, operacao.body, config);
      if (!atual()) return;
      const perfil = typeof data?.perfilJogoId === "string" ? data.perfilJogoId : data?.perfilJogoId?._id;
      if (status !== 200 || data?._id !== jogoSalvoId || perfil !== consulta.perfilJogoId ||
        data.dificuldade !== destino || data.comodoId !== operacao.body.comodoId || data.tarefaId !== operacao.body.tarefaId) {
        throw new Error("A atualização da dificuldade não foi confirmada.");
      }
      setPartidaAtualizada({ consulta, partida: data });
      setTransicao(null);
      // Mantém a trava para callbacks antigos, mesmo antes do próximo render.
      operacao.confirmada = true;
    } catch (error) {
      if (!atual()) return;
      const status = error.response?.status;
      if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        ciclo.bloquear("Sessão de login expirada. Entre novamente.");
        replace("/");
        return;
      }
      const incerta = operacao.enviada && ![400, 403, 404, 409].includes(status);
      setTransicao({ inicio, status: incerta ? "incerta" : "erro", mensagem: incerta
        ? `Não foi possível confirmar o avanço. A partida pode estar no ${nomeDestino}; confira a dificuldade antes de continuar. A atualização não será reenviada automaticamente.`
        : status === 403 ? "Avanço não autorizado. Confira as tarefas concluídas e a permissão da partida."
          : status ? `Não foi possível avançar. O nível ${nomeOrigem} foi mantido.`
            : error.message || "Não foi possível conferir as tarefas e o progresso. Tente novamente." });
      if (!incerta) transicaoRef.current = operacao.anterior;
    }
  }

  async function conferirDificuldade() {
    const operacao = transicaoRef.current;
    const ciclo = controleSessaoRef.current;
    if (!operacao?.enviada || operacao.confirmada || operacao.conferindo || operacao.controller.signal.aborted ||
      !ciclo || ciclo.bloqueada || ciclo.encerrando) return;
    operacao.conferindo = true;
    const atual = () => transicaoRef.current === operacao && !operacao.controller.signal.aborted &&
      controleSessaoRef.current === ciclo && !ciclo.bloqueada && !ciclo.encerrando;
    setTransicao({ inicio, status: "conferindo" });
    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const { status, data } = await api.get(`/jogos-salvos/${jogoSalvoId}`, {
        signal: operacao.controller.signal, timeout: 10_000,
      });
      if (!atual()) return;
      const perfil = typeof data?.perfilJogoId === "string" ? data.perfilJogoId : data?.perfilJogoId?._id;
      if (status !== 200 || data?._id !== jogoSalvoId || perfil !== consulta.perfilJogoId ||
        data.dificuldade !== operacao.body.dificuldade || data.comodoId !== operacao.body.comodoId || data.tarefaId !== operacao.body.tarefaId) {
        throw new Error("A partida ainda não confirmou a dificuldade solicitada. Aguarde e confira novamente, ou volte à seleção de partidas.");
      }
      setPartidaAtualizada({ consulta, partida: data });
      setTransicao(null);
      operacao.confirmada = true;
    } catch (error) {
      if (!atual()) return;
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        ciclo.bloquear("Sessão de login expirada. Entre novamente.");
        replace("/");
      } else {
        setTransicao({ inicio, status: "incerta", mensagem: error.response
          ? "Não foi possível conferir a dificuldade. Tente consultar novamente ou volte à seleção de partidas."
          : error.message || "Não foi possível conferir a dificuldade. Tente consultar novamente ou volte à seleção de partidas." });
      }
    } finally {
      if (atual()) operacao.conferindo = false;
    }
  }

  if (!isReady) {
    return <main style={estiloPreparacao}><p role="status">Preparando seu jogo...</p></main>;
  }

  if (!idValido) {
    return (
      <main style={estiloPreparacao}>
        <p role="alert">Selecione uma partida válida para abrir o Quarto.</p>
        <Link href="/jogos-salvos">Voltar à seleção de partidas</Link>
      </main>
    );
  }

  if (consulta?.id !== jogoSalvoId || consulta.status === "carregando") {
    return (
      <main style={estiloPreparacao}>
        <p role="status">Preparando seu jogo...</p>
        <Link href="/jogos-salvos">Voltar à seleção de partidas</Link>
      </main>
    );
  }

  if (consulta.status === "erro") {
    return (
      <main style={estiloPreparacao}>
        <p role="alert">{consulta.mensagem}</p>
        <Link href="/jogos-salvos">Voltar à seleção de partidas</Link>
      </main>
    );
  }

  if (inicio?.consulta !== consulta || inicio.status !== "ativa") {
    const erroInicio = inicio?.consulta === consulta && inicio.status === "erro";
    return (
      <main style={estiloPreparacao}>
        {erroInicio ? <p role="alert">{inicio.mensagem}</p> : <p role="status">Preparando seu jogo...</p>}
        <Link href="/jogos-salvos">Voltar à seleção de partidas</Link>
      </main>
    );
  }

  const bloqueada = acompanhamento?.inicio === inicio && acompanhamento.status !== "ativa";
  const saindo = acompanhamento?.inicio === inicio && ["saindo", "encerrada"].includes(acompanhamento.status);
  const estadoTransicao = transicao?.inicio === inicio ? transicao : null;
  return (
    <>
      <div inert={bloqueada}>
        <CenaQuarto
          key={`${jogoSalvoId}:${partidaAtual.dificuldade}`}
          jogoSalvo={partidaAtual}
          personagem={consulta.partida.perfilJogoId}
          jogoSalvoId={consulta.partida._id}
          perfilJogoId={consulta.perfilJogoId}
          dificuldade={partidaAtual.dificuldade}
          onAvancarDificuldade={["facil", "medio"].includes(partidaAtual.dificuldade) ? avancarDificuldade : undefined}
          avancandoDificuldade={["avancando", "conferindo"].includes(estadoTransicao?.status)}
          avancoIncerto={["incerta", "conferindo"].includes(estadoTransicao?.status)}
          erroAvanco={estadoTransicao?.mensagem}
          onConferirDificuldade={conferirDificuldade}
          onSairDoJogo={(destino) => controleSessaoRef.current?.sair(destino)}
          sessaoId={inicio.sessaoId}
          audioBloqueado={bloqueada}
          expiraEm={acompanhamento?.inicio === inicio ? acompanhamento.expiraEm : inicio.expiraEm}
        />
      </div>
      {!bloqueada && (
        <button type="button" aria-label="Sair da partida" onClick={() => controleSessaoRef.current?.sair()} className={styles.botaoSairPartida}>
          <LogOut size={20} aria-hidden="true" />
          Sair da partida
        </button>
      )}
      {bloqueada && (
        <div role="alertdialog" aria-modal="true" aria-label="Sessão interrompida" style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#08101df2", color: "white", display: "grid", placeContent: "center", gap: 16, padding: 24 }}>
          <p>{acompanhamento.mensagem}</p>
          <button type="button" aria-label="Sair da partida" className={styles.botaoSairPartidaDialogo} disabled={saindo} onClick={() => controleSessaoRef.current?.sair()}>
            <LogOut size={20} aria-hidden="true" />
            {saindo ? "Saindo..." : "Sair da partida"}
          </button>
          <Link href="/jogos-salvos">Voltar à seleção de partidas</Link>
        </div>
      )}
    </>
  );
}
