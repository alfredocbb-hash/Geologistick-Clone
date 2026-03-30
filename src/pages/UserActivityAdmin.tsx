import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, AlertTriangle, Users, ChevronDown, ChevronRight, Search, RefreshCw, Building2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Navigate } from 'react-router-dom';

export default function UserActivityAdmin() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [activitySearch, setActivitySearch] = useState('');
  const [errorSearch, setErrorSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const enabled = !authLoading && isSuperAdmin();

  // Fetch all profiles with tenant info
  const { data: allProfiles = [], isLoading: loadingProfiles, refetch: refetchProfiles } = useQuery({
    queryKey: ['all-user-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, email, nombre, apellido, tenant_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch tenants
      const tenantIds = [...new Set((data || []).map(p => p.tenant_id).filter(Boolean))];
      let tenantMap = new Map<string, string>();
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, nombre')
          .in('id', tenantIds);
        tenantMap = new Map((tenants || []).map(t => [t.id, t.nombre]));
      }

      // Fetch roles
      const userIds = (data || []).map(p => p.user_id);
      let rolesMap = new Map<string, string[]>();
      if (userIds.length > 0) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);
        for (const r of roles || []) {
          const arr = rolesMap.get(r.user_id) || [];
          arr.push(r.role);
          rolesMap.set(r.user_id, arr);
        }
      }

      return (data || []).map(p => ({
        ...p,
        tenant_nombre: p.tenant_id ? tenantMap.get(p.tenant_id) || 'Sin nombre' : 'Sin tenant',
        roles: rolesMap.get(p.user_id) || [],
      }));
    },
    enabled,
  });

  // Fetch activity logs
  const { data: activityLogs = [], isLoading: loadingActivity, refetch: refetchActivity } = useQuery({
    queryKey: ['user-activity-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((data || []).map(l => l.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, email, nombre, apellido, tenant_id')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return (data || []).map(log => ({
        ...log,
        profile: profileMap.get(log.user_id) || null,
      }));
    },
    enabled,
  });

  // Fetch error logs
  const { data: errorLogs = [], isLoading: loadingErrors, refetch: refetchErrors } = useQuery({
    queryKey: ['system-error-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_error_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set((data || []).filter(l => l.user_id).map(l => l.user_id!))];
      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, nombre, apellido')
          .in('user_id', userIds);
        profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      }

      return (data || []).map(log => ({
        ...log,
        profile: log.user_id ? profileMap.get(log.user_id) || null : null,
      }));
    },
    enabled,
  });

  if (authLoading) return null;
  if (!isSuperAdmin()) return <Navigate to="/dashboard" replace />;

  const today = new Date().toDateString();
  const activeToday = new Set(activityLogs.filter(l => new Date(l.created_at).toDateString() === today).map(l => l.user_id)).size;

  // Build last login map from activity logs
  const lastLoginMap = new Map<string, string>();
  for (const log of activityLogs) {
    if (!lastLoginMap.has(log.user_id)) {
      lastLoginMap.set(log.user_id, log.created_at);
    }
  }

  // Unique tenants for filter
  const uniqueTenants = [...new Map(allProfiles.map(p => [p.tenant_id, p.tenant_nombre])).entries()]
    .filter(([id]) => id)
    .sort((a, b) => a[1].localeCompare(b[1]));

  // Filter users
  const filteredUsers = allProfiles.filter(p => {
    if (tenantFilter !== 'all' && p.tenant_id !== tenantFilter) return false;
    if (!userSearch) return true;
    const s = userSearch.toLowerCase();
    return (p.email?.toLowerCase().includes(s) || p.nombre?.toLowerCase().includes(s) || p.apellido?.toLowerCase().includes(s) || p.tenant_nombre?.toLowerCase().includes(s));
  });

  const errorsToday = errorLogs.filter(l => new Date(l.created_at).toDateString() === today).length;
  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const errorsThisWeek = errorLogs.filter(l => new Date(l.created_at).getTime() > oneWeekAgo).length;

  const filteredActivity = activityLogs.filter(l => {
    if (!activitySearch) return true;
    const s = activitySearch.toLowerCase();
    return (l.profile?.email?.toLowerCase().includes(s) || l.profile?.nombre?.toLowerCase().includes(s) || l.action.toLowerCase().includes(s));
  });

  const filteredErrors = errorLogs.filter(l => {
    if (!errorSearch) return true;
    const s = errorSearch.toLowerCase();
    return (l.error_message?.toLowerCase().includes(s) || l.component?.toLowerCase().includes(s) || l.profile?.email?.toLowerCase().includes(s));
  });

  const actionBadge = (action: string) => {
    switch (action) {
      case 'login': return <Badge variant="default" className="bg-green-600">Login</Badge>;
      case 'logout': return <Badge variant="secondary">Logout</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'super_admin': return <Badge key={role} className="bg-destructive text-destructive-foreground text-xs">Super Admin</Badge>;
      case 'admin': return <Badge key={role} className="bg-primary text-primary-foreground text-xs">Admin</Badge>;
      case 'chofer': return <Badge key={role} variant="secondary" className="text-xs">Chofer</Badge>;
      default: return <Badge key={role} variant="outline" className="text-xs">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Actividad y Logs</h1>
        <p className="text-muted-foreground text-sm">Monitor de sesiones de usuario y errores del sistema</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Usuarios</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2"><Activity className="h-4 w-4" /> Actividad</TabsTrigger>
          <TabsTrigger value="errors" className="gap-2"><AlertTriangle className="h-4 w-4" /> Errores</TabsTrigger>
        </TabsList>

        {/* ── USUARIOS TAB ── */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total usuarios</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" />{allProfiles.length}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Activos hoy</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold flex items-center gap-2"><Activity className="h-6 w-6 text-green-600" />{activeToday}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Tenants</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold flex items-center gap-2"><Building2 className="h-6 w-6 text-primary" />{uniqueTenants.length}</div></CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nombre, email o tenant..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tenants</SelectItem>
                {uniqueTenants.map(([id, nombre]) => (
                  <SelectItem key={id} value={id!}>{nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetchProfiles()}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Último acceso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingProfiles ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : filteredUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin usuarios</TableCell></TableRow>
                  ) : filteredUsers.map(user => {
                    const lastLogin = lastLoginMap.get(user.user_id);
                    return (
                      <TableRow key={user.user_id}>
                        <TableCell className="font-medium">{user.nombre || 'Sin nombre'} {user.apellido || ''}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{user.tenant_nombre}</Badge></TableCell>
                        <TableCell><div className="flex gap-1 flex-wrap">{user.roles.length > 0 ? user.roles.map(r => roleBadge(r)) : <span className="text-xs text-muted-foreground">Sin rol</span>}</div></TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {lastLogin
                            ? format(new Date(lastLogin), "dd/MM/yyyy HH:mm", { locale: es })
                            : <span className="text-muted-foreground text-xs">Sin registro</span>
                          }
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ACTIVIDAD TAB ── */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Usuarios activos hoy</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold flex items-center gap-2"><Users className="h-6 w-6 text-primary" />{activeToday}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total registros</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{activityLogs.length}</div></CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por email, nombre o acción..." value={activitySearch} onChange={e => setActivitySearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetchActivity()}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>User Agent</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingActivity ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : filteredActivity.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sin registros</TableCell></TableRow>
                  ) : filteredActivity.map(log => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-medium">{log.profile?.nombre || 'Desconocido'} {log.profile?.apellido || ''}</div>
                        <div className="text-xs text-muted-foreground">{log.profile?.email || log.user_id}</div>
                      </TableCell>
                      <TableCell>{actionBadge(log.action)}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{log.user_agent || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ERRORES TAB ── */}
        <TabsContent value="errors" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Errores hoy</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-destructive" />{errorsToday}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Errores esta semana</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">{errorsThisWeek}</div></CardContent>
            </Card>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por mensaje, componente o email..." value={errorSearch} onChange={e => setErrorSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="icon" onClick={() => refetchErrors()}><RefreshCw className="h-4 w-4" /></Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Componente</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingErrors ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
                  ) : filteredErrors.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Sin errores registrados</TableCell></TableRow>
                  ) : filteredErrors.map(log => (
                    <>
                      <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedErrorId(expandedErrorId === log.id ? null : log.id)}>
                        <TableCell>{expandedErrorId === log.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                        <TableCell>
                          <div className="text-sm">{log.profile?.nombre || log.profile?.email || 'Anónimo'}</div>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate text-sm">{log.error_message}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{log.component || '-'}</Badge></TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}</TableCell>
                      </TableRow>
                      {expandedErrorId === log.id && (
                        <TableRow key={`${log.id}-detail`}>
                          <TableCell colSpan={5} className="bg-muted/30 p-4">
                            <div className="space-y-3 text-sm">
                              <div><span className="font-semibold">URL:</span> {log.url || '-'}</div>
                              <div><span className="font-semibold">User Agent:</span> <span className="text-xs text-muted-foreground">{log.user_agent || '-'}</span></div>
                              {log.error_stack && (
                                <div>
                                  <span className="font-semibold">Stack Trace:</span>
                                  <pre className="mt-1 p-3 bg-background rounded border text-xs overflow-x-auto max-h-[200px] whitespace-pre-wrap">{log.error_stack}</pre>
                                </div>
                              )}
                              {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                                <div>
                                  <span className="font-semibold">Metadata:</span>
                                  <pre className="mt-1 p-3 bg-background rounded border text-xs overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
