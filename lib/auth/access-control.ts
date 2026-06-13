import { createAccessControl } from "better-auth/plugins/access";

export const ac = createAccessControl({
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "delete",
    "set-password",
  ],
  session: ["list", "delete"],
});

export const roles = {
  superadmin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
    ],
    session: ["list", "delete"],
  }),
  admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "impersonate",
      "delete",
      "set-password",
    ],
    session: ["list", "delete"],
  }),
};
