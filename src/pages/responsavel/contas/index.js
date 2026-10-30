
import Head from "next/head";
import Link from "next/link";
import api from "../../../services/api";
import { useState, useEffect } from "react";
import styles from "./Contas.module.css";

export default function Contas() {
const [contas, setContas] = useState([]);
const [carregando, setCarregando] = useState(false);
const [erro, setErro] = useState(null);
const [consultaRealizada, setConsultaRealizada] = useState(false);
useEffect(() => {
  let consultaAtiva = true;
  async function buscarCriancas(token) {
    setCarregando(true);
    setErro(null);

    try {
      const resposta = await api.get(
        "/responsaveis/minhas-criancas",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (!consultaAtiva) return;
      setContas(resposta.data);
    } catch (erro) {
      if (!consultaAtiva) return;
      setErro("Não foi possível carregar as contas.");
      console.error("Erro ao buscar crianças:", erro);
    } finally {
      if (consultaAtiva) {
        setCarregando(false);
        setConsultaRealizada(true);
      }
    }
  }

  const token = window.prompt("Informe o JWT de teste:");

  if (token?.trim()) {
    buscarCriancas(token.trim());
  } else {
    setCarregando(false);
    setContas([]);
    setErro("É necessário informar o JWT do responsável.");
    setConsultaRealizada(true);
  }
  return () => {
    consultaAtiva = false;
  };
}, []);


  return (
    <>
      <Head>
        <title>Contas | ConectaMente</title>
      </Head>

      <main className={styles.pagina}>
        <Link href="/responsavel" className={styles.voltar}>
          
        </Link>

        <img
          src="/images/logo.png"
          alt="Logo ConectaMente"
          className={styles.logo}
        />

        <section className={styles.painel}>
          <header className={styles.cabecalho}>
            <h1>Contas</h1>

            <Link
              href="/responsavel/adicionar-conta"
              className={styles.adicionar}
              aria-label="Adicionar conta"
            >
              +
            </Link>
          </header>

          {carregando ? (
            <p className={styles.vazio}>Carregando contas...</p>
          ) : erro ? (
            <p className={styles.vazio}>{erro}</p>
          ) : contas.length > 0 ? (
            <div className={styles.lista}>
              {contas.map((conta) => (
                <article key={conta._id} className={styles.card}>
                  <img
                    src="/images/Perfil.png"
                    alt={`Avatar de ${conta.nome}`}
                    className={styles.avatar}
                  />

                  <div className={styles.informacoes}>
                    <h2>{conta.nome}</h2>
                    <p>{conta.email}</p>
                  </div>

                  <Link
                    href={`/responsavel/rendimento?id=${conta.usuarioId}`}
                    className={styles.detalhes}
                    aria-label={`Ver rendimento de ${conta.nome}`}
                  >
                    <svg
                      viewBox="0 0 32 32"
                      aria-hidden="true"
                      className={styles.iconeOlho}
                    >
                      <path
                        d="M2 16S7 6 16 6s14 10 14 10-5 10-14 10S2 16 2 16Z"
                        fill="currentColor"
                      />
                      <circle cx="16" cy="16" r="6" fill="white" />
                      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
                    </svg>
                  </Link>
                </article>
              ))}
            </div>
          ) : !consultaRealizada ? (
            <p className={styles.vazio}>
              Aguardando autenticação para consultar as contas.
            </p>
          ) : (
            <p className={styles.vazio}>
              Você não possui contas para monitorar.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
