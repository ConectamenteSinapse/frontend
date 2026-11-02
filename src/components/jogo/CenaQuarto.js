import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Volume2, X } from "lucide-react";
import styles from "../../styles/Quarto.module.css";
import RespostaCard from "./RespostaCard";
import api from "../../services/api";

const TAREFA_CAMA_ID = "6aac3c29bee9f041e4728a8f";
const TAREFA_CORTINA_ID = "6aac3c29bee9f041e4728a90";
const TAREFA_ROUPA_ID = "6aac3c29bee9f041e4728a91";

function estrelasPersistidas(progresso, jogoSalvoId) {
  return progresso?.jogoSalvoId === jogoSalvoId && Number.isFinite(progresso.estrelasTotal) &&
    progresso.estrelasTotal >= 0 ? progresso.estrelasTotal : null;
}

function camaConcluida(progresso, jogoSalvoId, dificuldade) {
  if (progresso?.jogoSalvoId !== jogoSalvoId || !Array.isArray(progresso.tarefas) ||
    progresso.tarefas.some((item) => typeof item?.tarefaId !== "string" ||
      typeof item.concluida !== "boolean" || !["facil", "medio", "dificil"].includes(item.dificuldade))) {
    throw new Error("Progresso inválido.");
  }
  return progresso.tarefas.some((item) => item.tarefaId === TAREFA_CAMA_ID &&
    item.dificuldade === dificuldade && item.concluida);
}

function cortinaConcluida(progresso, jogoSalvoId, dificuldade) {
  if (progresso?.jogoSalvoId !== jogoSalvoId || !Array.isArray(progresso.tarefas) ||
    progresso.tarefas.some((item) => typeof item?.tarefaId !== "string" ||
      typeof item.concluida !== "boolean" || !["facil", "medio", "dificil"].includes(item.dificuldade))) {
    throw new Error("Progresso inválido.");
  }
  return progresso.tarefas.some((item) => item.tarefaId === TAREFA_CORTINA_ID &&
    item.dificuldade === dificuldade && item.concluida);
}

function roupaConcluida(progresso, jogoSalvoId, dificuldade) {
  if (progresso?.jogoSalvoId !== jogoSalvoId || !Array.isArray(progresso.tarefas) ||
    progresso.tarefas.some((item) => typeof item?.tarefaId !== "string" ||
      typeof item.concluida !== "boolean" || !["facil", "medio", "dificil"].includes(item.dificuldade))) {
    throw new Error("Progresso inválido.");
  }
  return progresso.tarefas.some((item) => item.tarefaId === TAREFA_ROUPA_ID &&
    item.dificuldade === dificuldade && item.concluida);
}

