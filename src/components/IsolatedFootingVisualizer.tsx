/**
 * IsolatedFootingVisualizer — Professional Engineering Drawing
 * Three coordinated views:
 *   1. Plan View  — top-down with individual reinforcement bars at real spacing
 *   2. Section A-A — elevation with soil layers, blinding concrete, footing body,
 *                    pedestal/column stub, bottom rebar layer (circles = transverse bars),
 *                    and line bars (longitudinal), plus dowel bars in pedestal
 *   3. Summary Card — key results, checks, reinforcement details
 */

import React from 'react';
import type { IsolatedFootingAnalysisResult } from '@/lib/isolatedFootingEngine';

interface Props {
  result: IsolatedFootingAnalysisResult;
  /** Bar diameter for main footing reinforcement (mm) */
  barDiameter?: number;
  /** Pre-computed bar count in X direction from design engine */
  barCountX?: number;
  /** Pre-computed bar count in Y direction from design engine */
  barCountY?: number;
  /** Blinding concrete thickness below footing (mm, default 75) */
  blindingThickness?: number;
  /** Column / pedestal stub height shown in elevation (mm, default 500) */
  pedestalHeight?: number;
}

/* ── helpers ─────────────────────────────────────────────────── */
function Hatch({ x, y, w, h, spacing = 8, angle = 45, color = '#9ca3af', opacity = 0.55 }: {
  x: number; y: number; w: number; h: number;
  spacing?: number; angle?: number; color?: string; opacity?: number;
}) {
  const id = `hatch-${Math.round(x)}-${Math.round(y)}-${Math.round(w)}-${angle}`;
  return (
    <g>
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width={spacing} height={spacing}
          patternTransform={`rotate(${angle})`}>
          <line x1="0" y1="0" x2="0" y2={spacing} stroke={color} strokeWidth="0.7" opacity={opacity} />
        </pattern>
      </defs>
      <rect x={x} y={y} width={w} height={h} fill={`url(#${id})`} />
    </g>
  );
}

function DimLine({ x1, y1, x2, y2, label, offset = 12, color = '#1e3a8a' }: {
  x1: number; y1: number; x2: number; y2: number;
  label: string; offset?: number; color?: string;
}) {
  const isHoriz = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.8"
        markerStart="url(#arr)" markerEnd="url(#arr)" />
      {isHoriz ? (
        <>
          <line x1={x1} y1={y1} x2={x1} y2={y1 - offset * 0.6} stroke={color} strokeWidth="0.6" strokeDasharray="2,2" />
          <line x1={x2} y1={y2} x2={x2} y2={y2 - offset * 0.6} stroke={color} strokeWidth="0.6" strokeDasharray="2,2" />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x1 - offset * 0.6} y2={y1} stroke={color} strokeWidth="0.6" strokeDasharray="2,2" />
          <line x1={x2} y1={y2} x2={x2 - offset * 0.6} y2={y2} stroke={color} strokeWidth="0.6" strokeDasharray="2,2" />
        </>
      )}
      <rect x={mx - 20} y={my - 6} width={40} height={12} fill="white" opacity="0.9" rx="2" />
      <text x={mx} y={my + 4} textAnchor="middle" fontSize="7" fontWeight="bold" fill={color} fontFamily="Arial,sans-serif">
        {label}
      </text>
    </g>
  );
}

