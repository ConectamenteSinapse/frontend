import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import api from "../../../../services/api";
import styles from "./Relatorio.module.css";

export default function Relatorio() {
  const router = useRouter();
  const { id } = router.query;
  const [crianca, setCrianca] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [comodos, setComodos] = useState([]);


  useEffect(() => {
    if (!router.isReady || !id) return;
      let consultaAtiva = true;
    async function buscarRelatorio() {
      setCarregando(true);
      setErro(null);
      setCrianca(null);
      setProgresso(null);
      setComodos([]);

      const token = localStorage.getItem("token");

      if (!token?.trim()) {
        setCarregando(false);
        router.replace("/");
        return;
      }

      try {
        const configuracao = {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
          },
        };

        const [respostaCriancas, respostaProgresso, respostaComodos] =
        await Promise.all([
          api.get("/responsaveis/minhas-criancas"),
          api.get(`/criancas/${id}/resumo-desempenho`),
          api.get("/comodos"),
        ]);
        if (!consultaAtiva) return;
        const criancaEncontrada = respostaCriancas.data.find(
          (item) => String(item.usuarioId) === String(id)
        );

        if (!criancaEncontrada) {
          setErro("Criança não encontrada entre as contas vinculadas.");
          return;
        }

        setCrianca(criancaEncontrada);
        setProgresso(respostaProgresso.data);
        setComodos(
          respostaComodos.data
            .sort((a, b) => a.ordem - b.ordem)
        );
      } catch (error) {
        if (!consultaAtiva) return;

        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setCrianca(null);
          setProgresso(null);
          setComodos([]);
          router.replace("/");
          return;
        }

        setCrianca(null);
        setProgresso(null);
        setComodos([]);

        setErro(
          error.response?.data?.mensagem ||
            "Não foi possível carregar o relatório."
        );
      } finally {
        if (consultaAtiva) {
          setCarregando(false);
        }
      }
    }

    buscarRelatorio();
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

    const desempenhoComodos = comodos.map((comodo) => {
    const desempenho = progresso?.desempenhoPorComodo?.find(
      (item) => String(item.comodoId) === String(comodo._id)
    );

    return {
      id: comodo._id,
      nome: comodo.nome,
      tentativas: desempenho?.tentativas ?? 0,
      acertos: desempenho?.acertos ?? 0,
      erros: desempenho?.erros ?? 0,
      percentual:
        desempenho?.tentativas > 0
          ? `${desempenho.percentualAcertos}%`
          : "—",
    };
  });


  return (
    <>
      <Head>
        <title>Relatório Final | ConectaMente</title>
        <meta
          name="description"
          content="Relatório de desempenho da criança no ConectaMente."
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
        {carregando && <p>Carregando relatório...</p>}
        {erro && <p role="alert">{erro}</p>}
        <section className={styles.painel}>
          <h1>Relatório Final</h1>
          <p className={styles.descricao}>
            Confira o resumo do desempenho da criança nas atividades.
          </p>
          {crianca && progresso && !carregando && !erro && (
            <>
              <div className={styles.perfil}>
                <img src="/images/Perfil.png" alt="Avatar da criança" />
                <div>
                  <h2>{crianca?.nome ?? "Carregando..."}</h2>
                  <p>Relatório de desempenho</p>
                </div>
              </div>

              <div className={styles.indicadores}>
                {indicadores.map((item) => (
                  <article className={styles.indicador} key={item.titulo}>
                    <span className={styles.valor}>{item.valor}</span>
                    {item.unidade && (
                      <span className={styles.unidade}>{item.unidade}</span>
                    )}
                    <p>{item.titulo}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          {crianca && progresso && !carregando && !erro && (
          <>
            <h2 className={styles.tituloTabela}>Desempenho por cômodo</h2>
            <div className={styles.tabelaContainer}>    
            <table className={styles.tabela}>
                <thead>
                  <tr>
                    <th>CÔMODO</th>
                    <th>TENTATIVAS</th>
                    <th>ACERTOS</th>
                    <th>ERROS</th>
                    <th>PERCENTUAL</th>
                  </tr>
                </thead>
                <tbody>
                {desempenhoComodos.map((comodo) => (
                  <tr key={comodo.id}>
                    <td>{comodo.nome}</td>
                    <td>{comodo.tentativas}</td>
                    <td>{comodo.acertos}</td>
                    <td>{comodo.erros}</td>
                    <td>{comodo.percentual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
          )}
        </section>
        </main>
        </>
        );
        }

