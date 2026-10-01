import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const employees = [
  { id: 'nova', name: 'Nova', role: 'Researcher', tone: 'coral', initials: 'N', room: 'research' },
  { id: 'atlas', name: 'Atlas', role: 'Operator', tone: 'blue', initials: 'A', room: 'ops' },
  { id: 'pixel', name: 'Pixel', role: 'Creative', tone: 'yellow', initials: 'P', room: 'studio' },
]

const starterTasks = [
  { id: 1, title: 'Summarize customer interview notes', owner: 'Nova', due: 'Today', status: 'In progress', tone: 'coral', progress: 68 },
  { id: 2, title: 'Draft Q4 launch checklist', owner: 'Atlas', due: 'Tomorrow', status: 'Queued', tone: 'blue', progress: 0 },
  { id: 3, title: 'Explore visual directions for homepage', owner: 'Pixel', due: 'Fri, Oct 4', status: 'Review', tone: 'yellow', progress: 100 },
]

const navItems = [['overview', 'Overview', '⌂'], ['employees', 'AI Employees', '✦'], ['tasks', 'Tasks', '✓'], ['playbooks', 'Playbooks', '▤']]

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>
}

function App() {
  const [activeNav, setActiveNav] = useState('overview')
  const [tasks, setTasks] = useState(starterTasks)
  const [isTaskOpen, setTaskOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskOwner, setTaskOwner] = useState('Nova')
  const [notice, setNotice] = useState('')
  const [activeRun, setActiveRun] = useState(null)
  const [runEvents, setRunEvents] = useState([])
  const eventSource = useRef(null)
  const activeRunRef = useRef(null)

  const updateRun = (event) => {
    setActiveRun((current) => {
      if (!current) return current
      const nextRun = { ...current, status: event.type, progress: event.progress ?? current.progress, message: event.result || event.message || current.message, result: event.result || current.result }
      activeRunRef.current = nextRun
      return nextRun
    })
    if (event.type !== 'ready') setRunEvents((current) => [{ ...event }, ...current].slice(0, 6))
    if (['completed', 'failed', 'cancelled'].includes(event.type)) {
      setTasks((current) => current.map((task) => task.id === activeRunRef.current?.id ? { ...task, status: event.type === 'completed' ? 'Done' : event.type[0].toUpperCase() + event.type.slice(1), progress: event.progress ?? task.progress } : task))
      eventSource.current?.close()
    } else if (event.type !== 'ready') {
      setTasks((current) => current.map((task) => task.id === activeRunRef.current?.id ? { ...task, status: event.type === 'tool_call' ? 'Working' : 'In progress', progress: event.progress ?? task.progress } : task))
    }
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

  const createTask = async (event) => {
    event.preventDefault()
    if (!taskTitle.trim()) return
    const title = taskTitle.trim()
    const response = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, owner: taskOwner }) })
    if (!response.ok) {
      setNotice('Could not start the worker')
      return
    }
    const created = await response.json()
    const tone = taskOwner === 'Nova' ? 'coral' : taskOwner === 'Atlas' ? 'blue' : 'yellow'
    setTasks((current) => [{ id: created.id, title, owner: taskOwner, due: 'Now', status: 'Queued', tone, progress: 0 }, ...current])
    subscribeToRun(created)
    setTaskTitle('')
    setTaskOpen(false)
    setNotice('Mission sent to your AI Employee')
    window.setTimeout(() => setNotice(''), 2400)
  }

  const cancelRun = async () => {
    if (activeRun) await fetch(`/api/tasks/${activeRun.id}/cancel`, { method: 'POST' })
  }

  const completeTask = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, status: 'Done', progress: 100 } : task))

  useEffect(() => () => eventSource.current?.close(), [])

  const activeEmployee = employees.find((employee) => employee.name === activeRun?.owner) || employees[0]
  const sceneStatus = activeRun?.status || 'idle'
  const statusLabel = sceneStatus === 'tool_call' ? 'at console' : sceneStatus === 'completed' ? 'celebrating' : sceneStatus === 'failed' ? 'alert' : sceneStatus === 'cancelled' ? 'paused' : sceneStatus === 'planning' || sceneStatus === 'observation' ? 'working' : sceneStatus === 'queued' ? 'walking' : 'ready'
  const statusCopy = activeRun?.message || 'The office is warming up. Give an AI Employee a mission.'

  return (
    <div className="app-shell">
      <header className="hud">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActiveNav('overview') }}><span className="brand-mark"><span /><span /><span /></span><span>orbit<span className="brand-dot">.</span></span></a>
        <div className="player-card"><div className="player-avatar">JL</div><div><strong>Jamie Lee</strong><span>Product lead · Level 04</span></div><div className="xp-bar"><span /></div><small>2,840 / 4,000 XP</small></div>
        <div className="hud-actions"><span className="credit-pill"><span>✦</span> 12,420 credits</span><button className="icon-button" aria-label="Notifications">♧<i /></button><button className="profile-button" aria-label="Open profile menu">JL</button></div>
      </header>

      <div className="office-layout">
        <aside className="left-rail">
          <div className="rail-label">Workspace</div>
          <nav aria-label="Main navigation">{navItems.map(([id, label, symbol]) => <button key={id} className={`rail-item ${activeNav === id ? 'active' : ''}`} onClick={() => setActiveNav(id)}><Icon>{symbol}</Icon><span>{label}</span>{id === 'tasks' && <b>{tasks.filter((task) => task.status !== 'Done').length}</b>}</button>)}</nav>
          <div className="rail-divider" />
          <button className="rail-item"><Icon>＋</Icon><span>Invite teammate</span></button>
          <div className="rail-bottom"><button className="rail-item"><Icon>⚙</Icon><span>Settings</span></button><small>Orbit OS v0.1 · Demo mode</small></div>
        </aside>

        <main className="office-main">
          <div className="scene-toolbar"><div><p className="eyebrow">Wednesday, October 2 · 09:42</p><h1>AI Office <span>HQ</span></h1></div><div className="scene-actions"><span className="live-pill"><i /> Live world</span><button className="scene-button" onClick={() => setTaskOpen(true)}>＋ New mission</button></div></div>
          <section className="world" aria-label="AI Office live scene">
            <div className="skyline skyline-back"><i /><i /><i /><i /><i /><i /></div><div className="skyline skyline-front"><i /><i /><i /><i /><i /></div>
            <div className="sun-orb" /><div className="pixel-cloud cloud-a" /><div className="pixel-cloud cloud-b" />
            <div className="office-building">
              <div className="building-roof"><span>ORBIT HQ</span><i /></div>
              <div className="floor floor-top"><div className="room research-room"><span className="room-sign">RESEARCH LAB</span><div className="room-window" /><div className="desk-pixel" /><div className="plant-pixel" /></div><div className="room ops-room"><span className="room-sign">OPS DECK</span><div className="screen-wall" /><div className="desk-pixel" /></div></div>
              <div className="floor floor-mid"><div className="room studio-room"><span className="room-sign">CREATIVE STUDIO</span><div className="palette" /><div className="desk-pixel" /><div className="plant-pixel" /></div><div className="room lounge-room"><span className="room-sign">LOUNGE</span><div className="couch" /><div className="coffee" /></div></div>
              <div className="floor floor-ground"><div className="lobby"><span className="neon-sign">MAKE<br />GOOD<br />WORK</span><div className="door" /><div className="counter" /></div><div className="garden"><div className="tree" /><div className="tree small-tree" /><div className="bench" /></div></div>
              {employees.map((employee) => <div key={employee.id} className={`pixel-agent agent-${employee.id} ${activeEmployee.id === employee.id ? 'is-focused' : ''} mood-${activeEmployee.id === employee.id ? statusLabel : 'idle'}`}><div className={`agent-head ${employee.tone}`}>{employee.initials}<i /></div><div className={`agent-body ${employee.tone}`} /><span className="agent-shadow" /><strong>{employee.name}</strong><small>{activeEmployee.id === employee.id ? statusLabel : employee.role}</small></div>)}
              <div className="building-foundation"><span /><span /><span /><span /><span /></div>
            </div>
            <div className="grass-edge grass-left" /><div className="grass-edge grass-right" /><div className="world-caption"><span>◈</span> {activeRun ? `${activeEmployee.name} is ${statusLabel}` : 'three minds, one mission'}</div>
          </section>

          <section className="mission-strip"><div className="mission-avatar">✦</div><div className="mission-copy"><span>Live mission feed</span><strong>{statusCopy}</strong></div>{activeRun && <><div className="mission-progress"><span style={{ width: `${activeRun.progress || 0}%` }} /></div><b>{activeRun.progress || 0}%</b>{!['completed', 'failed', 'cancelled'].includes(activeRun.status) && <button className="cancel-button" onClick={cancelRun}>Pause mission</button>}</>}</section>

          <section className="tasks-section" aria-labelledby="tasks-title"><div className="section-heading compact"><div><p className="eyebrow">Command center</p><h2 id="tasks-title">Current missions</h2></div><button className="text-button" onClick={() => setActiveNav('tasks')}>Open task board <span>→</span></button></div><div className="task-table-wrap"><div className="task-table task-header"><span>Mission</span><span>Agent</span><span>Due</span><span>Status</span><span /></div>{tasks.slice(0, 4).map((task) => <div className={`task-table task-row ${task.status === 'Done' ? 'is-done' : ''}`} key={task.id}><div className="task-name"><button className="check-button" aria-label={`Mark ${task.title} done`} onClick={() => completeTask(task.id)}>{task.status === 'Done' ? '✓' : ''}</button><span>{task.title}</span></div><span className="assigned"><span className={`mini-avatar ${task.tone}`}>{task.owner[0]}</span>{task.owner}</span><span className="due">{task.due}</span><span className={`table-status status-${task.status.toLowerCase().replace(' ', '-')}`}>{task.status}</span><button className="row-more" aria-label={`More options for ${task.title}`}>•••</button></div>)}</div></section>
        </main>

        <aside className="right-dock">
          <div className="dock-heading"><div><p className="eyebrow">Mission control</p><h2>Current task</h2></div><span className="signal"><i /> SYNCED</span></div>
          <div className="focus-card"><div className="focus-top"><span className="focus-icon">✦</span><span className="focus-status"><i /> {activeRun ? activeRun.status.replace('_', ' ') : 'In progress'}</span></div><h3>{activeRun?.title || 'Summarize customer interview notes'}</h3><p>{activeRun?.message || "Pull out the strongest insights and open questions from this week's calls."}</p><div className="focus-owner"><div className={`avatar ${activeEmployee.tone} small`}>{activeEmployee.initials}<span className="presence" /></div><div><strong>{activeRun?.owner || 'Nova'}</strong><span>{activeEmployee.role}</span></div></div><div className="progress-label"><span>Mission progress</span><span>{activeRun?.progress ?? 68}%</span></div><div className="progress-track"><span style={{ width: `${activeRun?.progress ?? 68}%` }} /></div>{activeRun && !['completed', 'failed', 'cancelled'].includes(activeRun.status) ? <button className="outline-button" onClick={cancelRun}>Cancel mission <span>×</span></button> : <button className="outline-button" onClick={() => setActiveNav('tasks')}>Open mission <span>↗</span></button>}</div>
          <div className="goals-card"><div className="dock-subheading"><h3>Daily goals</h3><span>1 / 3</span></div><div className="goal"><span className="goal-check done">✓</span><div><strong>Brief your AI team</strong><small>Completed just now</small></div></div><div className="goal"><span className="goal-check" /><div><strong>Review one result</strong><small>Make a call, keep moving</small></div></div><div className="goal"><span className="goal-check" /><div><strong>Ship something small</strong><small>Momentum compounds</small></div></div></div>
          <div className="dock-subheading activity-title"><h3>Event stream</h3><span>{runEvents.length || 3} events</span></div><div className="activity-list">{runEvents.length ? runEvents.map((event, index) => <div className="activity-item" key={`${event.timestamp}-${index}`}><span className={`activity-dot ${event.type === 'tool_call' ? 'blue' : event.type === 'completed' ? 'yellow' : 'coral'}`} /><p><strong>{event.type.replace('_', ' ')}</strong><br />{event.message}<small>just now</small></p></div>) : <><div className="activity-item"><span className="activity-dot coral" /><p><strong>Nova</strong> added a note to customer interview notes<small>12 min ago</small></p></div><div className="activity-item"><span className="activity-dot blue" /><p><strong>Atlas</strong> started Q4 launch checklist<small>48 min ago</small></p></div></>}</div>
        </aside>
      </div>

      <div className="command-bar"><span className="command-spark">✦</span><input aria-label="Quick mission command" placeholder="Tell your AI team what to work on..." value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setTaskOpen(true) }} /><button onClick={() => setTaskOpen(true)}>Send mission <span>↗</span></button><div className="quick-actions"><button onClick={() => { setTaskTitle('Give me a quick progress update'); setTaskOpen(true) }}>Progress update</button><button onClick={() => { setTaskTitle('Find the next best task for the team'); setTaskOpen(true) }}>✦ Suggest a task</button></div></div>
      <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.slice(0, 3).map(([id, label, symbol]) => <button key={id} className={activeNav === id ? 'active' : ''} onClick={() => setActiveNav(id)}><Icon>{symbol}</Icon><span>{label}</span></button>)}</nav>

      {isTaskOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTaskOpen(false)}><form className="task-modal" onSubmit={createTask}><button type="button" className="modal-close" onClick={() => setTaskOpen(false)} aria-label="Close">×</button><p className="eyebrow">New mission</p><h2>What should your AI Employee take on?</h2><label htmlFor="task-title">Mission brief</label><textarea id="task-title" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Pull together the customer feedback from last month" autoFocus /><label htmlFor="task-owner">Assign to</label><select id="task-owner" value={taskOwner} onChange={(event) => setTaskOwner(event.target.value)}>{employees.map((employee) => <option key={employee.id}>{employee.name}</option>)}</select><button className="primary-button modal-submit" type="submit">Launch mission <span>→</span></button></form></div>}
      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
