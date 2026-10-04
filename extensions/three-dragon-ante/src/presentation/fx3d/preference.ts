/** 用户画质偏好与强制开关：不依赖 three，可被首屏代码（顶栏按钮）静态引用。 */
/** 用户三态开关（顶栏）：localStorage["tda.fx"] = auto | off | low | medium | high；URL ?fx3d=0 关、?fx3d=1 强制开（含软件 GL，测试用；仍尊重已选的档位） */
export function fxPreference(): "auto" | "off" | "low" | "medium" | "high" {
  const url = typeof location !== "undefined" ? new URLSearchParams(location.search).get("fx3d") : null;
  if (url === "0") return "off";
  try { const v = localStorage.getItem("tda.fx"); if (v === "off" || v === "low" || v === "medium" || v === "high") return url === "1" && v === "off" ? "auto" : v; } catch { /* 隐私模式 */ }
  return "auto";
}
export const forced = () => typeof location !== "undefined" && new URLSearchParams(location.search).get("fx3d") === "1";
