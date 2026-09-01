function ActionMenu({ isActive, onOpenExpenses }) {
  return (
    <section className="action-strip" aria-label="Trip actions">
      <button
        className={`menu-option ${isActive ? "is-active" : ""}`}
        type="button"
        onClick={onOpenExpenses}
      >
        Overall Cost & Expense
      </button>
    </section>
  );
}

export default ActionMenu;
