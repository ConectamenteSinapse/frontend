
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import HomeMenu from "../components/HomeMenu";
import api from "../services/api";

export default function PaginaMenu() {
  const router = useRouter();
  const [nomeUtilizador, setNomeUtilizador] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const buscarPerfil = async () => {
      try {
        const usuarioSalvo = localStorage.getItem("usuario");

        if (!usuarioSalvo || !localStorage.getItem("token")) {
          router.replace("/login");
          return;
        }

        const usuario = JSON.parse(usuarioSalvo);

        // O menu de jogo é destinado à criança.
        if (usuario.perfil !== "crianca") {
          router.replace("/responsavel");
          return;
        }

        const resposta = await api.get("/usuarios/meu-perfil");

        setNomeUtilizador(resposta.data.nome || usuario.nome || "");
      } catch (error) {
        console.error(
          "Erro ao buscar perfil:",
          error.response?.data || error.message
        );
        setErro("Não foi possível carregar seu perfil.");
      } finally {
        setCarregando(false);
      }
    };

    buscarPerfil();
  }, [router]);

  if (carregando) {
    return <p>Carregando...</p>;
  }

  if (erro) {
    return <p>{erro}</p>;
  }

  return <HomeMenu nomeUtilizador={nomeUtilizador} />;
}
