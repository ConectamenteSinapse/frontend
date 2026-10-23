
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Percentual.module.css";

export default function Percentual() {
  const router = useRouter();
  const { id } = router.query;

  const corretas = 75;
  const incorretas = 25;

  return (
    <>
      <Head>
        <title>Percentual de acerto | ConectaMente</title>
        <meta
          name="description"
          content="Percentual de respostas corretas da criança."
        />
      </Head>

      <main className={styles.pagina}>
        <Link
          href={{
            pathname: "/responsavel/rendimento",
            query: id ? { id } : {},
          }}
          className={styles.voltar}
          aria-label="Voltar ao menu de rendimento"
        >
          <img
            src="/images/majesticons_share.png"
            alt=""
            className={styles.iconeVoltar}
          />
        </Link>

        <header className={styles.cabecalho}>
          <img
            src="/images/logo.png"
            alt="Logo ConectaMente"
            className={styles.logo}
          />
          <h1>RENDIMENTO DA CONTA</h1>
        </header>

        <section className={styles.painel}>
          <h2>Percentual de acerto</h2>

          <div className={styles.graficoArea}>
            <div
              className={styles.grafico}
              role="img"
              aria-label={`${corretas}% de respostas corretas e ${incorretas}% incorretas`}
              style={{
                background: `conic-gradient(#164b87 0% ${corretas}%, #f4a62a ${corretas}% 100%)`,
              }}
            >
              <div className={styles.centro}>
                <strong>{corretas}%</strong>
                <span>de acertos</span>
              </div>
            </div>
          </div>

          <div className={styles.legenda}>
            <p>
              <span className={styles.azul} />
              Respostas corretas: {corretas}%
            </p>

            <p>
              <span className={styles.laranja} />
              Respostas incorretas: {incorretas}%
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
