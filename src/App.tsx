import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { AuthProvider } from './context/AuthContext'
import AdminDashboard from './pages/admin/AdminDashboard'
import DoctorDashboard from './pages/doctor/DoctorDashboard'
import DoctorAnalyticsSettingsPage from './pages/doctor-settings/DoctorAnalyticsSettingsPage'
import DoctorAvailabilitySettingsPage from './pages/doctor-settings/DoctorAvailabilitySettingsPage'
import DoctorAvatarSettingsPage from './pages/doctor-settings/DoctorAvatarSettingsPage'
import DoctorProfileSettingsPage from './pages/doctor-settings/DoctorProfileSettingsPage'
import DoctorUnavailableDaysSettingsPage from './pages/doctor-settings/DoctorUnavailableDaysSettingsPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
import BookAppointment from './pages/patient/BookAppointment'
import MyAppointments from './pages/patient/MyAppointments'
import PatientDashboard from './pages/patient/PatientDashboard'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/patient/dashboard"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings/profile"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorProfileSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings/avatar"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorAvatarSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings/availability"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorAvailabilitySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings/unavailable-days"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorUnavailableDaysSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings/analytics"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorAnalyticsSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/patient-dashboard" element={<Navigate to="/patient/dashboard" replace />} />
          <Route path="/doctor-dashboard" element={<Navigate to="/doctor/dashboard" replace />} />
          <Route
            path="/patient/book-appointment"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <BookAppointment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/patient/appointments"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <MyAppointments />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
