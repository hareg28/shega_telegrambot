import { Keyboard, InlineKeyboard } from "grammy";
import type { User, UserRole } from "@prisma/client";

export function mainMenuKeyboard(user: User): Keyboard {
  const kb = new Keyboard().resized();
  const role = user.role;

  if (role === "REQUESTER" || role === "ADMINISTRATOR") {
    kb.text(MENU_LABELS.NEW_MR).text(MENU_LABELS.MY_REQUESTS).row();
    kb.text(MENU_LABELS.STATUS).text(MENU_LABELS.HELP);
  }

  if (role === "PURCHASER" || role === "ADMINISTRATOR") {
    if (role === "ADMINISTRATOR") kb.row();
    kb.text(MENU_LABELS.APPROVED_MRS).text(MENU_LABELS.PENDING_PRS).row();
    kb.text(MENU_LABELS.PURCHASE_HISTORY).text(MENU_LABELS.STATUS);
    kb.row().text(MENU_LABELS.SUPPLIER_MASTER);
  }

  if (role === "ADMINISTRATOR") {
    kb.row()
      .text(MENU_LABELS.VIEW_ALL)
      .text(MENU_LABELS.MANAGE_USERS)
      .row()
      .text(MENU_LABELS.MANAGE_PROJECTS)
      .text(MENU_LABELS.REGISTER_BOQ);
  }

  if (role === "VIEWER") {
    kb.text(MENU_LABELS.VIEW_ALL)
      .text(MENU_LABELS.PURCHASE_HISTORY)
      .row()
      .text(MENU_LABELS.STATUS)
      .text(MENU_LABELS.HELP);
  }

  if (role === "REQUESTER") {
    // already has help
  } else if (role !== "VIEWER" && role !== "ADMINISTRATOR") {
    kb.row().text(MENU_LABELS.HELP);
  }

  return kb;
}

export function cancelKeyboard(): Keyboard {
  return new Keyboard().text(MENU_LABELS.CANCEL).resized();
}

export function skipKeyboard(): Keyboard {
  return new Keyboard().text("⏭ Skip").text(MENU_LABELS.CANCEL).resized();
}

/** Project type: Interior / Booth with skip defaulting to Interior */
export function projectTypeKeyboard(): Keyboard {
  return new Keyboard()
    .text("🏠 Interior")
    .text("🎪 Booth")
    .row()
    .text("⏭ Skip (Interior)")
    .text(MENU_LABELS.CANCEL)
    .resized();
}

/** Inline keyboard listing active projects by name */
export function projectListKeyboard(
  projects: Array<{ id: string; name: string }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  projects.forEach((p, idx) => {
    kb.text(p.name, `select_project:${p.id}`);
    if ((idx + 1) % 2 === 0) kb.row();
  });
  if (projects.length % 2 !== 0) kb.row();
  return kb;
}

/** Inline keyboard listing global BOQ items + Skip + Add New for admins */
export function boqListKeyboard(
  boqItems: Array<{ id: string; name: string; isActive: boolean }>,
  isAdmin: boolean = false
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const activeBoqs = boqItems.filter(b => b.isActive);
  activeBoqs.forEach((boq, idx) => {
    kb.text(boq.name, `select_boq:${boq.id}`);
    if ((idx + 1) % 2 === 0) kb.row();
  });
  if (activeBoqs.length % 2 !== 0) kb.row();
  kb.text("⏭ Skip", `select_boq:skip`);
  if (isAdmin) {
    kb.row().text("➕ Add New BOQ", `select_boq:add_new`);
  }
  return kb;
}

/** VAT yes/no per item */
export function vatYesNoKeyboard(): Keyboard {
  return new Keyboard()
    .text("✅ Yes (15% VAT)")
    .text("❌ No VAT")
    .row()
    .text(MENU_LABELS.CANCEL)
    .resized();
}

/** Price entry mode for 2+ items */
export function priceEntryModeKeyboard(): Keyboard {
  return new Keyboard()
    .text("📝 Enter All Prices at Once")
    .row()
    .text("🔢 Set One by One")
    .row()
    .text(MENU_LABELS.CANCEL)
    .resized();
}

