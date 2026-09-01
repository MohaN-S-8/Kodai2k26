function ActionMenu({ activeView, onOpenExpenses, onOpenVisiting }) {
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
    </section>
  );
}

export default ActionMenu;
