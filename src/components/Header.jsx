import { formatMoney } from "../utils/money";

function Header({ peopleCount, totalBalance, onHome }) {
  return (
    <section className="top-bar">
      <button className="brand-home" type="button" onClick={onHome}>
        <span className="eyebrow">Kodai trip</span>
      </button>
      <div className="stats">
        <span>{peopleCount} people</span>
        <span>Rs {formatMoney(totalBalance)} balance</span>
      </div>
    </section>
  );
}

export default Header;