/** Purchase history date filter */
export function purchaseHistoryFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📅 Today", "ph_filter:today")
    .text("📆 This Week", "ph_filter:week")
    .row()
    .text("🗓 This Month", "ph_filter:month")
    .text("📋 All", "ph_filter:all");
}

/** Approved requests filter */
export function approvedRequestsFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("⏳ Pending", "ar_filter:pending")
    .text("🛒 Approved", "ar_filter:approved")
    .row()
    .text("✅ Completed", "ar_filter:completed")
    .text("❌ Rejected", "ar_filter:rejected")
    .row()
    .text("📅 Today", "ar_filter:today")
    .text("📋 All", "ar_filter:all");
}

export function itemsMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text("➕ Add Material")
    .text("🏷 Add Another BOQ Section")
    .row()
    .text("✏️ Edit Material")
    .text("🗑 Remove Material")
    .row()
    .text("🔄 Replace All Materials")
    .row()
    .text("📋 Review Materials")
    .text("✅ Continue to Review")
    .row()
    .text(MENU_LABELS.CANCEL)
    .resized();
}

export function editItemOptionsInlineKeyboard(index: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("📝 Edit Name", `edit_item:name:${index}`)
    .text("🔢 Edit Quantity", `edit_item:qty:${index}`)
    .row()
    .text("📏 Edit Unit", `edit_item:unit:${index}`)
    .text("✏️ Edit All", `edit_item:all:${index}`)
    .row()
    .text("❌ Cancel", `edit_item:cancel:${index}`);
}

export function mrReviewKeyboard(): Keyboard {
  return new Keyboard()
    .text("✅ Submit Request")
    .text("✏️ Edit Project Info")
    .row()
    .text("📦 Edit Materials")
    .text(MENU_LABELS.CANCEL)
    .resized();
}

export function purchaseItemsMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text("✏️ Edit Quantity")
    .text("💰 Set Prices")
    .row()
    .text("📋 Review Materials")
    .text("📝 Bulk Enter Materials")
    .row()
    .text("✅ Continue to Supplier")
    .text(MENU_LABELS.CANCEL)
    .resized();
}

export function purchaseReviewKeyboard(): Keyboard {
  return new Keyboard()
    .text("✅ Submit Purchase Request")
    .text("✏️ Edit Supplier")
    .row()
    .text("📦 Edit Materials")
    .row()
    .text(MENU_LABELS.CANCEL)
    .resized();
}

export function adminFilterKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("All", "admin_filter:ALL")
    .text("Pending", "admin_filter:PENDING_APPROVAL")
    .row()
    .text("Approved", "admin_filter:APPROVED_FOR_PURCHASING")
    .text("Final", "admin_filter:WAITING_FINAL_APPROVAL")
    .row()
    .text("Completed", "admin_filter:COMPLETED")
    .text("Rejected", "admin_filter:REJECTED");
}

export function mrActionKeyboard(mrId: string, readOnly = false): InlineKeyboard {
  const kb = new InlineKeyboard().text("View Details", `mr_view:${mrId}`);
  if (!readOnly) {
    kb.row()
      .text("📄 PDF", `export_pdf:${mrId}`)
      .text("📊 Excel", `export_excel:${mrId}`);
  }
  return kb;
}

export function adminMrActionKeyboard(mrId: string, status: string): InlineKeyboard {
  const kb = new InlineKeyboard();

  if (status === "PENDING_APPROVAL") {
    kb.text("✅ Approve MR", `mr_approve:${mrId}`)
      .text("❌ Reject MR", `mr_reject:${mrId}`)
      .row();
  }

  kb.text("View Details", `mr_view:${mrId}`)
    .row()
    .text("📄 PDF", `export_pdf:${mrId}`)
    .text("📊 Excel", `export_excel:${mrId}`);

  return kb;
}

export function purchaserMrKeyboard(mrId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("🛒 Start Purchase", `purchase_start:${mrId}`)
    .row()
    .text("View Details", `mr_view:${mrId}`);
}

