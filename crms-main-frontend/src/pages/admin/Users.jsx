import { useEffect, useState } from 'react';
import { masterDataApi, usersApi, authApi } from '../../api/endpoints';

const EMPTY_FORM = { name: '', email: '', phone: '', roleId: '', departmentId: '' };

export default function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [actionAlert, setActionAlert] = useState(null); // { type: 'success' | 'error', message: string }
  const [submitting, setSubmitting] = useState(false);
  const [tempPasswordFor, setTempPasswordFor] = useState(null);

  // Password Reset Modal State
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  function refresh() {
    usersApi
      .list()
      .then(setUsers)
      .catch((err) => {
        setActionAlert({
          type: 'error',
          message: err.response?.data?.error || 'Failed to load users list.',
        });
      });
  }

  useEffect(() => {
    refresh();
    masterDataApi.roles().then(setRoles).catch(() => {});
    masterDataApi.departments().then(setDepartments).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setActionAlert(null);
    setSubmitting(true);
    try {
      const created = await usersApi.create({
        ...form,
        roleId: form.roleId ? Number(form.roleId) : undefined,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      });
      setTempPasswordFor(created);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setActionAlert({ type: 'success', message: `User "${created.name}" created successfully.` });
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create user.');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(userId, roleId, departmentId) {
    setActionAlert(null);
    try {
      await usersApi.updateRole(userId, Number(roleId), departmentId ? Number(departmentId) : null);
      setActionAlert({ type: 'success', message: 'User role/department updated successfully.' });
      refresh();
    } catch (err) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update user role/department.',
      });
    }
  }

  async function toggleStatus(user) {
    setActionAlert(null);
    const nextStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await usersApi.updateStatus(user.userId, nextStatus);
      setActionAlert({
        type: 'success',
        message: `User status changed to ${nextStatus} for ${user.name}.`,
      });
      refresh();
    } catch (err) {
      setActionAlert({
        type: 'error',
        message: err.response?.data?.error || 'Failed to update user status.',
      });
    }
  }

  async function handlePasswordResetSubmit(e) {
    e.preventDefault();
    setResetPasswordError('');
    if (newPassword.length < 8) {
      setResetPasswordError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetPasswordError('Passwords do not match.');
      return;
    }

    setResetPasswordSubmitting(true);
    try {
      await authApi.setPassword({ userId: resetPasswordUser.userId, newPassword });
      setActionAlert({
        type: 'success',
        message: `Password for "${resetPasswordUser.name}" reset successfully.`,
      });
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setResetPasswordError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setResetPasswordSubmitting(false);
    }
  }

  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter((u) => {
    const s = searchTerm.toLowerCase();
    return (
      u.name?.toLowerCase().includes(s) ||
      u.email?.toLowerCase().includes(s) ||
      u.phone?.toLowerCase().includes(s) ||
      u.department?.departmentName?.toLowerCase().includes(s) ||
      u.role?.roleName?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-navy">Users</h1>
          <p className="mt-1 text-sm text-ink/60">{users.length} accounts.</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded border border-line px-3 py-2 text-sm w-full md:w-64"
          />
          <button
            onClick={() => {
              setShowForm((s) => !s);
              setError('');
            }}
            className="w-full md:w-auto rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark whitespace-nowrap text-center"
          >
            {showForm ? 'Cancel' : '+ Add user'}
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

      {tempPasswordFor && (
        <div className="mt-6 rounded-lg border border-amber/40 bg-amber-light p-4 text-sm">
          <p className="font-medium text-ink">
            {tempPasswordFor.name} was created. Share this temporary password with them directly —
            it will not be shown again:
          </p>
          <p className="mt-2 font-mono text-base font-semibold text-navy">{tempPasswordFor.tempPassword}</p>
          <button onClick={() => setTempPasswordFor(null)} className="mt-2 text-xs text-ink/50 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-6 rounded-lg border border-line bg-white p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <input
              required
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Phone (10-digit)"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            />
            <select
              value={form.roleId}
              onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            >
              <option value="">Role… (defaults to Requester)</option>
              {roles.map((r) => (
                <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
              ))}
            </select>
            <select
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="rounded border border-line px-3 py-2 text-sm"
            >
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
              ))}
            </select>
          </div>

          {error && <p className="mt-4 rounded bg-brick-light px-3 py-2 text-sm text-brick">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 rounded bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
          >
            {submitting ? 'Creating…' : 'Create user'}
          </button>
        </form>
      )}

      <>
        {/* Desktop Table View */}
        <div className="mt-6 hidden md:block overflow-x-auto rounded-lg border border-line bg-white shadow-sm">
          <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink/50">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredUsers.map((u) => (
              <tr key={u.userId} className="hover:bg-paper/30">
                <td className="px-4 py-3 font-medium text-ink">{u.name}</td>
                <td className="px-4 py-3 text-ink/60">
                  <div className="font-mono text-xs">{u.phone}</div>
                  {u.email && <div className="text-xs text-ink/40">{u.email}</div>}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.roleId || ''}
                    onChange={(e) => changeRole(u.userId, e.target.value, u.departmentId)}
                    className="rounded border border-line px-2 py-1 text-xs"
                  >
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.departmentId || ''}
                    onChange={(e) => changeRole(u.userId, u.roleId, e.target.value)}
                    className="rounded border border-line px-2 py-1 text-xs max-w-[180px] truncate"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span className={u.status === 'Active' ? 'text-forest font-medium' : 'text-ink/40'}>{u.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => {
                        setResetPasswordUser(u);
                        setNewPassword('');
                        setConfirmPassword('');
                        setResetPasswordError('');
                      }}
                      className="text-xs font-semibold text-amber-700 hover:underline"
                    >
                      Reset Password
                    </button>
                    <button onClick={() => toggleStatus(u)} className="text-xs font-medium text-navy hover:underline">
                      {u.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-ink/50">
                  No users match your search.
                </td>
              </tr>
            )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="mt-6 block md:hidden space-y-4">
          {filteredUsers.map((u) => (
            <div key={u.userId} className="rounded-lg border border-line bg-white p-4 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-navy text-base">{u.name}</h3>
                  <p className="mt-0.5 text-xs text-ink/60">{u.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-ink/50">{u.phone}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${u.status === 'Active' ? 'bg-forest-light text-forest' : 'bg-ink/10 text-ink/50'}`}>
                  {u.status}
                </span>
              </div>

              <div className="flex flex-col gap-3 mt-1">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink/50 mb-1 tracking-wide">Role</label>
                  <select
                    value={u.roleId || ''}
                    onChange={(e) => changeRole(u.userId, e.target.value, u.departmentId)}
                    className="w-full rounded border border-line px-2 py-1.5 text-xs focus:border-navy"
                  >
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-ink/50 mb-1 tracking-wide">Department</label>
                  <select
                    value={u.departmentId || ''}
                    onChange={(e) => changeRole(u.userId, u.roleId, e.target.value)}
                    className="w-full rounded border border-line px-2 py-1.5 text-xs focus:border-navy"
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-2 pt-3 border-t border-line flex justify-end gap-3">
                <button
                  onClick={() => {
                    setResetPasswordUser(u);
                    setNewPassword('');
                    setConfirmPassword('');
                    setResetPasswordError('');
                  }}
                  className="text-xs font-semibold text-amber-700 hover:underline"
                >
                  Reset Password
                </button>
                <button onClick={() => toggleStatus(u)} className="text-xs font-medium text-navy hover:underline">
                  {u.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                </button>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-ink/50 bg-white rounded-lg border border-line shadow-sm">
              No users match your search.
            </div>
          )}
        </div>
      </>

      {/* Password Reset Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-line">
            <h3 className="font-display text-lg font-semibold text-navy">
              Reset Password: {resetPasswordUser.name}
            </h3>
            <p className="mt-1 text-xs text-ink/60">
              Set a new secure password for this account. Must be at least 8 characters long.
            </p>

            <form onSubmit={handlePasswordResetSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Enter new password…"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (resetPasswordError) setResetPasswordError('');
                  }}
                  className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink/70 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Confirm new password…"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (resetPasswordError) setResetPasswordError('');
                  }}
                  className="w-full rounded border border-line p-2 text-xs focus:border-navy focus:outline-none"
                />
              </div>

              {resetPasswordError && (
                <p className="mt-2 text-xs font-medium text-brick bg-brick-light p-2 rounded">
                  {resetPasswordError}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  disabled={resetPasswordSubmitting}
                  className="rounded-lg border border-line px-4 py-2 text-xs font-medium text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetPasswordSubmitting}
                  className="rounded-lg bg-navy px-4 py-2 text-xs font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
                >
                  {resetPasswordSubmitting ? 'Resetting…' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
