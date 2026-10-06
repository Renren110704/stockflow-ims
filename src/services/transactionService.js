import api from './api';

const transactionService = {
  getTransactions: async (params) => {
    const { data } = await api.get('/transactions', { params });
    return data;
  },
  createTransaction: async (payload) => {
    const { data } = await api.post('/transactions', payload);
    return data;
  },
  // Moves stock between locations (total quantity unchanged).
  transferStock: async (payload) => {
    const { data } = await api.post('/transactions/transfer', payload);
    return data;
  },
};

export default transactionService;
