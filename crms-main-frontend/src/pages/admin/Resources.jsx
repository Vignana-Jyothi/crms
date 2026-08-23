import { useEffect, useState } from 'react';
import { masterDataApi, resourcesApi, timetableApi } from '../../api/endpoints';

const EMPTY_FORM = {
  resourceId: '',
  resourceName: '',
  resourceTypeId: '',
  departmentId: '',
  blockId: '',
  floor: '',
  capacityOrAreaSqm: '',
  allocationNote: '',
  allocatedSemester: '',
  allocatedBranch: '',
  allocatedSection: '',
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
  
  // Sync state
  const [syncing, setSyncing] = useState(false);

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
        allocatedSemester: form.allocatedSemester || null,
        allocatedBranch: form.allocatedBranch || null,
        allocatedSection: form.allocatedSection || null,
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
      allocatedSemester: r.allocatedSemester || '',
      allocatedBranch: r.allocatedBranch || '',
      allocatedSection: r.allocatedSection || '',
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
        allocatedSemester: editForm.allocatedSemester || null,
        allocatedBranch: editForm.allocatedBranch || null,
        allocatedSection: editForm.allocatedSection || null,
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

  async function handleSync() {
    setSyncing(true);
    setActionAlert(null);
    try {
      const res = await timetableApi.sync();
      setActionAlert({
        type: 'success',
        message: `Successfully synced ${res.totalSynced} class schedules from EduPrime!`,
      });
    } catch (err) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.error || 'Failed to sync with EduPrime.',
      });
    } finally {
      setSyncing(false);
    }
  }

  const filteredResources = resources.filter((r) => {
    const s = searchTerm.toLowerCase();
    return (
      r.resourceName?.toLowerCase().includes(s) ||
      r.resourceId?.toLowerCase().includes(s) ||
      r.resourceType?.typeName?.toLowerCase().includes(s) ||
      r.department?.departmentName?.toLowerCase().includes(s) ||
      r.block?.blockCode?.toLowerCase().includes(s) ||
      r.block?.blockName?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
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
          <button
            onClick={handleSync}
            disabled={syncing}
            className="rounded bg-sky-100 px-4 py-2 text-sm font-semibold text-navy hover:bg-sky-200 disabled:opacity-60 whitespace-nowrap"
          >
            {syncing ? 'Syncing...' : 'Sync EduPrime'}
          </button>
          <button
            onClick={() => {
              setShowForm((s) => !s);
              setError('');
            }}
            className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark whitespace-nowrap"
          >
            {showForm ? 'Cancel' : '+ Add resource'}
          </button>
        </div>
      </div>

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

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-line bg-white p-5">
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

          <div className="mt-4 pt-4 border-t border-line">
            <h4 className="text-xs font-semibold text-navy mb-3 uppercase tracking-wider">EduPrime Timetable Mapping</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                placeholder="Semester Code (e.g. BT25290203)"
                value={form.allocatedSemester}
                onChange={(e) => setForm((f) => ({ ...f, allocatedSemester: e.target.value }))}
                className="rounded border border-line px-3 py-2 text-sm"
              />
              <input
                placeholder="Branch (e.g. CSE)"
                value={form.allocatedBranch}
                onChange={(e) => setForm((f) => ({ ...f, allocatedBranch: e.target.value }))}
                className="rounded border border-line px-3 py-2 text-sm"
              />
              <input
                placeholder="Section (e.g. A)"
                value={form.allocatedSection}
                onChange={(e) => setForm((f) => ({ ...f, allocatedSection: e.target.value }))}
                className="rounded border border-line px-3 py-2 text-sm"
              />
            </div>
          </div>

          {error && <p className="mt-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save resource'}
          </button>
        </form>
      )}

      {/* Inventory Table with Block, Floor, and Capacity */}
      <>
        {/* Desktop Table View */}
        <div className="mt-6 hidden md:block overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink/50">
            <tr>
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
            {filteredResources.map((r) => (
              <tr key={r.resourceId} className="hover:bg-paper/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">
                    {r.resourceId?.startsWith('RM-') ? (
                      r.resourceName
                    ) : (
                      <>
                        {r.resourceId}
                        {r.resourceName && r.resourceName !== r.resourceId && (
                          <span className="block text-xs font-normal text-ink/70 mt-0.5">{r.resourceName}</span>
                        )}
                      </>
                    )}
                  </div>
                </td>
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
              </tr>
            ))}
            {filteredResources.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink/50">
                  No resources match your search.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mt-6 block md:hidden space-y-4">
          {filteredResources.map((r) => (
            <div key={r.resourceId} className="rounded-lg border border-line bg-white p-4 shadow-sm flex flex-col gap-2">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-navy text-base">
                    {r.resourceId?.startsWith('RM-') ? (
                      r.resourceName
                    ) : (
                      <>
                        {r.resourceId}
                        {r.resourceName && r.resourceName !== r.resourceId && (
                          <span className="block text-sm font-normal text-ink/70 mt-0.5">{r.resourceName}</span>
                        )}
                      </>
                    )}
                  </h3>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${r.status === 'Active' ? 'bg-forest-light text-forest' : 'bg-ink/10 text-ink/50'}`}>
                  {r.status}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-sm text-ink/80 mt-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-ink/50 uppercase tracking-wide">Type</span>
                  <span className="font-medium">{r.resourceType?.typeName || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-ink/50 uppercase tracking-wide">Department</span>
                  <span className="font-medium">{r.department?.departmentName || 'Shared'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-ink/50 uppercase tracking-wide">Location</span>
                  <span className="font-medium">{r.block?.blockCode ? `Blk ${r.block.blockCode}` : '—'} {r.floor ? `· Flr ${r.floor}` : ''}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-ink/50 uppercase tracking-wide">Capacity</span>
                  <span className="font-mono font-medium">{r.capacityOrAreaSqm || '—'}</span>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-line flex justify-end gap-3">
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
            </div>
          ))}
          {filteredResources.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink/50 bg-white rounded-lg border border-line shadow-sm">
              No resources match your search.
            </div>
          )}
        </div>
      </>

      {/* Edit Resource Modal */}
      {editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-line">
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

              <div className="pt-2 border-t border-line mt-4">
                <h4 className="text-[10px] font-bold text-navy mb-2 uppercase tracking-wider">EduPrime Timetable Mapping</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Semester</label>
                    <input
                      placeholder="e.g. BT25290203"
                      value={editForm.allocatedSemester}
                      onChange={(e) => setEditForm((f) => ({ ...f, allocatedSemester: e.target.value }))}
                      className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Branch</label>
                    <input
                      placeholder="e.g. CSE"
                      value={editForm.allocatedBranch}
                      onChange={(e) => setEditForm((f) => ({ ...f, allocatedBranch: e.target.value }))}
                      className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ink/70 mb-1">Section</label>
                    <input
                      placeholder="e.g. A"
                      value={editForm.allocatedSection}
                      onChange={(e) => setEditForm((f) => ({ ...f, allocatedSection: e.target.value }))}
                      className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                    />
                  </div>
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
          </div>
        </div>
      )}
    </div>
  );
}
