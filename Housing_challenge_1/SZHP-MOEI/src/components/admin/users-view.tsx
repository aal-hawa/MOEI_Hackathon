'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { useAuthStore } from '@/lib/auth-store'
import { t } from '@/lib/i18n'
import { hasPermission, getRoleLabel, getDefaultPermissions, ROLE_PERMISSIONS } from '@/lib/rbac'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrollFade } from '@/components/ui/scroll-fade'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import {
  Briefcase, Plus, Shield, UserCheck, UserX, Edit, Mail, Building2,
  Crown, Eye, EyeOff, Search, X, SlidersHorizontal, Clock, Lock,
  Unlock, Trash2, Save, UserPlus, Phone, Globe, ChevronRight,
  CheckCircle, AlertCircle, XCircle, LockKeyhole
} from 'lucide-react'

interface EmployeeUser {
  id: string
  email: string
  firstnameEN: string
  lastnameEN: string
  firstnameAR: string | null
  lastnameAR: string | null
  role: string
  department: string | null
  isActive: boolean
  permissions: string[]
  lastLoginAt: string | null
  createdAt: string
  isLocked?: boolean
  twoFactorEnabled?: boolean
  loginHistory?: Array<{ id: string; loginAt: string; ipAddress: string | null; userAgent: string | null; authMethod?: string; success?: boolean }>
  recentAuditActions?: Array<{ id: string; action: string; category: string; details: string | null; timestamp: string }>
}

const ROLES = ['employee', 'reviewer', 'manager', 'admin', 'superadmin']
const DEPARTMENTS = [
  { value: 'housing_finance', en: 'Housing Finance', ar: 'تمويل الإسكان' },
  { value: 'risk_assessment', en: 'Risk Assessment', ar: 'تقييم المخاطر' },
  { value: 'compliance', en: 'Compliance', ar: 'الامتثال' },
  { value: 'management', en: 'Management', ar: 'الإدارة' },
]

