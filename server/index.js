import cors from 'cors'
import 'dotenv/config'
import express from 'express'
import { randomUUID } from 'node:crypto'

const app = express()
const port = Number(process.env.PORT || 8787)
const tasks = new Map()
const configuredBaseUrl = (process.env.AI_BASE_URL || 'http://localhost:20128').replace(/\/+$/, '')
const providerBaseUrl = configuredBaseUrl.endsWith('/v1') ? configuredBaseUrl : `${configuredBaseUrl}/v1`
const providerEnabled = Boolean(process.env.AI_API_KEY)

app.use(cors())
app.use(express.json())

const sendEvent = (run, event) => {
  run.events.push(event)
  for (const response of run.clients) {
    response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  }
}

const finishRun = (run, status, message) => {
  if (run.timer) clearTimeout(run.timer)
  if (run.abortController) run.abortController.abort()
  run.status = status
  sendEvent(run, { type: status, message, result: run.result, progress: status === 'completed' ? 100 : run.progress, timestamp: new Date().toISOString() })
  for (const response of run.clients) response.end()
  run.clients.clear()
}

const runProviderWorker = async (run) => {
  run.abortController = new AbortController()
  sendEvent(run, { type: 'planning', message: `Planning “${run.title}” with ${run.owner}`, progress: 18, timestamp: new Date().toISOString() })
  sendEvent(run, { type: 'tool_call', message: 'Sending the brief to your 9Router model', progress: 32, timestamp: new Date().toISOString() })
  try {
    const providerResponse = await fetch(`${providerBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'auto',
        messages: [
          { role: 'system', content: `You are ${run.owner}, an AI employee. Be concise, practical, and clearly label assumptions.` },
          { role: 'user', content: run.title },
        ],
        temperature: 0.4,
      }),
      signal: run.abortController.signal,
    })
    if (!providerResponse.ok) throw new Error(`9Router returned HTTP ${providerResponse.status}`)
    const payload = await providerResponse.json()
    run.result = payload.choices?.[0]?.message?.content || 'The model returned no text.'
    run.progress = 92
    sendEvent(run, { type: 'observation', message: 'The model returned a result for review', result: run.result, progress: run.progress, timestamp: new Date().toISOString() })
    finishRun(run, 'completed', 'Task complete — ready for your review')
  } catch (error) {
    if (run.status === 'cancelled' || error.name === 'AbortError') return
    finishRun(run, 'failed', error.message || 'The AI provider request failed')
  }
}

const runDemoWorker = (run) => {
  const steps = [
    { type: 'planning', message: `Breaking “${run.title}” into a small plan`, progress: 18, delay: 700 },
    { type: 'tool_call', message: 'Searching workspace context and recent notes', progress: 34, delay: 1100 },
    { type: 'observation', message: 'Found useful context from 4 workspace sources', progress: 51, delay: 1100 },
    { type: 'tool_call', message: `${run.owner} is drafting the first pass`, progress: 67, delay: 1200 },
    { type: 'progress', message: 'Checking the result against your brief', progress: 84, delay: 1100 },
    { type: run.title.toLowerCase().includes('fail') ? 'failed' : 'completed', message: run.title.toLowerCase().includes('fail') ? 'Demo worker hit a simulated provider error' : 'Task complete — ready for your review', progress: 100, delay: 1100 },
  ]
  let index = 0
  const next = () => {
    if (run.status === 'cancelled' || index >= steps.length) return
    const step = steps[index]
    run.timer = setTimeout(() => {
      if (run.status === 'cancelled') return
      run.progress = step.progress
      if (step.type === 'completed' || step.type === 'failed') finishRun(run, step.type, step.message)
      else {
        sendEvent(run, { ...step, timestamp: new Date().toISOString() })
        index += 1
        next()
      }
    }, step.delay)
  }
  sendEvent(run, { type: 'queued', message: `${run.owner} picked up the assignment`, progress: 5, timestamp: new Date().toISOString() })
  next()
}

app.post('/api/tasks', (request, response) => {
  const title = typeof request.body?.title === 'string' ? request.body.title.trim() : ''
  const owner = typeof request.body?.owner === 'string' ? request.body.owner : 'Nova'
  if (!title) return response.status(400).json({ error: 'A task title is required.' })
  const run = { id: randomUUID(), title, owner, status: 'queued', progress: 0, events: [], clients: new Set(), timer: null, createdAt: new Date().toISOString() }
  tasks.set(run.id, run)
  if (providerEnabled) runProviderWorker(run)
  else runDemoWorker(run)
  return response.status(201).json({ id: run.id, title: run.title, owner: run.owner, status: run.status, progress: run.progress, createdAt: run.createdAt })
})

app.get('/api/tasks', (_request, response) => response.json([...tasks.values()].map(({ clients, timer, events, ...task }) => ({ ...task, eventCount: events.length }))))

app.get('/api/tasks/:id/events', (request, response) => {
  const run = tasks.get(request.params.id)
  if (!run) return response.status(404).end()
  response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  response.write(`event: ready\ndata: ${JSON.stringify({ type: 'ready', status: run.status, progress: run.progress })}\n\n`)
  for (const event of run.events) response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
  run.clients.add(response)
  request.on('close', () => run.clients.delete(response))
})

app.post('/api/tasks/:id/cancel', (request, response) => {
  const run = tasks.get(request.params.id)
  if (!run) return response.status(404).json({ error: 'Task not found.' })
  if (['completed', 'failed', 'cancelled'].includes(run.status)) return response.json({ id: run.id, status: run.status })
  finishRun(run, 'cancelled', 'Task cancelled by you')
  return response.json({ id: run.id, status: run.status })
})

app.listen(port, () => console.log(`Orbit worker listening on http://localhost:${port} (${providerEnabled ? '9Router' : 'demo'} mode)`))
