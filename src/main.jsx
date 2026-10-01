import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const initialEmployees = [
  { id: 'nova', name: 'Nova', role: 'Researcher', color: 'coral', status: 'Working', task: 'Competitive scan', initials: 'N' },
  { id: 'atlas', name: 'Atlas', role: 'Operator', color: 'blue', status: 'Ready', task: 'Awaiting next brief', initials: 'A' },
  { id: 'pixel', name: 'Pixel', role: 'Creative', color: 'yellow', status: 'In review', task: 'Landing page concepts', initials: 'P' },
]

const navItems = [
  ['overview', 'Overview', '⌂'],
  ['employees', 'AI Employees', '✦'],
  ['tasks', 'Tasks', '✓'],
  ['playbooks', 'Playbooks', '▤'],
]

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

function App() {
  const [activeNav, setActiveNav] = useState('overview')
  const [employees, setEmployees] = useState(initialEmployees)
  const [tasks, setTasks] = useState([
    { id: 1, title: 'Summarize customer interview notes', owner: 'Nova', due: 'Today', status: 'In progress', tone: 'coral' },
    { id: 2, title: 'Draft Q4 launch checklist', owner: 'Atlas', due: 'Tomorrow', status: 'Queued', tone: 'blue' },
    { id: 3, title: 'Explore visual directions for homepage', owner: 'Pixel', due: 'Fri, Oct 4', status: 'Review', tone: 'yellow' },
  ])
  const [isTaskOpen, setTaskOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskOwner, setTaskOwner] = useState('Nova')
  const [notice, setNotice] = useState('')
  const [activeRun, setActiveRun] = useState(null)
  const [runEvents, setRunEvents] = useState([])
  const eventSource = useRef(null)
  const activeRunRef = useRef(null)

  const completeTask = (id) => {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status: 'Done' } : task))
    setNotice('Task marked done')
    window.setTimeout(() => setNotice(''), 2200)
  }

  const createTask = async (event) => {
    event.preventDefault()
    if (!taskTitle.trim()) return
    const title = taskTitle.trim()
    const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, owner: taskOwner }) })
    if (!response.ok) {
      setNotice('Could not start the demo worker')
      return
    }
    const created = await response.json()
    setTasks((current) => [{ id: created.id, title, owner: taskOwner, due: 'Now', status: 'Queued', tone: taskOwner === 'Nova' ? 'coral' : taskOwner === 'Atlas' ? 'blue' : 'yellow', progress: 0 }, ...current])
    subscribeToRun(created)
    setTaskTitle('')
    setTaskOpen(false)
    setNotice('Task sent to your AI Employee')
    window.setTimeout(() => setNotice(''), 2400)
  }

  const subscribeToRun = (run) => {
    eventSource.current?.close()
    const nextRun = { ...run, status: 'queued', progress: 0 }
    activeRunRef.current = nextRun
    setActiveRun(nextRun)
    setRunEvents([])
    const source = new EventSource(`/api/tasks/${run.id}/events`)
    eventSource.current = source
    source.onmessage = (message) => updateRun(JSON.parse(message.data))
    ;['ready', 'queued', 'planning', 'tool_call', 'observation', 'progress', 'completed', 'failed', 'cancelled'].forEach((type) => {
      source.addEventListener(type, (message) => updateRun(JSON.parse(message.data)))
    })
  }

  const updateRun = (event) => {
    setActiveRun((current) => {
      if (!current) return current
      const nextRun = { ...current, status: event.type, progress: event.progress ?? current.progress, message: event.message ?? current.message }
      activeRunRef.current = nextRun
      return nextRun
    })
    if (event.type !== 'ready') setRunEvents((current) => [{ ...event }, ...current].slice(0, 5))
    if (['completed', 'failed', 'cancelled'].includes(event.type)) {
      setTasks((current) => current.map((task) => task.id === activeRunRef.current?.id ? { ...task, status: event.type === 'completed' ? 'Done' : event.type === 'cancelled' ? 'Cancelled' : 'Failed', progress: event.progress ?? task.progress } : task))
      eventSource.current?.close()
    } else if (event.type !== 'ready') {
      setTasks((current) => current.map((task) => task.id === activeRunRef.current?.id ? { ...task, status: event.type === 'tool_call' ? 'Working' : 'In progress', progress: event.progress ?? task.progress } : task))
    }
  }

  const cancelRun = async () => {
    if (!activeRun) return
    await fetch(`/api/tasks/${activeRun.id}/cancel`, { method: 'POST' })
  }

  useEffect(() => () => eventSource.current?.close(), [])

  const toggleEmployee = (id) => {
    setEmployees((current) => current.map((employee) => employee.id === id
      ? { ...employee, status: employee.status === 'Paused' ? 'Ready' : 'Paused' }
      : employee))
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); setActiveNav('overview') }}>
          <span className="brand-mark"><span /><span /><span /></span>
          <span>orbit<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">AC</span>
          <span>Acme Co. <small>Workspace</small></span>
          <span className="chevron">⌄</span>
        </div>
        <div className="topbar-actions">
          <span className="usage"><span className="usage-dot" /> 12,420 credits left</span>
          <button className="icon-button" aria-label="Notifications"><Icon>♧</Icon><span className="notification-dot" /></button>
          <button className="profile-button" aria-label="Open profile menu">JL</button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <div className="side-label">Workspace</div>
          <nav aria-label="Main navigation">
            {navItems.map(([id, label, symbol]) => (
              <button key={id} className={`nav-item ${activeNav === id ? 'active' : ''}`} onClick={() => setActiveNav(id)}>
                <Icon>{symbol}</Icon><span>{label}</span>
                {id === 'tasks' && <span className="nav-count">{tasks.filter((task) => task.status !== 'Done').length}</span>}
              </button>
            ))}
          </nav>
          <div className="side-label side-label-spaced">Your space</div>
          <button className="nav-item"><Icon>＋</Icon><span>Invite teammate</span></button>
          <div className="sidebar-bottom">
            <div className="help-card">
              <span className="help-spark">✦</span>
              <strong>New to Orbit?</strong>
              <span>Take the 3-minute tour</span>
              <button>Start tour <span>→</span></button>
            </div>
            <button className="nav-item muted"><Icon>⚙</Icon><span>Settings</span></button>
          </div>
        </aside>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">Wednesday, October 2</p>
              <h1>Good morning, Jamie <span className="wave">✦</span></h1>
              <p className="heading-copy">Your AI team is on it. Here’s the pulse of your workspace.</p>
            </div>
            <button className="primary-button" onClick={() => setTaskOpen(true)}><span>＋</span> Create a task</button>
          </div>

          <section className="office-card" aria-labelledby="office-title">
            <div className="section-heading">
              <div><span className="live-pill"><span /> Live now</span><h2 id="office-title">The office</h2></div>
              <button className="text-button" onClick={() => setActiveNav('employees')}>View all employees <span>→</span></button>
            </div>
            <div className="office-scene">
              <div className="sun" />
              <div className="window window-one"><span /><span /><span /><span /></div>
              <div className="window window-two"><i /><i /><i /></div>
              <div className="cloud cloud-one" /><div className="cloud cloud-two" />
              <div className="shelf shelf-one"><span /><span /><span /></div>
              <div className="shelf shelf-two"><span /><span /></div>
              <div className="desk desk-left"><div className="monitor"><span /><b /></div><div className="plant" /><div className="desk-leg" /></div>
              <div className="desk desk-right"><div className="monitor monitor-small"><span /></div><div className="desk-leg" /></div>
              <div className="floor-line" />
              <div className="employee employee-nova"><div className="employee-head coral-head">N</div><span className="employee-body coral-body" /><span className="employee-label">Nova <i /></span></div>
              <div className="employee employee-atlas"><div className="employee-head blue-head">A</div><span className="employee-body blue-body" /><span className="employee-label">Atlas <i /></span></div>
              <div className="employee employee-pixel"><div className="employee-head yellow-head">P</div><span className="employee-body yellow-body" /><span className="employee-label">Pixel <i /></span></div>
              <div className="scene-note"><span>⌁</span> three minds, one mission</div>
            </div>
          </section>

          <section className="employees-section" aria-labelledby="employees-title">
            <div className="section-heading compact"><div><p className="eyebrow">Your team</p><h2 id="employees-title">AI Employees</h2></div><button className="text-button" onClick={() => setActiveNav('employees')}>Manage team <span>→</span></button></div>
            <div className="employee-grid">
              {employees.map((employee) => (
                <article className="employee-card" key={employee.id}>
                  <div className={`avatar ${employee.color}`}>{employee.initials}<span className={`presence ${employee.status === 'Paused' ? 'paused' : ''}`} /></div>
                  <div className="employee-info"><div className="card-title-row"><h3>{employee.name}</h3><span className={`status status-${employee.status.toLowerCase().replace(' ', '-')}`}>{employee.status}</span></div><p>{employee.role}</p><span className="employee-task"><Icon>↳</Icon>{employee.task}</span></div>
                  <button className="more-button" onClick={() => toggleEmployee(employee.id)} aria-label={`Pause or resume ${employee.name}`}>•••</button>
                </article>
              ))}
            </div>
          </section>

          <section className="tasks-section" aria-labelledby="tasks-title">
            <div className="section-heading compact"><div><p className="eyebrow">Keep things moving</p><h2 id="tasks-title">Current tasks</h2></div><button className="secondary-button" onClick={() => setTaskOpen(true)}>＋ Add task</button></div>
            <div className="task-table-wrap">
              <div className="task-table task-header"><span>Task</span><span>Assigned to</span><span>Due</span><span>Status</span><span /></div>
              {tasks.map((task) => (
                <div className={`task-table task-row ${task.status === 'Done' ? 'is-done' : ''}`} key={task.id}>
                  <div className="task-name"><button className="check-button" aria-label={`Mark ${task.title} done`} onClick={() => completeTask(task.id)}>{task.status === 'Done' ? '✓' : ''}</button><span>{task.title}</span></div>
                  <span className="assigned"><span className={`mini-avatar ${task.tone}`}>{task.owner[0]}</span>{task.owner}</span>
                  <span className="due">{task.due}</span>
                  <span className={`table-status status-${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</span>
                  <button className="row-more" aria-label={`More options for ${task.title}`}>•••</button>
                </div>
              ))}
            </div>
          </section>
        </main>

        <aside className="right-panel">
          <div className="right-panel-head"><div><p className="eyebrow">Your focus</p><h2>Current task</h2></div><button className="close-button" aria-label="Close current task">×</button></div>
          <div className="focus-card">
            <div className="focus-top"><span className="focus-icon">✦</span><span className="focus-status"><span /> {activeRun ? activeRun.status.replace('_', ' ') : 'In progress'}</span></div>
            <h3>{activeRun?.title || 'Summarize customer interview notes'}</h3>
            <p>{activeRun?.message || "Pull out the strongest insights and open questions from this week's calls."}</p>
            <div className="focus-owner"><div className="avatar coral small">N<span className="presence" /></div><div><strong>{activeRun?.owner || 'Nova'}</strong><span>Researcher</span></div><button className="more-button">•••</button></div>
            <div className="progress-label"><span>Progress</span><span>{activeRun?.progress ?? 68}%</span></div><div className="progress-track"><span style={{ width: `${activeRun?.progress ?? 68}%` }} /></div>
            {activeRun && !['completed', 'failed', 'cancelled'].includes(activeRun.status) ? <button className="outline-button" onClick={cancelRun}>Cancel run <span>×</span></button> : <button className="outline-button" onClick={() => setActiveNav('tasks')}>Open task <span>↗</span></button>}
          </div>
          <div className="activity-heading"><h3>Recent activity</h3><button className="text-button">See all</button></div>
          <div className="activity-list">
            {runEvents.map((event, index) => <div className="activity-item" key={`${event.timestamp}-${index}`}><span className={`activity-dot ${event.type === 'tool_call' ? 'blue' : event.type === 'completed' ? 'yellow' : 'coral'}`} /><p><strong>{event.type.replace('_', ' ')}</strong> · {event.message}<small>just now</small></p></div>)}
            <div className="activity-item"><span className="activity-dot coral" /><p><strong>Nova</strong> added a note to <b>Customer interview notes</b><small>12 min ago</small></p></div>
            <div className="activity-item"><span className="activity-dot blue" /><p><strong>Atlas</strong> started <b>Q4 launch checklist</b><small>48 min ago</small></p></div>
            <div className="activity-item"><span className="activity-dot yellow" /><p><strong>Pixel</strong> shared 3 new concepts<small>Yesterday</small></p></div>
          </div>
          <div className="tip-card"><span className="tip-spark">✦</span><div><strong>Quick tip</strong><p>Give your employees context, not just commands. They’ll surprise you.</p></div></div>
        </aside>
      </div>

      {isTaskOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && setTaskOpen(false)}><form className="task-modal" onSubmit={createTask}><button type="button" className="modal-close" onClick={() => setTaskOpen(false)} aria-label="Close">×</button><p className="eyebrow">New assignment</p><h2>What should your AI Employee take on?</h2><label htmlFor="task-title">Task description</label><textarea id="task-title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g. Pull together the customer feedback from last month" autoFocus /><label htmlFor="task-owner">Assign to</label><select id="task-owner" value={taskOwner} onChange={(e) => setTaskOwner(e.target.value)}>{employees.map((employee) => <option key={employee.id}>{employee.name}</option>)}</select><button className="primary-button modal-submit" type="submit">Send to {taskOwner} <span>→</span></button></form></div>}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
