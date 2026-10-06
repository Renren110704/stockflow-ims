import api from './api';

const locationService = {
  // params: { archived: true } lists archived locations (admin only).
  getLocations: async (params) => {
    const { data } = await api.get('/locations', { params });
    return data;
  },
  createLocation: async (payload) => {
    const { data } = await api.post('/locations', payload);
    return data;
  },
  updateLocation: async (id, payload) => {
    const { data } = await api.put(`/locations/${id}`, payload);
    return data;
  },
  // Archives the location (soft delete). Reversible via restoreLocation.
  deleteLocation: async (id) => {
    const { data } = await api.delete(`/locations/${id}`);
    return data;
  },
  restoreLocation: async (id) => {
    const { data } = await api.post(`/locations/${id}/restore`);
    return data;
  },
  // Irreversible. Only works on an already-archived location.
  permanentlyDeleteLocation: async (id) => {
    const { data } = await api.delete(`/locations/${id}/permanent`);
    return data;
  },
};

export default locationService;
