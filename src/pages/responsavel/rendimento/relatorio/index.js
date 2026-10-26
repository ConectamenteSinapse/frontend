
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import styles from "./Relatorio.module.css";

export default function Relatorio() {
  const router = useRouter();
  const { id } = router.query;

  const indicadores = [
    { valor: "3", titulo: "Atividades concluídas" },
    { valor: "12", titulo: "Etapas concluídas" },
    { valor: "75", titulo: "Pontuação ganha", unidade: "pontos" },
  ];

    const fases = [
    {
        nome: "QUARTO",
        modificacao: "29/04/2026",
        status: "CONCLUÍDO",
        dificuldade: "FÁCIL",
        tipo: "concluido",
    },
    {
        nome: "BANHEIRO",
        modificacao: "29/04/2026",
        status: "CONCLUÍDO",
        dificuldade: "FÁCIL",
        tipo: "concluido",
    },
    {
        nome: "SALA",
        modificacao: "29/04/2026",
        status: "CONCLUÍDO",
        dificuldade: "FÁCIL",
        tipo: "concluido",
    },
    {
        nome: "COZINHA",
        modificacao: "--",
        status: "NÃO COMEÇOU",
        dificuldade: "",
        tipo: "disponivel",
    },
    {
        nome: "EXTRA",
        modificacao: "--",
        status: "BLOQUEADO",
        dificuldade: "",
        tipo: "bloqueado",
    },
    ];


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

        <section className={styles.painel}>
          <h1>Relatório Final</h1>
          <p className={styles.descricao}>
            Confira o resumo do desempenho da criança nas atividades.
          </p>

          <div className={styles.perfil}>
            <img src="/images/Perfil.png" alt="Avatar da criança" />
            <div>
              <h2>Lorenzo</h2>
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

          <h2 className={styles.tituloTabela}>Desempenho por fase</h2>

          
        <h2 className={styles.tituloTabela}>Status dos módulos</h2>

        <div className={styles.tabelaContainer}>
        <table className={styles.tabela}>
            <thead>
            <tr>
                <th>MÓDULO</th>
                <th>ÚLTIMA MODIFICAÇÃO</th>
                <th>STATUS / DIFICULDADE</th>
            </tr>
            </thead>

            <tbody>
            {fases.map((fase) => (
                <tr key={fase.nome} className={styles[fase.tipo]}>
                <td>{fase.nome}</td>

                <td>{fase.modificacao}</td>

                <td>
                    <div className={styles.status}>
                    {fase.tipo === "concluido" && (
                        <span className={styles.check}>✓</span>
                    )}

                    {fase.tipo === "disponivel" && (
                        <span className={styles.bolaVermelha} />
                    )}

                    {fase.tipo === "bloqueado" && (
                        <span className={styles.cadeado}></span>
                    )}

                    <span>
                        <strong>{fase.status}</strong>

                        {fase.dificuldade && (
                        <strong className={styles.dificuldade}>
                            ({fase.dificuldade})
                        </strong>
                        )}
                    </span>
                    </div>
                </td>
                </tr>
            ))}
            </tbody>
        </table>
        </div>

        <p className={styles.observacao}>
        Os módulos são liberados em sequência. Para acessar o próximo,
        a criança precisa concluir o módulo anterior.
        </p>
        </section>
        </main>
        </>
        );
        }

