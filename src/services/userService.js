import api from './api';

const userService = {
  // params: { archived: true } lists archived (deactivated) users.
  getUsers: async (params) => {
    const { data } = await api.get('/users', { params });
    return data;
  },
  getUser: async (id) => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },
  updateUser: async (id, payload) => {
    const { data } = await api.put(`/users/${id}`, payload);
    return data;
  },
  // Archives (deactivates) the user: they can no longer log in. Reversible.
  archiveUser: async (id) => {
    const { data } = await api.delete(`/users/${id}`);
    return data;
  },
  restoreUser: async (id) => {
    const { data } = await api.post(`/users/${id}/restore`);
    return data;
  },
  // Irreversible. Only works on an already-archived user with no history.
  permanentlyDeleteUser: async (id) => {
    const { data } = await api.delete(`/users/${id}/permanent`);
    return data;
  },
};

export default userService;
