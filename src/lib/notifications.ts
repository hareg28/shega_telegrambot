import { Bot, InlineKeyboard } from "grammy";
import prisma from "./prisma";
import { getAdminTelegramIds } from "./config";
import {
  formatDate,
  formatMoney,
  decimalToNumber,
  statusLabel,
  getRequesterDisplayName,
  roundMoney,
} from "./calculations";
import { getCompanyName } from "./config";

let notifyBot: Bot | null = null;

function getBot(): Bot {
  if (notifyBot) return notifyBot;
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not configured");
  notifyBot = new Bot(token);
  return notifyBot;
}

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cleanMrNumber(mrNumber: string): string {
  return mrNumber.replace(/^MR-/i, "");
}

function cleanPrNumber(prNumber: string): string {
  return prNumber.replace(/^PR-/i, "");
}

async function getUsersByRole(role: "ADMINISTRATOR" | "PURCHASER" | "REQUESTER") {
  return prisma.user.findMany({ where: { role } });
}

async function sendMessage(telegramId: bigint | number, text: string, replyMarkup?: any) {
  try {
    await getBot().api.sendMessage(Number(telegramId), text, {
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
  } catch (err) {
    console.error(`Failed to send message to ${telegramId}:`, err);
  }
}

async function createNotification(
  userId: string,
  message: string,
  materialRequestId?: string
) {
  await prisma.notification.create({
    data: { userId, message, materialRequestId },
  });
}

function formatMrSummaryHtml(mr: {
  mrNumber: string;
  projectName: string;
  projectType?: string | null;
  requestDate: Date;
  status: string;
  requesterName?: string | null;
  requestedBy: { fullName: string };
  boq?: string | null;
  items: { itemName: string; quantity: unknown; unit: string }[];
}) {
  const company = getCompanyName();
  const boqName = mr.boq?.trim() || "Material List";
  const requester = getRequesterDisplayName(mr);

  let text = `<b>${esc(company)}</b>\n\n`;
  text += `📅 Date: <b>${formatDate(mr.requestDate)}</b>\n`;
  text += `👤 Requested By: <b>${esc(requester)}</b>\n`;
  text += `🏗 Project Type: <b>${esc(mr.projectType ?? "—")}</b>\n`;
  text += `📁 Project: <b>${esc(mr.projectName)}</b>\n`;
  text += `📄 MR No. : <b>${esc(cleanMrNumber(mr.mrNumber))}</b>\n`;
  text += `📄 PR No. : <b>—</b>\n\n`;

  text += `📦 <b>BOQ Material — ${esc(boqName)}</b>\n\n`;
  mr.items.forEach((item, i) => {
    text += `${i + 1}. <b>${esc(item.itemName)}</b> — <b>${decimalToNumber(item.quantity as any)} ${esc(item.unit)}</b>\n`;
  });

  text += `\n📌 Status: <b>${esc(statusLabel(mr.status))}</b>`;
  return text;
}

export async function notifyMrSubmitted(mrId: string) {
  const mr = await prisma.materialRequest.findUnique({
    where: { id: mrId },
    include: { items: true, requestedBy: true },
  });
  if (!mr) return;

  const summary = formatMrSummaryHtml(mr);

  await createNotification(
    mr.requestedById,
    `Material Request ${mr.mrNumber} submitted`,
    mrId
  );

  const adminIds = new Set([
    ...getAdminTelegramIds().map(Number),
    ...(await getUsersByRole("ADMINISTRATOR")).map((a) => Number(a.telegramId)),
  ]);

  const adminMsg = `🔔 <b>New Material Request</b>\n\n${summary}`;
  const inlineKb = new InlineKeyboard()
    .text("✅ Approve MR", `mr_approve:${mrId}`)
    .text("❌ Reject MR", `mr_reject:${mrId}`);

  for (const adminId of adminIds) {
    await sendMessage(adminId, adminMsg, inlineKb);
  }
}

export async function notifyMrApproved(mrId: string) {
  const mr = await prisma.materialRequest.findUnique({
    where: { id: mrId },
    include: { items: true, requestedBy: true },
  });
  if (!mr) return;

  const summary = formatMrSummaryHtml(mr);

  await sendMessage(
    mr.requestedBy.telegramId,
    `✅ <b>Material Request Approved</b>\n\n${summary}\n\nYour request has been approved for purchasing.`
  );
  await createNotification(
    mr.requestedById,
    `Material Request ${mr.mrNumber} approved`,
    mrId
  );

  const purchasers = await getUsersByRole("PURCHASER");
  const admins = await getUsersByRole("ADMINISTRATOR");

  const recipientMap = new Map<string, typeof purchasers[0]>();
  for (const u of [...purchasers, ...admins]) {
    recipientMap.set(u.id, u);
  }

  const msg = `🛒 <b>New Approved Material Request</b>\n\n${summary}\n\nClick the button below to start purchasing directly:`;
  const inlineKb = new InlineKeyboard().text("🛒 Start Purchase", `purchase_start:${mr.id}`);

  for (const recipient of recipientMap.values()) {
    await sendMessage(recipient.telegramId, msg, inlineKb);
    await createNotification(
      recipient.id,
      `New approved MR ${mr.mrNumber} ready for purchasing`,
      mrId
    );
  }
}

export async function notifyMrRejected(mrId: string, remarks?: string) {
  const mr = await prisma.materialRequest.findUnique({
    where: { id: mrId },
    include: { items: true, requestedBy: true },
  });
  if (!mr) return;

  const summary = formatMrSummaryHtml(mr);
  let msg = `❌ <b>Material Request Rejected</b>\n\n${summary}`;
  if (remarks) msg += `\n\n📝 Reason: <b>${esc(remarks)}</b>`;

  await sendMessage(mr.requestedBy.telegramId, msg);
  await createNotification(
    mr.requestedById,
    `Material Request ${mr.mrNumber} rejected`,
    mrId
  );
}

export async function notifyPurchaseSubmitted(mrId: string, prId: string) {
  const mr = await prisma.materialRequest.findUnique({
    where: { id: mrId },
    include: { requestedBy: true, items: true },
  });
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { purchaser: true, items: true },
  });
  if (!mr || !pr) return;

  const company = getCompanyName();
  const boqName = mr.boq?.trim() || "Material List";
  const requester = getRequesterDisplayName(mr);

  // Find who approved the MR (Site Engineer)
  const approvals = await prisma.approvalHistory.findMany({
    where: { materialRequestId: mrId, action: "MR_APPROVED" },
    include: { performedBy: true },
  });
  const siteEngineer = approvals[0]?.performedBy?.fullName || "—";

  let summary = `<b>${esc(company)}</b>\n\n`;
  summary += `📅 Date: <b>${formatDate(mr.requestDate)}</b>\n`;
  summary += `👤 Requested By: <b>${esc(requester)}</b>\n`;
  summary += `🏗 Project Type: <b>${esc(mr.projectType ?? "—")}</b>\n`;
  summary += `📁 Project: <b>${esc(mr.projectName)}</b>\n`;
  summary += `📄 MR No. : <b>${esc(cleanMrNumber(mr.mrNumber))}</b>\n`;
  summary += `📄 PR No. : <b>${esc(cleanPrNumber(pr.prNumber))}</b>\n\n`;

  summary += `🎯 <b>Supplier Information</b>\n`;
  summary += `👤 Name: <b>${esc(pr.supplierName)}</b>\n`;
  summary += `📞 Phone No.: <b>${esc(pr.supplierPhone ?? "—")}</b>\n`;
  summary += `🏦 Account Number: <b>${esc(pr.accountNumber ?? "—")}</b>\n\n`;

  summary += `📦 <b>BOQ Material — ${esc(boqName)}</b>\n\n`;
  pr.items.forEach((item, i) => {
    const qty = decimalToNumber(item.quantity);
    const price = decimalToNumber(item.unitPrice);
    const total = roundMoney(qty * price);
    summary += `${i + 1}. <b>${esc(item.itemName)}</b> — <b>${qty} ${esc(item.unit)}</b>\n`;
    summary += `    💰 Price: ${qty} × ${formatMoney(price)} = ETB <b>${formatMoney(total)}</b>\n`;
  });

  summary += `\n💰 <b>Cost Summary</b>\n\n`;
  summary += `👉Total Amount =   <b>ETB ${formatMoney(decimalToNumber(pr.subtotal))}</b>\n`;
  summary += `👉VAT =            <b>ETB ${formatMoney(decimalToNumber(pr.vatAmount))}</b>\n`;
  summary += `👉Total with VAT = <b>ETB ${formatMoney(decimalToNumber(pr.grandTotal))}</b>\n\n`;

  summary += `✅ <b>Approvals:</b>\n`;
  summary += `• Site Engineer: <b>${esc(siteEngineer)}</b>\n`;
  summary += `• Project Manager: <i>Pending</i>`;

  await createNotification(
    pr.purchaserId,
    `Purchase Request ${pr.prNumber} submitted for final approval`,
    mrId
  );

  const adminIds = new Set([
    ...getAdminTelegramIds().map(Number),
    ...(await getUsersByRole("ADMINISTRATOR")).map((a) => Number(a.telegramId)),
  ]);

  const adminMsg = `🔔 <b>Purchase Waiting for Final Approval</b>\n\n${summary}`;
  const inlineKb = new InlineKeyboard()
    .text("✅ Approve PR", `pr_approve:${pr.id}`)
    .text("❌ Reject PR", `pr_reject:${pr.id}`);

  for (const adminId of adminIds) {
    await sendMessage(adminId, adminMsg, inlineKb);
  }
}

