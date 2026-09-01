import { useEffect, useState } from "react";

function NamePromptModal({ error, onClose, onSubmit }) {
  const [name, setName] = useState("");

  useEffect(() => {
    setName("");
  }, []);

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit(name);
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="name-modal" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Verify enemy</p>
          <h2>Enter your sheet name</h2>
        </div>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Example: Mohan"
          aria-label="Your name in the trip sheet"
        />
        {error && <p className="modal-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Show Balance</button>
        </div>
      </form>
    </div>
  );
}

export default NamePromptModal;
