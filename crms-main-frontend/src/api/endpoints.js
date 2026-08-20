import client, { setTokens, clearTokens } from './client';

export const authApi = {
  async login(email, password) {
    const { data } = await client.post('/auth/login', { email, password });
    setTokens(data);
    return data.user;
  },
  logout() {
    clearTokens();
  },
  setPassword: (data) => client.post('/auth/set-password', data).then((r) => r.data),
};

export const usersApi = {
  me: () => client.get('/users/me').then((r) => r.data),
  list: (departmentId) => client.get('/users', { params: { departmentId } }).then((r) => r.data),
  create: (payload) => client.post('/users', payload).then((r) => r.data),
  updateRole: (userId, roleId, departmentId) =>
    client.patch(`/users/${userId}/role`, { roleId, departmentId }).then((r) => r.data),
  updateStatus: (userId, status) =>
    client.patch(`/users/${userId}/status`, { status }).then((r) => r.data),
};

export const masterDataApi = {
  roles: () => client.get('/roles').then((r) => r.data),
  departments: () => client.get('/departments').then((r) => r.data),
  blocks: () => client.get('/blocks').then((r) => r.data),
  resourceTypes: () => client.get('/resource-types').then((r) => r.data),
};

export const resourcesApi = {
  list: (params) => client.get('/resources', { params }).then((r) => r.data),
  liveStatus: (date, startTime, endTime) => client.get('/resources/live-status', { params: { date, startTime, endTime } }).then((r) => r.data),
  availability: (resourceId, date) => client.get(`/resources/${resourceId}/availability`, { params: { date } }).then((r) => r.data),
  get: (resourceId) => client.get(`/resources/${resourceId}`).then((r) => r.data),
  create: (payload) => client.post('/resources', payload).then((r) => r.data),
  update: (id, data) => client.patch(`/resources/${id}`, data).then((r) => r.data),
};

export const bookingsApi = {
  mine: () => client.get('/bookings/my').then((r) => r.data),
  list: (params) => client.get('/bookings', { params }).then((r) => r.data),
  create: (payload) => client.post('/bookings', payload).then((r) => r.data),
  cancel: (id, data) => client.post(`/bookings/${id}/cancel`, data).then((r) => r.data),
};

export const approvalsApi = {
  pending: () => client.get('/approvals/pending').then((r) => r.data),
  approve: (approvalId, remarks) => client.post(`/approvals/${approvalId}/approve`, { remarks }).then((r) => r.data),
  reject: (approvalId, remarks) => client.post(`/approvals/${approvalId}/reject`, { remarks }).then((r) => r.data),
};

export const auditApi = {
  list: (params) => client.get('/audit-logs', { params }).then((r) => r.data),
};

export const timetableApi = {
  sync: () => client.post('/timetable/sync').then((r) => r.data),
};
