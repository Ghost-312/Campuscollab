import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import ConfirmModal from "./ConfirmModal";

const POLL_MS = 3000;

export default function Chat({ project }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [menuIndex, setMenuIndex] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirm, setConfirm] = useState({ open: false, messageId: null });
  const previousProjectId = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;

    if (previousProjectId.current && previousProjectId.current !== project._id) {
      // Project changed, clear prior state before loading new messages.
    }
    previousProjectId.current = project._id;
    setMessages([]);
    setMenuIndex(null);
    setEditingMessageId(null);
    setEditText("");

    const loadMessages = async () => {
      try {
        const res = await api.get(`/messages/${project._id}`);
        if (!cancelled) setMessages(res.data);
      } catch (err) {}
    };

    loadMessages();
    pollRef.current = setInterval(loadMessages, POLL_MS);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [project]);

  useEffect(() => {
    const handleClick = e => {
      if (!e.target.closest(".kebab")) {
        setMenuIndex(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const send = async () => {
    if (!msg.trim()) return;
    try {
      const res = await api.post(`/messages/${project._id}`, {
        text: msg,
        sender: "You"
      });
      setMessages(prev => [...prev, res.data]);
      setMsg("");
    } catch (err) {}
  };

  const startEdit = message => {
    setEditingMessageId(message._id);
    setEditText(message.text || "");
    setMenuIndex(null);
  };

  const saveEdit = async () => {
    if (!editText.trim() || !editingMessageId) return;
    try {
      const res = await api.put(`/messages/${editingMessageId}`, {
        text: editText
      });
      if (res.data) {
        setMessages(prev => prev.map(m => (m._id === res.data._id ? res.data : m)));
      }
      setEditingMessageId(null);
      setEditText("");
    } catch (err) {}
  };

  const confirmDelete = messageId => {
    setConfirm({ open: true, messageId });
    setMenuIndex(null);
  };

  const deleteMsg = async () => {
    if (!confirm.messageId) return;
    try {
      await api.delete(`/messages/${confirm.messageId}`);
      setMessages(prev => prev.filter(m => m._id !== confirm.messageId));
    } catch (err) {}
    setConfirm({ open: false, messageId: null });
  };

  return (
    <div className="chat-box">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={m._id || i} className="chat-row">
            <div className="chat-bubble">
              <span className="chat-sender">{m.sender}</span>
              {editingMessageId === m._id ? (
                <input
                  className="edit-input"
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                />
              ) : (
                <p>
                  {m.text} {m.edited ? <span className="chat-time">Edited</span> : null}
                </p>
              )}
              <span className="chat-time">
                {m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : m.time}
              </span>

              <div className="kebab">
                <span onClick={() => setMenuIndex(menuIndex === i ? null : i)}>...</span>
                {menuIndex === i && (
                  <div className="kebab-menu">
                    <button onClick={() => startEdit(m)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="menu-icon">
                        <path
                          d="M4 20h4l10-10-4-4L4 16v4Z"
                          stroke="currentColor"
                          fill="none"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Edit
                    </button>
                    <button onClick={() => confirmDelete(m._id)}>
                      <svg viewBox="0 0 24 24" aria-hidden="true" className="menu-icon">
                        <path
                          d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12"
                          stroke="currentColor"
                          fill="none"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={msg}
          onChange={e => setMsg(e.target.value)}
          placeholder="Type message..."
          onKeyDown={e => {
            if (e.key === "Enter") send();
          }}
        />
        {editingMessageId !== null ? (
          <>
            <button className="success-btn" onClick={saveEdit}>
              Save
            </button>
            <button className="ghost-btn" onClick={() => setEditingMessageId(null)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="icon-btn" onClick={send}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12L20 4L13 20L11 13L4 12Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Send
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirm.open}
        title="Delete Message"
        message="This message will be permanently removed. Continue?"
        confirmText="Delete"
        onConfirm={deleteMsg}
        onCancel={() => setConfirm({ open: false, messageId: null })}
      />
    </div>
  );
}
