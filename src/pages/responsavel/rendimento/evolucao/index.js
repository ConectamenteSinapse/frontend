
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Evolucao.module.css";

export default function Evolucao() {
  const router = useRouter();
  const { id } = router.query;

  const pontos = [
    { dia: "01/10", valor: 20 },
    { dia: "05/10", valor: 35 },
    { dia: "10/10", valor: 30 },
    { dia: "15/10", valor: 55 },
    { dia: "20/10", valor: 70 },
    { dia: "25/10", valor: 65 },
    { dia: "30/10", valor: 85 },
  ];

  const largura = 600;
  const altura = 250;
  const margem = 35;

  const coordenadas = pontos.map((ponto, indice) => ({
    x:
      margem +
      (indice * (largura - margem * 2)) / (pontos.length - 1),
    y:
      altura -
      margem -
      (ponto.valor / 100) * (altura - margem * 2),
  }));

  const linha = coordenadas
    .map((ponto, indice) =>
      `${indice === 0 ? "M" : "L"} ${ponto.x} ${ponto.y}`
    )
    .join(" ");

  return (
    <>
      <Head>
        <title>Evolução do progresso | ConectaMente</title>
        <meta
          name="description"
          content="Acompanhe a evolução do progresso da criança."
        />
      </Head>

      <main className={styles.pagina}>
        <Link
          href={{
            pathname: "/responsavel/rendimento",
            query: id ? { id } : {},
          }}
          className={styles.voltar}
          aria-label="Voltar para rendimento"
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
          <h1>Evolução do progresso</h1>
          <p className={styles.descricao}>
            Acompanhe o desenvolvimento da criança ao longo do tempo.
          </p>

          <div className={styles.grafico}>
            <div className={styles.eixoY}>
              {[100, 75, 50, 25, 0].map((valor) => (
                <span key={valor}>{valor}</span>
              ))}
            </div>

            <svg
              className={styles.svg}
              viewBox={`0 0 ${largura} ${altura}`}
              role="img"
              aria-label="Gráfico de evolução da pontuação ao longo de outubro"
            >
              {[0, 25, 50, 75, 100].map((valor) => {
                const y =
                  altura -
                  margem -
                  (valor / 100) * (altura - margem * 2);

                return (
                  <line
                    key={valor}
                    x1={margem}
                    y1={y}
                    x2={largura - margem}
                    y2={y}
                    className={styles.grade}
                  />
                );
              })}

              <path d={linha} className={styles.linha} />

              {coordenadas.map((ponto, indice) => (
                <circle
                  key={pontos[indice].dia}
                  cx={ponto.x}
                  cy={ponto.y}
                  r="5"
                  className={styles.ponto}
                />
              ))}
            </svg>

            <div className={styles.eixoX}>
              {pontos.map((ponto) => (
                <span key={ponto.dia}>{ponto.dia}</span>
              ))}
            </div>
          </div>

          <p className={styles.legenda}>
            Pontuação ao longo de outubro (%)
          </p>
        </section>
      </main>
    </>
  );
}
