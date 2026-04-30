import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'

// User pages
import UserLayout from '@/pages/user/UserLayout'
import UserHome from '@/pages/user/UserHome'
import UserLogin from '@/pages/user/UserLogin'
import Terms from '@/pages/user/Terms'
import Privacy from '@/pages/user/Privacy'

// Vendor pages
import VendorLayout from '@/pages/vendor/VendorLayout'
import VendorLogin from '@/pages/vendor/VendorLogin'
import VendorDashboard from '@/pages/vendor/VendorDashboard'
import VendorProducts from '@/pages/vendor/VendorProducts'
import VendorProfile from '@/pages/vendor/VendorProfile'

// Admin pages
import AdminLayout from '@/pages/admin/AdminLayout'
import AdminLogin from '@/pages/admin/AdminLogin'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import AdminVendors from '@/pages/admin/AdminVendors'
import AdminUsers from '@/pages/admin/AdminUsers'
import AdminFolders from '@/pages/admin/AdminFolders'
import AdminProducts from '@/pages/admin/AdminProducts'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* User */}
          <Route path="/" element={<UserLayout />}>
            <Route index element={<UserHome />} />
            <Route path="user/login" element={<UserLogin />} />
          </Route>

          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Vendor */}
          <Route path="/vendor/login" element={<VendorLogin />} />
          <Route path="/vendor" element={<VendorLayout />}>
            <Route index element={<VendorDashboard />} />
            <Route path="products" element={<VendorProducts />} />
            <Route path="profile" element={<VendorProfile />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="folders" element={<AdminFolders />} />
            <Route path="products" element={<AdminProducts />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