export function prActionKeyboard(prId: string, status: string): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (status === "PENDING_APPROVAL") {
    kb.text("✅ Approve PR", `pr_approve:${prId}`)
      .text("❌ Reject PR", `pr_reject:${prId}`)
      .row();
  }
  kb.text("📋 View Details", `pr_view:${prId}`);
  return kb;
}

export function confirmKeyboard(action: string, id: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Yes, confirm", `${action}_confirm:${id}`)
    .text("Cancel", "admin_cancel");
}

export function removeItemKeyboard(itemCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < itemCount; i++) {
    kb.text(`Remove #${i + 1}`, `remove_item:${i}`).row();
  }
  kb.text("Cancel", "remove_item:cancel");
  return kb;
}

export function editItemKeyboard(itemCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < itemCount; i++) {
    kb.text(`Edit #${i + 1}`, `edit_item:${i}`).row();
  }
  kb.text("Cancel", "edit_item:cancel");
  return kb;
}

export function editQtyKeyboard(itemCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < itemCount; i++) {
    kb.text(`Qty #${i + 1}`, `edit_qty:${i}`).row();
  }
  kb.text("Cancel", "edit_qty:cancel");
  return kb;
}

export function setPriceKeyboard(itemCount: number): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (let i = 0; i < itemCount; i++) {
    kb.text(`Price #${i + 1}`, `set_price:${i}`).row();
  }
  kb.text("Cancel", "set_price:cancel");
  return kb;
}

export function roleSelectKeyboard(userId: string): InlineKeyboard {
  const roles: UserRole[] = [
    "REQUESTER",
    "ADMINISTRATOR",
    "PURCHASER",
    "VIEWER",
  ];
  const kb = new InlineKeyboard();
  for (const role of roles) {
    kb.text(role, `set_role:${userId}:${role}`).row();
  }
  kb.text("Cancel", "admin_cancel");
  return kb;
}

export function manageRolePickKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🛒 Purchaser", "manage_assign:PURCHASER")
    .text("📋 Requester", "manage_assign:REQUESTER")
    .row()
    .text("👁 Viewer", "manage_assign:VIEWER")
    .text("🔑 Administrator", "manage_assign:ADMINISTRATOR")
    .row()
    .text("🏷 Link Official Company Name", "manage_assign:OFFICIAL_NAME")
    .row()
    .text("❌ Cancel", "admin_cancel");
}

export function roleMenuKeyboard(role: string): InlineKeyboard {
  const roleLabels: Record<string, string> = {
    ADMINISTRATOR: "Admin",
    PURCHASER: "Purchaser",
    REQUESTER: "Requester",
    VIEWER: "Viewer",
  };
  const label = roleLabels[role] ?? role;

  if (role === "REQUESTER") {
    return new InlineKeyboard()
      .text(`📋 See ${label} List`, `user_role_list:${role}`)
      .row()
      .text(`➕ Assign as ${label}`, `user_role_add:${role}`)
      .text(`🗑 Delete User`, `user_role_remove_menu:${role}`)
      .row()
      .text("🔙 Back to Roles", "manage_users_main");
  }

  return new InlineKeyboard()
    .text(`📋 See ${label} List`, `user_role_list:${role}`)
    .row()
    .text(`➕ Add ${label}`, `user_role_add:${role}`)
    .text(`🗑 Remove ${label}`, `user_role_remove_menu:${role}`)
    .row()
    .text("🔙 Back to Roles", "manage_users_main");
}

export function userRemoveListKeyboard(
  role: string,
  users: Array<{ id: string; fullName: string; telegramUsername?: string | null; isSuperAdmin?: boolean }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const u of users) {
    if (u.isSuperAdmin) continue;
    const name = u.fullName || (u.telegramUsername ? `@${u.telegramUsername}` : "User");
    kb.text(`🗑 ${name}`, `user_role_remove:${role}:${u.id}`).row();
  }
  kb.text("🔙 Back", `manage_assign:${role}`);
  return kb;
}