/* ── main component ──────────────────────────────────────────── */
export default function IsolatedFootingVisualizer({
  result,
  barDiameter = 16,
  barCountX,
  barCountY,
  blindingThickness = 75,
  pedestalHeight = 500,
}: Props) {
  const { input, soilPressure, criticalSections } = result;
  const { B, L, Cx, Cy, H } = input;
  const { qmax, qmin, ex, ey, contactAreaRatio } = soilPressure;
  const { punching_b0 } = criticalSections;

  // Effective depth (cover = 75 mm for footing, primary layer)
  const cover = 75;
  const d = Math.max(60, H - cover - barDiameter);

  // ── Compute bar counts if not supplied ───────────────────────
  // Simple estimate: As_req from flexure, then n = As / (π(dia/2)²)
  const barArea = Math.PI * (barDiameter / 2) ** 2; // mm²
  const est_As_x = Math.max(
    0.0018 * L * H,
    (1.2 * input.P * 1000 * Math.max(0.05, (B / 2 - Cx / 2)) / 2) / (0.9 * 420 * 0.9 * d)
  );
  const est_As_y = Math.max(
    0.0018 * B * H,
    (1.2 * input.P * 1000 * Math.max(0.05, (L / 2 - Cy / 2)) / 2) / (0.9 * 420 * 0.9 * (d - barDiameter))
  );
  const nBarsX = barCountX ?? Math.max(5, Math.ceil(est_As_x / barArea));
  const nBarsY = barCountY ?? Math.max(5, Math.ceil(est_As_y / barArea));

  // ── VIEW 1: Plan (top view) ──────────────────────────────────
  const planW = 320;
  const planH = 280;
  const planPad = 45;
  const scale = Math.min((planW - 2 * planPad) / B, (planH - 2 * planPad) / L);
  const footW = B * scale;
  const footH = L * scale;
  const colW  = Cx * scale;
  const colH  = Cy * scale;
  const pcx   = planW / 2;
  const pcy   = planH / 2;
  const fx1 = pcx - footW / 2;  const fx2 = pcx + footW / 2;
  const fy1 = pcy - footH / 2;  const fy2 = pcy + footH / 2;
  const ccx1 = pcx - colW / 2;  const ccx2 = pcx + colW / 2;
  const ccy1 = pcy - colH / 2;  const ccy2 = pcy + colH / 2;

  // Bar positions in plan — X-direction bars (run across B, spaced along L)
  const coverPx = cover * scale;
  const spacingX_plan = (footH - 2 * coverPx) / Math.max(1, nBarsX - 1);
  const barsXplan = Array.from({ length: nBarsX }, (_, i) => fy1 + coverPx + i * spacingX_plan)
    .filter(y => y >= fy1 + 1 && y <= fy2 - 1);

  // Y-direction bars (run across L, spaced along B)
  const spacingY_plan = (footW - 2 * coverPx) / Math.max(1, nBarsY - 1);
  const barsYplan = Array.from({ length: nBarsY }, (_, i) => fx1 + coverPx + i * spacingY_plan)
    .filter(x => x >= fx1 + 1 && x <= fx2 - 1);

  // Punching perimeter
  const d_s = d * scale;
  const punchX1 = ccx1 - d_s / 2;
  const punchX2 = ccx2 + d_s / 2;
  const punchY1 = ccy1 - d_s / 2;
  const punchY2 = ccy2 + d_s / 2;

  // ── VIEW 2: Section A-A ──────────────────────────────────────
  const secW = 320;
  const secH = 290;
  const secPadX = 45;
  const secPadY = 25;

  // Total elevation height to show: pedestal + footing + blinding + soil below + pressure arrows
  const totalElev = pedestalHeight + H + blindingThickness + 80; // px headroom
  const secScale = Math.min(
    (secW - 2 * secPadX) / B,
    (secH - secPadY - 40) / totalElev
  );

  const sFootW    = B * secScale;
  const sH        = H * secScale;
  const sBlindH   = blindingThickness * secScale;
  const sColW     = Cx * secScale;
  const sPedH     = Math.min(pedestalHeight * secScale, 55); // cap for display
  const sCoverPx  = cover * secScale;
  const sBarDiaPx = Math.max(2.5, barDiameter * secScale * 0.5); // circle radius for bar dots
  const sDpx      = d * secScale;

  const sx0 = secW / 2 - sFootW / 2;  // left edge footing
  const sx1 = secW / 2 + sFootW / 2;  // right edge

  // Vertical layout (top → bottom in SVG = up → down in elevation)
  const syPedTop    = secPadY;                           // top of pedestal stub
  const syPedBot    = syPedTop + sPedH;                  // bottom of pedestal = top of footing
  const syFootTop   = syPedBot;
  const syFootBot   = syFootTop + sH;
  const syBlindTop  = syFootBot;
  const syBlindBot  = syBlindTop + sBlindH;
  const sySoilBot   = syBlindBot + 30;                   // soil reference line

  // Bar layer positions in section
  const sBarY1 = syFootBot - sCoverPx;              // X-direction bottom bar centroid (lower layer)
  const sBarY2 = sBarY1 - barDiameter * secScale;   // Y-direction bar centroid (upper layer)

  // Bar positions in section (circles for transverse bars visible as dots)
  const spacingX_sec = (sFootW - 2 * sCoverPx) / Math.max(1, nBarsX - 1);
  const barsXsec = Array.from({ length: nBarsX }, (_, i) => sx0 + sCoverPx + i * spacingX_sec);

  // Soil pressure diagram
  const qScale = Math.min(35, (qmax > 0 ? 35 / qmax : 0.15));
  const qmaxPx = qmax * qScale;
  const qminPx = Math.max(0, qmin) * qScale;
  // eccentricity direction: qmax on right side
  const pressLeft  = (ex >= 0 ? qminPx : qmaxPx);
  const pressRight = (ex >= 0 ? qmaxPx : qminPx);

  // Dowel bars in pedestal
  const nDowels = 4;
  const dowelOffset = (sColW / 2) * 0.65;

  // Checks
  const bearingOk   = soilPressure.qmax <= input.qall;
  const upliftOk    = contactAreaRatio >= 0.75;

  return (
    <div className="space-y-1">

      {/* Drawing title strip */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1e3a8a] rounded-t-md">
        <span className="text-white text-[11px] font-bold tracking-wide">
          تفاصيل القاعدة المفصلة – ACI 318 / SBC 304
        </span>
        <span className="text-blue-200 text-[10px] font-mono">
          B={B}×L={L}×H={H} mm
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-[#1e3a8a] rounded-b-md overflow-hidden bg-white">

        {/* ══ PANEL 1: Plan View ══════════════════════════════════ */}
        <div className="border-r border-[#94a3b8] flex flex-col">
          <div className="bg-[#e8edf5] px-3 py-1 flex items-center justify-between border-b border-[#94a3b8]">
            <span className="text-[11px] font-bold text-[#1e3a8a]">مسقط أفقي (Plan View)</span>
            <span className="text-[9px] text-slate-500 font-mono">المقياس: تقريبي</span>
          </div>

          <div className="flex-1 bg-white flex items-center justify-center py-2">
            <svg width={planW} height={planH} viewBox={`0 0 ${planW} ${planH}`} className="w-full h-auto max-h-[265px]">
              <defs>
                <marker id="arr" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
                  <polygon points="0 0, 5 2.5, 0 5" fill="#1e3a8a" />
                </marker>
                <clipPath id="footing-clip-plan">
                  <rect x={fx1} y={fy1} width={footW} height={footH} />
                </clipPath>
              </defs>

              {/* Center lines */}
              <line x1={pcx} y1={fy1 - 12} x2={pcx} y2={fy2 + 12}
                stroke="#6b7280" strokeWidth="0.6" strokeDasharray="5,3" />
              <line x1={fx1 - 12} y1={pcy} x2={fx2 + 12} y2={pcy}
                stroke="#6b7280" strokeWidth="0.6" strokeDasharray="5,3" />

              {/* Footing outline */}
              <rect x={fx1} y={fy1} width={footW} height={footH}
                fill="#f1f5f9" stroke="#1e293b" strokeWidth="2" />
              <Hatch x={fx1} y={fy1} w={footW} h={footH} spacing={10} angle={45} color="#94a3b8" opacity={0.2} />

              {/* Reinforcement bars – direction X (run across B, spaced along L) */}
              {barsXplan.map((by, i) => (
                <line key={`bx${i}`}
                  x1={fx1 + 3} y1={by} x2={fx2 - 3} y2={by}
                  stroke="#b91c1c" strokeWidth="1.4" opacity={0.9}
                  clipPath="url(#footing-clip-plan)" />
              ))}

              {/* Reinforcement bars – direction Y (run across L, spaced along B) */}
              {barsYplan.map((bx, i) => (
                <line key={`by${i}`}
                  x1={bx} y1={fy1 + 3} x2={bx} y2={fy2 - 3}
                  stroke="#1d4ed8" strokeWidth="1.4" opacity={0.9}
                  clipPath="url(#footing-clip-plan)" />
              ))}

              {/* Column cross-section */}
              <rect x={ccx1} y={ccy1} width={colW} height={colH}
                fill="#475569" stroke="#1e293b" strokeWidth="1.5" />
              <Hatch x={ccx1} y={ccy1} w={colW} h={colH} spacing={6} angle={45} color="white" opacity={0.4} />
              <Hatch x={ccx1} y={ccy1} w={colW} h={colH} spacing={6} angle={-45} color="white" opacity={0.4} />

              {/* Section cut line A-A */}
              <line x1={fx1 - 14} y1={pcy} x2={fx1 - 5} y2={pcy} stroke="#cc0000" strokeWidth="1.5" />
              <text x={fx1 - 14} y={pcy - 4} fontSize="8" fill="#cc0000" fontWeight="bold">A</text>
              <line x1={fx2 + 5} y1={pcy} x2={fx2 + 14} y2={pcy} stroke="#cc0000" strokeWidth="1.5" />
              <text x={fx2 + 8} y={pcy - 4} fontSize="8" fill="#cc0000" fontWeight="bold">A</text>

              {/* Punching perimeter (d/2) */}
              <rect x={Math.max(punchX1, fx1)} y={Math.max(punchY1, fy1)}
                width={Math.min(punchX2, fx2) - Math.max(punchX1, fx1)}
                height={Math.min(punchY2, fy2) - Math.max(punchY1, fy1)}
                fill="none" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,2" />

              {/* Bending critical section lines */}
              <line x1={ccx1} y1={fy1} x2={ccx1} y2={fy2} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
              <line x1={ccx2} y1={fy1} x2={ccx2} y2={fy2} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
              <line x1={fx1} y1={ccy1} x2={fx2} y2={ccy1} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />
              <line x1={fx1} y1={ccy2} x2={fx2} y2={ccy2} stroke="#2563eb" strokeWidth="0.8" strokeDasharray="3,2" />

              {/* Dimensions */}
              <DimLine x1={fx1} y1={fy1 - 20} x2={fx2} y2={fy1 - 20} label={`B=${B}`} offset={14} />
              <DimLine x1={fx2 + 22} y1={fy1} x2={fx2 + 22} y2={fy2} label={`L=${L}`} offset={14} />

              {/* Legend */}
              <line x1={fx1} y1={fy2 + 12} x2={fx1 + 12} y2={fy2 + 12} stroke="#b91c1c" strokeWidth="1.5" />
              <text x={fx1 + 14} y={fy2 + 16} fontSize="7" fill="#b91c1c">تسليح X ({nBarsX}Ø{barDiameter})</text>
              <line x1={fx1} y1={fy2 + 22} x2={fx1 + 12} y2={fy2 + 22} stroke="#1d4ed8" strokeWidth="1.5" />
              <text x={fx1 + 14} y={fy2 + 26} fontSize="7" fill="#1d4ed8">تسليح Y ({nBarsY}Ø{barDiameter})</text>
            </svg>
          </div>

          <div className="px-2 pb-1 flex gap-3 text-[9px] text-slate-600 flex-wrap">
            <span>🔴 تسليح X: {nBarsX}Ø{barDiameter}</span>
            <span>🔵 تسليح Y: {nBarsY}Ø{barDiameter}</span>
            <span>⬜ محيط b₀={punching_b0.toFixed(0)}mm</span>
          </div>
        </div>

        {/* ══ PANEL 2: Cross-Section A-A ══════════════════════════ */}
        <div className="border-r border-[#94a3b8] flex flex-col">
          <div className="bg-[#e8edf5] px-3 py-1 flex items-center justify-between border-b border-[#94a3b8]">
            <span className="text-[11px] font-bold text-[#1e3a8a]">قطاع A-A (Section A-A)</span>
            <span className="text-[9px] text-slate-500 font-mono">قطاع طولي بالسياخ الحقيقية</span>
          </div>

          <div className="flex-1 bg-white flex items-center justify-center py-2">
            <svg width={secW} height={secH} viewBox={`0 0 ${secW} ${secH}`} className="w-full h-auto max-h-[270px]">
              <defs>
                <marker id="arr2" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
                  <polygon points="0 0, 5 2.5, 0 5" fill="#1e3a8a" />
                </marker>
                <pattern id="soil-pat" patternUnits="userSpaceOnUse" width="8" height="8">
                  <rect width="8" height="8" fill="#d4a96a" opacity="0.25" />
                  <circle cx="2" cy="2" r="1" fill="#92400e" opacity="0.5" />
                  <circle cx="6" cy="6" r="1" fill="#92400e" opacity="0.5" />
                </pattern>
                <clipPath id="foot-clip-sec">
                  <rect x={sx0} y={syFootTop} width={sFootW} height={sH} />
                </clipPath>
              </defs>

              {/* ── Ground / Soil above footing ── */}
              {/* Soil fill on sides of footing (cover depth) */}
              <rect x={20} y={syPedTop + sPedH * 0.4} width={sx0 - 22} height={syFootTop - syPedTop - sPedH * 0.4 + sH * 0.7}
                fill="url(#soil-pat)" />
              <rect x={sx1 + 2} y={syPedTop + sPedH * 0.4} width={secW - sx1 - 22} height={syFootTop - syPedTop - sPedH * 0.4 + sH * 0.7}
                fill="url(#soil-pat)" />

              {/* ── Blinding concrete (طبقة نظافة) ── */}
              <rect x={sx0 - 5} y={syBlindTop} width={sFootW + 10} height={sBlindH}
                fill="#d4d4aa" stroke="#78716c" strokeWidth="1" />
              <Hatch x={sx0 - 5} y={syBlindTop} w={sFootW + 10} h={sBlindH}
                spacing={5} angle={45} color="#78716c" opacity={0.4} />
              <text x={secW / 2} y={syBlindTop + sBlindH / 2 + 3} textAnchor="middle"
                fontSize="6.5" fill="#57534e" fontWeight="bold" fontFamily="Arial,sans-serif">
                طبقة نظافة {blindingThickness}mm
              </text>

              {/* ── Footing concrete body ── */}
              <rect x={sx0} y={syFootTop} width={sFootW} height={sH}
                fill="#e2e8f0" stroke="#1e293b" strokeWidth="2" />
              <Hatch x={sx0} y={syFootTop} w={sFootW} h={sH} spacing={9} angle={45} color="#94a3b8" opacity={0.35} />

              {/* ── Pedestal / Column stub ── */}
              <rect x={secW / 2 - sColW / 2} y={syPedTop} width={sColW} height={sPedH}
                fill="#64748b" stroke="#1e293b" strokeWidth="1.5" />
              <Hatch x={secW / 2 - sColW / 2} y={syPedTop} w={sColW} h={sPedH}
                spacing={6} angle={45} color="white" opacity={0.4} />
              <Hatch x={secW / 2 - sColW / 2} y={syPedTop} w={sColW} h={sPedH}
                spacing={6} angle={-45} color="white" opacity={0.4} />

              {/* Column label */}
              <text x={secW / 2} y={syPedTop - 5} textAnchor="middle" fontSize="7.5" fill="#334155" fontWeight="bold">
                عمود {Cx}×{Cy} mm
              </text>

              {/* ── Dowel bars in pedestal ── */}
              {[-dowelOffset, dowelOffset].map((dx, i) => (
                <g key={`dowel${i}`}>
                  {/* Dowel line inside footing */}
                  <line
                    x1={secW / 2 + dx} y1={syFootBot - sCoverPx * 1.5}
                    x2={secW / 2 + dx} y2={syPedBot}
                    stroke="#dc2626" strokeWidth="1.5" strokeDasharray="3,2" />
                  {/* Dowel continues into pedestal */}
                  <line
                    x1={secW / 2 + dx} y1={syPedBot}
                    x2={secW / 2 + dx} y2={syPedTop + 4}
                    stroke="#dc2626" strokeWidth="1.5" />
                </g>
              ))}

              {/* ── Bottom reinforcement layer (X-bars as line + Y-bars as circles) ── */}
              {/* X-direction: single thick bar line (bottom layer, runs into page / horizontal) */}
              <line
                x1={sx0 + sCoverPx} y1={sBarY1}
                x2={sx1 - sCoverPx} y2={sBarY1}
                stroke="#b91c1c" strokeWidth={Math.max(2, barDiameter * secScale * 0.7)}
                strokeLinecap="round"
              />
              {/* Hook left */}
              <path d={`M ${sx0 + sCoverPx} ${sBarY1} Q ${sx0 + sCoverPx - 3} ${sBarY1 - 9} ${sx0 + sCoverPx} ${sBarY1 - 16}`}
                fill="none" stroke="#b91c1c" strokeWidth="2" />
              {/* Hook right */}
              <path d={`M ${sx1 - sCoverPx} ${sBarY1} Q ${sx1 - sCoverPx + 3} ${sBarY1 - 9} ${sx1 - sCoverPx} ${sBarY1 - 16}`}
                fill="none" stroke="#b91c1c" strokeWidth="2" />

              {/* Y-direction bars as circles (transverse, visible in cross-section) */}
              {barsXsec.map((bx, i) => (
                <circle key={`dot${i}`}
                  cx={bx} cy={sBarY2}
                  r={Math.max(2, sBarDiaPx)}
                  fill="#1d4ed8" stroke="white" strokeWidth="0.8" />
              ))}

              {/* ── Cover dimension ── */}
              <line x1={sx0 + 2} y1={syFootBot - 2}
                x2={sx0 + 2} y2={sBarY1}
                stroke="#ef4444" strokeWidth="0.8" markerStart="url(#arr2)" markerEnd="url(#arr2)" />
              <rect x={sx0 + 4} y={(syFootBot + sBarY1) / 2 - 5} width={20} height={10} fill="white" opacity="0.85" rx="1" />
              <text x={sx0 + 14} y={(syFootBot + sBarY1) / 2 + 3} fontSize="6.5" fill="#ef4444" fontWeight="bold">c=75</text>

              {/* ── Effective depth d ── */}
              <line x1={sx1 + 12} y1={syFootTop + sCoverPx}
                x2={sx1 + 12} y2={sBarY2}
                stroke="#7c3aed" strokeWidth="0.8"
                markerStart="url(#arr2)" markerEnd="url(#arr2)" />
              <rect x={sx1 + 14} y={(syFootTop + sCoverPx + sBarY2) / 2 - 5} width={24} height={10} fill="white" opacity="0.85" rx="1" />
              <text x={sx1 + 26} y={(syFootTop + sCoverPx + sBarY2) / 2 + 3}
                fontSize="6.5" fill="#7c3aed" fontWeight="bold">d={d.toFixed(0)}</text>

              {/* ── Soil pressure diagram ── */}
              <polygon
                points={`${sx0},${syBlindBot} ${sx1},${syBlindBot} ${sx1},${syBlindBot + pressRight} ${sx0},${syBlindBot + pressLeft}`}
                fill="#fbbf24" opacity="0.35" />
              <line x1={sx0} y1={syBlindBot} x2={sx0} y2={syBlindBot + pressLeft}
                stroke="#d97706" strokeWidth="1.2" />
              <line x1={sx1} y1={syBlindBot} x2={sx1} y2={syBlindBot + pressRight}
                stroke="#d97706" strokeWidth="1.2" />
              <text x={sx0 + 2} y={syBlindBot + pressLeft + 8} fontSize="6.5" fill="#92400e">q={qmin.toFixed(0)}</text>
              <text x={sx1 - 2} y={syBlindBot + pressRight + 8} textAnchor="end" fontSize="6.5" fill="#92400e">q={qmax.toFixed(0)}</text>

              {/* ── Dimensions ── */}
              {/* H (footing height) */}
              <DimLine x1={sx0 - 22} y1={syFootTop} x2={sx0 - 22} y2={syFootBot}
                label={`H=${H}`} offset={14} color="#1e3a8a" />
              {/* Blinding */}
              <DimLine x1={sx0 - 22} y1={syBlindTop} x2={sx0 - 22} y2={syBlindBot}
                label={`${blindingThickness}`} offset={14} color="#78716c" />
              {/* B */}
              <DimLine x1={sx0} y1={syBlindBot + pressRight + 18} x2={sx1} y2={syBlindBot + pressRight + 18}
                label={`B=${B}`} offset={12} color="#1e3a8a" />

              {/* Section label */}
              <text x={22} y={syPedTop + 10} fontSize="10" fill="#cc0000" fontWeight="bold">A</text>
              <text x={secW - 22} y={syPedTop + 10} textAnchor="end" fontSize="10" fill="#cc0000" fontWeight="bold">A</text>

              {/* Ground level dashed line */}
              <line x1={20} y1={syFootTop} x2={sx0 - 2} y2={syFootTop}
                stroke="#15803d" strokeWidth="0.8" strokeDasharray="4,2" />
              <line x1={sx1 + 2} y1={syFootTop} x2={secW - 20} y2={syFootTop}
                stroke="#15803d" strokeWidth="0.8" strokeDasharray="4,2" />
              <text x={22} y={syFootTop - 2} fontSize="6" fill="#15803d">G.L</text>
            </svg>
          </div>

          <div className="px-2 pb-1 flex gap-2 text-[9px] text-slate-600 flex-wrap">
            <span>🔴 تسليح X (الطبقة السفلية)</span>
            <span>🔵 تسليح Y (دوائر - طولي)</span>
            <span>🔻 روابط (dowels) رقبة الأساس</span>
            <span>🟡 ضغط التربة</span>
          </div>
        </div>

        {/* ══ PANEL 3: Results Summary Card ═══════════════════════ */}
        <div className="flex flex-col">
          <div className="bg-[#e8edf5] px-3 py-1 flex items-center justify-between border-b border-[#94a3b8]">
            <span className="text-[11px] font-bold text-[#1e3a8a]">ملخص النتائج والتحقق</span>
            <span className="text-[9px] text-slate-500">ACI 318-19</span>
          </div>

          <div className="flex-1 p-2 space-y-2 overflow-auto text-right" dir="rtl">

            {/* Soil pressure */}
            <div>
              <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded mb-1">ضغط التربة</div>
              <table className="w-full text-[10px] border-collapse">
                <tbody>
                  {[
                    ['q_all المسموح', `${input.qall.toFixed(0)} kN/m²`, true],
                    ['q_max الأقصى', `${qmax.toFixed(1)} kN/m²`, bearingOk],
                    ['q_min الأدنى', `${qmin.toFixed(1)} kN/m²`, true],
                    ['نسبة التماس', `${(contactAreaRatio * 100).toFixed(0)}%`, upliftOk],
                  ].map(([k, v, ok]) => (
                    <tr key={String(k)} className="border-b border-slate-100">
                      <td className="py-0.5 pr-1 text-slate-600">{k}</td>
                      <td className={`py-0.5 text-center font-mono font-bold ${ok ? 'text-green-700' : 'text-red-600'}`}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Eccentricity */}
            <div>
              <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded mb-1">اللامركزية</div>
              <table className="w-full text-[10px] border-collapse">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="py-0.5 pr-1 text-slate-600">eₓ</td>
                    <td className="py-0.5 text-center font-mono">{ex.toFixed(1)} mm</td>
                    <td className={`py-0.5 text-center text-[9px] font-bold ${Math.abs(ex) <= B / 6 ? 'text-green-700' : 'text-red-600'}`}>
                      {Math.abs(ex) <= B / 6 ? 'داخل النواة ✓' : 'خارج ✗'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-0.5 pr-1 text-slate-600">eᵧ</td>
                    <td className="py-0.5 text-center font-mono">{ey.toFixed(1)} mm</td>
                    <td className={`py-0.5 text-center text-[9px] font-bold ${Math.abs(ey) <= L / 6 ? 'text-green-700' : 'text-red-600'}`}>
                      {Math.abs(ey) <= L / 6 ? 'داخل النواة ✓' : 'خارج ✗'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Geometry */}
            <div>
              <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded mb-1">هندسة القاعدة</div>
              <table className="w-full text-[10px] border-collapse">
                <tbody>
                  {[
                    ['العرض B', `${B} mm`],
                    ['الطول L', `${L} mm`],
                    ['السماكة H', `${H} mm`],
                    ['الارتفاع الفعال d', `${d.toFixed(0)} mm`],
                    ['غطاء الخرسانة', `${cover} mm`],
                    ['طبقة النظافة', `${blindingThickness} mm`],
                    ['محيط الثقب b₀', `${punching_b0.toFixed(0)} mm`],
                  ].map(([k, v]) => (
                    <tr key={String(k)} className="border-b border-slate-100">
                      <td className="py-0.5 pr-1 text-slate-600">{k}</td>
                      <td className="py-0.5 text-center font-mono font-bold text-slate-800">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Reinforcement */}
            <div>
              <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded mb-1">التسليح</div>
              <div className="text-[10px] space-y-0.5 px-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">اتجاه X (عبر B):</span>
                  <span className="font-mono font-bold text-red-700">{nBarsX}Ø{barDiameter}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">اتجاه Y (عبر L):</span>
                  <span className="font-mono font-bold text-blue-700">{nBarsY}Ø{barDiameter}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">روابط رقبة (Dowels):</span>
                  <span className="font-mono text-slate-700">{nDowels}Ø{barDiameter}</span>
                </div>
                <div className="flex justify-between pt-0.5 border-t border-slate-100">
                  <span className="text-slate-600">التباعد X:</span>
                  <span className="font-mono text-slate-700">
                    {nBarsX > 1 ? Math.round((B - 2 * cover) / (nBarsX - 1)) : (B - 2 * cover)} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">التباعد Y:</span>
                  <span className="font-mono text-slate-700">
                    {nBarsY > 1 ? Math.round((L - 2 * cover) / (nBarsY - 1)) : (L - 2 * cover)} mm
                  </span>
                </div>
              </div>
            </div>

            {/* Pedestal */}
            <div>
              <div className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded mb-1">رقبة الأساس (Pedestal)</div>
              <div className="text-[10px] space-y-0.5 px-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">أبعاد العمود:</span>
                  <span className="font-mono font-bold">{Cx}×{Cy} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ارتفاع الرقبة:</span>
                  <span className="font-mono font-bold">{pedestalHeight} mm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">روابط التثبيت:</span>
                  <span className="font-mono font-bold text-red-700">{nDowels}Ø{barDiameter}</span>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
