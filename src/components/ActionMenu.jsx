function ActionMenu({ activeView, onOpenExpenses, onOpenVisiting, onOpenFood }) {
  return (
    <section className="action-strip" aria-label="Trip actions">
      <button
        className={`menu-option ${activeView === "expenses" ? "is-active" : ""}`}
        type="button"
        onClick={onOpenExpenses}
      >
        Overall Cost & Expense
      </button>
      <button
        className={`menu-option ${activeView === "visiting" ? "is-active" : ""}`}
        type="button"
        onClick={onOpenVisiting}
      >
        Visiting places
      </button>
      <button
        className={`menu-option ${activeView === "food" ? "is-active" : ""}`}
        type="button"
        onClick={onOpenFood}
      >
        Food Expense
      </button>
    </section>
  );
}

export default ActionMenu;
