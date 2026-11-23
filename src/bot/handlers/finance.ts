import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import prisma from "@/lib/prisma";
import { requireFinance, hasRole, requireUser } from "@/lib/auth";
import { formatPrDetails, formatPrListItem } from "../formatters";
import {
  mainMenuKeyboard,
  cancelKeyboard,
  financePaymentActionKeyboard,
  financeConfirmPaymentKeyboard,
} from "../keyboards";
import {
  setDraftStep,
  clearDraft,
  upsertDraft,
  getDraft,
  getDraftData,
} from "../drafts";
import { decimalToNumber, formatMoney, formatDate } from "@/lib/calculations";
import { notifyPaymentCompleted } from "@/lib/notifications";

function esc(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function handlePendingPayments(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const user = await requireFinance(BigInt(from.id));
  await clearDraft(BigInt(from.id));

  const pendingPrs = await prisma.purchaseRequest.findMany({
    where: {
      status: { in: ["APPROVED", "ORDERED", "COMPLETED"] },
      paymentStatus: "UNPAID",
    },
    include: {
      items: true,
      purchaser: true,
      approvedBy: true,
      materialRequest: { select: { mrNumber: true, projectName: true, projectType: true, id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  if (pendingPrs.length === 0) {
    await ctx.reply("✅ <b>No pending payments!</b>\n\nAll approved purchase requests have been paid.", {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(user),
    });
    return;
  }

  await ctx.reply(`💳 <b>Pending Payments (${pendingPrs.length}):</b>\n\nPlease select a payment action for each purchase:`, {
    parse_mode: "HTML",
  });

  for (const pr of pendingPrs) {
    const total = decimalToNumber(pr.grandTotal);
    const isCash = total < 50000;
    const ruleHint = isCash
      ? "💡 Amount &lt; 50,000 ETB → Recommended: <b>💵 Cash</b>"
      : "💡 Amount ≥ 50,000 ETB → Recommended: <b>📝 Check</b>";

    const text =
      `${formatPrDetails(pr)}\n\n` +
      `${ruleHint}`;

    await ctx.reply(text, {
      parse_mode: "HTML",
      reply_markup: financePaymentActionKeyboard(pr.id, total),
    });
  }
}

export async function handlePaymentHistory(ctx: Context) {
  const from = ctx.from;
  if (!from) return;

  const user = await requireUser(BigInt(from.id));
  if (!hasRole(user, "FINANCE", "ADMINISTRATOR", "VIEWER", "PURCHASER")) {
    await ctx.reply("❌ Access denied.");
    return;
  }
  await clearDraft(BigInt(from.id));

  const paidPrs = await prisma.purchaseRequest.findMany({
    where: { paymentStatus: "PAID" },
    include: {
      items: true,
      purchaser: true,
      paidBy: true,
      materialRequest: { select: { mrNumber: true, projectName: true, id: true } },
    },
    orderBy: { paidAt: "desc" },
    take: 15,
  });

  if (paidPrs.length === 0) {
    await ctx.reply("📜 No paid purchases found yet.", {
      reply_markup: mainMenuKeyboard(user),
    });
    return;
  }

  await ctx.reply(`📜 <b>Payment History (Last ${paidPrs.length}):</b>`, { parse_mode: "HTML" });

  for (const pr of paidPrs) {
    await ctx.reply(formatPrDetails(pr), {
      parse_mode: "HTML",
      reply_markup: new InlineKeyboard().text("📋 View Details", `pr_view:${pr.id}`),
    });
  }
}

export async function handleFinancePayCallback(ctx: Context, method: "CASH" | "CHECK", prId: string) {
  const from = ctx.from;
  if (!from) return;

  const user = await requireFinance(BigInt(from.id));
  await ctx.answerCallbackQuery();

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { materialRequest: { select: { mrNumber: true, projectName: true } } },
  });

  if (!pr) {
    await ctx.reply("❌ Purchase request not found.");
    return;
  }

  if (pr.paymentStatus === "PAID") {
    await ctx.reply(`ℹ️ PR *${pr.prNumber}* has already been paid via ${pr.paymentMethod === "CASH" ? "💵 Cash" : "📝 Check"}.`, {
      parse_mode: "Markdown",
    });
    return;
  }

  const total = decimalToNumber(pr.grandTotal);

  if (method === "CHECK") {
    // Prompt for Check # / Reference
    await upsertDraft(
      BigInt(from.id),
      "awaiting_check_reference",
      {
        prId: pr.id,
        method: "CHECK",
        prNumber: pr.prNumber,
        total,
      },
      user.id,
      "finance"
    );

    await ctx.reply(
      `📝 <b>Check Payment for ${esc(pr.prNumber)}</b>\n\n` +
      `📁 Project: <b>${esc(pr.materialRequest?.projectName || "—")}</b>\n` +
      `🎯 Supplier: <b>${esc(pr.supplierName)}</b>\n` +
      `💰 Amount: <b>ETB ${formatMoney(total)}</b>\n\n` +
      `Please enter the <b>Check Number</b> or <b>Bank Reference Number</b>:\n` +
      `<i>(or type /skip to record without a check number, or click Cancel)</i>`,
      {
        parse_mode: "HTML",
        reply_markup: cancelKeyboard(),
      }
    );
    return;
  }

  // Cash payment confirmation
  await ctx.reply(
    `💵 <b>Confirm Cash Payment</b>\n\n` +
    `PR No.: <b>${esc(pr.prNumber)}</b>\n` +
    `📁 Project: <b>${esc(pr.materialRequest?.projectName || "—")}</b>\n` +
    `🎯 Supplier: <b>${esc(pr.supplierName)}</b>\n` +
    `💰 Total: <b>ETB ${formatMoney(total)}</b>\n\n` +
    `Are you sure you want to mark this purchase as <b>Paid via Cash</b>?`,
    {
      parse_mode: "HTML",
      reply_markup: financeConfirmPaymentKeyboard(prId, "CASH"),
    }
  );
}

export async function handleFinanceConfirmPayment(
  ctx: Context,
  method: "CASH" | "CHECK",
  prId: string,
  reference?: string
) {
  const from = ctx.from;
  if (!from) return;

  const user = await requireFinance(BigInt(from.id));
  await ctx.answerCallbackQuery?.().catch(() => {});

  const pr = await prisma.purchaseRequest.findUnique({
    where: { id: prId },
    include: { materialRequest: { select: { mrNumber: true, projectName: true, id: true } } },
  });

  if (!pr) {
    await ctx.reply("❌ Purchase request not found.");
    return;
  }

  if (pr.paymentStatus === "PAID") {
    await ctx.reply(`ℹ️ PR *${pr.prNumber}* is already recorded as Paid.`, { parse_mode: "Markdown" });
    return;
  }

  const now = new Date();
  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: {
      paymentStatus: "PAID",
      paymentMethod: method,
      paidAt: now,
      paidById: user.id,
      paymentReference: reference?.trim() || null,
    },
  });

  await clearDraft(BigInt(from.id));

  const methodText = method === "CASH" ? "💵 Cash" : "📝 Check";
  const refText = reference?.trim() ? ` (Ref: <code>${esc(reference.trim())}</code>)` : "";
  const total = decimalToNumber(pr.grandTotal);

  await ctx.reply(
    `✅ <b>Payment Recorded Successfully!</b>\n\n` +
    `PR No.: <b>${esc(pr.prNumber)}</b>\n` +
    `Amount: <b>ETB ${formatMoney(total)}</b>\n` +
    `Method: <b>${methodText}</b>${refText}\n` +
    `Date: ${formatDate(now)}\n\n` +
    `Purchaser and Administrators have been notified.`,
    {
      parse_mode: "HTML",
      reply_markup: mainMenuKeyboard(user),
    }
  );

  // Notify Purchaser and Admin
  await notifyPaymentCompleted(prId, user.id).catch(console.error);
}

export async function handleFinanceDraftMessage(ctx: Context, text: string) {
  const from = ctx.from;
  if (!from) return;

  const draft = await getDraft(BigInt(from.id));
  if (!draft) return;
  const draftData = getDraftData(draft);
  const prId = draftData?.prId;
  const method = (draftData?.method || "CHECK") as "CASH" | "CHECK";

  if (!prId) {
    await clearDraft(BigInt(from.id));
    return;
  }

  const reference = text.trim().toLowerCase() === "/skip" ? undefined : text.trim();
  await handleFinanceConfirmPayment(ctx, method, prId, reference);
}
