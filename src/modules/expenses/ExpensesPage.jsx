import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchExpenses, createExpense, updateExpense, deleteExpense } from './api/expenseQueries'
import ExpenseForm from './ExpenseForm'
import { useTopbar } from '../../shared/context/TopbarContext'
import ConfirmModal from '../../shared/components/ConfirmModal'

export default function ExpensesPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const { setTopbar } = useTopbar()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchExpenses(search || undefined)
      setExpenses(data)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast, search])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    setTopbar('Expenses', <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Expense</button>)
    return () => setTopbar('', null)
  }, [setTopbar])

  const handleSave = async (payload) => {
    try {
      if (editing) {
        await updateExpense(editing.id, payload)
        showToast('Expense updated.')
        setShowForm(false)
        setEditing(null)
        load()
        return null
      } else {
        const result = await createExpense(tenantId, payload)
        if (result.creditApplied > 0) {
          showToast(`Expense created. Rs. ${result.creditApplied.toFixed(0)} credit auto-applied.`)
        } else {
          showToast('Expense created.')
        }
        load()
        return result.expense
      }
    } catch (err) {
      showToast(err.message, 'error')
      throw err
    }
  }

  const handleEdit = (expense) => {
    setEditing(expense)
    setShowForm(true)
  }

  const handleDelete = async (id) => {
    try {
      await deleteExpense(id)
      showToast('Expense deleted.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
    setConfirmDelete(null)
  }

  return (
    <div className="c-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Expenses</h3>
          <button className="c-add-btn" onClick={() => { setEditing(null); setShowForm(true) }}>+ New Expense</button>
        </div>
        <input className="c-search" type="text" placeholder="Search expenses…" value={search} onChange={e => setSearch(e.target.value)} />
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : expenses.length === 0 ? (
        <p className="c-empty">No expenses yet.</p>
      ) : (
        <div className="c-table-wrap">
          <table className="c-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Payee</th>
                <th className="l-num mono">Total Amount</th>
                <th className="l-num mono">Paid</th>
                <th className="l-num mono">Balance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => {
                const bal = Number(e.total_amount) - Number(e.amount_paid)
                return (
                  <tr key={e.id}>
                    <td>{e.description}</td>
                    <td>{e.payee_name}</td>
                    <td className="l-num mono">Rs. {Number(e.total_amount).toFixed(0)}</td>
                    <td className="l-num mono">Rs. {Number(e.amount_paid).toFixed(0)}</td>
                    <td className={`l-num mono ${bal > 0 ? 'l-due' : bal < 0 ? 'l-excess' : ''}`}>
                      {bal > 0
                        ? `Rs. ${bal.toFixed(0)} due`
                        : bal < 0
                          ? `Rs. ${Math.abs(bal).toFixed(0)} excess`
                          : 'Rs. 0'
                      }
                    </td>
                    <td className="c-actions">
                      <button className="c-action-btn" onClick={() => handleEdit(e)}>Edit</button>
                      <button className="c-action-btn c-action-destructive" onClick={() => setConfirmDelete(e.id)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="c-backdrop" onClick={() => { setShowForm(false); setEditing(null) }}>
          <div className="c-form-modal" onClick={e => e.stopPropagation()}>
            <ExpenseForm initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null) }} />
          </div>
        </div>
      )}

      {confirmDelete !== null && (
        <ConfirmModal message="Delete this expense?" onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />
      )}
    </div>
  )
}
