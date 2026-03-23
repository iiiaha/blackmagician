import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'

// Library pages
import LibraryLayout from '@/pages/library/LibraryLayout'
import LibraryHome from '@/pages/library/LibraryHome'
import LibraryLogin from '@/pages/library/LibraryLogin'

// Vendor pages
import VendorLayout from '@/pages/vendor/VendorLayout'
import VendorLogin from '@/pages/vendor/VendorLogin'
import VendorRegister from '@/pages/vendor/VendorRegister'
import VendorDashboard from '@/pages/vendor/VendorDashboard'

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

          {/* Vendor */}
          <Route path="/vendor" element={<VendorLayout />}>
            <Route index element={<VendorDashboard />} />
            <Route path="login" element={<VendorLogin />} />
            <Route path="register" element={<VendorRegister />} />
          </Route>

          {/* Admin */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="folders/:vendorId" element={<AdminFolders />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
