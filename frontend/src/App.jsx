import React, { useEffect, useRef, useState } from "react";
import "./App.css";

// list of style options for rephrasing the input
// keeping them in an array so it's easy to add/remove without touching the rest of the code
const WRITING_STYLES = [
  { key: "professional", label: "Professional" },
  { key: "casual", label: "Casual" },
  { key: "polite", label: "Polite" },
  { key: "social", label: "Social-media" },
];

// base URL for backend API
// can be changed via .env file - falls back to localhost for local dev
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// utility to copy text to clipboard and provide a tiny UX ack
const copyToClipboard = async (txt) => {
  try {
    await navigator.clipboard.writeText(txt || "");
  } catch {}
};

// main component for getting user input, flagging if processing, and storing output for each style
export default function App() {
  const [userInputText, setText] = useState(""); // user-entered text
  const [processing, setProcessing] = useState(false); // flag for whether processing is active
  const [outputs, setOutputs] = useState(
    WRITING_STYLES.reduce((acc, s) => ({ ...acc, [s.key]: "" }), {})
  ); // holds the rephrased text for each style

  // store the session id and EventSource so we can cancel or clean up later
  const activeSessionIdRef = useRef(null);
  const eventSourceConnectionRef = useRef(null);

  // keep refs for output textareas so we can auto-resize on every stream update
  const textareaRefs = useRef({});

  // clean up the SSE connection when leaving the page
  useEffect(() => {
    return () => {
      try {
        eventSourceConnectionRef.current?.close();
      } catch {}
    };
  }, []);

  // resize all output textareas to fit content whenever outputs change
  useEffect(() => {
    WRITING_STYLES.forEach(({ key }) => {
      const ta = textareaRefs.current[key];
      if (!ta) return;
      ta.style.height = "auto";
      ta.style.height = ta.scrollHeight + "px";
    });
  }, [outputs]);

  const clearAllOutputs = () => {
    // reset all style boxes without touching the input
    setOutputs(WRITING_STYLES.reduce((acc, s) => ({ ...acc, [s.key]: "" }), {}));
  };

  const startProcessing = async () => {
    // don't run if text is empty or already running
    if (!userInputText.trim() || processing) return;

    // reset outputs and disable input while job is running
    setProcessing(true);
    clearAllOutputs();

    // start the backend job
    try {
      const resp = await fetch(`${API_BASE}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: userInputText }), // backend expects key 'text'
      });
      if (!resp.ok) throw new Error("Failed to start processing");

      // get the session id back from server
      const { session_id } = await resp.json();
      activeSessionIdRef.current = session_id;

      // open a server-sent events stream for live updates
      const es = new EventSource(`${API_BASE}/stream?session=${session_id}`);
      eventSourceConnectionRef.current = es;

      // handle incoming messages from the backend
      es.onmessage = (e) => {
        try {
          const serverMessage = JSON.parse(e.data);

          // if the job finished or was canceled, stop listening
          if (serverMessage.cancelled || serverMessage.done) {
            setProcessing(false);
            es.close();
            return;
          }

          // if server sends an error for a specific style, append it
          if (serverMessage.error && serverMessage.style) {
            setOutputs((prev) => ({
              ...prev,
              [serverMessage.style]:
                prev[serverMessage.style] + `\n\n[ERROR] ${serverMessage.error}`,
            }));
            return;
          }

          // destructure the style and chunk from the server
          const { style, delta } = serverMessage; // backend sends 'delta' for streamed text

          // ignore if event is missing required fields
          if (!style || !delta) return;

          // append the incoming chunk to the right style's output
          setOutputs((prev) => ({ ...prev, [style]: prev[style] + delta }));
        } catch (err) {
          console.error("Failed to parse SSE data:", err);
        }
      };

      // handle SSE connection errors
      es.onerror = () => {
        console.error("SSE connection error");
        setProcessing(false);
        try {
          es.close();
        } catch {}
      };
    } catch (err) {
      console.error("Processing error:", err);
      setProcessing(false);
    }
  };

  // function for cancel button
  const cancelProcessing = async () => {
    const currentSessionId = activeSessionIdRef.current;
    if (!currentSessionId) return;

    try {
      // tell backend to cancel the job
      const resp = await fetch(`${API_BASE}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: currentSessionId }),
      });
      if (!resp.ok) throw new Error("Failed to cancel processing");
    } catch (err) {
      console.error("Cancel error:", err);
    } finally {
      try {
        eventSourceConnectionRef.current?.close();
      } catch {}
      setProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card-container" role="region" aria-label="AI writing assistant">
        <h1 className="section-title">AI Writing Assistant</h1>
        <div className="section-subtitle">
          Rephrase text into multiple tones. Streamed output, cancel anytime.
        </div>

        {/* small toolbar for actions and status */}
        <div className="toolbar">
          <button
            onClick={startProcessing}
            disabled={processing}
            className="primary-button"
          >
            {processing ? "Processing…" : "Process"}
          </button>
          {processing && (
            <button onClick={cancelProcessing} className="cancel-button">
              Cancel Processing
            </button>
          )}
          <button onClick={clearAllOutputs} className="secondary-button">
            Clear All Styles
          </button>
          <button onClick={() => setText("")} className="secondary-button">
            Clear Input
          </button>

          {/* show status + char counter on the right */}
          <span className="counter">
            {userInputText.length.toLocaleString()} chars
          </span>
          <span className="status-pill" aria-live="polite">
            {processing ? "Streaming…" : "Idle"}
          </span>
        </div>

        <textarea
          rows={4}
          value={userInputText}
          disabled={processing}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type something to rephrase."
          className="input-textarea"
        />

        <div className="output-grid">
          {WRITING_STYLES.map(({ key, label }) => (
            <div key={key} className="output-section">
              <div className="output-header">
                <h3 className="output-title">{label}</h3>
                <div className="output-actions">
                  <button
                    className="small-button"
                    onClick={() => copyToClipboard(outputs[key])}
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    className="small-button"
                    onClick={() =>
                      setOutputs((prev) => ({ ...prev, [key]: "" }))
                    }
                    title="Clear this box"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <textarea
                ref={(el) => {
                  textareaRefs.current[key] = el || undefined;
                }}
                readOnly
                value={outputs[key]}
                className="input-textarea"
                style={{
                  height: "auto",
                  overflow: "hidden",
                }}
                aria-label={`${label} rephrased text`}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
