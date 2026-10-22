
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import styles from "./Detalhes.module.css";

export default function Detalhes() {
  const [modal, setModal] = useState("");
  const [limite, setLimite] = useState(150);
  const [ativa, setAtiva] = useState(true);

  // Dados fictícios para montar a tela.
  // Depois podemos conectar com o backend.
  const crianca = {
    nome: "LORENZO",
    email: "LORENZODAVID@EMAIL.COM",
    avatar: "/images/crianca.png",
  };

  function confirmarExclusao() {
    setModal("");
    alert("A exclusão será conectada à API posteriormente.");
  }

  function salvarLimite() {
    if (!limite || Number(limite) < 1) {
      alert("Informe um limite válido.");
      return;
    }

    setLimite(Number(limite));
    setModal("");
    alert("Limite atualizado nesta demonstração.");
  }

  function alternarConta() {
    setAtiva(!ativa);
    setModal("");
  }

  return (
    <>
      <Head>
        <title>Detalhes da Conta | ConectaMente</title>
        <meta
          name="description"
          content="Gerenciamento da conta da criança no ConectaMente."
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
          <div className={styles.perfil}>
            <img
              src={crianca.avatar}
              alt={`Avatar de ${crianca.nome}`}
              className={styles.avatar}
            />

            <h1>{crianca.nome}</h1>
            <p>{crianca.email}</p>

            <p className={styles.status}>
              Status: {ativa ? "Ativa" : "Desativada"}
            </p>
          </div>

          <div className={styles.acoes}>
            <button
              type="button"
              className={styles.botao}
              onClick={() => setModal("limite")}
            >
              Limite de tempo por dia
            </button>

            <button
              type="button"
              className={styles.botao}
              onClick={() => setModal("desativar")}
            >
              {ativa ? "Desativar Conta" : "Ativar Conta"}
            </button>

            <button
              type="button"
              className={`${styles.botao} ${styles.excluir}`}
              onClick={() => setModal("excluir")}
            >
              Excluir Conta
            </button>
          </div>
        </section>

        {modal && (
          <div
            className={styles.fundoModal}
            onClick={() => setModal("")}
          >
            <section
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={styles.fechar}
                onClick={() => setModal("")}
                aria-label="Fechar modal"
              >
                ×
              </button>

              {modal === "limite" && (
                <>
                  <h2>Limite de tempo por dia</h2>

                  <p>
                    Quanto tempo de jogo por dia essa conta poderá utilizar?
                  </p>

                  <label htmlFor="limite">Tempo diário</label>

                  <div className={styles.campoLimite}>
                    <input
                      id="limite"
                      type="number"
                      min="1"
                      value={limite}
                      onChange={(event) =>
                        setLimite(event.target.value)
                      }
                    />

                    <span>minutos</span>
                  </div>

                  <button
                    type="button"
                    className={styles.confirmar}
                    onClick={salvarLimite}
                  >
                    Salvar
                  </button>
                </>
              )}

              {modal === "desativar" && (
                <>
                  <h2>
                    {ativa ? "Desativar conta?" : "Ativar conta?"}
                  </h2>

                  <p>
                    {ativa
                      ? "Deseja desativar esta conta?"
                      : "Deseja ativar esta conta novamente?"}
                  </p>

                  <div className={styles.botoesModal}>
                    <button
                      type="button"
                      className={styles.cancelar}
                      onClick={() => setModal("")}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className={styles.confirmar}
                      onClick={alternarConta}
                    >
                      Confirmar
                    </button>
                  </div>
                </>
              )}

              {modal === "excluir" && (
                <>
                  <h2>Excluir conta?</h2>

                  <p>
                    Tem certeza de que deseja excluir esta conta?
                    Essa ação não poderá ser desfeita.
                  </p>

                  <div className={styles.botoesModal}>
                    <button
                      type="button"
                      className={styles.cancelar}
                      onClick={() => setModal("")}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className={styles.excluir}
                      onClick={confirmarExclusao}
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}
