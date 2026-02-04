import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Chat from "../components/Chat";
import ConfirmModal from "../components/ConfirmModal";
import TaskPieChart from "../components/TaskPieChart";
import socket from "../services/socket";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projectDetails, setProjectDetails] = useState(null);
  const [members, setMembers] = useState([]);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [taskText, setTaskText] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskText, setEditTaskText] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [confirm, setConfirm] = useState({ open: false, kind: null, id: null, label: "" });
  const [projectMenuOpen, setProjectMenuOpen] = useState(null);
  const [taskMenuOpen, setTaskMenuOpen] = useState(null);
  const navigate = useNavigate();
  const previousProjectId = useRef(null);
  const [activities, setActivities] = useState([]);
  const [copyStatus, setCopyStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteEnabled, setInviteEnabled] = useState(true);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const isOwnerOrAdmin = project => {
    if (!project || !user?.id) return false;
    if (project.owner?._id && String(project.owner._id) === String(user.id)) return true;
    if (project.owner && String(project.owner) === String(user.id)) return true;
    return user.role === "admin";
  };

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      localStorage.setItem("pendingProjectCode", code.toUpperCase());
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    socket.connect();
    return () => {
      socket.disconnect();
    };
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

  useEffect(() => {
    const tryJoin = async () => {
      const code = localStorage.getItem("pendingProjectCode");
      if (!code) return;
      try {
        await api.post("/projects/join/code", { code });
        localStorage.removeItem("pendingProjectCode");
        loadProjects();
        setInviteStatus("Joined project");
        setTimeout(() => setInviteStatus(""), 2000);
      } catch (err) {
        setInviteStatus(err?.response?.data?.msg || "Join failed");
        setTimeout(() => setInviteStatus(""), 2000);
      }
    };
    tryJoin();
  }, []);

  const joinProject = async () => {
    if (!joinCode.trim()) return;
    await api.post("/projects/join/code", { code: joinCode.trim() });
    setJoinCode("");
    loadProjects();
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
      setProjectDetails(null);
      setMembers([]);
    }
  };

  const selectProject = async project => {
    setSelected(project);
    if (previousProjectId.current && previousProjectId.current !== project._id) {
      socket.emit("leaveProject", previousProjectId.current);
    }
    const [tasksRes, projectRes] = await Promise.all([
      api.get(`/tasks/${project._id}`),
      api.get(`/projects/${project._id}`)
    ]);
    setTasks(tasksRes.data);
    setProjectDetails(projectRes.data);
    setMembers(projectRes.data?.members || []);
    setInviteEnabled(projectRes.data?.inviteEnabled !== false);
    try {
      const activityRes = await api.get(`/tasks/activity/${project._id}`);
      setActivities(activityRes.data);
    } catch (err) {
      setActivities([]);
    }
    socket.emit("joinProject", project._id);
    previousProjectId.current = project._id;
  };

  const addTask = async () => {
    if (!taskText.trim() || !selected) return;
    const res = await api.post(`/tasks/${selected._id}`, {
      text: taskText,
      assignedTo: assignTo || null
    });
    setTasks(prev => (prev.some(t => t._id === res.data._id) ? prev : [...prev, res.data]));
    setTaskText("");
    setAssignTo("");
  };

  const startEditTask = task => {
    setEditingTaskId(task._id);
    setEditTaskText(task.text);
    setEditAssignedTo(task.assignedTo?._id || "");
  };

  const saveTask = async () => {
    if (!editTaskText.trim()) return;
    const res = await api.put(`/tasks/${editingTaskId}`, {
      text: editTaskText,
      assignedTo: editAssignedTo || null
    });
    setTasks(tasks.map(t => (t._id === editingTaskId ? res.data : t)));
    setEditingTaskId(null);
    setEditTaskText("");
    setEditAssignedTo("");
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

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  useEffect(() => {
    if (!selected) return;

    const onCreated = task => {
      setTasks(prev => (prev.some(t => t._id === task._id) ? prev : [...prev, task]));
    };
    const onUpdated = task => {
      setTasks(prev => prev.map(t => (t._id === task._id ? task : t)));
    };
    const onDeleted = payload => {
      setTasks(prev => prev.filter(t => t._id !== payload._id));
    };

    const onActivity = activity => {
      setActivities(prev => [activity, ...prev].slice(0, 50));
    };

    let pollId = null;
    const refreshTasks = async () => {
      try {
        const res = await api.get(`/tasks/${selected._id}`);
        setTasks(res.data);
      } catch (err) {}
    };
    const startPolling = () => {
      if (!pollId) pollId = setInterval(refreshTasks, 5000);
    };
    const stopPolling = () => {
      if (pollId) {
        clearInterval(pollId);
        pollId = null;
      }
    };

    socket.on("task:created", onCreated);
    socket.on("task:updated", onUpdated);
    socket.on("task:deleted", onDeleted);
    socket.on("activity:created", onActivity);
    socket.on("connect", stopPolling);
    socket.on("disconnect", startPolling);

    if (!socket.connected) startPolling();

    return () => {
      if (pollId) clearInterval(pollId);
      socket.off("task:created", onCreated);
      socket.off("task:updated", onUpdated);
      socket.off("task:deleted", onDeleted);
      socket.off("activity:created", onActivity);
      socket.off("connect", stopPolling);
      socket.off("disconnect", startPolling);
    };
  }, [selected]);

  const copyProjectCode = async () => {
    if (!selected?._id) return;
    try {
      const res = await api.post(`/projects/${selected._id}/invite`);
      const code = res.data?.code;
      if (code) {
        await navigator.clipboard.writeText(code);
        setCopyStatus("Copied!");
        setTimeout(() => setCopyStatus(""), 2000);
      }
    } catch (err) {
      setCopyStatus("Only admin/owner can invite");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  const inviteByEmail = async () => {
    if (!selected?._id || !inviteEmail.trim()) return;
    try {
      await api.post(`/projects/${selected._id}/invite/email`, {
        email: inviteEmail.trim()
      });
      setInviteStatus("Invite sent");
      setInviteEmail("");
      setTimeout(() => setInviteStatus(""), 2000);
    } catch (err) {
      setInviteStatus(err?.response?.data?.msg || "Invite failed");
      setTimeout(() => setInviteStatus(""), 2000);
    }
  };

  const toggleInvites = async next => {
    if (!selected?._id) return;
    try {
      const res = await api.post(`/projects/${selected._id}/invite/settings`, {
        inviteEnabled: next
      });
      setInviteEnabled(res.data.inviteEnabled);
      setInviteStatus(res.data.inviteEnabled ? "Invites enabled" : "Invites disabled");
      setTimeout(() => setInviteStatus(""), 2000);
    } catch (err) {
      setInviteStatus(err?.response?.data?.msg || "Update failed");
      setTimeout(() => setInviteStatus(""), 2000);
    }
  };

  const regenerateCode = async () => {
    if (!selected?._id) return;
    try {
      const res = await api.post(`/projects/${selected._id}/invite/regenerate`);
      setProjectDetails(prev => ({ ...prev, code: res.data.code }));
      setInviteStatus("New code generated");
      setTimeout(() => setInviteStatus(""), 2000);
    } catch (err) {
      setInviteStatus(err?.response?.data?.msg || "Regenerate failed");
      setTimeout(() => setInviteStatus(""), 2000);
    }
  };

  return (
    <div className="app-bg">
      <div className="top-bar">
        <h2>Campus Collab</h2>
        <button className="ghost-btn" onClick={logout}>
          Logout
        </button>
      </div>
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

          <div className="card card-create">
            <div className="section-title">
              <span className="icon-badge">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M4 12h16M12 4v16"
                    stroke="currentColor"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div>
                <h3>Join Project</h3>
                <p className="section-subtitle">Enter a project code to join</p>
              </div>
            </div>
            <input
              placeholder="Project Code"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
            />
            <button className="primary-btn" onClick={joinProject}>
              Join
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
                        {isOwnerOrAdmin(p) && (
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
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
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
                <p className="section-subtitle">Global chat for all members</p>
              </div>
            </div>
            <Chat project={null} />
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
                  {projectDetails?.code && isOwnerOrAdmin(projectDetails) && (
                    <div className="code-row">
                      <span className="section-subtitle">Project Code: {projectDetails.code}</span>
                      <button className="ghost-btn" onClick={copyProjectCode}>
                        Copy Code
                      </button>
                      {copyStatus && <span className="copy-status">{copyStatus}</span>}
                    </div>
                  )}
                  {isOwnerOrAdmin(projectDetails) && (
                    <div className="invite-row">
                      <input
                        placeholder="Invite by email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                      />
                      <button className="primary-btn" onClick={inviteByEmail}>
                        Send Invite
                      </button>
                      {inviteStatus && <span className="copy-status">{inviteStatus}</span>}
                    </div>
                  )}
                  {isOwnerOrAdmin(projectDetails) && (
                    <div className="invite-row">
                      <button
                        className="ghost-btn"
                        onClick={() => toggleInvites(!inviteEnabled)}
                      >
                        {inviteEnabled ? "Disable Invites" : "Enable Invites"}
                      </button>
                      <button className="ghost-btn" onClick={regenerateCode}>
                        Regenerate Code
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {members.length > 0 && (
                <div className="member-list">
                  <h4>Team Members</h4>
                  {members.map(m => (
                    <div key={m._id} className="member-pill">
                      {m.name} {m.role ? `(${m.role})` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card card-summary">
              <div className="section-title">
                <span className="icon-badge">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M4 20h16M6 16l4-6 4 3 4-6"
                      stroke="currentColor"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h3>Task Progress</h3>
                  <p className="section-subtitle">Completion by status</p>
                </div>
              </div>
              <TaskPieChart tasks={tasks} />
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
                <select
                  value={assignTo}
                  onChange={e => setAssignTo(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {members.map(m => (
                    <option key={m._id} value={m._id}>
                      {m.name}
                    </option>
                  ))}
                </select>
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
                    <>
                      <input
                        className="edit-input"
                        value={editTaskText}
                        onChange={e => setEditTaskText(e.target.value)}
                        onClick={e => e.stopPropagation()}
                      />
                      <select
                        value={editAssignedTo}
                        onChange={e => setEditAssignedTo(e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {members.map(m => (
                          <option key={m._id} value={m._id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span
                      className={`task-name ${
                        task.status === "Completed" ? "task-done" : ""
                      }`}
                    >
                      {task.text}
                      {task.assignedTo?.name ? (
                        <span className="task-assignee"> • {task.assignedTo.name}</span>
                      ) : null}
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
                        <div
                          className="kebab-menu"
                          onMouseLeave={() => setTaskMenuOpen(null)}
                        >
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
                          {isOwnerOrAdmin(projectDetails) && (
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
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="card card-summary">
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
                  <h3>Recent Activity</h3>
                  <p className="section-subtitle">Team changes and updates</p>
                </div>
              </div>
              <div className="activity-list">
                {activities.length === 0 && (
                  <p className="section-subtitle">No activity yet.</p>
                )}
                {activities.map(a => (
                  <div key={a._id} className="activity-row">
                    <div className="activity-main">
                      <strong>{a.user?.name || a.user?.email || "Member"}</strong>{" "}
                      {a.action === "created" && "created a task"}
                      {a.action === "deleted" && "deleted a task"}
                      {a.action === "status_changed" && "changed status"}
                      {a.action === "assignee_changed" && "changed assignee"}
                      {a.task?.text ? `: ${a.task.text}` : ""}
                      {a.action === "status_changed" && a.toStatus
                        ? ` → ${a.toStatus}`
                        : ""}
                      {a.action === "assignee_changed" && a.toAssignee?.name
                        ? ` → ${a.toAssignee.name}`
                        : ""}
                    </div>
                    <div className="activity-time">
                      {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
                    </div>
                  </div>
                ))}
              </div>
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
