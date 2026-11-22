import logo from "../../assets/bilim-nuru.webp";
import styles from "./Brand.module.scss";

export function Brand({ variant = "compact" }) {
  const cover = variant === "cover";
  return (
    <div className={cover ? styles.cover : styles.brand}>
      <img className={styles.logo} src={logo} alt={cover ? "Билим Нуру" : ""} />
      {!cover && <span>Билим Нуру</span>}
    </div>
  );
}
