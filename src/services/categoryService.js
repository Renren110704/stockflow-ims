import api from './api';

const categoryService = {
  // params: { archived: true } lists archived categories (admin only).
  getCategories: async (params) => {
    const { data } = await api.get('/categories', { params });
    return data;
  },
  createCategory: async (payload) => {
    const { data } = await api.post('/categories', payload);
    return data;
  },
  updateCategory: async (id, payload) => {
    const { data } = await api.put(`/categories/${id}`, payload);
    return data;
  },
  // Archives the category (soft delete). Reversible via restoreCategory.
  deleteCategory: async (id, reassignTo) => {
    const { data } = await api.delete(`/categories/${id}`, { params: reassignTo ? { reassignTo } : undefined });
    return data;
  },
  restoreCategory: async (id) => {
    const { data } = await api.post(`/categories/${id}/restore`);
    return data;
  },
  // Irreversible. Only works on an already-archived category.
  permanentlyDeleteCategory: async (id) => {
    const { data } = await api.delete(`/categories/${id}/permanent`);
    return data;
  },
};

export default categoryService;
