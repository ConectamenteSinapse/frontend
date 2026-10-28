import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  Pencil,
  Star,
  Home,
  CheckCircle2,
  Clock,
  Circle,
  Gamepad2,
  LogOut,
  ChevronRight,
  Check,
} from "lucide-react";

import api from "../services/api";
import styles from "../styles/Perfil.module.css";

export default function Perfil({ nomeUtilizador = "Lorenzo" }) {
  const router = useRouter();

  const [dadosCrianca, setDadosCrianca] = useState(null);
  const [dadosUsuario, setDadosUsuario] = useState(null);
  const [resumoDesempenho, setResumoDesempenho] = useState(null);
  const [comodos, setComodos] = useState([]);
  const [tarefasConcluidasPorComodo, setTarefasConcluidasPorComodo] =
    useState({});
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregarPerfil() {
      try {
        const respostaCrianca = await api.get("/criancas/meu-perfil");
        const crianca = respostaCrianca.data;

        setDadosCrianca(crianca);

        const usuarioId = crianca.usuarioId;

        const [respostaResumo, respostaUsuario, respostaComodos] =
          await Promise.all([
            api.get(`/criancas/${usuarioId}/resumo-desempenho`),
            api.get("/usuarios/meu-perfil"),
            api.get("/comodos"),
          ]);

        setResumoDesempenho(respostaResumo.data.resumo);
        setDadosUsuario(respostaUsuario.data);

        // Ordenar os cômodos pela ordem cadastrada no banco.
        
        const dadosComodos = respostaComodos.data;

        const listaRecebida = Array.isArray(dadosComodos)
          ? dadosComodos
          : Array.isArray(dadosComodos.comodos)
            ? dadosComodos.comodos
            : [];

        const listaComodos = listaRecebida
          .filter((comodo) => comodo.ativo !== false)
          .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        console.log("Cômodos recebidos da API:", dadosComodos);
        console.log("Cômodos exibidos no perfil:", listaComodos);

        setComodos(listaComodos);


        // Buscar as tarefas e identificar as que foram acertadas.
        const tarefasPorComodo = {};

        await Promise.all(
          listaComodos.map(async (comodo) => {
            try {
              const respostaTarefas = await api.get(
                `/comodos/${comodo._id}/tarefas`
              );

              
        const dadosTarefas = respostaTarefas.data;

        const listaTarefas = Array.isArray(dadosTarefas)
          ? dadosTarefas
          : Array.isArray(dadosTarefas.tarefas)
            ? dadosTarefas.tarefas
            : [];

        const tarefas = listaTarefas.filter(
          (tarefa) => tarefa.ativo !== false
        );


              const idsTarefas = tarefas.map((tarefa) =>
                String(tarefa._id)
              );

              const tarefasAcertadas = respostaResumo.data.desempenhoPorComodo
                ?.find(
                  (item) =>
                    String(item.comodoId) === String(comodo._id)
                )
                ?.tarefasConcluidas;

              tarefasPorComodo[comodo._id] = {
                total: idsTarefas.length,
                concluidas: tarefasAcertadas ?? 0,
              };
            } catch (error) {
              console.error(
                `Erro ao carregar tarefas do cômodo ${comodo.nome}:`,
                error
              );

              tarefasPorComodo[comodo._id] = {
                total: 0,
                concluidas: 0,
              };
            }
          })
        );

        setTarefasConcluidasPorComodo(tarefasPorComodo);
      } catch (error) {
        console.error("Erro ao carregar perfil:", error);

        setErro(
          error.response?.data?.mensagem ||
            "Não foi possível carregar o perfil da criança."
        );
      } finally {
        setCarregando(false);
      }
    }

    carregarPerfil();
  }, []);

  const nomeExibido = dadosUsuario?.nome || nomeUtilizador;

  const totalEstrelas = resumoDesempenho?.totalEstrelas ?? 0;

  const totalComodos = comodos.length;

  const comodosConcluidos = comodos.filter((comodo) => {
    const progresso = tarefasConcluidasPorComodo[comodo._id];

    return (
      progresso &&
      progresso.total > 0 &&
      progresso.concluidas >= progresso.total
    );
  }).length;

  if (carregando) {
    return <p>Carregando perfil...</p>;
  }

  return (
    <main className={styles.pagina}>
      {erro && (
        <p role="alert" style={{ color: "red" }}>
          {erro}
        </p>
      )}

      <header className={styles.cabecalhoTopo}>
        <button
          type="button"
          onClick={() => router.push("/menu")}
          className={styles.botaoVoltar}
          aria-label="Voltar"
        >
          <img
            src="/images/majesticons_share.png"
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

      <div className={styles.painelPrincipal}>
        <div className={styles.colunaEsquerda}>
          <div className={styles.cardUsuario}>
            <div className={styles.avatarMiniContainer}>
              <img
                src="/images/avatar.png"
                alt={`Avatar ${nomeExibido}`}
                className={styles.avatarMini}
              />
            </div>

            <div className={styles.infoUsuario}>
              <h2 className={styles.nomeUsuario}>{nomeExibido}</h2>

              <div className={styles.linhaBadges}>
                <span className={styles.badgeNivel}>Nível 12</span>

                <div className={styles.badgeEstrelas}>
                  <Star size={16} color="#ffb703" fill="#ffb703" />
                  <span>{totalEstrelas} estrelas</span>
                </div>
              </div>
            </div>

            <button type="button" className={styles.botaoEditar}>
              <Pencil size={18} color="#0052cc" />
              <span>Editar</span>
            </button>
          </div>

          <div className={styles.cardEstrelas}>
            <div className={styles.cabecalhoEstrelas}>
              <div className={styles.tituloEstrelas}>
                <Star size={28} color="#ffb703" fill="#ffb703" />
                <h3>Suas Estrelas</h3>
              </div>

              <span className={styles.fracaoEstrelas}>
                {totalEstrelas} estrelas
              </span>
            </div>

            <div className={styles.containerBarraEstrelas}>
              <div className={styles.barraEstrelasFundo}>
                <div
                  className={styles.barraEstrelasPreenchimento}
                  style={{
                    width: `${Math.min(totalEstrelas, 100)}%`,
                  }}
                />
              </div>

              <span className={styles.porcentagemTexto}>
                {Math.min(totalEstrelas, 100)}%
              </span>
            </div>

            <p className={styles.subtextoRecompensa}>
              Próxima recompensa: 100 estrelas
            </p>
          </div>

          <div className={styles.cartaoTempo}>
            <div className={styles.tituloTempo}>
              <h2>Tempo de Uso</h2>
            </div>

            <p className={styles.tempoUtilizado}>
              {dadosCrianca?.tempoUsadoHoje ?? 0} min utilizados
            </p>

            <p className={styles.limiteTempo}>
              Limite diário:{" "}
              {dadosCrianca?.limiteTempoDiario != null
                ? `${dadosCrianca.limiteTempoDiario} min`
                : "Não definido"}
            </p>
          </div>

          <div className={styles.cardComodos}>
            <div className={styles.cabecalhoComodos}>
              <div className={styles.tituloComodos}>
                <Home size={26} color="#0052cc" fill="#0052cc" />
                <h3>Cômodos Concluídos</h3>
              </div>

              <span className={styles.statusComodosTexto}>
                {comodosConcluidos} de {totalComodos} concluídos
              </span>
            </div>

            <div className={styles.gridComodos}>
              {comodos.map((comodo) => {
                const progresso =
                  tarefasConcluidasPorComodo[comodo._id];

                const totalTarefas = progresso?.total ?? 0;
                const concluidas = progresso?.concluidas ?? 0;

                const concluido =
                  totalTarefas > 0 && concluidas >= totalTarefas;

                const emAndamento = concluidas > 0 && !concluido;

                const status = concluido
                  ? "Concluído"
                  : emAndamento
                    ? "Em andamento"
                    : "Não iniciado";

                const tipoStatus = concluido
                  ? "concluido"
                  : emAndamento
                    ? "andamento"
                    : "nao_iniciado";

                // Mantém as imagens temporárias que já estavam no perfil.
                const imagensTemporarias = [
                  "/images/fundo.png",
                  "/images/fundo2.png",
                  "/images/fundo3.png",
                  "/images/menina1.png",
                  "/images/menina2.png",
                ];

                const imagem =
                  comodo.imagemCenario ||
                  imagensTemporarias[comodo.ordem - 1] ||
                  "/images/fundo.png";

                return (
                  <div
                    key={comodo._id}
                    className={`${styles.itemComodo} ${styles[tipoStatus]}`}
                  >
                    <div className={styles.imagemComodoContainer}>
                      <img
                        src={imagem.startsWith("/") ? imagem : `/${imagem}`}
                        alt={comodo.nome}
                        className={styles.imgComodo}
                      />
                    </div>

                    <span className={styles.nomeComodo}>
                      {comodo.nome}
                    </span>

                    <div className={styles.statusBadge}>
                      {concluido && (
                        <>
                          <CheckCircle2 size={14} color="#2e7d32" />
                          <span>{status}</span>
                        </>
                      )}

                      {emAndamento && (
                        <>
                          <Clock size={14} color="#ed6c02" />
                          <span>{status}</span>
                        </>
                      )}

                      {!concluido && !emAndamento && (
                        <>
                          <Circle size={14} color="#757575" />
                          <span>{status}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className={styles.colunaDireita}>
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

          <button
            type="button"
            className={styles.cardAcao}
            onClick={() => router.push("/jogos-salvos")}
          >
            <div className={styles.esquerdaAcao}>
              <Gamepad2 size={22} color="#0052cc" />
              <span>Jogos Salvos</span>
            </div>
            <ChevronRight size={20} color="#0052cc" />
          </button>

          <button
            type="button"
            className={styles.cardAcao}
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("usuario");
              router.push("/");
            }}
          >
            <div className={styles.esquerdaAcao}>
              <LogOut size={22} color="#0052cc" />
              <span>Sair da Conta</span>
            </div>
            <ChevronRight size={20} color="#0052cc" />
          </button>

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
