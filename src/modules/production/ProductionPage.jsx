import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { fetchTailors } from '../tailors/api/tailorQueries'
import { fetchProductionOrders, transitionOrder, assignTailorToOrder, unassignTailor } from './api/productionQueries'
import './ProductionPage.css'

const STAGES = ['Booked', 'Cutting', 'Stitching', 'Ready', 'Delivered']
const STAGE_COLORS = {
  Booked: '--booked',
  Cutting: '--cutting',
  Stitching: '--stitching',
  Ready: '--ready',
  Delivered: '--delivered',
}

const ASSIGN_REQUIRED_STAGES = ['Cutting', 'Stitching']

export default function ProductionPage() {
  const { tenantId } = useAuth()
  const { showToast } = useToast()
  const [orders, setOrders] = useState([])
  const [tailors, setTailors] = useState([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [moving, setMoving] = useState(null)
  const [assigning, setAssigning] = useState(null)
  const [assignModal, setAssignModal] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [o, t] = await Promise.all([fetchProductionOrders(), fetchTailors()])
      setOrders(o)
      setTailors(t.filter(t => t.active !== false))
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const handleTransition = async (orderId, newStage) => {
    setMoving(orderId)
    try {
      await transitionOrder(orderId, newStage)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setMoving(null)
    }
  }

  const handleMoveClick = (order, nextStage) => {
    if (ASSIGN_REQUIRED_STAGES.includes(nextStage)) {
      setAssignModal({ order, stage: nextStage, tailorId: '' })
    } else {
      handleTransition(order.id, nextStage)
    }
  }

  const handleAssignAndMove = async () => {
    if (!assignModal || !assignModal.tailorId) {
      showToast('Please select a tailor.', 'error')
      return
    }
    try {
      await assignTailorToOrder(tenantId, assignModal.order.id, assignModal.tailorId, assignModal.stage)
      await transitionOrder(assignModal.order.id, assignModal.stage)
      showToast(`Moved to ${assignModal.stage} with tailor assigned.`)
      setAssignModal(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleAssign = async (orderId, tailorId, stage) => {
    try {
      await assignTailorToOrder(tenantId, orderId, tailorId, stage)
      showToast('Tailor assigned.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleUnassign = async (assignmentId) => {
    try {
      await unassignTailor(assignmentId)
      showToast('Tailor unassigned.')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const grouped = {}
  STAGES.forEach(s => { grouped[s] = [] })
  orders.forEach(o => {
    if (grouped[o.current_stage]) grouped[o.current_stage].push(o)
  })

  return (
    <div className="p-module">
      <header className="c-header">
        <div className="c-header-row">
          <h3 className="c-title">Production Floor</h3>
        </div>
      </header>

      {loading ? (
        <p className="c-empty">Loading...</p>
      ) : (
        <div className="p-board">
          {STAGES.map(stage => (
            <div key={stage} className={`p-column p-col${STAGE_COLORS[stage]}`}>
              <div className="p-col-header">
                <span className="p-col-dot" />
                <span className="p-col-name">{stage}</span>
                <span className="p-col-count">{grouped[stage].length}</span>
              </div>
              <div className="p-col-cards">
                {grouped[stage].length === 0 && <div className="p-col-empty">No orders</div>}
                {grouped[stage].map(order => (
                  <div
                    key={order.id}
                    className={`p-card ${detail?.id === order.id ? 'p-card--active' : ''} ${moving === order.id ? 'p-card--moving' : ''}`}
                    onClick={() => setDetail(detail?.id === order.id ? null : order)}
                  >
                    <div className="p-card-head">
                      <span className="p-card-order">{order.order_number}</span>
                      <span className="p-card-total">Rs.{Number(order.total_amount).toFixed(0)}</span>
                    </div>
                    <div className="p-card-customer">{order.customers?.name || '—'}</div>
                    {order.delivery_date && <div className="p-card-delivery">Due {order.delivery_date}</div>}
                    <div className="p-card-actions">
                      <span className="p-card-stage-label">{stage}</span>
                      {stage !== 'Delivered' && (
                        <button className="p-card-btn p-card-btn--next" onClick={(e) => { e.stopPropagation(); handleMoveClick(order, STAGES[STAGES.indexOf(stage) + 1]) }} disabled={moving === order.id}>→</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="c-detail" style={{ marginTop: 24 }}>
          <div className="c-detail-row">
            <div><span className="c-detail-label">Order #</span><span>{detail.order_number}</span></div>
            <div><span className="c-detail-label">Customer</span><span>{detail.customers?.name}</span></div>
            <div><span className="c-detail-label">Stage</span><span className={`o-stage o-stage--${detail.current_stage?.toLowerCase()}`}>{detail.current_stage}</span></div>
            <div><span className="c-detail-label">Total</span><span>Rs. {Number(detail.total_amount).toFixed(0)}</span></div>
            <div><span className="c-detail-label">Delivery</span><span>{detail.delivery_date || '—'}</span></div>
          </div>
          {detail.order_items?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <span className="c-detail-label">Items</span>
              <div className="o-detail-items">
                {detail.order_items.map((item, i) => (
                  <div key={i} className="o-detail-item">
                    <span>{item.garment_name}</span>
                    <span>{item.quantity} x Rs.{Number(item.rate).toFixed(0)}</span>
                    <span>Rs.{Number(item.amount).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-assign-section" style={{ marginTop: 16 }}>
            <span className="c-detail-label">Assigned Tailors</span>
            {detail.work_assignments?.length > 0 ? (
              <table className="c-table" style={{ marginTop: 6 }}>
                <thead>
                  <tr>
                    <th>Tailor</th>
                    <th>Stage</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.work_assignments.map(wa => (
                    <tr key={wa.id}>
                      <td>{wa.tailors?.name || '—'}</td>
                      <td><span className={`o-stage o-stage--${wa.stage?.toLowerCase()}`}>{wa.stage}</span></td>
                      <td><button className="c-action-btn c-action-destructive" onClick={() => handleUnassign(wa.id)}>Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>No tailors assigned yet.</p>
            )}

            <div className="p-assign-form" style={{ marginTop: 10 }}>
              <select
                className="c-form-input"
                style={{ width: 'auto', minWidth: 180, display: 'inline-block' }}
                value={assigning?.tailorId || ''}
                onChange={e => setAssigning(p => ({ ...p, tailorId: e.target.value }))}
              >
                <option value="">Select tailor…</option>
                {tailors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button
                className="c-action-btn"
                style={{ marginLeft: 8 }}
                onClick={() => {
                  if (assigning?.tailorId) {
                    handleAssign(detail.id, assigning.tailorId, detail.current_stage)
                    setAssigning({ tailorId: '' })
                  }
                }}
              >
                Assign to current stage
              </button>
            </div>
          </div>
        </div>
      )}
      {assignModal && (
        <div className="c-backdrop" onClick={() => setAssignModal(null)}>
          <div className="c-form-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 className="c-form-title" style={{ marginBottom: 16 }}>
              Assign Tailor for <span className="mono">{assignModal.order.order_number}</span>
            </h3>
            <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 16 }}>
              This order is moving to <strong>{assignModal.stage}</strong>. Select a tailor to assign to this stage.
            </p>
            <label className="c-form-field">
              <span className="c-form-label">Tailor</span>
              <select
                className="c-form-input"
                value={assignModal.tailorId}
                onChange={e => setAssignModal(p => ({ ...p, tailorId: e.target.value }))}
              >
                <option value="">Select a tailor…</option>
                {tailors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <div className="c-form-actions" style={{ marginTop: 20 }}>
              <button className="c-form-cancel" onClick={() => setAssignModal(null)}>Cancel</button>
              <button className="c-form-save" onClick={handleAssignAndMove}>Assign & Move</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
