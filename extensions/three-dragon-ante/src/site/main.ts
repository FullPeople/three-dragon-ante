/** 独立网站入口（index.html）：本地对战与权威服务在线房间。没有枭熊身份依赖。 */
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import "../presentation/theme/fonts";
import "../presentation/theme/base.css";
import "./site.css";
import { SiteApp } from "./SiteApp";

const root = document.getElementById("site");
const query = new URLSearchParams(location.search);
// Cached extension backgrounds still open index.html with this modal signature.
// Keep their panel instance and display mode while the website keeps index.html.
if (window.parent !== window && query.get("instance") && ["full", "compact"].includes(query.get("mode") || "")) {
  const table = new URL("table.html", location.href);
  table.search = location.search;
  table.hash = location.hash;
  location.replace(table.href);
} else if (root) createRoot(root).render(createElement(SiteApp));
