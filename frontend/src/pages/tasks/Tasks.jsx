import { useEffect, useState } from "react";
import api from "../../services/api";
import ConfirmModal from "../../components/ConfirmModal";

export default function Tasks({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [text, setText] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirm, setConfirm] = useState({ open: false, id: null, label: "" });
  const [taskMenuOpen, setTaskMenuOpen] = useState(null);

  useEffect(() => {
    api.get(`/tasks/${projectId}`).then(res => setTasks(res.data));
  }, [projectId]);

  useEffect(() => {
    const handleClick = e => {
      if (!e.target.closest(".kebab")) {
        setTaskMenuOpen(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const addTask = async () => {
    const res = await api.post(`/tasks/${projectId}`, { text });
    setTasks(prev => (prev.some(t => t._id === res.data._id) ? prev : [...prev, res.data]));
    setText("");
  };

  const startEditTask = task => {
    setEditingTaskId(task._id);
    setEditText(task.text);
  };

  const saveTask = async () => {
    if (!editText.trim()) return;
    const res = await api.put(`/tasks/${editingTaskId}`, { text: editText });
    setTasks(tasks.map(t => (t._id === editingTaskId ? res.data : t)));
    setEditingTaskId(null);
    setEditText("");
    setTaskMenuOpen(null);
  };

  const updateStatus = async (id, status) => {
    const res = await api.put(`/tasks/${id}`, { status });
    setTasks(tasks.map(t => t._id === id ? res.data : t));
  };

  const deleteTask = async id => {
    await api.delete(`/tasks/${id}`);
    setTasks(tasks.filter(t => t._id !== id));
  };

  const requestDelete = task => {
    setConfirm({ open: true, id: task._id, label: task.text });
  };

  const handleConfirmDelete = async () => {
    await deleteTask(confirm.id);
    setConfirm({ open: false, id: null, label: "" });
  };

  return (
    <div>
      <h3>Tasks</h3>

      <input
        placeholder="New Task"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") addTask();
        }}
      />
      <button className="success-btn" onClick={addTask}>
        Add
      </button>

      {tasks.map(t => (
        <div key={t._id} className="card">
          {editingTaskId === t._id ? (
            <input
              className="edit-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
            />
          ) : (
            <span>{t.text}</span>
          )}
          <select
            value={t.status}
            onChange={e => updateStatus(t._id, e.target.value)}
          >
            <option>To-Do</option>
            <option>In-Progress</option>
            <option>Completed</option>
          </select>
          {editingTaskId === t._id ? (
            <>
              <button className="success-btn" onClick={saveTask}>
                Save
              </button>
              <button className="ghost-btn" onClick={() => setEditingTaskId(null)}>
                Cancel
              </button>
            </>
          ) : (
            <div className="kebab inline">
              <span onClick={() => setTaskMenuOpen(taskMenuOpen === t._id ? null : t._id)}>
                ...
              </span>
              {taskMenuOpen === t._id && (
                <div
                  className="kebab-menu"
                  onMouseLeave={() => setTaskMenuOpen(null)}
                >
                  <button onClick={() => startEditTask(t)}>
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
                  <button onClick={() => requestDelete(t)}>
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
          )}
        </div>
      ))}

      <ConfirmModal
        open={confirm.open}
        title="Delete Task"
        message={`Delete task "${confirm.label}"? This cannot be undone.`}
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirm({ open: false, id: null, label: "" })}
      />
    </div>
  );
}
