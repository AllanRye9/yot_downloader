import { useState, useEffect } from 'react'
import { getReviews, submitReview, canSubmitReview } from '../api'

const STARS = [5, 4, 3, 2, 1]
const REVIEW_MAX_VISIBLE = 5

function StarRating({ value, onChange, size = 'text-2xl' }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(s => (
        <button
          key={s}
          type="button"
          className={`${size} transition-colors ${(hover || value) >= s ? 'text-yellow-400' : 'text-gray-600'}`}
          onMouseEnter={() => setHover(s)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
        >★</button>
      ))}
    </div>
  )
}

function ReviewCard({ review }) {
  return (
    <div className="bg-gray-800/60 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-300 shrink-0">
          {(review.name || 'A')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{review.name || 'Anonymous'}</span>
            <span className="text-yellow-400 text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            {review.country && <span className="text-xs text-gray-500">🌍 {review.country}</span>}
            {review.timestamp && (
              <span className="text-xs text-gray-600 ml-auto">
                {new Date(review.timestamp * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
          {review.comment && (
            <p className="mt-1.5 text-sm text-gray-300 leading-relaxed">{review.comment}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Average rating bar
function RatingBar({ ratings }) {
  const total = ratings.reduce((s, n) => s + n, 0) || 1
  const avg = ratings.reduce((s, n, i) => s + n * (i + 1), 0) / total
  return (
    <div className="bg-gray-800/40 rounded-xl p-4 mb-5">
      <div className="flex items-center gap-4 mb-3">
        <div className="text-4xl font-bold text-yellow-400">{avg.toFixed(1)}</div>
        <div>
          <div className="text-yellow-400">{'★'.repeat(Math.round(avg))}{'☆'.repeat(5 - Math.round(avg))}</div>
          <div className="text-xs text-gray-500">{total} review{total !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div className="space-y-1">
        {STARS.map(s => {
          const count = ratings[s - 1] || 0
          const pct = (count / total * 100).toFixed(0)
          return (
            <div key={s} className="flex items-center gap-2 text-xs">
              <span className="text-gray-500 w-4 text-right">{s}</span>
              <span className="text-yellow-400 text-xs">★</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-gray-600 w-5">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Reviews() {
  const [reviews, setReviews]     = useState([])
  const [showAll, setShowAll]     = useState(false)
  const [form, setForm]           = useState({ rating: 0, name: '', comment: '' })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [canSubmit, setCanSubmit] = useState(true)

  useEffect(() => {
    getReviews().then(setReviews).catch(() => {})
    canSubmitReview()
      .then(data => setCanSubmit(data.can_submit))
      .catch(() => setCanSubmit(true))
  }, [])

  const ratingCounts = [1,2,3,4,5].map(s => reviews.filter(r => r.rating === s).length)
  const visible = showAll ? reviews : reviews.slice(0, REVIEW_MAX_VISIBLE)

  const submit = async (e) => {
    e.preventDefault()
    if (!form.rating) { setError('Please select a rating'); return }
    setError(''); setSuccess(''); setLoading(true)
    try {
      await submitReview(form.rating, form.comment, form.name)
      setSuccess('✓ Thank you for your review!')
      setForm({ rating: 0, name: '', comment: '' })
      const [updated, status] = await Promise.all([getReviews(), canSubmitReview().catch(() => ({ can_submit: true }))])
      setReviews(updated)
      setCanSubmit(status.can_submit)
    } catch (err) {
      const msg = err.data?.error || err.message || 'Failed to submit review'
      setError(msg)
      // Refresh can_submit status so the form hides if limit was just hit
      canSubmitReview().then(data => setCanSubmit(data.can_submit)).catch(() => {})
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">User Reviews</h2>

      {reviews.length > 0 && <RatingBar ratings={ratingCounts} />}

      {/* Review cards */}
      {visible.length > 0 && (
        <div className="space-y-3 mb-4">
          {visible.map((r, i) => <ReviewCard key={i} review={r} />)}
        </div>
      )}
      {reviews.length > REVIEW_MAX_VISIBLE && (
        <button
          className="btn-ghost btn-sm w-full text-sm mb-5"
          onClick={() => setShowAll(s => !s)}
        >
          {showAll ? `▲ Show less` : `▼ Read more (${reviews.length - REVIEW_MAX_VISIBLE} more)`}
        </button>
      )}

      {/* Submit form */}
      <div className="border-t border-gray-800 pt-5">
        <h3 className="text-base font-semibold text-white mb-3">Leave a Review</h3>
        {!canSubmit ? (
          <p className="text-sm text-gray-400 bg-gray-800/40 border border-gray-700 rounded-lg px-3 py-3">
            You have already submitted the maximum number of reviews. Thank you for your feedback!
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your rating</label>
              <StarRating value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name (optional)</label>
              <input
                className="input"
                placeholder="Your name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Comment (optional)</label>
              <textarea
                className="input min-h-[80px] resize-y"
                placeholder="Tell us what you think…"
                value={form.comment}
                onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              />
            </div>

            {error   && <p className="text-sm text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">{error}</p>}
            {success && <p className="text-sm text-green-400 bg-green-900/20 border border-green-800/50 rounded-lg px-3 py-2">{success}</p>}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? <><span className="spinner w-4 h-4" /> Submitting…</> : '✉ Submit Review'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
