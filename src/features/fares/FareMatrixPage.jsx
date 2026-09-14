import { useCallback, useEffect, useMemo, useState } from 'react'
import useUnsavedChanges, { canLeaveEditor } from '../../hooks/useUnsavedChanges'
import DataTable from '../../components/DataTable'
import DeleteButton from '../../components/DeleteButton'
import { VEHICLE_TYPE_LABELS } from '../../constants/vehicleTypes'
import PageHeader from '../../components/PageHeader'
import SidePanel from '../../components/SidePanel'
import AdminLayout from '../../layouts/AdminLayout'
import {
  createFare,
  createTricycleFare,
  deleteFare,
  deleteTricycleFare,
  FARE_TYPES,
  getFareMatrix,
  getTricycleFareMatrix,
  getTricycleRoutes,
  updateFare,
  updateTricycleFare,
  VEHICLE_TYPES,
} from './faresService'

const sharedEmptyForm = {
  vehicle_type: '3',
  fare_type: 'STANDARD',
  minimum_distance_meters: '0',
  minimum_fare: '',
  increment_distance_meters: '',
  increment_fare: '',
  currency: 'PHP',
}

function getEmptyForm(scope, routes) {
  return scope === 'tricycle'
    ? { ...sharedEmptyForm, route_id: routes[0]?.route_id ?? '' }
    : sharedEmptyForm
}

