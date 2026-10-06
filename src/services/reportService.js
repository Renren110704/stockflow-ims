import api from './api';

const reportService = {
  getInventoryReport: async (params) => {
    const { data } = await api.get('/reports/inventory', { params });
    return data;
  },
};

export default reportService;
