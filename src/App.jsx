import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeModeProvider } from './context/ThemeModeContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Dashboard from './pages/dashboard/Dashboard';
import ProductList from './pages/products/ProductList';
import CategoryList from './pages/categories/CategoryList';
import TransactionList from './pages/transactions/TransactionList';
import LocationList from './pages/locations/LocationList';
import PurchaseOrderList from './pages/purchaseOrders/PurchaseOrderList';
import Reports from './pages/reports/Reports';
import ScanProduct from './pages/scan/ScanProduct';
import Profile from './pages/profile/Profile';
import UserList from './pages/users/UserList';
import NotFound from './pages/NotFound';

function App() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            <Route
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/products" element={<ProductList />} />
              <Route path="/categories" element={<CategoryList />} />
              <Route path="/transactions" element={<TransactionList />} />
              <Route path="/locations" element={<LocationList />} />
              <Route path="/purchase-orders" element={<PurchaseOrderList />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/scan" element={<ScanProduct />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/users"
                element={
                  <ProtectedRoute roles={['admin']}>
                    <UserList />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

export default App;
