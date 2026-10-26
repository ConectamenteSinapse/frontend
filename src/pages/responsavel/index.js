
import Head from "next/head";
import styles from "./PerfilResponsavel.module.css";

export default function PerfilResponsavel() {
  return (
    <>
      <Head>
        <title>Perfil do Responsável | ConectaMente</title>
        <meta
          name="description"
          content="Área do responsável pelo ConectaMente"
        />
      </Head>

      <main className={styles.container}>
        <section className={styles.card}>
          
        <div className={styles.logo}>
        <img
            src="/images/logo.png"
            alt="ConectaMente — Minha Rotina Divertida"
            className={styles.logoImage}
        />
        <span className={styles.subtituloLogo}>
            Minha Rotina Divertida
        </span>
        </div>


          <h1>PERFIL DO RESPONSÁVEL</h1>

          <button
            type="button"
            className={styles.contasButton}
            onClick={() => {
              window.location.href = "/responsavel/contas";
            }}
          >
            Contas Acessíveis
          </button>

          <button
            type="button"
            className={styles.sairButton}
            onClick={() => {
              window.location.href = "/"; // Alterar quando a rota de cadastro for definida
            }}
          >
            SAIR DA CONTA
          </button>
        </section>
      </main>
    </>
  );
}
