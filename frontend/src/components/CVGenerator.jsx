import { useState, useRef } from 'react'
import { generateCV } from '../api'

const INITIAL = {
  name: '', email: '', phone: '', location: '',
  link: '', summary: '', experience: '', education: '',
  skills: '', projects: '', publications: '',
}

export default function CVGenerator() {
  const [fields, setFields] = useState(INITIAL)
  const [logoFile, setLogoFile] = useState(null)
  const [status, setStatus] = useState(null) // null | { type: 'loading'|'success'|'error', msg: string }
  const submitRef = useRef(null)

  const set = (key) => (e) => setFields(f => ({ ...f, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus({ type: 'loading', msg: 'Generating CV…' })
    if (submitRef.current) submitRef.current.disabled = true
    try {
      const res = await generateCV(fields, logoFile)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'cv.pdf'
      a.click()
      URL.revokeObjectURL(url)
      setStatus({ type: 'success', msg: 'CV generated and downloaded!' })
    } catch (err) {
      setStatus({ type: 'error', msg: err.message || 'Generation failed' })
    } finally {
      if (submitRef.current) submitRef.current.disabled = false
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          📄 CV Generator
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Fill in your details and download a professional PDF CV instantly.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="form-label">
              👤 Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Jane Smith"
              value={fields.name}
              onChange={set('name')}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="form-label">
              ✉ Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              className="input"
              placeholder="jane@example.com"
              value={fields.email}
              onChange={set('email')}
              required
            />
          </div>
        </div>

        {/* Phone + Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="form-label">📞 Phone</label>
            <input
              type="text"
              className="input"
              placeholder="+1 555 123 4567"
              value={fields.phone}
              onChange={set('phone')}
            />
          </div>
          <div className="space-y-1">
            <label className="form-label">📍 Location</label>
            <input
              type="text"
              className="input"
              placeholder="City, Country"
              value={fields.location}
              onChange={set('location')}
            />
          </div>
        </div>

        {/* LinkedIn / Website */}
        <div className="space-y-1">
          <label className="form-label">🔗 LinkedIn / Website</label>
          <input
            type="text"
            className="input"
            placeholder="https://linkedin.com/in/janesmith"
            value={fields.link}
            onChange={set('link')}
          />
        </div>

        {/* Summary */}
        <div className="space-y-1">
          <label className="form-label">📝 Professional Summary</label>
          <textarea
            className="input resize-y"
            rows={3}
            placeholder="A brief professional summary…"
            value={fields.summary}
            onChange={set('summary')}
          />
        </div>

        {/* Experience */}
        <div className="space-y-1">
          <label className="form-label">💼 Work Experience</label>
          <textarea
            className="input resize-y font-mono text-xs"
            rows={5}
            placeholder={"Company — Title — Start–End year\n• Achievement or responsibility\n\nCompany — Title — Start–End year\n• Achievement or responsibility"}
            value={fields.experience}
            onChange={set('experience')}
          />
        </div>

        {/* Education */}
        <div className="space-y-1">
          <label className="form-label">🎓 Education</label>
          <textarea
            className="input resize-y font-mono text-xs"
            rows={3}
            placeholder={"University — Degree — Year\nUniversity — Degree — Year"}
            value={fields.education}
            onChange={set('education')}
          />
        </div>

        {/* Skills */}
        <div className="space-y-1">
          <label className="form-label">
            ⭐ Skills <span className="text-gray-500 text-xs">(comma-separated)</span>
          </label>
          <input
            type="text"
            className="input"
            placeholder="Python, FastAPI, React, Docker, …"
            value={fields.skills}
            onChange={set('skills')}
          />
        </div>

        {/* Projects */}
        <div className="space-y-1">
          <label className="form-label">
            🧪 Projects <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <textarea
            className="input resize-y font-mono text-xs"
            rows={3}
            placeholder="Project Name — Description — URL (optional)"
            value={fields.projects}
            onChange={set('projects')}
          />
        </div>

        {/* Publications */}
        <div className="space-y-1">
          <label className="form-label">
            📚 Publications <span className="text-gray-500 text-xs">(optional)</span>
          </label>
          <textarea
            className="input resize-y font-mono text-xs"
            rows={2}
            placeholder="Title — Journal — Year"
            value={fields.publications}
            onChange={set('publications')}
          />
        </div>

        {/* Logo upload */}
        <div className="space-y-1">
          <label className="form-label">
            🖼 Logo / Branding Image <span className="text-gray-500 text-xs">(optional, PNG/JPG)</span>
          </label>
          <input
            type="file"
            className="input text-sm"
            accept="image/png,image/jpeg"
            onChange={(e) => setLogoFile(e.target.files[0] ?? null)}
          />
        </div>

        <button ref={submitRef} type="submit" className="btn-primary w-full sm:w-auto">
          📄 Generate PDF CV
        </button>
      </form>

      {status && (
        <div className={`mt-3 text-sm ${
          status.type === 'loading' ? 'text-gray-400' :
          status.type === 'success' ? 'text-green-400' : 'text-red-400'
        }`}>
          {status.type === 'loading' && '⏳ '}
          {status.type === 'success' && '✅ '}
          {status.type === 'error'   && '❌ '}
          {status.msg}
        </div>
      )}
    </div>
  )
}
