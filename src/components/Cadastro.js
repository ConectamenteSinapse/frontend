
import { useState } from "react";
import { useRouter } from "next/router";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Smile,
} from "lucide-react";

import styles from "../styles/Cadastro.module.css";
import api from "../services/api";

export default function Cadastro() {
  const router = useRouter();

  const [tipoCadastro, setTipoCadastro] = useState("responsavel");

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
  });

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((dadosAnteriores) => ({
      ...dadosAnteriores,
      [name]: value,
    }));

    setErro("");
  };

  const handleVoltar = () => {
    router.push("/");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro("");

    if (formData.senha !== formData.confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setCarregando(true);

    try {
      // 1. Criar a conta do usuário
      await api.post("/usuarios", {
        nome: formData.nome,
        email: formData.email,
        senha: formData.senha,
        perfil: tipoCadastro,
      });

      // 2. Fazer login para obter o token
      const login = await api.post("/usuarios/auth", {
        email: formData.email,
        senha: formData.senha,
      });

      const token = login.data.token;

      localStorage.setItem("token", token);

      // 3. Criar o perfil correspondente
      if (tipoCadastro === "responsavel") {
        await api.post("/responsaveis", {});
      } else {
        await api.post("/criancas", {});
      }

      // 4. Limpar o token e voltar para o login
      localStorage.removeItem("token");

      router.push("/");
    } catch (error) {
      console.error("Erro no cadastro:", error);

      localStorage.removeItem("token");

      const mensagem =
        error.response?.data?.mensagem ||
        error.response?.data?.erro ||
        "Não foi possível concluir o cadastro. Verifique os dados e tente novamente.";

      setErro(
        typeof mensagem === "string"
          ? mensagem
          : "Não foi possível concluir o cadastro."
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className={styles.pagina}>
      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={handleVoltar}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img
            src="/images/seta.png"
            alt="Voltar"
            className={styles.iconeVoltar}
          />
        </button>

        <div className={styles.logoContainer}>
          <img
            src="/images/logo.png"
            alt="Logo ConectaMente"
            className={styles.logo}
          />
        </div>
      </header>

      <div className={styles.carrosselContainer}>
        <section className={styles.cardEtapa}>
          <h1 className={styles.titulo}>Criar conta</h1>

          <form
            onSubmit={handleSubmit}
            className={styles.formulario}
          >
            {/* Nome completo */}
            <div className={styles.campo}>
              <User size={22} className={styles.icone} />

              <input
                type="text"
                name="nome"
                placeholder="Nome completo"
                value={formData.nome}
                onChange={handleChange}
                required
              />
            </div>

            {/* E-mail */}
            <div className={styles.campo}>
              <Mail size={22} className={styles.icone} />

              <input
                type="email"
                name="email"
                placeholder="E-mail"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {/* Senha */}
            <div className={styles.campo}>
              <Lock size={22} className={styles.icone} />

              <input
                type={mostrarSenha ? "text" : "password"}
                name="senha"
                placeholder="Senha"
                value={formData.senha}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className={styles.botaoOlho}
                onClick={() => setMostrarSenha((prev) => !prev)}
                aria-label="Mostrar ou ocultar senha"
              >
                {mostrarSenha ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            {/* Confirmar senha */}
            <div className={styles.campo}>
              <Lock size={22} className={styles.icone} />

              <input
                type={mostrarConfirmacao ? "text" : "password"}
                name="confirmarSenha"
                placeholder="Confirmar senha"
                value={formData.confirmarSenha}
                onChange={handleChange}
                required
              />

              <button
                type="button"
                className={styles.botaoOlho}
                onClick={() =>
                  setMostrarConfirmacao((prev) => !prev)
                }
                aria-label="Mostrar ou ocultar confirmação da senha"
              >
                {mostrarConfirmacao ? (
                  <EyeOff size={20} />
                ) : (
                  <Eye size={20} />
                )}
              </button>
            </div>

            {erro && (
              <p
                role="alert"
                style={{
                  color: "#fff",
                  textAlign: "center",
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {erro}
              </p>
            )}

            <button
              type="submit"
              className={styles.botaoContinuar}
              disabled={carregando}
            >
              {carregando ? "Cadastrando..." : "Continuar"}
            </button>
          </form>

          {/* Seleção do perfil */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <button
              type="button"
              onClick={() => setTipoCadastro("responsavel")}
              style={{
                background:
                  tipoCadastro === "responsavel"
                    ? "#ffffff"
                    : "rgba(255,255,255,0.2)",
                color:
                  tipoCadastro === "responsavel" ? "#000" : "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: "bold",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <User size={16} /> responsável
            </button>

            <button
              type="button"
              onClick={() => setTipoCadastro("crianca")}
              style={{
                background:
                  tipoCadastro === "crianca"
                    ? "#ffffff"
                    : "rgba(255,255,255,0.2)",
                color:
                  tipoCadastro === "crianca" ? "#000" : "#fff",
                border: "none",
                padding: "8px 18px",
                borderRadius: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: "bold",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              }}
            >
              <Smile size={16} /> criança
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
