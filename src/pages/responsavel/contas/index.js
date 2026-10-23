
import Head from "next/head";
import Link from "next/link";
import styles from "./Contas.module.css";

export default function Contas() {
  const contas = [
    {
      id: 1,
      nome: "LORENZO",
      email: "LORENZODAVID@EMAIL.COM",
      avatar: "/images/Perfil.png",
    },
  ];

  return (
    <>
      <Head>
        <title>Contas | ConectaMente</title>
      </Head>

      <main className={styles.pagina}>
        <Link href="/responsavel" className={styles.voltar}>
          
        </Link>

        <img
          src="/images/logo.png"
          alt="Logo ConectaMente"
          className={styles.logo}
        />

        <section className={styles.painel}>
          <header className={styles.cabecalho}>
            <h1>Contas</h1>

            <Link
              href="/responsavel/adicionar-conta"
              className={styles.adicionar}
              aria-label="Adicionar conta"
            >
              +
            </Link>
          </header>

          {contas.length > 0 ? (
            <div className={styles.lista}>
              {contas.map((conta) => (
                <article key={conta.id} className={styles.card}>
                  <img
                    src={conta.avatar}
                    alt={`Avatar de ${conta.nome}`}
                    className={styles.avatar}
                  />

                  <div className={styles.informacoes}>
                    <h2>{conta.nome}</h2>
                    <p>{conta.email}</p>
                  </div>

                  <Link
                    href={`/responsavel/rendimento?id=${conta.id}`}
                    className={styles.detalhes}
                    aria-label={`Ver rendimento de ${conta.nome}`}
                  >
                    <svg
                      viewBox="0 0 32 32"
                      aria-hidden="true"
                      className={styles.iconeOlho}
                    >
                      <path
                        d="M2 16S7 6 16 6s14 10 14 10-5 10-14 10S2 16 2 16Z"
                        fill="currentColor"
                      />
                      <circle cx="16" cy="16" r="6" fill="white" />
                      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
                    </svg>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className={styles.vazio}>
              Você não possui contas para monitorar.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
