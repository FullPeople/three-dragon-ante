/** 独立网站入口（index.html）：本地对战与权威服务在线房间。没有枭熊身份依赖。 */
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import "../presentation/theme/fonts";
import "../presentation/theme/base.css";
import "./site.css";
import { SiteApp } from "./SiteApp";

const root = document.getElementById("site");
if (root) createRoot(root).render(createElement(SiteApp));
