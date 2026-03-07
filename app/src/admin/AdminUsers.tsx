import { useEffect, useState, useCallback } from 'react';
import {
  Users, ChevronLeft, ChevronRight, Shield, ShieldCheck, Ban, UserCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { adminApi } from '@/api/client';
import { toast } from 'sonner';

export function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.users(page);
      setUsers(res.users);
      setTotal(res.pagination?.total || res.users.length);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);
  const totalPages = Math.ceil(total / limit);

  async function handleRoleChange(userId: number, role: string) {
    try {
      await adminApi.updateUserRole(String(userId), role as 'user' | 'admin');
      toast.success('Role updated');
      load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  async function handleStatusToggle(userId: number, isActive: boolean) {
    try {
      await adminApi.updateUserStatus(String(userId), isActive);
      toast.success(isActive ? 'User activated' : 'User deactivated');
      load();
    } catch (err: any) { toast.error(err.message || 'Failed'); }
  }

  function roleBadge(role: string) {
    const map: Record<string, { variant: 'default' | 'secondary' | 'destructive'; icon: any }> = {
      admin: { variant: 'destructive', icon: ShieldCheck },
      user: { variant: 'secondary', icon: Shield },
    };
    const r = map[role] || map.user;
    return (
      <Badge variant={r.variant} className="gap-1">
        <r.icon className="h-3 w-3" /> {role}
      </Badge>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Users</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" /> {total} Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse h-14 bg-muted rounded" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4">User</th>
                    <th className="pb-3 pr-4 hidden md:table-cell">Role</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">Reviews</th>
                    <th className="pb-3 pr-4 hidden lg:table-cell">Wishlist</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
                            alt={user.name}
                            className="w-8 h-8 rounded-full bg-muted"
                          />
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 hidden md:table-cell">{roleBadge(user.role)}</td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground">{user.reviewCount || 0}</td>
                      <td className="py-3 pr-4 hidden lg:table-cell text-muted-foreground">{user.wishlistCount || 0}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Select
                            value={user.role}
                            onValueChange={(v) => handleRoleChange(user.id, v)}
                          >
                            <SelectTrigger className="w-24 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={user.isActive ? 'text-orange-500' : 'text-green-600'}
                            onClick={() => handleStatusToggle(user.id, !user.isActive)}
                            title={user.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {user.isActive ? <Ban className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
