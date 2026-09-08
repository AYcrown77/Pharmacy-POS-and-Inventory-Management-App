/**
 * Staff accounts.
 *
 * Passwords never travel back from the server and are never held here — the
 * backend hashes with bcrypt (§4) and the frontend only ever posts a new one.
 * Accounts are disabled, never deleted, so the sales and audit records that
 * reference them keep their author.
 */

import { USE_MOCKS } from "@/lib/api/config";
import { ApiError, http } from "@/lib/api/http";
import { db, recordAudit } from "@/mocks/db";
import { matchesSearch, mockRequest, paginate, sortBy } from "@/mocks/latency";
import type { ListParams, Paginated } from "@/types/common";
import type { Role, User } from "@/types/domain";

export interface UserFilters extends ListParams {
  role?: Role;
  isActive?: boolean;
}

export interface CreateUserInput {
  name: string;
  username: string;
  role: Role;
  password: string;
}

export interface UpdateUserInput {
  name: string;
  username: string;
  role: Role;
}

export interface UsersService {
  list(filters?: UserFilters): Promise<Paginated<User>>;
  getById(id: string): Promise<User>;
  create(input: CreateUserInput, actorId: string): Promise<User>;
  update(id: string, input: UpdateUserInput, actorId: string): Promise<User>;
  /** Disable or re-enable an account. */
  setActive(id: string, isActive: boolean, actorId: string): Promise<User>;
  resetPassword(
    id: string,
    password: string,
    currentPassword: string,
    actorId: string,
  ): Promise<void>;
}

const mockUsersService: UsersService = {
  list: (filters = {}) =>
    mockRequest(() => {
      const users = db.users.filter(
        (user) =>
          (!filters.role || user.role === filters.role) &&
          (filters.isActive === undefined ||
            user.isActive === filters.isActive) &&
          matchesSearch(filters.search, user.name, user.username),
      );

      return paginate(
        sortBy(users, (user) => user.name, filters.sortDir ?? "asc"),
        filters,
      );
    }),

  getById: (id) =>
    mockRequest(() => {
      const user = db.users.find((item) => item.id === id);
      if (!user) throw new ApiError(404, "User not found.");
      return user;
    }),

  create: (input, actorId) =>
    mockRequest(() => {
      const actor = requireActor(actorId);
      assertUsernameFree(input.username, null);

      const now = new Date().toISOString();
      const user: User = {
        id: `usr-${Date.now().toString(36)}`,
        name: input.name,
        username: input.username.toLowerCase(),
        role: input.role,
        isActive: true,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
      };

      db.users.push(user);

      recordAudit({
        userId: actor.id,
        userName: actor.name,
        action: "USER_CREATED",
        entityType: "USER",
        entityId: user.id,
        newValue: { name: user.name, username: user.username, role: user.role },
      });

      return user;
    }),

  update: (id, input, actorId) =>
    mockRequest(() => {
      const actor = requireActor(actorId);
      const user = requireUser(id);
      assertUsernameFree(input.username, id);

      const previous = {
        name: user.name,
        username: user.username,
        role: user.role,
      };

      user.name = input.name;
      user.username = input.username.toLowerCase();
      user.role = input.role;
      user.updatedAt = new Date().toISOString();

      recordAudit({
        userId: actor.id,
        userName: actor.name,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: user.id,
        oldValue: previous,
        newValue: { name: user.name, username: user.username, role: user.role },
      });

      return user;
    }),

  setActive: (id, isActive, actorId) =>
    mockRequest(() => {
      const actor = requireActor(actorId);
      const user = requireUser(id);

      // Locking yourself out of the only admin account would need a database
      // to undo, so the last active administrator cannot be disabled.
      if (!isActive) {
        if (user.id === actor.id) {
          throw new ApiError(400, "You cannot disable your own account.");
        }
        const activeAdmins = db.users.filter(
          (item) => item.role === "ADMINISTRATOR" && item.isActive,
        );
        if (user.role === "ADMINISTRATOR" && activeAdmins.length <= 1) {
          throw new ApiError(
            400,
            "This is the only active administrator. Create another before disabling this one.",
          );
        }
      }

      user.isActive = isActive;
      user.updatedAt = new Date().toISOString();

      recordAudit({
        userId: actor.id,
        userName: actor.name,
        action: isActive ? "USER_ENABLED" : "USER_DISABLED",
        entityType: "USER",
        entityId: user.id,
        oldValue: { isActive: !isActive },
        newValue: { isActive, name: user.name },
      });

      return user;
    }),

  resetPassword: (id, _password, _currentPassword, actorId) =>
    mockRequest(() => {
      const actor = requireActor(actorId);
      const user = requireUser(id);

      // The mock does not store credentials; the real endpoint hashes with
      // bcrypt. Only the audit trail is reproduced here.
      user.updatedAt = new Date().toISOString();

      recordAudit({
        userId: actor.id,
        userName: actor.name,
        action: "USER_UPDATED",
        entityType: "USER",
        entityId: user.id,
        newValue: { passwordReset: true, name: user.name },
      });
    }),
};

function requireActor(actorId: string) {
  const actor = db.users.find((item) => item.id === actorId);
  if (!actor) throw new ApiError(401, "Your session has expired.");
  return actor;
}

function requireUser(id: string) {
  const user = db.users.find((item) => item.id === id);
  if (!user) throw new ApiError(404, "User not found.");
  return user;
}

function assertUsernameFree(username: string, exceptId: string | null) {
  const clash = db.users.find(
    (item) =>
      item.username.toLowerCase() === username.trim().toLowerCase() &&
      item.id !== exceptId,
  );
  if (clash) {
    throw new ApiError(
      409,
      `The username "${username}" is already taken.`,
      "DUPLICATE_USERNAME",
    );
  }
}

const httpUsersService: UsersService = {
  list: (filters) => http.get<Paginated<User>>("/users", { params: filters }),
  getById: (id) => http.get<User>(`/users/${id}`),
  create: (input) => http.post<User>("/users", input),
  update: (id, input) => http.patch<User>(`/users/${id}`, input),
  setActive: (id, isActive) =>
    http.patch<User>(`/users/${id}/status`, { isActive }),
  resetPassword: (id, password, currentPassword) =>
    http.post<void>(`/users/${id}/password`, { password, currentPassword }),
};

export const usersService: UsersService = USE_MOCKS
  ? mockUsersService
  : httpUsersService;