export function userRemoveConfirmKeyboard(role: string, userId: string): InlineKeyboard {
  const btnLabel = role === "REQUESTER" ? "🗑 Yes, Delete User" : "✅ Yes, Revoke Role";
  return new InlineKeyboard()
    .text(btnLabel, `user_role_remove_confirm:${role}:${userId}`)
    .text("❌ Cancel", `manage_assign:${role}`);
}

/** Admin project management keyboard */
export function manageProjectsKeyboard(
  projects: Array<{ id: string; name: string; isActive: boolean }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  projects.forEach((p) => {
    kb.text(
      `${p.isActive ? "✅" : "❌"} ${p.name}`,
      `project_manage:${p.id}`
    ).row();
  });
  kb.text("➕ Add New Project", "project_add_new");
  return kb;
}

/** Single project management actions */
export function projectActionKeyboard(projectId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("➕ Add BOQ", `project_add_boq:${projectId}`)
    .text("➕ Bulk Add BOQ", `project_bulk_add_boq:${projectId}`)
    .row()
    .text("✏️ Edit BOQ", `project_edit_boq:${projectId}`)
    .text("🗑 Remove BOQ", `project_remove_boq:${projectId}`)
    .row()
    .text("✏️ Edit Name", `project_edit_name:${projectId}`)
    .text("🗑 Delete Project", `project_delete:${projectId}`)
    .row()
    .text("🗑 Deactivate", `project_deactivate:${projectId}`)
    .text("✅ Reactivate", `project_reactivate:${projectId}`)
    .row()
    .text("🔙 Back", "project_list");
}

/** Keyboard for Register BOQ project selection */
export function registerBoqProjectKeyboard(
  projects: Array<{ id: string; name: string; isActive: boolean }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  projects.forEach((p) => {
    kb.text(
      `${p.isActive ? "🟢" : "🔴"} ${p.name}`,
      `register_boq_project:${p.id}`
    ).row();
  });
  kb.text("➕ Add New Project", "project_add_new");
  return kb;
}

export const MENU_LABELS = {
  NEW_MR: "📋 New Material Request",
  MY_REQUESTS: "📄 My Requests",
  STATUS: "📊 Request Status",
  HELP: "ℹ️ Help",
  APPROVED_MRS: "🛒 Approved Requests",
  PENDING_PRS: "⏳ Pending Requests",
  PURCHASE_HISTORY: "📜 Purchase History",
  SUPPLIER_MASTER: "🏢 Supplier Master",
  DELIVERY_TRACKING: "🚚 Delivery Tracking",
  VIEW_ALL: "📑 View All Requests",
  MANAGE_USERS: "👥 Manage Users",
  MANAGE_PROJECTS: "📁 Manage Projects",
  REGISTER_BOQ: "📝 Register BOQ",
  MANAGE_BOQ: "📝 Manage BOQ",
  APPROVE_MR: "✅ Approve MR",
  REJECT_MR: "❌ Reject MR",
  CANCEL: "❌ Cancel",
} as const;

/** Keyboard for global BOQ management */
export function manageBoqKeyboard(
  boqs: Array<{ id: string; name: string; isActive: boolean }>
): InlineKeyboard {
  const kb = new InlineKeyboard();
  boqs.forEach((boq) => {
    kb.text(
      `${boq.isActive ? "🟢" : "🔴"} ${boq.name}`,
      `boq_manage:${boq.id}`
    ).row();
  });
  kb.text("➕ Add New BOQ", "boq_add_new");
  return kb;
}

/** Keyboard for single BOQ management actions */
export function boqActionKeyboard(boqId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✏️ Edit Name", `boq_edit_name:${boqId}`)
    .text("🗑️ Deactivate", `boq_deactivate:${boqId}`)
    .row()
    .text("✅ Reactivate", `boq_reactivate:${boqId}`)
    .text("🗑️ Delete", `boq_delete:${boqId}`)
    .row()
    .text("🔙 Back", "boq_list");
}

export function prDetailKeyboard(prId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("📄 Full Details", `pr_view:${prId}`);
}

export function deliveryUpdateKeyboard(prId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Mark Delivered", `delivery_delivered:${prId}`)
    .row()
    .text("⚠️ Mark Delayed", `delivery_delayed:${prId}`);
}
