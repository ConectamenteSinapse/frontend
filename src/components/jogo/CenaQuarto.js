import { useState, useEffect } from "react";
import styles from "../../styles/Quarto.module.css";

export default function CenaQuarto() {
  const [conquistas, setConquistas] = useState(0);
  const [fase, setFase] = useState(1);
  
  const [camaArrumada, setCamaArrumada] = useState(false);
  const [janelaAberta, setJanelaAberta] = useState(false);
  const [guardaRoupaOrganizado, setGuardaRoupaOrganizado] = useState(false);
  
  const [modalAtivo, setModalAtivo] = useState(null); 
  const [modalFimDeFase, setModalFimDeFase] = useState(false);
  
  const [feedback, setFeedback] = useState("");
  const [tipoFeedback, setTipoFeedback] = useState("");
  const [particulasFesta, setParticulasFesta] = useState([]);

  // Posição e movimento do personagem
  const [posicaoPersonagem, setPosicaoPersonagem] = useState({ x: 44, y: 10 });
  const [isAndando, setIsAndando] = useState(false);

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

        if (evento.key === "ArrowRight" || evento.key === "d") novoX = Math.min(novoX + passo, 75);
        else if (evento.key === "ArrowLeft" || evento.key === "a") novoX = Math.max(novoX - passo, 5);
        else if (evento.key === "ArrowUp" || evento.key === "w") novoY = Math.min(novoY + passo, 25);
        else if (evento.key === "ArrowDown" || evento.key === "s") novoY = Math.max(novoY - passo, 5);

        return { x: novoX, y: novoY };
      });
    };

    window.addEventListener("keydown", lidarComTeclado);
    return () => {
      window.removeEventListener("keydown", lidarComTeclado);
      clearTimeout(timeoutAndar);
    };
  }, [modalAtivo, modalFimDeFase]);

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
  const handleClicarCama = () => {
    // Abre sempre que a cama não estiver arrumada
    if (!camaArrumada) {
      setModalAtivo("cama");
      setFeedback("");
      setTipoFeedback("");
      tocarAudio("/audio/pergunta-cama.mp3");
    }
  };

  const handleClicarJanela = () => {
    if (!camaArrumada) {
      alert("⚠️ Vamos começar pela Tarefa 1 (Cama) primeiro!");
      return;
    }
    if (!janelaAberta) {
      setModalAtivo("janela");
      setFeedback("");
      setTipoFeedback("");
      tocarAudio("/audio/pergunta-janela.mp3");
    }
  };

  const handleClicarGuardaRoupa = () => {
    if (!camaArrumada || !janelaAberta) {
      alert("⚠️ Segue a sequência! Conclui a Cama e a Janela antes do Guarda-Roupa.");
      return;
    }
    if (!guardaRoupaOrganizado) {
      setModalAtivo("guardaRoupa");
      setFeedback("");
      setTipoFeedback("");
      tocarAudio("/audio/pergunta-guardaroupa.mp3");
    }
  };

  const dispararFestaNativa = () => {
    const simbolos = ['⭐', '🌟', '✨', '🎉', '💖'];
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

  const handleEscolherOpcaoCama = (correta) => {
    if (correta) {
      setFeedback("🎉 Acertaste! A cama ficou arrumadinha!");
      setTipoFeedback("sucesso");
      tocarAudio("/audio/parabens.mp3");
      dispararFestaNativa();
      
      setTimeout(() => {
        setCamaArrumada(true);
        const novoTotal = conquistas + 1;
        setConquistas(novoTotal);
        setModalAtivo(null);
        verificarFimDeJogo(novoTotal);
      }, 1500);
    } else {
      setFeedback("Ops! Tenta de novo.");
      setTipoFeedback("erro");
    }
  };

  const handleEscolherOpcaoJanela = (correta) => {
    if (correta) {
      setFeedback("🎉 Acertaste a tarefa da janela!");
      setTipoFeedback("sucesso");
      tocarAudio("/audio/parabens.mp3");
      dispararFestaNativa();
      
      setTimeout(() => {
        setJanelaAberta(true);
        const novoTotal = conquistas + 1;
        setConquistas(novoTotal);
        setModalAtivo(null);
        verificarFimDeJogo(novoTotal);
      }, 1500);
    } else {
      setFeedback("Ops! Tenta de novo.");
      setTipoFeedback("erro");
    }
  };

  const handleEscolherOpcaoGuardaRoupa = (correta) => {
    if (correta) {
      setFeedback("🎉 Organizaste o guarda-roupa!");
      setTipoFeedback("sucesso");
      tocarAudio("/audio/parabens.mp3");
      dispararFestaNativa();
      
      setTimeout(() => {
        setGuardaRoupaOrganizado(true);
        const novoTotal = conquistas + 1;
        setConquistas(novoTotal);
        setModalAtivo(null);
        verificarFimDeJogo(novoTotal);
      }, 1500);
    } else {
      setFeedback("Ops! Tenta de novo.");
      setTipoFeedback("erro");
    }
  };

  const reiniciarFase = () => {
    setCamaArrumada(false);
    setJanelaAberta(false);
    setGuardaRoupaOrganizado(false);
    setConquistas(0);
    setModalFimDeFase(false);
  };

  return (
    <main className={styles.cenarioContainer}>
      {particulasFesta.map((p) => (
        <span key={p.id} className={styles.particulaFesta} style={p.style}>{p.simbolo}</span>
      ))}

      {/* Badge de Conquista e Fase */}
      <div className={styles.badgeConquista}>
        <span className={styles.textoConquista}>Fase {fase}</span>
        <span>⭐ {conquistas}/3</span>
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
        {!janelaAberta && fase === 1 && (
          <div className={styles.containerEstrelaJanela}>
            <img src="/images/quarto/estrela.png" alt="Estrela" className={styles.imagemEstrelaIcone} />
            <span className={styles.numeroEstrelaTexto}>2</span>
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
        {!camaArrumada && fase === 1 && (
          <div className={styles.containerEstrelaCama}>
            <img src="/images/quarto/estrela.png" alt="Estrela" className={styles.imagemEstrelaIcone} />
            <span className={styles.numeroEstrelaTexto}>1</span>
          </div>
        )}

        {/* GUARDA-ROUPA + ESTRELA 3 */}
        <img 
          src={guardaRoupaOrganizado ? "/images/quarto/guardaRoupaOrganizado.png" : "/images/quarto/guardaroupa.png"} 
          alt="Guarda Roupa" 
          className={`${styles.elementoGuardaRoupa} ${camaArrumada && janelaAberta && !guardaRoupaOrganizado ? styles.pulsando : ""}`} 
          onClick={handleClicarGuardaRoupa} 
        />
        {!guardaRoupaOrganizado && fase === 1 && (
          <div className={styles.containerEstrelaGuardaRoupa}>
            <img src="/images/quarto/estrela.png" alt="Estrela" className={styles.imagemEstrelaIcone} />
            <span className={styles.numeroEstrelaTexto}>3</span>
          </div>
        )}

        <img src="/images/quarto/planta.png" alt="Planta" className={styles.elementoPlanta} />

        {/* PERSONAGEM */}
        <div
          className={`${styles.personagemMovivel} ${isAndando ? styles.personagemAndando : ''}`}
          style={{
            left: `${posicaoPersonagem.x}%`,
            bottom: `${posicaoPersonagem.y}%`,
          }}
        />
      </div>

      {/* ================= MODAL FIM DE FASE (CARDZINHO) ================= */}
      {modalFimDeFase && (
        <div className={styles.modalOverlayFim}>
          <div className={styles.cardContainerFim}>
            <div className={styles.iconeCardFim}>🌟🏆</div>
            <h2 className={styles.tituloCardFim}>Nível {fase} Concluído!</h2>
            <p className={styles.textoCardFim}>
              Parabéns! O quarto ficou totalmente organizado seguindo a sequência correta.
            </p>
            
            <div className={styles.botoesCardColuna}>
              <button 
                onClick={() => { setFase(fase + 1); reiniciarFase(); }}
                className={styles.botaoCardContinuar}
              >
                🚀 Continuar (Próximo Nível)
              </button>

              <button 
                onClick={reiniciarFase}
                className={styles.botaoCardTentarDeNovo}
              >
                🔄 Tentar de Novo
              </button>

              <button 
                onClick={() => {
                  setFase(1);
                  reiniciarFase();
                }}
                className={styles.botaoCardSair}
              >
                🚪 Sair do Jogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAIS DE PERGUNTAS ================= */}
      {modalAtivo === "cama" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainerImagem}>
            <button onClick={() => setModalAtivo(null)} className={styles.botaoFecharModalImg}>✕</button>
            <button onClick={() => tocarAudio("/audio/pergunta-cama.mp3")} className={styles.botaoAudioModal} title="Ouvir">🔊</button>
            <img src="/images/quarto/perguntas.png" alt="Modal Cama" className={styles.imagemModalFigma} />
            {feedback && <div className={`${styles.caixaFeedback} ${tipoFeedback === 'sucesso' ? styles.sucesso : styles.erro}`}>{feedback}</div>}
            <div className={styles.gradeCliquesOpcoes}>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoCama(false)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoCama(true)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoCama(false)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoCama(false)}></div>
            </div>
          </div>
        </div>
      )}

      {modalAtivo === "janela" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainerImagem}>
            <button onClick={() => setModalAtivo(null)} className={styles.botaoFecharModalImg}>✕</button>
            <button onClick={() => tocarAudio("/audio/pergunta-janela.mp3")} className={styles.botaoAudioModal} title="Ouvir">🔊</button>
            <img src="/images/quarto/pergunta2.png" alt="Modal Janela" className={styles.imagemModalFigma} />
            {feedback && <div className={`${styles.caixaFeedback} ${tipoFeedback === 'sucesso' ? styles.sucesso : styles.erro}`}>{feedback}</div>}
            <div className={styles.gradeCliquesOpcoes}>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoJanela(true)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoJanela(false)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoJanela(false)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoJanela(false)}></div>
            </div>
          </div>
        </div>
      )}

      {modalAtivo === "guardaRoupa" && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainerImagem}>
            <button onClick={() => setModalAtivo(null)} className={styles.botaoFecharModalImg}>✕</button>
            <button onClick={() => tocarAudio("/audio/pergunta-guardaroupa.mp3")} className={styles.botaoAudioModal} title="Ouvir">🔊</button>
            <img src="/images/quarto/pergunta3.png" alt="Modal Guarda-Roupa" className={styles.imagemModalFigma} />
            {feedback && <div className={`${styles.caixaFeedback} ${tipoFeedback === 'sucesso' ? styles.sucesso : styles.erro}`}>{feedback}</div>}
            <div className={styles.gradeCliquesOpcoes}>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoGuardaRoupa(false)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoGuardaRoupa(false)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoGuardaRoupa(true)}></div>
              <div className={styles.areaOpcao} onClick={() => handleEscolherOpcaoGuardaRoupa(false)}></div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}