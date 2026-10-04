/** 独立网站入口；嵌入环境只提供线上网站链接。 */
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import "../presentation/theme/fonts";
import "../presentation/theme/base.css";
import "./site.css";
import { SiteApp } from "./SiteApp";
import { mountWebsiteLink } from "../website-link";

const root = document.getElementById("site");
// Cached launchers and Suite panels may still load index.html inside an iframe.
// Keep their parent controls available; the game runs in its own browser tab.
if (root) {
  if (window.parent !== window) mountWebsiteLink(root);
  else createRoot(root).render(createElement(SiteApp));
}
