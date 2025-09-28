// src/components/TaskPanel.jsx
import React, { useEffect, useState } from "react";

/**
 * TaskPanel
 * Props:
 * - task: full task object (see "Scenario format" in server)
 * - onClose: () => void
 * - onSubmit: (payload: any) => void   // payload = { choice } for MCQ, { text } for freeform
 */
export default function TaskPanel({ task, onClose, onSubmit }) {
  const [text, setText] = useState("");
  const [choice, setChoice] = useState(null);

  useEffect(() => {
    setText("");
    setChoice(null);
  }, [task?.id]);

  if (!task) return null;

  const isMCQ = task.type === "mcq";
  const minWords = task?.answer?.minWords || 0;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const canSubmit = isMCQ ? !!choice : wordCount >= minWords;

  return (
    <div className="taskpanel">
      <div className="taskpanel__hdr">
        <div className="taskpanel__title">{task.title}</div>
        <button className="btn btn--ghost" onClick={onClose} aria-label="Close task">✕</button>
      </div>

      <div className="taskpanel__body">
        {task.prompt && <div className="taskpanel__prompt">{task.prompt}</div>}

        {/* Asset */}
        {task.type === "image_troubleshoot" && task.asset?.url && (
          <div className="taskpanel__asset">
            <img src={task.asset.url} alt={task.asset.alt || ""} className="taskpanel__img" />
          </div>
        )}
        {task.type === "doc_review" && task.asset?.url && (
          <iframe
            title="doc"
            src={task.asset.url}
            className="taskpanel__doc"
          />
        )}

        {/* Answer */}
        {isMCQ ? (
          <div className="taskpanel__mcq">
            {task.choices?.map((c) => (
              <label key={c.key} className="taskpanel__radio">
                <input
                  type="radio"
                  name={`mcq-${task.id}`}
                  value={c.key}
                  onChange={() => setChoice(c.key)}
                />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="taskpanel__freeform">
            <textarea
              className="composer__input"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                minWords ? `Type your answer (≥${minWords} words)…` : "Type your answer…"
              }
            />
            {minWords > 0 && (
              <div className={`taskpanel__wc ${wordCount >= minWords ? "ok" : ""}`}>
                {wordCount}/{minWords} words
              </div>
            )}
          </div>
        )}

        <div className="taskpanel__actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${canSubmit ? "btn--primary" : "btn--disabled"}`}
            disabled={!canSubmit}
            onClick={() => onSubmit(isMCQ ? { choice } : { text })}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
