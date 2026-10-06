import api from './api';

const dashboardService = {
  getStats: async () => {
    const { data } = await api.get('/dashboard/stats');
    return data;
  },
  sendLowStockAlertNow: async () => {
    const { data } = await api.post('/dashboard/low-stock-alert/send');
    return data;
  },
};

export default dashboardService;
