import { useEffect, useState } from "react";
import HomeMenu from "../components/HomeMenu";
import api from "../services/api";

export default function PaginaMenu() {
  const [nomeUtilizador, setNomeUtilizador] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const buscarPerfil = async () => {
      try {
        const resposta = await api.get("/usuarios/meu-perfil");

        setNomeUtilizador(resposta.data.nome || "");
      } catch (error) {
        console.error("Erro ao buscar usuário:", error);
        setErro("Não foi possível carregar seu perfil.");
      } finally {
        setCarregando(false);
      }
    };

    buscarPerfil();
  }, []);

  if (carregando) {
    return <p>Carregando...</p>;
  }

  if (erro) {
    return <p>{erro}</p>;
  }

  return <HomeMenu nomeUtilizador={nomeUtilizador} />;
}
