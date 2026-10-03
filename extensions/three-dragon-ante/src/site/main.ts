/** 独立网站入口（index.html）。不引用枭熊 SDK、不连服务器、不读写任何线上牌局。 */
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import "../presentation/theme/fonts";
import "../presentation/theme/base.css";
import "./site.css";
import { SiteApp } from "./SiteApp";

const root = document.getElementById("site");
if (root) createRoot(root).render(createElement(SiteApp));
