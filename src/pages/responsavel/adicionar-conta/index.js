
import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import api from "../../../services/api";
import styles from "./AdcionarConta.module.css";
import { useRouter } from "next/router";

export default function AdicionarConta() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  async function continuar(event) {
    event.preventDefault();
    if (carregando) return;

    if (!email.trim() || !senha.trim()) {
      alert("Preencha o e-mail e a senha.");
      return;
    }
    const token = localStorage.getItem("token");

    if (!token?.trim()) {
      alert("Sua sessão não foi encontrada. Faça login novamente.");
      router.replace("/");
      return;
    }
    setCarregando(true);
    try {
      await api.post("/responsaveis/vincular-crianca", {
        email: email.trim(),
        senha,
      });
      alert("Criança vinculada com sucesso!");
      router.push("/responsavel/contas");
    } catch (erro) {
      const mensagem =
        erro.response?.data?.mensagem ||
        "Não foi possível vincular a criança.";
      alert(mensagem);
    } finally {
      setCarregando(false);
    }
  }
  return (
    <>
      <Head>
        <title>Adicionar Conta | ConectaMente</title>
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
          <h1>Adicionar Conta</h1>

          <p className={styles.descricao}>
            Informe os dados da conta da criança que deseja acompanhar.
          </p>

          <form onSubmit={continuar} className={styles.formulario}>
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              placeholder="Digite o e-mail"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              placeholder="Digite a senha"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
            />

            <button
              type="submit"
              className={styles.continuar}
              disabled={carregando}
            >
              {carregando ? "Vinculando..." : "Continuar"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}
