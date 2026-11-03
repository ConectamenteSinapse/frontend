import { Volume2 } from "lucide-react";
import styles from "./RespostaCard.module.css";
export default function RespostaCard({
  texto,
  imagem,
  audio,
  onReproduzirAudio,
  onSelecionar,
  disabled = false,
}) {
  function reproduzirAudio(event) {
    event.stopPropagation();

    if (!audio) return;
    if (onReproduzirAudio) {
      onReproduzirAudio(audio);
      return;
    }

    const som = new Audio(audio);
    som.play().catch((erro) => {
      console.error("Erro ao reproduzir áudio:", erro);
    });
  }

    return (
    <div className={styles.card}>
        <button
        type="button"
        className={styles.selecao}
        disabled={disabled}
        onClick={onSelecionar}
        aria-label={`Selecionar: ${texto}`}
        >
        <img
            className={styles.imagem}
            src={imagem}
            alt=""
        />

        <span className={styles.texto}>
            {texto}
        </span>
        </button>

        <button
        type="button"
        className={styles.audio}
        onClick={reproduzirAudio}
        disabled={!audio}
        aria-label={`Ouvir alternativa: ${texto}`}
        >
        <Volume2 size={24} aria-hidden="true" />
        </button>
    </div>
    );
}
