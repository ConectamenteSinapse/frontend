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

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  
function handleLogin(event) {
  event.preventDefault();

  // Direcionamento temporário para testar as telas
  const perfil = window.prompt(
    "Escolha o perfil para testar:\n1 - Responsável\n2 - Criança"
  );

  if (perfil === "1") {
    router.push("/responsavel");
  } else if (perfil === "2") {
    router.push("/menu");
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

            <button className={styles.botaoEntrar} type="submit">
              <span>Entrar</span>
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