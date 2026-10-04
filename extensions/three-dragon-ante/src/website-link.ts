import "./website-link.css";

export const ONLINE_WEBSITE = "https://obr.dnd.center/three-dragon-ante/";

/** A native link works before SDK readiness and leaves the host navigation intact. */
export function mountWebsiteLink(root: HTMLElement): void {
  root.className = "tda-website-link";
  const title = document.createElement("h1");
  title.textContent = "三龙牌 · Three-Dragon Ante";
  const link = document.createElement("a");
  link.id = "open-website";
  link.href = ONLINE_WEBSITE;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "打开线上网站 / Open website";
  const address = document.createElement("p");
  address.textContent = "obr.dnd.center/three-dragon-ante/";
  root.replaceChildren(title, link, address);
}
