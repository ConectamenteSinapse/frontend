import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Brain,
  Heart,
  Star,
  ChartNoAxesCombined,
  Mail,
  LockKeyhole,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";

import styles from "../styles/Login.module.css";

import api from "../services/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  

async function handleLogin(event) {
  event.preventDefault();

  setErro("");
  setCarregando(true);

  try {
    const resposta = await api.post("/usuarios/auth", {
      email,
      senha,
    });

    const { token, usuario } = resposta.data;

    // Salvar o token e o perfil do usuário autenticado
    localStorage.setItem("token", token);
    localStorage.setItem("usuario", JSON.stringify(usuario));

    console.log("Perfil autenticado:", usuario.perfil);

    // Redirecionar de acordo com o perfil
    if (usuario.perfil === "responsavel") {
      router.push("/responsavel");
    } else if (usuario.perfil === "crianca") {
      router.push("/menu");
    } else {
      setErro("Perfil de usuário não reconhecido.");
    }
  } catch (error) {
    if (error.response) {
      setErro(
        error.response.data?.mensagem ||
          "Não foi possível realizar o login."
      );
    } else {
      setErro(
        "Não foi possível conectar ao servidor. Verifique se a API está funcionando."
      );
    }
  } finally {
    setCarregando(false);
  }
}



  const beneficios = [
    {
      Icone: Brain,
      titulo: <>Desenvolve<br />habilidades</>,
      classe: "azul",
    },
    {
      Icone: Heart,
      titulo: <>Estimula a<br />autonomia</>,
      classe: "amarelo",
    },
    {
      Icone: Star,
      titulo: <>Torna o aprendizado<br />mais divertido</>,
      classe: "verde",
    },
    {
      Icone: ChartNoAxesCombined,
      titulo: <>Construindo<br />grandes conquistas</>,
      classe: "roxo",
    },
  ];

  return (
    <main className={styles.pagina}>
      {/* LADO AZUL */}
      <section className={styles.painelAzul}>
        <div className={styles.decoracao} />

        <div className={styles.conteudoAzul}>
          <img
            src="/images/logo.png"
            alt="Logo ConectaMente"
            className={styles.logo}
          />

          <p className={styles.frase}>
            Mais que um jogo,
            <br />
            é um passo para o <strong>futuro!</strong>
          </p>

          <div className={styles.beneficios}>
            {beneficios.map(({ Icone, titulo, classe }, index) => (
              <div className={styles.beneficio} key={index}>
                <div
                  className={`${styles.iconeBeneficio} ${styles[classe]}`}
                >
                  <Icone size={29} strokeWidth={2.5} />
                </div>

                <p>{titulo}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LADO AMARELO */}
      <section className={styles.painelAmarelo}>
        <div className={styles.conteudoLogin}>
          <header className={styles.cabecalho}>
            <h1>Login</h1>
          </header>

          <form onSubmit={handleLogin} className={styles.formulario}>
            {erro && <p role="alert">{erro}</p>}

            <div className={styles.campo}>
              <div className={styles.iconeCampo}>
                <Mail size={30} />
              </div>

              <div className={styles.dadosCampo}>
                <label htmlFor="email">E-mail</label>
                <input
                  id="email"
                  type="email"
                  placeholder="lucas@gmail.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

          
            <div className={styles.campo}>
              <div className={styles.iconeCampo}>
                <LockKeyhole size={30} />
              </div>

              <div className={styles.dadosCampo}>
                <label htmlFor="senha">Senha</label>
                <input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  placeholder="**********"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  required
                />
              </div>

              <button
                type="button"
                className={styles.verSenha}
                onClick={() => setMostrarSenha(!mostrarSenha)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <Link href="/recuperar-senha" className={styles.esqueciSenha}>
              Esqueceu a senha?
            </Link>

            <button
              className={styles.botaoEntrar}
              type="submit"
              disabled={carregando}
            >
              <span>{carregando ? "Entrando..." : "Entrar"}</span>
              <ArrowRight size={32} strokeWidth={2.5} />
            </button>
          </form>

          <p className={styles.criarConta}>
            Não tem uma conta?{" "}
            <Link href="/cadastro">Criar conta</Link>
          </p>
        </div>
      </section>
    </main>
  );
}