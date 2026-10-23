
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Resumo.module.css";

export default function Resumo() {
  const router = useRouter();
  const { id } = router.query;

  const indicadores = [
    {
      valor: "3",
      titulo: "Atividades concluídas",
    },
    {
      valor: "12",
      titulo: "Etapas concluídas",
    },
    {
      valor: "75",
      titulo: "Pontuação ganha",
      unidade: "pontos",
    },
  ];

  return (
    <>
      <Head>
        <title>Resumo de atividade | ConectaMente</title>
        <meta
          name="description"
          content="Resumo das atividades da criança no ConectaMente."
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
          <h2>Resumo de atividade</h2>

          <div className={styles.indicadores}>
            {indicadores.map((item) => (
              <article className={styles.indicador} key={item.titulo}>
                <strong>{item.valor}</strong>
                <span>{item.titulo}</span>
                {item.unidade && <small>({item.unidade})</small>}
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
