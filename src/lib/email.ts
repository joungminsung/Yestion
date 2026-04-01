import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@notion-web.app";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const APP_NAME = "Notion Web";

// ── Common template wrapper ──────────────────────────────────

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f6f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <div style="padding:32px 40px;border-bottom:1px solid #e8e7e4;">
    <h2 style="margin:0;font-size:16px;font-weight:600;color:#37352f;">${APP_NAME}</h2>
  </div>
  <div style="padding:32px 40px;">
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#37352f;">${title}</h1>
    ${body}
  </div>
  <div style="padding:20px 40px;background:#f7f6f3;text-align:center;">
    <p style="margin:0;font-size:12px;color:#9b9a97;">이 메일은 ${APP_NAME}에서 자동 발송되었습니다.</p>
  </div>
</div>
</body></html>`;
}

function buttonHtml(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;padding:10px 24px;background:#2383e2;color:#fff;text-decoration:none;border-radius:4px;font-size:14px;font-weight:500;margin:16px 0;">${text}</a>`;
}

// ── Email verification ───────────────────────────────────────

export async function sendVerificationEmail(to: string, token: string) {
  const link = `${APP_URL}/api/auth/verify?token=${token}`;
  const html = wrapHtml(
    "이메일 인증",
    `<p style="color:#37352f;font-size:14px;line-height:1.6;">
      아래 버튼을 클릭하여 이메일 인증을 완료하세요.<br/>
      이 링크는 24시간 동안 유효합니다.
    </p>
    ${buttonHtml("이메일 인증하기", link)}
    <p style="color:#9b9a97;font-size:12px;margin-top:24px;">
      버튼이 작동하지 않으면 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br/>
      <a href="${link}" style="color:#2383e2;word-break:break-all;">${link}</a>
    </p>`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] 이메일 인증`,
    html,
  });
}

// ── Password reset ───────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = wrapHtml(
    "비밀번호 재설정",
    `<p style="color:#37352f;font-size:14px;line-height:1.6;">
      비밀번호 재설정 요청을 받았습니다.<br/>
      아래 버튼을 클릭하여 새 비밀번호를 설정하세요. 이 링크는 1시간 동안 유효합니다.
    </p>
    ${buttonHtml("비밀번호 재설정", link)}
    <p style="color:#9b9a97;font-size:12px;margin-top:24px;">
      비밀번호 재설정을 요청하지 않았다면 이 메일을 무시하세요.
    </p>`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] 비밀번호 재설정`,
    html,
  });
}

// ── Share notification ───────────────────────────────────────

export async function sendShareNotificationEmail(
  to: string,
  sharedBy: string,
  pageTitle: string,
  pageUrl: string,
  permission: string,
) {
  const permLabel = permission === "edit" ? "편집" : permission === "comment" ? "댓글" : "보기";
  const html = wrapHtml(
    "페이지가 공유되었습니다",
    `<p style="color:#37352f;font-size:14px;line-height:1.6;">
      <strong>${sharedBy}</strong>님이 <strong>"${pageTitle}"</strong> 페이지를
      <span style="color:#2383e2;">${permLabel}</span> 권한으로 공유했습니다.
    </p>
    ${buttonHtml("페이지 열기", pageUrl)}`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] ${sharedBy}님이 "${pageTitle}" 페이지를 공유했습니다`,
    html,
  });
}

// ── Comment notification ─────────────────────────────────────

export async function sendCommentNotificationEmail(
  to: string,
  commenter: string,
  pageTitle: string,
  commentText: string,
  pageUrl: string,
) {
  const preview = commentText.length > 200 ? commentText.slice(0, 200) + "..." : commentText;
  const html = wrapHtml(
    "새 댓글",
    `<p style="color:#37352f;font-size:14px;line-height:1.6;">
      <strong>${commenter}</strong>님이 <strong>"${pageTitle}"</strong> 페이지에 댓글을 남겼습니다:
    </p>
    <blockquote style="margin:16px 0;padding:12px 16px;background:#f7f6f3;border-left:3px solid #e8e7e4;border-radius:4px;">
      <p style="margin:0;color:#37352f;font-size:14px;">${preview}</p>
    </blockquote>
    ${buttonHtml("댓글 보기", pageUrl)}`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] ${commenter}님이 "${pageTitle}"에 댓글을 남겼습니다`,
    html,
  });
}

// ── Welcome email ────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, name: string) {
  const html = wrapHtml(
    `환영합니다, ${name}님!`,
    `<p style="color:#37352f;font-size:14px;line-height:1.6;">
      ${APP_NAME}에 가입해 주셔서 감사합니다.<br/>
      이제 페이지를 만들고, 팀과 협업하고, 아이디어를 정리할 수 있습니다.
    </p>
    ${buttonHtml("시작하기", APP_URL)}
    <p style="color:#9b9a97;font-size:12px;margin-top:24px;">
      궁금한 점이 있으시면 언제든 문의해 주세요.
    </p>`
  );

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] 가입을 환영합니다!`,
    html,
  });
}
