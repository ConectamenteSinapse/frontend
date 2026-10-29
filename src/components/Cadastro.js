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

  // 'responsavel' ou 'crianca'
  const [tipoCadastro, setTipoCadastro] = useState("responsavel");

  // Dados dos formulários (agora a criança também usa email e senha)
  const [formData, setFormData] = useState({
    nomeResponsavel: "",
    emailResponsavel: "",
    senhaResponsavel: "",
    confirmarSenhaResponsavel: "",
    nomeCrianca: "",
    emailCrianca: "",
    senhaCrianca: "",
    confirmarSenhaCrianca: "",
  });

  const [mostrarSenhaResp, setMostrarSenhaResp] = useState(false);
  const [mostrarConfSenhaResp, setMostrarConfSenhaResp] = useState(false);
  const [mostrarSenhaCrianca, setMostrarSenhaCrianca] = useState(false);
  const [mostrarConfSenhaCrianca, setMostrarConfSenhaCrianca] = useState(false);

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

    if (tipoCadastro === "responsavel") {
      if (formData.senhaResponsavel !== formData.confirmarSenhaResponsavel) {
        setErro("As senhas do responsável não coincidem.");
        return;
      }
      // Se preencheu o responsável, passa para a aba da criança para completar o cadastro conjunto
      setTipoCadastro("crianca");
      return;
    }

    // Validação da criança
    if (formData.senhaCrianca !== formData.confirmarSenhaCrianca) {
      setErro("As senhas da criança não coincidem.");
      return;
    }

    // Envio final para a API do back-end
    setCarregando(true);
    try {
      const payload = {
        responsavel: {
          nome: formData.nomeResponsavel,
          email: formData.emailResponsavel,
          senha: formData.senhaResponsavel,
        },
        crianca: {
          nome: formData.nomeCrianca,
          email: formData.emailCrianca,
          senha: formData.senhaCrianca,
        }
      };

      const resposta = await api.post("/usuarios/cadastro", payload);
      console.log("Cadastro realizado com sucesso:", resposta.data);
      router.push("/menu");
    } catch (error) {
      if (error.response) {
        setErro(error.response.data?.mensagem || "Erro ao realizar o cadastro.");
      } else {
        setErro("Não foi possível conectar ao servidor.");
      }
    } finally {
      setCarregando(false);
    }
  };

  return (
    <main className={styles.pagina}>
      {/* CABEÇALHO FIXO NAS EXTREMIDADES */}
      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={handleVoltar}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img src="/images/seta.png" alt="Voltar" className={styles.iconeVoltar} />
        </button>

        <div className={styles.logoContainer}>
          <img src="/images/logo.png" alt="Logo ConectaMente" className={styles.logo} />
        </div>
      </header>

      {/* CONTEÚDO CENTRALIZADO */}
      <div className={styles.carrosselContainer}>
        <section className={styles.cardEtapa}>
          <h1 className={styles.titulo}>
            {tipoCadastro === "responsavel" ? "Criar conta" : "Cadastrar Criança"}
          </h1>

          <form onSubmit={handleSubmit} className={styles.formulario}>
            {tipoCadastro === "responsavel" ? (
              /* FORMULÁRIO DO RESPONSÁVEL */
              <>
                <div className={styles.campo}>
                  <User size={22} className={styles.icone} />
                  <input
                    type="text"
                    name="nomeResponsavel"
                    placeholder="Nome completo"
                    value={formData.nomeResponsavel}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className={styles.campo}>
                  <Mail size={22} className={styles.icone} />
                  <input
                    type="email"
                    name="emailResponsavel"
                    placeholder="E-mail"
                    value={formData.emailResponsavel}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className={styles.campo}>
                  <Lock size={22} className={styles.icone} />
                  <input
                    type={mostrarSenhaResp ? "text" : "password"}
                    name="senhaResponsavel"
                    placeholder="Senha:"
                    value={formData.senhaResponsavel}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className={styles.botaoOlho}
                    onClick={() => setMostrarSenhaResp((prev) => !prev)}
                  >
                    {mostrarSenhaResp ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className={styles.campo}>
                  <Lock size={22} className={styles.icone} />
                  <input
                    type={mostrarConfSenhaResp ? "text" : "password"}
                    name="confirmarSenhaResponsavel"
                    placeholder="Confirmar Senha:"
                    value={formData.confirmarSenhaResponsavel}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className={styles.botaoOlho}
                    onClick={() => setMostrarConfSenhaResp((prev) => !prev)}
                  >
                    {mostrarConfSenhaResp ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </>
            ) : (
              /* FORMULÁRIO DA CRIANÇA (Mesmo padrão: Nome, E-mail, Senha, Confirmar Senha) */
              <>
                <div className={styles.campo}>
                  <User size={22} className={styles.icone} />
                  <input
                    type="text"
                    name="nomeCrianca"
                    placeholder="Nome completo da criança"
                    value={formData.nomeCrianca}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className={styles.campo}>
                  <Mail size={22} className={styles.icone} />
                  <input
                    type="email"
                    name="emailCrianca"
                    placeholder="E-mail da criança"
                    value={formData.emailCrianca}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className={styles.campo}>
                  <Lock size={22} className={styles.icone} />
                  <input
                    type={mostrarSenhaCrianca ? "text" : "password"}
                    name="senhaCrianca"
                    placeholder="Senha:"
                    value={formData.senhaCrianca}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className={styles.botaoOlho}
                    onClick={() => setMostrarSenhaCrianca((prev) => !prev)}
                  >
                    {mostrarSenhaCrianca ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className={styles.campo}>
                  <Lock size={22} className={styles.icone} />
                  <input
                    type={mostrarConfSenhaCrianca ? "text" : "password"}
                    name="confirmarSenhaCrianca"
                    placeholder="Confirmar Senha:"
                    value={formData.confirmarSenhaCrianca}
                    onChange={handleChange}
                    required
                  />
                  <button
                    type="button"
                    className={styles.botaoOlho}
                    onClick={() => setMostrarConfSenhaCrianca((prev) => !prev)}
                  >
                    {mostrarConfSenhaCrianca ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </>
            )}

            {erro && (
              <p role="alert" style={{ color: "#fff", textAlign: "center", fontWeight: 700, margin: 0 }}>
                {erro}
              </p>
            )}

            <button type="submit" className={styles.botaoContinuar} disabled={carregando}>
              {carregando ? "A processar..." : "Continuar"}
            </button>
          </form>

          {/* SELETOR INFERIOR DE PERFIS */}
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={() => setTipoCadastro("responsavel")}
              style={{
                background: tipoCadastro === "responsavel" ? "#ffffff" : "rgba(255,255,255,0.2)",
                color: tipoCadastro === "responsavel" ? "#000" : "#fff",
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
                background: tipoCadastro === "crianca" ? "#ffffff" : "rgba(255,255,255,0.2)",
                color: tipoCadastro === "crianca" ? "#000" : "#fff",
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