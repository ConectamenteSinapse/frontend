import React, { useState } from "react";
import { useRouter } from "next/router";
import { Minus } from "lucide-react";
import styles from "../styles/JogosSalvos.module.css";

export default function JogosSalvos() {
  const router = useRouter();

  // Lista de jogos no estado para permitir a exclusão dinâmica
  const [listaJogos, setListaJogos] = useState([
    {
      id: 1,
      nomeJogador: "LORENZO",
      tituloJogo: "JOGO 1",
      avatar: "/images/avatar.png",
    },
    {
      id: 2,
      nomeJogador: "LORENZO",
      tituloJogo: "JOGO 2",
      avatar: "/images/avatar.png",
    },
  ]);

  // Estado para controlar a modal de confirmação
  const [jogoParaExcluir, setJogoParaExcluir] = useState(null);

  const handleAbrirModalExcluir = (e, jogo) => {
    e.stopPropagation(); // Evita acionar o clique de carregar o jogo
    setJogoParaExcluir(jogo);
  };

  const handleConfirmarExclusao = () => {
    if (jogoParaExcluir) {
      setListaJogos(listaJogos.filter((j) => j.id !== jogoParaExcluir.id));
      setJogoParaExcluir(null);
    }
  };

  const handleCancelarExclusao = () => {
    setJogoParaExcluir(null);
  };

  const handleSelecionarJogo = (jogo) => {
    console.log("Jogo carregado:", jogo);
    router.push("/menu");
  };

  return (
    <main className={styles.pagina}>
      {/* Cabeçalho com Seta e Logo */}
      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={() => router.push("/perfil")}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img
            src="/images/seta.png"
            alt="Voltar"
            className={styles.iconeVoltar}
          />
        </button>

        <div className={styles.logoContainer}>
          <img
            src="/images/logo.png"
            alt="Logo ConectaMente"
            className={styles.logo}
          />
        </div>
      </header>

      {/* Painel Branco Central */}
      <div className={styles.painelBranco}>
        <h1 className={styles.titulo}>JOGOS SALVOS</h1>

        <div className={styles.listaJogos}>
          {listaJogos.length > 0 ? (
            listaJogos.map((jogo) => (
              <div
                key={jogo.id}
                className={styles.cardJogo}
                onClick={() => handleSelecionarJogo(jogo)}
              >
                <div className={styles.avatarContainer}>
                  <img
                    src={jogo.avatar}
                    alt={jogo.nomeJogador}
                    className={styles.avatarImg}
                  />
                </div>

                <div className={styles.infoJogo}>
                  <span className={styles.nomeJogador}>{jogo.nomeJogador}</span>
                  <span className={styles.tituloJogo}>{jogo.tituloJogo}</span>
                </div>

                <button
                  type="button"
                  className={styles.botaoAcao}
                  onClick={(e) => handleAbrirModalExcluir(e, jogo)}
                  aria-label="Excluir jogo"
                >
                  <Minus size={28} color="#1b4965" strokeWidth={3} />
                </button>
              </div>
            ))
          ) : (
            <p className={styles.mensagemVazio}>Nenhum jogo salvo encontrado.</p>
          )}
        </div>
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {jogoParaExcluir && (
        <div className={styles.overlayModal}>
          <div className={styles.cardModal}>
            <h2 className={styles.tituloModal}>
              VOCÊ TEM CERTEZA QUE <br />
              QUER EXCLUIR ESSE JOGO ?
            </h2>

            <div className={styles.botoesModal}>
              <button
                type="button"
                className={styles.botaoNao}
                onClick={handleCancelarExclusao}
              >
                NÃO
              </button>

              <button
                type="button"
                className={styles.botaoSim}
                onClick={handleConfirmarExclusao}
              >
                SIM
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}