export async function notifyPurchaseApproved(mrId: string, prId: string) {
  const mr = await prisma.materialRequest.findUnique({
    where: { id: mrId },
    include: { requestedBy: true, items: true },
  });
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { purchaser: true, approvedBy: true, items: true },
  });
  if (!mr || !pr) return;

  const company = getCompanyName();
  const boqName = mr.boq?.trim() || "Material List";
  const requester = getRequesterDisplayName(mr);

  // Find who approved the MR (Site Engineer)
  const approvals = await prisma.approvalHistory.findMany({
    where: { materialRequestId: mrId, action: "MR_APPROVED" },
    include: { performedBy: true },
  });
  const siteEngineer = approvals[0]?.performedBy?.fullName || "—";

  let summary = `<b>${esc(company)}</b>\n\n`;
  summary += `📅 Date: <b>${formatDate(mr.requestDate)}</b>\n`;
  summary += `👤 Requested By: <b>${esc(requester)}</b>\n`;
  summary += `🏗 Project Type: <b>${esc(mr.projectType ?? "—")}</b>\n`;
  summary += `📁 Project: <b>${esc(mr.projectName)}</b>\n`;
  summary += `📄 MR No. : <b>${esc(cleanMrNumber(mr.mrNumber))}</b>\n`;
  summary += `📄 PR No. : <b>${esc(cleanPrNumber(pr.prNumber))}</b>\n\n`;

  summary += `🎯 <b>Supplier Information</b>\n`;
  summary += `👤 Name: <b>${esc(pr.supplierName)}</b>\n`;
  summary += `📞 Phone No.: <b>${esc(pr.supplierPhone ?? "—")}</b>\n`;
  summary += `🏦 Account Number: <b>${esc(pr.accountNumber ?? "—")}</b>\n\n`;

  summary += `📦 <b>BOQ Material — ${esc(boqName)}</b>\n\n`;
  pr.items.forEach((item, i) => {
    const qty = decimalToNumber(item.quantity);
    const price = decimalToNumber(item.unitPrice);
    const total = roundMoney(qty * price);
    summary += `${i + 1}. <b>${esc(item.itemName)}</b> — <b>${qty} ${esc(item.unit)}</b>\n`;
    summary += `    💰 Price: ${qty} × ${formatMoney(price)} = ETB <b>${formatMoney(total)}</b>\n`;
  });

  summary += `\n💰 <b>Cost Summary</b>\n\n`;
  summary += `👉Total Amount =   <b>ETB ${formatMoney(decimalToNumber(pr.subtotal))}</b>\n`;
  summary += `👉VAT =            <b>ETB ${formatMoney(decimalToNumber(pr.vatAmount))}</b>\n`;
  summary += `👉Total with VAT = <b>ETB ${formatMoney(decimalToNumber(pr.grandTotal))}</b>\n\n`;

  summary += `✅ <b>Approvals:</b>\n`;
  summary += `• Site Engineer: <b>${esc(siteEngineer)}</b>\n`;
  summary += `• Project Manager: <b>${esc(pr.approvedBy?.fullName || "—")}</b>`;

  const msg = `✅ <b>Purchase Completed</b>\n\n${summary}\n\nRecorded in the system and Google Sheets.`;

  await sendMessage(mr.requestedBy.telegramId, msg);
  await createNotification(
    mr.requestedById,
    `Purchase completed for ${mr.mrNumber} (PR: ${pr.prNumber})`,
    mrId
  );

  await sendMessage(pr.purchaser.telegramId, msg);
  await createNotification(
    pr.purchaserId,
    `Purchase approved for ${mr.mrNumber} (PR: ${pr.prNumber})`,
    mrId
  );
}

