
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import api from "../../../../services/api";
import styles from "./Resumo.module.css";

export default function Resumo() {
  const router = useRouter();
  const { id } = router.query;
  const [progresso, setProgresso] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
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
        const resposta = await api.get(
          `/criancas/${id}/resumo-desempenho`,
          {
            headers: {
              Authorization: `Bearer ${token.trim()}`,
            },
          }
        );

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
        if (consultaAtiva) {
          setCarregando(false);
        }
      }
    }

    buscarProgresso();

    return () => {
      consultaAtiva = false;
    };
  }, [router.isReady, id]);

  const indicadores = [
    {
      valor: progresso?.resumo?.tarefasConcluidas ?? 0,
      titulo: "Tarefas concluídas",
    },
    {
      valor: progresso?.resumo?.totalTentativas ?? 0,
      titulo: "Total de tentativas",
    },
    {
      valor: progresso?.resumo?.acertos ?? 0,
      titulo: "Acertos",
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
          {carregando && <p>Carregando progresso...</p>}
          {erro && <p role="alert">{erro}</p>}
          {progresso && !carregando && !erro && (
            <div className={styles.indicadores}>
              {indicadores.map((item) => (
                <article className={styles.indicador} key={item.titulo}>
                  <strong>{item.valor}</strong>
                  <span>{item.titulo}</span>
                  {item.unidade && <small>({item.unidade})</small>}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