function FareForm({ fare, scope, routes, onClose, onSaved }) {
  const emptyForm = getEmptyForm(scope, routes)
  const [form, setForm] = useState(
    fare
      ? Object.fromEntries(
          Object.keys(emptyForm).map((key) => [key, String(fare[key] ?? emptyForm[key])]),
        )
      : emptyForm,
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(fare)
  const isTricycle = scope === 'tricycle'
  const dirty = Object.keys(emptyForm).some(
    (key) => String(form[key] ?? '') !== String(fare?.[key] ?? emptyForm[key]),
  )
  useUnsavedChanges(dirty, saving)

  function close() {
    if (canLeaveEditor()) onClose()
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const numericFields = [
      'minimum_distance_meters',
      'minimum_fare',
      'increment_distance_meters',
      'increment_fare',
    ]
    const values = Object.fromEntries(numericFields.map((field) => [field, Number(form[field])]))
    if (
      (!isTricycle && !VEHICLE_TYPES.includes(Number(form.vehicle_type))) ||
      (isTricycle && !routes.some((route) => route.route_id === form.route_id)) ||
      !FARE_TYPES.includes(form.fare_type) ||
      !form.currency.trim() ||
      numericFields.some((field) => form[field] === '' || !Number.isFinite(values[field]))
    )
      return setError('Complete all fields with valid values.')
    if (
      values.minimum_distance_meters < 0 ||
      values.increment_distance_meters <= 0 ||
      values.minimum_fare < 0 ||
      values.increment_fare < 0
    )
      return setError('Distances and fares must meet the minimum allowed values.')

    const payload = {
      fare_type: form.fare_type,
      minimum_distance_meters: values.minimum_distance_meters,
      minimum_fare: values.minimum_fare,
      increment_distance_meters: values.increment_distance_meters,
      increment_fare: values.increment_fare,
      currency: form.currency.trim().toUpperCase(),
      ...(isTricycle ? { route_id: form.route_id } : { vehicle_type: Number(form.vehicle_type) }),
    }
    setSaving(true)
    const result = isTricycle
      ? isEditing
        ? await updateTricycleFare(fare.fare_id, payload)
        : await createTricycleFare(payload)
      : isEditing
        ? await updateFare(fare.fare_id, payload)
        : await createFare(payload)
    if (result.error)
      setError(
        result.error.code === '23505'
          ? isTricycle
            ? 'This route already has a fare for the selected fare type.'
            : 'A fare for this vehicle and fare type already exists.'
          : 'The fare could not be saved. Check your permissions and try again.',
      )
    else onSaved(result.fare)
    setSaving(false)
  }

  return (
    <section className="side-panel-content fare-form-panel" aria-labelledby="fare-form-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">{isTricycle ? 'Tricycle fare matrix' : 'General fare matrix'}</p>
          <h2 id="fare-form-title">{isEditing ? 'Edit fare' : 'Add fare'}</h2>
        </div>
        <button
          className="close-button"
          type="button"
          aria-label="Close form"
          onClick={close}
          disabled={saving}
        >
          ×
        </button>
      </div>
      <form className="fare-form" onSubmit={handleSubmit}>
        <fieldset className="form-fields" disabled={saving}>
          <div className="form-grid">
            {isTricycle ? (
              <div className="edit-field form-grid-wide">
                <label htmlFor="route_id">Tricycle route / franchise</label>
                <select id="route_id" name="route_id" value={form.route_id} onChange={updateField}>
                  {routes.length === 0 && <option value="">No tricycle routes available</option>}
                  {routes.map((route) => (
                    <option key={route.route_id} value={route.route_id}>
                      {route.route_long_name || route.route_id} ({route.route_id})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="edit-field">
                <label htmlFor="vehicle_type">Vehicle type</label>
                <select
                  id="vehicle_type"
                  name="vehicle_type"
                  value={form.vehicle_type}
                  onChange={updateField}
                >
                  {VEHICLE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type} - {VEHICLE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="edit-field">
              <label htmlFor="fare_type">Fare type</label>
              <select id="fare_type" name="fare_type" value={form.fare_type} onChange={updateField}>
                {FARE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="edit-field">
              <label htmlFor="minimum_distance_meters">Minimum distance (m)</label>
              <input
                id="minimum_distance_meters"
                name="minimum_distance_meters"
                type="number"
                min="0"
                step="1"
                value={form.minimum_distance_meters}
                onChange={updateField}
              />
            </div>
            <div className="edit-field">
              <label htmlFor="minimum_fare">Minimum fare</label>
              <input
                id="minimum_fare"
                name="minimum_fare"
                type="number"
                min="0"
                step="0.01"
                value={form.minimum_fare}
                onChange={updateField}
              />
            </div>
            <div className="edit-field">
              <label htmlFor="increment_distance_meters">Increment distance (m)</label>
              <input
                id="increment_distance_meters"
                name="increment_distance_meters"
                type="number"
                min="1"
                step="1"
                value={form.increment_distance_meters}
                onChange={updateField}
              />
            </div>
            <div className="edit-field">
              <label htmlFor="increment_fare">Increment fare</label>
              <input
                id="increment_fare"
                name="increment_fare"
                type="number"
                min="0"
                step="0.01"
                value={form.increment_fare}
                onChange={updateField}
              />
            </div>
            <div className="edit-field">
              <label htmlFor="currency">Currency</label>
              <input
                id="currency"
                name="currency"
                type="text"
                value={form.currency}
                onChange={updateField}
              />
            </div>
          </div>
          {error && (
            <p className="error-message" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="secondary-button compact"
              type="button"
              onClick={close}
              disabled={saving}
            >
              Cancel
            </button>
            <button className="primary-button compact" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save fare'}
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  )
}

function FareMatrixPage({ userEmail, onSignOut, onTabChange, fareScope = 'general' }) {
  const [fares, setFares] = useState([])
  const [tricycleRoutes, setTricycleRoutes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingFare, setEditingFare] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const isTricycle = fareScope === 'tricycle'
  const routeNames = useMemo(
    () => new Map(tricycleRoutes.map((route) => [route.route_id, route.route_long_name])),
    [tricycleRoutes],
  )

  const loadFares = useCallback(async () => {
    setLoading(true)
    setError('')
    if (isTricycle) {
      const [faresResult, routesResult] = await Promise.all([
        getTricycleFareMatrix(),
        getTricycleRoutes(),
      ])
      if (faresResult.error || routesResult.error)
        setError(
          'Tricycle fare information could not be loaded. Check your connection and permissions.',
        )
      else {
        setFares(faresResult.fares)
        setTricycleRoutes(routesResult.routes)
      }
    } else {
      const result = await getFareMatrix()
      if (result.error)
        setError('Fare information could not be loaded. Check your connection and permissions.')
      else setFares(result.fares)
    }
    setLoading(false)
  }, [isTricycle])

  useEffect(() => {
    const timer = setTimeout(loadFares, 0)
    return () => clearTimeout(timer)
  }, [loadFares])

  function closeEditor() {
    setEditingFare(null)
    setEditorOpen(false)
  }

  function handleSaved(fare) {
    setFares((current) => {
      const exists = current.some((item) => item.fare_id === fare.fare_id)
      const next = exists
        ? current.map((item) => (item.fare_id === fare.fare_id ? fare : item))
        : [...current, fare]
      return next.sort((a, b) =>
        isTricycle
          ? a.route_id.localeCompare(b.route_id) || a.fare_type.localeCompare(b.fare_type)
          : a.vehicle_type - b.vehicle_type || a.fare_type.localeCompare(b.fare_type),
      )
    })
    closeEditor()
    setNotice('Fare saved successfully.')
  }

  function openEditor(fare = null) {
    if (!canLeaveEditor()) return
    setEditingFare(fare)
    setEditorOpen(true)
    setNotice('')
  }

  const fareColumns = [
    isTricycle
      ? {
          key: 'route_id',
          label: 'Route / franchise',
          render: (fare) => (
            <div className="fare-route-name">
              <strong>{routeNames.get(fare.route_id) || fare.route_id}</strong>
              {routeNames.has(fare.route_id) && <small>{fare.route_id}</small>}
            </div>
          ),
        }
      : {
          key: 'vehicle_type',
          label: 'Vehicle',
          render: (fare) => (
            <strong>
              {fare.vehicle_type} - {VEHICLE_TYPE_LABELS[fare.vehicle_type] ?? 'Unknown'}
            </strong>
          ),
        },
    { key: 'fare_type', label: 'Type' },
    {
      key: 'minimum_distance_meters',
      label: 'Minimum distance',
      render: (fare) => `${fare.minimum_distance_meters.toLocaleString()} m`,
    },
    {
      key: 'minimum_fare',
      label: 'Minimum fare',
      render: (fare) => `${fare.currency} ${Number(fare.minimum_fare).toFixed(2)}`,
    },
    {
      key: 'increment_distance_meters',
      label: 'Increment distance',
      render: (fare) => `${fare.increment_distance_meters.toLocaleString()} m`,
    },
    {
      key: 'increment_fare',
      label: 'Increment fare',
      render: (fare) => `${fare.currency} ${Number(fare.increment_fare).toFixed(2)}`,
    },
    { key: 'currency', label: 'Currency' },
    {
      key: 'actions',
      label: '',
      render: (fare) => (
        <div className="row-actions">
          <button className="table-action" type="button" onClick={() => openEditor(fare)}>
            Edit
          </button>
          <DeleteButton
            label={
              isTricycle
                ? `${routeNames.get(fare.route_id) || fare.route_id} · ${fare.fare_type} · Fare #${fare.fare_id}`
                : `${VEHICLE_TYPE_LABELS[fare.vehicle_type]} · ${fare.fare_type} · Fare #${fare.fare_id}`
            }
            onDelete={() =>
              isTricycle ? deleteTricycleFare(fare.fare_id) : deleteFare(fare.fare_id)
            }
            onDeleted={() => {
              setFares((current) => current.filter((item) => item.fare_id !== fare.fare_id))
              if (editingFare?.fare_id === fare.fare_id) closeEditor()
              setNotice('Fare deleted successfully.')
            }}
          />
        </div>
      ),
    },
  ]

  return (
    <AdminLayout
      userEmail={userEmail}
      onSignOut={onSignOut}
      activeTab={isTricycle ? 'tricycle-fares' : 'fares'}
      onTabChange={onTabChange}
      editorPanel={
        editorOpen && (
          <SidePanel title="Fare editor">
            <FareForm
              key={`${fareScope}-${editingFare?.fare_id ?? 'new-fare'}`}
              fare={editingFare}
              scope={fareScope}
              routes={tricycleRoutes}
              onClose={closeEditor}
              onSaved={handleSaved}
            />
          </SidePanel>
        )
      }
    >
      <PageHeader
        title={isTricycle ? 'Tricycle Fares' : 'General Fares'}
        subtitle={
          isTricycle
            ? 'Manage distance-based fares for each tricycle route or franchise.'
            : 'Manage shared distance-based fares for jeep, bus, UV Express, and e-jeep.'
        }
      >
        <button
          className="primary-button add-button"
          type="button"
          disabled={isTricycle && tricycleRoutes.length === 0}
          onClick={() => openEditor()}
        >
          {isTricycle ? 'Add tricycle fare' : 'Add fare'}
        </button>
      </PageHeader>
      {notice && (
        <p className="success-message page-notice" role="status">
          {notice}
        </p>
      )}
      {loading && (
        <div className="state-card">
          <p>Loading fares…</p>
        </div>
      )}
      {!loading && error && (
        <div className="state-card error-state">
          <p>{error}</p>
          <button className="secondary-button compact" type="button" onClick={loadFares}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && fares.length === 0 && (
        <div className="state-card">
          <h2>{isTricycle ? 'No tricycle fares yet' : 'No fare records yet'}</h2>
          <p>
            {isTricycle
              ? tricycleRoutes.length
                ? 'Add a fare matrix for a tricycle route or franchise.'
                : 'Add a tricycle route in the GTFS editor before configuring its fare.'
              : 'Add the first shared fare configuration for the passenger app.'}
          </p>
        </div>
      )}
      {!loading && !error && fares.length > 0 && (
        <DataTable
          selectedKey={editingFare?.fare_id}
          columns={fareColumns}
          rows={fares}
          getRowKey={(fare) => fare.fare_id}
          caption={
            isTricycle
              ? `${fares.length} route-specific tricycle fare records`
              : `${fares.length} shared fare records`
          }
        />
      )}
    </AdminLayout>
  )
}

export default FareMatrixPage