export async function notifyPurchaseRejected(mrId: string, prId: string, remarks?: string) {
  const mr = await prisma.materialRequest.findUnique({
    where: { id: mrId },
    include: { requestedBy: true },
  });
  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { purchaser: true },
  });
  if (!mr || !pr) return;

  let msg = `❌ <b>Purchase Request Rejected</b>\n\n`;
  msg += `<b>${esc(mr.projectName)}</b> (MR: <b>${esc(cleanMrNumber(mr.mrNumber))}</b> | PR: <b>${esc(cleanPrNumber(pr.prNumber))}</b>)`;
  if (remarks) msg += `\n\n📝 Reason: <b>${esc(remarks)}</b>`;
  msg += `\n\nYou can revise and resubmit from <b>New Purchase Request</b>.`;

  await sendMessage(pr.purchaser.telegramId, msg);
  await createNotification(
    pr.purchaserId,
    `Purchase ${pr.prNumber} rejected for ${mr.mrNumber}`,
    mrId
  );
}

export function getWebhookSecret(): string | undefined {
  return process.env.WEBHOOK_SECRET;
}

export function getWebhookUrl(): string {
  const base = process.env.WEBHOOK_URL ?? process.env.VERCEL_URL;
  if (!base) throw new Error("WEBHOOK_URL or VERCEL_URL must be set");
  const url = base.startsWith("http") ? base : `https://${base}`;
  return `${url.replace(/\/$/, "")}/api/webhook`;
}

export { getCompanyName } from "./config";
