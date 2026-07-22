export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + (typeof dateStr === 'string' && dateStr.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return '—'
  const day = d.getDate()
  const month = d.toLocaleDateString('en-GB', { month: 'long' })
  const year = d.getFullYear()
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${day}${suffix} ${month} ${year}`
}