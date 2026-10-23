import { useState } from "react";
import { useRouter } from "next/router";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Calendar,
  List,
  Heart,
  Smile,
  Check,
} from "lucide-react";

import styles from "../styles/Cadastro.module.css";

export default function Cadastro() {
  const router = useRouter();

  // Etapa 1: Responsável | Etapa 2: Criança
  const [etapa, setEtapa] = useState(1);

  // Dados dos formulários
  const [formData, setFormData] = useState({
    nomeResponsavel: "",
    email: "",
    confirmarEmail: "",
    senha: "",
    confirmarSenha: "",
    nomeCrianca: "",
    idadeCrianca: "",
    interesseCrianca: "",
    observacao: "",
  });

  // Mostrar ou esconder senhas
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] =
    useState(false);

  // Mensagens de validação
  const [erro, setErro] = useState("");

  // Atualizar os campos
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((dadosAnteriores) => ({
      ...dadosAnteriores,
      [name]: value,
    }));

    setErro("");
  };

  // Avançar para o cadastro da criança
  const handleAvancarEtapa = (e) => {
    e.preventDefault();

    if (
      formData.email.trim().toLowerCase() !==
      formData.confirmarEmail.trim().toLowerCase()
    ) {
      setErro("Os e-mails não coincidem.");
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      setErro("As senhas não coincidem.");
      return;
    }

    setErro("");
    setEtapa(2);
  };

  // Voltar uma etapa ou retornar à página inicial
  const handleVoltarEtapa = () => {
    if (etapa === 2) {
      setEtapa(1);
      setErro("");
    } else {
      router.push("/");
    }
  };

  // Finalizar cadastro
  const handleFinalizarCadastro = (e) => {
    e.preventDefault();

    console.log("Dados do cadastro:", formData);

    // Redirecionamento demonstrativo.
    // A integração com a API deverá salvar os dados antes disso.
    router.push("/menu");
  };

  return (
    <main className={styles.pagina}>
      {/* Topo com seta e logo nas extremidades */}
      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={handleVoltarEtapa}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img
            src="/images/seta.png"
            alt=""
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

      {/* Carrossel das duas etapas */}
      <div className={styles.carrosselContainer}>
        <div
          className={`${styles.trilhoFormularios} ${
            etapa === 2 ? styles.mostrarEtapa2 : ""
          }`}
        >
          {/* ETAPA 1: RESPONSÁVEL */}
          <section className={styles.cardEtapa}>
            <h1 className={styles.titulo}>Criar conta</h1>

            <form
              onSubmit={handleAvancarEtapa}
              className={styles.formulario}
            >
              <div className={styles.campo}>
                <User size={22} className={styles.icone} />

                <input
                  type="text"
                  name="nomeResponsavel"
                  placeholder="Nome completo"
                  autoComplete="name"
                  value={formData.nomeResponsavel}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.campo}>
                <Mail size={22} className={styles.icone} />

                <input
                  type="email"
                  name="email"
                  placeholder="E-mail"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.campo}>
                <Mail size={22} className={styles.icone} />

                <input
                  type="email"
                  name="confirmarEmail"
                  placeholder="Confirmar e-mail"
                  autoComplete="off"
                  value={formData.confirmarEmail}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.campo}>
                <Lock size={22} className={styles.icone} />

                <input
                  type={mostrarSenha ? "text" : "password"}
                  name="senha"
                  placeholder="Senha"
                  autoComplete="new-password"
                  value={formData.senha}
                  onChange={handleChange}
                  required
                />

                <button
                  type="button"
                  className={styles.botaoOlho}
                  onClick={() =>
                    setMostrarSenha((anterior) => !anterior)
                  }
                  aria-label={
                    mostrarSenha ? "Ocultar senha" : "Mostrar senha"
                  }
                >
                  {mostrarSenha ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>

              <div className={styles.campo}>
                <Lock size={22} className={styles.icone} />

                <input
                  type={mostrarConfirmarSenha ? "text" : "password"}
                  name="confirmarSenha"
                  placeholder="Confirmar senha"
                  autoComplete="new-password"
                  value={formData.confirmarSenha}
                  onChange={handleChange}
                  required
                />

                <button
                  type="button"
                  className={styles.botaoOlho}
                  onClick={() =>
                    setMostrarConfirmarSenha((anterior) => !anterior)
                  }
                  aria-label={
                    mostrarConfirmarSenha
                      ? "Ocultar confirmação da senha"
                      : "Mostrar confirmação da senha"
                  }
                >
                  {mostrarConfirmarSenha ? (
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
                    margin: "0",
                  }}
                >
                  {erro}
                </p>
              )}

              <button type="submit" className={styles.botaoContinuar}>
                Continuar
              </button>
            </form>
          </section>

          {/* ETAPA 2: CRIANÇA */}
          <section className={styles.cardEtapa}>
            <h1 className={styles.titulo}>
              Agora, vamos cadastrar a criança!
            </h1>

            <form
              onSubmit={handleFinalizarCadastro}
              className={styles.formulario}
            >
              <div className={styles.campo}>
                <User size={22} className={styles.icone} />

                <input
                  type="text"
                  name="nomeCrianca"
                  placeholder="Nome da criança"
                  value={formData.nomeCrianca}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.campo}>
                <Calendar size={22} className={styles.icone} />

                <input
                  type="number"
                  name="idadeCrianca"
                  placeholder="Idade da criança"
                  min="1"
                  max="100"
                  value={formData.idadeCrianca}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.campo}>
                <List size={22} className={styles.icone} />

                <select
                  name="interesseCrianca"
                  value={formData.interesseCrianca}
                  onChange={handleChange}
                  required
                  className={styles.selectInput}
                >
                  <option value="" disabled>
                    Principal dificuldade da criança
                  </option>
                  <option value="jogos">ler</option>
                  <option value="desenho">escovar os dentes</option>
                  <option value="musica">lavar as mãos</option>
                  <option value="matematica">pegar objetos</option>
                </select>
              </div>

              <div className={styles.campo}>
                <Heart size={22} className={styles.icone} />

                <input
                  type="text"
                  name="observacao"
                  placeholder="Observação importante (opcional)"
                  value={formData.observacao}
                  onChange={handleChange}
                />
              </div>

              <button type="submit" className={styles.botaoContinuar}>
                Finalizar cadastro
              </button>
            </form>
          </section>
        </div>
      </div>

      {/* Indicador de progresso */}
      <footer className={styles.rodapeProgresso}>
        <div className={styles.barrasContainer}>
          <div
            className={`${styles.barra} ${
              etapa === 1 ? styles.barraAtiva : ""
            }`}
          />

          <div
            className={`${styles.barra} ${
              etapa === 2 ? styles.barraAtiva : ""
            }`}
          />
        </div>

        <div className={styles.passosLegenda}>
          {/* Passo do responsável */}
          <div
            className={`${styles.passo} ${
              etapa === 1 ? styles.passoAtual : ""
            }`}
          >
            {etapa === 2 ? (
              <div className={styles.iconeCheck}>
                <Check size={16} color="#ffffff" />
              </div>
            ) : (
              <User size={22} color="#ffb703" />
            )}

            <span>1. Responsável</span>
          </div>

          {/* Passo da criança */}
          <div
            className={`${styles.passo} ${
              etapa === 2 ? styles.passoAtual : ""
            }`}
          >
            <Smile
              size={22}
              color={etapa === 2 ? "#ffb703" : "#a8c2e8"}
            />

            <span>2. Criança</span>
          </div>
        </div>
      </footer>
    </main>
  );
}