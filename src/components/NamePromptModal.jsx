import { useEffect, useId, useState } from "react";

function NamePromptModal({
  error,
  eyebrow = "Verify urself",
  names = [],
  submitLabel = "Show Balance",
  title = "Select your name",
  onClose,
  onSubmit,
}) {
  const [name, setName] = useState("");
  const namesListId = useId();

  useEffect(() => {
    setName("");
  }, [names]);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(name);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="name-modal" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <input
          autoFocus
          list={namesListId}
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Type or select name"
          aria-label="Your name in the trip sheet"
        />
        <datalist id={namesListId}>
          {names.map((nameOption) => (
            <option key={nameOption} value={nameOption} />
          ))}
        </datalist>
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()}>{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export default NamePromptModal;
