import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import api from "../services/api";
import ConfirmModal from "./ConfirmModal";

const socket = io("http://localhost:5000", {
  auth: { token: localStorage.getItem("token") }
});

export default function Chat({ project }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [menuIndex, setMenuIndex] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirm, setConfirm] = useState({ open: false, messageId: null });
  const previousProjectId = useRef(null);

  useEffect(() => {
    if (!project) return;

    if (previousProjectId.current && previousProjectId.current !== project._id) {
      socket.emit("leaveProject", previousProjectId.current);
    }
    previousProjectId.current = project._id;
    setMessages([]);
    setMenuIndex(null);
    setEditingMessageId(null);
    setEditText("");

    socket.emit("joinProject", project._id);

    const loadMessages = async () => {
      const res = await api.get(`/messages/${project._id}`);
      setMessages(res.data);
    };

    loadMessages();

    const handleMessage = data => {
      setMessages(prev => [...prev, data]);
    };
    const handleEdit = data => {
      setMessages(prev => prev.map(m => (m._id === data._id ? data : m)));
    };
    const handleDelete = data => {
      setMessages(prev => prev.filter(m => m._id !== data.messageId));
    };

    socket.on("chatMessage", handleMessage);
    socket.on("editMessage", handleEdit);
    socket.on("deleteMessage", handleDelete);

    return () => {
      socket.off("chatMessage", handleMessage);
      socket.off("editMessage", handleEdit);
      socket.off("deleteMessage", handleDelete);
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

  const send = () => {
    if (!msg.trim()) return;
    socket.emit("chatMessage", {
      projectId: project._id,
      text: msg,
      sender: "You"
    });
    setMsg("");
  };

  const startEdit = message => {
    setEditingMessageId(message._id);
    setEditText(message.text || "");
    setMenuIndex(null);
  };

  const saveEdit = () => {
    if (!editText.trim() || !editingMessageId) return;
    socket.emit("editMessage", {
      projectId: project._id,
      messageId: editingMessageId,
      text: editText
    });
    setEditingMessageId(null);
    setEditText("");
  };

  const confirmDelete = messageId => {
    setConfirm({ open: true, messageId });
    setMenuIndex(null);
  };

  const deleteMsg = () => {
    if (!confirm.messageId) return;
    socket.emit("deleteMessage", {
      projectId: project._id,
      messageId: confirm.messageId
    });
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
