import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import api from "../services/api";
import styles from "../styles/EscolherPersonagem.module.css";

export default function EscolherPersonagem() {
  const router = useRouter();
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState("");
  const [incerto, setIncerto] = useState(false);
  const [partidaCriada, setPartidaCriada] = useState(null);
  const travaRef = useRef(false);
  const montadoRef = useRef(false);
  const requisicaoRef = useRef(null);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      requisicaoRef.current?.abort();
    };
  }, []);

  // Estado para o género selecionado: 'masc' ou 'fem'
  const [genero, setGenero] = useState("masc");

  // Estado para o personagem selecionado (id)
  const [personagemSelecionado, setPersonagemSelecionado] = useState("m1");

  // Lista de personagens masculinos e femininos
  const personagens = {
    masc: [
      {
        id: "m1",
        nome: "Personagem 1",
        imagem: "/images/boneco.png",
        iconeHead: "/images/avatar.png",
      },
      {
        id: "m2",
        nome: "Personagem 2",
        imagem: "/images/boneco2.png", // Nome fictício para o 2º personagem masc
        iconeHead: "/images/boneco2.png",
      },
    ],
    fem: [
      {
        id: "f1",
        nome: "Personagem 1",
        imagem: "/images/menina1.png", // Nome fictício para o 1º personagem fem
        iconeHead: "/images/menina1.png",
      },
      {
        id: "f2",
        nome: "Personagem 2",
        imagem: "/images/menina2.png", // Nome fictício para o 2º personagem fem
        iconeHead: "/images/menina2.png",
      },
    ],
  };

  // Alterna o género e auto-seleciona o primeiro personagem da categoria
  const handleTrocarGenero = (novoGenero) => {
    if (travaRef.current) return;
    setGenero(novoGenero);
    setPersonagemSelecionado(personagens[novoGenero][0].id);
  };

  const handleComecar = async () => {
    if (travaRef.current) return;
    travaRef.current = true;
    const controller = new AbortController();
    requisicaoRef.current = controller;
    const ativo = () => montadoRef.current && !controller.signal.aborted && requisicaoRef.current === controller;
    const idValido = (id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id);
    let postSemConfirmacao = false;
    let novaPartida = null;
    setCriando(true);
    setErro("");
    setIncerto(false);

    try {
      if (!localStorage.getItem("token")?.trim()) throw { response: { status: 401 } };
      const escolhido = personagens[genero].find((p) => p.id === personagemSelecionado);
      if (!escolhido) throw new Error("Selecione um personagem.");

      const config = { signal: controller.signal, timeout: 10_000 };
      const { data: perfis } = await api.get("/perfis-jogo", config);
      if (!ativo()) return;
      if (!Array.isArray(perfis)) throw new Error("Lista de personagens inválida.");
      let perfil = perfis.find((p) => p.imagemAvatar === escolhido.imagem);
      if (!perfil) {
        postSemConfirmacao = true;
        const resposta = await api.post("/perfis-jogo", {
          nomeAvatar: escolhido.nome,
          imagemAvatar: escolhido.imagem,
        }, config);
        if (!ativo()) return;
        if (resposta.status !== 201 || !idValido(resposta.data?._id)) throw new Error("Criação do personagem não confirmada.");
        perfil = resposta.data;
        postSemConfirmacao = false;
      }
      if (!idValido(perfil._id)) throw new Error("Identificador de personagem inválido.");

      postSemConfirmacao = true;
      const resposta = await api.post("/jogos-salvos", {
        perfilJogoId: perfil._id,
        nomeJogo: `Jogo de ${escolhido.nome}`,
      }, config);
      if (!ativo()) return;
      const perfilRetornado = typeof resposta.data?.perfilJogoId === "string"
        ? resposta.data.perfilJogoId : resposta.data?.perfilJogoId?._id;
      if (resposta.status !== 201 || !idValido(resposta.data?._id) || perfilRetornado !== perfil._id) {
        throw new Error("Criação da partida não confirmada.");
      }
      postSemConfirmacao = false;
      novaPartida = resposta.data._id;
      setPartidaCriada(novaPartida);
      const navegou = await router.push({ pathname: "/jogo/quarto", query: { jogoSalvoId: novaPartida } });
      if (navegou === false) throw new Error("Navegação cancelada.");
    } catch (error) {
      if (!ativo()) return;
      const status = error.response?.status;
      if (novaPartida) {
        setErro("A partida foi criada. Use o link abaixo para abri-la.");
      } else if (status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setErro("Sessão expirada. Entre novamente.");
        router.replace("/");
        travaRef.current = false;
      } else if (postSemConfirmacao && (!status || status >= 500)) {
        setIncerto(true);
        setErro("Não foi possível confirmar a criação. O registro pode ter sido salvo; confira seus jogos salvos antes de tentar novamente.");
      } else {
        travaRef.current = false;
        setErro(status === 403 ? "Você não tem permissão para criar esta partida."
          : status === 409 ? (error.response?.data?.mensagem || "Não foi possível criar a partida. Confira seus jogos salvos.")
            : status === 404 ? "Cadastro da criança ou personagem não encontrado. Verifique sua conta."
              : "Não foi possível criar o jogo. Tente novamente.");
      }
    } finally {
      if (ativo()) setCriando(false);
    }
  };
  const bloqueado = criando || incerto || Boolean(partidaCriada);

  return (
    <main className={styles.pagina}>
      {/* Seta de voltar no canto superior esquerdo */}
      <button
        type="button"
        disabled={criando}
        onClick={() => router.push("/menu")}
        className={styles.botaoVoltar}
        aria-label="Voltar"
      >
        <img
          src="/images/seta.png"
          alt=""
          className={styles.iconeVoltar}
        />
      </button>

      {/* Logo no canto superior direito */}
      <div className={styles.conteudoAzul}>
        <img
          src="/images/logo.png"
          alt="Logo ConectaMente"
          className={styles.logo}
        />
      </div>

      {/* Cabeçalho do Título (imagem) */}
      <header className={styles.cabecalho}>
        <h1 className={styles.titulo}>
          <img
            src="/images/escolher.png"
            alt="Escolha seu Personagem"
            className={styles.imgTitulo}
          />
        </h1>
      </header>

      {erro && (
        <div role="alert" style={{ background: "white", color: "#9b1c1c", padding: 12, borderRadius: 12 }}>
          <p>{erro}</p>
          {partidaCriada ? (
            <Link href={{ pathname: "/jogo/quarto", query: { jogoSalvoId: partidaCriada } }}>Abrir partida criada</Link>
          ) : (
            <Link href="/jogos-salvos">Ver jogos salvos</Link>
          )}
        </div>
      )}
      {criando && <p role="status">Preparando seu personagem e criando a partida...</p>}

      {/* Seletor de Género (MASC / FEM) */}
      <div className={styles.seletorGenero}>
        <button
          type="button"
          disabled={bloqueado}
          className={`${styles.opcaoGenero} ${
            genero === "masc" ? styles.ativo : ""
          }`}
          onClick={() => handleTrocarGenero("masc")}
        >
          <span>MASC.</span>
          <div
            className={`${styles.bolinha} ${
              genero === "masc" ? styles.bolinhaVermelha : styles.bolinhaBranca
            }`}
          />
        </button>

        <button
          type="button"
          disabled={bloqueado}
          className={`${styles.opcaoGenero} ${
            genero === "fem" ? styles.ativo : ""
          }`}
          onClick={() => handleTrocarGenero("fem")}
        >
          <span>FEM.</span>
          <div
            className={`${styles.bolinha} ${
              genero === "fem" ? styles.bolinhaVermelha : styles.bolinhaBranca
            }`}
          />
        </button>
      </div>

      {/* Grid de Cards de Personagens */}
      <section className={styles.containerCards}>
        {personagens[genero].map((p) => {
          const isSelected = personagemSelecionado === p.id;

          return (
            <div
              key={p.id}
              className={`${styles.cardPersonagem} ${
                isSelected ? styles.cardSelecionado : ""
              }`}
              onClick={() => { if (!travaRef.current) setPersonagemSelecionado(p.id); }}
              aria-disabled={bloqueado}
            >
              <div className={styles.palco}>
                <img
                  src={p.imagem}
                  alt={p.nome}
                  className={styles.imgPersonagem}
                />
                <div className={styles.pedestal} />
              </div>

              {isSelected && (
                <div className={styles.tagSelecionado}>
                  <img
                    src={p.iconeHead}
                    alt=""
                    className={styles.miniIconeHead}
                  />
                  <span>{p.nome}</span>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Botão COMEÇAR (imagem) */}
      <button
        type="button"
        className={styles.botaoComecar}
        disabled={bloqueado}
        onClick={handleComecar}
        aria-label="Começar"
      >
        <img
          src="/images/botao.png"
          alt="Começar"
          className={styles.imgComecar}
        />
      </button>
    </main>
  );
}
