
import Head from "next/head";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import styles from "./Detalhes.module.css";
import { useRouter } from "next/router";
import api from "../../../services/api";

export default function Detalhes() {
  const router = useRouter();
  const { id } = router.query;
  const idAtualRef = useRef(id);
  idAtualRef.current = id;
  const versaoSelecaoRef = useRef(0);
  const [modal, setModal] = useState("");
  const [limite, setLimite] = useState(150);
  const [ativa, setAtiva] = useState(true);
  const [crianca, setCrianca] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  
useEffect(() => {
    versaoSelecaoRef.current += 1;

    if (!router.isReady || !id) return;

    let consultaAtiva = true;

    async function buscarCrianca() {
      setCrianca(null);
      setModal("");
      setSalvando(false);
      setCarregando(true);
      setErro(null);

      const token = localStorage.getItem("token");

      if (!token?.trim()) {
        setCarregando(false);
        router.replace("/");
        return;
      }

      try {
        const resposta = await api.get(
          "/responsaveis/minhas-criancas"
        );

        if (!consultaAtiva) return;

        const encontrada = resposta.data.find(
          (item) => String(item.usuarioId) === String(id)
        );

        if (!encontrada) {
          setErro("Criança não encontrada entre as contas vinculadas.");
          return;
        }

        setCrianca(encontrada);
        setAtiva(encontrada.permissaoAtiva);
        setLimite(encontrada.limiteTempoDiario ?? "");
      } catch (erro) {
        if (!consultaAtiva) return;

        if (erro.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          setCrianca(null);
          router.replace("/");
          return;
        }

        setErro(
          erro.response?.data?.mensagem ||
            "Não foi possível carregar os dados da criança."
        );
      } finally {
        if (consultaAtiva) {
          setCarregando(false);
        }
      }
    }

    buscarCrianca();

    return () => {
      consultaAtiva = false;
      versaoSelecaoRef.current += 1;
    };
  }, [router.isReady, router.replace, id]);


  async function confirmarExclusao() {
    if (salvando) return;

    if (!crianca?._id) {
      alert("Não foi possível identificar a criança.");
      return;
    }

    if (!localStorage.getItem("token")?.trim()) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      router.replace("/");
      return;
    }

    const idDaOperacao = String(id);
    const versaoDaOperacao = versaoSelecaoRef.current;

    setSalvando(true);

    try {
      await api.delete(
        `/responsaveis/minhas-criancas/${crianca._id}/vinculo`
      );

      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) {
        return;
      }

      setModal("");
      alert("Criança desvinculada com sucesso.");
      router.push("/responsavel/contas");
    } catch (erro) {
      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) {
        return;
      }
      if (erro.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      setModal("");
      setCrianca(null);
      router.replace("/");
      return;
      }
      console.error("Erro ao desvincular criança:", erro.response?.status);

      alert(
        erro.response?.data?.mensagem ||
          "Não foi possível desvincular a criança."
      );
    } finally {
      if (
        String(idAtualRef.current) === idDaOperacao &&
        versaoSelecaoRef.current === versaoDaOperacao
      ) {
        setSalvando(false);
      }
    }
  }

  async function salvarLimite() {
    if (salvando) return;

    if (!crianca?._id) {
      alert("Não foi possível identificar a criança.");
      return;
    }

    if (!localStorage.getItem("token")?.trim()) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      router.replace("/");
      return;
    }

    const limiteNumerico = Number(limite);

    if (!Number.isInteger(limiteNumerico) || limiteNumerico < 1) {
      alert("Informe um limite válido em minutos.");
      return;
    }

    const idDaOperacao = String(id);
    const versaoDaOperacao = versaoSelecaoRef.current;

    setSalvando(true);

    try {
      const resposta = await api.patch(
        `/responsaveis/minhas-criancas/${crianca._id}/limite-tempo`,
        {
          limiteTempoDiario: limiteNumerico,
        }
      );

      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) {
        return;
      }

      setLimite(resposta.data.limiteTempoDiario);

      setCrianca((anterior) => ({
        ...anterior,
        limiteTempoDiario: resposta.data.limiteTempoDiario,
      }));

      setModal("");
      alert("Limite diário atualizado com sucesso.");
    } catch (erro) {
      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) {
        return;
      }

      if (erro.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("usuario");
        setModal("");
        setCrianca(null);
        router.replace("/");
        return;
      }

      console.error(
        "Erro ao atualizar limite:",
        erro.response?.status
      );

      alert(
        erro.response?.data?.mensagem ||
          "Não foi possível atualizar o limite diário."
      );
    } finally {
      if (
        String(idAtualRef.current) === idDaOperacao &&
        versaoSelecaoRef.current === versaoDaOperacao
      ) {
        setSalvando(false);
      }
    }
  }
  async function removerLimite() {
    if (salvando) return;

    if (!crianca?._id) {
      alert("Não foi possível identificar a criança.");
      return;
    }

    if (!localStorage.getItem("token")?.trim()) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      router.replace("/");
      return;
    }

    const idDaOperacao = String(id);
    const versaoDaOperacao = versaoSelecaoRef.current;

    setSalvando(true);

    try {
      const resposta = await api.patch(
        `/responsaveis/minhas-criancas/${crianca._id}/limite-tempo`,
        {
          limiteTempoDiario: null,
        }
      );

      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) {
        return;
      }

      setLimite("");

      setCrianca((anterior) => ({
        ...anterior,
        limiteTempoDiario: resposta.data.limiteTempoDiario,
      }));

      setModal("");
      alert("Limite diário removido com sucesso.");
    } catch (erro) {
      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) {
        return;
      }
      if (erro.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      setModal("");
      setCrianca(null);
      router.replace("/");
      return;
      }
      console.error("Erro ao remover limite:", erro.response?.status);

      alert(
        erro.response?.data?.mensagem ||
          "Não foi possível remover o limite diário."
      );
    } finally {
      if (
        String(idAtualRef.current) === idDaOperacao &&
        versaoSelecaoRef.current === versaoDaOperacao
      ) {
        setSalvando(false);
      }
    }
  }
  async function alternarConta() {
    if (salvando) return;

    if (!crianca?._id) {
      alert("Não foi possível identificar a criança.");
      return;
    }

    if (!localStorage.getItem("token")?.trim()) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      router.replace("/");
      return;
    }
    const idDaOperacao = String(id);
    const versaoDaOperacao = versaoSelecaoRef.current;
    const novaPermissao = !ativa;
    setSalvando(true);
    try {
      await api.patch(
        `/responsaveis/minhas-criancas/${crianca._id}/permissao`,
        {
          permissaoAtiva: novaPermissao,
        }
      );
      if (String(idAtualRef.current) !== idDaOperacao || versaoSelecaoRef.current !== versaoDaOperacao) return;
      setAtiva(novaPermissao);
      setCrianca((anterior) => ({
        ...anterior,
        permissaoAtiva: novaPermissao,
      }));
      setModal("");
    } catch (erro) {
      if (
        String(idAtualRef.current) !== idDaOperacao ||
        versaoSelecaoRef.current !== versaoDaOperacao
      ) return;
      if (erro.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      setModal("");
      setCrianca(null);
      router.replace("/");
      return;
      }
      console.error("Erro ao alterar permissão:", erro.response?.status);

      alert(
        erro.response?.data?.mensagem ||
        "Não foi possível alterar a permissão da criança."
      );
    } finally {
      if (
        String(idAtualRef.current) === idDaOperacao &&
        versaoSelecaoRef.current === versaoDaOperacao
      ) {
        setSalvando(false);
      }
    }
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
          {carregando && <p>Carregando dados da criança...</p>}
          {erro && <p role="alert">{erro}</p>}
          {crianca && (
            <div className={styles.perfil}>
              <img
                src="/images/Perfil.png"
                alt={`Avatar de ${crianca.nome}`}
                className={styles.avatar}
              />

              <h1>{crianca.nome}</h1>
              <p>{crianca.email}</p>

              <p className={styles.status}>
                Permissão para jogar: {ativa ? "Ativa" : "Desativada"}
              </p>
            </div>
          )}
          {crianca && (
            <div className={styles.acoes}>
              <button
                type="button"
                className={styles.botao}
                onClick={() => {
                  if (!salvando) setModal("limite");
                }}
                disabled={salvando}
              >
                Limite de tempo por dia
              </button>

            <button
              type="button"
              className={styles.botao}
              onClick={() => {
                if (!salvando) setModal("desativar");
              }}
              disabled={salvando}
            >
              {ativa ? "Bloquear jogo" : "Liberar jogo"}
            </button>

            <button
              type="button"
              className={`${styles.botao} ${styles.excluir}`}
              onClick={() => {
                if (!salvando) setModal("excluir");
              }}
              disabled={salvando}
            >
              Desvincular Criança
            </button>
            </div>
          )}
        </section>

        {modal && (
          <div
            className={styles.fundoModal}
            onClick={() => {
              if (!salvando) setModal("");
            }}
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
                disabled={salvando}
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

                  <div className={styles.botoesModal}>
                    <button
                      type="button"
                      className={styles.cancelar}
                      onClick={removerLimite}
                      disabled={salvando}
                    >
                      {salvando ? "Processando..." : "Remover limite"}
                    </button>

                    <button
                      type="button"
                      className={styles.confirmar}
                      onClick={salvarLimite}
                      disabled={salvando}
                    >
                      {salvando ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                </>
              )}

              {modal === "desativar" && (
                <>
                  <h2>
                    {ativa ? "Bloquear acesso ao jogo?" : "Liberar acesso ao jogo?"}
                  </h2>

                  <p>
                    {ativa
                      ? "A criança ficará impedida de jogar até que o acesso seja liberado novamente."
                      : "A criança poderá voltar a jogar, respeitando o limite diário de tempo configurado."}
                  </p>

                  <div className={styles.botoesModal}>
                    <button
                      type="button"
                      className={styles.cancelar}
                      onClick={() => setModal("")}
                      disabled={salvando}
                    >
                      Cancelar
                    </button>

                    <button
                    type="button"
                    className={styles.confirmar}
                    onClick={alternarConta}
                    disabled={salvando}
                  >
                    {salvando ? "Salvando..." : "Confirmar"}
                  </button>
                  </div>
                </>
              )}

              {modal === "excluir" && (
                <>
                  <h2>Desvincular criança?</h2>

                  <p>
                    Deseja remover esta criança das suas contas vinculadas?
                    A conta e o histórico da criança serão preservados.
                  </p>

                  <div className={styles.botoesModal}>
                    <button
                      type="button"
                      className={styles.cancelar}
                      onClick={() => setModal("")}
                      disabled={salvando}
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      className={styles.excluir}
                      onClick={confirmarExclusao}
                      disabled={salvando}
                    >
                      {salvando ? "Desvinculando..." : "Desvincular"}
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
