import api from './api';

const productService = {
  getProducts: async (params) => {
    const { data } = await api.get('/products', { params });
    return data;
  },
  getProduct: async (id) => {
    const { data } = await api.get(`/products/${id}`);
    return data;
  },
  createProduct: async (payload) => {
    const { data } = await api.post('/products', payload);
    return data;
  },
  updateProduct: async (id, payload) => {
    const { data } = await api.put(`/products/${id}`, payload);
    return data;
  },
  // Archives the product (soft delete). Reversible via restoreProduct.
  deleteProduct: async (id) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  },
  restoreProduct: async (id) => {
    const { data } = await api.post(`/products/${id}/restore`);
    return data;
  },
  // Irreversible. Only works on an already-archived product.
  permanentlyDeleteProduct: async (id) => {
    const { data } = await api.delete(`/products/${id}/permanent`);
    return data;
  },
  bulkArchiveProducts: async (ids) => {
    const { data } = await api.post('/products/bulk-archive', { ids });
    return data;
  },
  bulkReassignCategory: async (ids, category) => {
    const { data } = await api.post('/products/bulk-reassign-category', { ids, category });
    return data;
  },
  bulkImportProducts: async (products) => {
    const { data } = await api.post('/products/bulk-import', { products });
    return data;
  },
  getProductBySku: async (sku) => {
    const { data } = await api.get(`/products/sku/${encodeURIComponent(sku)}`);
    return data;
  },
  getProductStock: async (id) => {
    const { data } = await api.get(`/products/${id}/stock`);
    return data;
  },
  // Signature for uploading a product image straight to Cloudinary.
  getProductImageSignature: async () => {
    const { data } = await api.post('/products/image/signature');
    return data;
  },
};

export default productService;
