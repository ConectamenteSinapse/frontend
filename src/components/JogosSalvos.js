
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Minus } from "lucide-react";
import styles from "../styles/JogosSalvos.module.css";
import api from "../services/api";

export default function JogosSalvos() {
  const router = useRouter();

  const [listaJogos, setListaJogos] = useState([]);
  const [jogoParaExcluir, setJogoParaExcluir] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");

  // Buscar os jogos salvos da criança na API
  useEffect(() => {
    const carregarJogos = async () => {
      try {
        const resposta = await api.get("/jogos-salvos");

        setListaJogos(
          Array.isArray(resposta.data) ? resposta.data : []
        );
      } catch (error) {
        console.error(
          "Erro ao carregar jogos:",
          error.response?.data || error.message
        );

        setErro(
          error.response?.data?.mensagem ||
          "Não foi possível carregar os jogos salvos."
        );
      } finally {
        setCarregando(false);
      }
    };

    carregarJogos();
  }, []);

  const handleAbrirModalExcluir = (e, jogo) => {
    e.stopPropagation();
    setErro("");
    setJogoParaExcluir(jogo);
  };

  // Excluir o jogo no backend
  const handleConfirmarExclusao = async () => {
    if (!jogoParaExcluir || excluindo) return;

    setExcluindo(true);
    setErro("");

    try {
      await api.delete(`/jogos-salvos/${jogoParaExcluir._id}`);

      // Remover da tela somente depois da confirmação da API
      setListaJogos((jogos) =>
        jogos.filter((jogo) => jogo._id !== jogoParaExcluir._id)
      );

      setJogoParaExcluir(null);
    } catch (error) {
      console.error(
        "Erro ao excluir jogo:",
        error.response?.data || error.message
      );

      setErro(
        error.response?.data?.mensagem ||
        "Não foi possível excluir o jogo. Tente novamente."
      );
    } finally {
      setExcluindo(false);
    }
  };

  const handleCancelarExclusao = () => {
    if (!excluindo) {
      setJogoParaExcluir(null);
    }
  };

  const handleSelecionarJogo = (jogo) => {
    console.log("Jogo selecionado:", jogo);

    // A navegação para o jogo será integrada quando a tela
    // de carregamento da partida estiver definida.
    router.push("/menu");
  };

  if (carregando) {
    return <p>Carregando jogos salvos...</p>;
  }

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

        {erro && (
          <p role="alert" className={styles.mensagemVazio}>
            {erro}
          </p>
        )}

        <div className={styles.listaJogos}>
          {listaJogos.length > 0 ? (
            listaJogos.map((jogo) => (
              <div
                key={jogo._id}
                className={styles.cardJogo}
                onClick={() => handleSelecionarJogo(jogo)}
              >
                <div className={styles.avatarContainer}>
                  <img
                    src="/images/avatar.png"
                    alt="Avatar do jogador"
                    className={styles.avatarImg}
                  />
                </div>

                <div className={styles.infoJogo}>
                  <span className={styles.nomeJogador}>
                    {jogo.nomeJogador || "Jogador"}
                  </span>

                  <span className={styles.tituloJogo}>
                    {jogo.nomeJogo || "Jogo salvo"}
                  </span>
                </div>

                <button
                  type="button"
                  className={styles.botaoAcao}
                  onClick={(e) => handleAbrirModalExcluir(e, jogo)}
                  aria-label={`Excluir ${jogo.nomeJogo || "jogo salvo"}`}
                  disabled={excluindo}
                >
                  <Minus size={28} color="#1b4965" strokeWidth={3} />
                </button>
              </div>
            ))
          ) : (
            !erro && (
              <p className={styles.mensagemVazio}>
                Nenhum jogo salvo encontrado.
              </p>
            )
          )}
        </div>
      </div>

      {/* Modal de confirmação */}
      {jogoParaExcluir && (
        <div className={styles.overlayModal}>
          <div
            className={styles.cardModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-exclusao"
          >
            <h2
              id="titulo-modal-exclusao"
              className={styles.tituloModal}
            >
              VOCÊ TEM CERTEZA QUE <br />
              QUER EXCLUIR ESSE JOGO?
            </h2>

            {erro && (
              <p role="alert" className={styles.mensagemVazio}>
                {erro}
              </p>
            )}

            <div className={styles.botoesModal}>
              <button
                type="button"
                className={styles.botaoNao}
                onClick={handleCancelarExclusao}
                disabled={excluindo}
              >
                NÃO
              </button>

              <button
                type="button"
                className={styles.botaoSim}
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
              >
                {excluindo ? "EXCLUINDO..." : "SIM"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
