import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import socket from "../services/socket";
import ConfirmModal from "./ConfirmModal";

const POLL_MS = 4000;

export default function Chat({ project }) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState([]);
  const [menuIndex, setMenuIndex] = useState(null);
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirm, setConfirm] = useState({ open: false, messageId: null });
  const previousProjectId = useRef(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const roomId = project?._id || "global";

  const getSenderName = message => {
    if (!message) return "Member";
    if (typeof message.sender === "string" && message.sender.trim()) {
      return message.sender.trim();
    }
    const senderObj = message.senderId && typeof message.senderId === "object"
      ? message.senderId
      : null;
    if (senderObj) {
      return senderObj.name || senderObj.email || "Member";
    }
    if (message.senderId) return String(message.senderId);
    return "Member";
  };

  const isOwnMessage = message => {
    if (!message || !user?.id) return false;
    const senderId =
      typeof message.senderId === "object" && message.senderId
        ? message.senderId._id
        : message.senderId;
    return String(senderId) === String(user.id);
  };

  const getSeenUsers = message => {
    if (!message || !Array.isArray(message.seenBy)) return [];
    return message.seenBy.filter(seen => {
      const id =
        typeof seen === "object" && seen ? seen._id || seen.id : seen;
      return String(id) !== String(user?.id);
    });
  };

  const markSeen = async () => {
    try {
      await api.post(`/messages/${roomId}/seen`);
    } catch (err) {}
  };

  useEffect(() => {
    let cancelled = false;
    let pollId = null;

    if (previousProjectId.current && previousProjectId.current !== roomId) {
      socket.emit("leaveProject", previousProjectId.current);
    }
    previousProjectId.current = roomId;
    setMessages([]);
    setMenuIndex(null);
    setEditingMessageId(null);
    setEditText("");

    const loadMessages = async () => {
      try {
        const res = await api.get(`/messages/${roomId}`);
        if (!cancelled) setMessages(res.data);
        if (!cancelled) await markSeen();
      } catch (err) {}
    };

    loadMessages();
    socket.emit("joinProject", roomId);

    const startPolling = () => {
      if (!pollId) pollId = setInterval(loadMessages, POLL_MS);
    };
    const stopPolling = () => {
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    if (socket.connected) {
      stopPolling();
    } else {
      startPolling();
    }

    const onCreated = message => {
      setMessages(prev => (prev.some(m => m._id === message._id) ? prev : [...prev, message]));
      if (!isOwnMessage(message)) markSeen();
    };
    const onUpdated = message => {
      setMessages(prev => prev.map(m => (m._id === message._id ? message : m)));
    };
    const onDeleted = payload => {
      setMessages(prev => prev.filter(m => m._id !== payload._id));
    };

    const onConnect = () => stopPolling();
    const onDisconnect = () => startPolling();

    socket.on("message:created", onCreated);
    socket.on("message:updated", onUpdated);
    socket.on("message:deleted", onDeleted);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      socket.off("message:created", onCreated);
      socket.off("message:updated", onUpdated);
      socket.off("message:deleted", onDeleted);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [roomId]);

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
      const res = await api.post(`/messages/${roomId}`, {
        text: msg
      });
      setMessages(prev =>
        prev.some(m => m._id === res.data._id) ? prev : [...prev, res.data]
      );
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
          <div
            key={m._id || i}
            className={`chat-row ${isOwnMessage(m) ? "own" : ""}`}
          >
            <div className={`chat-bubble ${isOwnMessage(m) ? "own" : ""}`}>
              <span className="chat-sender">
                {isOwnMessage(m) ? "You" : getSenderName(m)}
              </span>
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
              {isOwnMessage(m) ? (
                <span
                  className="chat-receipt"
                  title={getSeenUsers(m).map(u => u.name || u.email || "Member").join(", ")}
                >
                  {(() => {
                    const seenUsers = getSeenUsers(m);
                    if (seenUsers.length === 0) return "Sent";
                    const names = seenUsers.map(u => u.name || u.email || "Member");
                    const preview = names.slice(0, 2).join(", ");
                    return names.length > 2
                      ? `Seen by ${preview} +${names.length - 2}`
                      : `Seen by ${preview}`;
                  })()}
                </span>
              ) : null}

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