export default function CenaQuarto({ jogoSalvo, personagem, perfilJogoId, jogoSalvoId, sessaoId, dificuldade,
  onAvancarDificuldade, avancandoDificuldade = false, avancoIncerto = false,
  erroAvanco, onConferirDificuldade, onSairDoJogo } = {}) {
  const personagemDaPartida = personagem ?? jogoSalvo?.perfilJogoId;
  const avatarDaPartida = personagemDaPartida?.imagemAvatar;
  // Somente o avatar original possui sprite; os demais usam sua ilustração real.
  const avatarEstatico = ["/images/boneco2.png", "/images/menina1.png", "/images/menina2.png"].includes(avatarDaPartida) ? avatarDaPartida : null;
  const [conquistas, setConquistas] = useState(0);
  const fase = { facil: 1, medio: 2, dificil: 3 }[dificuldade] ?? 1;
  const nomeDificuldade = { facil: "Fácil", medio: "Médio", dificil: "Difícil" }[dificuldade] ?? "Dificuldade indisponível";
  const [estrelas, setEstrelas] = useState(null);
  const contextoEstrelasRef = useRef(null);
  const chaveEstrelas = `${perfilJogoId}:${jogoSalvoId}:${sessaoId}:${dificuldade}`;
  const pontuacaoAtual = estrelas?.chave === chaveEstrelas ? estrelas : null;

  const invalidarEstrelas = useCallback((status) => {
    const contexto = contextoEstrelasRef.current;
    if (!contexto?.ativo || contexto.chave !== chaveEstrelas) return;
    contexto.versao += 1;
    contexto.pendente = false;
    setEstrelas({ chave: chaveEstrelas, status });
  }, [chaveEstrelas]);

  const atualizarEstrelas = useCallback(() => {
    const contexto = contextoEstrelasRef.current;
    if (!contexto?.ativo || contexto.chave !== chaveEstrelas) return;
    contexto.versao += 1;
    contexto.pendente = true;
    setEstrelas({ chave: chaveEstrelas, status: "carregando" });
    if (contexto.consultando) return;

    async function consultar() {
      while (contexto.ativo && contexto.pendente) {
        contexto.pendente = false;
        contexto.consultando = true;
        const versao = contexto.versao;
        const controller = new AbortController();
        contexto.requisicao = controller;
        try {
          if (!localStorage.getItem("token")?.trim()) throw new Error("Sessão indisponível.");
          const { data } = await api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
            signal: controller.signal, timeout: 10_000,
          });
          if (!contexto.ativo || controller.signal.aborted || contexto.versao !== versao) continue;
          const total = estrelasPersistidas(data, jogoSalvoId);
          setEstrelas({ chave: chaveEstrelas, status: total === null ? "indisponivel" : "pronta", total });
        } catch {
          if (contexto.ativo && !controller.signal.aborted && contexto.versao === versao) {
            setEstrelas({ chave: chaveEstrelas, status: "indisponivel" });
          }
        } finally {
          contexto.consultando = false;
          if (contexto.requisicao === controller) contexto.requisicao = null;
        }
      }
    }
    void consultar();
  }, [chaveEstrelas, jogoSalvoId]);
  
  const [camaArrumada, setCamaArrumada] = useState(false);
  const [praticaTarefas, setPraticaTarefas] = useState(null);
  const rodadaPraticaRef = useRef(null);
  const [estadoPratica, setEstadoPratica] = useState({ status: "ociosa", mensagem: "" });
  const [rodadaCama, setRodadaCama] = useState(0);
  const praticandoTarefas = praticaTarefas === chaveEstrelas;
  const timerPraticaCamaRef = useRef(null);
  const [rodadaCortina, setRodadaCortina] = useState(0);
  const [rodadaRoupa, setRodadaRoupa] = useState(0);
  const timerPraticaCortinaRef = useRef(null);
  const timerPraticaRoupaRef = useRef(null);
  const [janelaAberta, setJanelaAberta] = useState(false);
  const [guardaRoupaOrganizado, setGuardaRoupaOrganizado] = useState(false);
  
  const orientacaoRef = useRef(null);
  const [modalAtivo, setModalAtivo] = useState(null); 
  const [modalFimDeFase, setModalFimDeFase] = useState(false);
  const mostrandoFimPratica = modalFimDeFase === "pratica";
  
  const [feedback, setFeedback] = useState("");
  const [tipoFeedback, setTipoFeedback] = useState("");
  const [particulasFesta, setParticulasFesta] = useState([]);

  const [tarefaCama, setTarefaCama] = useState(null);
  const [respostasCama, setRespostasCama] = useState([]);
  const [carregandoCama, setCarregandoCama] = useState(false);
  const [erroCama, setErroCama] = useState("");
  const [sessaoCamaInvalida, setSessaoCamaInvalida] = useState(false);
  const [enviandoCama, setEnviandoCama] = useState(false);
  const [erroRestauracaoCama, setErroRestauracaoCama] = useState("");
  const contextoCamaRef = useRef(null);
  const envioCamaRef = useRef(null);
  const conquistaCamaRef = useRef(null);
  const chaveCama = `conectamente:resposta-pendente:${jogoSalvoId}:${TAREFA_CAMA_ID}:${dificuldade}`;
  // Uma conclusão anterior não confirma o resultado de uma nova prática.
  const chavePraticaCama = `${chaveCama}:pratica`;
  const chaveConquista = `${chaveCama}:${fase}`;
  const [tarefaCortina, setTarefaCortina] = useState(null);
  const [respostasCortina, setRespostasCortina] = useState([]);
  const [carregandoCortina, setCarregandoCortina] = useState(false);
  const [erroCortina, setErroCortina] = useState("");
  const [sessaoCortinaInvalida, setSessaoCortinaInvalida] = useState(false);
  const [enviandoCortina, setEnviandoCortina] = useState(false);
  const contextoCortinaRef = useRef(null);
  const envioCortinaRef = useRef(null);
  const conquistaCortinaRef = useRef(null);
  const chaveCortina = `conectamente:resposta-pendente:${jogoSalvoId}:${TAREFA_CORTINA_ID}:${dificuldade}`;
  const chavePraticaCortina = `${chaveCortina}:pratica`;
  const chaveConquistaCortina = `${chaveCortina}:${fase}`;
  const [tarefaRoupa, setTarefaRoupa] = useState(null);
  const [respostasRoupa, setRespostasRoupa] = useState([]);
  const [carregandoRoupa, setCarregandoRoupa] = useState(false);
  const [erroRoupa, setErroRoupa] = useState("");
  const [sessaoRoupaInvalida, setSessaoRoupaInvalida] = useState(false);
  const [enviandoRoupa, setEnviandoRoupa] = useState(false);
  const contextoRoupaRef = useRef(null);
  const envioRoupaRef = useRef(null);
  const conquistaRoupaRef = useRef(null);
  const fimRoupaRef = useRef(null);
  const chaveRoupa = `conectamente:resposta-pendente:${jogoSalvoId}:${TAREFA_ROUPA_ID}:${dificuldade}`;
  const chavePraticaRoupa = `${chaveRoupa}:pratica`;
  const chaveConquistaRoupa = `${chaveRoupa}:${fase}`;
  const contextoValido = [perfilJogoId, jogoSalvoId].every((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)) &&
    typeof sessaoId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(sessaoId) &&
    ["facil", "medio", "dificil"].includes(dificuldade);

  // Posição e movimento do personagem
  const [posicaoPersonagem, setPosicaoPersonagem] = useState({ x: 44, y: 10 });
  const [isAndando, setIsAndando] = useState(false);

  // Restaura as três tarefas pela mesma consulta, sem depender dos modais.
  useEffect(() => {
    if (modalAtivo === "orientacao") orientacaoRef.current?.showModal();
  }, [modalAtivo]);

  useEffect(() => {
    const controller = new AbortController();
    let ativo = true;
    const contextoEstrelas = { chave: chaveEstrelas, ativo: true, versao: 0, consultando: true, pendente: false };
    contextoEstrelasRef.current = contextoEstrelas;

    async function restaurarCama() {
      rodadaPraticaRef.current?.controller.abort();
      rodadaPraticaRef.current = null;
      setEstadoPratica({ status: "ociosa", mensagem: "" });
      setPraticaTarefas(null);
      setEstrelas({ chave: chaveEstrelas, status: "carregando" });
      setCamaArrumada(false);
      setJanelaAberta(false);
      setGuardaRoupaOrganizado(false);
      setModalFimDeFase(false);
      if (conquistaRoupaRef.current) {
        conquistaRoupaRef.current = null;
        setConquistas((total) => Math.max(0, total - 1));
      }
      if (conquistaCortinaRef.current) {
        conquistaCortinaRef.current = null;
        setConquistas((total) => Math.max(0, total - 1));
      }
      setErroRestauracaoCama("");
      if (conquistaCamaRef.current) {
        conquistaCamaRef.current = null;
        setConquistas((total) => Math.max(0, total - 1));
      }

      try {
        if (!localStorage.getItem("token")?.trim() || !contextoValido) {
          setEstrelas({ chave: chaveEstrelas, status: "indisponivel" });
          return;
        }
        const { data } = await api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
          signal: controller.signal, timeout: 10_000,
        });
        if (!ativo || controller.signal.aborted) return;

        const camaPersistida = camaConcluida(data, jogoSalvoId, dificuldade);
        const cortinaPersistida = cortinaConcluida(data, jogoSalvoId, dificuldade);
        const roupaPersistida = roupaConcluida(data, jogoSalvoId, dificuldade);
        if (contextoEstrelas.versao === 0) {
          const total = estrelasPersistidas(data, jogoSalvoId);
          setEstrelas({ chave: chaveEstrelas, status: total === null ? "indisponivel" : "pronta", total });
        }
        if (camaPersistida && cortinaPersistida && roupaPersistida) {
          // Permite continuar/sair de uma fase já concluída, sem repetir a festa.
          setModalFimDeFase(true);
        }
        if (roupaPersistida) {
          setGuardaRoupaOrganizado(true);
          sessionStorage.removeItem(chaveRoupa);
          if (!conquistaRoupaRef.current?.startsWith(`${chaveRoupa}:`)) {
            conquistaRoupaRef.current = `${chaveRoupa}:${fase}`;
            setConquistas((total) => total + 1);
          }
        }
        if (cortinaPersistida) {
          setJanelaAberta(true);
          sessionStorage.removeItem(chaveCortina);
          if (!conquistaCortinaRef.current?.startsWith(`${chaveCortina}:`)) {
            conquistaCortinaRef.current = `${chaveCortina}:${fase}`;
            setConquistas((total) => total + 1);
          }
        }
        if (camaPersistida) {
          setCamaArrumada(true);
          sessionStorage.removeItem(chaveCama);
          // Restaura somente a conquista local, sem conceder estrelas no servidor.
          if (!conquistaCamaRef.current?.startsWith(`${chaveCama}:`)) {
            conquistaCamaRef.current = `${chaveCama}:${fase}`;
            setConquistas((total) => total + 1);
          }
        }
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;
        if (contextoEstrelas.versao === 0) setEstrelas({ chave: chaveEstrelas, status: "indisponivel" });
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setErroRestauracaoCama("Sessão expirada. Entre novamente para ver seu progresso.");
        } else {
          setErroRestauracaoCama("Não foi possível carregar seu progresso. Peça ajuda a um responsável.");
        }
      } finally {
        contextoEstrelas.consultando = false;
        if (contextoEstrelas.ativo && contextoEstrelas.pendente) atualizarEstrelas();
      }
    }

    restaurarCama();
    return () => {
      ativo = false;
      rodadaPraticaRef.current?.controller.abort();
      rodadaPraticaRef.current = null;
      contextoEstrelas.ativo = false;
      contextoEstrelas.requisicao?.abort();
      controller.abort();
      clearTimeout(timerPraticaCamaRef.current);
      timerPraticaCamaRef.current = null;
      clearTimeout(timerPraticaCortinaRef.current);
      timerPraticaCortinaRef.current = null;
      clearTimeout(timerPraticaRoupaRef.current);
      timerPraticaRoupaRef.current = null;
      clearTimeout(fimRoupaRef.current);
      fimRoupaRef.current = null;
    };
  }, [contextoValido, perfilJogoId, jogoSalvoId, sessaoId, dificuldade, fase, chaveCama, chaveCortina, chaveRoupa, chaveEstrelas, atualizarEstrelas]);

  useEffect(() => {
    let timeoutAndar;
    const lidarComTeclado = (evento) => {
      if (modalAtivo !== null || modalFimDeFase) return;

      const teclasMovimento = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "a", "w", "s", "d"];
      if (teclasMovimento.includes(evento.key)) {
        setIsAndando(true);
        clearTimeout(timeoutAndar);
        timeoutAndar = setTimeout(() => setIsAndando(false), 200);
      }

      setPosicaoPersonagem((prev) => {
        let novoX = prev.x;
        let novoY = prev.y;
        const passo = 2;

        // Caixa de 32,5%: 67,5 + 32,5 = 100% da largura do palco.
        if (evento.key === "ArrowRight" || evento.key === "d") novoX = Math.min(novoX + passo, 67.5);
        else if (evento.key === "ArrowLeft" || evento.key === "a") novoX = Math.max(novoX - passo, 5);
        else if (evento.key === "ArrowUp" || evento.key === "w") novoY = Math.min(novoY + passo, 25);
        // Reserva vertical para a compensação da transparência inferior do sprite.
        else if (evento.key === "ArrowDown" || evento.key === "s") novoY = Math.max(novoY - passo, 8);

        return { x: novoX, y: novoY };
      });
    };

    window.addEventListener("keydown", lidarComTeclado);
    return () => {
      window.removeEventListener("keydown", lidarComTeclado);
      clearTimeout(timeoutAndar);
    };
  }, [modalAtivo, modalFimDeFase]);
  // Consulta a pergunta e as respostas da cama na API
  useEffect(() => {
    if (modalAtivo !== "cama") return;

    const controller = new AbortController();
    let ativo = true;
    const contexto = { controller, ativo: true, pratica: praticandoTarefas, praticaRodada: rodadaPraticaRef.current, rodada: rodadaCama, chave: chaveEstrelas };
    contextoCamaRef.current = contexto;

    async function carregarCama() {
      setCarregandoCama(true);
      setErroCama("");
      setTarefaCama(null);
      setRespostasCama([]);
      setSessaoCamaInvalida(false);
      setEnviandoCama(false);

      try {
        if (!localStorage.getItem("token")?.trim()) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setSessaoCamaInvalida(true);
          setErroCama("Sessão ausente. Entre novamente.");
          return;
        }

        if (!contextoValido) throw new Error("A partida não está disponível. Peça ajuda a um responsável.");

        const tarefaId = TAREFA_CAMA_ID;

        const [resultadoTarefa, resultadoRespostas, resultadoProgresso] =
          await Promise.all([
            api.get(`/tarefas/${tarefaId}`, {
              signal: controller.signal,
            }),
            api.get(`/tarefas/${tarefaId}/respostas`, {
              signal: controller.signal,
            }),
            api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
              signal: controller.signal, timeout: 10_000,
            }),
          ]);

        if (!ativo) return;

        const tarefa = resultadoTarefa.data;
        const respostas = resultadoRespostas.data;

        if (
          tarefa?._id !== tarefaId ||
          typeof tarefa.enunciado !== "string" ||
          !tarefa.enunciado.trim() ||
          !Array.isArray(respostas) ||
          respostas.length !== 4 ||
          new Set(respostas.map((resposta) => resposta?._id)).size !== 4 ||
          respostas.some(
            (resposta) =>
              typeof resposta?._id !== "string" ||
              !resposta._id ||
              resposta.tarefaId !== tarefaId ||
              !resposta.texto ||
              !resposta.imagem
          )
        ) {
          throw new Error("Não foi possível carregar a tarefa. Peça ajuda a um responsável.");
        }

        setTarefaCama(tarefa);
        setErroRestauracaoCama("");
        const concluida = camaConcluida(resultadoProgresso.data, jogoSalvoId, dificuldade);
        if (sessionStorage.getItem(chavePraticaCama)) {
          setErroCama("Sua prática anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
          return;
        }
        if (contexto.pratica && !concluida) throw new Error("Conclusão da cama não confirmada.");
        if (!contexto.pratica && (concluida ||
          (envioCamaRef.current?.chave === chaveCama && envioCamaRef.current.confirmada))) {
          sessionStorage.removeItem(chaveCama);
          setCamaArrumada(true);
          if (conquistaCamaRef.current !== chaveConquista) {
            conquistaCamaRef.current = chaveConquista;
            setConquistas((total) => total + 1);
          }
          setErroCama("Você já concluiu esta tarefa neste nível. Nenhuma resposta nova foi enviada.");
          return;
        }
        if (sessionStorage.getItem(chaveCama)) {
          setErroCama("Sua resposta anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
          return;
        }
        setRespostasCama(respostas);
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;

        setTarefaCama(null);
        setRespostasCama([]);
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setSessaoCamaInvalida(true);
          setErroCama("Sessão expirada. Entre novamente.");
        } else {
          setErroCama("Não foi possível carregar a pergunta.");
        }
      } finally {
        if (ativo) {
          setCarregandoCama(false);
        }
      }
    }

    carregarCama();

    return () => {
      ativo = false;
      contexto.ativo = false;
      controller.abort();
      clearTimeout(contexto.timerCama);
      if (envioCamaRef.current?.contexto === contexto) {
        if (envioCamaRef.current.enviado && !envioCamaRef.current.confirmada) invalidarEstrelas("indisponivel");
        envioCamaRef.current.controller.abort();
        if (!envioCamaRef.current.enviado) envioCamaRef.current = null;
      }
      if (contextoCamaRef.current === contexto) contextoCamaRef.current = null;
    };
  }, [modalAtivo, contextoValido, jogoSalvoId, dificuldade, sessaoId, perfilJogoId, chaveCama, chaveConquista, chavePraticaCama, praticandoTarefas, rodadaCama, chaveEstrelas, invalidarEstrelas]);

  // Consulta a pergunta e as respostas da cortina na API
  useEffect(() => {
    if (modalAtivo !== "janela") return;

    const controller = new AbortController();
    let ativo = true;
    const contexto = { controller, ativo: true, pratica: praticandoTarefas, praticaRodada: rodadaPraticaRef.current, rodada: rodadaCortina, chave: chaveEstrelas };
    contextoCortinaRef.current = contexto;

    async function carregarCortina() {
      setCarregandoCortina(true);
      setErroCortina("");
      setTarefaCortina(null);
      setRespostasCortina([]);
      setSessaoCortinaInvalida(false);
      setEnviandoCortina(false);

      try {
        if (!localStorage.getItem("token")?.trim()) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setSessaoCortinaInvalida(true);
          setErroCortina("Sessão ausente. Entre novamente.");
          return;
        }

        if (!contextoValido) throw new Error("A partida não está disponível. Peça ajuda a um responsável.");

        const tarefaId = TAREFA_CORTINA_ID;

        const [resultadoTarefa, resultadoRespostas, resultadoProgresso] =
          await Promise.all([
            api.get(`/tarefas/${tarefaId}`, {
              signal: controller.signal,
            }),
            api.get(`/tarefas/${tarefaId}/respostas`, {
              signal: controller.signal,
            }),
            api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
              signal: controller.signal, timeout: 10_000,
            }),
          ]);

        if (!ativo) return;

        const tarefa = resultadoTarefa.data;
        const respostas = resultadoRespostas.data;

        if (
          tarefa?._id !== tarefaId ||
          typeof tarefa.enunciado !== "string" ||
          !tarefa.enunciado.trim() ||
          !Array.isArray(respostas) ||
          respostas.length !== 4 ||
          new Set(respostas.map((resposta) => resposta?._id)).size !== 4 ||
          respostas.some(
            (resposta) =>
              typeof resposta?._id !== "string" ||
              !resposta._id ||
              resposta.tarefaId !== tarefaId ||
              !resposta.texto ||
              !resposta.imagem
          )
        ) {
          throw new Error("Não foi possível carregar a tarefa. Peça ajuda a um responsável.");
        }

        setTarefaCortina(tarefa);
        setErroRestauracaoCama("");
        const concluida = cortinaConcluida(resultadoProgresso.data, jogoSalvoId, dificuldade);
        if (sessionStorage.getItem(chavePraticaCortina)) {
          setErroCortina("Sua prática anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
          return;
        }
        if (contexto.pratica && !concluida) throw new Error("Conclusão da cortina não confirmada.");
        if (!contexto.pratica && (concluida ||
          (envioCortinaRef.current?.chave === chaveCortina && envioCortinaRef.current.confirmada))) {
          sessionStorage.removeItem(chaveCortina);
          setJanelaAberta(true);
          if (conquistaCortinaRef.current !== chaveConquistaCortina) {
            conquistaCortinaRef.current = chaveConquistaCortina;
            setConquistas((total) => total + 1);
          }
          setErroCortina("Você já concluiu esta tarefa neste nível. Nenhuma resposta nova foi enviada.");
          return;
        }
        if (sessionStorage.getItem(chaveCortina)) {
          setErroCortina("Sua resposta anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
          return;
        }
        setRespostasCortina(respostas);
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;

        setTarefaCortina(null);
        setRespostasCortina([]);
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setSessaoCortinaInvalida(true);
          setErroCortina("Sessão expirada. Entre novamente.");
        } else {
          setErroCortina("Não foi possível carregar a pergunta.");
        }
      } finally {
        if (ativo) {
          setCarregandoCortina(false);
        }
      }
    }

    carregarCortina();

    return () => {
      ativo = false;
      contexto.ativo = false;
      controller.abort();
      clearTimeout(contexto.timerCortina);
      if (envioCortinaRef.current?.contexto === contexto) {
        if (envioCortinaRef.current.enviado && !envioCortinaRef.current.confirmada) invalidarEstrelas("indisponivel");
        envioCortinaRef.current.controller.abort();
        if (!envioCortinaRef.current.enviado) envioCortinaRef.current = null;
      }
      if (contextoCortinaRef.current === contexto) contextoCortinaRef.current = null;
    };
  }, [modalAtivo, contextoValido, jogoSalvoId, dificuldade, sessaoId, perfilJogoId, chaveCortina, chaveConquistaCortina, chavePraticaCortina, praticandoTarefas, rodadaCortina, chaveEstrelas, invalidarEstrelas]);

  // Consulta a pergunta e as respostas da roupa na API
  useEffect(() => {
    if (modalAtivo !== "guardaRoupa") return;

    const controller = new AbortController();
    let ativo = true;
    const contexto = { controller, ativo: true, pratica: praticandoTarefas, praticaRodada: rodadaPraticaRef.current, rodada: rodadaRoupa, chave: chaveEstrelas };
    contextoRoupaRef.current = contexto;

    async function carregarRoupa() {
      setCarregandoRoupa(true);
      setErroRoupa("");
      setTarefaRoupa(null);
      setRespostasRoupa([]);
      setSessaoRoupaInvalida(false);
      setEnviandoRoupa(false);

      try {
        if (!localStorage.getItem("token")?.trim()) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setSessaoRoupaInvalida(true);
          setErroRoupa("Sessão ausente. Entre novamente.");
          return;
        }

        if (!contextoValido) throw new Error("A partida não está disponível. Peça ajuda a um responsável.");

        const tarefaId = TAREFA_ROUPA_ID;

        const [resultadoTarefa, resultadoRespostas, resultadoProgresso] =
          await Promise.all([
            api.get(`/tarefas/${tarefaId}`, {
              signal: controller.signal,
            }),
            api.get(`/tarefas/${tarefaId}/respostas`, {
              signal: controller.signal,
            }),
            api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
              signal: controller.signal, timeout: 10_000,
            }),
          ]);

        if (!ativo) return;

        const tarefa = resultadoTarefa.data;
        const respostas = resultadoRespostas.data;

        if (
          tarefa?._id !== tarefaId ||
          typeof tarefa.enunciado !== "string" ||
          !tarefa.enunciado.trim() ||
          !Array.isArray(respostas) ||
          respostas.length !== 4 ||
          new Set(respostas.map((resposta) => resposta?._id)).size !== 4 ||
          respostas.some(
            (resposta) =>
              typeof resposta?._id !== "string" ||
              !resposta._id ||
              resposta.tarefaId !== tarefaId ||
              !resposta.texto ||
              !resposta.imagem
          )
        ) {
          throw new Error("Não foi possível carregar a tarefa. Peça ajuda a um responsável.");
        }

        setTarefaRoupa(tarefa);
        setErroRestauracaoCama("");
        const concluida = roupaConcluida(resultadoProgresso.data, jogoSalvoId, dificuldade);
        if (sessionStorage.getItem(chavePraticaRoupa)) {
          setErroRoupa("Sua prática anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
          return;
        }
        if (contexto.pratica && !concluida) throw new Error("Conclusão da roupa não confirmada.");
        if (!contexto.pratica && (concluida ||
          (envioRoupaRef.current?.chave === chaveRoupa && envioRoupaRef.current.confirmada))) {
          sessionStorage.removeItem(chaveRoupa);
          setGuardaRoupaOrganizado(true);
          if (conquistaRoupaRef.current !== chaveConquistaRoupa) {
            conquistaRoupaRef.current = chaveConquistaRoupa;
            setConquistas((total) => total + 1);
          }
          setErroRoupa("Você já concluiu esta tarefa neste nível. Nenhuma resposta nova foi enviada.");
          return;
        }
        if (sessionStorage.getItem(chaveRoupa)) {
          setErroRoupa("Sua resposta anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
          return;
        }
        setRespostasRoupa(respostas);
      } catch (error) {
        if (!ativo || controller.signal.aborted) return;

        setTarefaRoupa(null);
        setRespostasRoupa([]);
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setSessaoRoupaInvalida(true);
          setErroRoupa("Sessão expirada. Entre novamente.");
        } else {
          setErroRoupa("Não foi possível carregar a pergunta.");
        }
      } finally {
        if (ativo) {
          setCarregandoRoupa(false);
        }
      }
    }

    carregarRoupa();

    return () => {
      ativo = false;
      contexto.ativo = false;
      controller.abort();
      clearTimeout(contexto.timerRoupa);
      if (envioRoupaRef.current?.contexto === contexto) {
        if (envioRoupaRef.current.enviado && !envioRoupaRef.current.confirmada) invalidarEstrelas("indisponivel");
        envioRoupaRef.current.controller.abort();
        if (!envioRoupaRef.current.enviado) envioRoupaRef.current = null;
      }
      if (contextoRoupaRef.current === contexto) contextoRoupaRef.current = null;
    };
  }, [modalAtivo, contextoValido, jogoSalvoId, dificuldade, sessaoId, perfilJogoId, chaveRoupa, chaveConquistaRoupa, chavePraticaRoupa, praticandoTarefas, rodadaRoupa, chaveEstrelas, invalidarEstrelas]);

  const tocarAudio = (caminhoAudio) => {
    try {
      const som = new Audio(caminhoAudio);
      som.play().catch((erro) => console.log("Áudio bloqueado:", erro));
    } catch (e) {
      console.log("Erro ao carregar áudio:", e);
    }
  };

  const verificarFimDeJogo = (novasConquistas) => {
    if (novasConquistas >= 3) {
      setTimeout(() => {
        setModalFimDeFase(true);
        tocarAudio("/audio/parabens.mp3");
      }, 1000);
    }
  };

  // --- LÓGICA DE SEQUÊNCIA OBRIGATÓRIA ---
  const praticaPermite = (tarefaId) => {
    const rodada = rodadaPraticaRef.current;
    return !praticandoTarefas || (rodada?.chave === chaveEstrelas && rodada.status === "ativa" &&
      !rodada.animando && rodada.sequencia[rodada.indice] === tarefaId);
  };

  const orientarForaDaOrdem = (tarefaId) => {
    if (praticaPermite(tarefaId)) return false;
    setModalAtivo("orientacao");
    return true;
  };

  const handleClicarCama = () => {
    if (modalAtivo !== null || modalFimDeFase) return;
    if (orientarForaDaOrdem(TAREFA_CAMA_ID)) return;
    if (praticandoTarefas) {
      const anterior = envioCamaRef.current;
      if (anterior?.pendente && !anterior.controller.signal.aborted) return;
      // Somente um novo clique explícito libera outra prática já confirmada.
      if (anterior?.confirmada) {
        if (anterior.pendente) return;
        envioCamaRef.current = null;
      }
    }
    if (!camaArrumada || praticandoTarefas) {
      setRodadaCama((rodada) => rodada + 1);
      setTarefaCama(null);
      setRespostasCama([]);
      setCarregandoCama(true);
      setErroCama("");
      setSessaoCamaInvalida(false);
      setModalAtivo("cama");
      setFeedback("");
      setTipoFeedback("");
      tocarAudio("/audio/pergunta-cama.mp3");
    }
  };

  const handleClicarJanela = () => {
    if (modalAtivo !== null || modalFimDeFase) return;
    if (orientarForaDaOrdem(TAREFA_CORTINA_ID)) return;
    if (!praticandoTarefas && !camaArrumada) {
      setModalAtivo("orientacao");
      return;
    }
    if (praticandoTarefas) {
      const anterior = envioCortinaRef.current;
      if (anterior?.pendente && !anterior.controller.signal.aborted) return;
      // Somente um novo clique explícito libera outra prática já confirmada.
      if (anterior?.confirmada) {
        if (anterior.pendente) return;
        envioCortinaRef.current = null;
      }
    }
    if (!janelaAberta || praticandoTarefas) {
      setRodadaCortina((rodada) => rodada + 1);
      setTarefaCortina(null);
      setRespostasCortina([]);
      setCarregandoCortina(true);
      setErroCortina("");
      setSessaoCortinaInvalida(false);
      setModalAtivo("janela");
      setFeedback("");
      setTipoFeedback("");
      tocarAudio("/audio/pergunta-janela.mp3");
    }
  };

  const handleClicarGuardaRoupa = () => {
    if (modalAtivo !== null || modalFimDeFase) return;
    if (orientarForaDaOrdem(TAREFA_ROUPA_ID)) return;
    if (!praticandoTarefas && (!camaArrumada || !janelaAberta)) {
      setModalAtivo("orientacao");
      return;
    }
    if (praticandoTarefas) {
      const anterior = envioRoupaRef.current;
      if (anterior?.pendente && !anterior.controller.signal.aborted) return;
      // Somente um novo clique explícito libera outra prática já confirmada.
      if (anterior?.confirmada) {
        if (anterior.pendente) return;
        envioRoupaRef.current = null;
      }
    }
    if (!guardaRoupaOrganizado || praticandoTarefas) {
      setRodadaRoupa((rodada) => rodada + 1);
      setTarefaRoupa(null);
      setRespostasRoupa([]);
      setCarregandoRoupa(true);
      setErroRoupa("");
      setSessaoRoupaInvalida(false);
      setModalAtivo("guardaRoupa");
      setFeedback("");
      setTipoFeedback("");
      tocarAudio("/audio/pergunta-guardaroupa.mp3");
    }
  };

  const dispararFestaNativa = () => {
    const simbolos = ['⭐'];
    const novasParticulas = Array.from({ length: 15 }).map((_, index) => {
      const angulo = Math.random() * Math.PI * 2;
      const distancia = 100 + Math.random() * 250;
      return {
        id: Date.now() + index,
        simbolo: simbolos[Math.floor(Math.random() * simbolos.length)],
        style: {
          left: `50%`,
          top: `50%`,
          '--fimX': `${Math.cos(angulo) * distancia}px`,
          '--fimY': `${Math.sin(angulo) * distancia - 100}px`,
        }
      };
    });
    setParticulasFesta(novasParticulas);
    setTimeout(() => setParticulasFesta([]), 1200);
  };

  const handleEscolherOpcaoCama = async (respostaEscolhidaId, rodada) => {
    if (!praticaPermite(TAREFA_CAMA_ID)) return;
    const contexto = contextoCamaRef.current;
    const chaveEnvio = contexto?.pratica ? chavePraticaCama : chaveCama;
    if (!contexto?.ativo || contexto.rodada !== rodada || contexto.chave !== chaveEstrelas ||
      !contextoValido || carregandoCama || erroCama || (camaArrumada && !contexto.pratica) ||
      !respostasCama.some((resposta) => resposta._id === respostaEscolhidaId) ||
      (envioCamaRef.current?.chave === chaveEnvio && (envioCamaRef.current.pendente || envioCamaRef.current.confirmada))) return;

    const envio = { chave: chaveEnvio, contexto, controller: new AbortController(), pendente: true, enviado: false, confirmada: false };
    envioCamaRef.current = envio;
    setEnviandoCama(true);
    const atual = () => contexto.ativo && (!contexto.pratica || contexto.praticaRodada === rodadaPraticaRef.current) && !envio.controller.signal.aborted && envioCamaRef.current === envio;

    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const { data: progresso } = await api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
        signal: envio.controller.signal, timeout: 10_000,
      });
      if (!atual()) return;
      const concluida = camaConcluida(progresso, jogoSalvoId, dificuldade);
      if (contexto.pratica && !concluida) throw new Error("Conclusão da cama não confirmada.");
      if (concluida && !contexto.pratica) {
        setCamaArrumada(true);
        if (conquistaCamaRef.current !== chaveConquista) {
          conquistaCamaRef.current = chaveConquista;
          setConquistas((total) => total + 1);
        }
        setErroCama("Você já concluiu esta tarefa neste nível. Nenhuma resposta nova foi enviada.");
        return;
      }
      if (!praticaPermite(TAREFA_CAMA_ID)) return;
      if (sessionStorage.getItem(chaveCama) || sessionStorage.getItem(chavePraticaCama)) {
        setErroCama("Sua resposta anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
        return;
      }

      // Persiste apenas a incerteza, sem JWT, para impedir reenvio ao reabrir/recarregar a aba.
      sessionStorage.setItem(chaveEnvio, "pendente");
      envio.enviado = true;
      invalidarEstrelas("carregando");
      const { status, data } = await api.post("/historico-jogo/responder", {
        perfilJogoId, jogoSalvoId, tarefaId: TAREFA_CAMA_ID,
        respostaEscolhidaId, dificuldade, sessaoId,
      }, { signal: envio.controller.signal, timeout: 10_000 });
      if (!atual()) return;
      if (status !== 201 || typeof data?.acertou !== "boolean" ||
        data.dificuldade !== dificuldade || !Number.isInteger(data.tentativa) || data.tentativa < 1 ||
        !Number.isFinite(data.pontuacaoGanha) || data.pontuacaoGanha < 0) {
        throw new Error("Resultado da tentativa não confirmado.");
      }
      atualizarEstrelas();
      sessionStorage.removeItem(chaveEnvio);
      if (!data.acertou) {
        envio.pendente = false;
        envioCamaRef.current = null;
        setFeedback("Quase lá! Tente novamente!");
        setTipoFeedback("erro");
        setEnviandoCama(false);
        return;
      }

      envio.confirmada = true;
      setFeedback(`Muito bem! Você acertou! Você ganhou ${data.pontuacaoGanha} ${data.pontuacaoGanha === 1 ? "estrela" : "estrelas"}!`);
      setTipoFeedback("sucesso");
      tocarAudio("/audio/parabens.mp3");
      dispararFestaNativa();

      if (contexto.pratica) {
        // Mantém a trava por 1,5 s mesmo se o modal for fechado na animação.
        contexto.praticaRodada.animando = true;
        timerPraticaCamaRef.current = setTimeout(() => {
          const rodadaAtual = contexto.praticaRodada;
          if (rodadaPraticaRef.current !== rodadaAtual || rodadaAtual.chave !== chaveEstrelas) return;
          rodadaAtual.animando = false;
          rodadaAtual.indice += 1;
          if (rodadaAtual.indice === rodadaAtual.sequencia.length) {
            rodadaAtual.status = "concluida";
            setModalAtivo(null);
            setModalFimDeFase("pratica");
          }
          envio.pendente = false;
          if (envioCamaRef.current === envio) setEnviandoCama(false);
          timerPraticaCamaRef.current = null;
        }, 1500);
      }
      
      contexto.timerCama = setTimeout(() => {
        if (!atual()) return;
        setCamaArrumada(true);
        if (!contexto.pratica && conquistaCamaRef.current !== chaveConquista) {
          conquistaCamaRef.current = chaveConquista;
          setConquistas((total) => total + 1);
        }
        setEnviandoCama(false);
        setModalAtivo(null);
        if (!contexto.pratica) verificarFimDeJogo(conquistas + 1);
      }, 1500);
    } catch (error) {
      if (!atual()) return;
      const status = error.response?.status;
      if (envio.enviado) invalidarEstrelas("indisponivel");
      if ([400, 401, 403, 404, 409].includes(status)) {
        sessionStorage.removeItem(chaveEnvio);
        envio.enviado = false;
      }
      if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setSessaoCamaInvalida(true);
        setErroCama("Sessão expirada. Entre novamente.");
      } else if (status === 403) {
        setErroCama(error.response?.data?.codigo === "LIMITE_TEMPO_ATINGIDO" ? "Seu tempo de jogo terminou por hoje." : "Você não pode responder agora. Peça ajuda a um responsável.");
      } else if (status === 409) {
        setErroCama("A sessão da partida terminou ou não está disponível. Volte para Jogos Salvos.");
      } else {
        setErroCama(envio.enviado
          ? contexto.pratica
            ? "Não foi possível confirmar esta prática. Ela pode ter sido registrada. Não envie de novo. Peça ajuda a um responsável."
            : "Não foi possível confirmar sua resposta. Ela pode ter sido registrada. Não envie de novo. Peça ajuda a um responsável."
          : "Não foi possível verificar sua resposta. Peça ajuda a um responsável.");
      }
    } finally {
      if (atual() && !envio.confirmada) {
        setEnviandoCama(false);
        if (!envio.enviado) envioCamaRef.current = null;
      }
    }
  };

  const handleEscolherOpcaoJanela = async (respostaEscolhidaId, rodada) => {
    if (!praticaPermite(TAREFA_CORTINA_ID)) return;
    const contexto = contextoCortinaRef.current;
    const chaveEnvio = contexto?.pratica ? chavePraticaCortina : chaveCortina;
    if (!contexto?.ativo || contexto.rodada !== rodada || contexto.chave !== chaveEstrelas ||
      !camaArrumada || !contextoValido || carregandoCortina || erroCortina || (janelaAberta && !contexto.pratica) ||
      !respostasCortina.some((resposta) => resposta._id === respostaEscolhidaId) ||
      (envioCortinaRef.current?.chave === chaveEnvio && (envioCortinaRef.current.pendente || envioCortinaRef.current.confirmada))) return;

    const envio = { chave: chaveEnvio, contexto, controller: new AbortController(), pendente: true, enviado: false, confirmada: false };
    envioCortinaRef.current = envio;
    setEnviandoCortina(true);
    const atual = () => contexto.ativo && (!contexto.pratica || contexto.praticaRodada === rodadaPraticaRef.current) && !envio.controller.signal.aborted && envioCortinaRef.current === envio;

    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const { data: progresso } = await api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
        signal: envio.controller.signal, timeout: 10_000,
      });
      if (!atual()) return;
      const concluida = cortinaConcluida(progresso, jogoSalvoId, dificuldade);
      if (contexto.pratica && !concluida) throw new Error("Conclusão da cortina não confirmada.");
      if (concluida && !contexto.pratica) {
        setJanelaAberta(true);
        if (conquistaCortinaRef.current !== chaveConquistaCortina) {
          conquistaCortinaRef.current = chaveConquistaCortina;
          setConquistas((total) => total + 1);
        }
        setErroCortina("Você já concluiu esta tarefa neste nível. Nenhuma resposta nova foi enviada.");
        return;
      }
      if (!praticaPermite(TAREFA_CORTINA_ID)) return;
      if (sessionStorage.getItem(chaveCortina) || sessionStorage.getItem(chavePraticaCortina)) {
        setErroCortina("Sua resposta anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
        return;
      }

      // Persiste apenas a incerteza, sem JWT, para impedir reenvio ao reabrir/recarregar a aba.
      sessionStorage.setItem(chaveEnvio, "pendente");
      envio.enviado = true;
      invalidarEstrelas("carregando");
      const { status, data } = await api.post("/historico-jogo/responder", {
        perfilJogoId, jogoSalvoId, tarefaId: TAREFA_CORTINA_ID,
        respostaEscolhidaId, dificuldade, sessaoId,
      }, { signal: envio.controller.signal, timeout: 10_000 });
      if (!atual()) return;
      if (status !== 201 || typeof data?.acertou !== "boolean" ||
        data.dificuldade !== dificuldade || !Number.isInteger(data.tentativa) || data.tentativa < 1 ||
        !Number.isFinite(data.pontuacaoGanha) || data.pontuacaoGanha < 0) {
        throw new Error("Resultado da tentativa não confirmado.");
      }
      atualizarEstrelas();
      sessionStorage.removeItem(chaveEnvio);
      if (!data.acertou) {
        envio.pendente = false;
        envioCortinaRef.current = null;
        setFeedback("Quase lá! Tente novamente!");
        setTipoFeedback("erro");
        setEnviandoCortina(false);
        return;
      }

      envio.confirmada = true;
      setFeedback(`Muito bem! Você acertou! Você ganhou ${data.pontuacaoGanha} ${data.pontuacaoGanha === 1 ? "estrela" : "estrelas"}!`);
      setTipoFeedback("sucesso");
      tocarAudio("/audio/parabens.mp3");
      dispararFestaNativa();

      if (contexto.pratica) {
        // Mantém a trava por 1,5 s mesmo se o modal for fechado na animação.
        contexto.praticaRodada.animando = true;
        timerPraticaCortinaRef.current = setTimeout(() => {
          const rodadaAtual = contexto.praticaRodada;
          if (rodadaPraticaRef.current !== rodadaAtual || rodadaAtual.chave !== chaveEstrelas) return;
          rodadaAtual.animando = false;
          rodadaAtual.indice += 1;
          if (rodadaAtual.indice === rodadaAtual.sequencia.length) {
            rodadaAtual.status = "concluida";
            setModalAtivo(null);
            setModalFimDeFase("pratica");
          }
          envio.pendente = false;
          if (envioCortinaRef.current === envio) setEnviandoCortina(false);
          timerPraticaCortinaRef.current = null;
        }, 1500);
      }
      
      contexto.timerCortina = setTimeout(() => {
        if (!atual()) return;
        setJanelaAberta(true);
        if (!contexto.pratica && conquistaCortinaRef.current !== chaveConquistaCortina) {
          conquistaCortinaRef.current = chaveConquistaCortina;
          setConquistas((total) => total + 1);
        }
        setEnviandoCortina(false);
        setModalAtivo(null);
        if (!contexto.pratica) verificarFimDeJogo(conquistas + 1);
      }, 1500);
    } catch (error) {
      if (!atual()) return;
      const status = error.response?.status;
      if (envio.enviado) invalidarEstrelas("indisponivel");
      if ([400, 401, 403, 404, 409].includes(status)) {
        sessionStorage.removeItem(chaveEnvio);
        envio.enviado = false;
      }
      if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setSessaoCortinaInvalida(true);
        setErroCortina("Sessão expirada. Entre novamente.");
      } else if (status === 403) {
        setErroCortina(error.response?.data?.codigo === "LIMITE_TEMPO_ATINGIDO" ? "Seu tempo de jogo terminou por hoje." : "Você não pode responder agora. Peça ajuda a um responsável.");
      } else if (status === 409) {
        setErroCortina("A sessão da partida terminou ou não está disponível. Volte para Jogos Salvos.");
      } else {
        setErroCortina(envio.enviado
          ? contexto.pratica
            ? "Não foi possível confirmar esta prática. Ela pode ter sido registrada. Não envie de novo. Peça ajuda a um responsável."
            : "Não foi possível confirmar sua resposta. Ela pode ter sido registrada. Não envie de novo. Peça ajuda a um responsável."
          : "Não foi possível verificar sua resposta. Peça ajuda a um responsável.");
      }
    } finally {
      if (atual() && !envio.confirmada) {
        setEnviandoCortina(false);
        if (!envio.enviado) envioCortinaRef.current = null;
      }
    }
  };

  const handleEscolherOpcaoGuardaRoupa = async (respostaEscolhidaId, rodada) => {
    if (!praticaPermite(TAREFA_ROUPA_ID)) return;
    const contexto = contextoRoupaRef.current;
    const chaveEnvio = contexto?.pratica ? chavePraticaRoupa : chaveRoupa;
    if (!contexto?.ativo || contexto.rodada !== rodada || contexto.chave !== chaveEstrelas ||
      !camaArrumada || !janelaAberta || !contextoValido || carregandoRoupa || erroRoupa || (guardaRoupaOrganizado && !contexto.pratica) ||
      !respostasRoupa.some((resposta) => resposta._id === respostaEscolhidaId) ||
      (envioRoupaRef.current?.chave === chaveEnvio && (envioRoupaRef.current.pendente || envioRoupaRef.current.confirmada))) return;

    const envio = { chave: chaveEnvio, contexto, controller: new AbortController(), pendente: true, enviado: false, confirmada: false };
    envioRoupaRef.current = envio;
    setEnviandoRoupa(true);
    const atual = () => contexto.ativo && (!contexto.pratica || contexto.praticaRodada === rodadaPraticaRef.current) && !envio.controller.signal.aborted && envioRoupaRef.current === envio;

    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const { data: progresso } = await api.get(`/jogos-salvos/${jogoSalvoId}/progresso`, {
        signal: envio.controller.signal, timeout: 10_000,
      });
      if (!atual()) return;
      const concluida = roupaConcluida(progresso, jogoSalvoId, dificuldade);
      if (contexto.pratica && !concluida) throw new Error("Conclusão da roupa não confirmada.");
      if (concluida && !contexto.pratica) {
        setGuardaRoupaOrganizado(true);
        if (conquistaRoupaRef.current !== chaveConquistaRoupa) {
          conquistaRoupaRef.current = chaveConquistaRoupa;
          setConquistas((total) => total + 1);
        }
        setErroRoupa("Você já concluiu esta tarefa neste nível. Nenhuma resposta nova foi enviada.");
        return;
      }
      if (!praticaPermite(TAREFA_ROUPA_ID)) return;
      if (sessionStorage.getItem(chaveRoupa) || sessionStorage.getItem(chavePraticaRoupa)) {
        setErroRoupa("Sua resposta anterior não foi confirmada. Não envie de novo. Peça ajuda a um responsável.");
        return;
      }

      // Persiste apenas a incerteza, sem JWT, para impedir reenvio ao reabrir/recarregar a aba.
      sessionStorage.setItem(chaveEnvio, "pendente");
      envio.enviado = true;
      invalidarEstrelas("carregando");
      const { status, data } = await api.post("/historico-jogo/responder", {
        perfilJogoId, jogoSalvoId, tarefaId: TAREFA_ROUPA_ID,
        respostaEscolhidaId, dificuldade, sessaoId,
      }, { signal: envio.controller.signal, timeout: 10_000 });
      if (!atual()) return;
      if (status !== 201 || typeof data?.acertou !== "boolean" ||
        data.dificuldade !== dificuldade || !Number.isInteger(data.tentativa) || data.tentativa < 1 ||
        !Number.isFinite(data.pontuacaoGanha) || data.pontuacaoGanha < 0) {
        throw new Error("Resultado da tentativa não confirmado.");
      }
      atualizarEstrelas();
      sessionStorage.removeItem(chaveEnvio);
      if (!data.acertou) {
        envio.pendente = false;
        envioRoupaRef.current = null;
        setFeedback("Quase lá! Tente novamente!");
        setTipoFeedback("erro");
        setEnviandoRoupa(false);
        return;
      }

      envio.confirmada = true;
      setFeedback(`Muito bem! Você acertou! Você ganhou ${data.pontuacaoGanha} ${data.pontuacaoGanha === 1 ? "estrela" : "estrelas"}!`);
      setTipoFeedback("sucesso");
      tocarAudio("/audio/parabens.mp3");
      dispararFestaNativa();

      if (contexto.pratica) {
        // Mantém a trava por 1,5 s mesmo se o modal for fechado na animação.
        contexto.praticaRodada.animando = true;
        timerPraticaRoupaRef.current = setTimeout(() => {
          const rodadaAtual = contexto.praticaRodada;
          if (rodadaPraticaRef.current !== rodadaAtual || rodadaAtual.chave !== chaveEstrelas) return;
          rodadaAtual.animando = false;
          rodadaAtual.indice += 1;
          if (rodadaAtual.indice === rodadaAtual.sequencia.length) {
            rodadaAtual.status = "concluida";
            setModalAtivo(null);
            setModalFimDeFase("pratica");
          }
          envio.pendente = false;
          if (envioRoupaRef.current === envio) setEnviandoRoupa(false);
          timerPraticaRoupaRef.current = null;
        }, 1500);
      }
      
      contexto.timerRoupa = setTimeout(() => {
        if (!atual()) return;
        setGuardaRoupaOrganizado(true);
        if (!contexto.pratica && conquistaRoupaRef.current !== chaveConquistaRoupa) {
          conquistaRoupaRef.current = chaveConquistaRoupa;
          setConquistas((total) => total + 1);
        }
        setEnviandoRoupa(false);
        setModalAtivo(null);
        if (!contexto.pratica && conquistas + 1 >= 3) {
          fimRoupaRef.current = setTimeout(() => {
            setModalFimDeFase(true);
            tocarAudio("/audio/parabens.mp3");
          }, 1000);
        }
      }, 1500);
    } catch (error) {
      if (!atual()) return;
      const status = error.response?.status;
      if (envio.enviado) invalidarEstrelas("indisponivel");
      if ([400, 401, 403, 404, 409].includes(status)) {
        sessionStorage.removeItem(chaveEnvio);
        envio.enviado = false;
      }
      if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setSessaoRoupaInvalida(true);
        setErroRoupa("Sessão expirada. Entre novamente.");
      } else if (status === 403) {
        setErroRoupa(error.response?.data?.codigo === "LIMITE_TEMPO_ATINGIDO" ? "Seu tempo de jogo terminou por hoje." : "Você não pode responder agora. Peça ajuda a um responsável.");
      } else if (status === 409) {
        setErroRoupa("A sessão da partida terminou ou não está disponível. Volte para Jogos Salvos.");
      } else {
        setErroRoupa(envio.enviado
          ? contexto.pratica
            ? "Não foi possível confirmar esta prática. Ela pode ter sido registrada. Não envie de novo. Peça ajuda a um responsável."
            : "Não foi possível confirmar sua resposta. Ela pode ter sido registrada. Não envie de novo. Peça ajuda a um responsável."
          : "Não foi possível verificar sua resposta. Peça ajuda a um responsável.");
      }
    } finally {
      if (atual() && !envio.confirmada) {
        setEnviandoRoupa(false);
        if (!envio.enviado) envioRoupaRef.current = null;
      }
    }
  };

  const praticarNovamente = async () => {
    if (contextoEstrelasRef.current?.chave !== chaveEstrelas || rodadaPraticaRef.current?.animando || !contextoValido || !camaArrumada || avancandoDificuldade || avancoIncerto || enviandoCama || enviandoCortina || enviandoRoupa || modalAtivo !== null || rodadaPraticaRef.current?.status === "carregando") return;
    rodadaPraticaRef.current?.controller.abort();
    const rodada = { chave: chaveEstrelas, controller: new AbortController(), status: "carregando", indice: 0, animando: false };
    rodadaPraticaRef.current = rodada;
    setEstadoPratica({ status: "carregando", mensagem: "Preparando a prática..." });
    const atual = () => rodadaPraticaRef.current === rodada && !rodada.controller.signal.aborted;
    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const config = { signal: rodada.controller.signal, timeout: 10_000 };
      const { data: cama } = await api.get(`/tarefas/${TAREFA_CAMA_ID}`, config);
      if (!atual()) return;
      const comodoId = typeof cama?.comodoId === "string" ? cama.comodoId : cama?.comodoId?._id;
      if (cama?._id !== TAREFA_CAMA_ID || typeof comodoId !== "string" || !/^[a-f0-9]{24}$/i.test(comodoId)) throw new Error("Catálogo inválido.");
      const { data: catalogo } = await api.get(`/comodos/${comodoId}/tarefas`, config);
      if (!atual()) return;
      if (!Array.isArray(catalogo) || catalogo.some(tarefa =>
        typeof tarefa?._id !== "string" || !/^[a-f0-9]{24}$/i.test(tarefa._id) ||
        (typeof tarefa.comodoId === "string" ? tarefa.comodoId : tarefa.comodoId?._id) !== comodoId ||
        typeof tarefa.ativo !== "boolean" || !Number.isFinite(tarefa.ordem))) throw new Error("Catálogo inválido.");
      const ativas = catalogo.filter(tarefa => tarefa.ativo).sort((a, b) => a.ordem - b.ordem);
      if (!ativas.length || new Set(ativas.map(tarefa => tarefa._id)).size !== ativas.length ||
        new Set(ativas.map(tarefa => tarefa.ordem)).size !== ativas.length ||
        ativas.some(tarefa => ![TAREFA_CAMA_ID, TAREFA_CORTINA_ID, TAREFA_ROUPA_ID].includes(tarefa._id))) throw new Error("Catálogo indisponível nesta interface.");
      rodada.sequencia = ativas.map(tarefa => tarefa._id);
      rodada.status = "ativa";
      if (envioCamaRef.current?.chave === chaveCama && envioCamaRef.current.confirmada) {
        envioCamaRef.current = null;
      }
      if (envioCortinaRef.current?.chave === chaveCortina && envioCortinaRef.current.confirmada) {
        envioCortinaRef.current = null;
      }
      if (envioRoupaRef.current?.chave === chaveRoupa && envioRoupaRef.current.confirmada) {
        envioRoupaRef.current = null;
      }
      setPraticaTarefas(chaveEstrelas);
      setModalFimDeFase(false);
      setEstadoPratica({ status: "pronta", mensagem: "" });
    } catch (error) {
      if (!atual()) return;
      rodada.status = "erro";
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
      }
      setEstadoPratica({ status: "erro", mensagem: error.response?.status === 401
        ? "Sessão expirada. Entre novamente para praticar."
        : "A prática está indisponível. Não foi possível confirmar as tarefas disponíveis. Peça ajuda a um responsável." });
    }
  };

  return (
    <main className={styles.cenarioContainer}>
      {modalAtivo === "orientacao" && (
        <dialog ref={orientacaoRef} className={styles.modalOrientacao}
          aria-labelledby="orientacao-quarto-titulo" aria-describedby="orientacao-quarto-descricao"
          onCancel={() => setModalAtivo(null)}>
          <h2 id="orientacao-quarto-titulo">Ordem errada!</h2>
          <p id="orientacao-quarto-descricao">Tente novamente!</p>
          <button type="button" className={styles.botaoSairPartidaDialogo} onClick={() => setModalAtivo(null)}>Entendi</button>
        </dialog>
      )}
      {erroRestauracaoCama && (
        <div role="alert" style={{ position: "fixed", bottom: 16, left: 16, zIndex: 1500, maxWidth: 360, padding: 12, background: "white", color: "#0f172a" }}>
          {erroRestauracaoCama}
          {erroRestauracaoCama.startsWith("Sessão") && <> <Link href="/">Ir para o login</Link></>}
        </div>
      )}
      {particulasFesta.map((p) => (
        <span key={p.id} className={styles.particulaFesta} style={p.style}>{p.simbolo}</span>
      ))}

      {/* Badge de Conquista e Fase */}
      <div className={styles.badgeConquista}>
        <span className={styles.textoConquista}>{nomeDificuldade}</span>
        <span>Tarefas {conquistas}/3</span>
        <span className={styles.estrelasAcumuladas} role="status">
          ⭐ Estrelas: {pontuacaoAtual?.status === "pronta" ? pontuacaoAtual.total
            : !pontuacaoAtual || pontuacaoAtual.status === "carregando" ? "Carregando..." : "Indisponível"}
        </span>
        {praticandoTarefas && conquistas === 3 && !modalAtivo && !modalFimDeFase && (
          <button type="button" className={styles.botaoCardSair}
            disabled={avancandoDificuldade || avancoIncerto}
            onClick={() => setModalFimDeFase(true)}>
            Ver conclusão do nível
          </button>
        )}
      </div>

      {/* PALCO PRINCIPAL DO JOGO (16:9) */}
      <div className={styles.palcoJogo}>
        <img src="/images/quarto/fundoQuarto.png" alt="Fundo Quarto" className={styles.camadaFundo} />

        {/* JANELA + ESTRELA 2 */}
        <img 
          src={janelaAberta ? "/images/quarto/janelaAberta.png" : "/images/quarto/janela.png"} 
          alt="Janela" 
          className={`${styles.elementoJanela} ${camaArrumada && !janelaAberta ? styles.pulsando : ""}`} 
          onClick={handleClicarJanela} 
        />
        {!janelaAberta && (dificuldade === "facil" || dificuldade === "medio") && (
          <div className={styles.containerEstrelaJanela}>
            <img src="/images/quarto/estrela.png" alt="Estrela" className={styles.imagemEstrelaIcone} />
            {dificuldade === "facil" && <span className={styles.numeroEstrelaTexto}>2</span>}
          </div>
        )}

        <img src="/images/quarto/criado-mudo.png" alt="Criado Mudo" className={styles.elementoCriadoMudo} />

        {/* CAMA + ESTRELA 1 (Garantida com clique direto) */}
        <img
          src={camaArrumada ? "/images/quarto/camaArrumada.png" : "/images/quarto/cama1.png"}
          alt="Cama"
          className={`${styles.elementoCama} ${!camaArrumada ? styles.pulsando : ""}`}
          onClick={handleClicarCama}
        />
        {!camaArrumada && (dificuldade === "facil" || dificuldade === "medio") && (
          <div className={styles.containerEstrelaCama}>
            <img src="/images/quarto/estrela.png" alt="Estrela" className={styles.imagemEstrelaIcone} />
            {dificuldade === "facil" && <span className={styles.numeroEstrelaTexto}>1</span>}
          </div>
        )}

        {/* GUARDA-ROUPA + ESTRELA 3 */}
        <img 
          src={guardaRoupaOrganizado ? "/images/quarto/guardaRoupaOrganizado.png" : "/images/quarto/guardaroupa.png"} 
          alt="Guarda Roupa" 
          className={`${styles.elementoGuardaRoupa} ${camaArrumada && janelaAberta && !guardaRoupaOrganizado ? styles.pulsando : ""}`} 
          onClick={handleClicarGuardaRoupa} 
        />
        {!guardaRoupaOrganizado && (dificuldade === "facil" || dificuldade === "medio") && (
          <div className={styles.containerEstrelaGuardaRoupa}>
            <img src="/images/quarto/estrela.png" alt="Estrela" className={styles.imagemEstrelaIcone} />
            {dificuldade === "facil" && <span className={styles.numeroEstrelaTexto}>3</span>}
          </div>
        )}

        <img src="/images/quarto/planta.png" alt="Planta" className={styles.elementoPlanta} />

        {/* PERSONAGEM */}
        <div
          className={`${styles.personagemMovivel} ${avatarEstatico ? styles.personagemAvatar : isAndando ? styles.personagemAndando : ''}`}
          style={{
            left: `${posicaoPersonagem.x}%`,
            bottom: `${posicaoPersonagem.y}%`,
          }}
        >
          {avatarEstatico && <img src={avatarEstatico} alt={`Personagem ${personagemDaPartida.nomeAvatar || "da jornada"}`} />}
        </div>
      </div>

      {/* ================= MODAL FIM DE FASE (CARDZINHO) ================= */}
      {modalFimDeFase && (
        <div className={styles.modalOverlayFim}>
          <div className={styles.cardContainerFim}>
            <h2 className={styles.tituloCardFim}>
              {mostrandoFimPratica ? "Rodada de prática concluída!" : dificuldade === "dificil" ? "Quarto concluído!" : `Nível ${nomeDificuldade} concluído!`}
            </h2>
            <p className={styles.textoCardFim}>
              {mostrandoFimPratica ? `Parabéns! Você concluiu uma rodada de prática no nível ${nomeDificuldade}!`
                : dificuldade === "dificil" ? "Parabéns! Você concluiu o Quarto!"
                : `Parabéns! Você concluiu o nível ${nomeDificuldade}!`}
            </p>
            
            <div className={styles.botoesCardColuna}>
              {!mostrandoFimPratica && ((dificuldade === "facil" || dificuldade === "medio") ? <button
                type="button"
                disabled={!onAvancarDificuldade || avancandoDificuldade || avancoIncerto}
                onClick={onAvancarDificuldade}
                className={styles.botaoCardContinuar}
              >
                {avancandoDificuldade ? "Conferindo avanço..." : dificuldade === "facil" ? "Continuar (Médio)" : "Continuar (Difícil)"}
              </button> : dificuldade === "dificil" && <>
                <button type="button" disabled
                  className={`${styles.botaoCardSair} ${styles.botaoCardIndisponivel}`}
                  aria-describedby="banheiro-em-desenvolvimento">
                  Ir para o Banheiro
                </button>
                <small id="banheiro-em-desenvolvimento" className={styles.legendaEmDesenvolvimento}>
                  Em desenvolvimento
                </small>
              </>)}

              {!mostrandoFimPratica && erroAvanco && <p role="alert">{erroAvanco}</p>}
              {!mostrandoFimPratica && avancoIncerto && <button type="button" onClick={onConferirDificuldade} disabled={avancandoDificuldade}>
                Conferir dificuldade da partida
              </button>}

              {estadoPratica.mensagem && <p role={estadoPratica.status === "erro" ? "alert" : "status"}>{estadoPratica.mensagem}</p>}
              <button
                disabled={avancandoDificuldade || avancoIncerto || estadoPratica.status === "carregando"}
                onClick={praticarNovamente}
                className={styles.botaoCardTentarDeNovo}
              >
                Praticar novamente
              </button>

              <button 
                disabled={mostrandoFimPratica ? !onSairDoJogo : dificuldade === "dificil" ? !onSairDoJogo : !onSairDoJogo && (avancandoDificuldade || avancoIncerto)}
                onClick={mostrandoFimPratica ? () => onSairDoJogo?.() : dificuldade === "dificil" ? () => onSairDoJogo?.("/menu") : onSairDoJogo ?? praticarNovamente}
                className={styles.botaoCardSair}
              >
                {!mostrandoFimPratica && dificuldade === "dificil" ? "Voltar ao Painel" : "Sair da partida"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAIS DE PERGUNTAS ================= */}
      {modalAtivo === "cama" && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContainerImagem} ${styles.modalCama}`}>

            <button
              onClick={() => setModalAtivo(null)}
              className={styles.botaoFecharModalImg}
              type="button"
              aria-label="Fechar pergunta"
            >
              <X size={24} aria-hidden="true" />
            </button>

            <button
              onClick={() => tocarAudio("/audio/pergunta-cama.mp3")}
              className={styles.botaoAudioModal}
              title="Ouvir pergunta"
              aria-label="Ouvir pergunta"
              type="button"
            >
              <Volume2 size={24} aria-hidden="true" />
            </button>

            <h2 className={styles.tituloPerguntaCama}>
              {tarefaCama?.enunciado}
            </h2>

            {feedback && (
              <div
                className={`${styles.caixaFeedback} ${
                  tipoFeedback === "sucesso"
                    ? styles.sucesso
                    : styles.erro
                }`}
              >
                {feedback}
              </div>
            )}

            {carregandoCama ? (
              <p role="status">Carregando pergunta e alternativas...</p>
            ) : erroCama ? (
              <div role="alert">
                <p>{erroCama}</p>
                {sessaoCamaInvalida ? (
                  <Link href="/">Entrar novamente</Link>
                ) : (
                  <p>Feche esta pergunta para voltar ao Quarto.</p>
                )}
              </div>
            ) : tarefaCama && (
              <div className={styles.gradeRespostasCama}>
                {respostasCama.map((resposta) => (
                  <RespostaCard
                    key={resposta._id}
                    texto={resposta.texto}
                    imagem={resposta.imagem}
                    audio={resposta.audio}
                    disabled={enviandoCama}
                    onSelecionar={() => handleEscolherOpcaoCama(resposta._id, rodadaCama)}
                  />
                ))}
              </div>
            )}
            {enviandoCama && !erroCama && <p role="status">Registrando resposta...</p>}

          </div>
        </div>
      )}

      {modalAtivo === "janela" && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContainerImagem} ${styles.modalCama}`}>

            <button
              onClick={() => setModalAtivo(null)}
              className={styles.botaoFecharModalImg}
              type="button"
              aria-label="Fechar pergunta"
            >
              <X size={24} aria-hidden="true" />
            </button>

            <button
              onClick={() => tocarAudio("/audio/pergunta-janela.mp3")}
              className={styles.botaoAudioModal}
              title="Ouvir pergunta"
              aria-label="Ouvir pergunta"
              type="button"
            >
              <Volume2 size={24} aria-hidden="true" />
            </button>

            <h2 className={styles.tituloPerguntaCama}>
              {tarefaCortina?.enunciado}
            </h2>

            {feedback && (
              <div
                className={`${styles.caixaFeedback} ${
                  tipoFeedback === "sucesso"
                    ? styles.sucesso
                    : styles.erro
                }`}
              >
                {feedback}
              </div>
            )}

            {carregandoCortina ? (
              <p role="status">Carregando pergunta e alternativas...</p>
            ) : erroCortina ? (
              <div role="alert">
                <p>{erroCortina}</p>
                {sessaoCortinaInvalida ? (
                  <Link href="/">Entrar novamente</Link>
                ) : (
                  <p>Feche esta pergunta para voltar ao Quarto.</p>
                )}
              </div>
            ) : tarefaCortina && (
              <div className={styles.gradeRespostasCama}>
                {respostasCortina.map((resposta) => (
                  <RespostaCard
                    key={resposta._id}
                    texto={resposta.texto}
                    imagem={resposta.imagem}
                    audio={resposta.audio}
                    disabled={enviandoCortina}
                    onSelecionar={() => handleEscolherOpcaoJanela(resposta._id, rodadaCortina)}
                  />
                ))}
              </div>
            )}
            {enviandoCortina && !erroCortina && <p role="status">Registrando resposta...</p>}

          </div>
        </div>
      )}

      {modalAtivo === "guardaRoupa" && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContainerImagem} ${styles.modalCama}`}>

            <button
              onClick={() => setModalAtivo(null)}
              className={styles.botaoFecharModalImg}
              type="button"
              aria-label="Fechar pergunta"
            >
              <X size={24} aria-hidden="true" />
            </button>

            <button
              onClick={() => tocarAudio("/audio/pergunta-guardaroupa.mp3")}
              className={styles.botaoAudioModal}
              title="Ouvir pergunta"
              aria-label="Ouvir pergunta"
              type="button"
            >
              <Volume2 size={24} aria-hidden="true" />
            </button>

            <h2 className={styles.tituloPerguntaCama}>
              {tarefaRoupa?.enunciado}
            </h2>

            {feedback && (
              <div
                className={`${styles.caixaFeedback} ${
                  tipoFeedback === "sucesso"
                    ? styles.sucesso
                    : styles.erro
                }`}
              >
                {feedback}
              </div>
            )}

            {carregandoRoupa ? (
              <p role="status">Carregando pergunta e alternativas...</p>
            ) : erroRoupa ? (
              <div role="alert">
                <p>{erroRoupa}</p>
                {sessaoRoupaInvalida ? (
                  <Link href="/">Entrar novamente</Link>
                ) : (
                  <p>Feche esta pergunta para voltar ao Quarto.</p>
                )}
              </div>
            ) : tarefaRoupa && (
              <div className={styles.gradeRespostasCama}>
                {respostasRoupa.map((resposta) => (
                  <RespostaCard
                    key={resposta._id}
                    texto={resposta.texto}
                    imagem={resposta.imagem}
                    audio={resposta.audio}
                    disabled={enviandoRoupa}
                    onSelecionar={() => handleEscolherOpcaoGuardaRoupa(resposta._id, rodadaRoupa)}
                  />
                ))}
              </div>
            )}
            {enviandoRoupa && !erroRoupa && <p role="status">Registrando resposta...</p>}

          </div>
        </div>
      )}

    </main>
  );
}
