import React, { useState } from "react";
import { useRouter } from "next/router";
import styles from "../styles/EscolherPersonagem.module.css";

export default function EscolherPersonagem() {
  const router = useRouter();

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
    setGenero(novoGenero);
    setPersonagemSelecionado(personagens[novoGenero][0].id);
  };

  const handleComecar = () => {
    console.log("Personagem escolhido:", personagemSelecionado);
    router.push("/menu");
  };

  return (
    <main className={styles.pagina}>
      {/* Seta de voltar no canto superior esquerdo */}
      <button
        type="button"
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

      {/* Seletor de Género (MASC / FEM) */}
      <div className={styles.seletorGenero}>
        <button
          type="button"
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
              onClick={() => setPersonagemSelecionado(p.id)}
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