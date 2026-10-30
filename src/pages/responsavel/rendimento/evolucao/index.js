
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Evolucao.module.css";
import { useEffect, useState } from "react";
import api from "../../../../services/api";

export default function Evolucao() {
  const router = useRouter();
  const { id } = router.query;
  const [evolucao, setEvolucao] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [consultaConcluida, setConsultaConcluida] = useState(false);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    if (!router.isReady || !id) return;
    let consultaAtiva = true;
    async function buscarEvolucao() {
      setConsultaConcluida(false);
      setCarregando(false);
      setErro(null);
      setEvolucao([]);
      const token = window.prompt(
        "Informe o JWT do responsável para teste:"
      );

      if (!token?.trim()) {
        setErro("É necessário informar o JWT.");
        return;
      }

      setCarregando(true);
      
      try {
        const resposta = await api.get(
          `/criancas/${id}/evolucao-diaria`,
          {
            headers: {
              Authorization: `Bearer ${token.trim()}`,
            },
          }
        );
        if (!consultaAtiva) return;
        setEvolucao(resposta.data.evolucao);
        setConsultaConcluida(true);
      } catch (error) {
        if (!consultaAtiva) return;
        console.error(
          "Erro ao consultar evolução diária:",
          error.response?.status
        );

        setErro(
          error.response?.data?.mensagem ||
            "Não foi possível consultar a evolução diária."
        );
      } finally {
        if (consultaAtiva) {
          setCarregando(false);
        }
      }
    }

    buscarEvolucao();
    return () => {
      consultaAtiva = false;
    };
  }, [router.isReady, id]);
  const pontos = evolucao.map((item) => ({
    dia: `${item.data.slice(8, 10)}/${item.data.slice(5, 7)}`,
    valor: item.percentualAcertos,
  }));

  const largura = 600;
  const altura = 250;
  const margem = 35;

  const coordenadas = pontos.map((ponto, indice) => ({
    x:
      pontos.length === 1
        ? largura / 2
        : margem +
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
          {carregando && <p>Carregando evolução...</p>}
          {erro && <p role="alert">{erro}</p>}
          {consultaConcluida && !carregando && !erro && evolucao.length === 0 && (
            <p>Nenhuma atividade registrada para esta criança.</p>
          )}
          {consultaConcluida && !carregando && !erro && evolucao.length > 0 && (
            <>
            <div className={styles.grafico}>
              
              <svg
                className={styles.svg}
                viewBox={`0 0 ${largura} ${altura}`}
                role="img"
                aria-label="Gráfico de evolução diária do percentual de acertos"
              >
                {[0, 25, 50, 75, 100].map((valor) => {
                  const y =
                    altura -
                    margem -
                    (valor / 100) * (altura - margem * 2);

                  return (
                    <g key={valor}>
                      <line
                        x1={margem}
                        y1={y}
                        x2={largura - margem}
                        y2={y}
                        className={styles.grade}
                      />

                      <text
                        x={margem - 10}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="#555"
                        fontSize="12"
                      >
                        {valor}
                      </text>
                    </g>
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
                {coordenadas.map((ponto, indice) => (
                  <text
                    key={`data-${indice}`}
                    x={ponto.x}
                    y={altura - 10}
                    textAnchor="middle"
                    fill="#555"
                    fontSize="12"
                  >
                    {pontos[indice].dia}
                  </text>
                ))}
              </svg>
            </div>

            <p className={styles.legenda}>
               Percentual diário de acertos (%)
            </p>
            </>
          )}
        </section>
      </main>
    </>
  );
}
