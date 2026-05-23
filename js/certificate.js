// A4 landscape at 96dpi
const W = 1122;
const H = 794;

export function renderCertificate({ name, school, grade, classNum, date, totalPoints }) {
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  _drawFrame(ctx);
  _drawContent(ctx, { name, school, grade, classNum, date, totalPoints });

  return canvas;
}

function _drawFrame(ctx) {
  // Background
  ctx.fillStyle = '#FFFDF5';
  ctx.fillRect(0, 0, W, H);

  // Outer border
  ctx.strokeStyle = '#1B4332';
  ctx.lineWidth = 16;
  ctx.strokeRect(20, 20, W - 40, H - 40);

  // Inner border
  ctx.strokeStyle = '#F4A62A';
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 38, W - 76, H - 76);

  // Corner decorations
  _drawCornerOrnament(ctx, 60, 60, 0);
  _drawCornerOrnament(ctx, W - 60, 60, 1);
  _drawCornerOrnament(ctx, 60, H - 60, 2);
  _drawCornerOrnament(ctx, W - 60, H - 60, 3);

  // Top decorative line
  ctx.strokeStyle = '#1B4332';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, 120);
  ctx.lineTo(W - 100, 120);
  ctx.stroke();

  // Bottom decorative line
  ctx.beginPath();
  ctx.moveTo(100, H - 120);
  ctx.lineTo(W - 100, H - 120);
  ctx.stroke();

  // Dot pattern at mid section
  ctx.fillStyle = 'rgba(27,67,50,0.06)';
  for (let x = 80; x < W - 80; x += 20) {
    for (let y = 130; y < H - 130; y += 20) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function _drawCornerOrnament(ctx, cx, cy, corner) {
  ctx.save();
  ctx.translate(cx, cy);
  const angles = [0, 90, 270, 180];
  ctx.rotate((angles[corner] * Math.PI) / 180);

  ctx.fillStyle = '#F4A62A';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#1B4332';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#1B4332';
  ctx.font = 'bold 18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', 0, 0);

  ctx.restore();
}

function _drawContent(ctx, { name, school, grade, classNum, date, totalPoints }) {
  const centerX = W / 2;

  // Trophy icons
  ctx.font = '52px serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', centerX - 220, 100);
  ctx.fillText('🏆', centerX + 220, 100);

  // Shield icon
  ctx.fillText('🛡', centerX, 105);

  // Title
  ctx.fillStyle = '#1B4332';
  ctx.font = 'bold 52px Gaegu, serif';
  ctx.textAlign = 'center';
  ctx.fillText('안전 등교 우수 상장', centerX, 175);

  // Divider
  _drawDivider(ctx, centerX, 200);

  // Main body text line 1
  ctx.fillStyle = '#1A1A2E';
  ctx.font = '26px "Noto Sans KR", sans-serif';
  ctx.fillText('위 학생은', centerX, 270);

  // Student name
  ctx.font = 'bold 52px Gaegu, serif';
  ctx.fillStyle = '#1B4332';
  _drawUnderlinedText(ctx, name + ' 학생', centerX, 335);

  // Body text
  ctx.font = '24px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#1A1A2E';
  ctx.fillText('본 안전 등교 도우미 프로그램을 성실히 이용하여', centerX, 400);
  ctx.fillText('안전한 보행 습관을 몸소 실천하였기에', centerX, 438);
  ctx.fillText('이 상장을 수여합니다.', centerX, 476);

  // Divider
  _drawDivider(ctx, centerX, 510);

  // Details row
  ctx.font = '20px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#1A1A2E';
  const detailY = 560;
  const detailSpacing = 230;
  ctx.fillText(`학교: ${school}`, centerX - detailSpacing, detailY);
  ctx.fillText(`${grade}학년 ${classNum}반`, centerX, detailY);
  ctx.fillText(`총 ${totalPoints.toLocaleString()} pt`, centerX + detailSpacing, detailY);

  // Date
  ctx.font = '20px "Noto Sans KR", sans-serif';
  ctx.fillStyle = '#6B7280';
  ctx.fillText(date, centerX, 600);

  // Issuer
  ctx.font = 'bold 24px Gaegu, serif';
  ctx.fillStyle = '#1B4332';
  ctx.fillText('안전 등교 도우미   🛡', centerX, H - 80);
}

function _drawDivider(ctx, cx, y) {
  ctx.strokeStyle = '#D1C9B8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 280, y);
  ctx.lineTo(cx + 280, y);
  ctx.stroke();

  ctx.fillStyle = '#F4A62A';
  ctx.beginPath();
  ctx.arc(cx, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function _drawUnderlinedText(ctx, text, x, y) {
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.strokeStyle = '#1B4332';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + 8);
  ctx.lineTo(x + w / 2, y + 8);
  ctx.stroke();
}
