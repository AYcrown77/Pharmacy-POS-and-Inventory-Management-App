"use client";

import { KeyRound, Pencil, Plus, UserCheck, UserX, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { RoleBadge } from "@/components/shared/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DataTable,
  EmptyCell,
  PrimaryCell,
  type Column,
} from "@/components/ui/DataTable";
import { RowActions } from "@/components/ui/DropdownMenu";
import { ConfirmDialog } from "@/components/ui/Modal";
import { PageContainer, PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";
import { useTableState } from "@/hooks/useTableState";
import { useAuth } from "@/lib/auth/AuthProvider";
import { formatDate, formatRelativeTime, timestampToDateOnly } from "@/lib/date";
import { ROLE_LABELS, ROLES } from "@/lib/status";
import type { Role, User } from "@/types/domain";
import {
  ResetPasswordModal,
  UserFormModal,
} from "./components/UserFormModal";
import {
  useCreateUser,
  useResetPassword,
  useSetUserActive,
  useUpdateUser,
  useUsers,
} from "./hooks";

interface UserTableFilters {
  role?: Role;
  isActive?: boolean;
}

export function UsersPage() {
  const { user: currentUser } = useAuth();

  const table = useTableState<UserTableFilters>({
    initialSort: { by: "name", dir: "asc" },
    initialFilters: {},
  });

  const list = useUsers(table.queryParams);

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setActive = useSetUserActive();
  const resetPassword = useResetPassword();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [disabling, setDisabling] = useState<User | null>(null);

  const columns = useMemo<Column<User>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        sortable: true,
        width: "26%",
        cell: (user) => (
          <div className="flex min-w-0 items-center gap-2">
            <PrimaryCell title={user.name} subtitle={`@${user.username}`} />
            {user.id === currentUser?.id && (
              <Badge tone="primary" size="sm" className="shrink-0">
                You
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "role",
        header: "Role",
        width: "16%",
        cell: (user) => <RoleBadge role={user.role} size="sm" />,
      },
      {
        id: "status",
        header: "Status",
        width: "14%",
        cell: (user) => (
          <Badge tone={user.isActive ? "success" : "neutral"} size="sm" dot>
            {user.isActive ? "Active" : "Disabled"}
          </Badge>
        ),
      },
      {
        id: "lastLoginAt",
        header: "Last login",
        width: "20%",
        cell: (user) =>
          user.lastLoginAt ? (
            <span className="whitespace-nowrap text-neutral-600">
              {formatRelativeTime(user.lastLoginAt)}
            </span>
          ) : (
            <span className="text-neutral-400">Never signed in</span>
          ),
      },
      {
        id: "createdAt",
        header: "Created",
        width: "18%",
        cell: (user) =>
          user.createdAt ? (
            <span className="num whitespace-nowrap text-neutral-600">
              {formatDate(timestampToDateOnly(user.createdAt))}
            </span>
          ) : (
            <EmptyCell />
          ),
      },
      {
        id: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        width: "48px",
        cell: (user) => (
          <RowActions
            label={`Actions for ${user.name}`}
            actions={[
              {
                id: "edit",
                label: "Edit details",
                icon: <Pencil className="size-4" />,
                onSelect: () => {
                  setEditing(user);
                  setFormOpen(true);
                },
              },
              {
                id: "password",
                label: "Reset password",
                icon: <KeyRound className="size-4" />,
                onSelect: () => setResetting(user),
              },
              // Accounts are disabled, never deleted — their sales and audit
              // entries must keep pointing at a real person.
              user.isActive
                ? {
                    id: "disable",
                    label: "Disable account",
                    icon: <UserX className="size-4" />,
                    tone: "danger" as const,
                    separated: true,
                    disabled: user.id === currentUser?.id,
                    onSelect: () => setDisabling(user),
                  }
                : {
                    id: "enable",
                    label: "Enable account",
                    icon: <UserCheck className="size-4" />,
                    separated: true,
                    onSelect: () =>
                      setActive.mutate({ id: user.id, isActive: true }),
                  },
            ]}
          />
        ),
      },
    ],
    [currentUser?.id, setActive],
  );

  return (
    <PageContainer>
      <PageHeader
        title="User management"
        titleHidden
        description="Staff accounts and what each of them can reach. Accounts are disabled rather than deleted, so past sales keep their author."
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus className="size-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New user
          </Button>
        }
      />

      <FilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder="Search name or username"
        hasActiveFilters={table.hasActiveFilters}
        onReset={table.reset}
      >
        <FilterSelect
          label="Role"
          allLabel="All roles"
          value={table.filters.role}
          onChange={(value) => table.setFilter("role", value)}
          options={ROLES.map((role) => ({
            value: role,
            label: ROLE_LABELS[role],
          }))}
        />
        <FilterSelect
          label="Status"
          allLabel="Any status"
          value={
            table.filters.isActive === undefined
              ? undefined
              : table.filters.isActive
                ? "active"
                : "disabled"
          }
          onChange={(value) =>
            table.setFilter(
              "isActive",
              value === undefined ? undefined : value === "active",
            )
          }
          options={[
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ]}
        />
      </FilterBar>

      <DataTable
        caption="Staff accounts"
        columns={columns}
        rows={list.data?.data ?? []}
        getRowId={(user) => user.id}
        isLoading={list.isPending}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        sort={table.sort}
        onSortChange={table.setSort}
        rowClassName={(user) => (user.isActive ? undefined : "opacity-60")}
        empty={
          <EmptyState
            icon={<Users className="size-5" />}
            title="No users match these filters"
          />
        }
      />

      <UserFormModal
        // Remounts per target so the fields reflect the right account.
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editing}
        isSubmitting={createUser.isPending || updateUser.isPending}
        onCreate={(values) =>
          createUser.mutateAsync({
            name: values.name,
            username: values.username,
            role: values.role,
            // The create schema requires it, so it is present by this point.
            password: values.password ?? "",
          })
        }
        onUpdate={(values) =>
          updateUser.mutateAsync({
            id: editing!.id,
            input: {
              name: values.name,
              username: values.username,
              role: values.role,
            },
          })
        }
      />

      <ResetPasswordModal
        key={`reset-${resetting?.id ?? "none"}`}
        open={Boolean(resetting)}
        onOpenChange={(open) => !open && setResetting(null)}
        user={resetting}
        isSubmitting={resetPassword.isPending}
        onSubmit={(password, currentPassword) =>
          resetPassword.mutateAsync({
            id: resetting!.id,
            password,
            currentPassword,
          })
        }
      />

      <ConfirmDialog
        open={Boolean(disabling)}
        onOpenChange={(open) => !open && setDisabling(null)}
        title="Disable this account?"
        confirmLabel="Disable account"
        confirmVariant="danger"
        loading={setActive.isPending}
        onConfirm={() => {
          setActive.mutate(
            { id: disabling!.id, isActive: false },
            { onSettled: () => setDisabling(null) },
          );
        }}
        warning="This action will be recorded in the audit history."
        message={
          <p>
            <span className="font-medium text-neutral-900">
              {disabling?.name}
            </span>{" "}
            will no longer be able to sign in. Their past sales, adjustments
            and audit entries are kept exactly as they are, and the account can
            be enabled again later.
          </p>
        }
      />
    </PageContainer>
  );
}