// Role config with colors and icons
const ROLE_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; icon: React.ElementType; label: { en: string; ar: string } }> = {
  superadmin: { color: 'text-red-600', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20', icon: Crown, label: { en: 'Super Admin', ar: 'مدير عام' } },
  admin: { color: 'text-ae-gold-600', bgColor: 'bg-ae-gold-500/10', borderColor: 'border-ae-gold-500/20', icon: Shield, label: { en: 'Admin', ar: 'مسؤول' } },
  manager: { color: 'text-purple-600', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20', icon: Briefcase, label: { en: 'Manager', ar: 'مدير' } },
  reviewer: { color: 'text-blue-600', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20', icon: Eye, label: { en: 'Reviewer', ar: 'مراجع' } },
  employee: { color: 'text-green-600', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20', icon: UserCheck, label: { en: 'Employee', ar: 'موظف' } },
}

export function UsersView() {
  const { language } = useAppStore()
  const { userRole, permissions, accessToken } = useAuthStore()
  const isAr = language === 'ar'

  const [employees, setEmployees] = useState<EmployeeUser[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Dialog states
  const [addEditDialogOpen, setAddEditDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<EmployeeUser | null>(null)
  const [detailEmployee, setDetailEmployee] = useState<EmployeeUser | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ employee: EmployeeUser; action: 'activate' | 'deactivate' } | null>(null)

  // Form state
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formFirstnameEN, setFormFirstnameEN] = useState('')
  const [formLastnameEN, setFormLastnameEN] = useState('')
  const [formFirstnameAR, setFormFirstnameAR] = useState('')
  const [formLastnameAR, setFormLastnameAR] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formRole, setFormRole] = useState('employee')
  const [formDepartment, setFormDepartment] = useState('housing_finance')
  const [formPermissions, setFormPermissions] = useState<string[]>([])
  const [formSaving, setFormSaving] = useState(false)
  const [formTab, setFormTab] = useState<'basic' | 'permissions'>('basic')

  // Permission checks
  const effectivePermissions = (permissions && permissions.length > 0)
    ? permissions
    : getDefaultPermissions(userRole)
  const canManageUsers = hasPermission(effectivePermissions, 'employees.view') || hasPermission(effectivePermissions, '*') || userRole === 'superadmin' || userRole === 'manager'
  const canEditUsers = hasPermission(effectivePermissions, 'employees.manage') || hasPermission(effectivePermissions, '*') || userRole === 'superadmin'
  // Separate check for who can edit permissions specifically
  const canEditPermissions = hasPermission(effectivePermissions, 'employees.manage') || hasPermission(effectivePermissions, '*') || userRole === 'superadmin' || userRole === 'manager'

  const fetchEmployees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/employees')
      if (res.ok) {
        const data = await res.json()
        setEmployees(Array.isArray(data) ? data : data.data || data.users || data.employees || [])
      }
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  const fetchEmployeeDetail = useCallback(async (id: string) => {
    try {
      const res = await authFetch(`/api/employees/${id}`)
      if (res.ok) {
        const data = await res.json()
        const user = data.user || data
        setDetailEmployee({
          ...user,
          loginHistory: data.loginHistory || user.loginHistory || [],
          recentAuditActions: data.recentAuditActions || user.auditActions || [],
        })
      }
    } catch (err) {
      console.error('Failed to fetch employee detail:', err)
    }
  }, [accessToken])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const openAddDialog = () => {
    setEditingEmployee(null)
    setFormEmail('')
    setFormPassword('')
    setFormFirstnameEN('')
    setFormLastnameEN('')
    setFormFirstnameAR('')
    setFormLastnameAR('')
    setFormPhone('')
    setFormRole('employee')
    setFormDepartment('housing_finance')
    setFormPermissions(getDefaultPermissions('employee'))
    setFormTab('basic')
    setAddEditDialogOpen(true)
  }

  const openEditDialog = (emp: EmployeeUser) => {
    setEditingEmployee(emp)
    setFormEmail(emp.email)
    setFormPassword('')
    setFormFirstnameEN(emp.firstnameEN)
    setFormLastnameEN(emp.lastnameEN)
    setFormFirstnameAR(emp.firstnameAR || '')
    setFormLastnameAR(emp.lastnameAR || '')
    setFormPhone('')
    setFormRole(emp.role)
    setFormDepartment(emp.department || 'housing_finance')
    setFormPermissions(emp.permissions || getDefaultPermissions(emp.role))
    setFormTab('basic')
    setAddEditDialogOpen(true)
  }

  const openDetailDialog = (emp: EmployeeUser) => {
    setDetailEmployee(emp)
    setDetailDialogOpen(true)
    fetchEmployeeDetail(emp.id)
  }

  const handleRoleChange = (role: string) => {
    setFormRole(role)
    setFormPermissions(getDefaultPermissions(role))
  }

  const handleSaveEmployee = async () => {
    // Validation
    if (!editingEmployee && (!formEmail || !formPassword || !formFirstnameEN || !formLastnameEN)) {
      toast({ title: isAr ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields', variant: 'destructive' })
      return
    }
    if (editingEmployee && (!formFirstnameEN || !formLastnameEN)) {
      toast({ title: isAr ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields', variant: 'destructive' })
      return
    }

    setFormSaving(true)
    try {
      if (editingEmployee) {
        // Update existing employee
        const payload: Record<string, unknown> = {
          userId: editingEmployee.id,
          role: formRole,
          department: formDepartment,
          permissions: formPermissions,
          performedByUserId: useAuthStore.getState().userProfile?.sub,
        }
        if (formPassword) payload.password = formPassword
        if (formFirstnameEN) payload.firstnameEN = formFirstnameEN
        if (formLastnameEN) payload.lastnameEN = formLastnameEN
        if (formFirstnameAR) payload.firstnameAR = formFirstnameAR
        if (formLastnameAR) payload.lastnameAR = formLastnameAR
        const res = await authFetch('/api/employees', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast({ title: t('admin.users.employeeUpdated', language) })
          setAddEditDialogOpen(false)
          fetchEmployees()
        } else {
          const err = await res.json()
          toast({ title: err.error || 'Failed to update employee', variant: 'destructive' })
        }
      } else {
        // Create new employee
        const res = await fetch('/api/auth/admin-register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
          body: JSON.stringify({
            email: formEmail,
            password: formPassword,
            firstnameEN: formFirstnameEN,
            lastnameEN: formLastnameEN,
            firstnameAR: formFirstnameAR || undefined,
            lastnameAR: formLastnameAR || undefined,
            role: formRole,
            department: formDepartment,
            performedByUserId: useAuthStore.getState().userProfile?.sub,
          }),
        })
        if (res.ok) {
          toast({ title: t('admin.users.employeeCreated', language) })
          setAddEditDialogOpen(false)
          fetchEmployees()
        } else {
          const err = await res.json()
          toast({ title: err.error || 'Failed to create employee', variant: 'destructive' })
        }
      }
    } catch {
      toast({ title: 'Operation failed', variant: 'destructive' })
    } finally {
      setFormSaving(false)
    }
  }

  const handleToggleActive = async (emp: EmployeeUser, activate: boolean) => {
    try {
      const res = await authFetch(`/api/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isActive: activate,
          performedByUserId: useAuthStore.getState().userProfile?.sub,
        }),
      })
      if (res.ok) {
        toast({ title: activate ? t('admin.users.employeeActivated', language) : t('admin.users.employeeDeactivated', language) })
        fetchEmployees()
        if (detailEmployee?.id === emp.id) fetchEmployeeDetail(emp.id)
      } else {
        const err = await res.json()
        toast({ title: err.error || 'Failed to update', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Operation failed', variant: 'destructive' })
    }
    setConfirmAction(null)
  }

  const getDeptLabel = (dept: string | null) => {
    if (!dept) return '-'
    const d = DEPARTMENTS.find(d => d.value === dept)
    return d ? (isAr ? d.ar : d.en) : dept
  }

  const getInitials = (emp: EmployeeUser) => {
    return `${emp.firstnameEN?.charAt(0) || ''}${emp.lastnameEN?.charAt(0) || ''}`
  }

  // Filtering
  const filteredEmployees = employees.filter(e => {
    const matchesSearch = !searchQuery.trim() || 
      `${e.firstnameEN} ${e.lastnameEN} ${e.firstnameAR || ''} ${e.lastnameAR || ''} ${e.email}`.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === 'all' || e.role === roleFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && e.isActive) || 
      (statusFilter === 'inactive' && !e.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  const totalActive = employees.filter(e => e.isActive).length
  const totalInactive = employees.filter(e => !e.isActive).length
  const activeFilterCount = [roleFilter !== 'all', statusFilter !== 'all', searchQuery.trim() !== ''].filter(Boolean).length

  const allPermissionKeys = [...new Set(Object.values(ROLE_PERMISSIONS).flat().filter(p => p !== '*'))]

  // Permission groupings for better display
  const permissionGroups: Record<string, { label: string; keys: string[] }> = {
    dashboard: { label: isAr ? 'لوحة القيادة' : 'Dashboard', keys: ['dashboard'] },
    cases: { label: isAr ? 'الحالات' : 'Cases', keys: ['cases', 'cases.view', 'cases.review', 'cases.approve', 'cases.reject', 'cases.escalate'] },
    employees: { label: isAr ? 'الموظفين' : 'Employees', keys: ['employees.view', 'employees.manage'] },
    workflows: { label: isAr ? 'سير العمل' : 'Workflows', keys: ['workflows'] },
    audit: { label: isAr ? 'المراجعة' : 'Audit', keys: ['audit.view', 'audit.export'] },
    settings: { label: isAr ? 'الإعدادات' : 'Settings', keys: ['settings'] },
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ae-black-700">{t('admin.users.title', language)}</h2>
          <p className="text-sm text-ae-black-400">{t('admin.users.desc', language)}</p>
        </div>
        {canEditUsers && (
          <Button onClick={openAddDialog} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> {t('admin.users.addEmployee', language)}
          </Button>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-ae-gold-200 bg-ae-gold-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-ae-gold-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-ae-gold-700">{employees.length}</div>
              <div className="text-xs text-ae-gold-600">{t('admin.users.totalEmployees', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700">{totalActive}</div>
              <div className="text-xs text-green-600">{t('admin.users.activeEmployees', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <UserX className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700">{totalInactive}</div>
              <div className="text-xs text-red-600">{t('admin.users.inactiveEmployees', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-700">{employees.filter(e => ['admin', 'superadmin'].includes(e.role)).length}</div>
              <div className="text-xs text-purple-600">{isAr ? 'المسؤولون' : 'Admins'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ae-black-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم أو البريد الإلكتروني...' : 'Search by name or email...'}
              className="ps-9 pe-9"
            />
            {searchQuery && (
              <button type="button" className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery('')}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={isAr ? 'جميع الأدوار' : 'All Roles'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الأدوار' : 'All Roles'}</SelectItem>
              {ROLES.map(r => {
                const rc = ROLE_CONFIG[r]
                return <SelectItem key={r} value={r}>{isAr ? rc.label.ar : rc.label.en}</SelectItem>
              })}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={isAr ? 'جميع الحالات' : 'All Statuses'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</SelectItem>
              <SelectItem value="active">{isAr ? 'نشط' : 'Active'}</SelectItem>
              <SelectItem value="inactive">{isAr ? 'غير نشط' : 'Inactive'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {isAr ? `${filteredEmployees.length} من ${employees.length} موظف` : `${filteredEmployees.length} of ${employees.length} employees`}
            </span>
            {roleFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {ROLE_CONFIG[roleFilter] ? (isAr ? ROLE_CONFIG[roleFilter].label.ar : ROLE_CONFIG[roleFilter].label.en) : roleFilter}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setRoleFilter('all')} />
              </Badge>
            )}
            {statusFilter !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {statusFilter === 'active' ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setStatusFilter('all')} />
              </Badge>
            )}
            {searchQuery && (
              <Badge variant="secondary" className="text-xs gap-1">
                &quot;{searchQuery}&quot;
                <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all') }}>
              {isAr ? 'مسح الكل' : 'Clear all'}
            </Button>
          </div>
        )}
      </div>

      {/* Employee List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-ae-black-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-ae-black-100 rounded w-3/4" />
                    <div className="h-3 bg-ae-black-100 rounded w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredEmployees.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-ae-black-400">
            <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">{t('admin.users.noEmployees', language)}</p>
            <p className="text-sm mb-4">{t('admin.users.noEmployeesDesc', language)}</p>
            {canEditUsers && (
              <Button onClick={openAddDialog} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-2">
                <UserPlus className="w-4 h-4" /> {t('admin.users.addEmployee', language)}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredEmployees.map((emp) => {
            const roleConf = ROLE_CONFIG[emp.role] || ROLE_CONFIG.employee
            const RoleIcon = roleConf.icon

            return (
              <motion.div
                key={emp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card className={`group hover:shadow-md transition-all hover:border-ae-gold-300 ${!emp.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    {/* Top: Avatar + Name + Actions */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${roleConf.bgColor} ${roleConf.color}`}>
                          {getInitials(emp)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-ae-black-700 truncate">
                            {isAr && emp.firstnameAR && emp.lastnameAR ? `${emp.firstnameAR} ${emp.lastnameAR}` : `${emp.firstnameEN} ${emp.lastnameEN}`}
                          </div>
                          <div className="text-xs text-ae-black-400 flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{emp.email}</span>
                          </div>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {canEditUsers && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-ae-black-400 hover:text-ae-gold-600" onClick={() => openEditDialog(emp)} title={isAr ? 'تعديل' : 'Edit'}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Badges Row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 gap-0.5 ${roleConf.bgColor} ${roleConf.color} ${roleConf.borderColor}`}>
                        <RoleIcon className="w-3 h-3" />
                        {getRoleLabel(emp.role, language)}
                      </Badge>
                      {emp.department && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-ae-black-500 border-ae-black-200">
                          <Building2 className="w-3 h-3 me-0.5" /> {getDeptLabel(emp.department)}
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${emp.isActive ? 'border-green-500 text-green-600' : 'border-red-400 text-red-500'}`}>
                        {emp.isActive ? <UserCheck className="w-3 h-3 me-0.5" /> : <UserX className="w-3 h-3 me-0.5" />}
                        {emp.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                      </Badge>
                      {emp.isLocked && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-400 text-amber-600">
                          <Lock className="w-3 h-3 me-0.5" /> {isAr ? 'مقفل' : 'Locked'}
                        </Badge>
                      )}
                    </div>

                    {/* Footer: Last Login + View/Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-ae-black-100">
                      <span className="text-[10px] text-ae-black-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {emp.lastLoginAt
                          ? new Date(emp.lastLoginAt).toLocaleDateString(isAr ? 'ar-AE' : 'en-US', { month: 'short', day: 'numeric' })
                          : (isAr ? 'لم يسجل دخول' : 'Never logged in')}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-ae-gold-600 hover:text-ae-gold-700 gap-0.5" onClick={() => openDetailDialog(emp)}>
                          <Eye className="w-3 h-3" /> {isAr ? 'عرض' : 'View'}
                        </Button>
                        {canEditUsers && (
                          emp.isActive ? (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 gap-0.5" onClick={() => setConfirmAction({ employee: emp, action: 'deactivate' })}>
                              <UserX className="w-3 h-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] text-green-500 hover:text-green-600 gap-0.5" onClick={() => setConfirmAction({ employee: emp, action: 'activate' })}>
                              <UserCheck className="w-3 h-3" />
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Employee Detail Dialog - Fixed overflow */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {detailEmployee && (
            <>
              <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
                <DialogTitle className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${ROLE_CONFIG[detailEmployee.role]?.bgColor || 'bg-gray-100'} ${ROLE_CONFIG[detailEmployee.role]?.color || 'text-gray-600'}`}>
                    {getInitials(detailEmployee)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate">{isAr && detailEmployee.firstnameAR ? `${detailEmployee.firstnameAR} ${detailEmployee.lastnameAR}` : `${detailEmployee.firstnameEN} ${detailEmployee.lastnameEN}`}</div>
                    <div className="text-xs font-normal text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{detailEmployee.email}</span>
                    </div>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  {isAr ? 'تفاصيل الموظف وسجل النشاط' : 'Employee details and activity log'}
                </DialogDescription>
              </DialogHeader>

              <ScrollFade className="flex-1 min-h-0">
                <ScrollArea className="h-full">
                  <div className="px-6 py-4 space-y-5">
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.users.role', language)}</span>
                      <div className="mt-1">
                        <Badge variant="outline" className={`${ROLE_CONFIG[detailEmployee.role]?.bgColor} ${ROLE_CONFIG[detailEmployee.role]?.color} ${ROLE_CONFIG[detailEmployee.role]?.borderColor}`}>
                          {getRoleLabel(detailEmployee.role, language)}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.users.department', language)}</span>
                      <div className="mt-1 text-sm font-medium truncate">{getDeptLabel(detailEmployee.department)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{isAr ? 'الحالة' : 'Status'}</span>
                      <div className="mt-1">
                        <Badge variant="outline" className={detailEmployee.isActive ? 'border-green-500 text-green-600' : 'border-red-400 text-red-500'}>
                          {detailEmployee.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'غير نشط' : 'Inactive')}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.users.lastLogin', language)}</span>
                      <div className="mt-1 text-sm font-medium truncate">{detailEmployee.lastLoginAt ? new Date(detailEmployee.lastLoginAt).toLocaleString(isAr ? 'ar-AE' : 'en-US') : t('admin.users.neverLoggedIn', language)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{isAr ? 'تاريخ الإنشاء' : 'Created'}</span>
                      <div className="mt-1 text-sm font-medium">{new Date(detailEmployee.createdAt).toLocaleDateString(isAr ? 'ar-AE' : 'en-US')}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 border overflow-hidden">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.users.permissions', language)}</span>
                      <div className="mt-1 text-sm font-medium">{(detailEmployee.permissions || []).length} {isAr ? 'صلاحية' : 'permissions'}</div>
                    </div>
                  </div>

                  {/* Permissions List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold text-ae-black-500 uppercase">{t('admin.users.permissions', language)}</h4>
                      {!canEditPermissions && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-amber-300 text-amber-600 gap-1">
                          <LockKeyhole className="w-3 h-3" />
                          {isAr ? 'قراءة فقط' : 'Read-only'}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(permissionGroups).map(([group, { label, keys }]) => {
                        const hasAll = keys.every(k => detailEmployee.permissions?.includes(k) || detailEmployee.permissions?.includes('*'))
                        const hasSome = keys.some(k => detailEmployee.permissions?.includes(k) || detailEmployee.permissions?.includes('*'))
                        return (
                          <div key={group} className={`p-2 rounded border text-xs flex items-center gap-2 overflow-hidden ${hasAll ? 'border-green-200 bg-green-50/50' : hasSome ? 'border-amber-200 bg-amber-50/50' : 'border-ae-black-100 bg-ae-black-50/30'}`}>
                            {hasAll ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" /> : hasSome ? <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-ae-black-300 shrink-0" />}
                            <span className={`truncate ${hasAll ? 'text-green-700 font-medium' : hasSome ? 'text-amber-700' : 'text-ae-black-400'}`}>{label}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Login History */}
                  {detailEmployee.loginHistory && detailEmployee.loginHistory.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-ae-black-500 mb-2 uppercase">{t('admin.users.loginHistory', language)}</h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {detailEmployee.loginHistory.slice(0, 10).map((lh, i) => (
                          <div key={lh.id || i} className="flex items-center justify-between text-xs text-ae-black-400 py-1.5 px-2 rounded border-b border-ae-black-50 hover:bg-ae-black-50/50 gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lh.success !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                              <span className="truncate">{new Date(lh.loginAt).toLocaleString(isAr ? 'ar-AE' : 'en-US')}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {lh.authMethod && <Badge variant="outline" className="text-[9px] h-4 px-1">{lh.authMethod}</Badge>}
                              <span>{lh.ipAddress || '-'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Actions */}
                  {detailEmployee.recentAuditActions && detailEmployee.recentAuditActions.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-ae-black-500 mb-2 uppercase">{isAr ? 'الإجراءات الأخيرة' : 'Recent Actions'}</h4>
                      <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                        {detailEmployee.recentAuditActions.slice(0, 10).map((aa, i) => (
                          <div key={aa.id || i} className="flex items-center gap-2 text-xs text-ae-black-400 py-1.5 px-2 rounded border-b border-ae-black-50 hover:bg-ae-black-50/50 min-w-0">
                            <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{aa.action}</Badge>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 text-ae-black-300 shrink-0">{aa.category}</Badge>
                            <span className="text-ae-black-300 ms-auto shrink-0">{new Date(aa.timestamp).toLocaleString(isAr ? 'ar-AE' : 'en-US')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              </ScrollFade>

              <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
                <div className="flex items-center gap-2 w-full justify-between">
                  <div>
                    {canEditUsers && detailEmployee.isActive && (
                      <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50 gap-1" onClick={() => { setDetailDialogOpen(false); setConfirmAction({ employee: detailEmployee, action: 'deactivate' }) }}>
                        <UserX className="w-3.5 h-3.5" /> {isAr ? 'إلغاء التفعيل' : 'Deactivate'}
                      </Button>
                    )}
                    {canEditUsers && !detailEmployee.isActive && (
                      <Button variant="outline" size="sm" className="text-green-500 border-green-200 hover:bg-green-50 gap-1" onClick={() => { setDetailDialogOpen(false); setConfirmAction({ employee: detailEmployee, action: 'activate' }) }}>
                        <UserCheck className="w-3.5 h-3.5" /> {isAr ? 'تفعيل' : 'Activate'}
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEditUsers && (
                      <Button size="sm" className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-1" onClick={() => { setDetailDialogOpen(false); openEditDialog(detailEmployee) }}>
                        <Edit className="w-3.5 h-3.5" /> {isAr ? 'تعديل' : 'Edit'}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setDetailDialogOpen(false)}>
                      {isAr ? 'إغلاق' : 'Close'}
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog - Fixed overflow with permission access control */}
      <Dialog open={addEditDialogOpen} onOpenChange={setAddEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-ae-gold-500/10 flex items-center justify-center shrink-0">
                {editingEmployee ? <Edit className="w-4 h-4 text-ae-gold-600" /> : <UserPlus className="w-4 h-4 text-ae-gold-600" />}
              </div>
              {editingEmployee ? t('admin.users.editEmployee', language) : t('admin.users.addEmployee', language)}
            </DialogTitle>
            <DialogDescription>
              {editingEmployee
                ? (isAr ? 'تعديل معلومات وصلاحيات الموظف' : 'Update employee information and permissions')
                : (isAr ? 'إضافة موظف جديد إلى النظام' : 'Add a new employee to the system')}
            </DialogDescription>
          </DialogHeader>

          <ScrollFade className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-4 space-y-5">
              {/* Tabs: Basic Info / Permissions */}
              <div className="flex gap-1 p-1 rounded-lg bg-muted">
                <button
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${formTab === 'basic' ? 'bg-white shadow-sm text-ae-black-700' : 'text-ae-black-400 hover:text-ae-black-600'}`}
                  onClick={() => setFormTab('basic')}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  {isAr ? 'المعلومات الأساسية' : 'Basic Info'}
                </button>
                <button
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${formTab === 'permissions' ? 'bg-white shadow-sm text-ae-black-700' : 'text-ae-black-400 hover:text-ae-black-600'}`}
                  onClick={() => setFormTab('permissions')}
                >
                  <Shield className="w-3.5 h-3.5" />
                  {isAr ? 'الصلاحيات' : 'Permissions'}
                  {!canEditPermissions && (
                    <LockKeyhole className="w-3 h-3 text-amber-500" />
                  )}
                </button>
              </div>

              {/* Basic Info Tab */}
              {formTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">{t('admin.users.email', language)} *</Label>
                      <Input
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        placeholder="employee@szhp.gov.ae"
                        disabled={!!editingEmployee}
                        type="email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">{editingEmployee ? t('admin.users.passwordOptional', language) : `${t('admin.users.password', language)} *`}</Label>
                      <Input
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder={editingEmployee ? (isAr ? 'اتركه فارغاً للإبقاء' : 'Leave blank to keep') : (isAr ? 'كلمة مرور قوية' : 'Strong password')}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-xs font-semibold text-ae-black-500 uppercase tracking-wider">{isAr ? 'الاسم بالإنجليزية' : 'English Name'}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">{t('admin.users.firstNameEN', language)} *</Label>
                        <Input value={formFirstnameEN} onChange={(e) => setFormFirstnameEN(e.target.value)} placeholder="Ahmed" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">{t('admin.users.lastNameEN', language)} *</Label>
                        <Input value={formLastnameEN} onChange={(e) => setFormLastnameEN(e.target.value)} placeholder="Al Maktoum" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-ae-black-500 uppercase tracking-wider">{isAr ? 'الاسم بالعربية' : 'Arabic Name'}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">{t('admin.users.firstNameAR', language)}</Label>
                        <Input value={formFirstnameAR} onChange={(e) => setFormFirstnameAR(e.target.value)} placeholder="أحمد" dir="rtl" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground">{t('admin.users.lastNameAR', language)}</Label>
                        <Input value={formLastnameAR} onChange={(e) => setFormLastnameAR(e.target.value)} placeholder="المكتوم" dir="rtl" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">{t('admin.users.role', language)} *</Label>
                      <Select value={formRole} onValueChange={canEditPermissions ? handleRoleChange : undefined}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => {
                            const rc = ROLE_CONFIG[r]
                            return (
                              <SelectItem key={r} value={r}>
                                <span className="flex items-center gap-2">
                                  <rc.icon className={`w-3.5 h-3.5 ${rc.color}`} />
                                  {isAr ? rc.label.ar : rc.label.en}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">{t('admin.users.department', language)} *</Label>
                      <Select value={formDepartment} onValueChange={setFormDepartment}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map(d => (
                            <SelectItem key={d.value} value={d.value}>{isAr ? d.ar : d.en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Role Info Box */}
                  <div className={`p-3 rounded-lg border ${ROLE_CONFIG[formRole]?.bgColor} ${ROLE_CONFIG[formRole]?.borderColor}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {(() => { const Icon = ROLE_CONFIG[formRole]?.icon || Shield; return <Icon className={`w-4 h-4 ${ROLE_CONFIG[formRole]?.color}`} /> })()}
                      <span className={`text-sm font-semibold ${ROLE_CONFIG[formRole]?.color}`}>{isAr ? ROLE_CONFIG[formRole]?.label.ar : ROLE_CONFIG[formRole]?.label.en}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formRole === 'superadmin' && (isAr ? 'صلاحيات كاملة على النظام' : 'Full system access with all permissions')}
                      {formRole === 'admin' && (isAr ? 'إدارة النظام والإعدادات والموظفين' : 'Manage system, settings, and employees')}
                      {formRole === 'manager' && (isAr ? 'مراجعة والموافقة على الحالات وإدارة الفريق' : 'Review/approve cases and manage team')}
                      {formRole === 'reviewer' && (isAr ? 'مراجعة الحالات والتوصيات' : 'Review cases and provide recommendations')}
                      {formRole === 'employee' && (isAr ? 'إدخال البيانات الأساسية والعمليات اليومية' : 'Basic data entry and daily operations')}
                    </p>
                  </div>
                </div>
              )}

              {/* Permissions Tab - with access control */}
              {formTab === 'permissions' && (
                <div className="space-y-4">
                  {/* Access control banner */}
                  {!canEditPermissions && (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start gap-3">
                      <LockKeyhole className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700">{isAr ? 'صلاحيات القراءة فقط' : 'Read-only Permissions'}</p>
                        <p className="text-xs text-amber-600">{isAr ? 'ليس لديك صلاحية لتعديل أذونات الموظفين. يمكنك عرض الصلاحيات الحالية فقط.' : 'You do not have permission to modify employee permissions. You can only view the current permissions.'}</p>
                      </div>
                    </div>
                  )}

                  {canEditPermissions && (
                    <div className="p-3 rounded-lg border border-ae-gold-200 bg-ae-gold-50/50">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-ae-gold-600" />
                        <span className="text-sm font-semibold text-ae-gold-700">{isAr ? 'الصلاحيات' : 'Permissions'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{isAr ? 'الصلاحيات الافتراضية بناءً على الدور. يمكنك تخصيصها أدناه.' : 'Default permissions based on role. You can customize below.'}</p>
                    </div>
                  )}

                  {formPermissions.includes('*') ? (
                    <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-center">
                      <Crown className="w-8 h-8 mx-auto mb-2 text-red-500" />
                      <p className="text-sm font-semibold text-red-700">{isAr ? 'جميع الصلاحيات' : 'All Permissions'}</p>
                      <p className="text-xs text-red-600">{isAr ? 'مدير عام لديه صلاحيات كاملة' : 'Superadmin has full access'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(permissionGroups).map(([group, { label, keys }]) => {
                        const allChecked = keys.every(k => formPermissions.includes(k))
                        const someChecked = keys.some(k => formPermissions.includes(k))
                        return (
                          <div key={group} className={`p-3 rounded-lg border ${canEditPermissions ? 'border-ae-black-100' : 'border-ae-black-100 bg-muted/30'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-ae-black-700">{label}</span>
                              <Badge variant="outline" className={`text-[10px] h-5 ${allChecked ? 'border-green-500 text-green-600' : someChecked ? 'border-amber-500 text-amber-600' : 'border-ae-black-200 text-ae-black-400'}`}>
                                {allChecked ? (isAr ? 'كامل' : 'Full') : someChecked ? (isAr ? 'جزئي' : 'Partial') : (isAr ? 'لا يوجد' : 'None')}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              {keys.map(perm => {
                                const isChecked = formPermissions.includes(perm)
                                return (
                                  <label
                                    key={perm}
                                    className={`flex items-center gap-1.5 text-xs cursor-pointer ${!canEditPermissions ? 'cursor-not-allowed opacity-70' : ''}`}
                                  >
                                    <Checkbox
                                      checked={isChecked}
                                      disabled={!canEditPermissions}
                                      onCheckedChange={(checked) => {
                                        if (!canEditPermissions) return
                                        if (checked) {
                                          setFormPermissions([...formPermissions, perm])
                                        } else {
                                          setFormPermissions(formPermissions.filter(p => p !== perm))
                                        }
                                      }}
                                    />
                                    <span className={isChecked ? 'text-ae-black-700' : 'text-ae-black-400'}>{perm}</span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Current user cannot edit own permissions warning */}
                  {canEditPermissions && editingEmployee && useAuthStore.getState().userProfile?.sub === editingEmployee.id && (
                    <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-700">{isAr ? 'تعديل صلاحياتك الخاصة' : 'Editing Your Own Permissions'}</p>
                        <p className="text-xs text-amber-600">{isAr ? 'أنت تقوم بتعديل صلاحياتك الخاصة. قد تفقد الوصول إذا أزلت صلاحيات مهمة.' : 'You are editing your own permissions. You may lose access if you remove critical permissions.'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
          </ScrollFade>

          <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
            <div className="flex items-center gap-3 w-full justify-end">
              <Button variant="outline" onClick={() => setAddEditDialogOpen(false)}>
                {t('common.cancel', language)}
              </Button>
              <Button
                onClick={handleSaveEmployee}
                disabled={formSaving}
                className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
              >
                {formSaving ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {isAr ? 'جاري الحفظ...' : 'Saving...'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Save className="w-4 h-4" />
                    {editingEmployee ? t('common.save', language) : t('admin.users.addEmployee', language)}
                  </span>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Activate/Deactivate */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.action === 'deactivate' ? t('admin.users.deactivateEmployee', language) : t('admin.users.activateEmployee', language)}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'deactivate' ? t('admin.users.confirmDeactivate', language) : t('admin.users.confirmActivate', language)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', language)}</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.action === 'deactivate' ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}
              onClick={() => confirmAction && handleToggleActive(confirmAction.employee, confirmAction.action === 'activate')}
            >
              {confirmAction?.action === 'deactivate' ? t('admin.users.deactivateEmployee', language) : t('admin.users.activateEmployee', language)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
