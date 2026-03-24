import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'

// Library pages
import LibraryLayout from '@/pages/library/LibraryLayout'
import LibraryHome from '@/pages/library/LibraryHome'
import LibraryLogin from '@/pages/library/LibraryLogin'
import Terms from '@/pages/library/Terms'
import Privacy from '@/pages/library/Privacy'

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
import AdminFolders from '@/pages/admin/AdminFolders'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Library */}
          <Route path="/" element={<LibraryLayout />}>
            <Route index element={<LibraryHome />} />
            <Route path="library/login" element={<LibraryLogin />} />
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
            <Route path="folders" element={<AdminFolders />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
