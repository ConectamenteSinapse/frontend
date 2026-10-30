import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Percentual.module.css";
import { useEffect, useState } from "react";
import api from "../../../../services/api";

export default function Percentual() {
  const router = useRouter();
  const { id } = router.query;

  const [progresso, setProgresso] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const totalTentativas = progresso?.resumo?.totalTentativas ?? 0;
  const corretas = progresso?.resumo?.percentualAcertos ?? 0;
  const incorretas = totalTentativas > 0 ? 100 - corretas : 0;

  useEffect(() => {
  if (!router.isReady || !id) return;

  let consultaAtiva = true;

  async function buscarProgresso() {
    setCarregando(false);
    setErro(null);
    setProgresso(null);

    const token = window.prompt(
      "Informe o JWT do responsável para teste:"
    );

    if (!token?.trim()) {
      setErro("É necessário informar o JWT.");
      return;
    }

    setCarregando(true);
    try {
      const resposta = await api.get(`/criancas/${id}/resumo-desempenho`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      });
      if (!consultaAtiva) return;
      setProgresso(resposta.data);
    } catch (error) {
      if (!consultaAtiva) return;
      console.error(
        "Erro ao consultar progresso:",
        error.response?.status
      );

      setErro(
        error.response?.data?.mensagem ||
          "Não foi possível consultar o progresso."
      );
    } finally {
      if (consultaAtiva){
      setCarregando(false);
      }
    }
  }  
  buscarProgresso();

  return () => {
  consultaAtiva = false;
};
}, [router.isReady, id]);
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
          {carregando && <p>Carregando progresso...</p>}
          {erro && <p role="alert">{erro}</p>}
          {progresso && totalTentativas === 0 && (
            <p>Esta criança ainda não possui tentativas registradas.</p>
          )}
          {progresso && !carregando && !erro && totalTentativas > 0 && (
            <>
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
              </div>
            </>
          )}

        </section>
      </main>
    </>
  );
}
