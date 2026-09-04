"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  Shield,
  Mail,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeTime } from "@/lib/utils";
import { useCsrfToken } from "@/hooks/useCsrfToken";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  // GET /api/admin/users returns these flattened on each user
  campaignsLed: number;
  donationsMade: number;
}

interface RoleConfigEntry {
  label: string;
  color: string;
  bgColor: string;
}

const ROLE_CONFIG: Record<string, RoleConfigEntry> = {
  DONOR: {
    label: "Donor",
    color: "text-secondary",
    bgColor: "bg-white/[0.08]",
  },
  PLAYER: {
    label: "Player",
    color: "text-success-dark",
    bgColor: "bg-[rgba(34,196,139,.14)]",
  },
  TEAM_MEMBER: {
    label: "Team Member",
    color: "text-secondary",
    bgColor: "bg-white/[0.08]",
  },
  CAMPAIGN_LEADER: {
    label: "Campaign Leader",
    color: "text-secondary",
    bgColor: "bg-white/[0.08]",
  },
  GUARDIAN: {
    label: "Guardian",
    color: "text-secondary",
    bgColor: "bg-white/[0.08]",
  },
  ADMIN: {
    label: "Admin",
    color: "text-[#E8A33D]",
    bgColor: "bg-[rgba(232,163,61,.14)]",
  },
  BANK_ADMIN: {
    label: "Bank Admin",
    color: "text-destructive",
    bgColor: "bg-[rgba(242,97,75,.14)]",
  },
};

function getRoleConfig(role: string): RoleConfigEntry {
  return (
    ROLE_CONFIG[role] ?? {
      label: role,
      color: "text-muted-foreground",
      bgColor: "bg-white/[0.06]",
    }
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const { csrfToken } = useCsrfToken();

  useEffect(() => {
    fetchUsers();
  }, [roleFilter]);

  async function fetchUsers() {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (roleFilter !== "ALL") params.set("role", roleFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        throw new Error(data.error || "Failed to load users");
      }
    } catch (err) {
      console.error("Error fetching users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange() {
    if (!selectedUser || !newRole) return;

    try {
      setActionLoading(true);
      const response = await fetch(`/api/admin/users/${selectedUser.id}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to update user role");
      }

      // Refresh the users list
      await fetchUsers();

      setIsRoleDialogOpen(false);
      setSelectedUser(null);
      setNewRole("");
    } catch (err) {
      console.error("Error updating user role:", err);
      alert(err instanceof Error ? err.message : "Failed to update user role");
    } finally {
      setActionLoading(false);
    }
  }

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    const matchesSearch =
      fullName.includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const stats = {
    total: users.length,
    verified: users.filter((u) => u.emailVerified).length,
    unverified: users.filter((u) => !u.emailVerified).length,
    donors: users.filter((u) => u.role === "DONOR").length,
    leaders: users.filter((u) => u.role === "CAMPAIGN_LEADER").length,
    admins: users.filter((u) => u.role === "ADMIN" || u.role === "BANK_ADMIN").length,
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Users className="w-8 h-8" />
          User Management
        </h1>
        <p className="text-muted-foreground">
          Manage users, roles, and permissions
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Total Users</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{stats.verified}</div>
            <div className="text-sm text-muted-foreground">Verified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-[#E8A33D]">{stats.unverified}</div>
            <div className="text-sm text-muted-foreground">Unverified</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-secondary">{stats.donors}</div>
            <div className="text-sm text-muted-foreground">Donors</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-secondary">{stats.leaders}</div>
            <div className="text-sm text-muted-foreground">Leaders</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-warning">{stats.admins}</div>
            <div className="text-sm text-muted-foreground">Admins</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="ALL">All Roles</option>
                <option value="DONOR">Donors</option>
                <option value="PLAYER">Players</option>
                <option value="TEAM_MEMBER">Team Members</option>
                <option value="CAMPAIGN_LEADER">Campaign Leaders</option>
                <option value="GUARDIAN">Guardians</option>
                <option value="ADMIN">Admins</option>
                <option value="BANK_ADMIN">Bank Admins</option>
              </select>
              <Button variant="outline" size="icon">
                <Filter className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-warning-light border border-warning rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          <p className="text-warning-dark font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchUsers()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Activity</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Joined</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const roleConfig = getRoleConfig(user.role);

                  return (
                    <tr key={user.id} className="border-b hover:bg-muted">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-semibold text-foreground">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${roleConfig.bgColor} ${roleConfig.color} font-medium`}
                        >
                          {roleConfig.label}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {user.emailVerified ? (
                          <span className="flex items-center gap-1 text-success text-sm">
                            <CheckCircle className="w-4 h-4" />
                            Verified
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#E8A33D] text-sm">
                            <XCircle className="w-4 h-4" />
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-muted-foreground">
                          <p>{user.campaignsLed ?? 0} campaigns</p>
                          <p>{user.donationsMade ?? 0} donations</p>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {formatRelativeTime(new Date(user.createdAt))}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role);
                            setIsRoleDialogOpen(true);
                          }}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Change Role
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No users found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your search or filters
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role and permissions for this user
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="bg-muted rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">User</p>
                <p className="font-semibold text-foreground">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Select Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2"
                  disabled={actionLoading}
                >
                  <option value="DONOR">Donor</option>
                  <option value="PLAYER">Player</option>
                  <option value="TEAM_MEMBER">Team Member</option>
                  <option value="CAMPAIGN_LEADER">Campaign Leader</option>
                  <option value="GUARDIAN">Guardian</option>
                  <option value="ADMIN">Admin</option>
                  <option value="BANK_ADMIN">Bank Admin</option>
                </select>
                <p className="text-sm text-muted-foreground mt-2">
                  {newRole === "DONOR" && "Can make donations to campaigns"}
                  {newRole === "PLAYER" && "Can have a fundraising page and raise funds"}
                  {newRole === "TEAM_MEMBER" && "Belongs to a team roster and can fundraise"}
                  {newRole === "CAMPAIGN_LEADER" && "Can create and manage campaigns"}
                  {newRole === "GUARDIAN" && "Parent/guardian of a team member"}
                  {newRole === "ADMIN" && "Can manage all campaigns and view reports"}
                  {newRole === "BANK_ADMIN" && "Can approve disbursements and manage finances"}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRoleDialogOpen(false);
                setSelectedUser(null);
                setNewRole("");
              }}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRoleChange}
              disabled={!newRole || newRole === selectedUser?.role || actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Update Role
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
