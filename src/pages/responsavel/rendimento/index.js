import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Rendimento.module.css";

export default function Rendimento() {
  const router = useRouter();
  const { id } = router.query;

  const links = [
    {
      texto: "Resumo de atividade",
      destino: "/responsavel/rendimento/resumo",
    },
    {
      texto: "Percentual de acerto",
      destino: "/responsavel/rendimento/percentual",
    },
    {
      texto: "Evolução do progresso",
      destino: "/responsavel/rendimento/evolucao",
    },
    {
      texto: "Relatório Final",
      destino: "/responsavel/rendimento/relatorio",
    },
  ];

  return (
    <>
      <Head>
        <title>Rendimento da conta | ConectaMente</title>
        <meta
          name="description"
          content="Acompanhe o rendimento da criança no ConectaMente."
        />
      </Head>

      <main className={styles.pagina}>
        
      <Link
        href="/responsavel/contas"
        className={styles.voltar}
        aria-label="Voltar para contas"
      >
        <img
          src="/images/majesticons_share.png"
          alt=""
          className={styles.iconeVoltar}
        />
      </Link>


        <img
          src="/images/logo.png"
          alt="Logo ConectaMente"
          className={styles.logo}
        />

        <section className={styles.painel}>
          <h1>Rendimento da conta</h1>

          <p className={styles.descricao}>
            Acompanhe o desenvolvimento da criança durante as atividades.
          </p>

          <div className={styles.opcoes}>
            {links.map((link) => (
              <Link
                key={link.destino}
                href={{
                  pathname: link.destino,
                  query: id ? { id } : {},
                }}
                className={styles.botao}
              >
                {link.texto}
              </Link>
            ))}
          </div>

          <Link
            href={{
            pathname: "/responsavel/detalhes",
            query: id ? { id } : {},
            }}
            className={styles.configuracoes}
            aria-label="Detalhes da conta"
                >
            <img
              src="/images/material-symbols_settings-rounded.png"
              alt=""
            />
        </Link>
        </section>
      </main>
    </>
  );
}