
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import HomeMenu from "../components/HomeMenu";
import api from "../services/api";

export default function PaginaMenu() {
  const router = useRouter();
  const [nomeUtilizador, setNomeUtilizador] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [autorizado, setAutorizado] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const saidaRef = useRef(false);

  function sairDaConta() {
    if (saidaRef.current) return;
    saidaRef.current = true;
    setSaindo(true);
    setAutorizado(false);
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    router.replace("/");
  }

  useEffect(() => {
    if (saidaRef.current) return;
    let ativo = true;
    const buscarPerfil = async () => {
      try {
        const usuarioSalvo = localStorage.getItem("usuario");

        if (!usuarioSalvo || !localStorage.getItem("token")?.trim()) {
          router.replace("/");
          return;
        }

        const usuario = JSON.parse(usuarioSalvo);

        // O menu de jogo é destinado à criança.
        if (usuario.perfil !== "crianca") {
          router.replace("/responsavel");
          return;
        }

        const resposta = await api.get("/usuarios/meu-perfil");

        if (!ativo || saidaRef.current) return;
        setNomeUtilizador(resposta.data.nome || usuario.nome || "");
        setAutorizado(true);
      } catch (error) {
        if (!ativo || saidaRef.current) return;
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("usuario");
          router.replace("/");
          return;
        }
        console.error(
          "Erro ao buscar perfil:",
          error.response?.data || error.message
        );
        setErro("Não foi possível carregar seu perfil.");
      } finally {
        if (ativo && !saidaRef.current) setCarregando(false);
      }
    };

    buscarPerfil();
    return () => { ativo = false; };
  }, [router]);

  if (saindo) return <p role="status">Redirecionando para o login...</p>;

  if (carregando || (!autorizado && !erro)) {
    return <p>Carregando...</p>;
  }

  if (erro) {
    return <p>{erro}</p>;
  }

  return <HomeMenu nomeUtilizador={nomeUtilizador} onSairDaConta={sairDaConta} saindo={saindo} />;
}
