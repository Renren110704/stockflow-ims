import api from './api';

const purchaseOrderService = {
  getPurchaseOrders: async (params) => {
    const { data } = await api.get('/purchase-orders', { params });
    return data;
  },
  getReorderSuggestions: async () => {
    const { data } = await api.get('/purchase-orders/reorder-suggestions');
    return data;
  },
  createPurchaseOrder: async (payload) => {
    const { data } = await api.post('/purchase-orders', payload);
    return data;
  },
  updatePurchaseOrder: async (id, payload) => {
    const { data } = await api.put(`/purchase-orders/${id}`, payload);
    return data;
  },
  markOrdered: async (id) => {
    const { data } = await api.post(`/purchase-orders/${id}/order`);
    return data;
  },
  cancelPurchaseOrder: async (id) => {
    const { data } = await api.post(`/purchase-orders/${id}/cancel`);
    return data;
  },
  receivePurchaseOrder: async (id, payload = {}) => {
    const { data } = await api.post(`/purchase-orders/${id}/receive`, payload);
    return data;
  },
  deletePurchaseOrder: async (id) => {
    const { data } = await api.delete(`/purchase-orders/${id}`);
    return data;
  },
};

export default purchaseOrderService;
