import React from "react";
import Link from "next/link";
import { Plus, User, RotateCcw, ChevronRight } from "lucide-react";
import styles from "../styles/HomeMenu.module.css";

export default function HomeMenu({ nomeUtilizador = "Lorenzo" }) {
  const opcoesMenu = [
    {
      id: "novo-jogo",
      titulo: "Novo Jogo",
      subtitulo: "Comece uma nova aventura",
      Icone: Plus,
      rota: "/escolher-personagem",
    },
    {
      id: "perfil",
      titulo: "Perfil",
      subtitulo: "Veja seu progresso",
      Icone: User,
      rota: "/perfil",
    },
    {
      id: "carregar-jogo",
      titulo: "Carregar Jogo",
      subtitulo: "Continue de onde parou",
      Icone: RotateCcw,
      rota: "/jogos/continuar",
    },
  ];

  return (
    <main className={styles.container}>
      {/* Cabeçalho com Logo e Avatar */}
      <header className={styles.cabecalho}>
  <div className={styles.logoContainer}>
    <img
      src="/images/logo.png"
      alt="Logo ConectaMente"
      className={styles.logo}
    />
  </div>

  <div className={styles.avatarContainer}>
    <img
      src="/images/avatar.png"
      alt="Avatar do Usuário"
      className={styles.avatar}
    />
  </div>
</header>

      {/* Saudação */}
      <section className={styles.saudacao}>
        <h1>Olá, {nomeUtilizador} 👋</h1>
      </section>

      {/* Lista de Opções do Menu */}
      <section className={styles.menuGrid}>
        {opcoesMenu.map(({ id, titulo, subtitulo, Icone, rota }) => (
          <Link href={rota} key={id} className={styles.cardMenu}>
            <div className={styles.iconeCirculo}>
              <Icone size={28} color="#ffffff" strokeWidth={3} />
            </div>

            <div className={styles.textosCard}>
              <h2>{titulo}</h2>
              <p>{subtitulo}</p>
            </div>

            <div className={styles.setaCirculo}>
              <ChevronRight size={22} color="#0052cc" strokeWidth={3} />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}