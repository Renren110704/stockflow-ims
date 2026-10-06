import { useState, useEffect, useCallback } from 'react';
import productService from '../services/productService';

const DEFAULT_FILTERS = {
  search: '',
  category: '',
  status: '',
  supplier: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  limit: 10,
};

// Encapsulates product-list state (filters + pagination) and the
// fetch/loading/error lifecycle around it, so the page component only
// has to render.
export default function useProducts(initialFilters = {}) {
  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS, ...initialFilters });
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Strip empty-string filters so they don't get sent as literal
      // query params (e.g. ?category= would otherwise match nothing).
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)
      );
      const res = await productService.getProducts(params);
      setProducts(res.data);
      setPagination(res.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Any filter change other than page should reset back to page 1,
  // otherwise the user can land on an out-of-range page with no results.
  const updateFilters = useCallback((partial) => {
    setFilters((prev) => ({
      ...prev,
      ...partial,
      page: Object.prototype.hasOwnProperty.call(partial, 'page') ? partial.page : 1,
    }));
  }, []);

  return { products, pagination, loading, error, filters, updateFilters, refetch: fetchProducts };
}
