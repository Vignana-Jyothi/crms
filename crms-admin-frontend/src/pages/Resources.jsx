import { useEffect, useState } from 'react';
import { masterDataApi, resourcesApi } from '../api/endpoints';
import { motion, AnimatePresence } from 'framer-motion';

const EMPTY_FORM = {
  resourceId: '',
  resourceName: '',
  resourceTypeId: '',
  departmentId: '',
  blockId: '',
  floor: '',
  capacityOrAreaSqm: '',
  allocationNote: '',
};

export default function Resources() {
  const [resources, setResources] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [actionAlert, setActionAlert] = useState(null); // { type: 'success' | 'error', message: string }
  const [submitting, setSubmitting] = useState(false);

  // Edit Resource Modal state
  const [editingResource, setEditingResource] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  function refresh() {
    resourcesApi
      .list({})
      .then(setResources)
      .catch((err) => {
        setActionAlert({
          type: 'error',
          message: err.response?.data?.error || 'Failed to load resources.',
        });
      });
  }

  useEffect(() => {
    refresh();
    masterDataApi.resourceTypes().then(setResourceTypes).catch(() => {});
    masterDataApi.departments().then(setDepartments).catch(() => {});
    masterDataApi.blocks().then(setBlocks).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setActionAlert(null);
    setSubmitting(true);
    try {
      await resourcesApi.create({
        ...form,
        resourceTypeId: Number(form.resourceTypeId),
        departmentId: form.departmentId ? Number(form.departmentId) : null,
        blockId: form.blockId ? Number(form.blockId) : null,
        capacityOrAreaSqm: form.capacityOrAreaSqm ? Number(form.capacityOrAreaSqm) : null,
        allocationNote: form.allocationNote || null,
        floor: form.floor || null,
      });
      const createdName = form.resourceName || form.resourceId;
      setForm(EMPTY_FORM);
      setShowForm(false);
      setActionAlert({ type: 'success', message: `Resource "${createdName}" created successfully.` });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create resource.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenEdit(r) {
    setEditingResource(r);
    setEditForm({
      resourceId: r.resourceId,
      resourceName: r.resourceName || '',
      resourceTypeId: r.resourceTypeId || r.resourceType?.resourceTypeId || '',
      departmentId: r.departmentId || r.department?.departmentId || '',
      blockId: r.blockId || r.block?.blockId || '',
      floor: r.floor || '',
      capacityOrAreaSqm: r.capacityOrAreaSqm || '',
      allocationNote: r.allocationNote || '',
    });
    setEditError('');
  }

  async function handleEditSubmit(e) {
    e.preventDefault();
    setEditError('');
    setActionAlert(null);
    setEditSubmitting(true);
    try {
      await resourcesApi.update(editingResource.resourceId, {
        resourceName: editForm.resourceName,
        resourceTypeId: editForm.resourceTypeId ? Number(editForm.resourceTypeId) : undefined,
        departmentId: editForm.departmentId ? Number(editForm.departmentId) : null,
        blockId: editForm.blockId ? Number(editForm.blockId) : null,
        floor: editForm.floor || null,
        capacityOrAreaSqm: editForm.capacityOrAreaSqm ? Number(editForm.capacityOrAreaSqm) : null,
        allocationNote: editForm.allocationNote || null,
      });
      setActionAlert({
        type: 'success',
        message: `Resource "${editForm.resourceName}" updated successfully.`,
      });
      setEditingResource(null);
      refresh();
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update resource.');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function toggleStatus(resource) {
    setActionAlert(null);
    const nextStatus = resource.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await resourcesApi.update(resource.resourceId, { status: nextStatus });
      setActionAlert({
        type: 'success',
        message: `Resource "${resource.resourceName}" status changed to ${nextStatus}.`,
      });
      refresh();
    } catch (err) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update resource status.',
      });
    }
  }

  const [searchTerm, setSearchTerm] = useState('');

  const filteredResources = resources.filter((r) => {
    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    const safeString = (val) => (val ? String(val).toLowerCase() : '');
    return (
      safeString(r.resourceName).includes(s) ||
      safeString(r.resourceId).includes(s) ||
      safeString(r.resourceType?.typeName).includes(s) ||
      safeString(r.department?.departmentName).includes(s) ||
      safeString(r.block?.blockCode).includes(s) ||
      safeString(r.block?.blockName).includes(s) ||
      safeString(r.floor).includes(s) ||
      safeString(r.status).includes(s)
    );
  });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Resources</h1>
          <p className="mt-1 text-sm text-ink/60">{resources.length} resources across campus.</p>
        </div>
        <div className="flex gap-4 items-center">
          <input
            type="text"
            placeholder="Search resources..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-line px-3 py-2 text-sm w-64"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setShowForm((s) => !s);
              setError('');
            }}
            className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-dark hover:shadow-md transition-all whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ Add resource'}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>

      {actionAlert && (
        <div
          className={`mt-4 flex items-center justify-between rounded-lg border p-4 text-sm ${
            actionAlert.type === 'success'
              ? 'border-forest/40 bg-forest-light text-forest'
              : 'border-brick/40 bg-brick-light text-brick'
          }`}
        >
          <span>{actionAlert.message}</span>
          <button onClick={() => setActionAlert(null)} className="text-xs font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      </AnimatePresence>

      <AnimatePresence>
      {showForm && (
        <motion.form 
          initial={{ opacity: 0, height: 0, y: -20 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          onSubmit={handleSubmit} 
          className="mt-6 rounded-lg border border-line bg-white p-5 shadow-md overflow-hidden"
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <input
              required
              placeholder="Resource ID (e.g. RM-0322)"
              value={form.resourceId}
              onChange={(e) => setForm((f) => ({ ...f, resourceId: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Name (e.g. E113)"
              value={form.resourceName}
              onChange={(e) => setForm((f) => ({ ...f, resourceName: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
            <select
              required
              value={form.resourceTypeId}
              onChange={(e) => setForm((f) => ({ ...f, resourceTypeId: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            >
              <option value="">Type…</option>
              {resourceTypes.map((t) => (
                <option key={t.resourceTypeId} value={t.resourceTypeId}>
                  {t.typeName}
                </option>
              ))}
            </select>
            <select
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            >
              <option value="">No department (institute-owned)</option>
              {departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.departmentName}
                </option>
              ))}
            </select>
            <select
              value={form.blockId}
              onChange={(e) => setForm((f) => ({ ...f, blockId: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            >
              <option value="">Block…</option>
              {blocks.map((b) => (
                <option key={b.blockId} value={b.blockId}>
                  {b.blockName || b.blockCode}
                </option>
              ))}
            </select>
            <input
              placeholder="Floor"
              value={form.floor}
              onChange={(e) => setForm((f) => ({ ...f, floor: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
            <input
              type="number"
              placeholder="Capacity"
              value={form.capacityOrAreaSqm}
              onChange={(e) => setForm((f) => ({ ...f, capacityOrAreaSqm: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="mt-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            disabled={submitting}
            className="mt-4 rounded bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-navy-dark hover:shadow-md transition-all disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save resource'}
          </motion.button>
        </motion.form>
      )}
      </AnimatePresence>

      {/* Inventory Table with Block, Floor, and Capacity */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mt-6 overflow-hidden rounded-lg border border-line bg-white shadow-md hover:shadow-lg transition-shadow duration-300"
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Block</th>
              <th className="px-4 py-3">Floor</th>
              <th className="px-4 py-3">Capacity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <AnimatePresence>
            {filteredResources.map((r, i) => (
              <motion.tr 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: i * 0.02 }}
                key={r.resourceId} 
                className="hover:bg-paper/50 transition-colors duration-150 group"
              >
                <td className="px-4 py-3 font-mono text-xs text-ink/50 transition-transform group-hover:translate-x-1 duration-200">{r.resourceId}</td>
                <td className="px-4 py-3 font-medium text-ink">{r.resourceName}</td>
                <td className="px-4 py-3 text-ink/70">{r.resourceType?.typeName || '—'}</td>
                <td className="px-4 py-3 text-ink/70">{r.department?.departmentName || 'Institute (Shared)'}</td>
                <td className="px-4 py-3 text-ink/60">{r.block?.blockCode ? `Block ${r.block.blockCode}` : '—'}</td>
                <td className="px-4 py-3 text-ink/60">{r.floor || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink/70">{r.capacityOrAreaSqm || '—'}</td>
                <td className="px-4 py-3">
                  <span className={r.status === 'Active' ? 'text-forest font-medium' : 'text-ink/40'}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleOpenEdit(r)}
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleStatus(r)}
                      className="text-xs font-medium text-ink/60 hover:text-ink hover:underline"
                    >
                      {r.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
            </AnimatePresence>
            {filteredResources.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink/50">
                  No resources match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </motion.div>

      {/* Edit Resource Modal */}
      <AnimatePresence>
      {editingResource && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-line"
          >
            <h3 className="font-display text-lg font-semibold text-navy">
              Edit Resource: {editingResource.resourceId}
            </h3>
            <p className="mt-1 text-xs text-ink/60">Update resource specifications, allocation, and capacity.</p>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Resource Name</label>
                <input
                  required
                  value={editForm.resourceName}
                  onChange={(e) => setEditForm((f) => ({ ...f, resourceName: e.target.value }))}
                  className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Type</label>
                  <select
                    required
                    value={editForm.resourceTypeId}
                    onChange={(e) => setEditForm((f) => ({ ...f, resourceTypeId: e.target.value }))}
                    className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                  >
                    <option value="">Select Type…</option>
                    {resourceTypes.map((t) => (
                      <option key={t.resourceTypeId} value={t.resourceTypeId}>
                        {t.typeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Department</label>
                  <select
                    value={editForm.departmentId}
                    onChange={(e) => setEditForm((f) => ({ ...f, departmentId: e.target.value }))}
                    className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                  >
                    <option value="">No department (Institute-owned)</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.departmentName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Block</label>
                  <select
                    value={editForm.blockId}
                    onChange={(e) => setEditForm((f) => ({ ...f, blockId: e.target.value }))}
                    className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                  >
                    <option value="">Select Block…</option>
                    {blocks.map((b) => (
                      <option key={b.blockId} value={b.blockId}>
                        {b.blockName || b.blockCode}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Floor</label>
                  <input
                    placeholder="e.g. Ground, 1, 2"
                    value={editForm.floor}
                    onChange={(e) => setEditForm((f) => ({ ...f, floor: e.target.value }))}
                    className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink/70 mb-1">Capacity</label>
                  <input
                    type="number"
                    placeholder="Seats"
                    value={editForm.capacityOrAreaSqm}
                    onChange={(e) => setEditForm((f) => ({ ...f, capacityOrAreaSqm: e.target.value }))}
                    className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                  />
                </div>
              </div>

              {editError && (
                <p className="mt-2 text-xs font-medium text-brick bg-brick-light p-2 rounded">
                  {editError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingResource(null)}
                  disabled={editSubmitting}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
                >
                  {editSubmitting ? 'Updating…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
