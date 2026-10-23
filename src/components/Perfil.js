import React from "react";
import { useRouter } from "next/router";
import {
  Pencil,
  Star,
  Home,
  CheckCircle2,
  Clock,
  Circle,
  Shirt,
  Gamepad2,
  LogOut,
  ChevronRight,
  Check,
} from "lucide-react";
import styles from "../styles/Perfil.module.css";

export default function Perfil({ nomeUtilizador = "Lorenzo" }) {
  const router = useRouter();

  const comodos = [
    {
      id: "quarto",
      nome: "Quarto",
      status: "Concluído",
      tipoStatus: "concluido",
      imagem: "/images/quarto.png",
    },
    {
      id: "banheiro",
      nome: "Banheiro",
      status: "Concluído",
      tipoStatus: "concluido",
      imagem: "/images/banheiro.png",
    },
    {
      id: "sala",
      nome: "Sala",
      status: "Concluído",
      tipoStatus: "concluido",
      imagem: "/images/sala.png",
    },
    {
      id: "cozinha",
      nome: "Cozinha",
      status: "Em andamento",
      tipoStatus: "andamento",
      imagem: "/images/cozinha.png",
    },
    {
      id: "extras",
      nome: "Extras",
      status: "Não iniciado",
      tipoStatus: "nao_iniciado",
      imagem: "/images/extras.png",
    },
  ];

  return (
    <main className={styles.pagina}>
      {/* Topo: seta à esquerda, título no centro, logo à direita */}
      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={() => router.push("/menu")}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img
            src="/images/seta.png"
            alt=""
            className={styles.iconeVoltar}
          />
        </button>

        <h1 className={styles.tituloTopo}>Perfil</h1>

        <div className={styles.conteudoAzul}>
          <img
            src="/images/logo.png"
            alt="Logo ConectaMente"
            className={styles.logo}
          />
        </div>
      </header>

      {/* Painel Branco Principal */}
      <div className={styles.painelPrincipal}>
        {/* COLUNA ESQUERDA */}
        <div className={styles.colunaEsquerda}>
          {/* Card do Utilizador */}
          <div className={styles.cardUsuario}>
            <div className={styles.avatarMiniContainer}>
              <img
                src="/images/avatar.png"
                alt={`Avatar ${nomeUtilizador}`}
                className={styles.avatarMini}
              />
            </div>

            <div className={styles.infoUsuario}>
              <h2 className={styles.nomeUsuario}>{nomeUtilizador}</h2>
              <div className={styles.linhaBadges}>
                <span className={styles.badgeNivel}>Nível 12</span>
                <div className={styles.badgeEstrelas}>
                  <Star size={16} color="#ffb703" fill="#ffb703" />
                  <span>78 estrelas</span>
                </div>
              </div>
            </div>

            <button type="button" className={styles.botaoEditar}>
              <Pencil size={18} color="#0052cc" />
              <span>Editar</span>
            </button>
          </div>

          {/* Card Suas Estrelas */}
          <div className={styles.cardEstrelas}>
            <div className={styles.cabecalhoEstrelas}>
              <div className={styles.tituloEstrelas}>
                <Star size={28} color="#ffb703" fill="#ffb703" />
                <h3>Suas Estrelas</h3>
              </div>
              <span className={styles.fracaoEstrelas}>78 de 100</span>
            </div>

            <div className={styles.containerBarraEstrelas}>
              <div className={styles.barraEstrelasFundo}>
                <div
                  className={styles.barraEstrelasPreenchimento}
                  style={{ width: "78%" }}
                />
              </div>
              <span className={styles.porcentagemTexto}>78%</span>
            </div>

            <p className={styles.subtextoRecompensa}>
              Próxima recompensa: 100 estrelas
            </p>
          </div>

          {/* Card Cômodos Concluídos */}
          <div className={styles.cardComodos}>
            <div className={styles.cabecalhoComodos}>
              <div className={styles.tituloComodos}>
                <Home size={26} color="#0052cc" fill="#0052cc" />
                <h3>Cômodos Concluídos</h3>
              </div>
              <span className={styles.statusComodosTexto}>
                3 de 5 concluídos
              </span>
            </div>

            <div className={styles.gridComodos}>
              {comodos.map(({ id, nome, status, tipoStatus, imagem }) => (
                <div
                  key={id}
                  className={`${styles.itemComodo} ${styles[tipoStatus]}`}
                >
                  <div className={styles.imagemComodoContainer}>
                    <img
                      src={imagem}
                      alt={nome}
                      className={styles.imgComodo}
                    />
                  </div>
                  <span className={styles.nomeComodo}>{nome}</span>

                  <div className={styles.statusBadge}>
                    {tipoStatus === "concluido" && (
                      <>
                        <CheckCircle2 size={14} color="#2e7d32" />
                        <span>{status}</span>
                      </>
                    )}
                    {tipoStatus === "andamento" && (
                      <>
                        <Clock size={14} color="#ed6c02" />
                        <span>{status}</span>
                      </>
                    )}
                    {tipoStatus === "nao_iniciado" && (
                      <>
                        <Circle size={14} color="#757575" />
                        <span>{status}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div className={styles.colunaDireita}>
          {/* Card Personagem */}
          <div className={styles.cardPersonagem}>
            <h3 className={styles.tituloPersonagem}>Seu Personagem</h3>

            <div className={styles.palcoPersonagem}>
              <img
                src="/images/boneco.png"
                alt="Personagem"
                className={styles.imgPersonagem}
              />
              <div className={styles.pedestal} />
            </div>

            <div className={styles.caixaTraje}>
              <span className={styles.rotuloTraje}>Traje atual</span>
              <strong className={styles.nomeTraje}>Clássico</strong>
            </div>
          </div>

          {/* Botões de Ação */}
          
          <button
            type="button"
            className={styles.cardAcao}
            onClick={() => router.push("/jogos-salvos")}
          >
            <div className={styles.esquerdaAcao}>
             <Gamepad2 size={22} color="#0052cc" />
              <span>jogos Salvos</span>
            </div>
            <ChevronRight size={20} color="#0052cc" />
          </button>
          <button
            type="button"
            className={styles.cardAcao}
            onClick={() => router.push("/")}
          >
            <div className={styles.esquerdaAcao}>
              <LogOut size={22} color="#0052cc" />
              <span>Sair da Conta</span>
            </div>
            <ChevronRight size={20} color="#0052cc" />
          </button>

          {/* Botão Salvar Alterações */}
          <button
            type="button"
            className={styles.botaoSalvar}
            onClick={() => router.push("/menu")}
          >
            <Check size={24} strokeWidth={3} />
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>
    </main>
  );
}