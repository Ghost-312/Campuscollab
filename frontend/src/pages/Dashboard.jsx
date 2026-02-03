import { useEffect, useState } from "react";
import api from "../services/api";
import Chat from "../components/Chat";
import ConfirmModal from "../components/ConfirmModal";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [taskText, setTaskText] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null, label: "" });
  const [projectMenuOpen, setProjectMenuOpen] = useState(null);
  const [taskMenuOpen, setTaskMenuOpen] = useState(null);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const handleClick = e => {
      if (!e.target.closest(".kebab")) {
        setProjectMenuOpen(null);
        setTaskMenuOpen(null);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const loadProjects = async () => {
    const res = await api.get("/projects");
    setProjects(res.data);
  };

  const createProject = async () => {
    if (!title.trim()) return;
    await api.post("/projects", { title, description: desc });
    setTitle("");
    setDesc("");
    loadProjects();
  };

  const startEditProject = project => {
    setEditingProjectId(project._id);
    setEditTitle(project.title);
    setEditDesc(project.description || "");
  };

  const saveProject = async () => {
    if (!editTitle.trim()) return;
    const res = await api.put(`/projects/${editingProjectId}`, {
      title: editTitle,
      description: editDesc
    });
    setProjects(projects.map(p => (p._id === editingProjectId ? res.data : p)));
    if (selected?._id === editingProjectId) setSelected(res.data);
    setEditingProjectId(null);
    setEditTitle("");
    setEditDesc("");
    setProjectMenuOpen(null);
  };

  const deleteProject = async id => {
    await api.delete(`/projects/${id}`);
    setProjects(projects.filter(p => p._id !== id));
    if (selected?._id === id) {
      setSelected(null);
      setTasks([]);
    }
  };

  const selectProject = async project => {
    setSelected(project);
    const res = await api.get(`/tasks/${project._id}`);
    setTasks(res.data);
  };

  const addTask = async () => {
    if (!taskText.trim() || !selected) return;
    const res = await api.post(`/tasks/${selected._id}`, {
      text: taskText
    });
    setTasks([...tasks, res.data]);
    setTaskText("");
  };

  const startEditTask = task => {
    setEditingTaskId(task._id);
    setEditTaskText(task.text);
  };

  const saveTask = async () => {
    if (!editTaskText.trim()) return;
    const res = await api.put(`/tasks/${editingTaskId}`, { text: editTaskText });
    setTasks(tasks.map(t => (t._id === editingTaskId ? res.data : t)));
    setEditingTaskId(null);
    setEditTaskText("");
    setTaskMenuOpen(null);
  };

  const updateStatus = async (id, status) => {
    const res = await api.put(`/tasks/${id}`, { status });
    setTasks(tasks.map(t => (t._id === id ? res.data : t)));
  };

  const deleteTask = async id => {
    await api.delete(`/tasks/${id}`);
    setTasks(tasks.filter(t => t._id !== id));
  };

  const requestDeleteProject = project => {
    setConfirm({
      open: true,
      kind: "project",
      id: project._id,
      label: project.title
    });
  };

  const requestDeleteTask = task => {
    setConfirm({
      open: true,
      kind: "task",
      id: task._id,
      label: task.text
    });
  };

  const handleConfirmDelete = async () => {
    if (confirm.kind === "project") {
      await deleteProject(confirm.id);
    }
    if (confirm.kind === "task") {
      await deleteTask(confirm.id);
    }
    setConfirm({ open: false, kind: null, id: null, label: "" });
  };

  return (
    <div className="app-bg">
      <div className="main-container grid">

        {/* LEFT SIDE */}
        <div className="stack">
          <div className="card card-create">
            <div className="section-title">
              <span className="icon-badge">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M12 3l9 6-9 6-9-6 9-6Z M3 15l9 6 9-6"
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3>Create Project</h3>
                <p className="section-subtitle">Start a new workspace for your team</p>
              </div>
            </div>
            <input
              placeholder="Project Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <input
              placeholder="Project Description"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <button className="primary-btn" onClick={createProject}>
              Create
            </button>
          </div>

          <div className="card card-projects">
            <div className="section-title">
              <span className="icon-badge">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 6h16M4 12h10M4 18h14"
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3>Your Projects</h3>
                <p className="section-subtitle">Manage, edit, or remove projects</p>
              </div>
            </div>
            {projects.map(p => (
              <div
                key={p._id}
                className={`project-card ${
                  selected?._id === p._id ? "active" : ""
                }`}
                onClick={() => selectProject(p)}
              >
                {editingProjectId === p._id ? (
                  <>
                    <input
                      className="edit-input"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="Project Title"
                    />
                    <input
                      className="edit-input"
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      onClick={e => e.stopPropagation()}
                      placeholder="Project Description"
                    />
                    <div className="action-row" onClick={e => e.stopPropagation()}>
                      <button className="success-btn" onClick={saveProject}>
                        Save
                      </button>
                      <button
                        className="ghost-btn"
                        onClick={() => setEditingProjectId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{p.title}</strong>
                    <p>{p.description}</p>
                    <div className="inline-actions" onClick={e => e.stopPropagation()}>
                      <div className="kebab inline">
                        <span
                          onClick={() =>
                            setProjectMenuOpen(projectMenuOpen === p._id ? null : p._id)
                          }
                        >
                          ...
                        </span>
                        {projectMenuOpen === p._id && (
                          <div className="kebab-menu">
                            <button onClick={() => startEditProject(p)}>
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
                            <button onClick={() => requestDeleteProject(p)}>
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
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT SIDE */}
        {selected && (
          <div className="stack">
            <div className="card card-summary">
              <div className="section-title">
                <span className="icon-badge">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 6h16v12H4z M8 10h8"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3>{selected.title}</h3>
                  <p className="section-subtitle">{selected.description}</p>
                </div>
              </div>
            </div>

            <div className="card card-tasks">
              <div className="section-title">
                <span className="icon-badge">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 7h16M4 12h12M4 17h8"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3>Tasks</h3>
                  <p className="section-subtitle">Plan, track, and complete work</p>
                </div>
              </div>
              <div className="task-input">
                <input
                  placeholder="Add new task"
                  value={taskText}
                  onChange={e => setTaskText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") addTask();
                  }}
                />
                <button className="success-btn" onClick={addTask}>
                  Add
                </button>
              </div>

              {tasks.map(task => (
                <div
                  key={task._id}
                  className={`task-card ${
                    task.status === "Completed"
                      ? "task-completed"
                      : task.status === "In-Progress"
                      ? "task-inprogress"
                      : "task-todo"
                  }`}
                >
                  {editingTaskId === task._id ? (
                    <input
                      className="edit-input"
                      value={editTaskText}
                      onChange={e => setEditTaskText(e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className={`task-name ${
                        task.status === "Completed" ? "task-done" : ""
                      }`}
                    >
                      {task.text}
                    </span>
                  )}

                  <select
                    value={task.status}
                    onChange={e =>
                      updateStatus(task._id, e.target.value)
                    }
                  >
                    <option value="To-Do">To-Do</option>
                    <option value="In-Progress">In-Progress</option>
                    <option value="Completed">Completed</option>
                  </select>

                  {editingTaskId === task._id ? (
                    <>
                      <button className="success-btn" onClick={saveTask}>
                        Save
                      </button>
                      <button
                        className="ghost-btn"
                        onClick={() => setEditingTaskId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <div className="kebab inline">
                      <span
                        onClick={() =>
                          setTaskMenuOpen(taskMenuOpen === task._id ? null : task._id)
                        }
                      >
                        ...
                      </span>
                      {taskMenuOpen === task._id && (
                        <div className="kebab-menu">
                          <button onClick={() => startEditTask(task)}>
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
                          <button onClick={() => requestDeleteTask(task)}>
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
            </div>

            <div className="card card-chat">
              <div className="section-title">
                <span className="icon-badge">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 6h16v10H7l-3 3V6z"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3>Chat</h3>
                  <p className="section-subtitle">Coordinate with your team</p>
                </div>
              </div>
              <Chat project={selected} />
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirm.open}
        title={confirm.kind === "project" ? "Delete Project" : "Delete Task"}
        message={
          confirm.kind === "project"
            ? `Delete project "${confirm.label}"? This cannot be undone.`
            : `Delete task "${confirm.label}"? This cannot be undone.`
        }
        confirmText="Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirm({ open: false, kind: null, id: null, label: "" })}
      />
    </div>
  );
}
