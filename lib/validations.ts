import { z } from "zod";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";

import { COMPANY_ROLES } from "@/lib/constants";

import { RBAC_MODULES, normalizeModulePermissions } from "@/lib/rbac-modules";

import type { CompanyRole, ProjectStatus } from "@/types";



const roleEnum = COMPANY_ROLES as unknown as [CompanyRole, ...CompanyRole[]];



const projectStatuses: [ProjectStatus, ...ProjectStatus[]] = [

  "Yet To Start",

  "In Progress",

  "Completed",

];



export const teamNameSchema = z.string().trim().min(1).max(80);



export const teamCreateSchema = z.object({

  name: teamNameSchema,

});

export const teamUpdateSchema = z.object({
  name: teamNameSchema,
});



const modulePermissionSchema = z.object({

  view: z.boolean().optional(),

  manage: z.boolean().optional(),

  actions: z.record(z.string(), z.boolean()).optional(),

});



const permissionsSchema = z

  .object(

    RBAC_MODULES.reduce(

      (acc, mod) => {

        acc[mod] = modulePermissionSchema.optional();

        return acc;

      },

      {} as Record<(typeof RBAC_MODULES)[number], z.ZodOptional<typeof modulePermissionSchema>>,

    ),

  )

  .partial();



export const workspaceRoleCreateSchema = z.object({

  name: z.string().trim().min(1).max(80),

  description: z.string().trim().max(500).optional().default(""),

  color: z

    .string()

    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #2563eb"),

  permissions: permissionsSchema,

  responsibilities: z.array(z.string().trim().min(1)).optional().default([]),

  scopes: z.array(z.string().trim().min(1)).optional().default([]),

  teamScopedProjects: z.boolean().optional(),

  teamScopedSeating: z.boolean().optional(),

});



export const workspaceRoleUpdateSchema = workspaceRoleCreateSchema.partial();



export const employeeCreateSchema = z.object({

  employeeId: z.string().min(1),

  name: z.string().min(1),

  team: teamNameSchema,

  role: z.enum(roleEnum),

  bayNumber: z.string().optional().default(""),

  imageUrl: z.string().optional().default(""),

});



const optionalEmployeeIdSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

export const appUserImageSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === "" ||
      /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value) ||
      /^https?:\/\//.test(value),
    "Use an image URL or upload an image file.",
  );

export const appUserCreateSchema = z
  .object({
    email: z.string().email(),
    password: z.union([z.string().min(6), z.literal("")]).optional(),
    name: z.string().min(1),
    appRole: z.string().trim().min(1),
    team: z.union([teamNameSchema, z.literal("")]).optional(),
    employeeId: z.union([z.string().trim().min(1), z.literal("")]).optional(),
    imageUrl: appUserImageSchema.optional(),
    workEmail: z.union([z.string().email(), z.literal("")]).optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    fullAddress: z.string().optional(),
    currentAddress: z.string().optional(),
    permanentAddress: z.string().optional(),
    joinedDate: z.string().optional(),
    notes: z.string().optional(),
    bayNumber: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (!roleNeedsEmployeeIdentity(value.appRole)) return;

    if (!value.employeeId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employeeId"],
        message: "Employee ID is required for this role.",
      });
    }

    if (!value.team?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["team"],
        message: "Team is required for this role.",
      });
    }
  });



export const appUserUpdateSchema = z.object({

  password: z.string().min(6).optional(),

  name: z.string().min(1).optional(),

  appRole: z.string().trim().min(1).optional(),

  team: teamNameSchema.optional(),

  employeeId: optionalEmployeeIdSchema,

  imageUrl: appUserImageSchema.optional(),

  workEmail: z.union([z.string().email(), z.literal("")]).optional(),

  phone: z.string().optional(),

  location: z.string().optional(),

  fullAddress: z.string().optional(),

  currentAddress: z.string().optional(),

  permanentAddress: z.string().optional(),

  joinedDate: z.string().optional(),

  bayNumber: z.string().optional(),

});

const profileImageSchema = appUserImageSchema;

export const profileSettingsUpdateSchema = z
  .object({
    imageUrl: profileImageSchema.optional(),
    currentPassword: z.string().optional().default(""),
    newPassword: z.string().optional().default(""),
    confirmNewPassword: z.string().optional().default(""),
  })
  .superRefine((value, ctx) => {
    const wantsPasswordChange = value.newPassword.trim().length > 0;
    if (!wantsPasswordChange) return;

    if ((value.currentPassword ?? "").trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentPassword"],
        message: "Current password is required.",
      });
    }

    if (value.newPassword!.trim().length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["newPassword"],
        message: "New password must be at least 6 characters.",
      });
    }

    if ((value.confirmNewPassword ?? "").trim() !== value.newPassword!.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmNewPassword"],
        message: "Confirm password must match the new password.",
      });
    }
  });



export const projectCreateSchema = z.object({

  name: z.string().min(1),

  clientName: z.string().min(1),

  projectManagerId: z.string().min(1),

  teams: z.array(teamNameSchema).min(1),

  assignedDate: z.string().min(1),

  lastDate: z.string().min(1),

  status: z.enum(projectStatuses),

  description: z.string().optional(),

  memberIds: z.array(z.string()).optional(),

});



export const projectUpdateSchema = z.object({

  name: z.string().min(1).optional(),

  teams: z.array(teamNameSchema).min(1).optional(),

  assignedDate: z.string().min(1).optional(),

  lastDate: z.string().min(1).optional(),

  status: z.enum(projectStatuses).optional(),

  description: z.string().optional(),

  clientName: z.string().min(1).optional(),

  projectManagerId: z.string().min(1).optional(),

  memberIds: z.array(z.string()).optional(),

});



export const galleryCreateSchema = z.object({

  title: z.string().min(1),

  url: z.string().min(1),

  caption: z.string().optional(),

  uploadedAt: z.string().min(1),

});



export const bayAssignSchema = z.object({

  bayId: z.string().min(1),

  employeeId: z.string().min(1).nullable(),

});



const seatingAiMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;



export const seatingAiGenerateSchema = z.discriminatedUnion("mode", [

  z.object({

    mode: z.literal("text"),

    prompt: z.string().trim().min(10).max(2000),

  }),

  z.object({

    mode: z.literal("image"),

    prompt: z.string().trim().max(2000).optional(),

    imageBase64: z.string().min(64).max(9_000_000),

    mimeType: z.enum(seatingAiMimeTypes),

  }),

]);



const directoryPatchSchema = z.object({
  workEmail: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  joinedDate: z.string().optional(),
  notes: z.string().optional(),
});

export const employeeUpdateSchema = z.object({
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  team: teamNameSchema.optional(),
  role: z.enum(roleEnum).optional(),
  bayNumber: z.string().optional(),
  imageUrl: z.string().optional(),
  directory: directoryPatchSchema.optional(),
});



export const employeeProjectsUpdateSchema = z.object({

  projectIds: z.array(z.string().min(1)),

});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1, "Reset link is invalid."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string().min(6, "Confirm your new password."),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["confirmPassword"],
        message: "Passwords do not match.",
      });
    }
  });



export function parseRolePermissionsInput(

  permissions: z.infer<typeof permissionsSchema>,

) {

  return normalizeModulePermissions(permissions);

}

export const chatSendMessageSchema = z.object({
  text: z.string().trim().min(1, "Message is required.").max(4000),
});

export const chatMarkReadSchema = z.object({
  conversationId: z.string().trim().min(1).optional(),
});


